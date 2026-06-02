// 智能分类服务
// 使用零样本分类模型自动给帖子打标签

import {
  CATEGORY_LABELS,
  CATEGORY_CONFIDENCE_THRESHOLD,
  MAX_CATEGORIES_PER_POST,
  FEATURES,
} from './mlConfig';
import { mlLoader, runZeroShot, loadZeroShotModel } from './mlLoader';

export interface CategoryResult {
  tags: string[];
  scores: Record<string, number>;
}

/**
 * 对文本内容进行自动分类
 *
 * @param text 帖子文本内容
 * @param onProgress 模型下载进度回调
 * @returns 分类结果（top-N 标签及其置信度）
 */
export async function smartCategorize(
  text: string,
  onProgress?: (progress: number) => void
): Promise<CategoryResult> {
  if (!FEATURES.SMART_CATEGORIZATION) {
    return { tags: [], scores: {} };
  }

  const modelId = 'Xenova/distilbert-base-multilingual-cased-mnli';

  // 确保模型已加载
  if (!mlLoader.isModelReady(modelId)) {
    const state = mlLoader.getModelState(modelId).state;
    if (state === 'idle') {
      // 首次使用，后台加载
      loadZeroShotModel(onProgress).catch(() => {});
      return { tags: [], scores: {} };
    } else if (state === 'downloading') {
      // 正在下载中，本次跳过
      return { tags: [], scores: {} };
    } else if (state === 'error') {
      return { tags: [], scores: {} };
    }
  }

  try {
    const result = await runZeroShot(text, CATEGORY_LABELS);

    // 构建分数映射
    const scores: Record<string, number> = {};
    for (let i = 0; i < result.labels.length; i++) {
      scores[result.labels[i]] = result.scores[i];
    }

    // 筛选高于阈值的标签
    const qualified = CATEGORY_LABELS
      .filter(label => (scores[label] || 0) >= CATEGORY_CONFIDENCE_THRESHOLD)
      .sort((a, b) => (scores[b] || 0) - (scores[a] || 0));

    // 取 top-N
    const tags = qualified.slice(0, MAX_CATEGORIES_PER_POST);

    return { tags, scores };
  } catch (err) {
    console.warn('[智能分类] 模型推理失败:', err);
    return { tags: [], scores: {} };
  }
}
