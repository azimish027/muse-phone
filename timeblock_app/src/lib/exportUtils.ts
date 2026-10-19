import dayjs from 'dayjs';
import type { Tag, TimeBlock } from '../types';
import { WEEKDAY_LABELS, fmtDateCN, fmtDuration, fmtMinute } from './timeUtils';

/** UTF-8 文本转纯 Base64（用于 saveFile 保存 txt） */
export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function weekdayIndexOf(date: string): number {
  const wd = dayjs(date).day();
  return wd === 0 ? 6 : wd - 1;
}

interface TagSummaryEntry {
  tagId: string;
  name: string;
  totalMinutes: number;
  count: number;
  pct: number;
  blocks: TimeBlock[];
}

/** 按天明细：每天列出时间块 */
export function buildDailyExportText(dates: string[], blocks: TimeBlock[], tags: Tag[], title: string): string {
  const lines: string[] = [title, ''];
  let totalCount = 0;
  let totalMinutes = 0;

  dates.forEach((date) => {
    const dayBlocks = blocks
      .filter((b) => b.recordDate === date)
      .sort((a, b) => a.startMinute - b.startMinute || a.createdAt - b.createdAt);
    lines.push(`■ ${fmtDateCN(date)} 周${WEEKDAY_LABELS[weekdayIndexOf(date)]}`);
    if (dayBlocks.length === 0) {
      lines.push('  （当天无时间块）');
    } else {
      dayBlocks.forEach((b) => {
        const tag = b.tagId ? tags.find((t) => t.id === b.tagId) : undefined;
        const tagStr = tag ? ` [${tag.name}]` : '';
        lines.push(`  ${fmtMinute(b.startMinute)}-${fmtMinute(b.endMinute)} ${b.title}${tagStr}`);
        totalCount += 1;
        totalMinutes += Math.max(0, b.endMinute - b.startMinute);
        if (b.note) lines.push(`    备注：${b.note}`);
      });
    }
    lines.push('');
  });

  lines.push(`合计：${totalCount} 个时间块，共 ${fmtDuration(totalMinutes)}`);
  return lines.join('\n');
}

/** 自然周分组（周一为一周起点），返回每组的起止日期 */
function groupWeeks(dates: string[]): { start: string; end: string }[] {
  const weeks: { start: string; end: string }[] = [];
  let current: { start: string; end: string } | null = null;
  dates.forEach((date) => {
    const iso = weekdayIndexOf(date);
    if (!current || iso === 0) {
      current = { start: date, end: date };
      weeks.push(current);
    } else {
      current.end = date;
    }
  });
  return weeks;
}

/** 按周汇总趋势：每周合计时长与 ASCII 趋势图（保存为 txt） */
export function buildWeekTrendText(dates: string[], blocks: TimeBlock[], title: string): string {
  const weeks = groupWeeks(dates);
  const rows = weeks.map((w) => {
    let total = 0;
    let count = 0;
    blocks.forEach((b) => {
      if (b.recordDate >= w.start && b.recordDate <= w.end) {
        total += Math.max(0, b.endMinute - b.startMinute);
        count += 1;
      }
    });
    return { ...w, totalMinutes: total, count };
  });
  const total = rows.reduce((s, r) => s + r.totalMinutes, 0);
  const peak = rows.reduce((m, r) => Math.max(m, r.totalMinutes), 0);
  const lines: string[] = [title, '', `共 ${rows.length} 周 · 合计 ${fmtDuration(total)}`, ''];
  if (total === 0) {
    lines.push('（范围内无时间块记录）');
    return lines.join('\n');
  }
  const BAR = 20;
  rows.forEach((r, i) => {
    const n = peak > 0 ? Math.round((r.totalMinutes / peak) * BAR) : 0;
    const bar = '█'.repeat(Math.max(1, Math.min(BAR, n))) + '░'.repeat(Math.max(0, BAR - n));
    const pct = total > 0 ? ((r.totalMinutes / total) * 100).toFixed(1) : '0.0';
    lines.push(`W${i + 1} ${r.start} ~ ${r.end}  ${fmtDuration(r.totalMinutes)}（${pct}%）${r.count}个时间块`);
    lines.push(`   ${bar}`);
  });
  lines.push('', `单周峰值 ${fmtDuration(peak)} · 周均 ${fmtDuration(total / Math.max(1, rows.length))}`);
  return lines.join('\n');
}

/** 按标签汇总：每个标签聚合总时长、占比与时间块明细 */
export function buildTagSummaryText(_dates: string[], blocks: TimeBlock[], tags: Tag[], title: string): string {
  const byTag = new Map<string, TagSummaryEntry>();
  let totalMinutes = 0;
  let totalCount = 0;

  blocks.forEach((b) => {
    const dur = Math.max(0, b.endMinute - b.startMinute);
    totalMinutes += dur;
    totalCount += 1;
    const key = b.tagId || '';
    if (!byTag.has(key)) {
      const tag = b.tagId ? tags.find((t) => t.id === b.tagId) : undefined;
      byTag.set(key, {
        tagId: key,
        name: tag?.name ?? '未标记',
        totalMinutes: 0,
        count: 0,
        pct: 0,
        blocks: [],
      });
    }
    const entry = byTag.get(key);
    if (entry) {
      entry.totalMinutes += dur;
      entry.count += 1;
      entry.blocks.push(b);
    }
  });

  const entries = [...byTag.values()].sort((a, b) => b.totalMinutes - a.totalMinutes);
  entries.forEach((e) => {
    e.pct = totalMinutes > 0 ? (e.totalMinutes / totalMinutes) * 100 : 0;
  });

  const lines: string[] = [title, '', `共 ${totalCount} 个时间块，合计 ${fmtDuration(totalMinutes)}`, ''];
  if (entries.length === 0) {
    lines.push('（无时间块记录）');
  }
  entries.forEach((e) => {
    lines.push(`■ ${e.name} — ${fmtDuration(e.totalMinutes)}（${e.pct.toFixed(1)}%），${e.count} 个时间块`);
    [...e.blocks]
      .sort((a, b) => a.recordDate.localeCompare(b.recordDate) || a.startMinute - b.startMinute || a.createdAt - b.createdAt)
      .forEach((b) => {
        lines.push(
          `  ${fmtDateCN(b.recordDate)} 周${WEEKDAY_LABELS[weekdayIndexOf(b.recordDate)]} ${fmtMinute(b.startMinute)}-${fmtMinute(b.endMinute)} ${b.title}`,
        );
        if (b.note) lines.push(`    备注：${b.note}`);
      });
    lines.push('');
  });

  return lines.join('\n');
}