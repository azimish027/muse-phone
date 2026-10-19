import dayjs from 'dayjs';
import type { DailyPanel, DailyTask } from '../types';
import { todayStr } from './timeUtils';

/**
 * 每日面板本地存储：按日期归档心情、任务、重要事项、小结。
 * 属于单人单设备的轻量记录，使用 localStorage 键值存储。
 */

const KEY_PREFIX = 'tb_daily_panel_';
const CITY_KEY = 'tb_weather_city';

export function panelKey(date: string): string {
  return `${KEY_PREFIX}${date}`;
}

export function emptyPanel(): DailyPanel {
  return { mood: '', important: [], tasks: [], summary: '' };
}

/** 归一化旧数据：字段缺失、类型不符时补默认值，脏数据不导致崩溃 */
export function loadPanel(date: string): DailyPanel {
  try {
    const raw = window.localStorage.getItem(panelKey(date));
    if (!raw) return emptyPanel();
    const parsed = JSON.parse(raw) as Partial<DailyPanel> | null;
    if (!parsed || typeof parsed !== 'object') return emptyPanel();
    const mood = typeof parsed.mood === 'string' ? parsed.mood : '';
    const important = Array.isArray(parsed.important)
      ? parsed.important.filter((x): x is string => typeof x === 'string')
      : [];
    const tasks = Array.isArray(parsed.tasks)
      ? (parsed.tasks as unknown[])
          .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
          .map((t): DailyTask => ({
            id: typeof t.id === 'string' && t.id ? t.id : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            text: typeof t.text === 'string' ? t.text : '',
            emoji: typeof t.emoji === 'string' ? t.emoji : '',
            done: !!t.done,
            createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
          }))
      : [];
    const summary = typeof parsed.summary === 'string' ? parsed.summary : '';
    return { mood, important, tasks, summary };
  } catch {
    return emptyPanel();
  }
}

export function savePanel(date: string, panel: DailyPanel): void {
  try {
    window.localStorage.setItem(panelKey(date), JSON.stringify(panel));
  } catch {
    // 忽略存储失败
  }
}

export function loadWeatherCity(): string {
  try {
    const v = window.localStorage.getItem(CITY_KEY);
    return v && typeof v === 'string' && v.trim() ? v.trim() : '北京';
  } catch {
    return '北京';
  }
}

export function saveWeatherCity(city: string): void {
  try {
    window.localStorage.setItem(CITY_KEY, city.trim());
  } catch {
    // 忽略存储失败
  }
}

/** 把某天面板整理成可复制分享的纯文本 */
export function buildPanelShareText(date: string, panel: DailyPanel): string {
  const d = dayjs(date);
  const lines: string[] = [];
  lines.push(`📅 ${d.year()}年${d.month() + 1}月${d.date()}日 面板`);
  if (panel.mood) lines.push(`😊 心情：${panel.mood}`);
  if (panel.tasks.length > 0) {
    const done = panel.tasks.filter((t) => t.done).length;
    lines.push(`✅ 任务清单（${done}/${panel.tasks.length}）`);
    panel.tasks.forEach((t) => lines.push(`  ${t.done ? '☑️' : '⬜'} ${t.emoji ? `${t.emoji} ` : ''}${t.text}`));
  }
  if (panel.important.length > 0) {
    lines.push(`📌 重要事项（${panel.important.length}）`);
    panel.important.forEach((it) => lines.push(`  ${it}`));
  }
  const summary = panel.summary.trim();
  if (summary) {
    lines.push('✨ 今日小结');
    lines.push(summary);
  }
  return lines.join('\n');
}

export interface HistoryEntry {
  date: string;
  panel: DailyPanel;
  hasContent: boolean;
}

/** 近 days 天的历史面板（不含 anchor 当天），只返回有记录的日子，按日期倒序 */
export function buildHistoryList(days = 30, anchor?: string): HistoryEntry[] {
  const end = anchor ?? todayStr();
  const list: HistoryEntry[] = [];
  const d = dayjs(end).subtract(1, 'day');
  for (let i = 0; i < days; i += 1) {
    const date = d.subtract(i, 'day').format('YYYY-MM-DD');
    const p = loadPanel(date);
    const hasContent = !!(p.mood || p.tasks.length || p.important.length || p.summary.trim());
    if (hasContent) list.push({ date, panel: p, hasContent });
  }
  return list;
}