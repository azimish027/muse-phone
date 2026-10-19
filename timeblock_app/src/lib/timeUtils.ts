import dayjs from 'dayjs';

/** 每小时的像素高度（画布逻辑尺寸，随缩放整体变化） */
export const HOUR_HEIGHT = 64;
export const DAY_MINUTES = 24 * 60;
/** 时间列宽度：加宽后刻度更清晰 */
export const TIME_COL_WIDTH = 76;

export const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const;

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function fmtDate(d: Date): string {
  return dayjs(d).format('YYYY-MM-DD');
}

export function addDays(d: Date, n: number): Date {
  return dayjs(d).add(n, 'day').toDate();
}

export function fmtMinute(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${pad2(h)}:${pad2(min)}`;
}

export function snapMinute(m: number, g: number): number {
  return Math.round(m / g) * g;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** 周一到周日为一周 */
export function getWeekStart(d: Date): Date {
  const day = dayjs(d).day();
  const diff = day === 0 ? -6 : 1 - day;
  return dayjs(d).add(diff, 'day').toDate();
}

/** 以周一为一周起点，返回从该周一起的连续 days 天日期列表 */
export function getWeekDates(anchor: string, days = 7): string[] {
  const ws = getWeekStart(dayjs(anchor).toDate());
  return Array.from({ length: Math.max(1, Math.min(days, 90)) }, (_, i) => fmtDate(addDays(ws, i)));
}

export function formatDateTitle(date: string, viewMode: 'day' | 'week', days = 7): string {
  const d = dayjs(date);
  if (viewMode === 'day') {
    return `${d.year()}年${d.month() + 1}月${d.date()}日 周${WEEKDAY_LABELS[d.day() === 0 ? 6 : d.day() - 1]}`;
  }
  const ws = getWeekStart(d.toDate());
  const we = dayjs(ws).add(Math.max(1, days) - 1, 'day');
  const wsD = dayjs(ws);
  return `${wsD.month() + 1}月${wsD.date()}日 - ${we.month() + 1}月${we.date()}日`;
}

export function nowMinuteOfDay(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function todayStr(): string {
  return fmtDate(new Date());
}

export function fmtDateCN(date: string): string {
  const d = dayjs(date);
  return `${d.month() + 1}月${d.date()}日`;
}

/** 当月第一天至最后一天的日期范围 */
export function getMonthRange(anchor: string): [string, string] {
  const d = dayjs(anchor);
  return [d.startOf('month').format('YYYY-MM-DD'), d.endOf('month').format('YYYY-MM-DD')];
}

/** 以 anchor 为结束日，向前 days 天（含当天）的日期范围 [start, end]，天数限制在 1..365 */
export function getDaysRangeEndingAt(anchor: string, days: number): [string, string] {
  const n = Math.max(1, Math.min(Math.round(days) || 1, 365));
  const start = fmtDate(addDays(dayjs(anchor).toDate(), -(n - 1)));
  return [start, anchor];
}

/** 从 start 到 end（含）的连续日期列表 */
export function getDateList(start: string, end: string): string[] {
  const list: string[] = [];
  let cur = dayjs(start);
  const last = dayjs(end);
  let guard = 0;
  while ((cur.isBefore(last) || cur.isSame(last, 'day')) && guard < 400) {
    list.push(cur.format('YYYY-MM-DD'));
    cur = cur.add(1, 'day');
    guard += 1;
  }
  return list;
}

/** 分钟数格式化为「X小时Y分」 */
export function fmtDuration(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h > 0 && rest > 0) return `${h}小时${rest}分`;
  if (h > 0) return `${h}小时`;
  return `${rest}分`;
}