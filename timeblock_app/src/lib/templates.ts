import type { Tag, TimeBlock } from '../types';

/**
 * 排期模板：内置常用模板 + 用户把某天排期存为模板。
 * 模板属于单人单设备的个人偏好，使用 localStorage 持久化。
 */

export interface TemplateBlock {
  title: string;
  /** 当天 0..1440 */
  startMinute: number;
  /** 当天 0..1440 */
  endMinute: number;
  /** 标签名（套用时按名称匹配当前标签库，匹配不到则不带标签） */
  tagName: string;
  note: string;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  desc: string;
  blocks: TemplateBlock[];
  /** 内置模板不可删除 */
  builtin?: boolean;
}

const TPL_STORAGE_KEY = 'tb.scheduleTemplates';

export function createTemplateId(): string {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 把一天的时间块整理成模板块（按开始时间排序，过滤零时长） */
export function blocksToTemplateBlocks(blocks: TimeBlock[], tags: Tag[]): TemplateBlock[] {
  return blocks
    .filter((b) => b.endMinute > b.startMinute)
    .sort((a, b) => a.startMinute - b.startMinute || a.createdAt - b.createdAt)
    .map((b) => {
      const tag = b.tagId ? tags.find((t) => t.id === b.tagId) : undefined;
      return { title: b.title, startMinute: b.startMinute, endMinute: b.endMinute, tagName: tag?.name ?? '', note: b.note };
    });
}

/** 内置常用模板：工作日 / 学习冲刺 / 健康作息 / 周末放松 */
export const BUILTIN_TEMPLATES: ScheduleTemplate[] = [
  {
    id: 'builtin_workday',
    name: '工作日',
    desc: '朝九晚六的稳定节奏，留出通勤与学习充电',
    builtin: true,
    blocks: [
      { title: '晨间准备与通勤', startMinute: 450, endMinute: 540, tagName: '', note: '' },
      { title: '深度工作', startMinute: 540, endMinute: 720, tagName: '', note: '关掉通知，专注核心任务' },
      { title: '午餐休息', startMinute: 720, endMinute: 780, tagName: '', note: '' },
      { title: '项目推进', startMinute: 810, endMinute: 1080, tagName: '', note: '' },
      { title: '晚餐与散步', startMinute: 1110, endMinute: 1170, tagName: '', note: '' },
      { title: '学习充电', startMinute: 1200, endMinute: 1290, tagName: '', note: '' },
      { title: '睡前放松', startMinute: 1350, endMinute: 1410, tagName: '', note: '' },
    ],
  },
  {
    id: 'builtin_study',
    name: '学习冲刺',
    desc: '备考 / 集中学习的一天：攻坚、刷题、复盘',
    builtin: true,
    blocks: [
      { title: '晨读背诵', startMinute: 390, endMinute: 420, tagName: '', note: '' },
      { title: '主科攻坚', startMinute: 480, endMinute: 690, tagName: '', note: '25+5 番茄节奏' },
      { title: '午餐与午休', startMinute: 690, endMinute: 750, tagName: '', note: '' },
      { title: '刷题练习', startMinute: 810, endMinute: 960, tagName: '', note: '' },
      { title: '复盘整理', startMinute: 990, endMinute: 1080, tagName: '', note: '错题本 + 笔记整理' },
      { title: '晚间背诵', startMinute: 1170, endMinute: 1290, tagName: '', note: '' },
      { title: '明日计划', startMinute: 1320, endMinute: 1350, tagName: '', note: '' },
    ],
  },
  {
    id: 'builtin_health',
    name: '健康作息',
    desc: '运动 + 三餐 + 早睡，规律的一天',
    builtin: true,
    blocks: [
      { title: '早起拉伸', startMinute: 420, endMinute: 450, tagName: '', note: '' },
      { title: '早餐', startMinute: 450, endMinute: 480, tagName: '', note: '' },
      { title: '专注时段', startMinute: 510, endMinute: 690, tagName: '', note: '' },
      { title: '午餐', startMinute: 720, endMinute: 780, tagName: '', note: '' },
      { title: '运动锻炼', startMinute: 1050, endMinute: 1110, tagName: '', note: '有氧或力量 40 分钟' },
      { title: '晚餐', startMinute: 1140, endMinute: 1200, tagName: '', note: '' },
      { title: '睡前阅读', startMinute: 1350, endMinute: 1380, tagName: '', note: '' },
    ],
  },
  {
    id: 'builtin_weekend',
    name: '周末放松',
    desc: '慢节奏充电日：兴趣、户外、陪伴',
    builtin: true,
    blocks: [
      { title: '自然醒与早餐', startMinute: 540, endMinute: 570, tagName: '', note: '' },
      { title: '兴趣时间', startMinute: 600, endMinute: 720, tagName: '', note: '爱好 / 阅读 / 创作' },
      { title: '午餐', startMinute: 720, endMinute: 780, tagName: '', note: '' },
      { title: '户外 / 朋友', startMinute: 840, endMinute: 960, tagName: '', note: '' },
      { title: '整理家务', startMinute: 990, endMinute: 1050, tagName: '', note: '' },
      { title: '晚餐', startMinute: 1140, endMinute: 1200, tagName: '', note: '' },
      { title: '电影 / 游戏', startMinute: 1230, endMinute: 1320, tagName: '', note: '' },
    ],
  },
];

/** 归一化模板：脏数据不导致崩溃 */
export function normalizeTemplate(raw: unknown, index: number): ScheduleTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const name = typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : `我的模板 ${index + 1}`;
  const blocks = Array.isArray(obj.blocks)
    ? (obj.blocks as unknown[])
        .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
        .map((b): TemplateBlock => ({
          title: typeof b.title === 'string' && b.title.trim() ? b.title.trim() : '未命名时间块',
          startMinute: typeof b.startMinute === 'number' ? Math.max(0, Math.min(1440, Math.round(b.startMinute))) : 0,
          endMinute: typeof b.endMinute === 'number' ? Math.max(0, Math.min(1440, Math.round(b.endMinute))) : 0,
          tagName: typeof b.tagName === 'string' ? b.tagName : '',
          note: typeof b.note === 'string' ? b.note : '',
        }))
        .filter((b) => b.endMinute > b.startMinute)
    : [];
  if (blocks.length === 0) return null;
  return {
    id: typeof obj.id === 'string' && obj.id ? obj.id : createTemplateId(),
    name,
    desc: typeof obj.desc === 'string' && obj.desc.trim() ? obj.desc.trim() : '',
    blocks,
    builtin: false,
  };
}

export function loadUserTemplates(): ScheduleTemplate[] {
  try {
    const raw = window.localStorage.getItem(TPL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x, i) => normalizeTemplate(x, i))
      .filter((x): x is ScheduleTemplate => x !== null)
      .map((t, i) => ({ ...t, name: t.name || `我的模板 ${i + 1}` }));
  } catch {
    return [];
  }
}

export function saveUserTemplates(list: ScheduleTemplate[]): void {
  try {
    window.localStorage.setItem(TPL_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // 忽略存储失败
  }
}

/** 导出模板包：JSON 文本 */
export function buildTemplatesPackage(templates: ScheduleTemplate[]): string {
  return JSON.stringify({ app: '落砂成羽之刻', kind: 'schedule-templates', version: 1, templates }, null, 2);
}

/** 解析模板包：结构校验通过返回模板列表，失败返回 null */
export function parseTemplatesPackage(text: string): ScheduleTemplate[] | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object') {
      const list = (parsed as Record<string, unknown>).templates;
      if (Array.isArray(list)) {
        const out = list.map((x, i) => normalizeTemplate(x, i)).filter((x): x is ScheduleTemplate => x !== null);
        if (out.length > 0) return out;
      }
    }
    return null;
  } catch {
    return null;
  }
}