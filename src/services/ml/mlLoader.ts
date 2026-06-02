// 模型加载器：单例管理 Web Worker 生命周期和模型加载状态
// 所有 ML 功能统一通过此加载器获取模型，避免重复下载

import { MODELS } from './mlConfig';

// 模型加载状态
export type ModelState = 'idle' | 'downloading' | 'ready' | 'error';

// 模型条目
interface ModelEntry {
  state: ModelState;
  progress: number;   // 0-100
  error: string | null;
}

// 推理请求的 Promise 回调
interface PendingRequest {
  resolve: (data: any) => void;
  reject: (error: Error) => void;
}

class MlLoader {
  private static instance: MlLoader | null = null;

  private worker: Worker | null = null;
  private models = new Map<string, ModelEntry>();
  private pendingRequests = new Map<string, PendingRequest>();
  private requestIdCounter = 0;
  private listeners = new Set<() => void>();

  private constructor() {}

  // 获取单例
  static getInstance(): MlLoader {
    if (!MlLoader.instance) {
      MlLoader.instance = new MlLoader();
    }
    return MlLoader.instance;
  }

  // 懒初始化 Worker
  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('./mlWorker.ts', import.meta.url),
        { type: 'module' }
      );
      this.worker.onmessage = (event: MessageEvent) => {
        this.handleWorkerMessage(event.data);
      };
      this.worker.onerror = (error) => {
        console.error('[mlLoader] Worker 错误:', error);
      };
    }
    return this.worker;
  }

  // 处理 Worker 发回的消息
  private handleWorkerMessage(msg: any): void {
    switch (msg.type) {
      case 'progress': {
        const entry = this.models.get(msg.modelId);
        if (entry) {
          entry.state = 'downloading';
          entry.progress = msg.progress || 0;
          this.notifyListeners();
        }
        break;
      }
      case 'ready': {
        const entry = this.models.get(msg.modelId);
        if (entry) {
          entry.state = 'ready';
          entry.progress = 100;
          this.notifyListeners();
        }
        break;
      }
      case 'result': {
        const pending = this.pendingRequests.get(msg.requestId);
        if (pending) {
          pending.resolve(msg.data);
          this.pendingRequests.delete(msg.requestId);
        }
        break;
      }
      case 'error': {
        // 可能是加载错误或推理错误
        if (msg.modelId && this.models.has(msg.modelId)) {
          const entry = this.models.get(msg.modelId)!;
          entry.state = 'error';
          entry.error = msg.message;
          this.notifyListeners();
        }
        if (msg.requestId && this.pendingRequests.has(msg.requestId)) {
          const pending = this.pendingRequests.get(msg.requestId)!;
          pending.reject(new Error(msg.message));
          this.pendingRequests.delete(msg.requestId);
        }
        break;
      }
      case 'unloaded': {
        const entry = this.models.get(msg.modelId);
        if (entry) {
          entry.state = 'idle';
          entry.progress = 0;
          this.notifyListeners();
        }
        break;
      }
    }
  }

  // 通知所有监听器（React 组件通过 useModelStatus hook 订阅）
  private notifyListeners(): void {
    this.listeners.forEach(fn => fn());
  }

  // 订阅状态变更
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // 加载模型
  async loadModel(
    modelId: string,
    task: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    // 已就绪，直接返回
    const entry = this.models.get(modelId);
    if (entry?.state === 'ready') return;

    // 已在下载中，等它完成
    if (entry?.state === 'downloading') {
      return new Promise<void>((resolve) => {
        const check = () => {
          const e = this.models.get(modelId);
          if (e?.state === 'ready') {
            resolve();
          } else if (e?.state === 'error') {
            // 不清除错误状态，让调用方检查
            resolve();
          } else {
            setTimeout(check, 200);
          }
        };
        check();
      });
    }

    // 新建条目并开始加载
    this.models.set(modelId, {
      state: 'downloading',
      progress: 0,
      error: null,
    });

    // 订阅进度更新
    let unsubscribe: (() => void) | null = null;
    if (onProgress) {
      unsubscribe = this.subscribe(() => {
        const e = this.models.get(modelId);
        if (e) onProgress(e.progress);
      });
    }

    try {
      const worker = this.getWorker();
      worker.postMessage({ type: 'load', modelId, task });
    } finally {
      // 等待加载完成
      await new Promise<void>((resolve) => {
        const check = () => {
          const e = this.models.get(modelId);
          if (e?.state === 'ready' || e?.state === 'error') {
            resolve();
          } else {
            setTimeout(check, 200);
          }
        };
        check();
      });
      if (unsubscribe) unsubscribe();
    }
  }

  // 执行推理
  async infer(modelId: string, inputs: any): Promise<any> {
    const requestId = `req_${++this.requestIdCounter}`;

    return new Promise<any>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      const worker = this.getWorker();
      worker.postMessage({ type: 'infer', requestId, modelId, inputs });

      // 30 秒超时
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('推理请求超时'));
        }
      }, 30000);
    });
  }

  // 卸载模型（释放 Worker 内存）
  unloadModel(modelId: string): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'unload', modelId });
    }
  }

  // 获取模型状态
  getModelState(modelId: string): ModelEntry {
    return (
      this.models.get(modelId) || {
        state: 'idle',
        progress: 0,
        error: null,
      }
    );
  }

  // 模型是否就绪
  isModelReady(modelId: string): boolean {
    return this.models.get(modelId)?.state === 'ready';
  }

  // 获取整体加载进度（所有模型的平均）
  getOverallProgress(): { loading: boolean; progress: number } {
    const entries = Array.from(this.models.values()).filter(
      e => e.state === 'downloading' || e.state === 'ready'
    );
    if (entries.length === 0) return { loading: false, progress: 0 };

    const loading = entries.some(e => e.state === 'downloading');
    const totalProgress = entries.reduce((sum, e) => sum + e.progress, 0);
    return {
      loading,
      progress: Math.round(totalProgress / entries.length),
    };
  }

  // 销毁（清理 Worker 和所有模型）
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.models.clear();
    this.pendingRequests.clear();
    this.listeners.clear();
    MlLoader.instance = null;
  }
}

// 导出单例
export const mlLoader = MlLoader.getInstance();

// 便捷函数：加载零样本分类模型
export async function loadZeroShotModel(onProgress?: (p: number) => void): Promise<void> {
  return mlLoader.loadModel(MODELS.ZERO_SHOT, 'zero-shot-classification', onProgress);
}

// 便捷函数：加载嵌入向量模型
export async function loadEmbeddingModel(onProgress?: (p: number) => void): Promise<void> {
  return mlLoader.loadModel(MODELS.EMBEDDING, 'feature-extraction', onProgress);
}

// 便捷函数：运行零样本分类推理
export async function runZeroShot(text: string, labels: string[]): Promise<{
  sequence: string;
  labels: string[];
  scores: number[];
}> {
  return mlLoader.infer(MODELS.ZERO_SHOT, { text, candidate_labels: labels });
}

// 便捷函数：运行嵌入向量推理
export async function runEmbedding(text: string): Promise<number[]> {
  const result = await mlLoader.infer(MODELS.EMBEDDING, {
    text,
    options: { pooling: 'mean', normalize: true },
  });
  // 结果可能是 Float32Array 或普通数组
  return Array.from(result.data || result);
}
