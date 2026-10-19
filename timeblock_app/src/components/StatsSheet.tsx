import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Clock3, Download, FileText, Flame, Image as ImageIcon, Save, Share2, Target, TrendingUp } from 'lucide-react';
import dayjs from 'dayjs';
import type { ExportFormat, ExportScope, StatTab, Tag, TimeBlock, ViewMode } from '../types';
import { Sheet } from './Sheet';
import { WEEKDAY_LABELS, fmtDateCN, fmtDuration, getDateList, getMonthRange, getWeekDates } from '../lib/timeUtils';
import { computeDayAchievement, computeStreak, hourlyDistribution } from '../lib/habits';
import { buildReportItems, renderWeeklyReportPoster } from '../lib/weeklyReport';
import type { PosterLayout, PosterTheme } from '../lib/weeklyReport';
import { loadBlocksByDateRange } from '../lib/db';
import { loadPanel } from '../lib/dailyPanel';

interface StatItem {
  tagId: string;
  name: string;
  color: string;
  minutes: number;
  pct: number;
}

interface DayStat {
  date: string;
  weekdayLabel: string;
  totalMinutes: number;
  count: number;
  items: StatItem[];
  untaggedMinutes: number;
  untaggedPct: number;
}

interface Aggregate {
  total: number;
  untagged: number;
  untaggedPct: number;
  count: number;
  items: StatItem[];
}

interface MonthWeek {
  start: string;
  end: string;
  dates: string[];
  stat: DayStat;
}

interface StatsSheetProps {
  open: boolean;
  onClose: () => void;
  viewMode: ViewMode;
  currentDate: string;
  weekDays: number;
  blocks: TimeBlock[];
  tags: Tag[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  monthBlocks: TimeBlock[];
  monthLoading: boolean;
  onLoadMonth: () => void;
  customDays: number;
  onCustomDaysChange: (days: number) => void;
  customRange: readonly [string, string];
  customBlocks: TimeBlock[];
  customLoading: boolean;
  onLoadCustom: () => void;
  onExport: (scope: ExportScope, format: ExportFormat) => void;
  exporting: boolean;
  exportError: string | null;
  exportDone: boolean;
  /** 按周汇总导出趋势图 */
  onExportTrend: (scope: ExportScope) => void;
  exportingTrend: boolean;
  exportTrendError: string | null;
  exportTrendDone: boolean;
  /** 周报海报主题色 */
  posterTheme: PosterTheme;
}

/** 每日目标（分钟）持久化 key */
const GOAL_STORAGE_KEY = 'tb_daily_goal_minutes';
const GOAL_PRESETS = [240, 360, 480, 600];

function loadGoalMinutes(): number {
  try {
    const raw = window.localStorage.getItem(GOAL_STORAGE_KEY);
    if (raw == null) return 480;
    const v = Number.parseInt(raw, 10);
    if (!Number.isFinite(v) || v <= 0) return 480;
    return Math.min(Math.max(v, 1), 1440);
  } catch {
    return 480;
  }
}

function saveGoalMinutes(min: number) {
  try {
    window.localStorage.setItem(GOAL_STORAGE_KEY, String(min));
  } catch {
    // 忽略存储失败
  }
}

function weekdayIndexOf(date: string): number {
  const wd = dayjs(date).day();
  return wd === 0 ? 6 : wd - 1;
}

function aggregateBlocks(blocks: TimeBlock[], tags: Tag[]): Aggregate {
  const byTag = new Map<string, number>();
  let untagged = 0;
  let total = 0;
  let count = 0;
  blocks.forEach((b) => {
    const dur = Math.max(0, b.endMinute - b.startMinute);
    total += dur;
    count += 1;
    if (b.tagId) {
      byTag.set(b.tagId, (byTag.get(b.tagId) ?? 0) + dur);
    } else {
      untagged += dur;
    }
  });
  const items: StatItem[] = [...byTag.entries()]
    .map(([tagId, minutes]) => {
      const tag = tags.find((t) => t.id === tagId);
      return {
        tagId,
        name: tag?.name ?? '未知标签',
        color: tag?.color ?? '#6B7280',
        minutes,
        pct: total > 0 ? (minutes / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.minutes - a.minutes);
  return { total, untagged, untaggedPct: total > 0 ? (untagged / total) * 100 : 0, count, items };
}

function buildDayStat(date: string, dayBlocks: TimeBlock[], tags: Tag[]): DayStat {
  const agg = aggregateBlocks(dayBlocks, tags);
  return {
    date,
    weekdayLabel: `周${WEEKDAY_LABELS[weekdayIndexOf(date)]}`,
    totalMinutes: agg.total,
    count: agg.count,
    items: agg.items,
    untaggedMinutes: agg.untagged,
    untaggedPct: agg.untaggedPct,
  };
}

/** 把连续日期列表按自然周（周一为一周起点）分组 */
function groupWeeks(dates: string[]): { start: string; end: string; dates: string[] }[] {
  const weeks: { start: string; end: string; dates: string[] }[] = [];
  let current: { start: string; end: string; dates: string[] } | null = null;
  dates.forEach((date) => {
    const iso = weekdayIndexOf(date);
    if (!current || iso === 0) {
      current = { start: date, end: date, dates: [date] };
      weeks.push(current);
    } else {
      current.end = date;
      current.dates.push(date);
    }
  });
  return weeks;
}

function TagBarRow({ name, color, minutes, pct }: { name: string; color: string; minutes: number; pct: number }) {
  return (
    <div className="stats-tag-row">
      <div className="stats-tag-info">
        <span className="tag-dot" style={{ background: color }} />
        <span className="stats-tag-name">{name}</span>
        <span className="stats-tag-min">
          {fmtDuration(minutes)} · {pct.toFixed(1)}%
        </span>
      </div>
      <div className="stats-bar">
        <div className="stats-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
    </div>
  );
}

/** 周小结存储：按自然周起点保存 */
const WEEK_SUMMARY_PREFIX = 'tb.weekSummary.';

function weekSummaryKey(weekStart: string): string {
  return `${WEEK_SUMMARY_PREFIX}${weekStart}`;
}

function loadWeekSummary(weekStart: string): string {
  try {
    const v = window.localStorage.getItem(weekSummaryKey(weekStart));
    return typeof v === 'string' ? v : '';
  } catch {
    return '';
  }
}

function saveWeekSummary(weekStart: string, text: string): void {
  try {
    window.localStorage.setItem(weekSummaryKey(weekStart), text);
  } catch {
    // 忽略存储失败
  }
}

/** 标签占比环形图（SVG） */
function DonutChart({ items, total }: { items: StatItem[]; total: number }) {
  const C = 2 * Math.PI * 48;
  let acc = 0;
  return (
    <svg viewBox="0 0 120 120" className="stats-donut" data-testid="stats-donut" aria-label="标签占比环形图">
      <circle cx="60" cy="60" r="48" fill="none" stroke="var(--surface-2)" strokeWidth="15" />
      {total > 0 &&
        items.map((it) => {
          const len = (it.minutes / total) * C;
          const seg = (
            <circle
              key={it.tagId}
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke={it.color}
              strokeWidth="15"
              strokeDasharray={`${Math.max(0.001, len)} ${C - len}`}
              strokeDashoffset={-acc}
              transform="rotate(-90 60 60)"
            />
          );
          acc += len;
          return seg;
        })}
      <text x="60" y="55" textAnchor="middle" className="stats-donut-total">
        {fmtDuration(total)}
      </text>
      <text x="60" y="72" textAnchor="middle" className="stats-donut-label">
        合计时长
      </text>
    </svg>
  );
}

export function StatsSheet({
  open,
  onClose,
  viewMode,
  currentDate,
  weekDays,
  blocks,
  tags,
  loading,
  error,
  onRetry,
  monthBlocks,
  monthLoading,
  onLoadMonth,
  customDays,
  onCustomDaysChange,
  customRange,
  customBlocks,
  customLoading,
  onLoadCustom,
  onExport,
  exporting,
  exportError,
  exportDone,
  onExportTrend,
  exportingTrend,
  exportTrendError,
  exportTrendDone,
  posterTheme,
}: StatsSheetProps) {
  const [statTab, setStatTab] = useState<StatTab>(viewMode === 'day' ? 'day' : 'week');
  const [exportScope, setExportScope] = useState<ExportScope>('week');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('detail');
  const [daysDraft, setDaysDraft] = useState<string>(String(customDays));
  const [goalMinutes, setGoalMinutes] = useState<number>(() => loadGoalMinutes());
  const [goalDraft, setGoalDraft] = useState<string>(() => String(loadGoalMinutes()));
  /** 标签日均趋势：选中标签（__all__ 全部 / __untagged__ 未标记） */
  const [trendTagId, setTrendTagId] = useState<string>('__all__');
  /** 周报图片：范围、生成状态、预览图、保存/分享状态 */
  const [reportScope, setReportScope] = useState<ExportScope>('week');
  /** 周报图片版式：classic 经典 / minimal 极简 / ranking 榜单 */
  const [reportLayout, setReportLayout] = useState<PosterLayout>('classic');
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportDataUrl, setReportDataUrl] = useState<string | null>(null);
  const [reportSaved, setReportSaved] = useState(false);
  const [reportSharing, setReportSharing] = useState(false);
  /** 周小结（按自然周保存） */
  const [weekSummary, setWeekSummary] = useState<string>('');

  const weekDates = useMemo(() => getWeekDates(currentDate, weekDays), [currentDate, weekDays]);
  const monthRange = useMemo(() => getMonthRange(currentDate), [currentDate]);
  const monthDates = useMemo(() => getDateList(monthRange[0], monthRange[1]), [monthRange]);
  const customDates = useMemo(() => getDateList(customRange[0], customRange[1]), [customRange]);

  useEffect(() => {
    setDaysDraft(String(customDays));
  }, [customDays]);

  useEffect(() => {
    if (open) {
      onLoadMonth();
    }
  }, [open, onLoadMonth]);

  useEffect(() => {
    if (open && statTab === 'custom') {
      onLoadCustom();
    }
  }, [open, statTab, onLoadCustom]);

  const commitGoal = () => {
    const v = Math.round(Number.parseFloat(goalDraft));
    if (Number.isNaN(v)) {
      setGoalDraft(String(goalMinutes));
      return;
    }
    const c = Math.max(1, Math.min(v, 1440));
    setGoalDraft(String(c));
    setGoalMinutes(c);
    saveGoalMinutes(c);
  };

  const commitDays = () => {
    const v = Math.round(Number.parseFloat(daysDraft));
    if (Number.isNaN(v)) {
      setDaysDraft(String(customDays));
      return;
    }
    const c = Math.max(1, Math.min(v, 365));
    setDaysDraft(String(c));
    onCustomDaysChange(c);
  };

  const weekStart = weekDates[0];

  useEffect(() => {
    if (open) setWeekSummary(loadWeekSummary(weekStart));
  }, [open, weekStart]);

  const updateWeekSummary = (v: string) => {
    setWeekSummary(v);
    saveWeekSummary(weekStart, v);
  };

  /** 从本周每日小结一键汇总周小结 */
  const fillSummaryFromDaily = () => {
    const parts = weekDates
      .map((d) => {
        const s = loadPanel(d).summary.trim();
        return s ? `${fmtDateCN(d)}：${s}` : '';
      })
      .filter(Boolean);
    if (parts.length === 0) {
      setReportError('本周还没有每日小结，先写几条今日小结再汇总');
      return;
    }
    setReportError(null);
    updateWeekSummary(parts.join('\n'));
  };

  const changeReportScope = (s: ExportScope) => {
    setReportScope(s);
    setReportDataUrl(null);
    setReportSaved(false);
    setReportError(null);
  };

  const reportRangeLabel =
    reportScope === 'week'
      ? `${fmtDateCN(weekDates[0])} 至 ${fmtDateCN(weekDates[weekDates.length - 1])}`
      : reportScope === 'month'
        ? `${fmtDateCN(monthRange[0])} 至 ${fmtDateCN(monthRange[1])}`
        : `${fmtDateCN(customRange[0])} 至 ${fmtDateCN(customRange[1])}`;

  /** 生成周报图片：按范围拉取数据并渲染海报 */
  const genReport = async (layoutOverride?: PosterLayout) => {
    if (reportBusy) return;
    setReportBusy(true);
    setReportError(null);
    setReportSaved(false);
    try {
      let start: string;
      let end: string;
      let scopeDayCount: number;
      if (reportScope === 'week') {
        start = weekDates[0];
        end = weekDates[weekDates.length - 1];
        scopeDayCount = weekDates.length;
      } else if (reportScope === 'month') {
        start = monthRange[0];
        end = monthRange[1];
        scopeDayCount = monthDates.length;
      } else {
        start = customRange[0];
        end = customRange[1];
        scopeDayCount = customDates.length;
      }
      const scopeBlocks = await loadBlocksByDateRange(start, end);
      const items = buildReportItems(scopeBlocks, tags);
      const totalMinutes = items.reduce((s, it) => s + it.minutes, 0);
      const activeDays = new Set(scopeBlocks.map((b) => b.recordDate)).size;
      const avg = totalMinutes / Math.max(1, scopeDayCount);
      const goalRate = goalMinutes > 0 ? (avg / goalMinutes) * 100 : 0;
      const dataUrl = renderWeeklyReportPoster(
        {
          rangeLabel: reportRangeLabel,
          totalMinutes,
          count: scopeBlocks.length,
          activeDays,
          goalMinutes,
          goalRate,
          items,
          summary: weekSummary,
          generatedAt: dayjs().format('YYYY年M月D日 HH:mm'),
        },
        posterTheme,
        layoutOverride ?? reportLayout,
      );
      if (!dataUrl) throw new Error('render failed');
      setReportDataUrl(dataUrl);
    } catch {
      setReportError('周报图片生成失败，请重试');
    } finally {
      setReportBusy(false);
    }
  };

  const changeReportLayout = (l: PosterLayout) => {
    setReportLayout(l);
    // 已有预览时立即按新版式重新生成，让切换所见即所得
    if (reportDataUrl) void genReport(l);
  };

  const saveReport = async () => {
    if (!reportDataUrl || reportBusy) return;
    setReportBusy(true);
    setReportError(null);
    try {
      await window.lingguang.saveImageToPhotosAlbum({ filePath: reportDataUrl });
      setReportSaved(true);
    } catch {
      setReportError('保存到相册失败，请重试');
    } finally {
      setReportBusy(false);
    }
  };

  const shareReport = async () => {
    if (reportSharing) return;
    setReportSharing(true);
    try {
      await window.lingguang.app.share({ content: [] });
    } catch {
      // 用户取消分享不提示
    } finally {
      setReportSharing(false);
    }
  };

  const dates = useMemo(() => {
    if (statTab === 'day') return [currentDate];
    if (statTab === 'month') return monthDates;
    if (statTab === 'custom') return customDates;
    return weekDates;
  }, [statTab, currentDate, weekDates, monthDates, customDates]);

  const dayStats = useMemo(
    () => (statTab === 'week' ? dates.map((d) => buildDayStat(d, blocks.filter((b) => b.recordDate === d), tags)) : []),
    [statTab, dates, blocks, tags],
  );

  const activeBlocks = statTab === 'month' ? monthBlocks : statTab === 'custom' ? customBlocks : blocks;
  const rangeAggregate = useMemo(() => aggregateBlocks(activeBlocks, tags), [activeBlocks, tags]);

  const dayCount = Math.max(1, dates.length);
  const activeDays = useMemo(() => new Set(activeBlocks.map((b) => b.recordDate)).size, [activeBlocks]);
  const avgMinutes = dayCount > 0 ? rangeAggregate.total / dayCount : 0;
  const goalRate = goalMinutes > 0 ? (avgMinutes / goalMinutes) * 100 : 0;

  const monthWeeks = useMemo(() => {
    if (statTab !== 'month') return [];
    return groupWeeks(monthDates).map((w): MonthWeek => ({
      ...w,
      stat: buildDayStat(w.start, monthBlocks.filter((b) => b.recordDate >= w.start && b.recordDate <= w.end), tags),
    }));
  }, [statTab, monthDates, monthBlocks, tags]);

  const customWeeks = useMemo(() => {
    if (statTab !== 'custom') return [];
    return groupWeeks(customDates).map((w): MonthWeek => ({
      ...w,
      stat: buildDayStat(w.start, customBlocks.filter((b) => b.recordDate >= w.start && b.recordDate <= w.end), tags),
    }));
  }, [statTab, customDates, customBlocks, tags]);

  const statTabLabel = statTab === 'day' ? '当天' : statTab === 'week' ? '本周' : statTab === 'month' ? '本月' : '自定义';
  const rangeLabel =
    statTab === 'day'
      ? fmtDateCN(currentDate)
      : statTab === 'week'
        ? `${fmtDateCN(weekDates[0])} 至 ${fmtDateCN(weekDates[weekDates.length - 1])}（共${weekDates.length}天）`
        : statTab === 'month'
          ? `${fmtDateCN(monthRange[0])} 至 ${fmtDateCN(monthRange[1])}`
          : `${fmtDateCN(customRange[0])} 至 ${fmtDateCN(customRange[1])}（共${customDates.length}天）`;

  const trendTagOptions = useMemo(() => {
    const opts: { id: string; name: string; color: string }[] = [{ id: '__all__', name: '全部', color: '' }];
    tags.forEach((t) => opts.push({ id: t.id, name: t.name, color: t.color }));
    opts.push({ id: '__untagged__', name: '未标记', color: '#9CA3AF' });
    return opts;
  }, [tags]);

  const trendMatches = useCallback(
    (b: TimeBlock) => {
      if (trendTagId === '__all__') return true;
      if (trendTagId === '__untagged__') return !b.tagId;
      return b.tagId === trendTagId;
    },
    [trendTagId],
  );

  const trendByDay = useMemo(() => {
    const map = new Map<string, number>();
    activeBlocks.forEach((b) => {
      if (!trendMatches(b)) return;
      const dur = Math.max(0, b.endMinute - b.startMinute);
      map.set(b.recordDate, (map.get(b.recordDate) ?? 0) + dur);
    });
    return dates.map((d) => ({ date: d, minutes: map.get(d) ?? 0 }));
  }, [activeBlocks, dates, trendMatches]);

  const trendTotal = useMemo(() => trendByDay.reduce((s, d) => s + d.minutes, 0), [trendByDay]);
  const trendAvg = dayCount > 0 ? trendTotal / dayCount : 0;
  const trendActiveDays = useMemo(() => trendByDay.filter((d) => d.minutes > 0).length, [trendByDay]);
  const trendPeak = useMemo(() => trendByDay.reduce((m, d) => Math.max(m, d.minutes), 0), [trendByDay]);
  const trendColor = useMemo(() => {
    if (trendTagId === '__untagged__') return '#9CA3AF';
    const tag = tags.find((t) => t.id === trendTagId);
    return tag?.color ?? '#4F46E5';
  }, [trendTagId, tags]);

  /** 按自然周汇总的时长趋势（当天视图不展示） */
  const weekTrend = useMemo(() => {
    if (statTab === 'day') return [];
    return groupWeeks(dates).map((w) => {
      let total = 0;
      let count = 0;
      activeBlocks.forEach((b) => {
        if (b.recordDate >= w.start && b.recordDate <= w.end) {
          total += Math.max(0, b.endMinute - b.startMinute);
          count += 1;
        }
      });
      return { start: w.start, end: w.end, totalMinutes: total, count };
    });
  }, [statTab, dates, activeBlocks]);

  const weekTrendTotal = useMemo(() => weekTrend.reduce((s, w) => s + w.totalMinutes, 0), [weekTrend]);
  const weekTrendPeak = useMemo(() => weekTrend.reduce((m, w) => Math.max(m, w.totalMinutes), 0), [weekTrend]);

  const busy = loading || (statTab === 'month' && monthLoading) || (statTab === 'custom' && customLoading);

  const hourDist = useMemo(() => hourlyDistribution(activeBlocks), [activeBlocks]);
  const hourPeak = useMemo(() => hourDist.reduce((m, v) => Math.max(m, v), 0), [hourDist]);
  const streak = useMemo(() => computeStreak(monthBlocks, currentDate), [monthBlocks, currentDate]);
  const monthActiveDays = useMemo(() => new Set(monthBlocks.map((b) => b.recordDate)).size, [monthBlocks]);
  const weekAchievement = useMemo(() => computeDayAchievement(weekDates, blocks, goalMinutes), [weekDates, blocks, goalMinutes]);
  const weekMetDays = useMemo(() => weekAchievement.filter((d) => d.met).length, [weekAchievement]);

  return (
    <Sheet open={open} onClose={onClose} title="统计" testId="stats-sheet">
      {busy ? (
        <div className="stats-tip" data-testid="stats-loading">
          统计加载中…
        </div>
      ) : error ? (
        <div className="stats-tip stats-tip-error" data-testid="stats-error">
          <span>{error}</span>
          <button type="button" className="btn btn-ghost" onClick={onRetry} data-testid="stats-retry">
            重试
          </button>
        </div>
      ) : (
        <>
          <div className="seg stats-scope-seg" data-testid="stats-scope-seg">
            <button
              type="button"
              className={`seg-item ${statTab === 'day' ? 'seg-active' : ''}`}
              onClick={() => setStatTab('day')}
              data-testid="stats-tab-day"
            >
              当天
            </button>
            <button
              type="button"
              className={`seg-item ${statTab === 'week' ? 'seg-active' : ''}`}
              onClick={() => setStatTab('week')}
              data-testid="stats-tab-week"
            >
              本周
            </button>
            <button
              type="button"
              className={`seg-item ${statTab === 'month' ? 'seg-active' : ''}`}
              onClick={() => setStatTab('month')}
              data-testid="stats-tab-month"
            >
              本月
            </button>
            <button
              type="button"
              className={`seg-item ${statTab === 'custom' ? 'seg-active' : ''}`}
              onClick={() => setStatTab('custom')}
              data-testid="stats-tab-custom"
            >
              自定义
            </button>
          </div>

          {statTab === 'custom' && (
            <div className="stats-custom-block" data-testid="stats-custom-range">
              <div className="stats-custom-row">
                <span className="stats-custom-label">近</span>
                <input
                  type="number"
                  className="stats-custom-input"
                  value={daysDraft}
                  min={1}
                  max={365}
                  onChange={(e) => setDaysDraft(e.target.value)}
                  onBlur={commitDays}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitDays();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  data-testid="stats-custom-days"
                />
                <span className="stats-custom-label">天</span>
              </div>
              <div className="stats-custom-presets" data-testid="stats-custom-presets">
                {[7, 14, 30, 90].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`stats-custom-chip ${customDays === n ? 'stats-custom-chip-active' : ''}`}
                    onClick={() => onCustomDaysChange(n)}
                    data-testid={`stats-custom-preset-${n}`}
                  >
                    {n}天
                  </button>
                ))}
              </div>
              <p className="stats-custom-hint" data-testid="stats-custom-range-label">
                范围：{fmtDateCN(customRange[0])} 至 {fmtDateCN(customRange[1])}（共 {customDates.length} 天）
              </p>
            </div>
          )}

          <div className="stats-goal-card" data-testid="stats-goal-card">
            <div className="stats-goal-head">
              <Target size={16} strokeWidth={2} />
              <span>日均时长与目标对比</span>
            </div>
            {rangeAggregate.count === 0 ? (
              <div className="stats-empty">当前范围暂无时间块记录</div>
            ) : (
              <div className="stats-goal-body">
                <div className="stats-goal-row">
                  <div className="stats-goal-item">
                    <span className="stats-goal-label">日均时长</span>
                    <strong className="stats-goal-value" data-testid="stats-avg-duration">
                      {fmtDuration(avgMinutes)}
                    </strong>
                    <span className="stats-goal-sub">共{dayCount}天 · 活跃{activeDays}天</span>
                  </div>
                  <div className="stats-goal-item">
                    <span className="stats-goal-label">每日目标</span>
                    <strong className="stats-goal-value">{fmtDuration(goalMinutes)}</strong>
                    <span className="stats-goal-sub">目标{fmtDuration(goalMinutes)}/天</span>
                  </div>
                  <div className="stats-goal-item">
                    <span className="stats-goal-label">达成率</span>
                    <strong
                      className={`stats-goal-value ${goalRate >= 100 ? 'stats-goal-rate-ok' : ''}`}
                      data-testid="stats-goal-rate"
                    >
                      {Math.round(goalRate)}%
                    </strong>
                    <span className="stats-goal-sub">日均/目标</span>
                  </div>
                </div>
                <div className="stats-goal-bar">
                  <div
                    className="stats-goal-fill"
                    style={{
                      width: `${Math.min(100, goalRate)}%`,
                      background: goalRate >= 100 ? 'var(--success)' : 'var(--primary)',
                    }}
                  />
                </div>
                {goalRate >= 100 ? (
                  <p className="stats-goal-note stats-goal-note-ok" data-testid="stats-goal-done">
                    已达成目标，继续保持
                  </p>
                ) : (
                  <p className="stats-goal-note" data-testid="stats-goal-gap">
                    距离目标还差 {fmtDuration(goalMinutes - avgMinutes)} / 天
                  </p>
                )}
              </div>
            )}
            <div className="stats-goal-edit">
              <span className="stats-goal-edit-label">调整每日目标（分钟）</span>
              <div className="stats-goal-edit-row">
                <input
                  type="number"
                  className="stats-goal-input"
                  value={goalDraft}
                  min={1}
                  max={1440}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  onBlur={commitGoal}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      commitGoal();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  data-testid="goal-input"
                />
                <div className="stats-goal-presets" data-testid="goal-presets">
                  {GOAL_PRESETS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`stats-goal-chip ${goalMinutes === n ? 'stats-goal-chip-active' : ''}`}
                      onClick={() => {
                        setGoalMinutes(n);
                        setGoalDraft(String(n));
                        saveGoalMinutes(n);
                      }}
                      data-testid={`goal-preset-${n}`}
                    >
                      {fmtDuration(n)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="stats-insight-card" data-testid="stats-insight-card">
            <div className="stats-summary-head">
              <Clock3 size={16} strokeWidth={2} />
              <span>时间流向 · 24 小时分布（{rangeLabel}）</span>
            </div>
            {rangeAggregate.count === 0 ? (
              <div className="stats-empty">当前范围暂无时间块记录</div>
            ) : (
              <div className="stats-hourly" data-testid="stats-hourly">
                {hourDist.map((v, h) => (
                  <div key={h} className="stats-hour-col" title={`${h}时：${v > 0 ? fmtDuration(v) : '无记录'}`} data-testid={`stats-hour-${h}`}>
                    <div className="stats-hour-bar-wrap">
                      <div
                        className="stats-hour-bar"
                        style={{
                          height: `${hourPeak > 0 ? Math.max(4, (v / hourPeak) * 100) : 0}%`,
                          background: v > 0 ? 'var(--primary)' : 'var(--surface-2)',
                        }}
                      />
                    </div>
                    <span className="stats-hour-label">{h % 3 === 0 ? `${h}` : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="stats-donut-card" data-testid="stats-donut-card">
            <div className="stats-summary-head">
              <TrendingUp size={16} strokeWidth={2} />
              <span>标签占比环形图（{rangeLabel}）</span>
            </div>
            {rangeAggregate.count === 0 ? (
              <div className="stats-empty">当前范围暂无时间块记录</div>
            ) : (
              <div className="stats-donut-body">
                <DonutChart items={rangeAggregate.items} total={rangeAggregate.total} />
                <div className="stats-donut-legend" data-testid="stats-donut-legend">
                  {rangeAggregate.items.slice(0, 6).map((it) => (
                    <div key={it.tagId} className="stats-donut-legend-row">
                      <span className="tag-dot" style={{ background: it.color }} />
                      <span className="stats-donut-legend-name">{it.name}</span>
                      <span className="stats-donut-legend-val">
                        {fmtDuration(it.minutes)} · {it.pct.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                  {rangeAggregate.untagged > 0 && (
                    <div className="stats-donut-legend-row">
                      <span className="tag-dot" style={{ background: 'var(--text-3)' }} />
                      <span className="stats-donut-legend-name">未标记</span>
                      <span className="stats-donut-legend-val">
                        {fmtDuration(rangeAggregate.untagged)} · {rangeAggregate.untaggedPct.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="stats-trend-card" data-testid="stats-trend-card">
            <div className="stats-summary-head">
              <TrendingUp size={16} strokeWidth={2} />
              <span>按标签查看日均趋势（{rangeLabel}）</span>
            </div>
            <div className="stats-trend-chips" data-testid="stats-trend-tags">
              {trendTagOptions.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`stats-trend-chip ${trendTagId === o.id ? 'stats-trend-chip-active' : ''}`}
                  style={trendTagId === o.id && o.color ? { background: o.color, borderColor: o.color } : undefined}
                  onClick={() => setTrendTagId(o.id)}
                  data-testid={`stats-trend-tag-${o.id}`}
                >
                  {o.color && <span className="filter-dot" style={{ background: o.color }} />}
                  {o.name}
                </button>
              ))}
            </div>
            {rangeAggregate.count === 0 ? (
              <div className="stats-empty">当前范围暂无时间块记录</div>
            ) : trendTotal === 0 ? (
              <div className="stats-empty" data-testid="stats-trend-empty">
                该标签在范围内暂无记录
              </div>
            ) : (
              <>
                <div className="stats-goal-row">
                  <div className="stats-goal-item">
                    <span className="stats-goal-label">日均时长</span>
                    <strong className="stats-goal-value" data-testid="stats-trend-avg">
                      {fmtDuration(trendAvg)}
                    </strong>
                    <span className="stats-goal-sub">共{dayCount}天 · 合计{fmtDuration(trendTotal)}</span>
                  </div>
                  <div className="stats-goal-item">
                    <span className="stats-goal-label">活跃天数</span>
                    <strong className="stats-goal-value" data-testid="stats-trend-active">
                      {trendActiveDays} 天
                    </strong>
                    <span className="stats-goal-sub">有记录的日期</span>
                  </div>
                  <div className="stats-goal-item">
                    <span className="stats-goal-label">单日峰值</span>
                    <strong className="stats-goal-value" data-testid="stats-trend-peak">
                      {fmtDuration(trendPeak)}
                    </strong>
                    <span className="stats-goal-sub">范围内最多的一天</span>
                  </div>
                </div>
                <div className="stats-trend-chart" data-testid="stats-trend-chart">
                  {trendByDay.map((d) => (
                    <div
                      key={d.date}
                      className="stats-trend-col"
                      title={`${fmtDateCN(d.date)}：${d.minutes > 0 ? fmtDuration(d.minutes) : '无记录'}`}
                      data-testid={`stats-trend-day-${d.date}`}
                    >
                      <div className="stats-trend-bar-wrap">
                        <div
                          className="stats-trend-bar"
                          style={{
                            height: `${trendPeak > 0 ? Math.max(4, (d.minutes / trendPeak) * 100) : 0}%`,
                            background: d.minutes > 0 ? trendColor : 'var(--border)',
                          }}
                        />
                      </div>
                      <span className="stats-trend-day">{d.date.slice(8)}日</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {statTab !== 'day' && (
            <div className="stats-week-card" data-testid="stats-week-card">
              <div className="stats-summary-head">
                <TrendingUp size={16} strokeWidth={2} />
                <span>按周汇总趋势（{rangeLabel}）</span>
              </div>
              {rangeAggregate.count === 0 ? (
                <div className="stats-empty">当前范围暂无时间块记录</div>
              ) : weekTrendTotal === 0 ? (
                <div className="stats-empty" data-testid="stats-week-empty">
                  范围内没有可汇总的周记录
                </div>
              ) : (
                <>
                  <div className="stats-goal-row">
                    <div className="stats-goal-item">
                      <span className="stats-goal-label">共 {weekTrend.length} 周</span>
                      <strong className="stats-goal-value" data-testid="stats-week-total">
                        {fmtDuration(weekTrendTotal)}
                      </strong>
                      <span className="stats-goal-sub">合计时长</span>
                    </div>
                    <div className="stats-goal-item">
                      <span className="stats-goal-label">周均时长</span>
                      <strong className="stats-goal-value" data-testid="stats-week-avg">
                        {fmtDuration(weekTrendTotal / Math.max(1, weekTrend.length))}
                      </strong>
                      <span className="stats-goal-sub">按周平均</span>
                    </div>
                    <div className="stats-goal-item">
                      <span className="stats-goal-label">单周峰值</span>
                      <strong className="stats-goal-value" data-testid="stats-week-peak">
                        {fmtDuration(weekTrendPeak)}
                      </strong>
                      <span className="stats-goal-sub">最多的一周</span>
                    </div>
                  </div>
                  <div className="stats-trend-chart" data-testid="stats-week-chart">
                    {weekTrend.map((w) => (
                      <div
                        key={w.start}
                        className="stats-trend-col"
                        title={`${fmtDateCN(w.start)} 至 ${fmtDateCN(w.end)}：${w.totalMinutes > 0 ? fmtDuration(w.totalMinutes) : '无记录'}`}
                        data-testid={`stats-week-col-${w.start}`}
                      >
                        <div className="stats-trend-bar-wrap">
                          <div
                            className="stats-trend-bar"
                            style={{
                              height: `${weekTrendPeak > 0 ? Math.max(4, (w.totalMinutes / weekTrendPeak) * 100) : 0}%`,
                              background: w.totalMinutes > 0 ? 'var(--primary)' : 'var(--border)',
                            }}
                          />
                        </div>
                        <span className="stats-trend-day">{fmtDateCN(w.start)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="stats-week-export">
                    <button
                      type="button"
                      className="btn btn-ghost btn-block"
                      onClick={() => onExportTrend(statTab === 'month' ? 'month' : statTab === 'custom' ? 'custom' : 'week')}
                      disabled={exportingTrend}
                      data-testid="export-week-trend"
                    >
                      <Download size={15} strokeWidth={2} />
                      {exportingTrend ? '正在导出…' : '导出周趋势图（txt）'}
                    </button>
                    {exportTrendDone && (
                      <p className="stats-export-ok" data-testid="export-trend-done">
                        周趋势图已保存到本地文件
                      </p>
                    )}
                    {exportTrendError && (
                      <p className="stats-export-err" data-testid="export-trend-error">
                        {exportTrendError}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="stats-summary">
            <div className="stats-summary-head">
              <BarChart3 size={16} strokeWidth={2} />
              <span>
                {statTabLabel}标签占比（{rangeLabel}）
              </span>
            </div>
            {rangeAggregate.count === 0 ? (
              <div className="stats-empty" data-testid="stats-empty">
                当前范围暂无时间块记录
              </div>
            ) : (
              <>
                <div className="stats-summary-main">
                  {rangeAggregate.count} 个时间块 · 共 {fmtDuration(rangeAggregate.total)}
                </div>
                <div className="stats-tag-list">
                  {rangeAggregate.items.map((it) => (
                    <TagBarRow key={it.tagId} name={it.name} color={it.color} minutes={it.minutes} pct={it.pct} />
                  ))}
                  {rangeAggregate.untagged > 0 && (
                    <TagBarRow name="未标记" color="var(--text-3)" minutes={rangeAggregate.untagged} pct={rangeAggregate.untaggedPct} />
                  )}
                </div>
              </>
            )}
          </div>

          {statTab === 'week' &&
            dayStats.map((d) => (
              <div className="stats-day-card" key={d.date} data-testid={`stats-day-${d.date}`}>
                <div className="stats-day-head">
                  <span className="stats-day-label">
                    {fmtDateCN(d.date)} {d.weekdayLabel}
                  </span>
                  <span className="stats-day-min">
                    {d.count} 个 · {fmtDuration(d.totalMinutes)}
                  </span>
                </div>
                {d.items.length === 0 && d.untaggedMinutes === 0 ? (
                  <div className="stats-day-empty">当天无时间块</div>
                ) : (
                  <div className="stats-tag-list">
                    {d.items.map((it) => (
                      <TagBarRow key={it.tagId} name={it.name} color={it.color} minutes={it.minutes} pct={it.pct} />
                    ))}
                    {d.untaggedMinutes > 0 && (
                      <TagBarRow name="未标记" color="var(--text-3)" minutes={d.untaggedMinutes} pct={d.untaggedPct} />
                    )}
                  </div>
                )}
              </div>
            ))}

          {statTab === 'month' &&
            monthWeeks.map((w) => (
              <div className="stats-day-card" key={w.start} data-testid={`stats-week-${w.start}`}>
                <div className="stats-day-head">
                  <span className="stats-day-label">
                    {fmtDateCN(w.start)} - {fmtDateCN(w.end)}
                  </span>
                  <span className="stats-day-min">
                    {w.stat.count} 个 · {fmtDuration(w.stat.totalMinutes)}
                  </span>
                </div>
                {w.stat.items.length === 0 && w.stat.untaggedMinutes === 0 ? (
                  <div className="stats-day-empty">本周无时间块</div>
                ) : (
                  <div className="stats-tag-list">
                    {w.stat.items.map((it) => (
                      <TagBarRow key={it.tagId} name={it.name} color={it.color} minutes={it.minutes} pct={it.pct} />
                    ))}
                    {w.stat.untaggedMinutes > 0 && (
                      <TagBarRow name="未标记" color="var(--text-3)" minutes={w.stat.untaggedMinutes} pct={w.stat.untaggedPct} />
                    )}
                  </div>
                )}
              </div>
            ))}

          {statTab === 'custom' &&
            customWeeks.map((w) => (
              <div className="stats-day-card" key={w.start} data-testid={`stats-custom-week-${w.start}`}>
                <div className="stats-day-head">
                  <span className="stats-day-label">
                    {fmtDateCN(w.start)} - {fmtDateCN(w.end)}
                  </span>
                  <span className="stats-day-min">
                    {w.stat.count} 个 · {fmtDuration(w.stat.totalMinutes)}
                  </span>
                </div>
                {w.stat.items.length === 0 && w.stat.untaggedMinutes === 0 ? (
                  <div className="stats-day-empty">本周无时间块</div>
                ) : (
                  <div className="stats-tag-list">
                    {w.stat.items.map((it) => (
                      <TagBarRow key={it.tagId} name={it.name} color={it.color} minutes={it.minutes} pct={it.pct} />
                    ))}
                    {w.stat.untaggedMinutes > 0 && (
                      <TagBarRow name="未标记" color="var(--text-3)" minutes={w.stat.untaggedMinutes} pct={w.stat.untaggedPct} />
                    )}
                  </div>
                )}
              </div>
            ))}

          <div className="stats-habit-card" data-testid="stats-habit-card">
            <div className="stats-summary-head">
              <Flame size={16} strokeWidth={2} />
              <span>习惯连续性</span>
            </div>
            <div className="stats-goal-row">
              <div className="stats-goal-item">
                <span className="stats-goal-label">连续记录</span>
                <strong className="stats-goal-value" data-testid="stats-streak">
                  {streak} 天
                </strong>
                <span className="stats-goal-sub">截至今天</span>
              </div>
              <div className="stats-goal-item">
                <span className="stats-goal-label">本周达成</span>
                <strong className="stats-goal-value" data-testid="stats-week-met">
                  {weekMetDays}/{weekDates.length} 天
                </strong>
                <span className="stats-goal-sub">日均达到目标</span>
              </div>
              <div className="stats-goal-item">
                <span className="stats-goal-label">本月活跃</span>
                <strong className="stats-goal-value" data-testid="stats-month-active">
                  {monthActiveDays} 天
                </strong>
                <span className="stats-goal-sub">本月有记录</span>
              </div>
            </div>
            <div className="stats-week-strip" data-testid="stats-week-strip">
              {weekAchievement.map((d) => (
                <div
                  key={d.date}
                  className={`stats-week-strip-day ${d.met ? 'stats-week-strip-day-met' : d.minutes > 0 ? 'stats-week-strip-day-part' : ''}`}
                  title={`${fmtDateCN(d.date)}：${d.minutes > 0 ? fmtDuration(d.minutes) : '无记录'}${d.met ? ' · 已达标' : ''}`}
                >
                  <span className="stats-week-strip-label">{WEEKDAY_LABELS[weekdayIndexOf(d.date)]}</span>
                </div>
              ))}
            </div>
            <p className="stats-habit-note">连续记录按「当天至少 1 个时间块」计算；本周达成按日均时长达到目标计算。</p>
          </div>

          <div className="stats-report-card" data-testid="stats-report-card">
            <div className="stats-report-head">
              <ImageIcon size={16} strokeWidth={2} />
              <span>周报图片</span>
            </div>
            <div className="stats-report-summary">
              <span className="stats-report-summary-label">本周小结</span>
              <textarea
                className="stats-report-summary-input"
                rows={3}
                value={weekSummary}
                onChange={(e) => updateWeekSummary(e.target.value)}
                placeholder="写一句本周小结，会印在周报图片上（按周保存）"
                data-testid="stats-week-summary"
              />
              <button type="button" className="btn btn-ghost stats-report-fill" onClick={fillSummaryFromDaily} data-testid="stats-week-summary-fill">
                从每日小结汇总
              </button>
            </div>
            <div className="seg stats-report-seg" data-testid="report-scope-seg">
              <button
                type="button"
                className={`seg-item ${reportScope === 'week' ? 'seg-active' : ''}`}
                onClick={() => changeReportScope('week')}
                data-testid="report-scope-week"
              >
                本周
              </button>
              <button
                type="button"
                className={`seg-item ${reportScope === 'month' ? 'seg-active' : ''}`}
                onClick={() => changeReportScope('month')}
                data-testid="report-scope-month"
              >
                本月
              </button>
              <button
                type="button"
                className={`seg-item ${reportScope === 'custom' ? 'seg-active' : ''}`}
                onClick={() => changeReportScope('custom')}
                data-testid="report-scope-custom"
              >
                自定义
              </button>
            </div>
            <div className="seg stats-report-seg" data-testid="report-layout-seg">
              <button
                type="button"
                className={`seg-item ${reportLayout === 'classic' ? 'seg-active' : ''}`}
                onClick={() => changeReportLayout('classic')}
                data-testid="report-layout-classic"
              >
                经典
              </button>
              <button
                type="button"
                className={`seg-item ${reportLayout === 'minimal' ? 'seg-active' : ''}`}
                onClick={() => changeReportLayout('minimal')}
                data-testid="report-layout-minimal"
              >
                极简
              </button>
              <button
                type="button"
                className={`seg-item ${reportLayout === 'ranking' ? 'seg-active' : ''}`}
                onClick={() => changeReportLayout('ranking')}
                data-testid="report-layout-ranking"
              >
                榜单
              </button>
            </div>
            <p className="stats-report-hint" data-testid="report-range-label">
              {reportRangeLabel} 的标签汇总将渲染成主题风格海报，可切换版式，保存到相册直接发周报。
            </p>
            {reportDataUrl ? (
              <>
                <div className="stats-report-preview" data-testid="stats-report-preview">
                  <img src={reportDataUrl} alt="周报图片预览" />
                </div>
                <div className="stats-report-actions">
                  <button type="button" className="btn btn-primary" onClick={() => void saveReport()} disabled={reportBusy} data-testid="report-save">
                    <Save size={15} strokeWidth={2} /> 保存到相册
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => void shareReport()} disabled={reportSharing} data-testid="report-share">
                    <Share2 size={15} strokeWidth={2} /> 一键分享
                  </button>
                </div>
                <p className="stats-report-share-hint">分享当前应用给好友，周报图片与数据都在其中。</p>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => void genReport()}
                disabled={reportBusy}
                data-testid="report-generate"
              >
                <ImageIcon size={16} strokeWidth={2} />
                {reportBusy ? '正在生成…' : '生成周报图片'}
              </button>
            )}
            {reportError && (
              <p className="stats-export-err" data-testid="report-error">
                {reportError}
              </p>
            )}
            {reportSaved && (
              <p className="stats-export-ok" data-testid="report-saved">
                已保存到系统相册
              </p>
            )}
          </div>

          <div className="stats-export-card">
            <div className="stats-export-head">
              <FileText size={16} strokeWidth={2} />
              <span>导出时间块清单</span>
            </div>
            <div className="seg stats-export-seg" data-testid="export-scope-seg">
              <button
                type="button"
                className={`seg-item ${exportScope === 'week' ? 'seg-active' : ''}`}
                onClick={() => setExportScope('week')}
                data-testid="export-scope-week"
              >
                本周
              </button>
              <button
                type="button"
                className={`seg-item ${exportScope === 'month' ? 'seg-active' : ''}`}
                onClick={() => setExportScope('month')}
                data-testid="export-scope-month"
              >
                本月
              </button>
              <button
                type="button"
                className={`seg-item ${exportScope === 'custom' ? 'seg-active' : ''}`}
                onClick={() => setExportScope('custom')}
                data-testid="export-scope-custom"
              >
                自定义
              </button>
            </div>
            <div className="seg stats-export-seg" data-testid="export-format-seg">
              <button
                type="button"
                className={`seg-item ${exportFormat === 'detail' ? 'seg-active' : ''}`}
                onClick={() => setExportFormat('detail')}
                data-testid="export-format-detail"
              >
                按天明细
              </button>
              <button
                type="button"
                className={`seg-item ${exportFormat === 'tag' ? 'seg-active' : ''}`}
                onClick={() => setExportFormat('tag')}
                data-testid="export-format-tag"
              >
                按标签汇总
              </button>
            </div>
            <p className="stats-export-hint">
              {exportScope === 'week'
                ? `当前周（${fmtDateCN(weekDates[0])} 至 ${fmtDateCN(weekDates[6])}）`
                : exportScope === 'month'
                  ? `当前月（${fmtDateCN(monthRange[0])} 至 ${fmtDateCN(monthRange[1])}）`
                  : `自定义范围（${fmtDateCN(customRange[0])} 至 ${fmtDateCN(customRange[1])}，共 ${customDates.length} 天）`}
              {exportFormat === 'detail' ? '的全部时间块按天列出' : '按标签汇总时长、占比与明细'}，保存为 txt 文本。
            </p>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => onExport(exportScope, exportFormat)}
              disabled={exporting}
              data-testid="export-blocks"
            >
              <Download size={16} strokeWidth={2} />
              {exporting ? '正在导出…' : '导出文本清单'}
            </button>
            {exportDone && (
              <p className="stats-export-ok" data-testid="export-done">
                已保存到本地文件
              </p>
            )}
            {exportError && (
              <p className="stats-export-err" data-testid="export-error">
                {exportError}
              </p>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}