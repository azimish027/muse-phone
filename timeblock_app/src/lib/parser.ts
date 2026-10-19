import dayjs from 'dayjs';
import { DAY_MINUTES, fmtDate } from './timeUtils';

export interface QuickForm {
  title: string;
  /** YYYY-MM-DD */
  date: string;
  startMinute: number;
  endMinute: number;
  tagId: string;
}

export interface ParseOutcome {
  ok: boolean;
  form: QuickForm | null;
  error: string | null;
}

const DAY_ALIASES: Record<string, number> = {
  今天: 0,
  今日: 0,
  明天: 1,
  明日: 1,
  后天: 2,
  大后天: 3,
  昨天: -1,
  昨日: -1,
};

const WEEK_NAMES: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  日: 0,
  天: 0,
};

function toMinute(h: number, m: number): number | null {
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * 解析快速添加文本，支持句式：
 * - 14:00-15:30 产品评审
 * - 15:00 健身 1小时 / 30分钟
 * - 明天10:00 会议 / 下周三 09:30-10:30 站会（“下周三”等周前缀简化为本周/下周匹配）
 * 解析失败返回具体原因，字段可由用户手动修正。
 */
export function parseQuickText(raw: string, baseDate: string, granularity: number): ParseOutcome {
  const text = raw.trim();
  if (!text) {
    return { ok: false, form: null, error: '请输入内容' };
  }

  let rest = text;
  let date = dayjs(baseDate);

  // 日期前缀：今天/明天/后天/昨天
  const dayMatch = rest.match(/^(今天|今日|明天|明日|后天|大后天|昨天|昨日)/);
  if (dayMatch) {
    date = date.add(DAY_ALIASES[dayMatch[1]], 'day');
    rest = rest.slice(dayMatch[0].length).trim();
  } else {
    // 下周X / 本周X / 周X / 星期X
    const weekMatch = rest.match(/^(下|本)?(周|星期)([一二三四五六日天])/);
    if (weekMatch) {
      const target = WEEK_NAMES[weekMatch[3]];
      const current = date.day();
      let diff = target - current;
      if (diff <= 0) diff += 7;
      if (weekMatch[1] === '下') diff += 7;
      date = date.add(diff, 'day');
      rest = rest.slice(weekMatch[0].length).trim();
    }
  }

  const dateStr = fmtDate(date.toDate());

  // 时间范围：14:00-15:30
  const rangeMatch = rest.match(/(\d{1,2})[:：](\d{2})\s*(?:-|~|—|–|至|到)\s*(\d{1,2})[:：](\d{2})/);
  if (rangeMatch) {
    const s = toMinute(Number(rangeMatch[1]), Number(rangeMatch[2]));
    const en = toMinute(Number(rangeMatch[3]), Number(rangeMatch[4]));
    if (s == null || en == null) {
      return { ok: false, form: null, error: '时间格式有误，请检查后重试' };
    }
    if (en <= s) {
      return { ok: false, form: null, error: '结束时间需晚于开始时间' };
    }
    let title = rest.replace(rangeMatch[0], '').trim();
    title = title.replace(/^[,，、\s]+/, '').trim();
    if (!title) title = '新时间块';
    return { ok: true, form: { title, date: dateStr, startMinute: s, endMinute: en, tagId: '' }, error: null };
  }

  // 单时间 + 标题 + 可选时长：15:00 健身 1小时 / 30分钟
  const singleMatch = rest.match(/^(\d{1,2})[:：](\d{2})\s*(.*)$/);
  if (singleMatch) {
    const s = toMinute(Number(singleMatch[1]), Number(singleMatch[2]));
    if (s == null) {
      return { ok: false, form: null, error: '时间格式有误，请检查后重试' };
    }
    let tail = singleMatch[3].trim();
    let duration: number | null = null;
    const durMatch = tail.match(/(\d+(?:\.\d+)?)\s*(小时|分钟|h|hr|min|m)\s*$/i);
    if (durMatch) {
      const v = parseFloat(durMatch[1]);
      const unit = durMatch[2].toLowerCase();
      duration = unit === '小时' || unit === 'h' || unit === 'hr' ? Math.round(v * 60) : Math.round(v);
      tail = tail.slice(0, durMatch.index ?? 0).trim();
    }
    let title = tail.replace(/^[,，、\s]+/, '').trim();
    if (!title) title = '新时间块';
    const en = duration != null ? s + duration : s + granularity;
    if (en > DAY_MINUTES) {
      return { ok: false, form: null, error: '结束时间超出当天范围' };
    }
    return { ok: true, form: { title, date: dateStr, startMinute: s, endMinute: en, tagId: '' }, error: null };
  }

  return {
    ok: false,
    form: null,
    error: '未能识别时间格式，可输入如 14:00-15:30 产品评审 或手动填写',
  };
}