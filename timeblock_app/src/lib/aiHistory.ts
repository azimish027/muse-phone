/**
 * AI 输入历史：记录每次 AI 解析成功的原文与结构化快照，支持回看、再次编辑与保存状态追踪。
 * 属于单人单设备的轻量记录，使用 localStorage 键值存储。
 */

export interface AiHistoryBlock {
  key: string;
  keep: boolean;
  title: string;
  date: string;
  start: string;
  end: string;
  tagName: string;
  /** 保存时是否同步生成一条对应日期的今日任务 */
  toTask?: boolean;
}

export interface AiHistoryItem {
  key: string;
  keep: boolean;
  text: string;
}

export interface AiHistoryDay {
  key: string;
  date: string;
  tasks: AiHistoryItem[];
  mood: string;
  important: AiHistoryItem[];
  summary: string;
  plan: string;
}

export interface AiHistoryEntry {
  id: string;
  /** 用户输入的原文 */
  text: string;
  createdAt: number;
  /** 保存成功时间戳；null 表示解析后未保存 */
  savedAt: number | null;
  /** 解析出的条目数（时间块 + 任务 + 重要事项） */
  count: number;
  /** 涉及天数 */
  dayCount: number;
  /** 结构化快照：可回看并重新载入编辑 */
  blocks: AiHistoryBlock[];
  days: AiHistoryDay[];
  /** AI 理解复述（可空） */
  understanding?: string;
  /** 助理评估（可空） */
  assessment?: string;
}

const KEY = 'tb.aiHistory';
const MAX_ENTRIES = 60;

function asStr(x: unknown, fb = ''): string {
  return typeof x === 'string' ? x : fb;
}

function newKey(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 归一化旧数据：字段缺失、类型不符时补默认值，脏数据不导致崩溃 */
function normItem(x: unknown): AiHistoryItem | null {
  if (!x || typeof x !== 'object') return null;
  const v = x as Record<string, unknown>;
  return {
    key: asStr(v.key) || newKey(),
    keep: v.keep !== false,
    text: asStr(v.text, '').trim(),
  };
}

function normBlock(x: unknown): AiHistoryBlock | null {
  if (!x || typeof x !== 'object') return null;
  const v = x as Record<string, unknown>;
  return {
    key: asStr(v.key) || newKey(),
    keep: v.keep !== false,
    title: asStr(v.title, '').trim(),
    date: asStr(v.date, '').trim(),
    start: asStr(v.start, '00:00').trim(),
    end: asStr(v.end, '00:30').trim(),
    tagName: asStr(v.tagName, '').trim(),
    toTask: v.toTask !== false,
  };
}

function normDay(x: unknown): AiHistoryDay | null {
  if (!x || typeof x !== 'object') return null;
  const v = x as Record<string, unknown>;
  const tasks = (Array.isArray(v.tasks) ? v.tasks : []).map(normItem).filter((t): t is AiHistoryItem => !!t);
  const important = (Array.isArray(v.important) ? v.important : []).map(normItem).filter((t): t is AiHistoryItem => !!t);
  return {
    key: asStr(v.key) || newKey(),
    date: asStr(v.date, '').trim(),
    tasks,
    mood: asStr(v.mood, '').trim(),
    important,
    summary: asStr(v.summary, '').trim(),
    plan: asStr(v.plan, '').trim(),
  };
}

function normEntry(x: unknown): AiHistoryEntry | null {
  if (!x || typeof x !== 'object') return null;
  const v = x as Record<string, unknown>;
  const blocks = (Array.isArray(v.blocks) ? v.blocks : []).map(normBlock).filter((b): b is AiHistoryBlock => !!b);
  const days = (Array.isArray(v.days) ? v.days : []).map(normDay).filter((d): d is AiHistoryDay => !!d);
  const text = asStr(v.text, '').trim();
  if (!text && blocks.length === 0 && days.length === 0) return null;
  return {
    id: asStr(v.id) || newKey(),
    text,
    createdAt: typeof v.createdAt === 'number' && Number.isFinite(v.createdAt) ? v.createdAt : Date.now(),
    savedAt: typeof v.savedAt === 'number' && Number.isFinite(v.savedAt) ? v.savedAt : null,
    count: typeof v.count === 'number' && Number.isFinite(v.count) ? v.count : 0,
    dayCount: typeof v.dayCount === 'number' && Number.isFinite(v.dayCount) ? v.dayCount : 1,
    blocks,
    days,
    understanding: asStr(v.understanding, ''),
    assessment: asStr(v.assessment, ''),
  };
}

function persist(list: AiHistoryEntry[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 忽略存储失败
  }
}

export function loadAiHistory(): AiHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normEntry).filter((e): e is AiHistoryEntry => !!e).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

/** 新增一条记录（最新在前），返回更新后的列表 */
export function pushAiHistory(entry: AiHistoryEntry): AiHistoryEntry[] {
  const next = [entry, ...loadAiHistory()].slice(0, MAX_ENTRIES);
  persist(next);
  return next;
}

/** 保存成功后标记该条记录已保存，返回更新后的列表 */
export function updateAiHistorySaved(id: string, savedAt: number): AiHistoryEntry[] {
  const next = loadAiHistory().map((e) => (e.id === id ? { ...e, savedAt } : e));
  persist(next);
  return next;
}

export function removeAiHistory(id: string): AiHistoryEntry[] {
  const next = loadAiHistory().filter((e) => e.id !== id);
  persist(next);
  return next;
}

export function clearAiHistory(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // 忽略
  }
}