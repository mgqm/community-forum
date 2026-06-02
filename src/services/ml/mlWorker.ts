// Web Worker：在独立线程中运行 transformers.js 的 ONNX 模型推理
// 避免阻塞主线程，保证 UI 流畅

import { pipeline, env } from '@huggingface/transformers';

// 配置：使用浏览器缓存，跳过本地模型检查
env.allowLocalModels = false;
env.useBrowserCache = true;

// 存储已加载的 Pipeline 实例
const pipelines = new Map<string, any>();

// 推理请求队列：同一模型的请求排队执行，避免并发导致内存问题
const queues = new Map<string, Promise<any>>();

// 消息类型定义
type WorkerMessage =
  | { type: 'load'; modelId: string; task: string }
  | { type: 'infer'; requestId: string; modelId: string; inputs: any }
  | { type: 'unload'; modelId: string };

// 加载模型
async function handleLoad(modelId: string, task: string): Promise<void> {
  if (pipelines.has(modelId)) {
    self.postMessage({ type: 'ready', modelId });
    return;
  }

  try {
    const pipe = await pipeline(task as any, modelId, {
      progress_callback: (progress: any) => {
        if (progress.status === 'downloading' || progress.status === 'progress') {
          self.postMessage({
            type: 'progress', modelId,
            status: progress.status,
            progress: progress.progress || 0,
            loaded: progress.loaded || 0,
            total: progress.total || 0,
          });
        }
      },
    });

    pipelines.set(modelId, pipe);
    self.postMessage({ type: 'ready', modelId });
  } catch (error: any) {
    self.postMessage({ type: 'error', modelId, message: error.message || '模型加载失败' });
  }
}

// 执行推理
async function handleInfer(requestId: string, modelId: string, inputs: any): Promise<void> {
  const pipe = pipelines.get(modelId);
  if (!pipe) {
    self.postMessage({ type: 'error', requestId, message: `模型未加载: ${modelId}` });
    return;
  }

  const prev = queues.get(modelId) || Promise.resolve();
  const current = prev
    .then(() => pipe(inputs))
    .then((result: any) => {
      self.postMessage({ type: 'result', requestId, data: result });
    })
    .catch((error: any) => {
      self.postMessage({ type: 'error', requestId, message: error.message || '推理失败' });
    })
    .finally(() => {
      if (queues.get(modelId) === current) queues.delete(modelId);
    });

  queues.set(modelId, current);
}

// 卸载模型
function handleUnload(modelId: string): void {
  pipelines.delete(modelId);
  queues.delete(modelId);
  self.postMessage({ type: 'unloaded', modelId });
}

// Worker 消息入口
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const msg = event.data;
  switch (msg.type) {
    case 'load': handleLoad(msg.modelId, msg.task); break;
    case 'infer': handleInfer(msg.requestId, msg.modelId, msg.inputs); break;
    case 'unload': handleUnload(msg.modelId); break;
  }
};
