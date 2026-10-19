import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as RPointerEvent, TouchEvent as RTouchEvent } from 'react';
import {
  CalendarHeart,
  CheckCircle2,
  ChevronDown,
  Circle,
  CloudSun,
  GripVertical,
  History,
  LocateFixed,
  MapPin,
  Mic,
  Pin,
  Plus,
  RefreshCw,
  Share2,
  SmilePlus,
  Sparkles,
  Square,
  Trash2,
} from 'lucide-react';
import type { DailyPanel, DailyTask, Granularity } from '../types';
import { buildHistoryList, buildPanelShareText, emptyPanel, loadPanel, loadWeatherCity, savePanel, saveWeatherCity } from '../lib/dailyPanel';
import { scheduleDrag } from '../lib/scheduleDrag';
import { DAY_MINUTES, clamp, fmtDateCN, snapMinute, todayStr } from '../lib/timeUtils';
import { loadStickerLib, moodOptions, panelForText, plainStickerText, resolveSticker, saveStickerLib, taskOptions } from '../lib/stickers';
import type { StickerLib, StickerOption } from '../lib/stickers';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { StickerLibSheet } from './StickerLibSheet';

const KAOMOJIS = ['(・∀・)', '٩(◕‿◕)۶', '(*´∀`*)', 'Σ(ﾟДﾟ)', '(￣▽￣)~*', '◉‿◉', '(｡•̀ᴗ-)✧', '╰(*°▽°*)╯'];

const DB_ZOOM_KEY = 'tb_db_zoom';

function loadDbZoom(): number {
  try {
    const v = window.localStorage.getItem(DB_ZOOM_KEY);
    if (v) {
      const n = Number.parseFloat(v);
      if (Number.isFinite(n)) return clamp(Math.round(n * 100) / 100, 0.8, 1.7);
    }
  } catch {
    // 忽略读取失败
  }
  return 1;
}

function saveDbZoom(z: number) {
  try {
    window.localStorage.setItem(DB_ZOOM_KEY, String(z));
  } catch {
    // 忽略存储失败
  }
}

interface WeatherInfo {
  city: string;
  condition: string;
  temperatureC: number | null;
  tempHighC: number | null;
  tempLowC: number | null;
  humidityPercent: number | null;
  updatedAt: string | null;
  error: string | null;
  refreshing: boolean;
}

function weatherTheme(condition: string): string {
  if (condition.includes('雷')) return 'db-weather-theme-storm';
  if (condition.includes('雪')) return 'db-weather-theme-snow';
  if (condition.includes('雨')) return 'db-weather-theme-rain';
  if (condition.includes('雾') || condition.includes('霾')) return 'db-weather-theme-fog';
  if (condition.includes('阴')) return 'db-weather-theme-cloudy';
  if (condition.includes('多云')) return 'db-weather-theme-cloudy';
  return 'db-weather-theme-sunny';
}

function weatherIcon(condition: string): string {
  if (condition.includes('雷')) return '⛈️';
  if (condition.includes('雪')) return '❄️';
  if (condition.includes('雨')) return '🌧️';
  if (condition.includes('雾') || condition.includes('霾')) return '🌫️';
  if (condition.includes('阴')) return '☁️';
  if (condition.includes('多云')) return '⛅';
  return '☀️';
}

interface DailyDashboardProps {
  date: string;
  granularity: Granularity;
  /** 把任务排期到时间轴（打开快速添加并预填标题） */
  onSchedule: (title: string, date: string, startMinute: number, endMinute: number) => void;
  /** 今日面板形态：drawer=抽屉（收起为一行标题条），always=常驻展开 */
  panelMode: 'drawer' | 'always';
  /** 抽屉模式下当前是否展开 */
  drawerOpen: boolean;
  /** 抽屉开合变化（由上层持久化并处理自动滚动） */
  onDrawerOpenChange: (open: boolean) => void;
  /** 外部数据变更后的刷新信号（如 AI 输入落库后 +1 触发重读） */
  refreshKey?: number;
  /** AI 落库新增的任务 id 与重要事项文本，用于短暂高亮 */
  highlightNew?: { taskIds: string[]; important: string[] };
}

type TaskStatusFilter = 'all' | 'todo' | 'done';

/** 分区折叠按钮：点击切换对应卡片展开/收起 */
function CollapseBtn({ open, onClick, testId }: { open: boolean; onClick: () => void; testId: string }) {
  return (
    <button
      type="button"
      className={`db-collapse-btn ${open ? '' : 'db-collapse-btn-closed'}`}
      onClick={onClick}
      aria-label={open ? '收起分区' : '展开分区'}
      data-testid={testId}
    >
      <ChevronDown size={16} strokeWidth={2} />
    </button>
  );
}

export function DailyDashboard({ date, granularity, onSchedule, panelMode, drawerOpen, onDrawerOpenChange, refreshKey = 0, highlightNew }: DailyDashboardProps) {
  const [panel, setPanel] = useState<DailyPanel>(() => emptyPanel());
  const [taskText, setTaskText] = useState('');
  const [taskEmoji, setTaskEmoji] = useState('📚');
  const [importantText, setImportantText] = useState('');
  const [voiceBusy, setVoiceBusy] = useState<'task' | 'summary' | null>(null);
  const voiceTargetRef = useRef<'task' | 'summary'>('task');
  const { phase: voicePhase, error: voiceErrorInfo, startVoice, stopVoice } = useVoiceInput((t) => {
    if (voiceTargetRef.current === 'task') setTaskText(t);
    else setPanel((p) => ({ ...p, summary: t }));
  });
  /** 聆听状态同步到按钮高亮与提示条 */
  useEffect(() => {
    if (voicePhase === 'starting' || voicePhase === 'listening' || voicePhase === 'stopping') {
      setVoiceBusy(voiceTargetRef.current);
    } else {
      setVoiceBusy(null);
    }
  }, [voicePhase]);
  const [weather, setWeather] = useState<WeatherInfo>({
    city: '',
    condition: '',
    temperatureC: null,
    tempHighC: null,
    tempLowC: null,
    humidityPercent: null,
    updatedAt: null,
    error: null,
    refreshing: false,
  });
  const [cityEditing, setCityEditing] = useState(false);
  const [cityDraft, setCityDraft] = useState('');
  /** 任务拖拽排期：pointer 事件实现，按住任务拖到上方时间轴 */
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const taskDragRef = useRef<{ id: string; x: number; y: number; title: string; armed: boolean } | null>(null);
  /** 是否全屏放大展示面板（延伸布局，避免内容挤在一起显示不全） */
  const [expanded, setExpanded] = useState(false);
  /** 放大视图字号缩放（双指捏合 / 按钮调整） */
  const [zoom, setZoom] = useState<number>(() => loadDbZoom());
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);
  /** 今日面板搜索与筛选 */
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatusFilter>('all');
  /** 任务拖动排序 */
  const [reorderId, setReorderId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const reorderRef = useRef<{ id: string; from: number } | null>(null);
  /** 复制分享反馈 */
  const [toast, setToast] = useState('');
  /** 历史记录回顾 */
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  /** 表情库：预设表情包开关 + 自定义上传表情 */
  const [stickerLib, setStickerLib] = useState<StickerLib>(() => loadStickerLib());
  const [libOpen, setLibOpen] = useState(false);
  /** 分区折叠：天气 / 心情 / 任务 / 重要事项 / 小结 可各自收起 */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const sectionKeys = ['weather', 'mood', 'tasks', 'important', 'summary'];
  const allCollapsed = sectionKeys.every((k) => collapsed[k]);
  const toggleSection = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  const toggleAll = () =>
    setCollapsed(allCollapsed ? {} : Object.fromEntries(sectionKeys.map((k) => [k, true])));

  const tasksRef = useRef<DailyTask[]>(panel.tasks);
  tasksRef.current = panel.tasks;

  /** 表情库可选项：心情区 = 心情+颜文字 包 + 自定义；任务区 = 学习工作+生活 包 + 自定义 */
  const moodList = useMemo(() => moodOptions(stickerLib), [stickerLib]);
  const taskList = useMemo(() => taskOptions(stickerLib), [stickerLib]);

  // 按日期加载面板（外部刷新信号变化时重读）
  useEffect(() => {
    setPanel(loadPanel(date));
  }, [date, refreshKey]);

  // 面板变化即保存（幂等）
  useEffect(() => {
    savePanel(date, panel);
  }, [date, panel]);

  // 卸载时中止可能仍在进行的识别（useVoiceInput 内部已处理）

  // 字号缩放持久化
  useEffect(() => {
    saveDbZoom(zoom);
  }, [zoom]);

  // 表情库持久化
  useEffect(() => {
    saveStickerLib(stickerLib);
  }, [stickerLib]);

  // 任务拖拽状态复位：指针抬起/取消统一清理（含拖到画布外的情况）
  useEffect(() => {
    const onUp = () => {
      if (scheduleDrag.active) {
        scheduleDrag.active = false;
        scheduleDrag.title = '';
      }
      taskDragRef.current = null;
      setDraggingTaskId(null);
    };
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const onTaskPointerDown = (e: RPointerEvent<HTMLLIElement>, t: DailyTask) => {
    if (expanded) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    taskDragRef.current = {
      id: t.id,
      x: e.clientX,
      y: e.clientY,
      title: `${t.emoji ? `${plainStickerText(t.emoji, stickerLib)} ` : ''}${t.text}`,
      armed: false,
    };
  };

  const onTaskPointerMove = (e: RPointerEvent<HTMLLIElement>, t: DailyTask) => {
    const d = taskDragRef.current;
    if (!d || d.id !== t.id || d.armed) return;
    const dist = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (dist > 10) {
      d.armed = true;
      scheduleDrag.title = d.title;
      scheduleDrag.active = true;
      setDraggingTaskId(t.id);
    }
  };

  const fetchWeather = useCallback(async (city: string, silent = false) => {
    if (!silent) setWeather((w) => ({ ...w, refreshing: true }));
    try {
      const res = await window.lingguang.data.getWeather({
        location: city,
        include: ['realtime'],
        forecastDays: 1,
        timeout: 8000,
      });
      if (res?.realtime) {
        setWeather({
          city: res.location.city || city,
          condition: res.realtime.condition ?? '',
          temperatureC: res.realtime.temperatureC,
          tempHighC: res.realtime.tempHighC ?? null,
          tempLowC: res.realtime.tempLowC ?? null,
          humidityPercent: res.realtime.humidityPercent ?? null,
          updatedAt: res.updatedAt ?? null,
          error: null,
          refreshing: false,
        });
        return;
      }
      setWeather((w) => ({ ...w, error: '天气数据暂时不可用，请稍后重试', refreshing: false }));
    } catch {
      setWeather((w) => ({ ...w, error: '天气获取失败，请检查网络', refreshing: false }));
    }
  }, []);

  // 首次进入按记忆城市拉取天气
  useEffect(() => {
    const c = loadWeatherCity();
    setCityDraft(c);
    void fetchWeather(c, true);
  }, [fetchWeather]);

  // 静默自动刷新：10 分钟一次，卸载清理
  useEffect(() => {
    const timer = window.setInterval(() => {
      const c = weather.city || loadWeatherCity();
      if (c) void fetchWeather(c, true);
    }, 10 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [weather.city, fetchWeather]);

  const locate = async () => {
    try {
      const loc = await window.lingguang.getLocation({ poi: true });
      const c = (loc.city || loc.province || '').trim();
      if (!c) throw new Error('no city');
      saveWeatherCity(c);
      setCityDraft(c);
      setCityEditing(false);
      void fetchWeather(c);
    } catch {
      setWeather((w) => ({ ...w, error: '定位失败，请手动输入城市名', refreshing: false }));
    }
  };

  const commitCity = () => {
    const c = cityDraft.trim();
    setCityEditing(false);
    if (!c) {
      setCityDraft(weather.city || loadWeatherCity());
      return;
    }
    saveWeatherCity(c);
    void fetchWeather(c);
  };

  const handleVoiceToggle = (target: 'task' | 'summary') => {
    if (voicePhase === 'starting' || voicePhase === 'listening' || voicePhase === 'stopping') {
      void stopVoice();
      return;
    }
    voiceTargetRef.current = target;
    void startVoice();
  };

  const addTask = () => {
    const text = taskText.trim();
    if (!text) return;
    const t: DailyTask = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text,
      emoji: taskList.some((o) => o.key === taskEmoji) ? taskEmoji : (taskList[0]?.key ?? ''),
      done: false,
      createdAt: Date.now(),
    };
    setPanel((p) => ({ ...p, tasks: [...p.tasks, t] }));
    setTaskText('');
  };

  const toggleTask = (id: string) => {
    setPanel((p) => ({ ...p, tasks: p.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }));
  };

  const removeTask = (id: string) => {
    setPanel((p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== id) }));
  };

  const clearDoneTasks = () => {
    setPanel((p) => ({ ...p, tasks: p.tasks.filter((t) => !t.done) }));
  };

  const addImportant = () => {
    const text = importantText.trim();
    if (!text) return;
    setPanel((p) => ({ ...p, important: [...p.important, text] }));
    setImportantText('');
  };

  const removeImportantText = (text: string) => {
    setPanel((p) => ({ ...p, important: p.important.filter((it) => it !== text) }));
  };

  const setSummary = (v: string) => {
    setPanel((p) => ({ ...p, summary: v }));
  };

  const appendKaomoji = (k: string) => {
    setPanel((p) => ({ ...p, summary: p.summary ? `${p.summary} ${k}` : k }));
  };

  const scheduleTask = (t: DailyTask) => {
    const now = new Date();
    const s = snapMinute(now.getHours() * 60 + now.getMinutes(), granularity);
    onSchedule(`${t.emoji ? `${plainStickerText(t.emoji, stickerLib)} ` : ''}${t.text}`, date, s, Math.min(s + granularity, DAY_MINUTES));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2200);
  };

  /** 一键复制分享：把当天面板整理成纯文本复制到剪贴板 */
  const copyPanel = async () => {
    const text = buildPanelShareText(date, panelForText(panel, stickerLib));
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        showToast('已复制，可粘贴到任意聊天分享');
        return;
      }
      throw new Error('no clipboard');
    } catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('已复制，可粘贴分享');
      } catch {
        showToast('复制失败，请重试');
      }
    }
  };

  /** 搜索与筛选后的展示数据 */
  const hasFilter = search.trim() !== '' || statusFilter !== 'all';
  const filteredTasks = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return panel.tasks.filter((t) => {
      if (statusFilter === 'todo' && t.done) return false;
      if (statusFilter === 'done' && !t.done) return false;
      if (kw) {
        const hay = `${t.emoji} ${t.text}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [panel.tasks, search, statusFilter]);

  const filteredImportant = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return panel.important;
    return panel.important.filter((it) => it.toLowerCase().includes(kw));
  }, [panel.important, search]);

  const historyList = useMemo(() => (historyOpen ? buildHistoryList(30) : []), [historyOpen]);

  /** 任务拖动排序：按住 ⋮⋮ 手柄在列表内上下移动 */
  const startReorder = (e: RPointerEvent<HTMLButtonElement>, t: DailyTask) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasFilter) return;
    const from = tasksRef.current.findIndex((x) => x.id === t.id);
    if (from < 0) return;
    reorderRef.current = { id: t.id, from };
    setReorderId(t.id);
    const onMove = (ev: PointerEvent) => {
      const r = reorderRef.current;
      const list = listRef.current;
      if (!r || !list) return;
      const len = tasksRef.current.length;
      if (len < 2) return;
      const rect = list.getBoundingClientRect();
      if (rect.height <= 0) return;
      let idx = Math.floor(((ev.clientY - rect.top) / rect.height) * len);
      idx = clamp(idx, 0, len - 1);
      if (idx === r.from) return;
      const arr = [...tasksRef.current];
      const [it] = arr.splice(r.from, 1);
      arr.splice(idx, 0, it);
      tasksRef.current = arr;
      r.from = idx;
      setPanel((p) => ({ ...p, tasks: arr }));
    };
    const onUp = () => {
      reorderRef.current = null;
      setReorderId(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  /** 放大视图：双指捏合缩放字号 */
  const onExpandedTouchStart = (e: RTouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const t = e.touches;
      pinchRef.current = {
        dist: Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY),
        zoom,
      };
    }
  };

  const onExpandedTouchMove = (e: RTouchEvent<HTMLDivElement>) => {
    const p = pinchRef.current;
    if (!p || e.touches.length !== 2) return;
    const t = e.touches;
    const dist = Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    if (dist > 0) {
      const next = clamp(p.zoom * (dist / p.dist), 0.8, 1.7);
      setZoom(Math.round(next * 100) / 100);
    }
  };

  const onExpandedTouchEnd = () => {
    pinchRef.current = null;
  };

  const adjustZoom = (delta: number) => {
    setZoom((z) => clamp(Math.round((z + delta) * 100) / 100, 0.8, 1.7));
  };

  const isToday = date === todayStr();
  const doneCount = panel.tasks.filter((t) => t.done).length;

  /** 抽屉标题条摘要：任务进度 + 心情/事项/小结 */
  const drawerSummary = useMemo(() => {
    const parts = [`今日任务 ${doneCount}/${panel.tasks.length}`];
    const moodTxt = panel.mood ? plainStickerText(panel.mood, stickerLib) : '';
    if (moodTxt) parts.push(`心情 ${moodTxt}`);
    if (panel.important.length > 0) parts.push(`事项 ${panel.important.length}`);
    if (panel.summary.trim()) parts.push('已小结');
    return parts.join(' · ');
  }, [panel, doneCount, stickerLib]);

  const renderStickerOption = (opt: StickerOption) =>
    opt.kind === 'image' && opt.url ? <img className="db-sticker-img" src={opt.url} alt={opt.text} /> : <span className="db-sticker-text">{opt.text}</span>;

  const renderStickerValue = (value: string) => {
    const r = resolveSticker(value, stickerLib);
    return r.kind === 'image' && r.url ? <img className="db-sticker-img db-sticker-img-sm" src={r.url} alt={r.text} /> : <span className="db-sticker-text">{r.text}</span>;
  };

  const stickerSheetNode = <StickerLibSheet open={libOpen} lib={stickerLib} onChange={setStickerLib} onClose={() => setLibOpen(false)} />;

  const body = (
    <>
      {/* 内容搜索与筛选 */}
      <div className="db-toolbar" data-testid="db-toolbar">
        <div className="db-search-wrap">
          <span className="material-icons db-search-icon">search</span>
          <input
            className="db-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索任务、重要事项…"
            data-testid="db-search-input"
          />
          {search && (
            <button
              type="button"
              className="db-search-clear"
              onClick={() => setSearch('')}
              aria-label="清空搜索"
              data-testid="db-search-clear"
            >
              <span className="material-icons">close</span>
            </button>
          )}
        </div>
        <div className="db-status-chips" data-testid="db-status-chips">
          {(
            [
              ['all', '全部'],
              ['todo', '未完成'],
              ['done', '已完成'],
            ] as const
          ).map(([s, label]) => (
            <button
              key={s}
              type="button"
              className={`db-status-chip ${statusFilter === s ? 'db-status-chip-active' : ''}`}
              onClick={() => setStatusFilter(s)}
              data-testid={`db-status-${s}`}
            >
              {label}
            </button>
          ))}
        </div>
        {hasFilter && (
          <p className="db-filter-note" data-testid="db-filter-note">
            匹配任务 {filteredTasks.length} 条 · 事项 {filteredImportant.length} 条
          </p>
        )}
      </div>

      {/* 天气与心情 */}
      <div className="db-card-grid">
        <div className={`db-card db-weather ${weatherTheme(weather.condition)}`} data-testid="db-weather">
          <div className="db-card-head">
            <CloudSun size={16} strokeWidth={2} />
            <span>天气</span>
            <div className="db-weather-tools">
              {cityEditing ? (
                <span className="db-city-edit">
                  <input
                    value={cityDraft}
                    onChange={(e) => setCityDraft(e.target.value)}
                    onBlur={commitCity}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        commitCity();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    data-testid="db-weather-city-input"
                  />
                </span>
              ) : (
                <button
                  type="button"
                  className="db-city-btn"
                  onClick={() => {
                    setCityDraft(weather.city || loadWeatherCity());
                    setCityEditing(true);
                  }}
                  data-testid="db-weather-city"
                >
                  <MapPin size={13} strokeWidth={2} />
                  <span className="db-city-label">{weather.city || '选择城市'}</span>
                </button>
              )}
              <button type="button" className="db-icon-btn" onClick={() => void locate()} aria-label="定位到当前位置" data-testid="db-weather-locate">
                <LocateFixed size={15} strokeWidth={2} />
              </button>
              <button
                type="button"
                className="db-icon-btn"
                onClick={() => void fetchWeather(weather.city || loadWeatherCity())}
                disabled={weather.refreshing}
                aria-label="刷新天气"
                data-testid="db-weather-refresh"
              >
                <RefreshCw size={15} strokeWidth={2} className={weather.refreshing ? 'db-spin' : ''} />
              </button>
            </div>
            <CollapseBtn open={!collapsed['weather']} onClick={() => toggleSection('weather')} testId="db-collapse-weather" />
          </div>
          {!collapsed['weather'] && (
            <>
              <div className="db-weather-main">
            <span className="db-weather-icon">{weatherIcon(weather.condition)}</span>
            <div className="db-weather-info">
              <strong className="db-weather-temp">{weather.temperatureC != null ? `${Math.round(weather.temperatureC)}°` : '--'}</strong>
              <span className="db-weather-cond">{weather.condition || '天气数据加载中'}</span>
            </div>
            <div className="db-weather-extra">
              <span>{weather.tempLowC != null && weather.tempHighC != null ? `${Math.round(weather.tempLowC)}° ~ ${Math.round(weather.tempHighC)}°` : '--'}</span>
              <span>{weather.humidityPercent != null ? `湿度 ${Math.round(weather.humidityPercent)}%` : '湿度 --'}</span>
            </div>
          </div>
          {weather.error && (
            <div className="db-weather-error" data-testid="db-weather-error">
              {weather.error}
            </div>
          )}
          {weather.updatedAt && <div className="db-weather-time">数据更新 {weather.updatedAt}</div>}
            </>
          )}
        </div>

        <div className="db-card" data-testid="db-mood">
          <div className="db-card-head">
            <CalendarHeart size={16} strokeWidth={2} />
            <span>今日心情</span>
            <button
              type="button"
              className="db-icon-btn"
              onClick={() => setLibOpen(true)}
              aria-label="管理表情库"
              title="管理表情库"
              data-testid="db-open-sticker-lib"
            >
              <SmilePlus size={15} strokeWidth={2} />
            </button>
            <CollapseBtn open={!collapsed['mood']} onClick={() => toggleSection('mood')} testId="db-collapse-mood" />
          </div>
          {!collapsed['mood'] && (
            <>
              <div className="db-mood-row">
            {moodList.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`db-mood-btn ${panel.mood === opt.key ? 'db-mood-active' : ''}`}
                onClick={() => setPanel((p) => ({ ...p, mood: p.mood === opt.key ? '' : opt.key }))}
                aria-label={`心情 ${opt.text}`}
                data-testid={`db-mood-${opt.testId}`}
              >
                {renderStickerOption(opt)}
              </button>
            ))}
            <button
              type="button"
              className="db-mood-btn db-mood-add"
              onClick={() => setLibOpen(true)}
              aria-label="管理表情库：上传图片定义表情"
              title="管理表情库"
              data-testid="db-open-sticker-lib-add"
            >
              <Plus size={18} strokeWidth={2.5} />
            </button>
          </div>
          <p className="db-mood-note">
            {panel.mood ? (
              <>
                已记录今天的心情：{renderStickerValue(panel.mood)}，再点一次可取消
              </>
            ) : (
              '点一个表情记录今天的心情'
            )}
          </p>
            </>
          )}
        </div>
      </div>

      {/* 任务清单 */}
      <div className="db-card" data-testid="db-tasks">
        <div className="db-card-head">
          <CheckCircle2 size={16} strokeWidth={2} />
          <span>任务清单</span>
          {doneCount > 0 && (
            <button type="button" className="db-clear-btn" onClick={clearDoneTasks} data-testid="db-tasks-clear-done">
              清除已完成（{doneCount}）
            </button>
          )}
          <CollapseBtn open={!collapsed['tasks']} onClick={() => toggleSection('tasks')} testId="db-collapse-tasks" />
        </div>
        {!collapsed['tasks'] && (
          <>
        <div className="db-input-row">
          <div className="db-emoji-picker" data-testid="db-task-emoji-picker">
            {taskList.map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`db-emoji-btn ${taskEmoji === opt.key ? 'db-emoji-active' : ''}`}
                onClick={() => setTaskEmoji(opt.key)}
                aria-label={`任务分类 ${opt.text}`}
                data-testid={`db-task-emoji-${opt.testId}`}
              >
                {renderStickerOption(opt)}
              </button>
            ))}
            <button
              type="button"
              className="db-emoji-btn db-emoji-add"
              onClick={() => setLibOpen(true)}
              aria-label="管理表情库：上传图片定义表情"
              title="管理表情库"
              data-testid="db-open-sticker-lib-task"
            >
              <Plus size={16} strokeWidth={2.5} />
            </button>
          </div>
          <div className="db-input-wrap">
            <input
              className="db-input"
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTask();
              }}
              placeholder="输入任务，如：背单词 30 分钟"
              data-testid="db-task-input"
            />
            <button
              type="button"
              className={`db-voice-btn ${voiceBusy === 'task' ? 'db-voice-active' : ''}`}
              onClick={() => handleVoiceToggle('task')}
              aria-label="语音输入任务"
              data-testid="db-task-voice"
            >
              {voiceBusy === 'task' ? <Square size={16} strokeWidth={2} /> : <Mic size={16} strokeWidth={2} />}
            </button>
          </div>
          <button type="button" className="btn btn-primary db-add-btn" onClick={addTask} data-testid="db-task-add">
            添加
          </button>
        </div>
        {voiceBusy === 'task' && (
          <div className="db-listening" data-testid="db-task-listening">
            <span className="db-listening-dot" /> 正在聆听…
          </div>
        )}
        {voiceErrorInfo && (
          <div className="db-error" data-testid="db-voice-error">
            {voiceErrorInfo.message}
            {voiceErrorInfo.retryable && (
              <button type="button" className="ai-retry-btn" onClick={() => handleVoiceToggle(voiceTargetRef.current)} data-testid="db-voice-retry">
                重试
              </button>
            )}
          </div>
        )}
        <p className="db-drag-hint">
          {expanded
            ? '按住任务可拖到上方时间轴排期；按住 ⋮⋮ 可排序，或点 ⏱ 快速排期（收起面板后拖拽到时间轴）'
            : '按住任务拖到上方时间轴排期；按住 ⋮⋮ 可排序，或点 ⏱ 快速排期'}
        </p>
        {panel.tasks.length === 0 ? (
          <div className="db-empty" data-testid="db-tasks-empty">
            今天还没有任务
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="db-empty" data-testid="db-tasks-filter-empty">
            没有匹配的任务
          </div>
        ) : (
          <ul className="db-task-list" ref={listRef} data-testid="db-task-list">
            {filteredTasks.map((t) => (
              <li
                key={t.id}
                className={`db-task-item ${t.done ? 'db-task-done' : ''} ${draggingTaskId === t.id ? 'db-task-dragging' : ''} ${
                  reorderId === t.id ? 'db-task-reordering' : ''
                } ${highlightNew?.taskIds.includes(t.id) ? 'db-task-new' : ''}`}
                onPointerDown={(e) => onTaskPointerDown(e, t)}
                onPointerMove={(e) => onTaskPointerMove(e, t)}
                data-testid={`db-task-${t.id}`}
              >
                <button
                  type="button"
                  className="db-check"
                  onClick={() => toggleTask(t.id)}
                  aria-label={t.done ? '标记未完成' : '标记完成'}
                  data-testid={`db-task-check-${t.id}`}
                >
                  {t.done ? <CheckCircle2 size={18} strokeWidth={2} /> : <Circle size={18} strokeWidth={2} />}
                </button>
                <span className="db-task-emoji">{renderStickerValue(t.emoji)}</span>
                <span className="db-task-text">{t.text}</span>
                <button
                  type="button"
                  className="db-schedule-btn"
                  onClick={() => scheduleTask(t)}
                  aria-label="排期到时间轴"
                  data-testid={`db-task-schedule-${t.id}`}
                >
                  ⏱
                </button>
                <button
                  type="button"
                  className="db-task-grip"
                  onPointerDown={(e) => startReorder(e, t)}
                  disabled={hasFilter}
                  aria-label="拖动排序"
                  title={hasFilter ? '搜索或筛选时不可排序' : '拖动排序'}
                  data-testid={`db-task-grip-${t.id}`}
                >
                  <GripVertical size={16} strokeWidth={2} />
                </button>
                <button type="button" className="db-task-del" onClick={() => removeTask(t.id)} aria-label="删除任务" data-testid={`db-task-del-${t.id}`}>
                  <Trash2 size={15} strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}
          </>
        )}
      </div>

      {/* 重要事项 */}
      <div className="db-card" data-testid="db-important">
        <div className="db-card-head">
          <Pin size={16} strokeWidth={2} />
          <span>重要事项</span>
          <CollapseBtn open={!collapsed['important']} onClick={() => toggleSection('important')} testId="db-collapse-important" />
        </div>
        {!collapsed['important'] && (
          <>
        <div className="db-input-wrap">
          <input
            className="db-input"
            value={importantText}
            onChange={(e) => setImportantText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addImportant();
            }}
            placeholder="记录今天绝不能忘的事，回车添加"
            data-testid="db-important-input"
          />
          <button type="button" className="btn btn-primary db-add-btn" onClick={addImportant} data-testid="db-important-add">
            添加
          </button>
        </div>
        {panel.important.length === 0 ? (
          <div className="db-empty" data-testid="db-important-empty">
            暂无重要事项
          </div>
        ) : filteredImportant.length === 0 ? (
          <div className="db-empty" data-testid="db-important-filter-empty">
            没有匹配的事项
          </div>
        ) : (
          <ul className="db-important-list" data-testid="db-important-list">
            {filteredImportant.map((it) => (
              <li key={it} className={`db-important-item ${highlightNew?.important.includes(it) ? 'db-important-new' : ''}`} data-testid={`db-important-${it}`}>
                <span className="db-important-pin">📌</span>
                <span className="db-important-text">{it}</span>
                <button
                  type="button"
                  className="db-task-del"
                  onClick={() => removeImportantText(it)}
                  aria-label="删除重要事项"
                  data-testid={`db-important-del-${it}`}
                >
                  <Trash2 size={15} strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}
          </>
        )}
      </div>

      {/* 今日小结 */}
      <div className="db-card" data-testid="db-summary">
        <div className="db-card-head">
          <Sparkles size={16} strokeWidth={2} />
          <span>今日小结</span>
          <button
            type="button"
            className={`db-voice-btn ${voiceBusy === 'summary' ? 'db-voice-active' : ''}`}
            onClick={() => handleVoiceToggle('summary')}
            aria-label="语音输入小结"
            data-testid="db-summary-voice"
          >
            {voiceBusy === 'summary' ? <Square size={16} strokeWidth={2} /> : <Mic size={16} strokeWidth={2} />}
          </button>
          <CollapseBtn open={!collapsed['summary']} onClick={() => toggleSection('summary')} testId="db-collapse-summary" />
        </div>
        {!collapsed['summary'] && (
          <>
        <textarea
          className="db-summary-area"
          value={panel.summary}
          onChange={(e) => setSummary(e.target.value)}
          rows={3}
          placeholder="写一段今天的小结，支持语音输入"
          data-testid="db-summary-input"
        />
        {voiceBusy === 'summary' && (
          <div className="db-listening" data-testid="db-summary-listening">
            <span className="db-listening-dot" /> 正在聆听…
          </div>
        )}
        <div className="db-kaomoji-row" data-testid="db-kaomoji-row">
          {KAOMOJIS.map((k, i) => (
            <button key={k} type="button" className="db-kaomoji-btn" onClick={() => appendKaomoji(k)} data-testid={`db-kaomoji-${i}`}>
              {k}
            </button>
          ))}
        </div>
          </>
        )}
      </div>
    </>
  );

  const toastNode = toast ? (
    <div className="db-toast" data-testid="db-toast">
      {toast}
    </div>
  ) : null;

  /* 历史记录回顾：全屏列表 */
  if (historyOpen) {
    return (
      <div className="db-history" data-testid="db-history">
        <div className="db-history-head">
          <div className="db-expanded-title">
            <span className="db-head-title">历史记录回顾</span>
            <span className="db-head-sub">近 30 天面板</span>
          </div>
          <button
            type="button"
            className="db-expand-btn"
            onClick={() => {
              setHistoryOpen(false);
              setExpandedEntry(null);
            }}
            data-testid="db-history-close"
          >
            <span className="material-icons">close</span> 关闭
          </button>
        </div>
        <div className="db-history-body">
          {historyList.length === 0 ? (
            <div className="db-empty" data-testid="db-history-empty">
              近 30 天还没有面板记录，从今天开始记录吧
            </div>
          ) : (
            historyList.map((h) => {
              const done = h.panel.tasks.filter((t) => t.done).length;
              const open = expandedEntry === h.date;
              return (
                <div className={`db-history-item ${open ? 'db-history-item-open' : ''}`} key={h.date} data-testid={`db-history-${h.date}`}>
                  <button
                    type="button"
                    className="db-history-summary"
                    onClick={() => setExpandedEntry(open ? null : h.date)}
                    data-testid={`db-history-toggle-${h.date}`}
                  >
                    <span className="db-history-date">{fmtDateCN(h.date)}</span>
                    <span className="db-history-meta">
                      {h.panel.mood ? `${plainStickerText(h.panel.mood, stickerLib)} ` : ''}任务 {done}/{h.panel.tasks.length} · 事项 {h.panel.important.length}
                      {h.panel.summary.trim() ? ' · 有小结' : ''}
                    </span>
                    <span className="material-icons db-history-arrow">{open ? 'expand_less' : 'expand_more'}</span>
                  </button>
                  {open && (
                    <div className="db-history-detail" data-testid={`db-history-detail-${h.date}`}>
                      {h.panel.mood && <p className="db-history-line">心情：{plainStickerText(h.panel.mood, stickerLib)}</p>}
                      {h.panel.tasks.length > 0 && (
                        <ul className="db-history-list">
                          {h.panel.tasks.map((t) => (
                            <li key={t.id} className={t.done ? 'db-history-task-done' : ''}>
                              {t.done ? '☑️' : '⬜'} {t.emoji ? `${plainStickerText(t.emoji, stickerLib)} ` : ''}
                              {t.text}
                            </li>
                          ))}
                        </ul>
                      )}
                      {h.panel.important.length > 0 && (
                        <ul className="db-history-list">
                          {h.panel.important.map((it, i) => (
                            <li key={`${it}-${i}`}>📌 {it}</li>
                          ))}
                        </ul>
                      )}
                      {h.panel.summary.trim() && <p className="db-history-summary-text">{h.panel.summary.trim()}</p>}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        {toastNode}
        {stickerSheetNode}
      </div>
    );
  }

  if (expanded) {
    return (
      <div className="db-expanded" data-testid="db-expanded">
        <div className="db-expanded-head">
          <div className="db-expanded-title">
            <span className="db-head-title">{isToday ? '今日面板' : `${fmtDateCN(date)} 面板`}</span>
            <span className="db-head-sub">延伸视图 · 双指缩放字号 · 上下滑动</span>
          </div>
          <div className="db-expanded-tools">
            <div className="db-zoom-controls" data-testid="db-zoom-controls">
              <button type="button" className="db-zoom-btn" onClick={() => adjustZoom(-0.1)} aria-label="缩小字号" data-testid="db-zoom-out">
                A-
              </button>
              <span className="db-zoom-value">{Math.round(zoom * 100)}%</span>
              <button type="button" className="db-zoom-btn" onClick={() => adjustZoom(0.1)} aria-label="放大字号" data-testid="db-zoom-in">
                A+
              </button>
              {zoom !== 1 && (
                <button type="button" className="db-zoom-btn" onClick={() => setZoom(1)} aria-label="重置字号" data-testid="db-zoom-reset">
                  重置
                </button>
              )}
            </div>
            <button type="button" className="db-share-btn" onClick={() => void copyPanel()} aria-label="复制分享面板" data-testid="db-share">
              <Share2 size={14} strokeWidth={2} /> 分享
            </button>
            <button type="button" className="db-expand-btn" onClick={() => setExpanded(false)} data-testid="db-collapse">
              <span className="material-icons">close</span> 收起
            </button>
          </div>
        </div>
        <div
          className="db-expanded-body"
          style={{ '--db-zoom': zoom } as CSSProperties}
          onTouchStart={onExpandedTouchStart}
          onTouchMove={onExpandedTouchMove}
          onTouchEnd={onExpandedTouchEnd}
          onTouchCancel={onExpandedTouchEnd}
        >
          {body}
        </div>
        {toastNode}
        {stickerSheetNode}
      </div>
    );
  }

  /* 抽屉模式收起态：只占一行标题条，点击整条展开完整内容 */
  if (panelMode === 'drawer' && !drawerOpen) {
    return (
      <div className="db-root db-drawer-root" data-testid="daily-dashboard">
        <button type="button" className="db-drawer-bar" onClick={() => onDrawerOpenChange(true)} data-testid="db-drawer-bar">
          <span className="db-head-title">{isToday ? '今日面板' : `${fmtDateCN(date)} 面板`}</span>
          <span className="db-drawer-summary" data-testid="db-drawer-summary">
            {drawerSummary}
          </span>
          <span className="material-icons db-drawer-arrow" aria-hidden="true">
            expand_more
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className={`db-root ${panelMode === 'drawer' ? 'db-root-pop' : ''}`} data-testid="daily-dashboard">
      <div className="db-head" data-testid="db-head">
        <span className="db-head-title">{isToday ? '今日面板' : `${fmtDateCN(date)} 面板`}</span>
        <span className="db-head-sub">天气 · 心情 · 任务 · 小结</span>
        <div className="db-head-actions">
          {panelMode === 'drawer' && (
            <button
              type="button"
              className="db-expand-btn"
              onClick={() => onDrawerOpenChange(false)}
              aria-label="收起为一行标题"
              title="收起为一行标题"
              data-testid="db-drawer-collapse"
            >
              <span className="material-icons">keyboard_arrow_up</span> 收起
            </button>
          )}
          <button
            type="button"
            className="db-icon-btn2 db-collapse-all"
            onClick={toggleAll}
            aria-label={allCollapsed ? '全部展开' : '全部收起'}
            title={allCollapsed ? '全部展开' : '全部收起'}
            data-testid="db-collapse-all"
          >
            <span className="material-icons">{allCollapsed ? 'expand_more' : 'unfold_less'}</span>
          </button>
          <button
            type="button"
            className="db-icon-btn2"
            onClick={() => setHistoryOpen(true)}
            aria-label="历史记录回顾"
            title="历史记录回顾"
            data-testid="db-history-open"
          >
            <History size={16} strokeWidth={2} />
          </button>
          <button
            type="button"
            className="db-icon-btn2"
            onClick={() => void copyPanel()}
            aria-label="复制分享今日面板"
            title="一键复制分享"
            data-testid="db-share-collapsed"
          >
            <Share2 size={16} strokeWidth={2} />
          </button>
          <button type="button" className="db-expand-btn db-expand-btn-sm" onClick={() => setExpanded(true)} data-testid="db-expand">
            <span className="material-icons">open_in_full</span> 放大
          </button>
        </div>
      </div>
      {body}
      {toastNode}
      {stickerSheetNode}
    </div>
  );
}