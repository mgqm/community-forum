// 语义搜索服务
// 使用嵌入向量模型将文本转为向量，通过余弦相似度进行语义匹配

import {
  FEATURES,
  SEMANTIC_SEARCH_THRESHOLD,
} from './mlConfig';
import {
  mlLoader,
  runEmbedding,
  loadEmbeddingModel,
} from './mlLoader';

export interface RankedPost {
  post: any;
  similarity: number;
}

/**
 * 为文档文本生成嵌入向量
 * e5 模型要求文档以 "passage: " 为前缀
 */
export async function generateDocumentEmbedding(
  text: string,
  onProgress?: (progress: number) => void
): Promise<number[] | null> {
  if (!FEATURES.SEMANTIC_SEARCH) return null;

  const modelId = 'Xenova/multilingual-e5-small';

  if (!mlLoader.isModelReady(modelId)) {
    const state = mlLoader.getModelState(modelId).state;
    if (state === 'idle') {
      loadEmbeddingModel(onProgress).catch(() => {});
    }
    return null;
  }

  try {
    // 截断过长文本（模型最大 512 tokens）
    const truncated = text.length > 1000 ? text.slice(0, 1000) : text;
    const embedding = await runEmbedding(`passage: ${truncated}`);
    return embedding;
  } catch (err) {
    console.warn('[语义搜索] 生成文档嵌入失败:', err);
    return null;
  }
}

/**
 * 为搜索查询生成嵌入向量
 * e5 模型要求查询以 "query: " 为前缀
 */
export async function generateQueryEmbedding(
  query: string,
  onProgress?: (progress: number) => void
): Promise<number[] | null> {
  if (!FEATURES.SEMANTIC_SEARCH) return null;

  const modelId = 'Xenova/multilingual-e5-small';

  if (!mlLoader.isModelReady(modelId)) {
    const state = mlLoader.getModelState(modelId).state;
    if (state === 'idle') {
      loadEmbeddingModel(onProgress).catch(() => {});
    }
    return null;
  }

  try {
    const embedding = await runEmbedding(`query: ${query}`);
    return embedding;
  } catch (err) {
    console.warn('[语义搜索] 生成查询嵌入失败:', err);
    return null;
  }
}

/**
 * 计算两个向量的余弦相似度
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 语义搜索帖子
 *
 * @param query 搜索查询
 * @param posts 所有帖子列表
 * @param onProgress 模型下载进度回调
 * @returns 按相似度降序排列的帖子列表
 */
export async function semanticSearchPosts(
  query: string,
  posts: any[],
  onProgress?: (progress: number) => void
): Promise<RankedPost[]> {
  // 生成查询嵌入
  const queryEmbedding = await generateQueryEmbedding(query, onProgress);
  if (!queryEmbedding) {
    // 模型未就绪，返回原顺序
    return posts.map(post => ({ post, similarity: 0 }));
  }

  // 对每个有嵌入的帖子计算相似度
  const ranked: RankedPost[] = posts.map(post => {
    if (!post.embedding || !Array.isArray(post.embedding)) {
      return { post, similarity: 0 };
    }
    const similarity = cosineSimilarity(queryEmbedding, post.embedding);
    return { post, similarity };
  });

  // 按相似度降序排列，过滤低于阈值的
  return ranked
    .filter(r => r.similarity === 0 || r.similarity >= SEMANTIC_SEARCH_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity);
}

/**
 * 检查嵌入模型是否可用
 */
export function isEmbeddingModelReady(): boolean {
  return mlLoader.isModelReady('Xenova/multilingual-e5-small');
}

/**
 * 获取嵌入模型加载状态
 */
export function getEmbeddingModelState() {
  return mlLoader.getModelState('Xenova/multilingual-e5-small');
}
