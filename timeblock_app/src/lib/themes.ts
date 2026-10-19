export type BuiltinThemeId = 'canvas' | 'dark' | 'cartoon' | 'galgame' | 'business' | 'minimal';
/** 当前激活主题：内置主题 id 或「我的主题」库里的自定义主题 id */
export type ActiveThemeId = BuiltinThemeId | string;

/** 底色模式：浅色 / 深色 */
export type BaseMode = 'light' | 'dark';
/** 边框样式：无线框 / 细描边 / 加粗描边 */
export type BorderLevel = 'none' | 'thin' | 'bold';
/** 圆角档位：紧凑 / 标准 / 圆润 */
export type RadiusLevel = 'compact' | 'standard' | 'rounded';
/** 卡片密度：紧凑 / 舒适 / 留白 */
export type DensityLevel = 'compact' | 'comfort' | 'spacious';
/** 今日面板卡片排布：双栏（天气+心情并排）/ 单栏 */
export type PanelArrangement = 'duo' | 'single';
/** 卡片质感：实心 / 玻璃 */
export type CardStyle = 'solid' | 'glass';
/** 背景图案层：无 / 点阵网格 / 纸张纹理 / 柔和光斑 / 斜纹 / 网格 / 棋盘 / 布纹 / 波浪 / 圆环 / 半调 */
export type PatternType =
  | 'none'
  | 'dots'
  | 'paper'
  | 'glow'
  | 'stripes'
  | 'grid'
  | 'checker'
  | 'crosshatch'
  | 'waves'
  | 'rings'
  | 'halftone';

/** 时间轴网格样式：横格 / 方格 / 空白 / 点阵 */
export type TimelineGridStyle = 'horizontal' | 'grid' | 'blank' | 'dots';
/** 网格线质感预设：实线 / 虚线 / 点线 / 点划线 */
export type TimelineDashStyle = 'solid' | 'dashed' | 'dotted' | 'dashdot';
/** 渐变方向：横向 / 纵向 / 对角 */
export type GradientDirection = 'horizontal' | 'vertical' | 'diagonal';
/** 按钮质感：实心 / 玻璃 / 渐变 / 描边 */
export type ButtonTexture = 'solid' | 'glass' | 'gradient' | 'outline';
/** 尺寸档位：标准 / 放大 */
export type SizeLevel = 'standard' | 'large';
/** 字体预设 id：系统 / 圆体 / 宋体 / 黑体 / 楷体 / 等宽 */
export type FontFamilyId = 'system' | 'rounded' | 'serif' | 'heiti' | 'kai' | 'mono';
/** 分区微调：顶栏 / 时间轴 / 今日面板 / 底部栏 */
export type ZoneKey = 'topbar' | 'timeline' | 'today' | 'bottom';

/** 单个区域的背景色 / 透明度 / 大小倍率 */
export interface ZoneAdjust {
  /** 背景色（空字符串 = 跟随主题自动） */
  bgColor: string;
  /** 区域透明度（0-100） */
  opacity: number;
  /** 区域大小倍率（80-130，%） */
  scale: number;
}

/** 时间轴区域质感：网格样式 + 背景透明度 + 网格线颜色/透明度/线宽/虚线 */
export interface TimelineStyle {
  gridStyle: TimelineGridStyle;
  /** 时间轴画布背景透明度（0-100） */
  bgOpacity: number;
  /** 网格线颜色（空字符串 = 跟随主题） */
  lineColor: string;
  /** 网格线透明度（0-100） */
  lineOpacity: number;
  /** 网格线宽（1-5 px） */
  lineWidth: number;
  /** 网格线质感预设：实线 / 虚线 / 点线 / 点划线 */
  lineDash: TimelineDashStyle;
  /** 渐变线开关 */
  lineGradient: boolean;
  /** 渐变第二色（空字符串 = 自动推导） */
  lineGradientColor: string;
  /** 渐变方向：横向 / 纵向 / 对角 */
  lineGradientDir: GradientDirection;
  /** 小时刻度字号（10-20 px，半点同步缩放） */
  tickFontSize: number;
  /** 旧版虚线开关（兼容历史存档，读取后迁移到 lineDash） */
  lineDashed?: boolean;
}

export interface ThemeMeta {
  id: BuiltinThemeId;
  name: string;
  desc: string;
  swatches: string[];
}

export const THEMES: ThemeMeta[] = [
  {
    id: 'canvas',
    name: '彩色画布',
    desc: '浅色留白 · 标签彩色氛围 · 玻璃层次',
    swatches: ['#4F46E5', '#0891B2', '#EA580C', '#DB2777', '#CA8A04'],
  },
  {
    id: 'dark',
    name: '深色沉浸',
    desc: '深邃夜空 · 霓虹强调 · 专注不刺眼',
    swatches: ['#7C8CF8', '#34D399', '#F472B6', '#FBBF24', '#0F1217'],
  },
  {
    id: 'cartoon',
    name: '活泼卡通',
    desc: '奶油暖调 · 圆润跳跃 · 元气满满',
    swatches: ['#FF6B4A', '#FFB020', '#22C573', '#8B5CF6', '#FF5DA2'],
  },
  {
    id: 'galgame',
    name: '二次元心动',
    desc: '古早 galgame 味 · 粉彩赛璐璐 · 圆润可爱',
    swatches: ['#F472B6', '#A78BFA', '#FBBF24', '#60A5FA', '#FB923C'],
  },
  {
    id: 'business',
    name: '商务质感',
    desc: '沉稳蓝灰 · 克制精致 · 高效利落',
    swatches: ['#1D4ED8', '#0F766E', '#475569', '#B45309', '#334155'],
  },
  {
    id: 'minimal',
    name: '极简留白',
    desc: '黑白灰阶 · 专注安静 · 少即是多',
    swatches: ['#18181B', '#52525B', '#A1A1AA', '#D4D4D8', '#FAFAFA'],
  },
];

/** 内置主题的布置档位：布局参数 + 背景图案（主题 = 完整布置档位，不再只是换颜色） */
export interface ThemeLayout {
  density: DensityLevel;
  arrangement: PanelArrangement;
  cardStyle: CardStyle;
  borderLevel: BorderLevel;
  radiusLevel: RadiusLevel;
}

export interface BuiltinThemeProfile {
  layout: ThemeLayout;
  pattern: PatternType;
}

export const BUILTIN_PROFILES: Record<BuiltinThemeId, BuiltinThemeProfile> = {
  /* 彩色画布 = 现在的错落双栏 */
  canvas: {
    layout: { density: 'comfort', arrangement: 'duo', cardStyle: 'solid', borderLevel: 'thin', radiusLevel: 'standard' },
    pattern: 'dots',
  },
  /* 深色 = 玻璃层次 */
  dark: {
    layout: { density: 'comfort', arrangement: 'duo', cardStyle: 'glass', borderLevel: 'thin', radiusLevel: 'standard' },
    pattern: 'glow',
  },
  /* 卡通 = 双栏圆润粗描边 */
  cartoon: {
    layout: { density: 'comfort', arrangement: 'duo', cardStyle: 'solid', borderLevel: 'bold', radiusLevel: 'rounded' },
    pattern: 'dots',
  },
  /* 二次元心动 = 玻璃双栏大圆角 + 粉紫光斑 */
  galgame: {
    layout: { density: 'comfort', arrangement: 'duo', cardStyle: 'glass', borderLevel: 'bold', radiusLevel: 'rounded' },
    pattern: 'glow',
  },
  /* 商务 = 切角紧凑 */
  business: {
    layout: { density: 'compact', arrangement: 'duo', cardStyle: 'solid', borderLevel: 'thin', radiusLevel: 'compact' },
    pattern: 'stripes',
  },
  /* 极简 = 单栏窄距细描边 */
  minimal: {
    layout: { density: 'compact', arrangement: 'single', cardStyle: 'solid', borderLevel: 'thin', radiusLevel: 'compact' },
    pattern: 'paper',
  },
};

/** 迷你预览卡使用的主题底色 / 卡片色 */
export const PREVIEW_COLORS: Record<BuiltinThemeId, { bg: string; card: string; border: string; text: string }> = {
  canvas: { bg: '#f7f6f2', card: '#ffffff', border: '#e8e4dc', text: '#211f1b' },
  dark: { bg: '#0f1217', card: '#161b23', border: '#252d39', text: '#e8ecf2' },
  cartoon: { bg: '#fff6e8', card: '#ffffff', border: '#ffd9b6', text: '#3b2f2a' },
  galgame: { bg: '#fff1f6', card: '#ffffff', border: '#ffd3e4', text: '#4a3b4a' },
  business: { bg: '#f2f4f7', card: '#ffffff', border: '#dbe1ea', text: '#1f2937' },
  minimal: { bg: '#fafafa', card: '#ffffff', border: '#e8e8ea', text: '#111113' },
};

/* ============ 自定义主题档位 ============ */

export interface CustomThemeConfig {
  id: string;
  name: string;
  base: BaseMode;
  primary: string;
  borderLevel: BorderLevel;
  radiusLevel: RadiusLevel;
  density: DensityLevel;
  arrangement: PanelArrangement;
  cardStyle: CardStyle;
  pattern: PatternType;
  /** 背景图案透明度（0-100） */
  patternOpacity: number;
  /** 按钮透明度（0-100） */
  btnOpacity: number;
  /** 自定义背景图片 URL（空表示未设置） */
  bgImage: string;
  /** 背景图片透明度（0-100） */
  bgImageOpacity: number;
  /** 背景图片模糊度（0-40，单位 px） */
  bgImageBlur: number;
  /** 时间轴区域质感 */
  timeline: TimelineStyle;
  /** 按钮质感档位 */
  buttonTexture: ButtonTexture;
  /** 按钮尺寸档位 */
  buttonSize: SizeLevel;
  /** 渐变按钮：渐变第二色（空字符串 = 跟随主色加深） */
  btnGradientColor: string;
  /** 渐变按钮：渐变方向 */
  btnGradientDir: GradientDirection;
  /** 渐变按钮：第二色过渡位置（0-100，%） */
  btnGradientStop: number;
  /** 玻璃按钮：玻璃程度（0-100，模糊 + 透明度组合） */
  btnGlassLevel: number;
  /** 描边按钮：描边粗细（1-4 px） */
  btnOutlineWidth: number;
  /** 全局字体颜色（空字符串 = 跟随主题） */
  fontColor: string;
  /** 全局字号档位 */
  fontSizeLevel: SizeLevel;
  /** 字体预设（系统默认 / 圆体 / 宋体 / 黑体 / 楷体 / 等宽） */
  fontFamily: FontFamilyId;
  /** 顶栏 / 时间轴 / 今日面板 / 底部栏 分区微调 */
  zones: Record<ZoneKey, ZoneAdjust>;
}

export const DEFAULT_CUSTOM_THEME: CustomThemeConfig = {
  id: '',
  name: '未命名主题',
  base: 'light',
  primary: '#4F46E5',
  borderLevel: 'thin',
  radiusLevel: 'standard',
  density: 'comfort',
  arrangement: 'duo',
  cardStyle: 'solid',
  pattern: 'dots',
  patternOpacity: 100,
  btnOpacity: 100,
  bgImage: '',
  bgImageOpacity: 40,
  bgImageBlur: 0,
  timeline: {
    gridStyle: 'horizontal',
    bgOpacity: 100,
    lineColor: '',
    lineOpacity: 100,
    lineWidth: 1,
    lineDash: 'solid',
    lineGradient: false,
    lineGradientColor: '',
    lineGradientDir: 'horizontal',
    tickFontSize: 12,
    lineDashed: false,
  },
  buttonTexture: 'solid',
  buttonSize: 'standard',
  btnGradientColor: '',
  btnGradientDir: 'diagonal',
  btnGradientStop: 100,
  btnGlassLevel: 50,
  btnOutlineWidth: 2,
  fontColor: '',
  fontSizeLevel: 'standard',
  fontFamily: 'system',
  zones: {
    topbar: { bgColor: '', opacity: 100, scale: 100 },
    timeline: { bgColor: '', opacity: 100, scale: 100 },
    today: { bgColor: '', opacity: 100, scale: 100 },
    bottom: { bgColor: '', opacity: 100, scale: 100 },
  },
};

export const CUSTOM_PRIMARY_PRESETS: string[] = [
  '#4F46E5',
  '#7C3AED',
  '#DB2777',
  '#EA580C',
  '#CA8A04',
  '#0891B2',
  '#0E9F6E',
  '#1D4ED8',
  '#B42318',
  '#0F172A',
];

export const BORDER_LEVEL_OPTIONS: { value: BorderLevel; label: string }[] = [
  { value: 'none', label: '无线框' },
  { value: 'thin', label: '细描边' },
  { value: 'bold', label: '加粗' },
];

export const RADIUS_LEVEL_OPTIONS: { value: RadiusLevel; label: string }[] = [
  { value: 'compact', label: '紧凑' },
  { value: 'standard', label: '标准' },
  { value: 'rounded', label: '圆润' },
];

export const DENSITY_LEVEL_OPTIONS: { value: DensityLevel; label: string }[] = [
  { value: 'compact', label: '紧凑' },
  { value: 'comfort', label: '舒适' },
  { value: 'spacious', label: '留白' },
];

export const ARRANGEMENT_OPTIONS: { value: PanelArrangement; label: string }[] = [
  { value: 'duo', label: '双栏' },
  { value: 'single', label: '单栏' },
];

export const CARD_STYLE_OPTIONS: { value: CardStyle; label: string }[] = [
  { value: 'solid', label: '实心' },
  { value: 'glass', label: '玻璃' },
];

export const PATTERN_OPTIONS: { value: PatternType; label: string }[] = [
  { value: 'none', label: '无' },
  { value: 'dots', label: '点阵' },
  { value: 'paper', label: '纸张' },
  { value: 'glow', label: '光斑' },
  { value: 'stripes', label: '斜纹' },
  { value: 'grid', label: '网格' },
  { value: 'checker', label: '棋盘' },
  { value: 'crosshatch', label: '布纹' },
  { value: 'waves', label: '波浪' },
  { value: 'rings', label: '圆环' },
  { value: 'halftone', label: '半调' },
];

export const TIMELINE_GRID_OPTIONS: { value: TimelineGridStyle; label: string }[] = [
  { value: 'horizontal', label: '横格' },
  { value: 'grid', label: '方格' },
  { value: 'blank', label: '空白' },
  { value: 'dots', label: '点阵' },
];

export const BUTTON_TEXTURE_OPTIONS: { value: ButtonTexture; label: string }[] = [
  { value: 'solid', label: '实心' },
  { value: 'glass', label: '玻璃' },
  { value: 'gradient', label: '渐变' },
  { value: 'outline', label: '描边' },
];

export const SIZE_LEVEL_OPTIONS: { value: SizeLevel; label: string }[] = [
  { value: 'standard', label: '标准' },
  { value: 'large', label: '放大' },
];

export const LINE_WIDTH_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '极细' },
  { value: '2', label: '细' },
  { value: '3', label: '中' },
  { value: '4', label: '粗' },
  { value: '5', label: '特粗' },
];

export const TIMELINE_DASH_OPTIONS: { value: TimelineDashStyle; label: string }[] = [
  { value: 'solid', label: '实线' },
  { value: 'dashed', label: '虚线' },
  { value: 'dotted', label: '点线' },
  { value: 'dashdot', label: '点划线' },
];

export const GRADIENT_DIR_OPTIONS: { value: GradientDirection; label: string }[] = [
  { value: 'horizontal', label: '横向' },
  { value: 'vertical', label: '纵向' },
  { value: 'diagonal', label: '对角' },
];

export const FONT_PRESETS: { value: FontFamilyId; label: string; stack: string }[] = [
  {
    value: 'system',
    label: '系统',
    stack: "'PingFang SC', 'HarmonyOS Sans SC', 'Segoe UI', system-ui, -apple-system, sans-serif",
  },
  {
    value: 'rounded',
    label: '圆体',
    stack: "'Yuanti SC', 'YouYuan', 'HarmonyOS Sans SC', 'PingFang SC', system-ui, sans-serif",
  },
  {
    value: 'serif',
    label: '宋体',
    stack: "'Songti SC', 'STSong', 'SimSun', 'Noto Serif CJK SC', serif",
  },
  {
    value: 'heiti',
    label: '黑体',
    stack: "'Heiti SC', 'SimHei', 'Noto Sans CJK SC', 'PingFang SC', sans-serif",
  },
  {
    value: 'kai',
    label: '楷体',
    stack: "'Kaiti SC', 'STKaiti', 'KaiTi', 'Noto Serif CJK SC', serif",
  },
  {
    value: 'mono',
    label: '等宽',
    stack: "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, monospace",
  },
];

export function fontStack(id: FontFamilyId): string {
  return FONT_PRESETS.find((f) => f.value === id)?.stack ?? FONT_PRESETS[0].stack;
}

export function isFontFamilyId(value: unknown): value is FontFamilyId {
  return typeof value === 'string' && FONT_PRESETS.some((f) => f.value === value);
}

export const ZONE_KEYS: ZoneKey[] = ['topbar', 'timeline', 'today', 'bottom'];

export const ZONE_LABELS: Record<ZoneKey, string> = {
  topbar: '顶栏',
  timeline: '时间轴',
  today: '今日面板',
  bottom: '底部栏',
};

/** 圆角档位 → 圆角变量值 */
export const RADIUS_BY_LEVEL: Record<RadiusLevel, { card: number; block: number; drawer: number; btn: number }> = {
  compact: { card: 12, block: 8, drawer: 16, btn: 10 },
  standard: { card: 18, block: 14, drawer: 24, btn: 999 },
  rounded: { card: 26, block: 20, drawer: 30, btn: 999 },
};

/** 密度档位 → 卡片内边距 / 间隙 / 面板间距 */
export const DENSITY_BY_LEVEL: Record<DensityLevel, { pad: number; gap: number; panelGap: number }> = {
  compact: { pad: 10, gap: 8, panelGap: 10 },
  comfort: { pad: 14, gap: 12, panelGap: 12 },
  spacious: { pad: 18, gap: 16, panelGap: 16 },
};

/** 布局档位 → CSS 变量（边框线宽、卡片内边距、间隙） */
export function buildLayoutVars(layout: Pick<ThemeLayout, 'borderLevel' | 'density'>, borderColor: string): Record<string, string> {
  const d = DENSITY_BY_LEVEL[layout.density];
  return {
    '--card-border-width': layout.borderLevel === 'none' ? '0px' : layout.borderLevel === 'bold' ? '2px' : '1px',
    '--card-border-color': borderColor,
    '--card-pad': `${d.pad}px`,
    '--card-gap': `${d.gap}px`,
    '--panel-gap': `${d.panelGap}px`,
  };
}

/** 背景图案层（纯 CSS 生成，不引入外部素材） */
export function buildPatternLayer(type: PatternType, c1: string, c2: string): { image: string; size: string } {
  switch (type) {
    case 'dots':
      return { image: `radial-gradient(circle, ${c1} 1.1px, transparent 1.5px)`, size: '18px 18px' };
    case 'paper':
      return {
        image:
          `repeating-linear-gradient(0deg, ${c1} 0px, ${c1} 1px, transparent 1px, transparent 3px), ` +
          `repeating-linear-gradient(90deg, ${c1} 0px, ${c1} 1px, transparent 1px, transparent 3px)`,
        size: '4px 4px',
      };
    case 'glow':
      return {
        image:
          `radial-gradient(560px 420px at 18% 6%, ${c1} 0%, transparent 62%), ` +
          `radial-gradient(480px 380px at 84% 16%, ${c2} 0%, transparent 60%), ` +
          `radial-gradient(600px 480px at 52% 96%, ${c1} 0%, transparent 64%)`,
        size: 'auto',
      };
    case 'stripes':
      return { image: `repeating-linear-gradient(135deg, ${c1} 0px, ${c1} 1.5px, transparent 1.5px, transparent 13px)`, size: 'auto' };
    case 'grid':
      return {
        image:
          `repeating-linear-gradient(0deg, ${c1} 0px, ${c1} 1px, transparent 1px, transparent 22px), ` +
          `repeating-linear-gradient(90deg, ${c1} 0px, ${c1} 1px, transparent 1px, transparent 22px)`,
        size: '22px 22px',
      };
    case 'checker':
      return { image: `conic-gradient(${c1} 0 25%, transparent 0 50%, ${c1} 0 75%, transparent 0)`, size: '18px 18px' };
    case 'crosshatch':
      return {
        image:
          `repeating-linear-gradient(45deg, ${c1} 0px, ${c1} 1px, transparent 1px, transparent 10px), ` +
          `repeating-linear-gradient(-45deg, ${c1} 0px, ${c1} 1px, transparent 1px, transparent 10px)`,
        size: 'auto',
      };
    case 'waves':
      return {
        image:
          `radial-gradient(circle at 6px 5px, ${c1} 1.5px, transparent 2.1px), ` +
          `radial-gradient(circle at 18px 13px, ${c1} 1.5px, transparent 2.1px), ` +
          `radial-gradient(circle at 30px 5px, ${c1} 1.5px, transparent 2.1px)`,
        size: '36px 18px',
      };
    case 'rings':
      return { image: `radial-gradient(circle, transparent 3px, ${c1} 3px 4px, transparent 4px 7px)`, size: '28px 28px' };
    case 'halftone':
      return {
        image:
          `radial-gradient(circle at 5px 5px, ${c1} 1.6px, transparent 2.2px), ` +
          `radial-gradient(circle at 15px 15px, ${c1} 0.8px, transparent 1.4px)`,
        size: '20px 20px',
      };
    case 'none':
    default:
      return { image: 'none', size: 'auto' };
  }
}

/* ============ 颜色工具 ============ */

export function normalizeHex(input: string): string | null {
  let v = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(v)) {
    v = v
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
  return `#${v.toLowerCase()}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHex(hex) ?? DEFAULT_CUSTOM_THEME.primary;
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

/** 把 a 色向 b 色混合，t 为 b 的权重（0-1），返回 #RRGGBB */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(Math.round(ca.r + (cb.r - ca.r) * t))}${to2(Math.round(ca.g + (cb.g - ca.g) * t))}${to2(
    Math.round(ca.b + (cb.b - ca.b) * t),
  )}`;
}

function rgba(hex: string, alpha: number): string {
  const c = hexToRgb(hex);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

function luminance(hex: string): number {
  const c = hexToRgb(hex);
  return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255;
}

export function createCustomThemeId(): string {
  return `custom_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* ============ 自定义主题变量生成 ============ */

/** 浅色底（对齐「彩色画布」的基础变量） */
const LIGHT_BASE_VARS: Record<string, string> = {
  '--bg': '#f7f6f2',
  '--bg-gradient': 'linear-gradient(180deg, #f1edf8 0%, #faf9f6 38%, #faf9f6 100%)',
  '--canvas-bg': '#f4f3ef',
  '--card-bg': '#ffffff',
  '--surface-1': '#f6f5f1',
  '--surface-2': '#efede8',
  '--surface-2-strong': '#e7e4dd',
  '--surface-3': '#f2f1ec',
  '--border': '#e8e4dc',
  '--divider': '#f0ede6',
  '--divider-soft': '#ede9e2',
  '--text': '#211f1b',
  '--text-2': '#78726a',
  '--text-3': '#a8a29a',
  '--danger': '#e5484d',
  '--danger-tint': '#fdeeee',
  '--danger-border': '#f6c9cb',
  '--danger-text': '#b42324',
  '--danger-deep': '#7a1a1a',
  '--danger-tint-2': '#fbe9e9',
  '--danger-tint-3': '#fdf3f3',
  '--success': '#0e9f6e',
  '--glass': 'rgba(255, 255, 255, 0.96)',
  '--glass-soft': 'rgba(255, 255, 255, 0.92)',
  '--glass-2': 'rgba(255, 255, 255, 0.9)',
  '--glass-3': 'rgba(255, 255, 255, 0.85)',
  '--bg-glass': 'rgba(247, 246, 242, 0.96)',
  '--grid-bg': 'rgba(253, 252, 250, 0.82)',
  '--grid-minor': '#ece8e0',
  '--grid-major': '#e2ddd3',
  '--canvas-dot': '#ddd8ce',
  '--week-sep': '#c9c2b6',
  '--resizer': '#d6d1c8',
  '--grip': '#bab3a9',
  '--shadow-1': 'rgba(33, 31, 27, 0.08)',
  '--shadow-2': 'rgba(33, 31, 27, 0.12)',
  '--shadow-float': 'rgba(16, 24, 40, 0.12)',
  '--mask': 'rgba(33, 31, 27, 0.18)',
  '--mask-strong': 'rgba(33, 31, 27, 0.42)',
  '--overlay-strong': 'rgba(33, 31, 27, 0.82)',
  '--toast-bg': 'rgba(33, 31, 27, 0.92)',
  '--pattern-color': 'rgba(79, 70, 229, 0.07)',
  '--pattern-color-2': 'rgba(8, 145, 178, 0.05)',
  '--radius-card': '18px',
  '--radius-block': '14px',
  '--radius-drawer': '24px',
  '--radius-btn': '999px',
};

/** 深色底（对齐「深色沉浸」的基础变量） */
const DARK_BASE_VARS: Record<string, string> = {
  '--bg': '#0f1217',
  '--bg-gradient': 'linear-gradient(180deg, #151b26 0%, #0f1217 45%, #0c0f13 100%)',
  '--canvas-bg': '#0d1015',
  '--card-bg': '#161b23',
  '--surface-1': '#1a2029',
  '--surface-2': '#1f2631',
  '--surface-2-strong': '#272f3c',
  '--surface-3': '#202630',
  '--border': '#252d39',
  '--divider': '#1c222c',
  '--divider-soft': '#212731',
  '--text': '#e8ecf2',
  '--text-2': '#9aa4b2',
  '--text-3': '#5f6b7a',
  '--danger': '#f2555a',
  '--danger-tint': 'rgba(242, 85, 90, 0.14)',
  '--danger-border': 'rgba(242, 85, 90, 0.4)',
  '--danger-text': '#ff8a8e',
  '--danger-deep': '#ffb3b5',
  '--danger-tint-2': 'rgba(242, 85, 90, 0.12)',
  '--danger-tint-3': 'rgba(242, 85, 90, 0.08)',
  '--success': '#34d399',
  '--glass': 'rgba(22, 27, 35, 0.96)',
  '--glass-soft': 'rgba(22, 27, 35, 0.92)',
  '--glass-2': 'rgba(22, 27, 35, 0.9)',
  '--glass-3': 'rgba(22, 27, 35, 0.85)',
  '--bg-glass': 'rgba(15, 18, 23, 0.96)',
  '--grid-bg': 'rgba(19, 24, 31, 0.82)',
  '--grid-minor': '#1b212b',
  '--grid-major': '#242c38',
  '--canvas-dot': '#2a3340',
  '--week-sep': '#39445a',
  '--resizer': '#38424f',
  '--grip': '#3d4757',
  '--shadow-1': 'rgba(0, 0, 0, 0.35)',
  '--shadow-2': 'rgba(0, 0, 0, 0.5)',
  '--shadow-float': 'rgba(0, 0, 0, 0.55)',
  '--mask': 'rgba(0, 0, 0, 0.5)',
  '--mask-strong': 'rgba(0, 0, 0, 0.62)',
  '--overlay-strong': 'rgba(0, 0, 0, 0.8)',
  '--toast-bg': 'rgba(8, 11, 15, 0.94)',
  '--pattern-color': 'rgba(124, 140, 248, 0.08)',
  '--pattern-color-2': 'rgba(52, 211, 153, 0.06)',
  '--radius-card': '16px',
  '--radius-block': '12px',
  '--radius-drawer': '22px',
  '--radius-btn': '14px',
};

/** 由主色推导主色系变量（含氛围光） */
function primaryVars(primary: string, base: 'light' | 'dark'): Record<string, string> {
  const onPrimary = luminance(primary) > 0.58 ? '#211f1b' : '#ffffff';
  if (base === 'dark') {
    return {
      '--primary': primary,
      '--primary-strong': mixHex(primary, '#ffffff', 0.12),
      '--primary-tint': rgba(primary, 0.16),
      '--primary-tint-strong': rgba(primary, 0.26),
      '--primary-tint-border': rgba(primary, 0.45),
      '--primary-deep': mixHex(primary, '#ffffff', 0.38),
      '--primary-soft': mixHex(primary, '#161b23', 0.82),
      '--on-primary': onPrimary,
      '--primary-glow-1': rgba(primary, 0.3),
      '--primary-glow-2': rgba(primary, 0.55),
      '--primary-glow-3': rgba(primary, 0.22),
      '--primary-glow-4': rgba(primary, 0.4),
      '--primary-glow-5': rgba(primary, 0.92),
    };
  }
  return {
    '--primary': primary,
    '--primary-strong': mixHex(primary, '#000000', 0.16),
    '--primary-tint': mixHex(primary, '#ffffff', 0.9),
    '--primary-tint-strong': mixHex(primary, '#ffffff', 0.8),
    '--primary-tint-border': mixHex(primary, '#ffffff', 0.62),
    '--primary-deep': mixHex(primary, '#000000', 0.42),
    '--primary-soft': mixHex(primary, '#ffffff', 0.95),
    '--on-primary': onPrimary,
    '--primary-glow-1': rgba(primary, 0.28),
    '--primary-glow-2': rgba(primary, 0.55),
    '--primary-glow-3': rgba(primary, 0.18),
    '--primary-glow-4': rgba(primary, 0.35),
    '--primary-glow-5': rgba(primary, 0.92),
  };
}

/** 根据自定义主题配置生成整套 CSS 变量覆盖（含圆角 / 边框 / 密度布局） */
export function buildCustomThemeVars(config: CustomThemeConfig): Record<string, string> {
  const base = config.base === 'dark' ? DARK_BASE_VARS : LIGHT_BASE_VARS;
  const primary = normalizeHex(config.primary) ?? DEFAULT_CUSTOM_THEME.primary;
  const r = RADIUS_BY_LEVEL[config.radiusLevel];
  const borderHex = config.base === 'dark' ? '#252d39' : '#e8e4dc';
  const textHex = config.base === 'dark' ? '#e8ecf2' : '#211f1b';
  const borderColor =
    config.borderLevel === 'none' ? 'transparent' : config.borderLevel === 'bold' ? mixHex(borderHex, textHex, 0.3) : 'var(--border)';
  return {
    ...base,
    ...primaryVars(primary, config.base),
    '--radius-card': `${r.card}px`,
    '--radius-block': `${r.block}px`,
    '--radius-drawer': `${r.drawer}px`,
    '--radius-btn': `${r.btn}px`,
    '--pattern-opacity': String(Math.min(100, Math.max(0, config.patternOpacity)) / 100),
    '--btn-opacity': String(Math.min(100, Math.max(0, config.btnOpacity)) / 100),
    '--bg-image': config.bgImage ? `url("${config.bgImage}")` : 'none',
    '--bg-image-opacity': String(Math.min(100, Math.max(0, config.bgImageOpacity)) / 100),
    '--bg-image-blur': `${Math.min(40, Math.max(0, config.bgImageBlur))}px`,
    ...detailVars(config, base),
    ...buildLayoutVars(config, borderColor),
  };
}

export function isCustomThemeConfig(value: unknown): value is CustomThemeConfig {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.base === 'light' || v.base === 'dark') &&
    typeof v.primary === 'string' &&
    normalizeHex(v.primary) !== null
  );
}

export function isBuiltinThemeId(value: unknown): value is BuiltinThemeId {
  return typeof value === 'string' && THEMES.some((t) => t.id === value);
}

export function isActiveThemeId(value: unknown, list: CustomThemeConfig[]): value is ActiveThemeId {
  if (typeof value !== 'string') return false;
  return isBuiltinThemeId(value) || list.some((t) => t.id === value);
}

export function isBorderLevel(value: unknown): value is BorderLevel {
  return value === 'none' || value === 'thin' || value === 'bold';
}

export function isRadiusLevel(value: unknown): value is RadiusLevel {
  return value === 'compact' || value === 'standard' || value === 'rounded';
}

export function isDensityLevel(value: unknown): value is DensityLevel {
  return value === 'compact' || value === 'comfort' || value === 'spacious';
}

export function isPatternType(value: unknown): value is PatternType {
  return (
    value === 'none' ||
    value === 'dots' ||
    value === 'paper' ||
    value === 'glow' ||
    value === 'stripes' ||
    value === 'grid' ||
    value === 'checker' ||
    value === 'crosshatch' ||
    value === 'waves' ||
    value === 'rings' ||
    value === 'halftone'
  );
}

export function isTimelineGridStyle(value: unknown): value is TimelineGridStyle {
  return value === 'horizontal' || value === 'grid' || value === 'blank' || value === 'dots';
}

export function isTimelineDashStyle(value: unknown): value is TimelineDashStyle {
  return value === 'solid' || value === 'dashed' || value === 'dotted' || value === 'dashdot';
}

export function isGradientDirection(value: unknown): value is GradientDirection {
  return value === 'horizontal' || value === 'vertical' || value === 'diagonal';
}

export function isButtonTexture(value: unknown): value is ButtonTexture {
  return value === 'solid' || value === 'glass' || value === 'gradient' || value === 'outline';
}

export function isSizeLevel(value: unknown): value is SizeLevel {
  return value === 'standard' || value === 'large';
}

/** 归一化主题配置：旧版单套配色（base + primary）与新版完整档位都可接受，缺省字段补默认值 */
export function normalizeCustomTheme(value: unknown, id: string, fallbackName: string): CustomThemeConfig {
  const v = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const base = v.base === 'dark' ? 'dark' : 'light';
  const primaryRaw = typeof v.primary === 'string' ? normalizeHex(v.primary) : null;
  const clampNum = (val: unknown, max: number, fallback: number) =>
    typeof val === 'number' && Number.isFinite(val) ? Math.min(max, Math.max(0, val)) : fallback;
  const tlRaw = (typeof v.timeline === 'object' && v.timeline !== null ? v.timeline : {}) as Record<string, unknown>;
  const zonesRaw = (typeof v.zones === 'object' && v.zones !== null ? v.zones : {}) as Record<string, unknown>;
  const zoneAdj = (val: unknown): ZoneAdjust => {
    const o = (typeof val === 'object' && val !== null ? val : {}) as Record<string, unknown>;
    return {
      bgColor: typeof o.bgColor === 'string' && o.bgColor.trim() ? o.bgColor.trim() : '',
      opacity: clampNum(o.opacity, 100, 100),
      scale: typeof o.scale === 'number' && Number.isFinite(o.scale) ? Math.min(130, Math.max(80, Math.round(o.scale))) : 100,
    };
  };
  return {
    id,
    name: typeof v.name === 'string' && v.name.trim() ? v.name.trim() : fallbackName,
    base,
    primary: primaryRaw ?? DEFAULT_CUSTOM_THEME.primary,
    borderLevel: isBorderLevel(v.borderLevel) ? v.borderLevel : DEFAULT_CUSTOM_THEME.borderLevel,
    radiusLevel: isRadiusLevel(v.radiusLevel) ? v.radiusLevel : DEFAULT_CUSTOM_THEME.radiusLevel,
    density: isDensityLevel(v.density) ? v.density : DEFAULT_CUSTOM_THEME.density,
    arrangement: v.arrangement === 'single' ? 'single' : 'duo',
    cardStyle: v.cardStyle === 'glass' ? 'glass' : 'solid',
    pattern: isPatternType(v.pattern) ? v.pattern : DEFAULT_CUSTOM_THEME.pattern,
    patternOpacity: clampNum(v.patternOpacity, 100, DEFAULT_CUSTOM_THEME.patternOpacity),
    btnOpacity: clampNum(v.btnOpacity, 100, DEFAULT_CUSTOM_THEME.btnOpacity),
    bgImage: typeof v.bgImage === 'string' && v.bgImage.trim() ? v.bgImage.trim() : '',
    bgImageOpacity: clampNum(v.bgImageOpacity, 100, DEFAULT_CUSTOM_THEME.bgImageOpacity),
    bgImageBlur: clampNum(v.bgImageBlur, 40, DEFAULT_CUSTOM_THEME.bgImageBlur),
    timeline: {
      gridStyle: isTimelineGridStyle(tlRaw.gridStyle) ? tlRaw.gridStyle : DEFAULT_CUSTOM_THEME.timeline.gridStyle,
      bgOpacity: clampNum(tlRaw.bgOpacity, 100, DEFAULT_CUSTOM_THEME.timeline.bgOpacity),
      lineColor: typeof tlRaw.lineColor === 'string' && tlRaw.lineColor.trim() ? tlRaw.lineColor.trim() : '',
      lineOpacity: clampNum(tlRaw.lineOpacity, 100, DEFAULT_CUSTOM_THEME.timeline.lineOpacity),
      lineWidth:
        typeof tlRaw.lineWidth === 'number' && Number.isFinite(tlRaw.lineWidth)
          ? Math.min(5, Math.max(1, Math.round(tlRaw.lineWidth)))
          : DEFAULT_CUSTOM_THEME.timeline.lineWidth,
      lineDash: isTimelineDashStyle(tlRaw.lineDash)
        ? tlRaw.lineDash
        : tlRaw.lineDashed === true
          ? 'dashed'
          : DEFAULT_CUSTOM_THEME.timeline.lineDash,
      lineGradient: tlRaw.lineGradient === true,
      lineGradientColor: typeof tlRaw.lineGradientColor === 'string' && tlRaw.lineGradientColor.trim() ? tlRaw.lineGradientColor.trim() : '',
      lineGradientDir: isGradientDirection(tlRaw.lineGradientDir) ? tlRaw.lineGradientDir : DEFAULT_CUSTOM_THEME.timeline.lineGradientDir,
      tickFontSize:
        typeof tlRaw.tickFontSize === 'number' && Number.isFinite(tlRaw.tickFontSize)
          ? Math.min(20, Math.max(10, Math.round(tlRaw.tickFontSize)))
          : DEFAULT_CUSTOM_THEME.timeline.tickFontSize,
      lineDashed: tlRaw.lineDashed === true,
    },
    buttonTexture: isButtonTexture(v.buttonTexture) ? v.buttonTexture : DEFAULT_CUSTOM_THEME.buttonTexture,
    buttonSize: isSizeLevel(v.buttonSize) ? v.buttonSize : DEFAULT_CUSTOM_THEME.buttonSize,
    btnGradientColor: typeof v.btnGradientColor === 'string' && v.btnGradientColor.trim() ? v.btnGradientColor.trim() : '',
    btnGradientDir: isGradientDirection(v.btnGradientDir) ? v.btnGradientDir : DEFAULT_CUSTOM_THEME.btnGradientDir,
    btnGradientStop: clampNum(v.btnGradientStop, 100, DEFAULT_CUSTOM_THEME.btnGradientStop),
    btnGlassLevel: clampNum(v.btnGlassLevel, 100, DEFAULT_CUSTOM_THEME.btnGlassLevel),
    btnOutlineWidth: clampNum(v.btnOutlineWidth, 4, DEFAULT_CUSTOM_THEME.btnOutlineWidth),
    fontColor: typeof v.fontColor === 'string' && v.fontColor.trim() ? v.fontColor.trim() : '',
    fontSizeLevel: isSizeLevel(v.fontSizeLevel) ? v.fontSizeLevel : DEFAULT_CUSTOM_THEME.fontSizeLevel,
    fontFamily: isFontFamilyId(v.fontFamily) ? v.fontFamily : DEFAULT_CUSTOM_THEME.fontFamily,
    zones: {
      topbar: zoneAdj(zonesRaw.topbar),
      timeline: zoneAdj(zonesRaw.timeline),
      today: zoneAdj(zonesRaw.today),
      bottom: zoneAdj(zonesRaw.bottom),
    },
  };
}

/* ============ 视觉细节档位（时间轴 / 按钮 / 字体 / 分区微调） ============ */

/** 视觉细节变量：时间轴网格、按钮质感、字体、分区微调 → CSS 变量 */
function detailVars(config: CustomThemeConfig, base: Record<string, string>): Record<string, string> {
  const clampN = (v: number, max: number, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : fallback;
  const tl = config.timeline ?? DEFAULT_CUSTOM_THEME.timeline;
  /** 时间轴背景透明度百分比（100 = 不透明，0 = 完全透明，透出最底层垫层与上传图片） */
  const bgOpacityPct = Math.round(clampN(tl.bgOpacity, 100, 100));
  const lineOpacity = clampN(tl.lineOpacity, 100, 100) / 100;
  const lineColorHex = typeof tl.lineColor === 'string' && tl.lineColor.trim() ? normalizeHex(tl.lineColor.trim()) : null;
  const lineColor = lineColorHex
    ? rgba(lineColorHex, lineOpacity)
    : `color-mix(in srgb, var(--grid-major) ${Math.round(lineOpacity * 100)}%, transparent)`;
  const zones = config.zones ?? DEFAULT_CUSTOM_THEME.zones;
  /** 渐变方向 → 角度 */
  const gradAngle: Record<GradientDirection, number> = { horizontal: 90, vertical: 180, diagonal: 135 };
  /** 时间轴渐变：第一色 = 网格线颜色（或主题默认），第二色 = 渐变第二色（缺省自动推导），透明度叠加线透明度 */
  const lineHexA = lineColorHex ?? (base['--grid-major'] ?? '#e2ddd3');
  const lineGradSecond = typeof tl.lineGradientColor === 'string' && tl.lineGradientColor.trim() ? normalizeHex(tl.lineGradientColor.trim()) : null;
  const lineHexB = lineGradSecond ?? mixHex(lineHexA, config.base === 'dark' ? '#000000' : '#ffffff', 0.4);
  const lineGradImage =
    tl.lineGradient === true
      ? `linear-gradient(${gradAngle[isGradientDirection(tl.lineGradientDir) ? tl.lineGradientDir : 'horizontal']}deg, ${rgba(lineHexA, lineOpacity)} 0%, ${rgba(lineHexB, lineOpacity)} 100%)`
      : 'none';
  /** 渐变按钮：第二色 + 方向 + 过渡位置 */
  const btnGradSecond =
    typeof config.btnGradientColor === 'string' && config.btnGradientColor.trim()
      ? (normalizeHex(config.btnGradientColor.trim()) ?? 'var(--primary-strong)')
      : 'var(--primary-strong)';
  const btnGradAngle = gradAngle[isGradientDirection(config.btnGradientDir) ? config.btnGradientDir : 'diagonal'];
  const btnGlassLevel = clampN(config.btnGlassLevel, 100, 50);
  const zoneBgDefault: Record<ZoneKey, string> = {
    topbar: 'transparent',
    /* 时间轴画布底色跟随「背景透明度」：降低后透出最底层垫层（含上传图片） */
    timeline: `color-mix(in srgb, var(--canvas-bg) ${bgOpacityPct}%, transparent)`,
    today: 'transparent',
    bottom: 'var(--card-bg)',
  };
  const zoneVars: Record<string, string> = {};
  ZONE_KEYS.forEach((key) => {
    const a = zones[key] ?? { bgColor: '', opacity: 100, scale: 100 };
    zoneVars[`--zone-${key}-bg`] = typeof a.bgColor === 'string' && a.bgColor.trim() ? a.bgColor.trim() : zoneBgDefault[key];
    zoneVars[`--zone-${key}-opacity`] = String(clampN(a.opacity, 100, 100) / 100);
    zoneVars[`--zone-${key}-zoom`] = String(
      (typeof a.scale === 'number' && Number.isFinite(a.scale) ? Math.min(130, Math.max(80, Math.round(a.scale))) : 100) / 100,
    );
  });
  const fontVars: Record<string, string> = {};
  const fontColor = typeof config.fontColor === 'string' && config.fontColor.trim() ? normalizeHex(config.fontColor.trim()) : null;
  if (fontColor) {
    const t2 = base['--text-2'] ?? '#78726a';
    const t3 = base['--text-3'] ?? '#a8a29a';
    fontVars['--text'] = fontColor;
    fontVars['--text-2'] = mixHex(t2, fontColor, 0.45);
    fontVars['--text-3'] = mixHex(t3, fontColor, 0.3);
  }
  return {
    '--tl-grid-style': tl.gridStyle,
    '--tl-line-color': lineColor,
    '--tl-line-width': `${Math.min(5, Math.max(1, Math.round(tl.lineWidth || 1)))}px`,
    '--tl-dash': tl.lineDash ?? 'solid',
    '--tl-line-gradient-img': lineGradImage,
    '--tl-tick-size': `${Math.min(20, Math.max(10, Math.round(clampN(tl.tickFontSize, 20, 12) || 12)))}px`,
    '--grid-bg': `color-mix(in srgb, ${base['--grid-bg'] ?? 'rgba(253, 252, 250, 0.82)'} ${bgOpacityPct}%, transparent)`,
    /* 时间轴画布相关表面（画布底色 / 点阵 / 时间列 / 表头）统一跟随背景透明度，降低时透出垫层 */
    '--tl-canvas-bg': `color-mix(in srgb, var(--canvas-bg) ${bgOpacityPct}%, transparent)`,
    '--tl-dot-color': `color-mix(in srgb, var(--canvas-dot) ${bgOpacityPct}%, transparent)`,
    '--tl-timecol-bg': `color-mix(in srgb, var(--bg) ${bgOpacityPct}%, transparent)`,
    '--tl-weekhead-bg': `color-mix(in srgb, var(--bg-glass) ${bgOpacityPct}%, transparent)`,
    '--font-zoom': config.fontSizeLevel === 'large' ? '1.12' : '1',
    '--font-family': fontStack(isFontFamilyId(config.fontFamily) ? config.fontFamily : 'system'),
    '--btn-gradient-img': `linear-gradient(${btnGradAngle}deg, var(--primary) 0%, ${btnGradSecond} ${Math.round(clampN(config.btnGradientStop, 100, 100))}%)`,
    '--btn-glass-blur': `${Math.round((2 + (btnGlassLevel / 100) * 22) * 10) / 10}px`,
    '--btn-glass-bg': `color-mix(in srgb, var(--primary) ${Math.round(6 + (btnGlassLevel / 100) * 34)}%, transparent)`,
    '--btn-outline-width': `${Math.min(4, Math.max(1, Math.round(clampN(config.btnOutlineWidth, 4, 2) || 2)))}px`,
    ...fontVars,
    ...zoneVars,
  };
}

/** 只生成视觉细节档位变量（内置主题叠加使用） */
export function buildDetailVars(config: CustomThemeConfig): Record<string, string> {
  const base = (config.base ?? 'light') === 'dark' ? DARK_BASE_VARS : LIGHT_BASE_VARS;
  return detailVars(config, base);
}

/* ============ 页面存档 ============ */

export interface PagePreset {
  id: string;
  name: string;
  /** 保存时的激活主题 id（内置主题 id 或自定义主题 id） */
  themeId: string;
  /** 保存时整套设置的快照（主题档位 + 视觉细节 + 分区微调） */
  snapshot: CustomThemeConfig;
  createdAt: number;
  updatedAt: number;
}

export function createPagePresetId(): string {
  return `page_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizePagePreset(value: unknown): PagePreset | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || !v.id) return null;
  if (typeof v.name !== 'string') return null;
  return {
    id: v.id,
    name: v.name.trim() || '未命名页面',
    themeId: typeof v.themeId === 'string' && v.themeId ? v.themeId : 'canvas',
    snapshot: normalizeCustomTheme(v.snapshot, '', v.name.trim() || '未命名页面'),
    createdAt: typeof v.createdAt === 'number' ? v.createdAt : Date.now(),
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now(),
  };
}

/* ============ 页面方案备份（导入 / 导出） ============ */

export interface BackupPayload {
  app: string;
  version: number;
  exportedAt: number;
  /** 全部页面方案 */
  pagePresets: PagePreset[];
  /** 全部自定义主题 */
  customThemes: CustomThemeConfig[];
  /** 内置主题叠加的页面细节 */
  pageDetails: CustomThemeConfig;
  /** 导出时激活的方案 id（可能不存在，导入时校验） */
  activePresetId: string;
}

/** 兼容校验导入备份：旧档位缺字段自动补齐，非法文件返回 null */
export function normalizeBackupPayload(value: unknown): BackupPayload | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  const presetsRaw = Array.isArray(v.pagePresets) ? v.pagePresets : [];
  const themesRaw = Array.isArray(v.customThemes) ? v.customThemes : [];
  if (presetsRaw.length === 0 && themesRaw.length === 0) return null;
  const presets = presetsRaw.map(normalizePagePreset).filter((x): x is PagePreset => x !== null);
  const themes = themesRaw
    .map((t, i) => {
      if (!isCustomThemeConfig(t)) return null;
      const tObj = t as unknown as Record<string, unknown>;
      const id = typeof tObj.id === 'string' && tObj.id ? tObj.id : createCustomThemeId();
      const nm = typeof tObj.name === 'string' && tObj.name.trim() ? tObj.name.trim() : `自定义主题 ${i + 1}`;
      return normalizeCustomTheme(t, id, nm);
    })
    .filter((x): x is CustomThemeConfig => x !== null);
  const detailsRaw = typeof v.pageDetails === 'object' && v.pageDetails !== null ? normalizeCustomTheme(v.pageDetails, 'page-details', '页面细节') : null;
  return {
    app: 'time-block-page-presets',
    version: typeof v.version === 'number' ? v.version : 1,
    exportedAt: typeof v.exportedAt === 'number' ? v.exportedAt : Date.now(),
    pagePresets: presets,
    customThemes: themes,
    pageDetails: detailsRaw ?? { ...DEFAULT_CUSTOM_THEME, id: 'page-details', name: '页面细节' },
    activePresetId: typeof v.activePresetId === 'string' ? v.activePresetId : '',
  };
}