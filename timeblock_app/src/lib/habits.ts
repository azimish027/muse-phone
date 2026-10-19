import type { TimeBlock } from '../types';
import { addDays, fmtDate } from './timeUtils';

/**
 * 习惯连续性：连续记录天数、单日达成、时段分布。
 * 全部由时间块记录计算，纯函数。
 */

/** 以 anchor（含）为结束日的连续「有记录」天数 */
export function computeStreak(blocks: TimeBlock[], anchor: string): number {
  const set = new Set(blocks.map((b) => b.recordDate));
  let streak = 0;
  let cur = anchor;
  let guard = 0;
  while (set.has(cur) && guard < 400) {
    streak += 1;
    cur = fmtDate(addDays(new Date(`${cur}T00:00:00`), -1));
    guard += 1;
  }
  return streak;
}

/** 范围内每天的有效时长与是否达标（>= goalMinutes） */
export function computeDayAchievement(
  dates: string[],
  blocks: TimeBlock[],
  goalMinutes: number,
): { date: string; minutes: number; met: boolean }[] {
  const byDate = new Map<string, number>();
  blocks.forEach((b) => {
    const dur = Math.max(0, b.endMinute - b.startMinute);
    byDate.set(b.recordDate, (byDate.get(b.recordDate) ?? 0) + dur);
  });
  return dates.map((d) => {
    const minutes = byDate.get(d) ?? 0;
    return { date: d, minutes, met: minutes >= goalMinutes };
  });
}

/** 24 小时时段分布：每个小时累计的分钟数（时间流向图用） */
export function hourlyDistribution(blocks: TimeBlock[]): number[] {
  const buckets = new Array<number>(24).fill(0);
  blocks.forEach((b) => {
    const dur = Math.max(0, b.endMinute - b.startMinute);
    if (dur <= 0) return;
    let s = b.startMinute;
    while (s < b.endMinute) {
      const h = Math.min(23, Math.floor(s / 60));
      const segEnd = Math.min(b.endMinute, (h + 1) * 60);
      buckets[h] += segEnd - s;
      s = segEnd;
    }
  });
  return buckets;
}