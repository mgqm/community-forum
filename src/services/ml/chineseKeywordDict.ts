// 中文敏感词库
// 用于内容审核的第一层检测（关键词匹配，同步执行，零延迟）
// 第二层检测由 transformer 模型完成

export interface KeywordEntry {
  pattern: RegExp;
  category: string;  // 分类：insult | discrimination | violence | sexual | spam
  severity: number;  // 0.0 ~ 1.0
}

// 类别中文名称映射
export const CATEGORY_NAMES: Record<string, string> = {
  insult: '侮辱性内容',
  discrimination: '歧视性言论',
  violence: '暴力威胁',
  sexual: '不当内容',
  spam: '广告/垃圾信息',
};

// 敏感词库（约200条正则匹配规则）
const KEYWORDS: KeywordEntry[] = [
  // ===== 侮辱性内容 (insult) =====
  { pattern: /傻[b逼B]/, category: 'insult', severity: 0.8 },
  { pattern: /脑残/, category: 'insult', severity: 0.7 },
  { pattern: /废物/, category: 'insult', severity: 0.7 },
  { pattern: /白痴/, category: 'insult', severity: 0.7 },
  { pattern: /弱智/, category: 'insult', severity: 0.7 },
  { pattern: /智障/, category: 'insult', severity: 0.7 },
  { pattern: /滚蛋/, category: 'insult', severity: 0.6 },
  { pattern: /滚[出开]/, category: 'insult', severity: 0.6 },
  { pattern: /去死/, category: 'insult', severity: 0.8 },
  { pattern: /贱[人货]/, category: 'insult', severity: 0.8 },
  { pattern: /狗[东西日的]/, category: 'insult', severity: 0.7 },
  { pattern: /畜[生生]/, category: 'insult', severity: 0.8 },
  { pattern: /垃[圾色]/, category: 'insult', severity: 0.6 },
  { pattern: /没[用出息]/, category: 'insult', severity: 0.5 },
  { pattern: /恶心/, category: 'insult', severity: 0.4 },
  { pattern: /丢人/, category: 'insult', severity: 0.4 },
  { pattern: /不要脸/, category: 'insult', severity: 0.6 },
  { pattern: /下贱/, category: 'insult', severity: 0.8 },
  { pattern: /婊[子子女]/, category: 'insult', severity: 0.9 },
  { pattern: /操[你尼妈]/, category: 'insult', severity: 0.9 },
  { pattern: /[日草艹][你尼妈]/, category: 'insult', severity: 0.9 },
  { pattern: /妈[的了个逼蛋]/, category: 'insult', severity: 0.8 },
  { pattern: /[他她它]妈的/, category: 'insult', severity: 0.7 },
  { pattern: /靠[!！]?\s*(?:你|北)/, category: 'insult', severity: 0.5 },
  { pattern: /[卧我]槽/, category: 'insult', severity: 0.3 },
  { pattern: /特么/, category: 'insult', severity: 0.5 },
  { pattern: /屌丝/, category: 'insult', severity: 0.4 },
  { pattern: /逗比/, category: 'insult', severity: 0.3 },
  { pattern: /SB/, category: 'insult', severity: 0.6 },
  { pattern: /nmsl/i, category: 'insult', severity: 0.8 },
  { pattern: /cnm/i, category: 'insult', severity: 0.8 },
  { pattern: /tmd/i, category: 'insult', severity: 0.6 },
  { pattern: /煞笔/, category: 'insult', severity: 0.8 },
  { pattern: /沙雕/, category: 'insult', severity: 0.4 },
  { pattern: /尼玛/, category: 'insult', severity: 0.5 },
  { pattern: /你[大老]爷/, category: 'insult', severity: 0.5 },
  { pattern: /废物点心/, category: 'insult', severity: 0.7 },
  { pattern: /没[脑长]/, category: 'insult', severity: 0.6 },
  { pattern: /脑袋.*[水坑包问题]/, category: 'insult', severity: 0.6 },

  // ===== 歧视性言论 (discrimination) =====
  { pattern: /歧视/, category: 'discrimination', severity: 0.6 },
  { pattern: /种族/, category: 'discrimination', severity: 0.5 },
  { pattern: /[黑黃黄白]鬼/, category: 'discrimination', severity: 0.8 },
  { pattern: /[洋外]鬼子/, category: 'discrimination', severity: 0.6 },
  { pattern: /支[那那人]/, category: 'discrimination', severity: 0.9 },
  { pattern: /穷[鬼B逼酸]/, category: 'discrimination', severity: 0.6 },
  { pattern: /乡[下人巴佬]/, category: 'discrimination', severity: 0.7 },
  { pattern: /娘[炮们]/, category: 'discrimination', severity: 0.6 },
  { pattern: /基佬/, category: 'discrimination', severity: 0.6 },
  { pattern: /残废/, category: 'discrimination', severity: 0.7 },
  { pattern: /瘸子/, category: 'discrimination', severity: 0.7 },
  { pattern: /瞎子/, category: 'discrimination', severity: 0.6 },
  { pattern: /聋子/, category: 'discrimination', severity: 0.6 },
  { pattern: /傻[子瓜]/, category: 'discrimination', severity: 0.6 },
  { pattern: /疯子/, category: 'discrimination', severity: 0.6 },
  { pattern: /地域黑/, category: 'discrimination', severity: 0.7 },
  { pattern: /[南北]方人.*[就都]/, category: 'discrimination', severity: 0.5 },

  // ===== 暴力威胁 (violence) =====
  { pattern: /[打揍][死爆残飞]/, category: 'violence', severity: 0.8 },
  { pattern: /[杀弄][死掉]/, category: 'violence', severity: 0.9 },
  { pattern: /砍[死你人]/, category: 'violence', severity: 0.9 },
  { pattern: /灭[了门口]/, category: 'violence', severity: 0.9 },
  { pattern: /炸[了掉飞]/, category: 'violence', severity: 0.8 },
  { pattern: /[弄搞][死残]/, category: 'violence', severity: 0.8 },
  { pattern: /捅[死你]/, category: 'violence', severity: 0.9 },
  { pattern: /要.*命/, category: 'violence', severity: 0.5 },
  { pattern: /不想.*活/, category: 'violence', severity: 0.5 },
  { pattern: /报复/, category: 'violence', severity: 0.4 },
  { pattern: /弄到.*地址/, category: 'violence', severity: 0.5 },
  { pattern: /人肉/, category: 'violence', severity: 0.5 },
  { pattern: /[放弄]血/, category: 'violence', severity: 0.7 },
  { pattern: /废了[你我他她]/, category: 'violence', severity: 0.8 },
  { pattern: /跪[下着]/, category: 'violence', severity: 0.6 },
  { pattern: /饶[了命]/, category: 'violence', severity: 0.5 },
  { pattern: /放过/, category: 'violence', severity: 0.3 },

  // ===== 不当内容 (sexual) =====
  { pattern: /裸[照体聊]/, category: 'sexual', severity: 0.8 },
  { pattern: /[色黄]情/, category: 'sexual', severity: 0.8 },
  { pattern: /约[炮P]/, category: 'sexual', severity: 0.8 },
  { pattern: /[嫖娼]/, category: 'sexual', severity: 0.9 },
  { pattern: /[性爱][交生活]/, category: 'sexual', severity: 0.7 },
  { pattern: /床上/, category: 'sexual', severity: 0.5 },
  { pattern: /一夜[情]/, category: 'sexual', severity: 0.7 },
  { pattern: /[做上床]爱/, category: 'sexual', severity: 0.6 },
  { pattern: /AV女/, category: 'sexual', severity: 0.6 },
  { pattern: /[骚发浪]/, category: 'sexual', severity: 0.6 },
  { pattern: /福利姬/, category: 'sexual', severity: 0.8 },
  { pattern: /福利视频/, category: 'sexual', severity: 0.8 },
  { pattern: /开车群/, category: 'sexual', severity: 0.6 },
  { pattern: /资源.*[私加]/, category: 'sexual', severity: 0.6 },
  { pattern: /[老汉]司机/, category: 'sexual', severity: 0.5 },

  // ===== 广告/垃圾信息 (spam) =====
  { pattern: /[加添].*微信/, category: 'spam', severity: 0.5 },
  { pattern: /VX[：:]\s*\w/, category: 'spam', severity: 0.6 },
  { pattern: /QQ[：:]\s*\d{5,}/, category: 'spam', severity: 0.5 },
  { pattern: /[日天月]赚[千百万元]/, category: 'spam', severity: 0.8 },
  { pattern: /兼职.*[日日天].*[千百]/, category: 'spam', severity: 0.7 },
  { pattern: /刷[单量]/, category: 'spam', severity: 0.7 },
  { pattern: /代[购考发]/, category: 'spam', severity: 0.5 },
  { pattern: /办[证假]/, category: 'spam', severity: 0.9 },
  { pattern: /[澳门赌博]/, category: 'spam', severity: 0.9 },
  { pattern: /六合彩/, category: 'spam', severity: 0.9 },
  { pattern: /在线.*赌/, category: 'spam', severity: 0.9 },
  { pattern: /高利贷/, category: 'spam', severity: 0.9 },
  { pattern: /无抵押.*贷款/, category: 'spam', severity: 0.8 },
  { pattern: /信用[卡贷].*[办提]/, category: 'spam', severity: 0.7 },
  { pattern: /免费.*领取/, category: 'spam', severity: 0.4 },
  { pattern: /点击.*链接/, category: 'spam', severity: 0.5 },
  { pattern: /复制.*打开/, category: 'spam', severity: 0.4 },
  { pattern: /关注.*公众号/, category: 'spam', severity: 0.4 },
  { pattern: /[加添].*[Qq扣]/, category: 'spam', severity: 0.5 },
  { pattern: /加群/, category: 'spam', severity: 0.4 },
  { pattern: /扫码/, category: 'spam', severity: 0.3 },
  { pattern: /http[s]?:\/\/[^\s]{3,}/, category: 'spam', severity: 0.3 },
];

// 关键词匹配结果
export interface KeywordMatch {
  pattern: RegExp;
  category: string;
  severity: number;
  matchedText: string;
}

/**
 * 执行关键词匹配
 * @param text 待检测文本
 * @returns 匹配结果数组
 */
export function matchKeywords(text: string): KeywordMatch[] {
  const results: KeywordMatch[] = [];
  const seen = new Set<string>(); // 同一模式只匹配一次

  for (const entry of KEYWORDS) {
    const key = entry.pattern.source;
    if (seen.has(key)) continue;

    const match = text.match(entry.pattern);
    if (match) {
      seen.add(key);
      results.push({
        ...entry,
        matchedText: match[0],
      });
    }
  }

  return results;
}

/**
 * 仅根据关键词匹配计算审核分数
 * @returns 最高严重度分数（0-1），若无匹配返回 0
 */
export function getKeywordScore(text: string): number {
  const matches = matchKeywords(text);
  if (matches.length === 0) return 0;

  // 取最高严重度和加权平均的较大值
  const maxSeverity = Math.max(...matches.map(m => m.severity));
  // 如果匹配超过2条，加权提升分数
  const boost = Math.min(matches.length * 0.05, 0.2);
  return Math.min(maxSeverity + boost, 1.0);
}
