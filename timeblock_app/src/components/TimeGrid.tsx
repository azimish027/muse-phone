import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as RPointerEvent } from 'react';
import { Focus, Hand, LocateFixed, MousePointer2, Minus, Plus, RotateCw } from 'lucide-react';
import type { Granularity, Tag, TimeBlock, ViewMode } from '../types';
import {
  DAY_MINUTES,
  HOUR_HEIGHT,
  TIME_COL_WIDTH,
  WEEKDAY_LABELS,
  addDays,
  clamp,
  fmtDate,
  fmtDateCN,
  fmtMinute,
  getDateList,
  getWeekDates,
  getWeekStart,
  nowMinuteOfDay,
  snapMinute,
  todayStr,
} from '../lib/timeUtils';
import { scheduleDrag } from '../lib/scheduleDrag';

/** 画布逻辑尺寸：日视图单列宽度 / 周视图每列宽度 */
const DAY_CONTENT_WIDTH = 600;
const WEEK_COL_WIDTH = 210;
const MIN_SCALE = 0.35;
const MAX_SCALE = 2.5;
/** 初始/适应视图时希望垂直方向容纳的小时数 */
const FIT_HOURS = 10;
/** 画布缩放比例记忆 key */
const ZOOM_STORAGE_KEY = 'tb_canvas_zoom';

function loadSavedZoom(): number | null {
  try {
    const raw = window.localStorage.getItem(ZOOM_STORAGE_KEY);
    if (raw == null) return null;
    const v = Number.parseFloat(raw);
    if (!Number.isFinite(v) || v <= 0) return null;
    return clamp(v, MIN_SCALE, MAX_SCALE);
  } catch {
    return null;
  }
}

function saveZoom(scale: number) {
  try {
    window.localStorage.setItem(ZOOM_STORAGE_KEY, String(scale));
  } catch {
    // 忽略存储失败
  }
}

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

type DragState =
  | {
      type: 'create';
      dayIndex: number;
      pressMinute: number;
      startMinute: number;
      endMinute: number;
      moved: boolean;
    }
  | {
      type: 'move';
      blockId: string;
      origStart: number;
      origEnd: number;
      origDayIndex: number;
      pressMinute: number;
      curStart: number;
      curEnd: number;
      curDayIndex: number;
    }
  | {
      type: 'resize';
      blockId: string;
      edge: 'top' | 'bottom';
      origStart: number;
      origEnd: number;
      pressMinute: number;
      curStart: number;
      curEnd: number;
    }
  | null;

interface TimeGridProps {
  viewMode: ViewMode;
  granularity: Granularity;
  currentDate: string;
  weekDays: number;
  blocks: TimeBlock[];
  tags: Tag[];
  activeFilterId: string | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenEdit: (block: TimeBlock) => void;
  onOpenDraft: (date: string, startMinute: number, endMinute: number) => void;
  onOpenQuickAt: (date: string, startMinute: number, endMinute: number) => void;
  onMove: (blockId: string, date: string, startMinute: number, endMinute: number) => void;
  onResize: (blockId: string, startMinute: number, endMinute: number) => void;
  /** 周视图中滚动定位到今天：今天不在当前范围时先切换日期再定位 */
  onGoToday?: () => void;
  /** 周视图已向前扩展的天数（更早记录），用于列头渲染 */
  weekExtra?: number;
  /** 周视图横向滚动到最左端（更早方向）时触发，用于自动加载更早记录 */
  onLoadEarlier?: () => void;
  /** 从每日面板拖拽任务到画布排期 */
  onDropSchedule?: (title: string, date: string, startMinute: number, endMinute: number) => void;
}

function vibrate() {
  window.lingguang?.vibrate?.({ mode: 'short', intensity: 'light' });
}

function blockMatchesFilter(block: TimeBlock, filterId: string | null, tags: Tag[]): boolean {
  if (!filterId) return true;
  if (!block.tagId) return false;
  if (block.tagId === filterId) return true;
  const tag = tags.find((t) => t.id === filterId);
  if (tag && !tag.parentId) {
    return tags.some((t) => t.parentId === filterId && t.id === block.tagId);
  }
  return false;
}

export function TimeGrid({
  viewMode,
  granularity,
  currentDate,
  weekDays,
  blocks,
  tags,
  activeFilterId,
  loading,
  error,
  onRetry,
  onOpenEdit,
  onOpenDraft,
  onOpenQuickAt,
  onMove,
  onResize,
  onGoToday,
  weekExtra = 0,
  onLoadEarlier,
  onDropSchedule,
}: TimeGridProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);
  const lastSnapRef = useRef('');
  const [drag, setDrag] = useState<DragState>(null);
  const [nowMinute, setNowMinute] = useState<number>(() => nowMinuteOfDay());
  /** 画布视口：content 原点相对容器的偏移 + 缩放 */
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  /** false = 编辑模式（拖拽创建/移动/缩放时间块）；true = 平移模式（拖动浏览画布） */
  const [panMode, setPanMode] = useState(false);
  const [panHint, setPanHint] = useState(false);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; center: { x: number; y: number }; viewport: Viewport } | null>(null);
  const panDownRef = useRef<{ x: number; y: number; blockId: string | null } | null>(null);
  /** 平移惯性：惯性动画帧 + 最近移动速度 + 最近一次移动点 */
  const inertiaRef = useRef<{ raf: number; vx: number; vy: number } | null>(null);
  const panMoveRef = useRef<{ t: number; x: number; y: number } | null>(null);
  const velocityRef = useRef<{ vx: number; vy: number } | null>(null);
  const panHintTimer = useRef<number | null>(null);

  const dates = useMemo(() => {
    if (viewMode === 'day') return [currentDate];
    const ws = getWeekStart(new Date(`${currentDate}T00:00:00`));
    const extra = Math.max(0, weekExtra);
    const start = fmtDate(addDays(ws, -extra));
    const end = fmtDate(addDays(ws, Math.max(1, weekDays) - 1));
    return getDateList(start, end);
  }, [viewMode, currentDate, weekDays, weekExtra]);
  const today = todayStr();
  const colCount = dates.length;
  const contentWidth = viewMode === 'day' ? DAY_CONTENT_WIDTH : WEEK_COL_WIDTH * colCount;

  useEffect(() => {
    const timer = window.setInterval(() => setNowMinute(nowMinuteOfDay()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  /** 停止惯性动画 */
  const stopInertia = () => {
    if (inertiaRef.current) {
      cancelAnimationFrame(inertiaRef.current.raf);
      inertiaRef.current = null;
    }
  };

  /** 松手后按当前速度继续滑动，逐帧衰减直至停止 */
  const startInertia = (vx: number, vy: number) => {
    stopInertia();
    const DECAY = 0.94;
    const MIN_SPEED = 0.4;
    const tick = () => {
      setViewport((v) => ({ ...v, x: v.x + vx, y: v.y + vy }));
      vx *= DECAY;
      vy *= DECAY;
      if (Math.abs(vx) < MIN_SPEED && Math.abs(vy) < MIN_SPEED) {
        inertiaRef.current = null;
        return;
      }
      inertiaRef.current = { raf: requestAnimationFrame(tick), vx, vy };
    };
    inertiaRef.current = { raf: requestAnimationFrame(tick), vx, vy };
  };

  /** 切换平移模式时短暂提示可拖动与惯性 */
  const togglePan = (on: boolean) => {
    setPanMode(on);
    if (on) {
      setPanHint(true);
      if (panHintTimer.current) window.clearTimeout(panHintTimer.current);
      panHintTimer.current = window.setTimeout(() => setPanHint(false), 1800);
    }
  };

  useEffect(() => {
    return () => {
      if (inertiaRef.current) cancelAnimationFrame(inertiaRef.current.raf);
      if (panHintTimer.current) window.clearTimeout(panHintTimer.current);
    };
  }, []);

  /** 让画布初始呈现约 FIT_HOURS 小时，水平居中，0 点位于视口上方约 2 小时处；
   *  preferSaved=true 时优先沿用记忆的缩放比例 */
  const fitView = (preferSaved = false) => {
    const el = canvasRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w <= 0 || h <= 0) return;
    const saved = preferSaved ? loadSavedZoom() : null;
    const scale = saved ?? clamp(h / (FIT_HOURS * HOUR_HEIGHT), MIN_SCALE, 1);
    setViewport({
      x: (w - contentWidth * scale) / 2,
      y: -2 * HOUR_HEIGHT * scale,
      scale,
    });
  };

  useLayoutEffect(() => {
    fitView(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, weekDays]);

  /** 缩放比例变化时记忆保存，下次打开继续沿用 */
  useEffect(() => {
    saveZoom(viewport.scale);
  }, [viewport.scale]);

  /** 屏幕坐标（相对容器）转画布内容坐标 */
  const canvasXY = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - viewport.x) / viewport.scale,
      y: (clientY - rect.top - viewport.y) / viewport.scale,
    };
  };

  const minuteFromCanvasY = (cy: number): number => {
    return clamp(Math.round((cy / HOUR_HEIGHT) * 60), 0, DAY_MINUTES);
  };

  const dayIndexFromCanvasX = (cx: number): number => {
    if (viewMode === 'day') return 0;
    const colW = (contentWidth - TIME_COL_WIDTH) / colCount;
    if (colW <= 0) return 0;
    return clamp(Math.floor((cx - TIME_COL_WIDTH) / colW), 0, colCount - 1);
  };

  const handlePointerDown = (e: RPointerEvent) => {
    stopInertia();
    panMoveRef.current = null;
    const canvas = e.currentTarget as HTMLElement;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // 忽略捕获失败
    }
    const target = (e.target as HTMLElement).closest('[data-block-id]') as HTMLElement | null;
    const blockId = target?.dataset.blockId ?? null;
    // 双指：进入捏合缩放 + 平移
    if (pointersRef.current.size >= 2) {
      panDownRef.current = null;
      dragRef.current = null;
      setDrag(null);
      lastSnapRef.current = '';
      const pts = [...pointersRef.current.values()];
      pinchRef.current = {
        dist: Math.max(Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), 1),
        center: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        viewport,
      };
      return;
    }
    if (loading) return;
    if (panMode) {
      panDownRef.current = { x: e.clientX, y: e.clientY, blockId };
      return;
    }
    const { y: cy, x: cx } = canvasXY(e.clientX, e.clientY);
    const minute = snapMinute(minuteFromCanvasY(cy), granularity);
    if (target) {
      const blockIdStr = target.dataset.blockId ?? '';
      const block = blocks.find((b) => b.id === blockIdStr);
      if (!block) return;
      const edge = target.dataset.edge as 'top' | 'bottom' | undefined;
      const dateIdx = dates.indexOf(block.recordDate);
      if (edge === 'top' || edge === 'bottom') {
        const st: DragState = {
          type: 'resize',
          blockId: blockIdStr,
          edge,
          origStart: block.startMinute,
          origEnd: block.endMinute,
          pressMinute: minute,
          curStart: block.startMinute,
          curEnd: block.endMinute,
        };
        dragRef.current = st;
        setDrag(st);
      } else {
        const st: DragState = {
          type: 'move',
          blockId: blockIdStr,
          origStart: block.startMinute,
          origEnd: block.endMinute,
          origDayIndex: dateIdx < 0 ? 0 : dateIdx,
          pressMinute: minute,
          curStart: block.startMinute,
          curEnd: block.endMinute,
          curDayIndex: dateIdx < 0 ? 0 : dateIdx,
        };
        dragRef.current = st;
        setDrag(st);
      }
      vibrate();
    } else {
      const dayIndex = dayIndexFromCanvasX(cx);
      const st: DragState = {
        type: 'create',
        dayIndex,
        pressMinute: minute,
        startMinute: minute,
        endMinute: Math.min(minute + granularity, DAY_MINUTES),
        moved: false,
      };
      dragRef.current = st;
      setDrag(st);
      vibrate();
    }
  };

  /** 每日面板任务拖到画布：按落点换算日期与时间，交给上层打开快速添加 */
  const [schedulePreview, setSchedulePreview] = useState<{ dayIndex: number; startMinute: number; endMinute: number; title: string } | null>(null);

  const handlePointerMove = (e: RPointerEvent) => {
    // 外部任务拖拽排期：优先展示落点预览
    if (scheduleDrag.active) {
      const { y: cy, x: cx } = canvasXY(e.clientX, e.clientY);
      const minute = snapMinute(minuteFromCanvasY(cy), granularity);
      const dayIndex = dayIndexFromCanvasX(cx);
      const start = Math.min(minute, DAY_MINUTES - granularity);
      setSchedulePreview({
        dayIndex,
        startMinute: start,
        endMinute: Math.min(start + granularity, DAY_MINUTES),
        title: scheduleDrag.title,
      });
      return;
    }
    const prev = pointersRef.current.get(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // 双指捏合缩放（保持两指中点对应的画布位置不动）
    if (pointersRef.current.size >= 2) {
      const p = pinchRef.current;
      if (!p) return;
      const pts = [...pointersRef.current.values()];
      const dist = Math.max(Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), 1);
      const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const nextScale = clamp(p.viewport.scale * (dist / p.dist), MIN_SCALE, MAX_SCALE);
      const k = nextScale / p.viewport.scale;
      setViewport({
        x: center.x - (p.center.x - p.viewport.x) * k,
        y: center.y - (p.center.y - p.viewport.y) * k,
        scale: nextScale,
      });
      return;
    }
    // 平移模式：单指拖动平移画布，并记录最近移动速度供惯性使用
    if (panMode) {
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (dx === 0 && dy === 0) return;
      setViewport((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      const nowT = performance.now();
      const last = panMoveRef.current;
      if (last && nowT - last.t < 120) {
        const dt = Math.max(nowT - last.t, 8);
        velocityRef.current = { vx: (e.clientX - last.x) / dt, vy: (e.clientY - last.y) / dt };
      } else {
        velocityRef.current = { vx: 0, vy: 0 };
      }
      panMoveRef.current = { t: nowT, x: e.clientX, y: e.clientY };
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    const { y: cy, x: cx } = canvasXY(e.clientX, e.clientY);
    const minute = snapMinute(minuteFromCanvasY(cy), granularity);
    const dayIndex = dayIndexFromCanvasX(cx);
    let next: DragState = d;
    let snapKey = '';
    if (d.type === 'create') {
      const s = Math.min(d.pressMinute, minute);
      const en = clamp(Math.max(d.pressMinute, minute), s + granularity, DAY_MINUTES);
      next = { ...d, startMinute: s, endMinute: en, moved: d.moved || minute !== d.pressMinute };
      snapKey = `${s}-${next.endMinute}`;
    } else if (d.type === 'move') {
      const offset = minute - d.pressMinute;
      const dur = d.origEnd - d.origStart;
      let ns = d.origStart + offset;
      ns = clamp(ns, 0, DAY_MINUTES - dur);
      ns = snapMinute(ns, granularity);
      ns = clamp(ns, 0, DAY_MINUTES - dur);
      next = { ...d, curStart: ns, curEnd: ns + dur, curDayIndex: dayIndex };
      snapKey = `${ns}-${next.curEnd}-${dayIndex}`;
    } else {
      const offset = minute - d.pressMinute;
      if (d.edge === 'bottom') {
        const ne = clamp(snapMinute(d.origEnd + offset, granularity), d.origStart + granularity, DAY_MINUTES);
        next = { ...d, curEnd: ne };
        snapKey = `${ne}`;
      } else {
        const ns = clamp(snapMinute(d.origStart + offset, granularity), 0, d.origEnd - granularity);
        next = { ...d, curStart: ns };
        snapKey = `${ns}`;
      }
    }
    if (snapKey !== lastSnapRef.current) {
      lastSnapRef.current = snapKey;
      vibrate();
    }
    dragRef.current = next;
    setDrag(next);
  };

  const handlePointerUp = (e: RPointerEvent) => {
    // 外部任务拖拽结束：在画布上松手即排期
    if (scheduleDrag.active) {
      const title = scheduleDrag.title;
      const { y: cy, x: cx } = canvasXY(e.clientX, e.clientY);
      const minute = snapMinute(minuteFromCanvasY(cy), granularity);
      const dayIndex = dayIndexFromCanvasX(cx);
      const start = Math.min(minute, DAY_MINUTES - granularity);
      scheduleDrag.active = false;
      scheduleDrag.title = '';
      setSchedulePreview(null);
      if (title.trim() && onDropSchedule) {
        onDropSchedule(title, dates[dayIndex], start, Math.min(start + granularity, DAY_MINUTES));
      }
      return;
    }
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (panMode) {
      const p = panDownRef.current;
      panDownRef.current = null;
      panMoveRef.current = null;
      if (!p) return;
      const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      if (dist < 6 && p.blockId) {
        const block = blocks.find((b) => b.id === p.blockId);
        if (block) onOpenEdit(block);
      }
      // 惯性浏览：松手时速度足够快则继续滑动减速
      const v = velocityRef.current;
      velocityRef.current = null;
      if (v && (Math.abs(v.vx) > 0.3 || Math.abs(v.vy) > 0.3)) {
        startInertia(v.vx * 16, v.vy * 16);
      }
      return;
    }
    const d = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    lastSnapRef.current = '';
    if (!d) return;
    if (d.type === 'create') {
      const dur = d.endMinute - d.startMinute;
      const dateStr = dates[d.dayIndex];
      if (d.moved && dur >= granularity) {
        onOpenDraft(dateStr, d.startMinute, d.endMinute);
      } else {
        const s = Math.min(snapMinute(d.pressMinute, granularity), DAY_MINUTES - granularity);
        onOpenQuickAt(dateStr, s, Math.min(s + granularity, DAY_MINUTES));
      }
    } else if (d.type === 'move') {
      if (d.curStart === d.origStart && d.curEnd === d.origEnd && d.curDayIndex === d.origDayIndex) {
        const block = blocks.find((b) => b.id === d.blockId);
        if (block) onOpenEdit(block);
        return;
      }
      const dateStr = dates[d.curDayIndex];
      onMove(d.blockId, dateStr, d.curStart, d.curEnd);
    } else {
      if (d.curStart === d.origStart && d.curEnd === d.origEnd) {
        const block = blocks.find((b) => b.id === d.blockId);
        if (block) onOpenEdit(block);
        return;
      }
      onResize(d.blockId, d.curStart, d.curEnd);
    }
  };

  const handlePointerCancel = () => {
    if (scheduleDrag.active) {
      scheduleDrag.active = false;
      scheduleDrag.title = '';
    }
    setSchedulePreview(null);
    pointersRef.current.clear();
    pinchRef.current = null;
    panDownRef.current = null;
    panMoveRef.current = null;
    velocityRef.current = null;
    dragRef.current = null;
    setDrag(null);
    lastSnapRef.current = '';
  };

  /** 把画布水平居中到指定列，垂直定位到当前时间 */
  const panToTodayIndex = (idx: number) => {
    const el = canvasRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const colW = (contentWidth - TIME_COL_WIDTH) / colCount;
    const colCenter = TIME_COL_WIDTH + idx * colW + colW / 2;
    const nowY = (nowMinuteOfDay() / 60) * HOUR_HEIGHT;
    setViewport((v) => ({
      ...v,
      x: w / 2 - colCenter * v.scale,
      y: h / 2 - nowY * v.scale,
    }));
  };

  /** 周视图“滚动到今天”：今天在范围内直接定位，不在则先切到今天所在周再定位 */
  const goToTodayColumn = () => {
    const idx = dates.indexOf(todayStr());
    if (idx >= 0) {
      panToTodayIndex(idx);
      return;
    }
    onGoToday?.();
    window.setTimeout(() => {
      const targetDates = getWeekDates(todayStr(), weekDays);
      const targetIdx = targetDates.indexOf(todayStr());
      if (targetIdx >= 0) panToTodayIndex(targetIdx);
    }, 80);
  };

  const zoomBy = (factor: number) => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const nextScale = clamp(viewport.scale * factor, MIN_SCALE, MAX_SCALE);
    const k = nextScale / viewport.scale;
    setViewport({
      x: cx - rect.left - (cx - rect.left - viewport.x) * k,
      y: cy - rect.top - (cy - rect.top - viewport.y) * k,
      scale: nextScale,
    });
  };

  /** 触底自动加载更早记录：内容右边缘贴近视口右缘（最左端可见）时触发一次，
   *  范围扩展后重新武装，用户继续向左拖动才会再次触发 */
  const earlierTriggeredRef = useRef(false);
  useEffect(() => {
    earlierTriggeredRef.current = false;
  }, [viewMode, dates.length]);
  useEffect(() => {
    if (viewMode !== 'week' || !onLoadEarlier) return;
    const el = canvasRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const cw = contentWidth * viewport.scale;
    if (cw <= w + 2) return;
    if (viewport.x + cw <= w + 2 && !earlierTriggeredRef.current) {
      earlierTriggeredRef.current = true;
      onLoadEarlier();
    }
  }, [viewport, contentWidth, viewMode, onLoadEarlier]);

  const minorStep = granularity < 30 ? granularity : 0;
  const minorCount = minorStep ? Math.floor(DAY_MINUTES / minorStep) : 0;
  const halfHour = HOUR_HEIGHT / 2;

  const previewBlock = (() => {
    if (!drag) return null;
    if (drag.type === 'create') {
      return {
        dayIndex: drag.dayIndex,
        start: drag.startMinute,
        end: drag.endMinute,
      };
    }
    if (drag.type === 'move') {
      return { dayIndex: drag.curDayIndex, start: drag.curStart, end: drag.curEnd };
    }
    const block = blocks.find((b) => b.id === drag.blockId);
    const dayIndex = block ? dates.indexOf(block.recordDate) : 0;
    return { dayIndex: dayIndex < 0 ? 0 : dayIndex, start: drag.curStart, end: drag.curEnd };
  })();

  const isDraggingBlock = (id: string) => drag?.type === 'move' && drag.blockId === id;
  const isResizingBlock = (id: string) => drag?.type === 'resize' && drag.blockId === id;

  return (
    <div
      className={`tg-canvas ${panMode ? 'tg-canvas-pan' : 'tg-canvas-edit'}`}
      data-testid="time-grid-scroll"
      ref={canvasRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* 画布内容：整体随视口平移缩放 */}
      <div
        className="tg-content"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          transformOrigin: '0 0',
          width: contentWidth,
        }}
      >
        {viewMode === 'week' && (
          <div className="tg-weekhead" onPointerDown={(e) => e.stopPropagation()}>
            <div className="tg-weekhead-time" />
            {dates.map((d, i) => (
              <div key={d} className={`tg-weekhead-col ${d === today ? 'tg-weekhead-today' : ''} ${i > 0 && i % 7 === 0 ? 'tg-weekhead-weekstart' : ''}`} data-testid={`week-head-${i}`}>
                <span className="tg-weekhead-week">周{WEEKDAY_LABELS[i % 7]}</span>
                <span className="tg-weekhead-date">{fmtDateCN(d)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="tg-body" ref={bodyRef}>
          <div className="tg-timecol" onPointerDown={(e) => e.stopPropagation()}>
            {Array.from({ length: 48 }, (_, i) => (
              <div
                key={i}
                className={`tg-tick ${i % 2 === 0 ? 'tg-tick-hour' : ''} ${Math.floor(i / 2) === Math.floor(nowMinute / 60) ? 'tg-tick-now' : ''}`}
                style={{ top: i * halfHour - 9 }}
              >
                {fmtMinute(i * 30)}
              </div>
            ))}
          </div>
          <div
            className={`tg-grid ${viewMode === 'week' ? 'tg-grid-week' : 'tg-grid-day'}`}
            style={{ width: contentWidth - TIME_COL_WIDTH }}
            data-testid="time-grid-canvas"
          >
            {/* 当前小时整行高亮（仅今天列） */}
            {dates.map((d, i) =>
              d === today ? (
                <div key={`nh${i}`} className="tg-nowhour" style={{ top: Math.floor(nowMinute / 60) * HOUR_HEIGHT, height: HOUR_HEIGHT }} />
              ) : null,
            )}
            {/* 主格线 30 分钟 */}
            {Array.from({ length: 48 }, (_, i) => (
              <div key={`m${i}`} className="tg-line-major" style={{ top: i * halfHour }} />
            ))}
            {/* 细颗粒度辅助线 */}
            {minorStep > 0 &&
              Array.from({ length: minorCount }, (_, i) => {
                const top = (i * minorStep * HOUR_HEIGHT) / 60;
                if (top % halfHour === 0) return null;
                return <div key={`n${i}`} className="tg-line-minor" style={{ top }} />;
              })}
            {/* 列分隔 + 周边界 */}
            {viewMode === 'week' &&
              Array.from({ length: colCount }, (_, i) => (
                <div key={`c${i}`} className="tg-colsep" style={{ left: `${(i * 100) / colCount}%` }} />
              ))}
            {viewMode === 'week' &&
              Array.from({ length: colCount }, (_, i) =>
                i > 0 && i % 7 === 0 ? (
                  <div key={`w${i}`} className="tg-weeksep" style={{ left: `${(i * 100) / colCount}%` }} />
                ) : null,
              )}
            {/* 当前时间红线（仅今天列） */}
            {dates.map((d, i) =>
              d === today ? <div key={`now${i}`} className="tg-nowline" style={{ top: (nowMinute * HOUR_HEIGHT) / 60 }} /> : null,
            )}
            {/* 事件块 */}
            {dates.map((d, i) => {
              const colBlocks = blocks.filter((b) => b.recordDate === d);
              return (
                <div
                  key={d}
                  className="tg-col"
                  style={{ left: viewMode === 'day' ? 0 : `${(i * 100) / colCount}%`, width: viewMode === 'day' ? '100%' : `${100 / colCount}%` }}
                >
                  {colBlocks.map((b) => {
                    const tag = b.tagId ? tags.find((t) => t.id === b.tagId) : undefined;
                    const color = tag?.color ?? '#6B7280';
                    const matched = blockMatchesFilter(b, activeFilterId, tags);
                    const dragging = isDraggingBlock(b.id) || isResizingBlock(b.id);
                    const dim = !matched || dragging;
                    const isZone = !!b.zoneMode;
                    const zoneColor = (b.zoneColor && b.zoneColor.trim()) || color;
                    const top = (b.startMinute / 60) * HOUR_HEIGHT;
                    const height = Math.max(((b.endMinute - b.startMinute) / 60) * HOUR_HEIGHT, (granularity / 60) * HOUR_HEIGHT);
                    const style: CSSProperties = {
                      top,
                      height,
                      '--tag-color': zoneColor,
                    } as CSSProperties;
                    const zoneName = (b.zoneName && b.zoneName.trim()) || b.title;
                    return (
                      <div
                        key={b.id}
                        className={`tb-block ${isZone ? 'tb-block-zone' : ''} ${dim ? 'tb-block-dim' : ''} ${dragging ? 'tb-block-dragging' : ''}`}
                        style={style}
                        data-block-id={b.id}
                        data-testid={`block-${b.id}`}
                      >
                        {isZone ? (
                          <>
                            <div className="tb-zone-body">
                              <div className="tb-block-title">{zoneName}</div>
                              {b.zoneNote && b.zoneNote.trim() && height >= HOUR_HEIGHT * 0.85 && <div className="tb-zone-note">{b.zoneNote.trim()}</div>}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="tb-block-bar" style={{ background: color }} />
                            <div className="tb-block-body">
                              <div className="tb-block-title">{b.title}</div>
                              {tag && height >= HOUR_HEIGHT * 1.4 && (
                                <div className="tb-block-tag">
                                  <span className="tb-block-tagdot" style={{ background: color }} />
                                  <span className="tb-block-tagname">{tag.name}</span>
                                </div>
                              )}
                              {height >= HOUR_HEIGHT * 1.1 && <div className="tb-block-time">{fmtMinute(b.startMinute)}-{fmtMinute(b.endMinute)}</div>}
                            </div>
                          </>
                        )}
                        <div className="tb-handle tb-handle-top" data-block-id={b.id} data-edge="top" />
                        <div className="tb-handle tb-handle-bottom" data-block-id={b.id} data-edge="bottom" />
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {/* 外部任务拖拽排期预览 */}
            {schedulePreview && (
              <div
                className="tb-block tb-preview"
                style={{
                  left: viewMode === 'day' ? 0 : `${(schedulePreview.dayIndex * 100) / colCount}%`,
                  width: viewMode === 'day' ? '100%' : `${100 / colCount}%`,
                  top: (schedulePreview.startMinute / 60) * HOUR_HEIGHT,
                  height: Math.max(((schedulePreview.endMinute - schedulePreview.startMinute) / 60) * HOUR_HEIGHT, (granularity / 60) * HOUR_HEIGHT),
                }}
                data-testid="schedule-preview"
              >
                <div className="tb-block-bar" />
                <div className="tb-block-body">
                  <div className="tb-block-title">{schedulePreview.title}</div>
                  <div className="tb-block-time">
                    {fmtMinute(schedulePreview.startMinute)}-{fmtMinute(schedulePreview.endMinute)}
                  </div>
                </div>
              </div>
            )}
            {/* 拖拽预览 */}
            {previewBlock && (
              <div
                className="tb-block tb-preview"
                style={{
                  left: viewMode === 'day' ? 0 : `${(previewBlock.dayIndex * 100) / colCount}%`,
                  width: viewMode === 'day' ? '100%' : `${100 / colCount}%`,
                  top: (previewBlock.start / 60) * HOUR_HEIGHT,
                  height: Math.max(((previewBlock.end - previewBlock.start) / 60) * HOUR_HEIGHT, (granularity / 60) * HOUR_HEIGHT),
                }}
                data-testid="drag-preview"
              >
                <div className="tb-block-bar" />
                <div className="tb-block-body">
                  <div className="tb-block-title">新时间块</div>
                  <div className="tb-block-time">{fmtMinute(previewBlock.start)}-{fmtMinute(previewBlock.end)}</div>
                </div>
              </div>
            )}
            {/* 加载骨架 */}
            {loading && (
              <div className="tg-overlay" data-testid="grid-loading">
                <div className="tg-skeleton-line" style={{ top: 320 }} />
                <div className="tg-skeleton-line" style={{ top: 440 }} />
                <div className="tg-skeleton-line" style={{ top: 560 }} />
              </div>
            )}
            {/* 空态提示 */}
            {!loading && !error && blocks.length === 0 && !drag && (
              <div className="tg-empty" data-testid="grid-empty">
                <p>拖动创建时间块，或使用快速添加</p>
              </div>
            )}
          </div>
        </div>
        {error && (
          <div className="tg-errorbar" data-testid="grid-error" onPointerDown={(e) => e.stopPropagation()}>
            <span>{error}</span>
            <button type="button" className="tg-retry" onClick={onRetry} data-testid="grid-retry">
              <RotateCw size={14} strokeWidth={2} /> 重试
            </button>
          </div>
        )}
      </div>

      {/* 平移模式提示 */}
      {panHint && (
        <div className="tg-pan-hint" data-testid="pan-hint">
          拖动浏览画布，松手带惯性
        </div>
      )}

      {/* 已加载更早记录提示 */}
      {viewMode === 'week' && weekExtra > 0 && (
        <div className="tg-early-badge" data-testid="week-early-badge">
          已自动加载更早 {weekExtra} 天，向左拖动继续加载
        </div>
      )}

      {/* 画布悬浮控件 */}
      <div className="tg-controls" data-testid="canvas-controls" onPointerDown={(e) => e.stopPropagation()}>
        {viewMode === 'week' && (
          <div className="tg-today-ctl" data-testid="week-scroll-today-wrap">
            <button
              type="button"
              className="tg-ctl-btn"
              onClick={goToTodayColumn}
              aria-label="滚动到今天"
              data-testid="week-scroll-today"
            >
              <LocateFixed size={16} strokeWidth={2} />
            </button>
          </div>
        )}
        <div className="tg-mode-toggle" role="group" aria-label="画布模式" data-testid="canvas-mode">
          <button
            type="button"
            className={`tg-mode-btn ${!panMode ? 'tg-mode-active' : ''}`}
            onClick={() => togglePan(false)}
            aria-label="编辑模式"
            data-testid="mode-edit"
          >
            <MousePointer2 size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={`tg-mode-btn ${panMode ? 'tg-mode-active' : ''}`}
            onClick={() => togglePan(true)}
            aria-label="平移模式"
            data-testid="mode-pan"
          >
            <Hand size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="tg-zoom" role="group" aria-label="画布缩放" data-testid="canvas-zoom">
          <button type="button" className="tg-ctl-btn" onClick={() => zoomBy(1 / 1.25)} aria-label="缩小" data-testid="zoom-out">
            <Minus size={16} strokeWidth={2} />
          </button>
          <button type="button" className="tg-zoom-pct" onClick={() => fitView()} aria-label="适应视图" data-testid="zoom-fit">
            {Math.round(viewport.scale * 100)}%
          </button>
          <button type="button" className="tg-ctl-btn" onClick={() => zoomBy(1.25)} aria-label="放大" data-testid="zoom-in">
            <Plus size={16} strokeWidth={2} />
          </button>
          <button type="button" className="tg-ctl-btn" onClick={() => fitView()} aria-label="适应视图" data-testid="zoom-fit-icon">
            <Focus size={15} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}