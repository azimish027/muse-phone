import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';
import type { Granularity, Tag, TimeBlock } from '../types';
import { Sheet } from './Sheet';
import { TagSelect } from './TagSelect';
import { DateStepper, TimeStepper } from './TimeStepper';
import { parseQuickText } from '../lib/parser';
import { useVoiceInput } from '../hooks/useVoiceInput';
import { DAY_MINUTES, fmtDate, fmtMinute, snapMinute } from '../lib/timeUtils';

interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
  initial: { date: string; startMinute: number; endMinute: number; title?: string } | null;
  granularity: Granularity;
  tags: Tag[];
  autoVoice: boolean;
  onSave: (block: TimeBlock) => Promise<void>;
}

export function QuickAddSheet({ open, onClose, initial, granularity, tags, autoVoice, onSave }: QuickAddSheetProps) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('新时间块');
  const [date, setDate] = useState(fmtDate(new Date()));
  const [startMinute, setStartMinute] = useState(0);
  const [endMinute, setEndMinute] = useState(30);
  const [tagId, setTagId] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { phase: voicePhase, error: voiceErrorInfo, startVoice, stopVoice, resetError } = useVoiceInput((t) => setText(t));
  const [saveError, setSaveError] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);
  const debounceRef = useRef<number | null>(null);

  // 打开面板时初始化
  useEffect(() => {
    if (!open) return;
    const base = initial ?? (() => {
      const now = new Date();
      const s = snapMinute(now.getHours() * 60 + now.getMinutes(), granularity);
      return { date: fmtDate(now), startMinute: s, endMinute: Math.min(s + granularity, DAY_MINUTES) };
    })();
    setText('');
    setTitle(initial?.title && initial.title.trim() ? initial.title.trim() : '新时间块');
    setDate(base.date);
    setStartMinute(base.startMinute);
    setEndMinute(base.endMinute);
    setTagId('');
    setParseError(null);
    resetError();
    setSaveError('');
    setSaving(false);
    window.setTimeout(() => textRef.current?.focus(), 120);
  }, [open, initial, granularity, resetError]);
  // 输入防抖解析
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const outcome = parseQuickText(text, fmtDate(new Date()), granularity);
      if (outcome.ok && outcome.form) {
        setTitle(outcome.form.title);
        setDate(outcome.form.date);
        setStartMinute(outcome.form.startMinute);
        setEndMinute(outcome.form.endMinute);
        setParseError(null);
      } else if (text.trim()) {
        setParseError(outcome.error ?? '未能识别时间格式，请手动填写');
      } else {
        setParseError(null);
      }
    }, 500);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [text, open, granularity]);

  const handleVoice = useCallback(() => {
    if (voicePhase === 'starting' || voicePhase === 'listening' || voicePhase === 'stopping') {
      void stopVoice();
      return;
    }
    setParseError(null);
    void startVoice();
  }, [voicePhase, startVoice, stopVoice]);

  // 底部工具条语音按钮传入 autoVoice 时自动开始聆听
  useEffect(() => {
    if (!open || !autoVoice) return;
    const t = window.setTimeout(() => {
      void startVoice();
    }, 400);
    return () => window.clearTimeout(t);
  }, [open, autoVoice, startVoice]);

  const handleSave = async () => {
    if (endMinute <= startMinute) {
      setParseError('结束时间需晚于开始时间');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const block: TimeBlock = {
        id: `${Date.now()}`,
        title: title.trim() || '新时间块',
        recordDate: date,
        startMinute,
        endMinute,
        tagId,
        note: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await onSave(block);
      setSaving(false);
      if (voicePhase === 'listening' || voicePhase === 'starting') {
        await stopVoice();
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败，请重试');
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="快速添加" testId="quick-add-sheet">
      <div className="qa-input-wrap">
        <textarea
          ref={textRef}
          className="qa-textarea"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="如：14:00-15:30 产品评审 / 15:00 健身 1小时 / 明天10:00 晨会"
          data-testid="quick-input"
        />
        <button
          type="button"
          className={`qa-voice-btn ${voicePhase === 'listening' || voicePhase === 'starting' ? 'qa-voice-btn-active' : ''}`}
          onClick={handleVoice}
          aria-label={voicePhase === 'listening' ? '停止聆听' : '语音输入'}
          data-testid="quick-voice"
        >
          {voicePhase === 'listening' || voicePhase === 'starting' ? <Square size={18} strokeWidth={2} /> : <Mic size={18} strokeWidth={2} />}
        </button>
      </div>
      {(voicePhase === 'listening' || voicePhase === 'starting' || voicePhase === 'stopping') && (
        <div className="qa-listening" data-testid="voice-listening">
          <span className="qa-listening-dot" /> 正在聆听…（点击停止按钮结束）
        </div>
      )}
      {voiceErrorInfo && (
        <div className="qa-error" data-testid="quick-voice-error">
          {voiceErrorInfo.message}
          {voiceErrorInfo.retryable && (
            <button type="button" className="ai-retry-btn" onClick={() => void startVoice()} data-testid="quick-voice-retry">
              重试
            </button>
          )}
        </div>
      )}
      {/* 解析预览卡 */}
      <div className={`qa-preview ${parseError ? 'qa-preview-error' : ''}`} data-testid="quick-preview">
        {parseError ? (
          <div className="qa-preview-errtext" data-testid="quick-parse-error">
            {parseError}
          </div>
        ) : (
          <div className="qa-preview-main">
            <div className="qa-preview-date">{date}</div>
            <div className="qa-preview-time">
              {fmtMinute(startMinute)} - {fmtMinute(endMinute)}
            </div>
            <div className="qa-preview-title">{title || '新时间块'}</div>
          </div>
        )}
      </div>
      {/* 字段表单 */}
      <div className="qa-fields">
        <div className="field-row">
          <span className="field-label">标题</span>
          <input
            className="field-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="时间块标题"
            data-testid="quick-title"
          />
        </div>
        <DateStepper label="日期" value={date} onChange={setDate} testId="quick-date" />
        <div className="stepper-pair">
          <TimeStepper label="开始" value={startMinute} granularity={granularity} min={0} max={DAY_MINUTES - granularity} onChange={setStartMinute} testId="quick-start" />
          <TimeStepper label="结束" value={endMinute} granularity={granularity} min={startMinute + granularity} max={DAY_MINUTES} onChange={setEndMinute} testId="quick-end" />
        </div>
        <div className="field-block">
          <span className="field-label">标签</span>
          <TagSelect tags={tags} value={tagId} onChange={setTagId} testId="quick-tag" />
        </div>
      </div>
      {saveError && <div className="qa-error" data-testid="quick-save-error">{saveError}</div>}
      <div className="sheet-footer">
        <button type="button" className="btn btn-primary btn-block" onClick={handleSave} disabled={saving} data-testid="quick-save">
          {saving ? '保存中…' : '创建时间块'}
        </button>
        <button type="button" className="btn btn-ghost btn-block" onClick={onClose} data-testid="quick-cancel">
          取消
        </button>
      </div>
    </Sheet>
  );
}