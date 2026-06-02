// 内容审核警告弹窗
// 当用户发布的内容被检测到可能不当时显示

import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle } from 'lucide-react';
import type { ModerationResult } from '../../services/ml/contentModeration';
import { getModerationSummary } from '../../services/ml/contentModeration';

interface ModerationWarningProps {
  isOpen: boolean;
  result: ModerationResult | null;
  onGoBack: () => void;
  onProceedAnyway: () => void;
}

export default function ModerationWarning({
  isOpen,
  result,
  onGoBack,
  onProceedAnyway,
}: ModerationWarningProps) {
  if (!result) return null;

  const flags = getModerationSummary(result);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onGoBack}
        >
          <motion.div
            className="bg-white rounded-2xl shadow-xl p-6 mx-4 max-w-md w-full"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 图标与标题 */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-natural-text">
                内容可能需要修改
              </h3>
            </div>

            {/* 检测结果 */}
            <div className="mb-5 bg-amber-50 rounded-xl p-4 border border-amber-200">
              <p className="text-sm text-amber-800 mb-2 font-medium">
                检测到以下问题：
              </p>
              <ul className="space-y-1.5">
                {flags.map((flag, i) => (
                  <li key={i} className="text-sm text-amber-700 flex items-start gap-1.5">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>{flag}</span>
                  </li>
                ))}
                {flags.length === 0 && (
                  <li className="text-sm text-amber-700">
                    内容可能包含不当表达
                  </li>
                )}
              </ul>

              {/* 匹配关键词 */}
              {result.details.keywordMatches.length > 0 && (
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <p className="text-xs text-amber-600">
                    敏感度评分：{Math.round(result.score * 100)}%
                  </p>
                </div>
              )}
            </div>

            {/* 提示文字 */}
            <p className="text-sm text-muted-text mb-5">
              你的内容不会被删除，但我们建议你修改后再发布，以维护社区友好氛围。
            </p>

            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                onClick={onGoBack}
                className="flex-1 py-2.5 px-4 rounded-xl bg-natural-primary text-white font-medium hover:bg-natural-primary/90 transition-colors text-sm"
              >
                返回修改
              </button>
              <button
                onClick={onProceedAnyway}
                className="flex-1 py-2.5 px-4 rounded-xl border border-natural-border text-muted-text font-medium hover:bg-natural-bg transition-colors text-sm"
              >
                仍然发布
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
