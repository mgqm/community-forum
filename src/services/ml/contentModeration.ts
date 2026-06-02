// 内容审核服务
// 双层检测：关键词匹配（同步） + 零样本分类模型（异步）

import {
  MODERATION_HYPOTHESES,
  MODERATION_THRESHOLD,
  FEATURES,
} from './mlConfig';
import {
  matchKeywords,
  getKeywordScore,
  type KeywordMatch,
  CATEGORY_NAMES,
} from './chineseKeywordDict';
import { mlLoader, runZeroShot, loadZeroShotModel } from './mlLoader';

export interface ModerationResult {
  isClean: boolean;
  score: number;
  details: {
    keywordMatches: KeywordMatch[];
    modelScores?: Record<string, number>;
  };
  source: 'keyword' | 'model' | 'both' | 'none';
}

/**
 * 检查文本内容是否包含不当信息
 *
 * @param text 待检测的文本内容
 * @param onProgress 模型下载进度回调 (0-100)
 * @returns 审核结果
 */
export async function checkContent(
  text: string,
  onProgress?: (progress: number) => void
): Promise<ModerationResult> {
  if (!FEATURES.CONTENT_MODERATION) {
    return { isClean: true, score: 0, details: { keywordMatches: [] }, source: 'none' };
  }

  // 第一层：关键词快速检测（同步）
  const keywordMatches = matchKeywords(text);
  const keywordScore = getKeywordScore(text);

  // 严重违规直接标记（无需模型二次确认）
  if (keywordScore >= 0.85) {
    return {
      isClean: false,
      score: keywordScore,
      details: { keywordMatches },
      source: 'keyword',
    };
  }

  // 第二层：零样本分类模型检测（异步）
  let modelScores: Record<string, number> | undefined;
  let modelScore = 0;

  try {
    if (mlLoader.isModelReady('Xenova/distilbert-base-multilingual-cased-mnli')) {
      // 模型已就绪，直接推理
      const result = await runZeroShot(text, MODERATION_HYPOTHESES);
      // 将标签映射为分数
      modelScores = {};
      for (let i = 0; i < result.labels.length; i++) {
        modelScores[result.labels[i]] = result.scores[i];
      }
      // 取不良假设的最高分（排除"正常友好"假设）
      const toxicScores = MODERATION_HYPOTHESES
        .filter(h => h !== '这段文本是正常友好的交流')
        .map(h => modelScores![h] || 0);
      modelScore = Math.max(...toxicScores);
    } else if (mlLoader.getModelState('Xenova/distilbert-base-multilingual-cased-mnli').state === 'idle') {
      // 首次使用，尝试加载模型（后台进行，不阻塞）
      loadZeroShotModel(onProgress).catch(() => {});
    }
  } catch (err) {
    // 模型推理失败，降级为仅关键词检测
    console.warn('[内容审核] 模型推理失败，使用关键词检测结果:', err);
  }

  // 综合评分：模型分数与关键词分数取较大值
  const finalScore = Math.max(keywordScore, modelScore * 0.9); // 模型分数略打折扣

  return {
    isClean: finalScore < MODERATION_THRESHOLD,
    score: finalScore,
    details: { keywordMatches, modelScores },
    source: modelScores ? (keywordMatches.length > 0 ? 'both' : 'model') : (keywordMatches.length > 0 ? 'keyword' : 'none'),
  };
}

/**
 * 获取审核结果的中文摘要
 */
export function getModerationSummary(result: ModerationResult): string[] {
  const flags: string[] = [];

  for (const match of result.details.keywordMatches) {
    const catName = CATEGORY_NAMES[match.category] || match.category;
    if (!flags.includes(catName)) {
      flags.push(catName);
    }
  }

  if (result.details.modelScores) {
    for (const hypothesis of MODERATION_HYPOTHESES) {
      if (hypothesis === '这段文本是正常友好的交流') continue;
      const score = result.details.modelScores[hypothesis] || 0;
      if (score > MODERATION_THRESHOLD) {
        // 简化假设模板为短标签
        const shortLabel = hypothesis.replace('这段文本', '').replace('包含', '').replace('内容', '');
        if (!flags.includes(shortLabel)) {
          flags.push(shortLabel);
        }
      }
    }
  }

  return flags;
}
