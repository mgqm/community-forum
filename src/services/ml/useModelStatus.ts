// React Hook：订阅 ML 模型加载状态
// 用于在 UI 中显示模型下载进度和就绪状态

import React from 'react';
import { mlLoader, type ModelState } from './mlLoader';
import { MODELS } from './mlConfig';

interface ModelStatus {
  zeroShotState: ModelState;
  zeroShotProgress: number;
  zeroShotReady: boolean;

  embeddingState: ModelState;
  embeddingProgress: number;
  embeddingReady: boolean;

  overallLoading: boolean;
  overallProgress: number;
}

/**
 * 订阅所有 ML 模型的加载状态
 * 当模型状态变化时自动更新组件
 */
export function useModelStatus(): ModelStatus {
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);

  React.useEffect(() => {
    // 订阅 mlLoader 状态变更
    const unsubscribe = mlLoader.subscribe(() => {
      forceUpdate();
    });
    return unsubscribe;
  }, []);

  const zeroShot = mlLoader.getModelState(MODELS.ZERO_SHOT);
  const embedding = mlLoader.getModelState(MODELS.EMBEDDING);
  const overall = mlLoader.getOverallProgress();

  return {
    zeroShotState: zeroShot.state,
    zeroShotProgress: zeroShot.progress,
    zeroShotReady: zeroShot.state === 'ready',

    embeddingState: embedding.state,
    embeddingProgress: embedding.progress,
    embeddingReady: embedding.state === 'ready',

    overallLoading: overall.loading,
    overallProgress: overall.progress,
  };
}

export type { ModelStatus, ModelState };
