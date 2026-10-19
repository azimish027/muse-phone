import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { clamp, fmtMinute, pad2 } from '../lib/timeUtils';

interface TimeStepperProps {
  label: string;
  value: number;
  granularity: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  testId?: string;
}

/** 步进时间选择器：上下微调 + 点击数字直接输入 HH:mm。 */
export function TimeStepper({ label, value, granularity, min = 0, max = 1440, onChange, testId }: TimeStepperProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const step = (dir: 1 | -1) => {
    onChange(clamp(value + dir * granularity, min, max));
  };

  const startEdit = () => {
    setDraft(fmtMinute(value));
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    const m = draft.match(/^(\d{1,2})[:：](\d{2})$/);
    if (!m) return;
    const h = Number(m[1]);
    const mm = Number(m[2]);
    if (h > 23 || mm > 59) return;
    onChange(clamp(h * 60 + mm, min, max));
  };

  return (
    <div className="time-stepper" data-testid={testId}>
      <span className="field-label">{label}</span>
      <div className="stepper-row">
        <button type="button" className="stepper-btn" onClick={() => step(-1)} aria-label={`${label}减少`} data-testid={`${testId}-minus`}>
          <ChevronDown size={16} strokeWidth={2} />
        </button>
        {editing ? (
          <input
            className="stepper-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') setEditing(false);
            }}
            inputMode="numeric"
            autoFocus
            aria-label={`${label}时间输入`}
            data-testid={`${testId}-input`}
          />
        ) : (
          <button type="button" className="stepper-value" onClick={startEdit} aria-label={`${label}时间`} data-testid={`${testId}-value`}>
            {fmtMinute(value)}
          </button>
        )}
        <button type="button" className="stepper-btn" onClick={() => step(1)} aria-label={`${label}增加`} data-testid={`${testId}-plus`}>
          <ChevronUp size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

interface DateStepperProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId?: string;
}

/** 日期步进选择器：按天增减。 */
export function DateStepper({ label, value, onChange, testId }: DateStepperProps) {
  const shift = (dir: 1 | -1) => {
    const d = new Date(`${value}T00:00:00`);
    d.setDate(d.getDate() + dir);
    onChange(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
  };
  const parts = value.split('-');
  const display = parts.length === 3 ? `${Number(parts[1])}月${Number(parts[2])}日` : value;
  return (
    <div className="time-stepper" data-testid={testId}>
      <span className="field-label">{label}</span>
      <div className="stepper-row">
        <button type="button" className="stepper-btn" onClick={() => shift(-1)} aria-label={`${label}前一天`} data-testid={`${testId}-minus`}>
          <ChevronDown size={16} strokeWidth={2} />
        </button>
        <span className="stepper-value stepper-date" data-testid={`${testId}-value`}>
          {display}
        </span>
        <button type="button" className="stepper-btn" onClick={() => shift(1)} aria-label={`${label}后一天`} data-testid={`${testId}-plus`}>
          <ChevronUp size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}