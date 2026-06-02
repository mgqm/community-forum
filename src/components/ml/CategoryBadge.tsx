// 分类标签组件
// 用于显示帖子自动分类标签的小药丸

import { CATEGORY_STYLES, DEFAULT_CATEGORY_STYLE } from '../../services/ml/mlConfig';

interface CategoryBadgeProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

export default function CategoryBadge({ label, active, onClick, size = 'sm' }: CategoryBadgeProps) {
  const style = CATEGORY_STYLES[label] || DEFAULT_CATEGORY_STYLE;

  const sizeClasses = size === 'sm'
    ? 'text-[10px] px-2 py-0.5'
    : 'text-xs px-3 py-1';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-1 rounded-full font-medium transition-all
        ${sizeClasses}
        ${active
          ? 'bg-opacity-100 text-white shadow-sm'
          : 'bg-opacity-15 text-opacity-80 hover:bg-opacity-25'
        }
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
      `}
      style={{
        backgroundColor: active
          ? style.color
          : `${style.color}20`,
        color: active ? '#fff' : style.color,
        borderColor: style.color,
        borderWidth: active ? '0px' : '1px',
      }}
    >
      <span>{style.emoji}</span>
      <span>{label}</span>
    </button>
  );
}
