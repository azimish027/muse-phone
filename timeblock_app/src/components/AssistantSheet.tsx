import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Check, FileText, ListChecks, Moon, RefreshCw, Sparkles } from 'lucide-react';
import type { DailyTask, Tag } from '../types';
import { Sheet } from './Sheet';
import { loadBlocksByDateRange } from '../lib/db';
import { loadPanel } from '../lib/dailyPanel';
import { addDays, fmtDate, fmtMinute, getDateList, getMonthRange, getWeekDates } from '../lib/timeUtils';
import { AiChatError, isAiChatAvailable } from '../lib/ai';

interface AssistantSheetProps {
  open: boolean;
  onClose: () => void;
  /** 当前日期（作为默认锚点） */
  date: string;
  tags: Tag[];
  onToast: (msg: string) => void;
  /** 保存复盘小结到指定日期的每日面板 */
  onSavePanel: (date: string, patch: { summary?: string }) => void;
}

type AssistantTab = 'review' | 'todo' | 'report';

/** 秘书助手：全部基于应用内已有记录（时间块 + 每日面板）生成，不依赖外部数据 */
export function AssistantSheet({ open, onClose, date, tags, onToast, onSavePanel }: AssistantSheetProps) {
  const [tab, setTab] = useState<AssistantTab>('review');

  // 睡前复盘
  const [reviewDate, setReviewDate] = useState(date);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewText, setReviewText] = useState('');

  // 未完成提醒
  const [todoDate, setTodoDate] = useState(date);
  const [todoDays, setTodoDays] = useState(3);
  const [todoLoading, setTodoLoading] = useState(false);
  const [todoText, setTodoText] = useState('');

  // 周报/月报
  const [reportScope, setReportScope] = useState<'week' | 'month'>('week');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportText, setReportText] = useState('');

  useEffect(() => {
    if (!open) return;
    setReviewDate(date);
    setTodoDate(date);
    setReviewText('');
    setTodoText('');
    setReportText('');
    setTab('review');
  }, [open, date]);

  /** 把某天的面板 + 时间块整理成文本 */
  const buildDaySummary = useCallback(
    (d: string, blocks: { title: string; startMinute: number; endMinute: number; tagName: string }[]) => {
      const p = loadPanel(d);
      const lines: string[] = [`日期：${d}`];
      if (blocks.length > 0) {
        lines.push('时间块：');
        blocks.forEach((b) => lines.push(`  ${fmtMinute(b.startMinute)}-${fmtMinute(b.endMinute)} ${b.title}${b.tagName ? ` [${b.tagName}]` : ''}`));
      } else {
        lines.push('时间块：无');
      }
      if (p.tasks.length > 0) {
        lines.push('任务：');
        p.tasks.forEach((t) => lines.push(`  ${t.done ? '✅' : '⬜'} ${t.text}`));
      } else {
        lines.push('任务：无');
      }
      if (p.mood) lines.push(`心情：${p.mood}`);
      if (p.important.length > 0) lines.push(`重要事项：${p.important.join('、')}`);
      if (p.summary.trim()) lines.push(`已有小结：${p.summary.trim()}`);
      return { text: lines.join('\n'), panel: p };
    },
    [],
  );

  const callAi = useCallback(async (system: string, user: string): Promise<string> => {
    if (!isAiChatAvailable()) {
      throw new AiChatError('not-supported', '当前环境未提供在线 AI 能力');
    }
    const runOnce = async (): Promise<string> => {
      const result = await window.lingguang.ai.chat({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        timeout: 30000,
      });
      const data = result?.content;
      return typeof data === 'string' && data.trim() ? data.trim() : '';
    };
    try {
      return await runOnce();
    } catch (err) {
      // 瞬时网络 / 服务抖动：重试一次，仍失败才抛出
      if (err instanceof AiChatError) throw err;
      await new Promise((resolve) => window.setTimeout(resolve, 800));
      return runOnce();
    }
  }, []);

  /** 睡前复盘：基于当天记录生成一段可保存为小结的复盘 */
  const handleReview = useCallback(async () => {
    if (reviewLoading) return;
    setReviewLoading(true);
    setReviewText('');
    try {
      const blocks = await loadBlocksByDateRange(reviewDate, reviewDate);
      const tagById = new Map(tags.map((t) => [t.id, t.name]));
      const { text, panel } = buildDaySummary(
        reviewDate,
        blocks.map((b) => ({ title: b.title, startMinute: b.startMinute, endMinute: b.endMinute, tagName: b.tagId ? (tagById.get(b.tagId) ?? '') : '' })),
      );
      if (!panel.tasks.length && !panel.mood && blocks.length === 0 && !panel.summary.trim() && panel.important.length === 0) {
        setReviewText('这一天还没有任何记录（时间块、任务、心情、小结都为空），先记录一些内容再生成复盘吧。');
        return;
      }
      const out = await callAi(
        '你是用户的私人助理。根据用户当天的真实记录（时间块、任务完成情况、心情、重要事项），写一段 100-180 字的睡前复盘小结：先概括今天做了什么、完成情况如何，再写一句今天的心情或感受，最后给 1-2 条明天的小建议。语气真诚自然，只基于给出的记录，不要编造记录里没有的事。',
        `请为这一天写睡前复盘小结：\n${text}`,
      );
      setReviewText(out || '生成失败，请稍后重试。');
    } catch (err) {
      setReviewText(
        err instanceof AiChatError && err.reason === 'not-supported' ? '当前环境未提供在线 AI 能力，请在支持在线 AI 的客户端中重试。' : 'AI 生成失败（网络或服务异常），请稍后重试。',
      );
    } finally {
      setReviewLoading(false);
    }
  }, [buildDaySummary, callAi, reviewDate, reviewLoading, tags]);

  const handleSaveReview = useCallback(() => {
    if (!reviewText.trim()) return;
    onSavePanel(reviewDate, { summary: reviewText.trim() });
    onToast(`已保存 ${reviewDate} 的睡前复盘小结`);
  }, [onSavePanel, onToast, reviewDate, reviewText]);

  /** 未完成提醒：汇总未来几天未完成任务 + AI 提醒文案 */
  const handleTodo = useCallback(async () => {
    if (todoLoading) return;
    setTodoLoading(true);
    setTodoText('');
    try {
      const days = getDateList(todoDate, fmtDate(addDays(new Date(`${todoDate}T00:00:00`), Math.max(1, Math.min(todoDays, 30)) - 1)));
      const end = days[days.length - 1];
      const blocks = await loadBlocksByDateRange(todoDate, end);
      const tagById = new Map(tags.map((t) => [t.id, t.name]));
      const pending: { date: string; text: string }[] = [];
      const dayLines: string[] = [];
      days.forEach((d) => {
        const p = loadPanel(d);
        p.tasks.forEach((t: DailyTask) => {
          if (!t.done && t.text.trim()) pending.push({ date: d, text: t.text.trim() });
        });
        const dayBlocks = blocks.filter((b) => b.recordDate === d);
        if (dayBlocks.length > 0) {
          dayLines.push(
            `${d}：${dayBlocks
              .map((b) => `${fmtMinute(b.startMinute)}-${fmtMinute(b.endMinute)} ${b.title}${b.tagId ? `[${tagById.get(b.tagId) ?? ''}]` : ''}`)
              .join('；')}`,
          );
        }
      });
      const pendingText = pending.length > 0 ? pending.map((p) => `  ${p.date} ${p.text}`).join('\n') : '（无）';
      if (pending.length === 0 && dayLines.length === 0) {
        setTodoText(`未来 ${days.length} 天没有未完成任务，也没有时间块安排，保持清闲～`);
        return;
      }
      const out = await callAi(
        '你是用户的私人助理。根据未来几天的未完成任务和已安排时间块，生成一段 80-140 字的提醒：先列重点未完成事项（带日期），再指出时间上可能的冲突或过载，最后给一句行动建议。只基于给出的记录，不要编造。',
        `未来 ${days.length} 天（${todoDate} 至 ${end}）记录如下：\n未完成任务：\n${pendingText}\n已安排时间块：\n${dayLines.join('\n') || '（无）'}`,
      );
      setTodoText(out || '生成失败，请稍后重试。');
    } catch (err) {
      setTodoText(
        err instanceof AiChatError && err.reason === 'not-supported' ? '当前环境未提供在线 AI 能力，请在支持在线 AI 的客户端中重试。' : 'AI 生成失败（网络或服务异常），请稍后重试。',
      );
    } finally {
      setTodoLoading(false);
    }
  }, [callAi, tags, todoDate, todoDays, todoLoading]);

  /** 周报/月报：汇总范围内时间块与面板小结，AI 生成文本报告 */
  const handleReport = useCallback(async () => {
    if (reportLoading) return;
    setReportLoading(true);
    setReportText('');
    try {
      const range = reportScope === 'week' ? getWeekDates(date, 7) : getDateList(...getMonthRange(date));
      const start = range[0];
      const end = range[range.length - 1];
      const blocks = await loadBlocksByDateRange(start, end);
      const tagById = new Map(tags.map((t) => [t.id, t.name]));
      const totalMinutes = blocks.reduce((s, b) => s + Math.max(0, b.endMinute - b.startMinute), 0);
      const dayLines: string[] = [];
      range.forEach((d) => {
        const p = loadPanel(d);
        const dayBlocks = blocks.filter((b) => b.recordDate === d);
        const parts: string[] = [];
        if (dayBlocks.length > 0) parts.push(dayBlocks.map((b) => `${fmtMinute(b.startMinute)}-${fmtMinute(b.endMinute)} ${b.title}`).join('、'));
        if (p.tasks.length > 0) parts.push(`任务(${p.tasks.filter((t) => t.done).length}/${p.tasks.length})`);
        if (p.mood) parts.push(`心情${p.mood}`);
        if (p.summary.trim()) parts.push(`小结：${p.summary.trim()}`);
        if (parts.length) dayLines.push(`${d}：${parts.join('；')}`);
      });
      const reportName = reportScope === 'week' ? '周报' : '月报';
      if (dayLines.length === 0 && blocks.length === 0) {
        setReportText(`${start} 至 ${end} 还没有任何记录，先积累一些时间块和每日小结再来生成${reportName}吧。`);
        return;
      }
      const out = await callAi(
        `你是用户的私人助理，帮忙写一份 ${reportScope === 'week' ? '周报' : '月报'}。根据范围内真实记录（时间块、任务完成情况、心情、每日小结），输出 150-250 字：1) 整体概览（活跃天数、总时长、主要做的事）；2) 亮点与完成情况；3) 问题或不足；4) 下${reportScope === 'week' ? '周' : '月'}建议。只基于给出的记录，不要编造。`,
        `${reportName}数据（${start} 至 ${end}，共 ${blocks.length} 个时间块，合计 ${Math.round(totalMinutes / 60 * 10) / 10} 小时）：\n${dayLines.join('\n') || '（无每日记录）'}`,
      );
      setReportText(out || '生成失败，请稍后重试。');
    } catch (err) {
      setReportText(
        err instanceof AiChatError && err.reason === 'not-supported' ? '当前环境未提供在线 AI 能力，请在支持在线 AI 的客户端中重试。' : 'AI 生成失败（网络或服务异常），请稍后重试。',
      );
    } finally {
      setReportLoading(false);
    }
  }, [callAi, date, reportLoading, reportScope, tags]);

  return (
    <Sheet open={open} onClose={onClose} title="秘书助手" testId="assistant-sheet">
      <div className="assistant-tabs" data-testid="assistant-tabs">
        <button
          type="button"
          className={`assistant-tab ${tab === 'review' ? 'assistant-tab-active' : ''}`}
          onClick={() => setTab('review')}
          data-testid="assistant-tab-review"
        >
          <Moon size={14} strokeWidth={2} /> 睡前复盘
        </button>
        <button
          type="button"
          className={`assistant-tab ${tab === 'todo' ? 'assistant-tab-active' : ''}`}
          onClick={() => setTab('todo')}
          data-testid="assistant-tab-todo"
        >
          <ListChecks size={14} strokeWidth={2} /> 未完成提醒
        </button>
        <button
          type="button"
          className={`assistant-tab ${tab === 'report' ? 'assistant-tab-active' : ''}`}
          onClick={() => setTab('report')}
          data-testid="assistant-tab-report"
        >
          <FileText size={14} strokeWidth={2} /> 周报/月报
        </button>
      </div>

      {tab === 'review' && (
        <div className="assistant-pane" data-testid="assistant-review">
          <div className="assistant-desc">
            基于当天的真实记录（时间块、任务完成情况、心情、重要事项），帮你写一段睡前复盘小结，可一键保存到当日小结。
          </div>
          <div className="assistant-row">
            <div className="assistant-field">
              <label className="assistant-label">
                <CalendarDays size={13} strokeWidth={2} /> 复盘日期
              </label>
              <input className="field-input" type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} data-testid="assistant-review-date" />
            </div>
            <button type="button" className="btn btn-primary" onClick={() => void handleReview()} disabled={reviewLoading} data-testid="assistant-review-gen">
              <Sparkles size={14} strokeWidth={2} /> {reviewLoading ? '生成中…' : '生成复盘'}
            </button>
          </div>
          {reviewText && (
            <div className="assistant-result" data-testid="assistant-review-result">
              <p className="assistant-result-text">{reviewText}</p>
              <button type="button" className="btn btn-primary btn-block" onClick={handleSaveReview} data-testid="assistant-review-save">
                <Check size={14} strokeWidth={2.5} /> 保存为当日小结
              </button>
              <button type="button" className="btn btn-ghost btn-block" onClick={() => void handleReview()} disabled={reviewLoading} data-testid="assistant-review-regen">
                <RefreshCw size={14} strokeWidth={2} /> 重新生成
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'todo' && (
        <div className="assistant-pane" data-testid="assistant-todo">
          <div className="assistant-desc">
            汇总未来几天未完成任务与已安排时间块，帮你检查遗漏、冲突和过载，生成一段提醒。
          </div>
          <div className="assistant-row">
            <div className="assistant-field">
              <label className="assistant-label">起始日期</label>
              <input className="field-input" type="date" value={todoDate} onChange={(e) => setTodoDate(e.target.value)} data-testid="assistant-todo-date" />
            </div>
            <div className="assistant-field">
              <label className="assistant-label">天数</label>
              <div className="seg" data-testid="assistant-todo-days">
                {[3, 7, 14].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`seg-item ${todoDays === n ? 'seg-active' : ''}`}
                    onClick={() => setTodoDays(n)}
                    data-testid={`assistant-todo-days-${n}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => void handleTodo()} disabled={todoLoading} data-testid="assistant-todo-gen">
              <Sparkles size={14} strokeWidth={2} /> {todoLoading ? '生成中…' : '生成提醒'}
            </button>
          </div>
          {todoText && (
            <div className="assistant-result" data-testid="assistant-todo-result">
              <p className="assistant-result-text">{todoText}</p>
              <button type="button" className="btn btn-ghost btn-block" onClick={() => void handleTodo()} disabled={todoLoading} data-testid="assistant-todo-regen">
                <RefreshCw size={14} strokeWidth={2} /> 重新生成
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'report' && (
        <div className="assistant-pane" data-testid="assistant-report">
          <div className="assistant-desc">
            汇总本周或本月的真实记录（时间块、任务、心情、每日小结），自动生成文本周报 / 月报，可直接复制使用。
          </div>
          <div className="assistant-row">
            <div className="assistant-field">
              <label className="assistant-label">报告范围</label>
              <div className="seg" data-testid="assistant-report-scope">
                <button
                  type="button"
                  className={`seg-item ${reportScope === 'week' ? 'seg-active' : ''}`}
                  onClick={() => setReportScope('week')}
                  data-testid="assistant-report-week"
                >
                  本周
                </button>
                <button
                  type="button"
                  className={`seg-item ${reportScope === 'month' ? 'seg-active' : ''}`}
                  onClick={() => setReportScope('month')}
                  data-testid="assistant-report-month"
                >
                  本月
                </button>
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => void handleReport()} disabled={reportLoading} data-testid="assistant-report-gen">
              <Sparkles size={14} strokeWidth={2} /> {reportLoading ? '生成中…' : '生成报告'}
            </button>
          </div>
          {reportText && (
            <div className="assistant-result" data-testid="assistant-report-result">
              <p className="assistant-result-text">{reportText}</p>
              <button type="button" className="btn btn-ghost btn-block" onClick={() => void handleReport()} disabled={reportLoading} data-testid="assistant-report-regen">
                <RefreshCw size={14} strokeWidth={2} /> 重新生成
              </button>
            </div>
          )}
        </div>
      )}

      <p className="assistant-note">秘书动作全部基于应用内已有记录生成，不读取任何外部数据。</p>
    </Sheet>
  );
}