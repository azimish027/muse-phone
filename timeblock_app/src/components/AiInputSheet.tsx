import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, History, Mic, Plus, RotateCcw, Sparkles, Square, Trash2, Wrench } from 'lucide-react';
import type { DailyTask, Granularity, Tag, TimeBlock } from '../types';
import { Sheet } from './Sheet';
import { useVoiceInput } from '../hooks/useVoiceInput';
import type { AiDailyIntent } from '../lib/ai';
import { AiChatError, buildCorrectedText, buildScheduleContextText, parseDailyIntentFallback, parseDailyIntentWithAI, safePanelDate } from '../lib/ai';
import { addDays, fmtDate } from '../lib/timeUtils';
import { clearAiHistory, loadAiHistory, pushAiHistory, removeAiHistory, updateAiHistorySaved } from '../lib/aiHistory';
import type { AiHistoryEntry } from '../lib/aiHistory';
import { loadBlocksByDateRange } from '../lib/db';
import { loadPanel } from '../lib/dailyPanel';

interface AiInputSheetProps {
  open: boolean;
  onClose: () => void;
  /** 当前日期（作为默认目标日期） */
  date: string;
  granularity: Granularity;
  tags: Tag[];
  /** 打开面板后自动开始聆听 */
  autoVoice?: boolean;
  onSaveBlocks: (blocks: TimeBlock[]) => Promise<void>;
  /** 面板补丁：合并到目标日期当天的每日面板 */
  onSavePanel: (date: string, patch: { mood?: string; tasks?: DailyTask[]; important?: string[]; summary?: string }) => void;
  onToast: (msg: string) => void;
}

interface EditableBlock {
  key: string;
  keep: boolean;
  title: string;
  date: string;
  start: string;
  end: string;
  tagName: string;
  /** 保存时是否同步生成一条对应日期的今日任务 */
  toTask: boolean;
}

interface EditableItem {
  key: string;
  keep: boolean;
  text: string;
}

interface EditableDay {
  key: string;
  date: string;
  tasks: EditableItem[];
  mood: string;
  important: EditableItem[];
  summary: string;
  plan: string;
}

function minutesToHHmm(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function hhmmToMinutes(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}

function newKey(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyDay(date: string): EditableDay {
  return { key: newKey(), date, tasks: [], mood: '', important: [], summary: '', plan: '' };
}

function dayHasContent(d: EditableDay): boolean {
  return (
    d.tasks.some((t) => t.keep && t.text.trim()) ||
    d.mood.trim().length > 0 ||
    d.important.some((t) => t.keep && t.text.trim()) ||
    d.summary.trim().length > 0 ||
    d.plan.trim().length > 0
  );
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function AiInputSheet({ open, onClose, date, granularity, tags, autoVoice, onSaveBlocks, onSavePanel, onToast }: AiInputSheetProps) {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  /** 解析来源：online=在线 AI 模型推理成功；fallback=本地规则兜底 */
  const [parseSource, setParseSource] = useState<'online' | 'fallback' | null>(null);
  /** 在线 AI 失败原因：not-supported 环境未提供 / network 网络或服务异常 / format 返回格式异常 */
  const [aiFailReason, setAiFailReason] = useState<'not-supported' | 'network' | 'format' | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  /** AI 复述理解与助理评估 */
  const [understanding, setUnderstanding] = useState('');
  const [assessment, setAssessment] = useState('');
  /** 一句话纠正：说错了可输入纠正内容重新解析 */
  const [correction, setCorrection] = useState('');
  const [reparsing, setReparsing] = useState(false);
  const [blocks, setBlocks] = useState<EditableBlock[]>([]);
  const [days, setDays] = useState<EditableDay[]>([]);
  /** 面板视图：input=输入/预览，history=历史回看 */
  const [view, setView] = useState<'input' | 'history'>('input');
  const [history, setHistory] = useState<AiHistoryEntry[]>(() => loadAiHistory());
  const historyIdRef = useRef<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const { phase: voicePhase, error: voiceErrorInfo, startVoice, stopVoice, resetError } = useVoiceInput((t) => setText(t));

  const resetAll = useCallback(() => {
    setText('');
    setParsing(false);
    setParseError(null);
    setFallbackUsed(false);
    setParseSource(null);
    setAiFailReason(null);
    setSaveError('');
    setSaving(false);
    setUnderstanding('');
    setAssessment('');
    setCorrection('');
    setReparsing(false);
    setBlocks([]);
    setDays([emptyDay(date)]);
    setView('input');
    historyIdRef.current = null;
    resetError();
  }, [date, resetError]);

  useEffect(() => {
    if (!open) return;
    resetAll();
    window.setTimeout(() => textRef.current?.focus(), 150);
  }, [open, resetAll]);

  // 底部语音入口打开时自动开始聆听
  useEffect(() => {
    if (!open || !autoVoice) return;
    const t = window.setTimeout(() => {
      void startVoice();
    }, 400);
    return () => window.clearTimeout(t);
  }, [open, autoVoice, startVoice]);

  /** 应用解析结果：按天拆分预览 + 写入历史记录 */
  const applyIntent = useCallback(
    (intent: AiDailyIntent, rawText: string, source: 'online' | 'fallback') => {
      setParseSource(source);
      setUnderstanding(intent.understanding || '');
      setAssessment(intent.assessment || '');
      const daySrc =
        intent.days.length > 0
          ? intent.days
          : [{ date: intent.date, tasks: intent.tasks, mood: intent.mood, important: intent.important, summary: intent.summary, plan: intent.plan }];
      setBlocks(
        intent.blocks.map((b) => ({
          key: newKey(),
          keep: true,
          title: b.title,
          date: safePanelDate(b.date, date),
          start: minutesToHHmm(b.startMinute),
          end: minutesToHHmm(b.endMinute),
          tagName: b.tagName,
          toTask: true,
        })),
      );
      setDays(
        daySrc.map((d) => ({
          key: newKey(),
          date: safePanelDate(d.date, date),
          tasks: d.tasks.map((t) => ({ key: newKey(), keep: true, text: t })),
          mood: d.mood,
          important: d.important.map((t) => ({ key: newKey(), keep: true, text: t })),
          summary: d.summary,
          plan: d.plan,
        })),
      );
      const id = newKey();
      historyIdRef.current = id;
      const count = intent.blocks.length + daySrc.reduce((n, d) => n + d.tasks.length + d.important.length, 0);
      setHistory(
        pushAiHistory({
          id,
          text: rawText,
          createdAt: Date.now(),
          savedAt: null,
          count,
          dayCount: daySrc.length,
          understanding: intent.understanding || '',
          assessment: intent.assessment || '',
          blocks: intent.blocks.map((b) => ({
            key: newKey(),
            keep: true,
            title: b.title,
            date: safePanelDate(b.date, date),
            start: minutesToHHmm(b.startMinute),
            end: minutesToHHmm(b.endMinute),
            tagName: b.tagName,
            toTask: true,
          })),
          days: daySrc.map((d) => ({
            key: newKey(),
            date: safePanelDate(d.date, date),
            tasks: d.tasks.map((t) => ({ key: newKey(), keep: true, text: t })),
            mood: d.mood,
            important: d.important.map((t) => ({ key: newKey(), keep: true, text: t })),
            summary: d.summary,
            plan: d.plan,
          })),
        }),
      );
    },
    [date],
  );

  /** 加载近几天已有安排（时间块 + 每日面板），用于助理评估上下文；失败不阻断解析 */
  const loadScheduleContext = useCallback(
    async (anchor: string): Promise<string> => {
      try {
        const start = fmtDate(addDays(new Date(`${anchor}T00:00:00`), -7));
        const end = fmtDate(addDays(new Date(`${anchor}T00:00:00`), 14));
        const blocks = await loadBlocksByDateRange(start, end);
        const tagById = new Map(tags.map((t) => [t.id, t.name]));
        const panels: { date: string; mood: string; tasks: { text: string; done: boolean }[]; important: string[]; summary: string }[] = [];
        const seen = new Set<string>();
        const days = new Set<string>([...new Set(blocks.map((b) => b.recordDate))]);
        // 时间块已覆盖的日期之外，再补扫面板有记录的日期（最多补 21 天，避免过多请求）
        let cur = new Date(`${start}T00:00:00`);
        const guard = new Date(`${end}T00:00:00`);
        while (cur <= guard) {
          const ds = fmtDate(cur);
          if (!days.has(ds)) days.add(ds);
          cur = addDays(cur, 1);
        }
        for (const ds of [...days].sort()) {
          if (seen.has(ds)) continue;
          seen.add(ds);
          const p = loadPanel(ds);
          if (p.mood || p.tasks.length || p.important.length || p.summary.trim()) {
            panels.push({
              date: ds,
              mood: p.mood,
              tasks: p.tasks.map((t) => ({ text: t.text, done: t.done })),
              important: p.important,
              summary: p.summary,
            });
          }
        }
        return buildScheduleContextText({
          startDate: start,
          endDate: end,
          blocks: blocks.map((b) => ({
            date: b.recordDate,
            startMinute: b.startMinute,
            endMinute: b.endMinute,
            title: b.title,
            tagName: b.tagId ? (tagById.get(b.tagId) ?? '') : '',
          })),
          panels,
        });
      } catch {
        return '';
      }
    },
    [tags],
  );

  /** 统一解析入口：parseText 支持纠正后的合并文本；isReparse 标记纠正重新解析 */
  const runParse = useCallback(
    async (parseText: string, isReparse = false) => {
      const t = parseText.trim();
      if (!t || parsing || reparsing) return;
      setParsing(true);
      setReparsing(isReparse);
      setParseError(null);
      setFallbackUsed(false);
      setAiFailReason(null);
      const tagNames = tags.map((x) => x.name);
      const contextText = await loadScheduleContext(date);
      try {
        const intent = await parseDailyIntentWithAI(t, fmtDate(new Date()), granularity, tagNames, contextText);
        const hasContent =
          intent.blocks.length > 0 ||
          intent.days.some((d) => d.tasks.length > 0 || d.mood || d.important.length > 0 || d.summary || d.plan) ||
          intent.tasks.length > 0 ||
          intent.mood ||
          intent.important.length > 0 ||
          intent.summary ||
          intent.plan;
        if (!hasContent) {
          setParseError('没有识别到可安排的内容，请换个说法，或直接手动填写。');
        } else {
          applyIntent(intent, t, 'online');
        }
      } catch (err) {
        // 在线 AI 不可用（环境未提供 / 网络异常 / 返回格式异常）→ 本地规则兜底，并记录原因供提示与重试
        setAiFailReason(err instanceof AiChatError ? err.reason : 'network');
        const intent = parseDailyIntentFallback(t, fmtDate(new Date()), granularity);
        const hasContent =
          intent.blocks.length > 0 ||
          intent.days.some((d) => d.tasks.length > 0 || d.mood || d.important.length > 0 || d.summary || d.plan) ||
          intent.tasks.length > 0 ||
          intent.mood ||
          intent.important.length > 0 ||
          intent.summary ||
          intent.plan;
        if (!hasContent) {
          setParseError('AI 解析不可用（可能网络异常），本地也未能识别出可安排内容，请直接手动填写。');
        } else {
          applyIntent(intent, t, 'fallback');
          setFallbackUsed(true);
        }
      } finally {
        setParsing(false);
        setReparsing(false);
      }
    },
    [applyIntent, date, granularity, loadScheduleContext, parsing, reparsing, tags],
  );

  const handleParse = useCallback(() => {
    void runParse(text);
  }, [runParse, text]);

  /** 一句话纠正：把纠正内容并入原文后重新解析，更新理解、评估与预览 */
  const handleCorrect = useCallback(() => {
    const c = correction.trim();
    if (!c) {
      setParseError('先输入想纠正的内容，例如「时间改成下午三点」或「任务不要了」。');
      return;
    }
    if (parsing || reparsing) return;
    setParseError(null);
    void runParse(buildCorrectedText(text, c), true);
  }, [correction, parsing, reparsing, runParse, text]);

  /** 从历史载入：恢复原文与结构化快照，便于修改后再次保存 */
  const loadEntry = useCallback(
    (h: AiHistoryEntry) => {
      setText(h.text);
      setBlocks(h.blocks.map((b) => ({ ...b, key: newKey(), toTask: b.toTask !== false })));
      setDays(
        h.days.length > 0
          ? h.days.map((d) => ({
              ...d,
              key: newKey(),
              tasks: d.tasks.map((t) => ({ ...t, key: newKey() })),
              important: d.important.map((t) => ({ ...t, key: newKey() })),
            }))
          : [emptyDay(date)],
      );
      historyIdRef.current = h.id;
      setUnderstanding(h.understanding || '');
      setAssessment(h.assessment || '');
      setParseError(null);
      setFallbackUsed(false);
      setParseSource(null);
      setSaveError('');
      setView('input');
      window.setTimeout(() => textRef.current?.focus(), 150);
    },
    [date],
  );

  const handleSave = async () => {
    // 校验并组装时间块
    const keptBlocks = blocks.filter((b) => b.keep && b.title.trim());
    const outBlocks: TimeBlock[] = [];
    for (const b of keptBlocks) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date.trim())) {
        setSaveError(`时间块「${b.title}」的日期格式不正确，应为 YYYY-MM-DD`);
        return;
      }
      const s = hhmmToMinutes(b.start);
      const e = hhmmToMinutes(b.end);
      if (s == null || e == null) {
        setSaveError(`时间块「${b.title}」的时间格式不正确，应为 HH:mm`);
        return;
      }
      if (e <= s) {
        setSaveError(`时间块「${b.title}」的结束时间需晚于开始时间`);
        return;
      }
      const tag = b.tagName.trim() ? tags.find((x) => x.name === b.tagName.trim()) : undefined;
      const now = Date.now();
      outBlocks.push({
        id: `${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        title: b.title.trim(),
        recordDate: b.date.trim(),
        startMinute: s,
        endMinute: e,
        tagId: tag?.id ?? '',
        note: '',
        createdAt: now,
        updatedAt: now,
      });
    }

    // 校验并组装每日面板（支持多日）：面板天 + 时间块天统一收集，时间块勾选「同步为今日任务」时并入对应日期
    const savedDays: { date: string; patch: { mood?: string; tasks?: DailyTask[]; important?: string[]; summary?: string } }[] = [];
    const allDates = new Map<string, { tasks: DailyTask[]; important: string[]; mood: string; summary: string }>();
    for (const d of days) {
      const dd = d.date.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dd)) {
        setSaveError(`「${dd || '空日期'}」不是有效的日期，应为 YYYY-MM-DD`);
        return;
      }
      const keptTasks = d.tasks
        .filter((t) => t.keep && t.text.trim())
        .map((t) => {
          const now = Date.now();
          return {
            id: `${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
            text: t.text.trim(),
            emoji: '',
            done: false,
            createdAt: now,
          } satisfies DailyTask;
        });
      const keptImportant = d.important.filter((t) => t.keep && t.text.trim()).map((t) => t.text.trim());
      const finalSummary = [d.plan.trim() ? `📋 当日计划：${d.plan.trim()}` : '', d.summary.trim()].filter(Boolean).join('\n\n');
      allDates.set(dd, { tasks: keptTasks, important: keptImportant, mood: d.mood.trim(), summary: finalSummary });
    }
    // 时间块日期补入（面板没有但时间块存在时，任务也有落点）
    for (const b of keptBlocks) {
      const dd = b.date.trim();
      if (allDates.has(dd)) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dd)) {
        setSaveError(`时间块「${b.title}」的日期格式不正确，应为 YYYY-MM-DD`);
        return;
      }
      allDates.set(dd, { tasks: [], important: [], mood: '', summary: '' });
    }
    for (const [dd, v] of allDates) {
      const seen = new Set(v.tasks.map((t) => t.text.trim()));
      for (const b of keptBlocks) {
        if (b.date.trim() !== dd || !b.toTask) continue;
        const t = b.title.trim();
        if (!t || seen.has(t)) continue;
        seen.add(t);
        const now = Date.now();
        v.tasks.push({
          id: `${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          text: t,
          emoji: '',
          done: false,
          createdAt: now,
        });
      }
      if (v.tasks.length || v.mood || v.important.length || v.summary) {
        savedDays.push({
          date: dd,
          patch: {
            mood: v.mood || undefined,
            tasks: v.tasks.length ? v.tasks : undefined,
            important: v.important.length ? v.important : undefined,
            summary: v.summary || undefined,
          },
        });
      }
    }

    if (!outBlocks.length && savedDays.length === 0) {
      setSaveError('没有可保存的内容，请先解析或手动填写。');
      return;
    }

    setSaving(true);
    setSaveError('');
    try {
      if (outBlocks.length) await onSaveBlocks(outBlocks);
      for (const sd of savedDays) onSavePanel(sd.date, sd.patch);
      if (historyIdRef.current) {
        setHistory(updateAiHistorySaved(historyIdRef.current, Date.now()));
      }
      const parts: string[] = [];
      if (savedDays.length > 1) parts.push(`${savedDays.length} 天`);
      if (outBlocks.length) parts.push(`${outBlocks.length} 个时间块`);
      const taskTotal = savedDays.reduce((n, s) => n + (s.patch.tasks?.length ?? 0), 0);
      if (taskTotal) parts.push(`${taskTotal} 个任务`);
      if (savedDays.some((s) => s.patch.mood)) parts.push('心情');
      const impTotal = savedDays.reduce((n, s) => n + (s.patch.important?.length ?? 0), 0);
      if (impTotal) parts.push(`${impTotal} 条重要事项`);
      if (savedDays.some((s) => s.patch.summary)) parts.push('小结');
      onToast(`已保存：${parts.join('、') || '内容'}`);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败，请重试');
      setSaving(false);
    }
  };

  const hasDraft = blocks.length > 0 || days.some(dayHasContent);

  /** 落库统计：勾选的时间块任务 + 面板任务/重要事项，与已有面板内容去重后计数 */
  const mergeStats = useMemo(() => {
    const taskTexts: string[] = [];
    const importantTexts: string[] = [];
    for (const b of blocks) {
      if (b.keep && b.title.trim() && b.toTask) taskTexts.push(b.title.trim());
    }
    for (const d of days) {
      for (const t of d.tasks) {
        if (t.keep && t.text.trim()) taskTexts.push(t.text.trim());
      }
      for (const t of d.important) {
        if (t.keep && t.text.trim()) importantTexts.push(t.text.trim());
      }
    }
    const dateSet = new Set<string>();
    for (const b of blocks) {
      if (b.keep && /^\d{4}-\d{2}-\d{2}$/.test(b.date.trim())) dateSet.add(b.date.trim());
    }
    for (const d of days) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d.date.trim())) dateSet.add(d.date.trim());
    }
    const existingTasks = new Set<string>();
    const existingImportant = new Set<string>();
    dateSet.forEach((ds) => {
      const p = loadPanel(ds);
      p.tasks.forEach((t) => existingTasks.add(t.text.trim()));
      p.important.forEach((i) => existingImportant.add(i.trim()));
    });
    return {
      tasks: new Set(taskTexts.filter((t) => !existingTasks.has(t))).size,
      important: new Set(importantTexts.filter((i) => !existingImportant.has(i))).size,
    };
  }, [blocks, days]);
  /** 第 0 天沿用旧 testid，保证既有验收口径；多日时按天索引区分 */
  const dayPrefix = (di: number, name: string) => (di === 0 ? `ai-${name}` : `ai-day-${di}-${name}`);

  return (
    <Sheet open={open} onClose={onClose} title="AI 输入" testId="ai-input-sheet">
      {view === 'history' ? (
        <div className="ai-history" data-testid="ai-history">
          <div className="ai-history-head">
            <button type="button" className="ai-back-btn" onClick={() => setView('input')} data-testid="ai-history-back">
              <ChevronLeft size={14} strokeWidth={2} /> 返回输入
            </button>
            {history.length > 0 && (
              <button
                type="button"
                className="ai-history-clear"
                onClick={() => {
                  clearAiHistory();
                  setHistory([]);
                }}
                data-testid="ai-history-clear"
              >
                清空历史
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="ai-empty">还没有 AI 输入记录，解析成功的内容会自动保存在这里，可随时回看再编辑。</div>
          ) : (
            <div className="ai-history-list">
              {history.map((h) => (
                <div className="ai-history-item" key={h.id} data-testid={`ai-history-item-${h.id}`}>
                  <button type="button" className="ai-history-main" onClick={() => loadEntry(h)} data-testid={`ai-history-load-${h.id}`}>
                    <div className="ai-history-text">{h.text}</div>
                    <div className="ai-history-meta">
                      <span>{fmtTime(h.createdAt)}</span>
                      {h.dayCount > 1 && <span>{h.dayCount} 天</span>}
                      {h.count > 0 && <span>{h.count} 项</span>}
                      <span className={h.savedAt ? 'ai-history-saved' : 'ai-history-unsaved'}>{h.savedAt ? '已保存' : '未保存'}</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="ai-remove"
                    onClick={() => setHistory(removeAiHistory(h.id))}
                    aria-label="删除记录"
                    data-testid={`ai-history-del-${h.id}`}
                  >
                    <Trash2 size={15} strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="ai-toolbar">
            <div className="ai-hint">
              一句话安排时间块、任务、心情和小结；AI 推理模型会先复述理解并评估与已有安排的冲突，确认无误后再保存。支持一次生成多天计划，例如：<br />
              “接下来三天每天上午健身1小时，晚上写总结”
            </div>
            <button type="button" className="ai-history-btn" onClick={() => setView('history')} data-testid="ai-open-history">
              <History size={14} strokeWidth={2} /> 历史
            </button>
          </div>
          <div className="qa-input-wrap">
            <textarea
              ref={textRef}
              className="qa-textarea"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="说一句或输入一句话，点「AI 解析」生成安排预览"
              data-testid="ai-input"
            />
            <button
              type="button"
              className={`qa-voice-btn ${voicePhase === 'listening' || voicePhase === 'starting' ? 'qa-voice-btn-active' : ''}`}
              onClick={() => {
                if (voicePhase === 'starting' || voicePhase === 'listening' || voicePhase === 'stopping') {
                  void stopVoice();
                } else {
                  void startVoice();
                }
              }}
              aria-label={voicePhase === 'listening' ? '停止聆听' : '语音输入'}
              data-testid="ai-voice"
            >
              {voicePhase === 'listening' || voicePhase === 'starting' ? <Square size={18} strokeWidth={2} /> : <Mic size={18} strokeWidth={2} />}
            </button>
          </div>
          {(voicePhase === 'listening' || voicePhase === 'starting' || voicePhase === 'stopping') && (
            <div className="qa-listening" data-testid="ai-listening">
              <span className="qa-listening-dot" /> 正在聆听…（说完点停止按钮）
            </div>
          )}
          {voiceErrorInfo && (
            <div className="qa-error" data-testid="ai-voice-error">
              {voiceErrorInfo.message}
              {voiceErrorInfo.retryable && (
                <button type="button" className="ai-retry-btn" onClick={() => void startVoice()} data-testid="ai-voice-retry">
                  重试
                </button>
              )}
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary btn-block ai-parse-btn"
            onClick={() => void handleParse()}
            disabled={parsing || !text.trim()}
            data-testid="ai-parse"
          >
            <Sparkles size={16} strokeWidth={2} /> {parsing ? 'AI 推理中…' : 'AI 解析'}
          </button>
          {parseError && (
            <div className="qa-error" data-testid="ai-parse-error">
              {parseError}
            </div>
          )}
          {fallbackUsed && (
            <div className="ai-msg" data-testid="ai-fallback-note">
              {aiFailReason === 'not-supported'
                ? '当前环境未提供在线 AI 能力，已用本地规则兜底解析；在支持在线 AI 的客户端中打开后可重试。'
                : aiFailReason === 'format'
                  ? '在线 AI 返回格式异常，已用本地规则兜底解析；可直接修改下方结果，或点重试再来一次。'
                  : '在线 AI 暂时不可用（网络或服务异常），已用本地规则兜底解析；网络恢复后可点下方重试。'}
              <button
                type="button"
                className="ai-retry-btn"
                onClick={() => void runParse(text)}
                disabled={parsing || reparsing}
                data-testid="ai-online-retry"
              >
                重试在线解析
              </button>
            </div>
          )}

          {hasDraft && (
            <div className="ai-preview" data-testid="ai-preview">
              {parseSource === 'online' && (
                <div className="ai-online-badge" data-testid="ai-online-badge">
                  <Sparkles size={12} strokeWidth={2} /> 由在线 AI 模型推理解析，可直接修改后保存
                </div>
              )}
              {(blocks.length > 0 || days.some((d) => d.tasks.length > 0 || d.important.length > 0)) && (
                <div className="ai-merge-stats" data-testid="ai-merge-stats">
                  <span className={`ai-merge-stat ${mergeStats.tasks === 0 ? 'ai-merge-stat-muted' : ''}`} data-testid="ai-merge-task-count">
                    将进入今日任务 {mergeStats.tasks} 条
                  </span>
                  <span className={`ai-merge-stat ${mergeStats.important === 0 ? 'ai-merge-stat-muted' : ''}`} data-testid="ai-merge-important-count">
                    重要事项 {mergeStats.important} 条
                  </span>
                </div>
              )}
              {understanding && (
                <div className="ai-understanding" data-testid="ai-understanding">
                  <div className="ai-card-title">
                    <span className="material-icons">psychology</span> AI 的理解
                  </div>
                  <p>{understanding}</p>
                </div>
              )}
              {assessment && (
                <div className="ai-assessment" data-testid="ai-assessment">
                  <div className="ai-card-title">
                    <AlertTriangle size={15} strokeWidth={2} /> 助理评估
                  </div>
                  <p>{assessment}</p>
                </div>
              )}

              {understanding && (
                <div className="ai-correct" data-testid="ai-correct">
                  <div className="ai-card-title">
                    <Wrench size={14} strokeWidth={2} /> 理解不对？一句话纠正
                  </div>
                  <div className="ai-correct-row">
                    <input
                      className="field-input ai-correct-input"
                      value={correction}
                      onChange={(e) => setCorrection(e.target.value)}
                      placeholder="如：改成明天下午三点 / 任务不要了"
                      data-testid="ai-correct-input"
                    />
                    <button type="button" className="btn btn-ghost ai-correct-btn" onClick={handleCorrect} disabled={parsing || reparsing || !correction.trim()} data-testid="ai-correct-submit">
                      {reparsing ? '重新解析中…' : '按纠正重新解析'}
                    </button>
                  </div>
                  <p className="ai-correct-hint">也可以直接在下方预览里手动修改每一项。</p>
                </div>
              )}

              {blocks.length > 0 && (
                <div className="ai-section">
                  <div className="ai-section-title">
                    <span className="material-icons">schedule</span> 时间块
                  </div>
                  {blocks.map((b, idx) => (
                    <div className="ai-item" key={b.key}>
                      <input
                        type="checkbox"
                        className="ai-item-keep"
                        checked={b.keep}
                        onChange={(e) => setBlocks((prev) => prev.map((x) => (x.key === b.key ? { ...x, keep: e.target.checked } : x)))}
                        aria-label="保留此时间块"
                        data-testid={`ai-block-keep-${idx}`}
                      />
                      <div className="ai-item-main">
                        <input
                          className="field-input ai-title"
                          value={b.title}
                          onChange={(e) => setBlocks((prev) => prev.map((x) => (x.key === b.key ? { ...x, title: e.target.value } : x)))}
                          placeholder="标题"
                          data-testid={`ai-block-title-${idx}`}
                        />
                        <div className="ai-item-meta">
                          <input
                            className="field-input ai-date"
                            value={b.date}
                            onChange={(e) => setBlocks((prev) => prev.map((x) => (x.key === b.key ? { ...x, date: e.target.value } : x)))}
                            placeholder="YYYY-MM-DD"
                            data-testid={`ai-block-date-${idx}`}
                          />
                          <input
                            className="field-input ai-time"
                            value={b.start}
                            onChange={(e) => setBlocks((prev) => prev.map((x) => (x.key === b.key ? { ...x, start: e.target.value } : x)))}
                            placeholder="开始 HH:mm"
                            data-testid={`ai-block-start-${idx}`}
                          />
                          <span className="ai-time-sep">至</span>
                          <input
                            className="field-input ai-time"
                            value={b.end}
                            onChange={(e) => setBlocks((prev) => prev.map((x) => (x.key === b.key ? { ...x, end: e.target.value } : x)))}
                            placeholder="结束 HH:mm"
                            data-testid={`ai-block-end-${idx}`}
                          />
                        </div>
                        <label className="ai-item-task-opt" data-testid={`ai-block-task-${idx}`}>
                          <input
                            type="checkbox"
                            checked={b.toTask}
                            onChange={(e) => setBlocks((prev) => prev.map((x) => (x.key === b.key ? { ...x, toTask: e.target.checked } : x)))}
                            data-testid={`ai-block-task-input-${idx}`}
                          />
                          同步为今日任务
                        </label>
                      </div>
                      <button
                        type="button"
                        className="ai-remove"
                        onClick={() => setBlocks((prev) => prev.filter((x) => x.key !== b.key))}
                        aria-label="删除此时间块"
                        data-testid={`ai-block-remove-${idx}`}
                      >
                        <Trash2 size={15} strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {days.map((d, di) => (
                <div className="ai-day" key={d.key} data-testid={`ai-day-${di}`}>
                  <div className="ai-day-head">
                    <span className="material-icons">calendar_today</span>
                    <input
                      className="field-input ai-day-date"
                      value={d.date}
                      onChange={(e) => setDays((prev) => prev.map((x) => (x.key === d.key ? { ...x, date: e.target.value } : x)))}
                      placeholder="YYYY-MM-DD"
                      data-testid={`ai-day-date-${di}`}
                    />
                    {days.length > 1 && (
                      <button
                        type="button"
                        className="ai-remove ai-day-remove"
                        onClick={() => setDays((prev) => prev.filter((x) => x.key !== d.key))}
                        aria-label="删除这一天"
                        data-testid={`ai-day-remove-${di}`}
                      >
                        <Trash2 size={15} strokeWidth={2} />
                      </button>
                    )}
                  </div>

                  {d.tasks.length > 0 && (
                    <div className="ai-section">
                      <div className="ai-section-title">
                        <span className="material-icons">checklist</span> 任务
                      </div>
                      {d.tasks.map((t, ti) => (
                        <div className="ai-item" key={t.key}>
                          <input
                            type="checkbox"
                            className="ai-item-keep"
                            checked={t.keep}
                            onChange={(e) =>
                              setDays((prev) =>
                                prev.map((x) => (x.key === d.key ? { ...x, tasks: x.tasks.map((y) => (y.key === t.key ? { ...y, keep: e.target.checked } : y)) } : x)),
                              )
                            }
                            aria-label="保留此任务"
                            data-testid={`${dayPrefix(di, 'task')}-keep-${ti}`}
                          />
                          <input
                            className="field-input ai-title"
                            value={t.text}
                            onChange={(e) =>
                              setDays((prev) =>
                                prev.map((x) => (x.key === d.key ? { ...x, tasks: x.tasks.map((y) => (y.key === t.key ? { ...y, text: e.target.value } : y)) } : x)),
                              )
                            }
                            placeholder="任务内容"
                            data-testid={`${dayPrefix(di, 'task')}-text-${ti}`}
                          />
                          <button
                            type="button"
                            className="ai-remove"
                            onClick={() =>
                              setDays((prev) => prev.map((x) => (x.key === d.key ? { ...x, tasks: x.tasks.filter((y) => y.key !== t.key) } : x)))
                            }
                            aria-label="删除此任务"
                            data-testid={`${dayPrefix(di, 'task')}-remove-${ti}`}
                          >
                            <Trash2 size={15} strokeWidth={2} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="ai-add"
                        onClick={() =>
                          setDays((prev) => prev.map((x) => (x.key === d.key ? { ...x, tasks: [...x.tasks, { key: newKey(), keep: true, text: '' }] } : x)))
                        }
                        data-testid={`${dayPrefix(di, 'task')}-add`}
                      >
                        <Plus size={14} strokeWidth={2} /> 添加任务
                      </button>
                    </div>
                  )}

                  {d.important.length > 0 && (
                    <div className="ai-section">
                      <div className="ai-section-title">
                        <span className="material-icons">push_pin</span> 重要事项
                      </div>
                      {d.important.map((t, ti) => (
                        <div className="ai-item" key={t.key}>
                          <input
                            type="checkbox"
                            className="ai-item-keep"
                            checked={t.keep}
                            onChange={(e) =>
                              setDays((prev) =>
                                prev.map((x) =>
                                  x.key === d.key ? { ...x, important: x.important.map((y) => (y.key === t.key ? { ...y, keep: e.target.checked } : y)) } : x,
                                ),
                              )
                            }
                            aria-label="保留此事项"
                            data-testid={`${dayPrefix(di, 'important')}-keep-${ti}`}
                          />
                          <input
                            className="field-input ai-title"
                            value={t.text}
                            onChange={(e) =>
                              setDays((prev) =>
                                prev.map((x) =>
                                  x.key === d.key ? { ...x, important: x.important.map((y) => (y.key === t.key ? { ...y, text: e.target.value } : y)) } : x,
                                ),
                              )
                            }
                            placeholder="事项内容"
                            data-testid={`${dayPrefix(di, 'important')}-text-${ti}`}
                          />
                          <button
                            type="button"
                            className="ai-remove"
                            onClick={() =>
                              setDays((prev) =>
                                prev.map((x) => (x.key === d.key ? { ...x, important: x.important.filter((y) => y.key !== t.key) } : x)),
                              )
                            }
                            aria-label="删除此事项"
                            data-testid={`${dayPrefix(di, 'important')}-remove-${ti}`}
                          >
                            <Trash2 size={15} strokeWidth={2} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="ai-add"
                        onClick={() =>
                          setDays((prev) =>
                            prev.map((x) => (x.key === d.key ? { ...x, important: [...x.important, { key: newKey(), keep: true, text: '' }] } : x)),
                          )
                        }
                        data-testid={`${dayPrefix(di, 'important')}-add`}
                      >
                        <Plus size={14} strokeWidth={2} /> 添加重要事项
                      </button>
                    </div>
                  )}

                  <div className="ai-section">
                    <div className="ai-section-title">
                      <span className="material-icons">mood</span> 心情
                    </div>
                    <div className="ai-item">
                      <input
                        className="field-input ai-title"
                        value={d.mood}
                        onChange={(e) => setDays((prev) => prev.map((x) => (x.key === d.key ? { ...x, mood: e.target.value } : x)))}
                        placeholder="如：😊 开心（留空则不设置）"
                        data-testid={`${dayPrefix(di, 'mood')}`}
                      />
                    </div>
                  </div>

                  <div className="ai-section">
                    <div className="ai-section-title">
                      <span className="material-icons">edit_note</span> 小结
                    </div>
                    <textarea
                      className="field-input ai-summary"
                      rows={2}
                      value={d.summary}
                      onChange={(e) => setDays((prev) => prev.map((x) => (x.key === d.key ? { ...x, summary: e.target.value } : x)))}
                      placeholder="当日小结（可选）"
                      data-testid={`${dayPrefix(di, 'summary')}`}
                    />
                  </div>

                  <div className="ai-section">
                    <div className="ai-section-title">
                      <span className="material-icons">event_note</span> 计划
                    </div>
                    <textarea
                      className="field-input ai-summary"
                      rows={2}
                      value={d.plan}
                      onChange={(e) => setDays((prev) => prev.map((x) => (x.key === d.key ? { ...x, plan: e.target.value } : x)))}
                      placeholder="当日计划（可选，会并入小结）"
                      data-testid={`${dayPrefix(di, 'plan')}`}
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="ai-day-add"
                onClick={() => setDays((prev) => [...prev, emptyDay(date)])}
                data-testid="ai-day-add"
              >
                <Plus size={14} strokeWidth={2} /> 添加一天
              </button>
            </div>
          )}

          {saveError && (
            <div className="qa-error" data-testid="ai-save-error">
              {saveError}
            </div>
          )}

          {hasDraft && (
            <div className="ai-confirm-bar">
              <button type="button" className="btn btn-primary btn-block" onClick={() => void handleSave()} disabled={saving} data-testid="ai-confirm">
                <Check size={16} strokeWidth={2.5} /> {saving ? '保存中…' : '理解无误，确认保存'}
              </button>
              <button
                type="button"
                className="ai-reset"
                onClick={resetAll}
                disabled={saving}
                aria-label="清空重来"
                data-testid="ai-reset"
              >
                <RotateCcw size={14} strokeWidth={2} /> 清空
              </button>
            </div>
          )}

          {!hasDraft && (
            <div className="sheet-footer">
              <button type="button" className="btn btn-ghost btn-block" onClick={onClose} data-testid="ai-cancel">
                取消
              </button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}