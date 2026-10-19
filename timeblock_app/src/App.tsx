import './App.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as RPointerEvent } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Feather, LayoutGrid, Mic, MoreHorizontal, Plus, Tags } from 'lucide-react';
import type { DailyPanel, DailyTask, ExportFormat, ExportScope, Granularity, SheetKind, Tag, TimeBlock, ViewMode } from './types';
import { TimeGrid } from './components/TimeGrid';
import { DailyDashboard } from './components/DailyDashboard';
import { QuickAddSheet } from './components/QuickAddSheet';
import { AiInputSheet } from './components/AiInputSheet';
import { AssistantSheet } from './components/AssistantSheet';
import { EditSheet } from './components/EditSheet';
import { TagManageSheet } from './components/TagManageSheet';
import { StatsSheet } from './components/StatsSheet';
import { TemplateSheet } from './components/TemplateSheet';
import { Onboarding } from './components/Onboarding';
import { CoverPage } from './components/CoverPage';
import { ThemeSheet } from './components/ThemeSheet';
import { MoreSheet } from './components/MoreSheet';
import type { ScheduleTemplate } from './lib/templates';
import type { BuiltinThemeId, BackupPayload, CustomThemeConfig, PagePreset } from './lib/themes';
import {
  BUILTIN_PROFILES,
  buildCustomThemeVars,
  buildDetailVars,
  buildLayoutVars,
  createCustomThemeId,
  createPagePresetId,
  DEFAULT_CUSTOM_THEME,
  isBuiltinThemeId,
  isCustomThemeConfig,
  normalizeCustomTheme,
  normalizePagePreset,
  THEMES,
} from './lib/themes';
import { deleteBlock, deleteTagWithBlocks, loadBlocksByDateRange, loadTags, upsertBlock, upsertTag } from './lib/db';
import { loadPanel, savePanel } from './lib/dailyPanel';
import type { AiThemeIntent } from './lib/ai';
import { addDays, fmtDate, fmtDateCN, formatDateTitle, getDateList, getDaysRangeEndingAt, getMonthRange, getWeekDates, getWeekStart, todayStr } from './lib/timeUtils';
import { buildDailyExportText, buildTagSummaryText, buildWeekTrendText, utf8ToBase64 } from './lib/exportUtils';

function createBlockId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 初始化主题：优先读取「我的主题」库；旧版单套自定义配色自动迁移为第一套 */
function initThemeState(): { theme: string; list: CustomThemeConfig[] } {
  let savedTheme = 'galgame';
  try {
    savedTheme = window.localStorage.getItem('tb.theme') ?? 'galgame';
  } catch {
    // 忽略读取失败
  }
  let list: CustomThemeConfig[] = [];
  try {
    const raw = window.localStorage.getItem('tb.customThemes');
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        list = parsed
          .filter((x): x is CustomThemeConfig => isCustomThemeConfig(x))
          .map((x, i) =>
            normalizeCustomTheme(
              x,
              typeof (x as { id?: unknown }).id === 'string' && (x as { id: string }).id ? (x as { id: string }).id : createCustomThemeId(),
              typeof (x as { name?: unknown }).name === 'string' && (x as { name: string }).name.trim()
                ? (x as { name: string }).name.trim()
                : `自定义主题 ${i + 1}`,
            ),
          );
      }
    }
  } catch {
    // 忽略损坏数据
  }
  if (list.length > 0) {
    if (list.some((t) => t.id === savedTheme)) return { theme: savedTheme, list };
    if (isBuiltinThemeId(savedTheme)) return { theme: savedTheme, list };
    return { theme: list[0].id, list };
  }
  // 旧版单套自定义配色（tb.customTheme）自动迁移为第一套「我的主题」
  try {
    const raw = window.localStorage.getItem('tb.customTheme');
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (isCustomThemeConfig(parsed)) {
        const migrated = normalizeCustomTheme(parsed, createCustomThemeId(), '自定义主题 1');
        return { theme: savedTheme === 'custom' ? migrated.id : isBuiltinThemeId(savedTheme) ? savedTheme : 'galgame', list: [migrated] };
      }
    }
  } catch {
    // 忽略损坏数据
  }
  return { theme: isBuiltinThemeId(savedTheme) ? savedTheme : 'galgame', list: [] };
}

/** 内置主题叠加的视觉细节档位（localStorage 持久化，仅内置主题激活时生效） */
function initPageDetails(): CustomThemeConfig {
  try {
    const raw = window.localStorage.getItem('tb.pageDetails');
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      return normalizeCustomTheme(parsed, 'page-details', '页面细节');
    }
  } catch {
    // 忽略损坏数据
  }
  return { ...DEFAULT_CUSTOM_THEME, id: 'page-details', name: '页面细节' };
}

/** 初始化页面存档列表与当前激活存档 */
function initPagePresets(): { presets: PagePreset[]; activeId: string } {
  let presets: PagePreset[] = [];
  try {
    const raw = window.localStorage.getItem('tb.pagePresets');
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        presets = parsed.map(normalizePagePreset).filter((x): x is PagePreset => x !== null);
      }
    }
  } catch {
    // 忽略损坏数据
  }
  let activeId = '';
  try {
    const raw = window.localStorage.getItem('tb.pagePresetActive');
    if (raw && presets.some((p) => p.id === raw)) activeId = raw;
  } catch {
    // 忽略读取失败
  }
  return { presets, activeId };
}

const PANEL_MODE_KEY = 'tb.panelMode';
const PANEL_OPEN_KEY = 'tb.panelOpen';
const HEADER_COLLAPSED_KEY = 'tb.headerCollapsed';

/** 顶部功能区形态：collapsed=整块收起只留展开按钮，expanded=完整显示（记忆上次状态） */
function loadHeaderCollapsed(): boolean {
  try {
    return window.localStorage.getItem(HEADER_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** 今日面板形态：drawer=抽屉（默认收起为一行标题条），always=常驻展开（现状） */
function loadPanelMode(): 'drawer' | 'always' {
  try {
    const v = window.localStorage.getItem(PANEL_MODE_KEY);
    if (v === 'drawer' || v === 'always') return v;
  } catch {
    // 忽略读取失败
  }
  return 'drawer';
}

/** 抽屉模式下上次的开合状态（默认收起） */
function loadPanelOpen(): boolean {
  try {
    return window.localStorage.getItem(PANEL_OPEN_KEY) === '1';
  } catch {
    // 忽略读取失败
  }
  return false;
}

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [granularity, setGranularity] = useState<Granularity>(30);
  const [weekDays, setWeekDays] = useState<number>(14);
  /** 周视图向前扩展的天数（更早记录），触底自动加载时增加 */
  const [weekExtra, setWeekExtra] = useState<number>(0);
  const [currentDate, setCurrentDate] = useState<string>(() => todayStr());
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [blocksError, setBlocksError] = useState<string | null>(null);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [quickPrefill, setQuickPrefill] = useState<{ date: string; startMinute: number; endMinute: number; title?: string } | null>(null);
  const [autoVoice, setAutoVoice] = useState(false);
  /** AI 输入面板：底部语音入口打开时自动开始聆听 */
  const [aiAutoVoice, setAiAutoVoice] = useState(false);
  /** AI 输入落库后触发今日面板重读 */
  const [panelRefreshKey, setPanelRefreshKey] = useState(0);
  /** AI 落库新增的任务/重要事项 id 或文本，用于面板高亮 */
  const [highlightNew, setHighlightNew] = useState<{ taskIds: string[]; important: string[] }>({ taskIds: [], important: [] });
  const highlightTimerRef = useRef<number | null>(null);
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null);
  const [themeState] = useState(() => initThemeState());
  const [theme, setTheme] = useState<string>(themeState.theme);
  const [customThemes, setCustomThemes] = useState<CustomThemeConfig[]>(themeState.list);
  const [themeOpen, setThemeOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  /** 顶部功能区：收起后整块隐藏，只留展开按钮（记忆上次状态） */
  const [headerCollapsed, setHeaderCollapsed] = useState<boolean>(() => loadHeaderCollapsed());
  /** 今日面板抽屉：drawer=默认收起为一行标题条，always=常驻展开（现状） */
  const [panelMode, setPanelMode] = useState<'drawer' | 'always'>(() => loadPanelMode());
  /** 抽屉模式下是否展开（记忆上次状态） */
  const [drawerOpen, setDrawerOpen] = useState<boolean>(() => loadPanelOpen());
  const panelAnchorRef = useRef<HTMLDivElement | null>(null);
  /** 应用封面：首次进入展示一次，之后可在更多设置里随时回看 */
  const [coverOpen, setCoverOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('tb.coverSeen') !== '1';
    } catch {
      return true;
    }
  });
  /** 内置主题叠加的视觉细节档位（时间轴 / 按钮 / 字体 / 分区微调） */
  const [pageDetails, setPageDetails] = useState<CustomThemeConfig>(() => initPageDetails());
  /** 页面存档：整套设置命名保存，支持多套管理与一键切换 */
  const [pagePresets, setPagePresets] = useState<PagePreset[]>(() => initPagePresets().presets);
  const [activePresetId, setActivePresetId] = useState<string>(() => initPagePresets().activeId);
  /** 主题应用成功的轻提示 */
  const [themeToast, setThemeToast] = useState('');
  const themeToastTimerRef = useRef<number | null>(null);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState(false);
  /** 按周汇总导出趋势图状态 */
  const [exportingTrend, setExportingTrend] = useState(false);
  const [exportTrendError, setExportTrendError] = useState<string | null>(null);
  const [exportTrendDone, setExportTrendDone] = useState(false);
  const [monthBlocks, setMonthBlocks] = useState<TimeBlock[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const [customDays, setCustomDays] = useState<number>(30);
  const [customBlocks, setCustomBlocks] = useState<TimeBlock[]>([]);
  const [customLoading, setCustomLoading] = useState(false);
  /** 日视图时间轴高度（可由分隔条拖拽调整；null 表示默认 44vh） */
  const [dayGridHeight, setDayGridHeight] = useState<number | null>(null);
  const dayGridWrapRef = useRef<HTMLDivElement | null>(null);
  const resizerDragRef = useRef<{ startY: number; startH: number } | null>(null);

  const weekRange = useMemo(() => {
    const ws = getWeekStart(new Date(`${currentDate}T00:00:00`));
    const start = fmtDate(addDays(ws, -weekExtra));
    const end = fmtDate(addDays(ws, weekDays - 1));
    return [start, end] as const;
  }, [currentDate, weekDays, weekExtra]);

  const dateRange = useMemo(() => {
    if (viewMode === 'day') return [currentDate, currentDate] as const;
    return weekRange;
  }, [viewMode, currentDate, weekRange]);

  const monthRange = useMemo(() => getMonthRange(currentDate), [currentDate]);
  const customRange = useMemo(() => getDaysRangeEndingAt(currentDate, customDays), [currentDate, customDays]);

  const loadMonthBlocks = useCallback(async () => {
    setMonthLoading(true);
    try {
      const list = await loadBlocksByDateRange(monthRange[0], monthRange[1]);
      setMonthBlocks(list);
    } catch {
      // 保留已有数据
    } finally {
      setMonthLoading(false);
    }
  }, [monthRange]);

  const loadCustomBlocks = useCallback(async () => {
    setCustomLoading(true);
    try {
      const list = await loadBlocksByDateRange(customRange[0], customRange[1]);
      setCustomBlocks(list);
    } catch {
      // 保留已有数据
    } finally {
      setCustomLoading(false);
    }
  }, [customRange]);

  const loadBlocks = useCallback(async (): Promise<TimeBlock[]> => {
    return loadBlocksByDateRange(dateRange[0], dateRange[1]);
  }, [dateRange]);

  const refreshBlocks = useCallback(async () => {
    setBlocksLoading(true);
    setBlocksError(null);
    try {
      const list = await loadBlocks();
      setBlocks(list);
    } catch {
      setBlocksError('加载失败，点击重试');
    } finally {
      setBlocksLoading(false);
    }
  }, [loadBlocks]);

  useEffect(() => {
    void refreshBlocks();
  }, [refreshBlocks]);

  const refreshTags = useCallback(async () => {
    setTagsError(null);
    try {
      const list = await loadTags();
      setTags(list);
    } catch {
      setTagsError('标签加载失败');
    }
  }, []);

  useEffect(() => {
    void refreshTags();
  }, [refreshTags]);

  useEffect(() => {
    try {
      window.localStorage.setItem('tb.theme', theme);
    } catch {
      // 忽略持久化失败
    }
  }, [theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem('tb.customThemes', JSON.stringify(customThemes));
    } catch {
      // 忽略持久化失败
    }
  }, [customThemes]);

  useEffect(() => {
    try {
      window.localStorage.setItem('tb.pageDetails', JSON.stringify(pageDetails));
    } catch {
      // 忽略持久化失败
    }
  }, [pageDetails]);

  useEffect(() => {
    try {
      window.localStorage.setItem('tb.pagePresets', JSON.stringify(pagePresets));
    } catch {
      // 忽略持久化失败
    }
  }, [pagePresets]);

  useEffect(() => {
    try {
      window.localStorage.setItem('tb.pagePresetActive', activePresetId);
    } catch {
      // 忽略持久化失败
    }
  }, [activePresetId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PANEL_MODE_KEY, panelMode);
    } catch {
      // 忽略持久化失败
    }
  }, [panelMode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PANEL_OPEN_KEY, drawerOpen ? '1' : '0');
    } catch {
      // 忽略持久化失败
    }
  }, [drawerOpen]);

  useEffect(() => {
    try {
      window.localStorage.setItem(HEADER_COLLAPSED_KEY, headerCollapsed ? '1' : '0');
    } catch {
      // 忽略持久化失败
    }
  }, [headerCollapsed]);

  /** 当前激活主题：统一解析出布置档位、背景图案与 CSS 变量 */
  const activeTheme = useMemo(() => {
    if (isBuiltinThemeId(theme)) {
      const profile = BUILTIN_PROFILES[theme];
      return {
        kind: 'builtin' as const,
        id: theme,
        name: THEMES.find((t) => t.id === theme)?.name ?? theme,
        layout: profile.layout,
        pattern: profile.pattern,
        cfg: null as CustomThemeConfig | null,
      };
    }
    const cfg = customThemes.find((t) => t.id === theme) ?? null;
    if (cfg) {
      return { kind: 'custom' as const, id: cfg.id, name: cfg.name, layout: cfg, pattern: cfg.pattern, cfg };
    }
    return {
      kind: 'builtin' as const,
      id: 'galgame',
      name: '二次元心动',
      layout: BUILTIN_PROFILES.galgame.layout,
      pattern: BUILTIN_PROFILES.galgame.pattern,
      cfg: null as CustomThemeConfig | null,
    };
  }, [theme, customThemes]);

  /** 有效档位：自定义主题取自身配置；内置主题用内置布置 + 页面细节叠加 */
  const effectiveCfg = useMemo<CustomThemeConfig>(() => {
    if (activeTheme.cfg) return activeTheme.cfg;
    const profile = BUILTIN_PROFILES[activeTheme.id as BuiltinThemeId];
    const meta = THEMES.find((t) => t.id === activeTheme.id);
    const base: CustomThemeConfig = {
      ...DEFAULT_CUSTOM_THEME,
      id: 'page-details',
      name: activeTheme.name,
      base: activeTheme.id === 'dark' ? 'dark' : 'light',
      primary: meta?.swatches[0] ?? DEFAULT_CUSTOM_THEME.primary,
      borderLevel: profile.layout.borderLevel,
      radiusLevel: profile.layout.radiusLevel,
      density: profile.layout.density,
      arrangement: profile.layout.arrangement,
      cardStyle: profile.layout.cardStyle,
      pattern: profile.pattern,
    };
    return {
      ...base,
      timeline: pageDetails.timeline ?? DEFAULT_CUSTOM_THEME.timeline,
      buttonTexture: pageDetails.buttonTexture ?? DEFAULT_CUSTOM_THEME.buttonTexture,
      buttonSize: pageDetails.buttonSize ?? DEFAULT_CUSTOM_THEME.buttonSize,
      fontColor: pageDetails.fontColor ?? '',
      fontSizeLevel: pageDetails.fontSizeLevel ?? 'standard',
      fontFamily: pageDetails.fontFamily ?? 'system',
      zones: pageDetails.zones ?? DEFAULT_CUSTOM_THEME.zones,
    };
  }, [activeTheme, pageDetails]);

  /** 主题变量：自定义主题注入完整变量；内置主题注入边框/密度布局变量 */
  const themeVars = useMemo(() => {
    if (activeTheme.cfg) return buildCustomThemeVars(activeTheme.cfg) as CSSProperties;
    const profile = BUILTIN_PROFILES[activeTheme.id as BuiltinThemeId];
    const layout = profile.layout;
    const borderColor = layout.borderLevel === 'none' ? 'transparent' : 'var(--border)';
    return { ...buildLayoutVars(layout, borderColor), ...buildDetailVars(effectiveCfg) } as CSSProperties;
  }, [activeTheme, effectiveCfg]);

  const notifyTheme = useCallback((msg: string) => {
    setThemeToast(msg);
    if (themeToastTimerRef.current !== null) window.clearTimeout(themeToastTimerRef.current);
    themeToastTimerRef.current = window.setTimeout(() => setThemeToast(''), 1800);
  }, []);

  /** 当前页面方案名：顶栏徽标展示 */
  const activePresetName = useMemo(() => {
    const p = pagePresets.find((x) => x.id === activePresetId);
    return p ? p.name : '未命名页面';
  }, [pagePresets, activePresetId]);

  /** 保存页面方案：同名（或未改名）时覆盖当前方案，否则另存为新方案 */
  const handleSavePreset = useCallback(
    (name: string) => {
      const snapshot: CustomThemeConfig = { ...effectiveCfg, id: '', name: '' };
      const finalName = name.trim() || activePresetName;
      const existing = activePresetId ? pagePresets.find((p) => p.id === activePresetId) : undefined;
      if (existing && (name.trim() === '' || existing.name === name.trim())) {
        setPagePresets((prev) =>
          prev.map((p) => (p.id === existing.id ? { ...p, name: finalName, snapshot, updatedAt: Date.now() } : p)),
        );
        notifyTheme(`已更新页面方案「${finalName}」`);
        return;
      }
      const np: PagePreset = {
        id: createPagePresetId(),
        name: finalName,
        themeId: theme,
        snapshot,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setPagePresets((prev) => [...prev, np]);
      setActivePresetId(np.id);
      notifyTheme(`已保存页面方案「${finalName}」`);
    },
    [effectiveCfg, activePresetId, activePresetName, pagePresets, theme, notifyTheme],
  );

  /** 覆盖指定存档为当前设置 */
  const handleUpdatePreset = useCallback(
    (id: string) => {
      const snapshot: CustomThemeConfig = { ...effectiveCfg, id: '', name: '' };
      setPagePresets((prev) => prev.map((p) => (p.id === id ? { ...p, snapshot, updatedAt: Date.now() } : p)));
      const p = pagePresets.find((x) => x.id === id);
      notifyTheme(`已覆盖方案「${p?.name ?? ''}」`);
    },
    [effectiveCfg, pagePresets, notifyTheme],
  );

  /** 一键切换页面方案：恢复整套设置 */
  const handleApplyPreset = useCallback(
    (id: string) => {
      const p = pagePresets.find((x) => x.id === id);
      if (!p) return;
      if (isBuiltinThemeId(p.themeId)) {
        setTheme(p.themeId);
        setPageDetails((prev) => ({
          ...prev,
          timeline: p.snapshot.timeline ?? DEFAULT_CUSTOM_THEME.timeline,
          buttonTexture: p.snapshot.buttonTexture ?? DEFAULT_CUSTOM_THEME.buttonTexture,
          buttonSize: p.snapshot.buttonSize ?? DEFAULT_CUSTOM_THEME.buttonSize,
          fontColor: p.snapshot.fontColor ?? '',
          fontSizeLevel: p.snapshot.fontSizeLevel ?? 'standard',
          fontFamily: p.snapshot.fontFamily ?? 'system',
          zones: p.snapshot.zones ?? DEFAULT_CUSTOM_THEME.zones,
        }));
      } else {
        const inList = customThemes.some((t) => t.id === p.themeId);
        if (inList) {
          setTheme(p.themeId);
        } else {
          const restored: CustomThemeConfig = {
            ...p.snapshot,
            id: p.themeId,
            name: p.snapshot.name.trim() || '恢复主题',
          };
          setCustomThemes((prev) => [...prev, restored]);
          setTheme(p.themeId);
        }
      }
      setActivePresetId(id);
      notifyTheme(`已应用页面方案「${p.name}」`);
      setThemeOpen(false);
    },
    [pagePresets, customThemes, notifyTheme],
  );

  const handleDeletePreset = useCallback(
    (id: string) => {
      setPagePresets((prev) => prev.filter((p) => p.id !== id));
      if (activePresetId === id) setActivePresetId('');
      notifyTheme('已删除页面方案');
    },
    [activePresetId, notifyTheme],
  );

  /** 导入页面方案备份：合并（保留现有、重名自动改名）或覆盖（替换全部） */
  const handleImportBackup = useCallback(
    (payload: BackupPayload, mode: 'merge' | 'replace') => {
      const now = Date.now();
      if (mode === 'replace') {
        setCustomThemes(payload.customThemes);
        setPagePresets(payload.pagePresets);
        if (payload.pageDetails) setPageDetails(payload.pageDetails);
        const activeExists = payload.activePresetId && payload.pagePresets.some((p) => p.id === payload.activePresetId);
        setActivePresetId(activeExists ? payload.activePresetId : '');
        notifyTheme(`已导入 ${payload.pagePresets.length} 套页面方案`);
        return;
      }
      /* 合并：保留现有；id 冲突重新生成，重名自动加后缀，主题引用同步映射 */
      const themeIdMap: Record<string, string> = {};
      const themeNames = new Set(customThemes.map((t) => t.name.trim()));
      const mergedThemes = [...customThemes];
      payload.customThemes.forEach((t) => {
        let id = t.id;
        if (mergedThemes.some((x) => x.id === id)) id = createCustomThemeId();
        themeIdMap[t.id] = id;
        let nm = t.name.trim() || '导入主题';
        const base = nm;
        let k = 2;
        while (themeNames.has(nm)) {
          nm = `${base}（${k}）`;
          k += 1;
        }
        themeNames.add(nm);
        mergedThemes.push({ ...t, id, name: nm });
      });
      const presetIds = new Set(pagePresets.map((p) => p.id));
      const presetNames = new Set(pagePresets.map((p) => p.name.trim()));
      const mergedPresets = [...pagePresets];
      payload.pagePresets.forEach((p) => {
        let id = p.id;
        if (presetIds.has(id)) id = createPagePresetId();
        presetIds.add(id);
        let nm = p.name.trim() || '导入方案';
        const base = nm;
        let k = 2;
        while (presetNames.has(nm)) {
          nm = `${base}（${k}）`;
          k += 1;
        }
        presetNames.add(nm);
        const themeId = themeIdMap[p.themeId] ?? p.themeId;
        mergedPresets.push({ ...p, id, name: nm, themeId, createdAt: now, updatedAt: now });
      });
      setCustomThemes(mergedThemes);
      setPagePresets(mergedPresets);
      notifyTheme(`已合并导入 ${payload.pagePresets.length} 套页面方案`);
    },
    [customThemes, pagePresets, notifyTheme],
  );

  /** 写操作成功后静默回读当前范围，不打断网格展示 */
  const silentReload = useCallback(async () => {
    try {
      const list = await loadBlocks();
      setBlocks(list);
    } catch {
      // 保留现有数据
    }
  }, [loadBlocks]);

  const handleCreated = useCallback(
    async (block: TimeBlock) => {
      await upsertBlock(block);
      setBlocks((prev) => {
        const others = prev.filter((b) => b.id !== block.id);
        return [...others, block].sort((a, b) => a.recordDate.localeCompare(b.recordDate) || a.startMinute - b.startMinute);
      });
      setSheet(null);
      setEditingBlock(null);
      setQuickPrefill(null);
      void silentReload();
    },
    [silentReload],
  );

  /** AI 输入：批量保存时间块 */
  const handleAiSaveBlocks = useCallback(
    async (blocks: TimeBlock[]) => {
      for (const b of blocks) await upsertBlock(b);
      setBlocks((prev) => {
        const ids = new Set(blocks.map((b) => b.id));
        const others = prev.filter((p) => !ids.has(p.id));
        return [...others, ...blocks].sort((a, b) => a.recordDate.localeCompare(b.recordDate) || a.startMinute - b.startMinute);
      });
      void silentReload();
    },
    [silentReload],
  );

  /** AI 输入：合并到目标日期当天的每日面板（心情 / 任务 / 重要事项 / 小结）。
   *  任务与重要事项按内容去重；落在当前查看日期时自动展开面板并高亮新增条目。 */
  const handleAiSavePanel = useCallback(
    (date: string, patch: { mood?: string; tasks?: DailyTask[]; important?: string[]; summary?: string }) => {
      const cur = loadPanel(date);
      const curTaskTexts = new Set(cur.tasks.map((t) => t.text.trim()));
      const addedTasks = (patch.tasks ?? []).filter((t) => !curTaskTexts.has(t.text.trim()));
      const curImportantTexts = new Set(cur.important.map((i) => i.trim()));
      const addedImportant = (patch.important ?? []).filter((i) => !curImportantTexts.has(i.trim()));
      const next: DailyPanel = {
        mood: patch.mood && patch.mood.trim() ? patch.mood.trim() : cur.mood,
        important: [...cur.important, ...addedImportant],
        tasks: [...cur.tasks, ...addedTasks],
        summary: patch.summary && patch.summary.trim() ? patch.summary.trim() : cur.summary,
      };
      savePanel(date, next);
      setPanelRefreshKey((k) => k + 1);
      if (date === currentDate && (addedTasks.length > 0 || addedImportant.length > 0)) {
        setDrawerOpen(true);
        setHighlightNew({ taskIds: addedTasks.map((t) => t.id), important: addedImportant });
        if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = window.setTimeout(() => {
          setHighlightNew({ taskIds: [], important: [] });
          highlightTimerRef.current = null;
        }, 3800);
        window.setTimeout(() => {
          panelAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 80);
      }
    },
    [currentDate],
  );

  /** 一句话主题配置：应用 AI 解析出的主题参数（只落在现有方案与可调参数范围内） */
  const handleAiThemeApply = useCallback(
    (r: AiThemeIntent) => {
      if (isBuiltinThemeId(r.builtinId)) {
        setTheme(r.builtinId);
      }
      const patch: Partial<CustomThemeConfig> = {};
      if (r.base) patch.base = r.base;
      if (r.primary) patch.primary = r.primary;
      if (r.radiusLevel) patch.radiusLevel = r.radiusLevel;
      if (r.density) patch.density = r.density;
      if (r.borderLevel) patch.borderLevel = r.borderLevel;
      if (r.cardStyle) patch.cardStyle = r.cardStyle;
      if (r.pattern) patch.pattern = r.pattern;
      if (r.fontFamily) patch.fontFamily = r.fontFamily;
      if (r.fontSizeLevel) patch.fontSizeLevel = r.fontSizeLevel;
      const hasPatch = Object.keys(patch).length > 0;
      if (hasPatch) {
        if (isBuiltinThemeId(theme)) {
          setPageDetails((prev) => ({ ...prev, ...patch }));
        } else {
          setCustomThemes((prev) => prev.map((t) => (t.id === theme ? { ...t, ...patch } : t)));
        }
      }
      notifyTheme(r.description || '已应用主题配置');
    },
    [theme, notifyTheme],
  );

  const handleMove = useCallback(
    (blockId: string, date: string, startMinute: number, endMinute: number) => {
      void (async () => {
        const block = blocks.find((b) => b.id === blockId);
        if (!block) return;
        try {
          const next = { ...block, recordDate: date, startMinute, endMinute, updatedAt: Date.now() };
          await upsertBlock(next);
          setBlocks((prev) => {
            const others = prev.filter((b) => b.id !== blockId);
            return [...others, next].sort((a, b) => a.recordDate.localeCompare(b.recordDate) || a.startMinute - b.startMinute);
          });
        } catch {
          setBlocksError('保存失败，请重试');
          void refreshBlocks();
        }
      })();
    },
    [blocks, refreshBlocks],
  );

  const handleResize = useCallback(
    (blockId: string, startMinute: number, endMinute: number) => {
      void (async () => {
        const block = blocks.find((b) => b.id === blockId);
        if (!block) return;
        try {
          const next = { ...block, startMinute, endMinute, updatedAt: Date.now() };
          await upsertBlock(next);
          setBlocks((prev) => prev.map((b) => (b.id === blockId ? next : b)));
        } catch {
          setBlocksError('保存失败，请重试');
          void refreshBlocks();
        }
      })();
    },
    [blocks, refreshBlocks],
  );

  const handleDeleteBlock = useCallback(
    async (id: string) => {
      await deleteBlock(id);
      setBlocks((prev) => prev.filter((b) => b.id !== id));
      setSheet(null);
      setEditingBlock(null);
      void silentReload();
    },
    [silentReload],
  );

  const handleTagSave = useCallback(
    async (tag: Tag) => {
      await upsertTag(tag);
      setTags((prev) => {
        const others = prev.filter((t) => t.id !== tag.id);
        return [...others, tag].sort((a, b) => a.sortOrder - b.sortOrder);
      });
      void refreshTags();
    },
    [refreshTags],
  );

  const handleTagDelete = useCallback(
    async (tag: Tag) => {
      const children = tags.filter((t) => t.parentId === tag.id).map((t) => t.id);
      await deleteTagWithBlocks(tag.id, children);
      setTags((prev) => prev.filter((t) => t.id !== tag.id && !children.includes(t.id)));
      if (activeFilter === tag.id || children.includes(activeFilter ?? '')) {
        setActiveFilter(null);
      }
      void refreshTags();
      void silentReload();
    },
    [tags, activeFilter, refreshTags, silentReload],
  );

  const openQuick = useCallback(
    (prefill: { date: string; startMinute: number; endMinute: number; title?: string } | null = null, voice = false) => {
      setQuickPrefill(prefill);
      setAutoVoice(voice);
      setSheet('quick');
    },
    [],
  );

  /** 打开 AI 输入面板（语音入口自动开始聆听） */
  const openAi = useCallback((voice = false) => {
    setAiAutoVoice(voice);
    setSheet('ai');
  }, []);

  const openDraft = useCallback((date: string, startMinute: number, endMinute: number) => {
    setEditingBlock({
      id: '',
      title: '新时间块',
      recordDate: date,
      startMinute,
      endMinute,
      tagId: '',
      note: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setSheet('edit');
  }, []);

  const openEdit = useCallback((block: TimeBlock) => {
    setEditingBlock(block);
    setSheet('edit');
  }, []);

  /** 周视图触底时向前扩展 7 天，最多扩展 84 天 */
  const handleLoadEarlier = useCallback(() => {
    setWeekExtra((prev) => Math.min(prev + 7, 84));
  }, []);

  /** 每日面板任务排期：预填标题打开快速添加 */
  const handleDropSchedule = useCallback(
    (title: string, date: string, startMinute: number, endMinute: number) => {
      openQuick({ date, startMinute, endMinute, title });
    },
    [openQuick],
  );

  /** 套用排期模板：为指定日期批量生成时间块，并跳转到该日期方便微调 */
  const handleApplyTemplate = useCallback(
    async (template: ScheduleTemplate, date: string) => {
      if (applyingTemplate) return;
      setApplyingTemplate(true);
      try {
        const now = Date.now();
        for (const tb of template.blocks) {
          const tag = tb.tagName ? tags.find((t) => t.name === tb.tagName) : undefined;
          const block: TimeBlock = {
            id: createBlockId(),
            title: tb.title,
            recordDate: date,
            startMinute: tb.startMinute,
            endMinute: tb.endMinute,
            tagId: tag?.id ?? '',
            note: tb.note,
            createdAt: now,
            updatedAt: now,
          };
          await upsertBlock(block);
        }
        setBlocks((prev) => [...prev]);
        setCurrentDate(date);
        setSheet(null);
        notifyTheme(`已套用「${template.name}」到 ${fmtDateCN(date)}`);
        void silentReload();
      } catch {
        setBlocksError('套用模板失败，请重试');
      } finally {
        setApplyingTemplate(false);
      }
    },
    [applyingTemplate, tags, silentReload, notifyTheme],
  );

  const handleExport = useCallback(
    async (scope: ExportScope, format: ExportFormat) => {
      if (exporting) return;
      setExporting(true);
      setExportError(null);
      setExportDone(false);
      try {
        let text = '';
        let fileName = '';
        let start: string;
        let end: string;
        let rangeDates: string[];
        let title: string;
        let baseName: string;
        if (scope === 'week') {
          const week = getWeekDates(currentDate, weekDays);
          start = week[0];
          end = week[week.length - 1];
          rangeDates = week;
          title = `时间块清单（${fmtDateCN(start)} 至 ${fmtDateCN(end)}）`;
          baseName = `${start.replace(/-/g, '')}-${end.replace(/-/g, '')}`;
        } else if (scope === 'month') {
          start = monthRange[0];
          end = monthRange[1];
          rangeDates = getDateList(start, end);
          title = `时间块清单（${fmtDateCN(start)} 至 ${fmtDateCN(end)}）`;
          baseName = start.slice(0, 7).replace('-', '');
        } else {
          start = customRange[0];
          end = customRange[1];
          rangeDates = getDateList(start, end);
          title = `时间块清单（${fmtDateCN(start)} 至 ${fmtDateCN(end)}）`;
          baseName = `${start.replace(/-/g, '')}-${end.replace(/-/g, '')}`;
        }
        const scopeBlocks = await loadBlocksByDateRange(start, end);
        if (format === 'detail') {
          text = buildDailyExportText(rangeDates, scopeBlocks, tags, title);
          fileName = `时间块清单_${baseName}.txt`;
        } else {
          text = buildTagSummaryText(rangeDates, scopeBlocks, tags, title);
          fileName = `标签汇总_${baseName}.txt`;
        }
        const data = utf8ToBase64(text);
        await window.lingguang.saveFile({
          data,
          fileName,
        });
        setExportDone(true);
      } catch {
        setExportError('导出失败，请重试');
      } finally {
        setExporting(false);
      }
    },
    [currentDate, monthRange, tags, exporting, weekDays, customRange],
  );

  /** 按周汇总导出趋势图：每周合计时长 + ASCII 趋势图，保存为 txt */
  const handleExportTrend = useCallback(
    async (scope: ExportScope) => {
      if (exportingTrend) return;
      setExportingTrend(true);
      setExportTrendError(null);
      setExportTrendDone(false);
      try {
        let start: string;
        let end: string;
        let rangeDates: string[];
        let title: string;
        let baseName: string;
        if (scope === 'week') {
          const week = getWeekDates(currentDate, weekDays);
          start = week[0];
          end = week[week.length - 1];
          rangeDates = week;
          baseName = `${start.replace(/-/g, '')}-${end.replace(/-/g, '')}`;
        } else if (scope === 'month') {
          start = monthRange[0];
          end = monthRange[1];
          rangeDates = getDateList(start, end);
          baseName = start.slice(0, 7).replace('-', '');
        } else {
          start = customRange[0];
          end = customRange[1];
          rangeDates = getDateList(start, end);
          baseName = `${start.replace(/-/g, '')}-${end.replace(/-/g, '')}`;
        }
        title = `时间块按周趋势（${fmtDateCN(start)} 至 ${fmtDateCN(end)}）`;
        const scopeBlocks = await loadBlocksByDateRange(start, end);
        const text = buildWeekTrendText(rangeDates, scopeBlocks, title);
        const data = utf8ToBase64(text);
        await window.lingguang.saveFile({
          data,
          fileName: `周趋势图_${baseName}.txt`,
        });
        setExportTrendDone(true);
      } catch {
        setExportTrendError('导出失败，请重试');
      } finally {
        setExportingTrend(false);
      }
    },
    [currentDate, monthRange, customRange, weekDays, exportingTrend],
  );

  const shiftDate = (dir: 1 | -1) => {
    setCurrentDate((prev) => fmtDate(addDays(new Date(`${prev}T00:00:00`), dir)));
  };

  const goToday = () => {
    setCurrentDate(todayStr());
  };

  /** 抽屉开合：展开时保证面板一定能弹出到可视区。
   *  若时间轴被拖得过高把面板挤出视口（页面无滚动容器），先恢复默认时间轴高度腾出空间，再滚动对齐。 */
  const handleDrawerOpenChange = useCallback((open: boolean) => {
    setDrawerOpen(open);
    if (!open) return;
    const anchor = panelAnchorRef.current;
    const wrap = dayGridWrapRef.current;
    let resetHeight = false;
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      // 面板整个在视口外，或被压到几乎没有高度：判定为被挤出
      if (r.top >= window.innerHeight - 4 || r.height < 120) resetHeight = true;
    }
    if (resetHeight && wrap) {
      const h = wrap.getBoundingClientRect().height;
      if (h > window.innerHeight * 0.5) setDayGridHeight(null);
    }
    window.setTimeout(() => {
      panelAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, resetHeight ? 200 : 60);
  }, []);

  const onDayResizerDown = (e: RPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const wrap = dayGridWrapRef.current;
    if (!wrap) return;
    resizerDragRef.current = { startY: e.clientY, startH: wrap.getBoundingClientRect().height };
    const onMove = (ev: PointerEvent) => {
      const r = resizerDragRef.current;
      if (!r) return;
      const next = Math.min(Math.max(r.startH + (ev.clientY - r.startY), 150), window.innerHeight * 0.82);
      setDayGridHeight(next);
    };
    const onUp = () => {
      resizerDragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const filterChips = useMemo(() => {
    const parents = tags.filter((t) => !t.parentId);
    const children = tags.filter((t) => t.parentId);
    return [
      { id: '', name: '全部', color: '', level: 0 },
      ...parents.map((t) => ({ id: t.id, name: t.name, color: t.color, level: 0 })),
      ...children.map((t) => ({ id: t.id, name: t.name, color: t.color, level: 1 })),
    ];
  }, [tags]);

  return (
    <div
      id="container"
      className="app-root"
      data-theme={activeTheme.cfg ? activeTheme.cfg.base : activeTheme.id}
      data-layout={activeTheme.layout.arrangement}
      data-cardstyle={activeTheme.layout.cardStyle}
      data-pattern={activeTheme.pattern}
      data-tl-grid={effectiveCfg.timeline?.gridStyle ?? 'horizontal'}
      data-tl-dash={effectiveCfg.timeline?.lineDash ?? 'solid'}
      data-tl-gradient={effectiveCfg.timeline?.lineGradient === true ? '1' : '0'}
      data-btntexture={effectiveCfg.buttonTexture ?? 'solid'}
      data-btnsize={effectiveCfg.buttonSize ?? 'standard'}
      data-fontsize={effectiveCfg.fontSizeLevel ?? 'standard'}
      style={themeVars}
    >
      {/* 背景图层：渐变底色 + 主题图案层（纯样式生成） */}
      <div className="app-bg" aria-hidden="true" />
      <header className={`app-topbar ${headerCollapsed ? 'app-topbar-collapsed' : ''}`}>
        {headerCollapsed ? (
          <div className="topbar-collapsed-row">
            <button
              type="button"
              className="topbar-expand-btn"
              onClick={() => setHeaderCollapsed(false)}
              aria-label="展开顶部功能"
              data-testid="topbar-expand"
            >
              <ChevronDown size={16} strokeWidth={2} /> 展开
            </button>
          </div>
        ) : (
          <>
            <div className="topbar-row1">
              <div className="brand-chip" data-testid="brand-chip" title="刻砂求羽，落砂成羽之刻。">
                <Feather size={14} strokeWidth={2} />
                <span className="brand-chip-name">落砂成羽之刻</span>
              </div>
              <button type="button" className="today-btn" onClick={goToday} data-testid="go-today">
                今天
              </button>
              <div className="date-nav">
                <button type="button" className="icon-btn" onClick={() => shiftDate(-1)} aria-label="前一天/上一周" data-testid="date-prev">
                  <ChevronLeft size={20} strokeWidth={2} />
                </button>
                <span className="date-title" data-testid="date-title">
                  {viewMode === 'day'
                    ? formatDateTitle(currentDate, 'day')
                    : `${fmtDateCN(weekRange[0])} 至 ${fmtDateCN(weekRange[1])}`}
                </span>
                <button type="button" className="icon-btn" onClick={() => shiftDate(1)} aria-label="后一天/下一周" data-testid="date-next">
                  <ChevronRight size={20} strokeWidth={2} />
                </button>
              </div>
              <div className="seg" data-testid="view-seg">
                <button
                  type="button"
                  className={`seg-item ${viewMode === 'day' ? 'seg-active' : ''}`}
                  onClick={() => setViewMode('day')}
                  data-testid="view-day"
                >
                  <CalendarDays size={14} strokeWidth={2} /> 日
                </button>
                <button
                  type="button"
                  className={`seg-item ${viewMode === 'week' ? 'seg-active' : ''}`}
                  onClick={() => setViewMode('week')}
                  data-testid="view-week"
                >
                  <LayoutGrid size={14} strokeWidth={2} /> 周
                </button>
              </div>
              <button
                type="button"
                className="icon-btn topbar-icon"
                onClick={() => setMoreOpen(true)}
                aria-label="更多设置"
                title="更多设置"
                data-testid="open-more"
              >
                <MoreHorizontal size={20} strokeWidth={2} />
              </button>
            </div>
            <div className="topbar-row2">
              <div className="filter-scroll" data-testid="filter-bar">
                {filterChips.map((c) => (
                  <button
                    key={c.id || 'all'}
                    type="button"
                    className={`filter-chip ${activeFilter === c.id ? 'filter-chip-active' : ''} ${c.level === 1 ? 'filter-chip-child' : ''}`}
                    style={activeFilter === c.id && c.color ? ({ background: c.color, borderColor: c.color } as CSSProperties) : undefined}
                    onClick={() => setActiveFilter((prev) => (prev === c.id ? null : c.id))}
                    data-testid={`filter-${c.id || 'all'}`}
                  >
                    {c.color && <span className="filter-dot" style={{ background: c.color }} />}
                    {c.name}
                  </button>
                ))}
                <button type="button" className="filter-chip filter-chip-manage" onClick={() => setSheet('tags')} data-testid="open-tags-manage">
                  <Tags size={13} strokeWidth={2} /> 管理
                </button>
              </div>
            </div>
          </>
        )}
      </header>

      <main className="app-main">
      {viewMode === 'week' ? (
        <TimeGrid
          viewMode={viewMode}
          granularity={granularity}
          currentDate={currentDate}
          weekDays={weekDays}
          weekExtra={weekExtra}
          blocks={blocks}
          tags={tags}
          activeFilterId={activeFilter}
          loading={blocksLoading}
          error={blocksError}
          onRetry={() => void refreshBlocks()}
          onOpenEdit={openEdit}
          onOpenDraft={openDraft}
          onOpenQuickAt={(date, s, e) => openQuick({ date, startMinute: s, endMinute: e })}
          onMove={handleMove}
          onResize={handleResize}
          onGoToday={goToday}
          onLoadEarlier={handleLoadEarlier}
          onDropSchedule={handleDropSchedule}
        />
      ) : (
        <div className="day-layout">
          <div
            className="day-grid-wrap"
            ref={dayGridWrapRef}
            style={dayGridHeight != null ? ({ height: dayGridHeight } as CSSProperties) : undefined}
          >
            <TimeGrid
              viewMode={viewMode}
              granularity={granularity}
              currentDate={currentDate}
              weekDays={weekDays}
              blocks={blocks}
              tags={tags}
              activeFilterId={activeFilter}
              loading={blocksLoading}
              error={blocksError}
              onRetry={() => void refreshBlocks()}
              onOpenEdit={openEdit}
              onOpenDraft={openDraft}
              onOpenQuickAt={(date, s, e) => openQuick({ date, startMinute: s, endMinute: e })}
              onMove={handleMove}
              onResize={handleResize}
              onGoToday={goToday}
              onDropSchedule={handleDropSchedule}
            />
          </div>
          <div
            className="day-resizer"
            data-testid="day-resizer"
            role="separator"
            aria-orientation="horizontal"
            aria-label="拖动调整今日面板高度"
            onPointerDown={onDayResizerDown}
          />
          <div
            className={`day-panel-anchor ${panelMode === 'drawer' && !drawerOpen ? 'day-panel-anchor-collapsed' : ''}`}
            ref={panelAnchorRef}
            data-testid="day-panel-anchor"
          >
            <DailyDashboard
              date={currentDate}
              granularity={granularity}
              onSchedule={handleDropSchedule}
              panelMode={panelMode}
              drawerOpen={drawerOpen}
              onDrawerOpenChange={handleDrawerOpenChange}
              refreshKey={panelRefreshKey}
              highlightNew={highlightNew}
            />
          </div>
        </div>
      )}
      </main>

      <footer className="app-bottombar">
        <button type="button" className="btn btn-primary bottom-main" onClick={() => openQuick()} data-testid="open-quick">
          <Plus size={18} strokeWidth={2.5} /> 快速添加
        </button>
        <button type="button" className="icon-btn bottom-icon" onClick={() => openAi(true)} aria-label="AI 语音输入" data-testid="open-voice">
          <Mic size={20} strokeWidth={2} />
        </button>
      </footer>

      <QuickAddSheet
        open={sheet === 'quick'}
        onClose={() => {
          setSheet(null);
          setQuickPrefill(null);
        }}
        initial={quickPrefill}
        granularity={granularity}
        tags={tags}
        autoVoice={autoVoice}
        onSave={handleCreated}
      />

      <AiInputSheet
        open={sheet === 'ai'}
        onClose={() => setSheet(null)}
        date={currentDate}
        granularity={granularity}
        tags={tags}
        autoVoice={aiAutoVoice}
        onSaveBlocks={handleAiSaveBlocks}
        onSavePanel={handleAiSavePanel}
        onToast={notifyTheme}
      />

      <AssistantSheet
        open={sheet === 'assistant'}
        onClose={() => setSheet(null)}
        date={currentDate}
        tags={tags}
        onToast={notifyTheme}
        onSavePanel={handleAiSavePanel}
      />

      <EditSheet
        open={sheet === 'edit'}
        block={editingBlock}
        granularity={granularity}
        tags={tags}
        onClose={() => {
          setSheet(null);
          setEditingBlock(null);
        }}
        onSave={handleCreated}
        onDelete={handleDeleteBlock}
      />

      <TagManageSheet
        open={sheet === 'tags'}
        tags={tags}
        onClose={() => setSheet(null)}
        onSave={handleTagSave}
        onDelete={handleTagDelete}
      />

      <ThemeSheet
        open={themeOpen}
        theme={theme}
        customThemes={customThemes}
        pageDetails={pageDetails}
        pagePresets={pagePresets}
        activePresetId={activePresetId}
        onPageDetailsChange={setPageDetails}
        onSavePreset={handleSavePreset}
        onUpdatePreset={handleUpdatePreset}
        onApplyPreset={handleApplyPreset}
        onDeletePreset={handleDeletePreset}
        onSelect={(id) => {
          setTheme(id);
          const name = isBuiltinThemeId(id) ? (THEMES.find((t) => t.id === id)?.name ?? '') : (customThemes.find((t) => t.id === id)?.name ?? '');
          notifyTheme(`已应用主题「${name}」`);
          if (isBuiltinThemeId(id)) setThemeOpen(false);
        }}
        onSaveNew={(cfg) => {
          setCustomThemes((prev) => [...prev, cfg]);
          setTheme(cfg.id);
          notifyTheme(`已保存主题「${cfg.name}」`);
        }}
        onUpdate={(cfg) => {
          setCustomThemes((prev) => prev.map((t) => (t.id === cfg.id ? cfg : t)));
        }}
        onDelete={(id) => {
          const next = customThemes.filter((t) => t.id !== id);
          setCustomThemes(next);
          if (theme === id) setTheme(next.length > 0 ? next[0].id : 'canvas');
          notifyTheme('已删除主题');
        }}
        onImportBackup={handleImportBackup}
        onAiApply={handleAiThemeApply}
        onClose={() => setThemeOpen(false)}
      />

      <TemplateSheet
        open={sheet === 'templates'}
        onClose={() => setSheet(null)}
        currentDate={currentDate}
        tags={tags}
        dayBlocks={blocks.filter((b) => b.recordDate === currentDate)}
        onApply={(tpl, date) => void handleApplyTemplate(tpl, date)}
        applying={applyingTemplate}
        onToast={notifyTheme}
      />

      <CoverPage
        open={coverOpen}
        onEnter={() => {
          try {
            window.localStorage.setItem('tb.coverSeen', '1');
          } catch {
            // 忽略持久化失败
          }
          setCoverOpen(false);
        }}
      />

      <Onboarding />

      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        viewMode={viewMode}
        granularity={granularity}
        weekDays={weekDays}
        onGranularityChange={setGranularity}
        onWeekDaysChange={setWeekDays}
        onOpenTheme={() => setThemeOpen(true)}
        onOpenStats={() => setSheet('stats')}
        onOpenTemplates={() => {
          setSheet('templates');
          setMoreOpen(false);
        }}
        onOpenAssistant={() => {
          setSheet('assistant');
          setMoreOpen(false);
        }}
        presetName={activePresetName}
        onOpenCover={() => setCoverOpen(true)}
        panelMode={panelMode}
        drawerOpen={drawerOpen}
        onPanelModeChange={setPanelMode}
        onDrawerToggle={handleDrawerOpenChange}
        headerCollapsed={headerCollapsed}
        onHeaderCollapse={() => setHeaderCollapsed(true)}
      />

      <StatsSheet
        open={sheet === 'stats'}
        onClose={() => setSheet(null)}
        viewMode={viewMode}
        currentDate={currentDate}
        weekDays={weekDays}
        blocks={blocks}
        tags={tags}
        loading={blocksLoading}
        error={blocksError}
        onRetry={() => void refreshBlocks()}
        monthBlocks={monthBlocks}
        monthLoading={monthLoading}
        onLoadMonth={() => void loadMonthBlocks()}
        posterTheme={{ primary: effectiveCfg.primary || '#4F46E5', base: activeTheme.cfg ? (activeTheme.cfg.base === 'dark' ? 'dark' : 'light') : activeTheme.id === 'dark' ? 'dark' : 'light' }}
        onExport={(scope, format) => void handleExport(scope, format)}
        exporting={exporting}
        exportError={exportError}
        exportDone={exportDone}
        onExportTrend={(scope) => void handleExportTrend(scope)}
        exportingTrend={exportingTrend}
        exportTrendError={exportTrendError}
        exportTrendDone={exportTrendDone}
        customDays={customDays}
        onCustomDaysChange={setCustomDays}
        customRange={customRange}
        customBlocks={customBlocks}
        customLoading={customLoading}
        onLoadCustom={() => void loadCustomBlocks()}
      />

      {tagsError && (
        <div className="tags-error" data-testid="tags-error">
          {tagsError}
          <button type="button" className="tg-retry" onClick={() => void refreshTags()} data-testid="tags-retry">
            重试
          </button>
        </div>
      )}

      {themeToast && (
        <div className="app-toast" data-testid="theme-toast">
          {themeToast}
        </div>
      )}
    </div>
  );
}

export default App;