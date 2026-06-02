// ML 功能配置文件
// 定义模型ID、分类标签、阈值等

export const MODELS = {
  // 零样本分类模型（支持中文的多语言模型）
  ZERO_SHOT: 'Xenova/distilbert-base-multilingual-cased-mnli',
  // 嵌入向量模型（多语言，支持中文）
  EMBEDDING: 'Xenova/multilingual-e5-small',
} as const;

// 帖子分类标签（中文）
export const CATEGORY_LABELS = [
  '技术', '生活', '美食', '旅行', '艺术', '运动', '音乐',
  '教育', '健康', '时尚', '游戏', '宠物', '摄影', '阅读',
  '电影', '设计', '自然', '科技', '历史', '哲学',
];

// 内容审核假设模板（中文）
export const MODERATION_HYPOTHESES = [
  '这段文本包含侮辱性内容',
  '这段文本包含人身攻击',
  '这段文本包含歧视性言论',
  '这段文本包含不当内容',
  '这段文本包含暴力内容',
  '这段文本是正常友好的交流',
];

// 审核阈值：任一不良假设得分超过此值即标记
export const MODERATION_THRESHOLD = 0.65;

// 分类置信度阈值：超过此值才分配标签
export const CATEGORY_CONFIDENCE_THRESHOLD = 0.3;

// 每篇帖子最多标签数
export const MAX_CATEGORIES_PER_POST = 3;

// 语义搜索相似度阈值
export const SEMANTIC_SEARCH_THRESHOLD = 0.3;

// 功能开关
export const FEATURES = {
  CONTENT_MODERATION: true,
  SMART_CATEGORIZATION: true,
  SEMANTIC_SEARCH: true,
} as const;

// 每个分类对应的 emoji 和颜色
export const CATEGORY_STYLES: Record<string, { emoji: string; color: string }> = {
  '技术': { emoji: '💻', color: '#3B82F6' },
  '生活': { emoji: '🌿', color: '#22C55E' },
  '美食': { emoji: '🍜', color: '#F97316' },
  '旅行': { emoji: '✈️', color: '#8B5CF6' },
  '艺术': { emoji: '🎨', color: '#EC4899' },
  '运动': { emoji: '⚽', color: '#EF4444' },
  '音乐': { emoji: '🎵', color: '#A855F7' },
  '教育': { emoji: '📚', color: '#6366F1' },
  '健康': { emoji: '💚', color: '#10B981' },
  '时尚': { emoji: '👗', color: '#F43F5E' },
  '游戏': { emoji: '🎮', color: '#7C3AED' },
  '宠物': { emoji: '🐾', color: '#F59E0B' },
  '摄影': { emoji: '📷', color: '#06B6D4' },
  '阅读': { emoji: '📖', color: '#78716C' },
  '电影': { emoji: '🎬', color: '#DC2626' },
  '设计': { emoji: '✨', color: '#D946EF' },
  '自然': { emoji: '🏔️', color: '#65A30D' },
  '科技': { emoji: '🚀', color: '#0284C7' },
  '历史': { emoji: '🏛️', color: '#92400E' },
  '哲学': { emoji: '💭', color: '#475569' },
};

// 默认分类样式（未在 CATEGORY_STYLES 中的标签使用）
export const DEFAULT_CATEGORY_STYLE = { emoji: '📌', color: '#6B7280' };
