import type { DailyPanel } from '../types';

/**
 * 表情库：预设表情包（可自选开关）+ 用户自定义表情（上传图片定义）。
 * 用于每日面板的「今日心情」与「任务清单」表情选择。
 * 属于单人单设备的轻量偏好，使用 localStorage 键值存储。
 */

export interface StickerPack {
  id: string;
  name: string;
  /** 包内表情（emoji 字符或颜文字） */
  emojis: string[];
}

export interface CustomSticker {
  id: string;
  name: string;
  /** 上传后的可访问图片 URL */
  url: string;
  createdAt: number;
}

export interface StickerLib {
  /** 已启用的预设表情包 id */
  enabled: string[];
  custom: CustomSticker[];
}

/** 预设表情包：心情+颜文字 用于「今日心情」；学习工作+生活 用于「任务清单」表情标签 */
export const STICKER_PACKS: StickerPack[] = [
  { id: 'mood', name: '心情表情', emojis: ['😊', '😭', '😡', '🥱', '🤩', '😴', '😅', '😢', '😤', '😎'] },
  { id: 'kaomoji', name: '颜文字', emojis: ['(・∀・)', '٩(◕‿◕)۶', '(*´∀`*)', 'Σ(ﾟДﾟ)', '(￣▽￣)~*', '◉‿◉', '(｡•̀ᴗ-)✧', '╰(*°▽°*)╯'] },
  { id: 'study', name: '学习工作', emojis: ['📚', '✍️', '💼', '🎯', '🧠', '📝', '💻', '🗓️', '📈', '🎓'] },
  { id: 'life', name: '生活日常', emojis: ['🏃', '🍽️', '🛒', '🧹', '🚿', '🛌', '💊', '🚗', '🎮', '☕'] },
];

/** 「今日心情」展示的预设包 */
export const MOOD_PACK_IDS = ['mood', 'kaomoji'];
/** 「任务清单」表情标签展示的预设包 */
export const TASK_PACK_IDS = ['study', 'life'];

const LIB_KEY = 'tb_sticker_lib';
const STK_PREFIX = '[stk:';

/** 自定义表情在面板里的存储 token（emoji 字符直接存原字符） */
export function stickerToken(id: string): string {
  return `${STK_PREFIX}${id}]`;
}

export function isStickerToken(value: string): boolean {
  return typeof value === 'string' && value.startsWith(STK_PREFIX) && value.endsWith(']');
}

export function parseStickerToken(value: string): string | null {
  if (!isStickerToken(value)) return null;
  return value.slice(STK_PREFIX.length, -1);
}

export function createStickerId(): string {
  return `s_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function loadStickerLib(): StickerLib {
  const fallback: StickerLib = { enabled: STICKER_PACKS.map((p) => p.id), custom: [] };
  try {
    const raw = window.localStorage.getItem(LIB_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StickerLib> | null;
    if (!parsed || typeof parsed !== 'object') return fallback;
    const enabled = Array.isArray(parsed.enabled)
      ? (parsed.enabled as unknown[]).filter((x): x is string => typeof x === 'string' && STICKER_PACKS.some((p) => p.id === x))
      : fallback.enabled;
    const custom = Array.isArray(parsed.custom)
      ? (parsed.custom as unknown[])
          .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
          .map((s) => ({
            id: typeof s.id === 'string' && s.id ? s.id : createStickerId(),
            name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : '自定义表情',
            url: typeof s.url === 'string' && s.url ? s.url : '',
            createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
          }))
          .filter((s) => s.url)
      : [];
    return { enabled, custom };
  } catch {
    return fallback;
  }
}

export function saveStickerLib(lib: StickerLib): void {
  try {
    window.localStorage.setItem(LIB_KEY, JSON.stringify(lib));
  } catch {
    // 忽略存储失败
  }
}

export interface StickerOption {
  key: string;
  kind: 'emoji' | 'image';
  text: string;
  url?: string;
  /** 用于 data-testid 的稳定标识 */
  testId: string;
}

function pickerOptions(packIds: string[], lib: StickerLib): StickerOption[] {
  const out: StickerOption[] = [];
  for (const pid of packIds) {
    if (!lib.enabled.includes(pid)) continue;
    const pack = STICKER_PACKS.find((p) => p.id === pid);
    if (!pack) continue;
    for (const em of pack.emojis) {
      out.push({ key: em, kind: 'emoji', text: em, testId: em });
    }
  }
  for (const s of lib.custom) {
    out.push({ key: stickerToken(s.id), kind: 'image', text: s.name, url: s.url, testId: `stk-${s.id}` });
  }
  return out;
}

/** 「今日心情」可选列表：心情+颜文字 已启用包 + 自定义表情 */
export function moodOptions(lib: StickerLib): StickerOption[] {
  return pickerOptions(MOOD_PACK_IDS, lib);
}

/** 「任务清单」表情标签可选列表：学习工作+生活 已启用包 + 自定义表情 */
export function taskOptions(lib: StickerLib): StickerOption[] {
  return pickerOptions(TASK_PACK_IDS, lib);
}

export interface ResolvedSticker {
  kind: 'emoji' | 'image';
  text: string;
  url?: string;
  /** token 指向的自定义表情已被删除 */
  missing?: boolean;
}

/** 把面板里存的值（emoji 字符或 [stk:id] token）解析为可渲染内容 */
export function resolveSticker(value: string, lib: StickerLib): ResolvedSticker {
  const v = typeof value === 'string' ? value : '';
  if (!v) return { kind: 'emoji', text: '' };
  const id = parseStickerToken(v);
  if (id !== null) {
    const st = lib.custom.find((s) => s.id === id);
    if (st) return { kind: 'image', text: st.name, url: st.url };
    return { kind: 'emoji', text: '🖼', missing: true };
  }
  return { kind: 'emoji', text: v };
}

/** 文本场景（分享 / 拖拽标题 / 历史摘要）用：把 token 还原为名字或占位符 */
export function plainStickerText(value: string, lib: StickerLib): string {
  const r = resolveSticker(value, lib);
  return r.text;
}

/** 分享等纯文本场景：把面板里的自定义表情 token 替换为名字 */
export function panelForText(panel: DailyPanel, lib: StickerLib): DailyPanel {
  return {
    ...panel,
    mood: plainStickerText(panel.mood, lib),
    tasks: panel.tasks.map((t) => ({ ...t, emoji: plainStickerText(t.emoji, lib) })),
  };
}