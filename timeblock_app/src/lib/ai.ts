import type { Granularity } from '../types';
import { parseQuickText } from './parser';
import type {
  BaseMode,
  BorderLevel,
  CardStyle,
  DensityLevel,
  FontFamilyId,
  PatternType,
  RadiusLevel,
  SizeLevel,
} from './themes';
import {
  isBorderLevel,
  isBuiltinThemeId,
  isDensityLevel,
  isFontFamilyId,
  isPatternType,
  isRadiusLevel,
  isSizeLevel,
  normalizeHex,
} from './themes';
import { addDays, DAY_MINUTES, fmtDate, fmtMinute } from './timeUtils';

/**
 * AI 理解层：把一句话日程指令解析成结构化安排（时间块 / 任务 / 心情 / 重要事项 / 小结 / 计划）。
 * 优先走在线 AI 结构化解析（调用前先检测环境能力）；环境未提供、网络异常或返回格式异常时回退到本地规则解析，保证功能可用。
 */

export interface AiBlockIntent {
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** 当天 0..1440 */
  startMinute: number;
  endMinute: number;
  /** 已有标签名（可能为空） */
  tagName: string;
}

/** 单日面板内容（批量多日计划里按天拆分） */
export interface AiDayIntent {
  /** YYYY-MM-DD */
  date: string;
  tasks: string[];
  mood: string;
  important: string[];
  summary: string;
  plan: string;
}

export interface AiDailyIntent {
  /** 面板目标日期（时间块可各自带日期） */
  date: string;
  blocks: AiBlockIntent[];
  tasks: string[];
  mood: string;
  important: string[];
  summary: string;
  plan: string;
  /** 多日计划：按天拆分的面板内容；为空时由顶层字段构造单日 */
  days: AiDayIntent[];
  raw: string;
  /** AI 复述理解：用自然语言说明「我理解你是想……，我打算这样安排」 */
  understanding: string;
  /** 助理式评估：时间冲突 / 任务量 / 优先级 / 拆分调整建议 */
  assessment: string;
}

export function emptyAiDailyIntent(date: string): AiDailyIntent {
  return {
    date,
    blocks: [],
    tasks: [],
    mood: '',
    important: [],
    summary: '',
    plan: '',
    days: [],
    raw: '',
    understanding: '',
    assessment: '',
  };
}

function clampMinute(v: unknown, fb: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(DAY_MINUTES, Math.max(0, Math.round(v))) : fb;
}

/** 兜底归一化：AI 返回字段缺失 / 类型不符时补默认值，脏数据不导致崩溃 */
export function normalizeAiDailyIntent(value: unknown, fallbackDate: string): AiDailyIntent {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const asStr = (x: unknown, fb = ''): string => (typeof x === 'string' ? x : fb);
  const asStrArr = (x: unknown): string[] =>
    Array.isArray(x) ? x.filter((i): i is string => typeof i === 'string').map((s) => s.trim()).filter(Boolean) : [];
  const blocks = (Array.isArray(v.blocks) ? v.blocks : [])
    .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
    .map((b) => ({
      title: asStr(b.title, '').trim(),
      date: asStr(b.date, '').trim() || fallbackDate,
      startMinute: clampMinute(b.startMinute, 0),
      endMinute: clampMinute(b.endMinute, 30),
      tagName: asStr(b.tagName, '').trim(),
    }))
    .filter((b) => b.title.length > 0);
  // 多日：优先使用 days 数组；缺失时用顶层字段构造单日，保证 days 永远非空
  const days = (Array.isArray(v.days) ? v.days : [])
    .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
    .map((d) => ({
      date: asStr(d.date, '').trim() || fallbackDate,
      tasks: asStrArr(d.tasks),
      mood: asStr(d.mood, '').trim(),
      important: asStrArr(d.important),
      summary: asStr(d.summary, '').trim(),
      plan: asStr(d.plan, '').trim(),
    }))
    .filter((d) => d.date.length > 0);
  if (days.length === 0) {
    days.push({
      date: asStr(v.date, '').trim() || fallbackDate,
      tasks: asStrArr(v.tasks),
      mood: asStr(v.mood, '').trim(),
      important: asStrArr(v.important),
      summary: asStr(v.summary, '').trim(),
      plan: asStr(v.plan, '').trim(),
    });
  }
  return {
    date: days[0].date,
    blocks,
    tasks: days[0].tasks,
    mood: days[0].mood,
    important: days[0].important,
    summary: days[0].summary,
    plan: days[0].plan,
    days,
    raw: asStr(v.raw, ''),
    understanding: asStr(v.understanding, ''),
    assessment: asStr(v.assessment, ''),
  };
}

/** 近几天已有安排摘要（评估上下文）：时间块 + 每日面板的任务完成情况 */
export interface AiScheduleContext {
  /** YYYY-MM-DD 起 */
  startDate: string;
  /** YYYY-MM-DD 止 */
  endDate: string;
  blocks: { date: string; startMinute: number; endMinute: number; title: string; tagName: string }[];
  panels: { date: string; mood: string; tasks: { text: string; done: boolean }[]; important: string[]; summary: string }[];
}

/** 把已有安排整理成给 AI 的评估上下文文本 */
export function buildScheduleContextText(ctx: AiScheduleContext): string {
  const lines: string[] = [`（评估范围：${ctx.startDate} 至 ${ctx.endDate}）`];
  const byDate = new Map<string, string[]>();
  ctx.blocks.forEach((b) => {
    const t = `${fmtMinute(b.startMinute)}-${fmtMinute(b.endMinute)} ${b.title}${b.tagName ? ` [${b.tagName}]` : ''}`;
    const arr = byDate.get(b.date) ?? [];
    arr.push(`时间块 ${t}`);
    byDate.set(b.date, arr);
  });
  ctx.panels.forEach((p) => {
    const arr = byDate.get(p.date) ?? [];
    if (p.mood) arr.push(`心情 ${p.mood}`);
    p.tasks.forEach((t) => arr.push(`任务${t.done ? '（已完成）' : '（未完成）'}：${t.text}`));
    p.important.forEach((it) => arr.push(`重要事项：${it}`));
    if (p.summary) arr.push(`小结：${p.summary}`);
    if (arr.length) byDate.set(p.date, arr);
  });
  if (byDate.size === 0) return '（暂无已有安排记录）';
  const sorted = [...byDate.keys()].sort();
  sorted.forEach((d) => {
    lines.push(`[${d}]`);
    (byDate.get(d) ?? []).forEach((l) => lines.push(`  ${l}`));
  });
  return lines.join('\n');
}

/** 一句话纠正：把原文本与纠正说明合并，供重新解析 */
export function buildCorrectedText(original: string, correction: string): string {
  const c = correction.trim();
  if (!c) return original.trim();
  return `${original.trim()}\n（用户纠正：${c}）`;
}

/** AI 调用失败原因：环境未提供能力 / 网络或服务异常 / 返回格式异常 */
export class AiChatError extends Error {
  reason: 'not-supported' | 'network' | 'format';
  constructor(reason: 'not-supported' | 'network' | 'format', message: string) {
    super(message);
    this.name = 'AiChatError';
    this.reason = reason;
  }
}

/** 当前运行环境是否提供在线 AI 聊天能力 */
export function isAiChatAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.lingguang && typeof window.lingguang.ai?.chat === 'function';
}

/** 带可用性检查与一次串行重试的 AI 调用：瞬时网络 / 服务抖动自动重试一次，仍失败才抛出，避免误判为不可用 */
async function chatWithRetry(options: LingguangAiChatOptions, retries = 1): Promise<LingguangAiChatResult> {
  if (!isAiChatAvailable()) {
    throw new AiChatError('not-supported', '当前环境未提供在线 AI 能力');
  }
  try {
    return await window.lingguang.ai.chat(options);
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    return chatWithRetry(options, retries - 1);
  }
}

/** 兼容平台差异：结构化输出优先读 data，缺失时尝试从 content 解析 JSON；解析失败抛格式异常 */
function readAiJsonData(result: LingguangAiChatResult): Record<string, unknown> {
  let data = result?.data;
  if (data == null && typeof result?.content === 'string' && result.content.trim()) {
    try {
      data = JSON.parse(result.content);
    } catch {
      data = null;
    }
  }
  if (!data || typeof data !== 'object') {
    throw new AiChatError('format', 'AI 返回格式异常，请重试');
  }
  return data as Record<string, unknown>;
}

/** 在线 AI 结构化解析：一句话 → 理解复述 + 助理评估 + 结构化日程指令 */
export async function parseDailyIntentWithAI(
  text: string,
  today: string,
  granularity: Granularity,
  tagNames: string[],
  scheduleContext?: string,
): Promise<AiDailyIntent> {
  const contextBlock = scheduleContext && scheduleContext.trim() ? `\n以下是当天及近几天已有的安排记录（时间块、任务完成情况、心情、小结），请基于它们做助理式评估：\n${scheduleContext.trim()}` : '';
  const result = await chatWithRetry({
    messages: [
      {
        role: 'system',
        content: [
          '你是时间管理管家，接收用户的一句话日程指令，按三步给出结果：',
          '第一步：先用自然语言复述你理解到的意图和打算怎么安排，语气像助理复述确认，例如「我理解你是想……，我打算这样安排……」，不要罗列数据格式，用一两句话讲清楚。',
          '第二步：基于已有安排记录做助理式评估，检查本次安排是否与已有时间块冲突、任务量是否过重、优先级怎么排、哪些需要拆分或调整。有冲突或过载时明确指出来，并给出可执行建议（如「明天已有 4 个时间块，建议把这项挪到后天上午」）；没有明显问题时简要说明即可。',
          '第三步：整理安排内容。明确时间段的事件列为时间块（含开始/结束时间）；没有具体时间的待办列为任务；心情描述解析为心情；重要事项单独列出；总结性内容放进小结；整日计划安排放进计划。',
          '支持批量多日计划：用户说「接下来 N 天」「这周每天」「周一到周五」等时，按天拆分生成，最多 14 天。时间块各自带明确日期；每天的待办、心情、重要事项、小结、计划按日期归类并按日期升序输出；没有明确日期归属的内容放在今天。',
          `今天日期是 ${today}。日期默认今天，可用自然语言（如"明天""下周一"）推算并输出 YYYY-MM-DD。`,
          '时间统一换算为当天 0 点起的分钟数（0-1440），例如 14:30 = 870、上午9点 = 540、下午3点 = 900。',
          `已有标签：${tagNames.length > 0 ? tagNames.join('、') : '（无）'}。时间块尽量匹配已有标签，没有匹配就留空。`,
          '没有相关内容时输出空字符串或空数组。评估与复述要自然、克制，避免编造已有记录里不存在的信息。',
        ].join('\n') + contextBlock,
      },
      { role: 'user', content: text },
    ],
    responseFormat: {
      type: 'json_schema',
      jsonSchema: {
        name: 'daily_plan_intent',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            understanding: { type: 'string' },
            assessment: { type: 'string' },
            date: { type: 'string' },
            blocks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  date: { type: 'string' },
                  startMinute: { type: 'integer' },
                  endMinute: { type: 'integer' },
                  tagName: { type: 'string' },
                },
                required: ['title', 'date', 'startMinute', 'endMinute', 'tagName'],
                additionalProperties: false,
              },
            },
            tasks: { type: 'array', items: { type: 'string' } },
            mood: { type: 'string' },
            important: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' },
            plan: { type: 'string' },
            days: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  tasks: { type: 'array', items: { type: 'string' } },
                  mood: { type: 'string' },
                  important: { type: 'array', items: { type: 'string' } },
                  summary: { type: 'string' },
                  plan: { type: 'string' },
                },
                required: ['date', 'tasks', 'mood', 'important', 'summary', 'plan'],
                additionalProperties: false,
              },
            },
          },
          required: ['understanding', 'assessment', 'date', 'blocks', 'tasks', 'mood', 'important', 'summary', 'plan', 'days'],
          additionalProperties: false,
        },
      },
    },
    timeout: 30000,
  });
  return normalizeAiDailyIntent(readAiJsonData(result), today);
}

/** 日期标记：今天/明天/周X/星期X/月日/ISO 等，行首命中后进入对应日期的分组 */
const DAY_MARK_RE = /^(今天|今日|明天|明日|后天|大后天|昨天|昨日|下?周[一二三四五六日天]|星期[一二三四五六日天]|\d{1,2}月\d{1,2}日|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2})([:：]|\s|$)/;

/** 把口语日期标记解析成 YYYY-MM-DD（解析失败回退今天） */
function resolveDayDate(marker: string, today: string): string {
  const m = marker.trim();
  const base = new Date(`${today}T00:00:00`);
  if (/^(今天|今日)$/.test(m)) return today;
  if (/^(明天|明日)$/.test(m)) return fmtDate(addDays(base, 1));
  if (/^后天$/.test(m)) return fmtDate(addDays(base, 2));
  if (/^大后天$/.test(m)) return fmtDate(addDays(base, 3));
  if (/^(昨天|昨日)$/.test(m)) return fmtDate(addDays(base, -1));
  const wk = /^(?:下?周|星期)([一二三四五六日天])$/.exec(m);
  if (wk) {
    const map: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 };
    const target = map[wk[1]] ?? 7;
    const cur = base.getDay() || 7;
    let delta = target - cur;
    if (delta < 0) delta += 7;
    return fmtDate(addDays(base, delta));
  }
  const y = Number(today.slice(0, 4));
  const md = /^(\d{1,2})月(\d{1,2})日$/.exec(m);
  if (md) return `${y}-${String(Number(md[1])).padStart(2, '0')}-${String(Number(md[2])).padStart(2, '0')}`;
  const iso = /^(\d{4}-\d{2}-\d{2})$/.exec(m);
  if (iso) return iso[1];
  const slash = /^(\d{1,2})\/(\d{1,2})$/.exec(m);
  if (slash) return `${y}-${String(Number(slash[1])).padStart(2, '0')}-${String(Number(slash[2])).padStart(2, '0')}`;
  return today;
}

/** 本地规则兜底：AI 不可用时仍能解析常见句式与关键词，结果可在预览卡里手动修改；支持按天标记拆分多日 */
export function parseDailyIntentFallback(text: string, today: string, granularity: Granularity): AiDailyIntent {
  const intent = emptyAiDailyIntent(today);
  const raw = text.trim();
  intent.raw = raw;
  if (!raw) return intent;

  // 1) 按日期标记把文本拆成多天分组
  const groups = new Map<string, string[]>();
  let current: string[] = [];
  raw.split(/[\n;；]/).forEach((line) => {
    const s = line.trim();
    if (!s) return;
    const mm = DAY_MARK_RE.exec(s);
    if (mm) {
      const d = resolveDayDate(mm[1], today);
      if (!groups.has(d)) groups.set(d, []);
      current = groups.get(d) as string[];
      const rest = s.slice(mm[0].length).trim();
      if (rest) current.push(rest);
    } else {
      current.push(s);
    }
  });
  if (groups.size === 0) groups.set(today, current);

  // 2) 按天解析：小结/计划标记行 + 剩余文本作为任务；第一个分组尝试整句里的时间块
  const sortedDates = [...groups.keys()].sort();
  const days: AiDayIntent[] = sortedDates.map((d, i) => {
    const lines = groups.get(d) ?? [];
    const summaryParts: string[] = [];
    const planParts: string[] = [];
    const taskParts: string[] = [];
    lines.forEach((line) => {
      const sm = line.replace(/^(小结|总结)[:：]/, '').trim();
      if (sm !== line) {
        if (sm) summaryParts.push(sm);
        return;
      }
      const pm = line.replace(/^计划[:：]/, '').trim();
      if (pm !== line) {
        if (pm) planParts.push(pm);
        return;
      }
      taskParts.push(line.replace(/^\d{1,2}[:：]\d{2}\s*/, '').trim());
    });
    if (i === 0) {
      const outcome = parseQuickText(raw, today, granularity);
      if (outcome.ok && outcome.form) {
        intent.blocks.push({
          title: outcome.form.title,
          date: d,
          startMinute: outcome.form.startMinute,
          endMinute: outcome.form.endMinute,
          tagName: '',
        });
      }
    }
    return {
      date: d,
      tasks: taskParts.filter(Boolean),
      mood: '',
      important: [],
      summary: summaryParts.join('；'),
      plan: planParts.join('；'),
    };
  });

  // 3) 心情：识别常见情绪词与心情 emoji，归到第一天
  const moodRules: Array<[RegExp, string]> = [
    [/开心|高兴|快乐|兴奋|愉快|棒/, '😊'],
    [/难过|伤心|低落|沮丧|emo/, '😔'],
    [/累|疲惫|困/, '😩'],
    [/焦虑|紧张|压力/, '😰'],
    [/平静|放松|舒服|惬意/, '😌'],
    [/生气|愤怒|烦躁|烦/, '😠'],
    [/一般|平淡|还行/, '😐'],
  ];
  const moodEmojis = ['😊', '😔', '😩', '😰', '😌', '😠', '😐', '🤩', '🥳', '😴', '🤗', '😣'];
  const foundEmoji = moodEmojis.find((em) => raw.includes(em)) ?? '';
  const foundWord = moodRules.find(([re]) => re.test(raw))?.[1] ?? '';
  days[0].mood = foundEmoji || foundWord || '';

  intent.days = days;
  intent.tasks = days[0]?.tasks ?? [];
  intent.mood = days[0]?.mood ?? '';
  intent.important = days[0]?.important ?? [];
  intent.summary = days[0]?.summary ?? '';
  intent.plan = days[0]?.plan ?? '';

  // 本地兜底的理解复述与评估：AI 不可用时仍能给出一句复述和简单冲突检查
  const names = intent.blocks.map((b) => b.title).filter(Boolean);
  days.forEach((d) => d.tasks.forEach((t) => names.push(t)));
  days.forEach((d) => d.important.forEach((t) => names.push(t)));
  const uniq = [...new Set(names)].slice(0, 6);
  intent.understanding = uniq.length > 0 ? `我理解你是想安排${uniq.join('、')}${uniq.length > 3 ? '等' : ''}，先按上面整理的内容确认一下。` : '我理解你想安排一些内容，但暂时没识别出具体事项，请用更明确的说法再说一次。';
  // 简单冲突：同一天内时间块是否重叠
  const conflictParts: string[] = [];
  for (let i = 0; i < intent.blocks.length; i += 1) {
    for (let j = i + 1; j < intent.blocks.length; j += 1) {
      const a = intent.blocks[i];
      const b = intent.blocks[j];
      if (a.date !== b.date) continue;
      if (a.startMinute < b.endMinute && b.startMinute < a.endMinute) {
        conflictParts.push(`「${a.title}」与「${b.title}」时间重叠`);
      }
    }
  }
  if (conflictParts.length > 0) {
    intent.assessment = `本地检查发现 ${conflictParts.join('、')}，建议在下方调整时间后再保存。`;
  } else if (intent.blocks.length > 0) {
    intent.assessment = `本地检查未发现本次安排内部时间冲突；如需结合已有记录做完整评估，请联网后重新解析。`;
  } else {
    intent.assessment = '';
  }
  return intent;
}

/* ============ 一句话主题配置 ============ */

export interface AiThemeIntent {
  /** 内置主题 id（canvas/dark/cartoon/galgame/business/minimal），无则空串 */
  builtinId: string;
  base: BaseMode | '';
  /** #RRGGBB */
  primary: string;
  radiusLevel: RadiusLevel | '';
  density: DensityLevel | '';
  borderLevel: BorderLevel | '';
  cardStyle: CardStyle | '';
  pattern: PatternType | '';
  fontFamily: FontFamilyId | '';
  fontSizeLevel: SizeLevel | '';
  /** 一句话配置结果描述 */
  description: string;
}

const BUILTIN_IDS = ['canvas', 'dark', 'cartoon', 'galgame', 'business', 'minimal'] as const;

export function normalizeAiThemeIntent(value: unknown): AiThemeIntent {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const asStr = (x: unknown, fb = ''): string => (typeof x === 'string' ? x.trim() : fb);
  const builtinId = asStr(v.builtinId, '');
  const primary = asStr(v.primary, '');
  const base = asStr(v.base, '');
  const radiusLevel = asStr(v.radiusLevel, '');
  const density = asStr(v.density, '');
  const borderLevel = asStr(v.borderLevel, '');
  const cardStyle = asStr(v.cardStyle, '');
  const pattern = asStr(v.pattern, '');
  const fontFamily = asStr(v.fontFamily, '');
  const fontSizeLevel = asStr(v.fontSizeLevel, '');
  return {
    builtinId: isBuiltinThemeId(builtinId) && (BUILTIN_IDS as readonly string[]).includes(builtinId) ? builtinId : '',
    base: base === 'dark' ? 'dark' : base === 'light' ? 'light' : '',
    primary: normalizeHex(primary) ?? '',
    radiusLevel: isRadiusLevel(radiusLevel) ? radiusLevel : '',
    density: isDensityLevel(density) ? density : '',
    borderLevel: isBorderLevel(borderLevel) ? borderLevel : '',
    cardStyle: cardStyle === 'glass' ? 'glass' : cardStyle === 'solid' ? 'solid' : '',
    pattern: isPatternType(pattern) ? pattern : '',
    fontFamily: isFontFamilyId(fontFamily) ? fontFamily : '',
    fontSizeLevel: isSizeLevel(fontSizeLevel) ? fontSizeLevel : '',
    description: asStr(v.description, ''),
  };
}

/** 在线 AI：一句话 → 主题配置参数（只落在现有主题方案与可调参数范围内） */
export async function parseThemeIntentWithAI(text: string): Promise<AiThemeIntent> {
  const result = await chatWithRetry({
    messages: [
      {
        role: 'system',
        content: [
          '你是界面主题配置助手，把用户的一句话主题需求解析成可应用的主题参数。',
          '内置主题：canvas 彩色画布、dark 深色沉浸、cartoon 活泼卡通、galgame 二次元心动、business 商务质感、minimal 极简留白。用户明确要求换成某个主题风格时返回对应内置 id，否则 builtinId 为空字符串。',
          '颜色统一返回 #RRGGBB 格式；圆角：compact 紧凑 / standard 标准 / rounded 圆润；密度：compact 紧凑 / comfort 舒适 / spacious 留白；边框：none 无线框 / thin 细描边 / bold 加粗；卡片：solid 实心 / glass 玻璃；背景图案：none 无 / dots 点阵 / paper 纸张 / glow 光斑 / stripes 斜纹 / grid 网格 / checker 棋盘 / crosshatch 布纹 / waves 波浪 / rings 圆环 / halftone 半调；字体：system 系统 / rounded 圆体 / serif 宋体 / heiti 黑体 / kai 楷体 / mono 等宽；字号：standard 标准 / large 放大。',
          '只解析用户提到的参数，没有提到的全部返回空字符串。最后用一句话中文描述本次配置结果放到 description。',
        ].join('\n'),
      },
      { role: 'user', content: text },
    ],
    responseFormat: {
      type: 'json_schema',
      jsonSchema: {
        name: 'theme_config_intent',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            builtinId: { type: 'string' },
            base: { type: 'string' },
            primary: { type: 'string' },
            radiusLevel: { type: 'string' },
            density: { type: 'string' },
            borderLevel: { type: 'string' },
            cardStyle: { type: 'string' },
            pattern: { type: 'string' },
            fontFamily: { type: 'string' },
            fontSizeLevel: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['builtinId', 'base', 'primary', 'radiusLevel', 'density', 'borderLevel', 'cardStyle', 'pattern', 'fontFamily', 'fontSizeLevel', 'description'],
          additionalProperties: false,
        },
      },
    },
    timeout: 30000,
  });
  return normalizeAiThemeIntent(readAiJsonData(result));
}

/** 校验日期字符串，非法时回退到指定日期 */
export function safePanelDate(value: string, fallback: string): string {
  const d = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return fallback || fmtDate(new Date());
}