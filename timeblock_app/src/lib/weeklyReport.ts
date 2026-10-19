import type { Tag, TimeBlock } from '../types';
import { fmtDateCN, fmtDuration, WEEKDAY_LABELS } from './timeUtils';
import dayjs from 'dayjs';

/**
 * 周报图片：把标签汇总渲染成一张带主题风格的海报图（canvas）。
 * 支持三种版式：classic 经典 / minimal 极简 / ranking 榜单。
 * 返回 PNG dataURL，可直接预览、保存到相册。
 */

export interface ReportTagItem {
  name: string;
  color: string;
  minutes: number;
  pct: number;
  count: number;
}

export interface ReportPayload {
  rangeLabel: string;
  totalMinutes: number;
  count: number;
  activeDays: number;
  goalMinutes: number;
  goalRate: number;
  items: ReportTagItem[];
  summary: string;
  generatedAt: string;
}

export interface PosterTheme {
  primary: string;
  base: 'light' | 'dark';
}

export type PosterLayout = 'classic' | 'minimal' | 'ranking';

const W = 1080;
const H = 1640;

function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const chars = text.split('');
  const lines: string[] = [];
  let line = '';
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function fmtMinuteHM(m: number): string {
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

export function weekdayIndexOf(date: string): number {
  const wd = dayjs(date).day();
  return wd === 0 ? 6 : wd - 1;
}

/** 汇总范围内的标签数据（周报图片用） */
export function buildReportItems(blocks: TimeBlock[], tags: Tag[]): ReportTagItem[] {
  const byTag = new Map<string, { minutes: number; count: number }>();
  let total = 0;
  blocks.forEach((b) => {
    const dur = Math.max(0, b.endMinute - b.startMinute);
    total += dur;
    const key = b.tagId || '';
    const e = byTag.get(key) ?? { minutes: 0, count: 0 };
    e.minutes += dur;
    e.count += 1;
    byTag.set(key, e);
  });
  const items: ReportTagItem[] = [...byTag.entries()].map(([tagId, e]) => {
    const tag = tagId ? tags.find((t) => t.id === tagId) : undefined;
    return {
      name: tag?.name ?? '未标记',
      color: tag?.color ?? '#9CA3AF',
      minutes: e.minutes,
      pct: total > 0 ? (e.minutes / total) * 100 : 0,
      count: e.count,
    };
  });
  return items.sort((a, b) => b.minutes - a.minutes);
}

/** 渲染周报海报，返回 PNG dataURL */
export function renderWeeklyReportPoster(payload: ReportPayload, theme: PosterTheme, layout: PosterLayout = 'classic'): string {
  const primary = theme.primary || '#4F46E5';
  const isDark = theme.base === 'dark';

  if (layout === 'minimal') return drawMinimal(payload, primary, isDark);
  if (layout === 'ranking') return drawRanking(payload, primary);
  return drawClassic(payload, primary, isDark);
}

/** 经典版式：标题卡片 + 三统计 + 环形图 + 排行列表 + 小结 */
function drawClassic(payload: ReportPayload, primary: string, isDark: boolean): string {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const bgTop = isDark ? '#151b26' : '#f6f3ee';
  const bgBottom = isDark ? '#0d1015' : '#ffffff';
  const cardBg = isDark ? 'rgba(22, 27, 35, 0.92)' : 'rgba(255, 255, 255, 0.94)';
  const textMain = isDark ? '#e8ecf2' : '#211f1b';
  const textSub = isDark ? '#9aa4b2' : '#78726a';
  const textFaint = isDark ? '#5f6b7a' : '#a8a29a';
  const border = isDark ? '#252d39' : '#eae5dd';

  // 背景渐变 + 装饰光斑
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, bgTop);
  bg.addColorStop(1, bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = rgba(primary, isDark ? 0.1 : 0.08);
  ctx.beginPath();
  ctx.arc(930, 160, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(120, 1380, 300, 0, Math.PI * 2);
  ctx.fill();

  const font = (weight: number, size: number) => `${weight} ${size}px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`;

  // 顶部品牌
  ctx.textAlign = 'left';
  ctx.fillStyle = primary;
  ctx.font = font(800, 40);
  ctx.fillText('落砂成羽之刻', 72, 118);
  ctx.fillStyle = textSub;
  ctx.font = font(400, 26);
  ctx.fillText('刻砂求羽，落砂成羽之刻。', 72, 162);

  // 标题卡片
  let y = 216;
  ctx.fillStyle = cardBg;
  roundRect(ctx, 52, y, W - 104, 210, 28);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = textMain;
  ctx.font = font(700, 44);
  ctx.fillText('标签周报', 92, y + 78);
  ctx.fillStyle = textSub;
  ctx.font = font(400, 28);
  ctx.fillText(payload.rangeLabel, 92, y + 126);
  ctx.font = font(400, 24);
  ctx.fillText(`记录 ${payload.count} 个时间块 · 活跃 ${payload.activeDays} 天`, 92, y + 172);

  // 核心数据行
  y += 264;
  const statW = (W - 104 - 48) / 3;
  const statLabels = ['总时长', '日均', '目标达成'];
  const statVals = [
    fmtDuration(payload.totalMinutes),
    fmtDuration(payload.totalMinutes / Math.max(1, payload.activeDays || 1)),
    `${Math.round(payload.goalRate)}%`,
  ];
  statLabels.forEach((label, i) => {
    const x = 52 + i * (statW + 24);
    ctx.fillStyle = cardBg;
    roundRect(ctx, x, y, statW, 132, 22);
    ctx.fill();
    ctx.fillStyle = textSub;
    ctx.font = font(400, 24);
    ctx.textAlign = 'center';
    ctx.fillText(label, x + statW / 2, y + 46);
    ctx.fillStyle = i === 2 && payload.goalRate >= 100 ? '#0e9f6e' : textMain;
    ctx.font = font(700, 38);
    ctx.fillText(statVals[i], x + statW / 2, y + 100);
  });
  ctx.textAlign = 'left';

  // 标签占比环形图 + 排行
  y += 196;
  ctx.fillStyle = cardBg;
  roundRect(ctx, 52, y, W - 104, 460, 28);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.stroke();
  ctx.fillStyle = textMain;
  ctx.font = font(700, 32);
  ctx.fillText('时间花在哪', 92, y + 60);

  // 环形图
  const cx = 320;
  const cy = y + 268;
  const rOuter = 138;
  const rInner = 96;
  const total = payload.totalMinutes;
  let angle = -Math.PI / 2;
  const items = payload.items.slice(0, 8);
  if (total > 0 && items.length > 0) {
    items.forEach((it) => {
      const sweep = (it.minutes / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rOuter, angle, angle + sweep);
      ctx.arc(cx, cy, rInner, angle + sweep, angle, true);
      ctx.closePath();
      ctx.fillStyle = it.color;
      ctx.fill();
      angle += sweep;
    });
    // 中心文字
    ctx.fillStyle = textMain;
    ctx.font = font(700, 44);
    ctx.textAlign = 'center';
    ctx.fillText(fmtDuration(total), cx, cy - 8);
    ctx.fillStyle = textSub;
    ctx.font = font(400, 24);
    ctx.fillText('合计时长', cx, cy + 40);
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = textFaint;
    ctx.font = font(400, 28);
    ctx.textAlign = 'center';
    ctx.fillText('暂无记录', cx, cy + 10);
    ctx.textAlign = 'left';
  }

  // 排行列表（右侧）
  const listX = 520;
  const rowH = 56;
  const topItems = items.slice(0, 6);
  topItems.forEach((it, i) => {
    const ry = y + 96 + i * rowH;
    ctx.fillStyle = it.color;
    ctx.beginPath();
    ctx.arc(listX + 14, ry + 14, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = textMain;
    ctx.font = font(500, 26);
    const name = it.name.length > 6 ? `${it.name.slice(0, 6)}…` : it.name;
    ctx.fillText(name, listX + 36, ry + 22);
    ctx.fillStyle = textSub;
    ctx.font = font(400, 24);
    ctx.textAlign = 'right';
    ctx.fillText(`${fmtDuration(it.minutes)} · ${it.pct.toFixed(1)}%`, listX + 440, ry + 22);
    ctx.textAlign = 'left';
    // 进度条
    ctx.fillStyle = isDark ? '#242c38' : '#f0ede6';
    roundRect(ctx, listX + 36, ry + 34, 404, 8, 4);
    ctx.fill();
    ctx.fillStyle = it.color;
    roundRect(ctx, listX + 36, ry + 34, Math.max(8, (it.pct / 100) * 404), 8, 4);
    ctx.fill();
  });
  if (items.length > 6) {
    ctx.fillStyle = textFaint;
    ctx.font = font(400, 22);
    ctx.fillText(`另有 ${items.length - 6} 项小类未列出`, listX + 36, y + 96 + 6 * rowH + 16);
  }

  // 周小结卡片
  y += 512;
  ctx.fillStyle = cardBg;
  roundRect(ctx, 52, y, W - 104, 300, 28);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.stroke();
  ctx.fillStyle = textMain;
  ctx.font = font(700, 32);
  ctx.fillText('本周小结', 92, y + 60);
  const summary = payload.summary.trim();
  ctx.fillStyle = textSub;
  ctx.font = font(400, 28);
  if (summary) {
    const lines = wrapText(ctx, summary, W - 190).slice(0, 6);
    lines.forEach((line, i) => {
      ctx.fillText(line, 92, y + 112 + i * 42);
    });
  } else {
    ctx.fillText('这周还没有写小结，去统计页写一句吧。', 92, y + 112);
  }

  // 底部
  ctx.fillStyle = primary;
  ctx.font = font(600, 26);
  ctx.textAlign = 'center';
  ctx.fillText('刻砂求羽，落砂成羽之刻。', W / 2, H - 96);
  ctx.fillStyle = textFaint;
  ctx.font = font(400, 22);
  ctx.fillText(`生成于 ${payload.generatedAt} · 落砂成羽之刻`, W / 2, H - 52);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}

/** 极简版式：居中留白 + 巨型总时长 + 大环形图 + 紧凑排行 */
function drawMinimal(payload: ReportPayload, primary: string, isDark: boolean): string {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const bgTop = isDark ? '#14181f' : '#faf8f4';
  const bgBottom = isDark ? '#0c0f14' : '#ffffff';
  const cardBg = isDark ? 'rgba(21, 26, 33, 0.92)' : 'rgba(255, 255, 255, 0.9)';
  const textMain = isDark ? '#eef1f6' : '#23201b';
  const textSub = isDark ? '#9aa4b2' : '#7d766c';
  const textFaint = isDark ? '#5f6b7a' : '#aaa49a';
  const border = isDark ? '#242c38' : '#ece7de';
  const font = (weight: number, size: number) => `${weight} ${size}px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`;

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, bgTop);
  bg.addColorStop(1, bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = rgba(primary, isDark ? 0.06 : 0.05);
  ctx.beginPath();
  ctx.arc(540, 900, 420, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'center';

  // 顶部品牌
  ctx.fillStyle = primary;
  ctx.font = font(800, 36);
  ctx.fillText('落砂成羽之刻', W / 2, 108);
  ctx.fillStyle = textFaint;
  ctx.font = font(400, 24);
  ctx.fillText('刻砂求羽，落砂成羽之刻。', W / 2, 150);

  // 大标题
  ctx.fillStyle = textMain;
  ctx.font = font(700, 64);
  ctx.fillText('标签周报', W / 2, 262);
  ctx.fillStyle = textSub;
  ctx.font = font(400, 30);
  ctx.fillText(payload.rangeLabel, W / 2, 320);

  // 巨型总时长
  const totalText = fmtDuration(payload.totalMinutes);
  ctx.fillStyle = primary;
  ctx.font = font(800, 128);
  if (ctx.measureText(totalText).width > W - 120) {
    ctx.font = font(800, 100);
  }
  ctx.fillText(totalText, W / 2, 492);
  ctx.fillStyle = textSub;
  ctx.font = font(400, 26);
  ctx.fillText('合计时长', W / 2, 536);

  // 三个小统计
  const stats: Array<[string, string]> = [
    [`${payload.count}`, '记录时间块'],
    [`${payload.activeDays}`, '活跃天数'],
    [`${Math.round(payload.goalRate)}%`, '目标达成'],
  ];
  const statW = (W - 104 - 48) / 3;
  stats.forEach(([v, label], i) => {
    const x = 52 + i * (statW + 24);
    ctx.fillStyle = cardBg;
    roundRect(ctx, x, 596, statW, 138, 24);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = i === 2 && payload.goalRate >= 100 ? '#0e9f6e' : textMain;
    ctx.font = font(700, 44);
    ctx.fillText(v, x + statW / 2, 664);
    ctx.fillStyle = textSub;
    ctx.font = font(400, 24);
    ctx.fillText(label, x + statW / 2, 710);
  });

  // 大环形图
  const cx = W / 2;
  const cy = 892;
  const rOuter = 196;
  const rInner = 144;
  const total = payload.totalMinutes;
  const items = payload.items.slice(0, 8);
  let angle = -Math.PI / 2;
  if (total > 0 && items.length > 0) {
    items.forEach((it) => {
      const sweep = (it.minutes / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rOuter, angle, angle + sweep);
      ctx.arc(cx, cy, rInner, angle + sweep, angle, true);
      ctx.closePath();
      ctx.fillStyle = it.color;
      ctx.fill();
      angle += sweep;
    });
    ctx.fillStyle = textMain;
    ctx.font = font(700, 52);
    ctx.fillText(fmtDuration(total), cx, cy - 8);
    ctx.fillStyle = textSub;
    ctx.font = font(400, 24);
    ctx.fillText('合计时长', cx, cy + 44);
  } else {
    ctx.fillStyle = textFaint;
    ctx.font = font(400, 30);
    ctx.fillText('暂无记录', cx, cy + 10);
  }

  // 紧凑排行（居中）
  const topItems = items.slice(0, 5);
  let ly = cy + rOuter + 48;
  topItems.forEach((it) => {
    const name = it.name.length > 8 ? `${it.name.slice(0, 8)}…` : it.name;
    const line = `${name}　${fmtDuration(it.minutes)} · ${it.pct.toFixed(1)}%`;
    ctx.font = font(500, 28);
    const lw = ctx.measureText(line).width;
    const left = (W - lw) / 2;
    ctx.fillStyle = it.color;
    ctx.beginPath();
    ctx.arc(left - 16, ly - 9, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = textMain;
    ctx.fillText(line, left, ly);
    ly += 46;
  });
  if (items.length > 5) {
    ctx.fillStyle = textFaint;
    ctx.font = font(400, 22);
    ctx.fillText(`另有 ${items.length - 5} 项小类未列出`, W / 2, ly + 6);
  }

  // 周小结
  const summary = payload.summary.trim();
  const sumY = 1262;
  ctx.fillStyle = cardBg;
  roundRect(ctx, 120, sumY, W - 240, 218, 24);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = textMain;
  ctx.font = font(700, 30);
  ctx.fillText('本周小结', W / 2, sumY + 52);
  ctx.fillStyle = textSub;
  ctx.font = font(400, 26);
  if (summary) {
    const lines = wrapText(ctx, summary, W - 320).slice(0, 3);
    lines.forEach((line, i) => ctx.fillText(line, W / 2, sumY + 100 + i * 40));
  } else {
    ctx.fillText('这周还没有写小结，去统计页写一句吧。', W / 2, sumY + 100);
  }

  // 底部
  ctx.fillStyle = primary;
  ctx.font = font(600, 26);
  ctx.fillText('刻砂求羽，落砂成羽之刻。', W / 2, H - 96);
  ctx.fillStyle = textFaint;
  ctx.font = font(400, 22);
  ctx.fillText(`生成于 ${payload.generatedAt} · 落砂成羽之刻`, W / 2, H - 52);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}

/** 榜单版式：深色榜单风 + 排名序号 + 全宽进度条排行 */
function drawRanking(payload: ReportPayload, primary: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 榜单风固定深色背景，突出排名与进度
  const bgTop = '#101624';
  const bgBottom = '#0a0e17';
  const cardBg = 'rgba(23, 30, 42, 0.94)';
  const textMain = '#eef1f6';
  const textSub = '#9aa7b8';
  const textFaint = '#5f6d80';
  const border = '#232c3c';
  const font = (weight: number, size: number) => `${weight} ${size}px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`;

  // 背景 + 顶部光带
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, bgTop);
  bg.addColorStop(1, bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const band = ctx.createLinearGradient(0, 0, W, 0);
  band.addColorStop(0, rgba(primary, 0));
  band.addColorStop(0.5, rgba(primary, 0.16));
  band.addColorStop(1, rgba(primary, 0));
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, W, 320);

  // 顶部品牌
  ctx.textAlign = 'center';
  ctx.fillStyle = primary;
  ctx.font = font(800, 36);
  ctx.fillText('落砂成羽之刻', W / 2, 106);
  ctx.fillStyle = textFaint;
  ctx.font = font(400, 24);
  ctx.fillText('刻砂求羽，落砂成羽之刻。', W / 2, 148);

  // 大标题
  ctx.fillStyle = textMain;
  ctx.font = font(800, 62);
  ctx.fillText('标签周报', W / 2, 256);
  ctx.fillStyle = textSub;
  ctx.font = font(400, 28);
  ctx.fillText(payload.rangeLabel, W / 2, 312);

  // 核心数据行
  const statLabels = ['总时长', '日均', '目标达成'];
  const statVals = [
    fmtDuration(payload.totalMinutes),
    fmtDuration(payload.totalMinutes / Math.max(1, payload.activeDays || 1)),
    `${Math.round(payload.goalRate)}%`,
  ];
  const statW = (W - 104 - 48) / 3;
  statLabels.forEach((label, i) => {
    const x = 52 + i * (statW + 24);
    ctx.fillStyle = cardBg;
    roundRect(ctx, x, 366, statW, 128, 22);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = textSub;
    ctx.font = font(400, 23);
    ctx.fillText(label, x + statW / 2, 414);
    ctx.fillStyle = i === 2 && payload.goalRate >= 100 ? '#2dd4a7' : textMain;
    ctx.font = font(700, 38);
    ctx.fillText(statVals[i], x + statW / 2, 470);
  });

  // 排行卡片
  const items = payload.items.slice(0, 8);
  const rankY = 544;
  ctx.fillStyle = cardBg;
  roundRect(ctx, 52, rankY, W - 104, 640, 28);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = textMain;
  ctx.font = font(700, 34);
  ctx.fillText('标签排行', 92, rankY + 62);
  ctx.fillStyle = textFaint;
  ctx.font = font(400, 22);
  ctx.fillText(`TOP ${Math.min(items.length, 8)}`, 92, rankY + 96);

  const listX = 92;
  const rowH = 62;
  const barMax = W - 104 - 184;
  const rankColors = ['#f5b942', '#c9d2de', '#c08a5e'];
  items.forEach((it, i) => {
    const ry = rankY + 120 + i * rowH;
    // 排名序号
    ctx.fillStyle = i < 3 ? rankColors[i] : '#3a4556';
    ctx.beginPath();
    ctx.arc(listX + 26, ry + 22, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = i < 3 ? '#0e1320' : '#aab6c8';
    ctx.font = font(800, 24);
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), listX + 26, ry + 29);
    ctx.textAlign = 'left';
    // 名称 + 时长
    ctx.fillStyle = textMain;
    ctx.font = font(500, 26);
    const name = it.name.length > 6 ? `${it.name.slice(0, 6)}…` : it.name;
    ctx.fillText(name, listX + 62, ry + 17);
    ctx.fillStyle = textSub;
    ctx.font = font(400, 22);
    ctx.fillText(`${fmtDuration(it.minutes)} · ${it.pct.toFixed(1)}%`, listX + 62, ry + 44);
    // 右侧百分比
    ctx.fillStyle = textMain;
    ctx.font = font(700, 28);
    ctx.textAlign = 'right';
    ctx.fillText(`${it.pct.toFixed(1)}%`, W - 92, ry + 30);
    ctx.textAlign = 'left';
    // 进度条
    ctx.fillStyle = '#1a2232';
    roundRect(ctx, listX + 62, ry + 52, barMax, 10, 5);
    ctx.fill();
    ctx.fillStyle = it.color;
    roundRect(ctx, listX + 62, ry + 52, Math.max(10, (it.pct / 100) * barMax), 10, 5);
    ctx.fill();
  });
  if (payload.items.length > 8) {
    ctx.fillStyle = textFaint;
    ctx.font = font(400, 22);
    ctx.textAlign = 'center';
    ctx.fillText(`另有 ${payload.items.length - 8} 项小类未列入榜单`, W / 2, rankY + 120 + 8 * rowH + 12);
    ctx.textAlign = 'left';
  }

  // 周小结
  const summary = payload.summary.trim();
  const sumY = 1246;
  ctx.fillStyle = cardBg;
  roundRect(ctx, 52, sumY, W - 104, 240, 28);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = textMain;
  ctx.font = font(700, 32);
  ctx.fillText('本周小结', 92, sumY + 58);
  ctx.fillStyle = textSub;
  ctx.font = font(400, 27);
  if (summary) {
    const lines = wrapText(ctx, summary, W - 190).slice(0, 4);
    lines.forEach((line, i) => {
      ctx.fillText(line, 92, sumY + 110 + i * 40);
    });
  } else {
    ctx.fillText('这周还没有写小结，去统计页写一句吧。', 92, sumY + 110);
  }

  // 底部
  ctx.fillStyle = primary;
  ctx.font = font(600, 26);
  ctx.textAlign = 'center';
  ctx.fillText('刻砂求羽，落砂成羽之刻。', W / 2, H - 96);
  ctx.fillStyle = textFaint;
  ctx.font = font(400, 22);
  ctx.fillText(`生成于 ${payload.generatedAt} · 落砂成羽之刻`, W / 2, H - 52);
  ctx.textAlign = 'left';

  return canvas.toDataURL('image/png');
}

/** 周报明细文本（保存/分享备用） */
export function buildReportText(blocks: TimeBlock[], tags: Tag[], rangeLabel: string): string {
  const lines: string[] = [];
  lines.push(`落砂成羽之刻 · 标签周报（${rangeLabel}）`);
  const items = buildReportItems(blocks, tags);
  const total = items.reduce((s, it) => s + it.minutes, 0);
  lines.push(`共 ${blocks.length} 个时间块，合计 ${fmtDuration(total)}`);
  items.forEach((it) => {
    lines.push(`■ ${it.name} — ${fmtDuration(it.minutes)}（${it.pct.toFixed(1)}%），${it.count} 个时间块`);
    blocks
      .filter((b) => (it.name === '未标记' ? !b.tagId : tags.find((t) => t.id === b.tagId)?.name === it.name))
      .sort((a, b) => a.recordDate.localeCompare(b.recordDate) || a.startMinute - b.startMinute)
      .forEach((b) => {
        lines.push(
          `  ${fmtDateCN(b.recordDate)} 周${WEEKDAY_LABELS[weekdayIndexOf(b.recordDate)]} ${fmtMinuteHM(b.startMinute)}-${fmtMinuteHM(b.endMinute)} ${b.title}`,
        );
      });
    lines.push('');
  });
  return lines.join('\n');
}