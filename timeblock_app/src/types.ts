export interface TimeBlock {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  recordDate: string;
  /** 当天 0..1440 */
  startMinute: number;
  /** 当天 0..1440 */
  endMinute: number;
  /** 空串表示无标签 */
  tagId: string;
  note: string;
  createdAt: number;
  updatedAt: number;
  /** 区域模式：true 表示该时间块作为自定义区域展示（整块底色） */
  zoneMode?: boolean;
  /** 区域名称（区域模式下展示名，空时用 title） */
  zoneName?: string;
  /** 区域底色 #RRGGBB，空时使用标签色/默认色 */
  zoneColor?: string;
  /** 区域备注（区域模式下展示） */
  zoneNote?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  /** 空串表示一级标签 */
  parentId: string;
  sortOrder: number;
  createdAt: number;
}

export type ViewMode = 'day' | 'week';

export type StatTab = 'day' | 'week' | 'month' | 'custom';

export type ExportScope = 'week' | 'month' | 'custom';

export type ExportFormat = 'detail' | 'tag';

export type Granularity = 5 | 10 | 15 | 30;

export type SheetKind = 'quick' | 'edit' | 'tags' | 'stats' | 'templates' | 'more' | 'ai' | 'assistant' | null;

/** 每日面板（日视图下方 Dashboard）：心情、任务、重要事项、小结 */
export interface DailyTask {
  id: string;
  text: string;
  /** 任务前缀 Emoji 分类，如 📚 🏃 💼 */
  emoji: string;
  done: boolean;
  createdAt: number;
}

export interface DailyPanel {
  /** 今日心情 Emoji，空串表示未选择 */
  mood: string;
  /** 重要事项列表 */
  important: string[];
  tasks: DailyTask[];
  /** 今日小结 */
  summary: string;
}

export const TAG_PALETTE = [
  '#4F46E5',
  '#0891B2',
  '#059669',
  '#CA8A04',
  '#EA580C',
  '#DB2777',
  '#7C3AED',
  '#64748B',
];