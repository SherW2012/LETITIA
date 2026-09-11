/**
 * 屎山浓度的本地规则引擎：纯函数、不联网、不依赖 DOM，浏览器与 Node 都能跑。
 * 实时变红由这里决定，模型只负责最后那句判词，避免每敲一个键就调一次接口。
 */

const CJK = /[一-鿿]/;
// 这些数字满大街都是，算成魔法数字只会误伤正常代码。
const ORDINARY = new Set([10, 12, 16, 24, 30, 32, 60, 64, 100, 128, 180, 200, 255, 256, 360, 365, 400, 401, 403, 404, 500, 512, 1000, 1024, 2048, 3600, 86400]);
const stripStrings = (line) => line.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, '""');
const isComment = (line) => /^\s*(\/\/|#(?!!)|\*|\/\*|--\s|<!--)/.test(line);
const indentOf = (line) => {
  const lead = line.match(/^[ \t]*/)[0];
  return lead.replace(/\t/g, '    ').length;
};

// 逐行规则：weight 是每次命中的火力，cap 防止一个毛病刷满整张榜。
const LINE_RULES = [
  { id: 'debug-print', label: '调试打印忘了删', weight: 2.2, cap: 10,
    test: (code) => /(^|[^\w.$])(console\.(log|debug|dir)|print|println|printf|System\.out\.print\w*|fmt\.Print\w*|var_dump|alert)\s*\(/.test(code) },
  { id: 'todo', label: '写了 TODO 就再也没回来', weight: 2.4, cap: 8,
    test: (code, line) => /\b(TODO|FIXME|XXX|HACK|WTF)\b/i.test(line) || /(先这样|临时|以后再改|回头再|不知道为什么|别动|能跑就行|坑|勿删)/.test(line) },
  { id: 'long-line', label: '一行长得要横向滚动', weight: 1.4, cap: 12,
    test: (code, line) => line.length > 120 },
  { id: 'magic-number', label: '魔法数字，天知道是啥', weight: 1.3, cap: 12,
    test: (code, line) => !isComment(line) && !/\b(const|final|static|enum|readonly)\b|#define/i.test(code)
      && (code.match(/(?<![\w.$])\d{2,}(?![\w.])/g) || []).some((value) => !ORDINARY.has(Number(value))) },
  { id: 'any-type', label: '类型全靠 any 蒙混过关', weight: 2.6, cap: 8,
    test: (code) => /:\s*any\b|\bas\s+any\b|interface\s*\{\s*\}|@ts-ignore|eslint-disable/.test(code) },
  { id: 'dead-code', label: '注释掉的代码舍不得删', weight: 1.8, cap: 10,
    test: (code, line) => /^\s*(\/\/|#)\s*[\w$[({].*[;{)=]\s*$/.test(line) && !CJK.test(line) },
  { id: 'nested-ternary', label: '三元套三元，读的人会哭', weight: 3, cap: 5,
    test: (code) => /\?[^?:\n]*\?[^:\n]*:/.test(code) },
  { id: 'god-line', label: '一行塞好几件事', weight: 1.6, cap: 8,
    test: (code, line) => !/\bfor\s*\(/.test(code) && (code.match(/;/g) || []).length >= 2 && line.trim().length > 60 },
  { id: 'long-params', label: '参数多到记不住顺序', weight: 2, cap: 6,
    test: (code) => /\b(function|def|func|void|public|private)\b[^(\n]*\([^)\n]{70,}\)/.test(code) },
  { id: 'deep-chain', label: '点点点，链子拖到天边', weight: 1.5, cap: 6,
    test: (code) => /\w(?:\.\w+){5,}/.test(code) },
];

const BAD_NAME = /\b(tmp\d*|temp\d*|foo|bar|baz|data\d|arr\d|obj\d|list\d|str\d|aaa+|xxx+|thing|stuff|doIt|myFunc|test123)\b|(?:^|[^\w.$])(?:let|var|const)\s+([a-hm-w]\d?)\s*=/gi;

// 整段扫描：吞异常这种毛病跨行才看得出来。
const BLOCK_RULES = [
  { id: 'swallow-error', label: '异常被默默吃掉了', weight: 5, cap: 5,
    match: (src) => [
      ...src.matchAll(/catch\s*(?:\([^)]*\))?\s*\{\s*(?:\/\/[^\n]*\s*|\/\*[\s\S]*?\*\/\s*)*\}/g),
      ...src.matchAll(/except[^\n:]*:\s*\n\s*pass\b/g),
      ...src.matchAll(/catch\s*(?:\([^)]*\))?\s*\{\s*(?:console\.\w+\([^)]*\);?\s*)\}/g),
    ].length },
];

export const LEVELS = [
  { min: 0, name: '干净得不像人写的', note: '要么是你状态好，要么是这段还没开始写正事。' },
  { min: 15, name: '还行，别骄傲', note: '目前没什么好喷的，保持住。' },
  { min: 35, name: '开始有味儿了', note: '现在回头改还来得及，明天就来不及了。' },
  { min: 55, name: '屎山雏形已现', note: '你已经在给三个月后的自己挖坑。' },
  { min: 75, name: '生化危机', note: '建议提交前先深呼吸，并准备好解释。' },
  { min: 90, name: '建议原地埋了', note: '这不叫重构，这叫遗体告别。' },
];

export const COMMIT_THRESHOLD = 70;
export const levelOf = (score) => LEVELS.reduce((best, item) => (score >= item.min ? item : best), LEVELS[0]);

/**
 * @param {string} source 用户粘贴的代码，不做任何上传。
 * @returns {{score:number, level:object, lines:number, signals:Array, worstLine:number|null}}
 */
export function analyzeCode(source) {
  const text = typeof source === 'string' ? source : '';
  const lines = text.split('\n');
  const codeLines = [];
  let commentLines = 0, maxIndent = 0, unit = 0, block = 0, maxBlock = 0;
  const hits = new Map();
  const badNames = new Set();
  const bump = (rule, line) => {
    const entry = hits.get(rule.id) || { id: rule.id, label: rule.label, weight: rule.weight, cap: rule.cap, count: 0, line: null };
    entry.count += 1;
    if (entry.line === null && line !== undefined) entry.line = line;
    hits.set(rule.id, entry);
  };

  lines.forEach((line, index) => {
    if (!line.trim()) { block = 0; return; }
    if (isComment(line)) { commentLines += 1; }
    else {
      codeLines.push(line);
      block += 1; maxBlock = Math.max(maxBlock, block);
      const indent = indentOf(line);
      if (indent > 0 && (unit === 0 || indent < unit)) unit = indent;
      maxIndent = Math.max(maxIndent, indent);
    }
    const code = stripStrings(line);
    for (const match of code.matchAll(BAD_NAME)) badNames.add((match[1] || match[2] || '').toLowerCase());
    for (const rule of LINE_RULES) { if (rule.test(code, line)) bump(rule, index + 1); }
  });

  for (const rule of BLOCK_RULES) {
    const count = rule.match(text);
    for (let i = 0; i < count; i += 1) bump(rule);
  }

  const depth = unit > 0 ? Math.floor(maxIndent / Math.min(Math.max(unit, 2), 8)) : 0;
  if (depth >= 4) hits.set('nesting', { id: 'nesting', label: `嵌套 ${depth} 层，右边快没地方了`, weight: 3, cap: 6, count: Math.min(depth - 3, 6), line: null });
  if (maxBlock > 40) hits.set('long-block', { id: 'long-block', label: `${maxBlock} 行不换气，这是一个函数？`, weight: 2.2, cap: 6, count: Math.min(Math.ceil((maxBlock - 40) / 15), 6), line: null });

  if (badNames.size > 0) hits.set('bad-name', { id: 'bad-name', label: '变量名起得像密码', weight: 2, cap: 8, count: badNames.size, line: null });

  const normalized = codeLines.map((line) => line.trim().replace(/\s+/g, ' ')).filter((line) => line.length >= 20);
  const seen = new Map();
  for (const line of normalized) seen.set(line, (seen.get(line) || 0) + 1);
  const repeats = [...seen.values()].filter((n) => n >= 3).reduce((sum, n) => sum + (n - 2), 0);
  if (repeats > 0) hits.set('copy-paste', { id: 'copy-paste', label: '复制粘贴的痕迹太明显', weight: 2.6, cap: 8, count: Math.min(repeats, 8), line: null });

  if (codeLines.length > 40 && commentLines / codeLines.length < 0.02) {
    hits.set('no-comment', { id: 'no-comment', label: '一行注释都没有，全靠猜', weight: 2.4, cap: 4, count: 3, line: null });
  }

  const signals = [...hits.values()]
    .map((item) => ({ ...item, counted: Math.min(item.count, item.cap), fire: Math.min(item.count, item.cap) * item.weight }))
    .sort((a, b) => b.fire - a.fire);

  const raw = signals.reduce((sum, item) => sum + item.fire, 0);
  // 按体量归一化成“浓度”：长文件不会仅仅因为行多就自动满分。
  const density = raw / Math.max(1, codeLines.length / 25);
  const score = codeLines.length === 0 ? 0 : Math.min(100, Math.round(100 * (1 - Math.exp(-density / 12))));
  const worstLine = signals.find((item) => item.line !== null)?.line ?? null;
  return { score, level: levelOf(score), lines: lines.length, codeLines: codeLines.length, signals, worstLine };
}
