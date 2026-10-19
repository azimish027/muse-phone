import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Granularity, Tag, TimeBlock } from '../types';
import { Sheet, ConfirmDialog } from './Sheet';
import { TagSelect } from './TagSelect';
import { DateStepper, TimeStepper } from './TimeStepper';
import { DAY_MINUTES } from '../lib/timeUtils';
import { TAG_PALETTE } from '../types';

interface EditSheetProps {
  open: boolean;
  block: TimeBlock | null;
  granularity: Granularity;
  tags: Tag[];
  onClose: () => void;
  onSave: (block: TimeBlock) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function EditSheet({ open, block, granularity, tags, onClose, onSave, onDelete }: EditSheetProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startMinute, setStartMinute] = useState(0);
  const [endMinute, setEndMinute] = useState(30);
  const [tagId, setTagId] = useState('');
  const [note, setNote] = useState('');
  const [zoneMode, setZoneMode] = useState(false);
  const [zoneName, setZoneName] = useState('');
  const [zoneColor, setZoneColor] = useState('');
  const [zoneNote, setZoneNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open || !block) return;
    setTitle(block.title);
    setDate(block.recordDate);
    setStartMinute(block.startMinute);
    setEndMinute(block.endMinute);
    setTagId(block.tagId);
    setNote(block.note);
    setZoneMode(!!block.zoneMode);
    setZoneName(block.zoneName ?? '');
    setZoneColor(block.zoneColor ?? '');
    setZoneNote(block.zoneNote ?? '');
    setSaveError('');
    setConfirmDelete(false);
    setSaving(false);
  }, [open, block]);

  if (!block) return null;

  const isNew = block.id === '';

  const handleSave = async () => {
    if (endMinute <= startMinute) {
      setSaveError('结束时间需晚于开始时间');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const now = Date.now();
      const next: TimeBlock = {
        ...block,
        id: isNew ? `${now}` : block.id,
        title: title.trim() || '新时间块',
        recordDate: date,
        startMinute,
        endMinute,
        tagId,
        note: note.trim(),
        zoneMode,
        zoneName: zoneMode ? zoneName.trim() : '',
        zoneColor: zoneMode ? zoneColor.trim() : '',
        zoneNote: zoneMode ? zoneNote.trim() : '',
        updatedAt: now,
      };
      await onSave(next);
      setSaving(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '保存失败，请重试');
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await onDelete(block.id);
      setSaving(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '删除失败，请重试');
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <Sheet open={open} onClose={onClose} title={isNew ? '新建时间块' : '时间块'} testId="edit-sheet">
        <div className="qa-fields">
          <div className="field-row">
            <span className="field-label">标题</span>
            <input
              className="field-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="时间块标题"
              data-testid="edit-title"
            />
          </div>
          <DateStepper label="日期" value={date} onChange={setDate} testId="edit-date" />
          <div className="stepper-pair">
            <TimeStepper label="开始" value={startMinute} granularity={granularity} min={0} max={DAY_MINUTES - granularity} onChange={setStartMinute} testId="edit-start" />
            <TimeStepper label="结束" value={endMinute} granularity={granularity} min={startMinute + granularity} max={DAY_MINUTES} onChange={setEndMinute} testId="edit-end" />
          </div>
          {endMinute <= startMinute && <div className="qa-error">结束时间需晚于开始时间</div>}
          <div className="field-block">
            <span className="field-label">标签</span>
            <TagSelect tags={tags} value={tagId} onChange={setTagId} testId="edit-tag" />
          </div>
          <div className="field-block edit-zone">
            <div className="edit-zone-head">
              <span className="field-label">区域模式</span>
              <span className="edit-zone-hint">整块底色展示，适合上午专注、午休、通勤等时段</span>
            </div>
            <label className="edit-zone-toggle" data-testid="edit-zone-toggle">
              <input
                type="checkbox"
                checked={zoneMode}
                onChange={(e) => setZoneMode(e.target.checked)}
                data-testid="edit-zone-mode"
              />
              <span className="edit-zone-switch" />
              <span className="edit-zone-label">{zoneMode ? '已开启' : '未开启'}</span>
            </label>
            {zoneMode && (
              <div className="edit-zone-fields" data-testid="edit-zone-fields">
                <div className="field-row">
                  <span className="field-label">区域名称</span>
                  <input
                    className="field-input"
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    placeholder="如：上午专注（留空用标题）"
                    data-testid="edit-zone-name"
                  />
                </div>
                <div className="field-row edit-zone-color-row">
                  <span className="field-label">区域底色</span>
                  <div className="edit-zone-colors" data-testid="edit-zone-colors">
                    {TAG_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`edit-zone-color ${zoneColor === c ? 'edit-zone-color-active' : ''}`}
                        style={{ background: c }}
                        onClick={() => setZoneColor(c)}
                        aria-label={`底色 ${c}`}
                        data-testid={`edit-zone-color-${c.replace('#', '')}`}
                      />
                    ))}
                    <label className="edit-zone-custom" data-testid="edit-zone-custom">
                      <input
                        type="color"
                        value={/^#[0-9a-fA-F]{6}$/.test(zoneColor) ? zoneColor : '#7C3AED'}
                        onChange={(e) => setZoneColor(e.target.value)}
                        aria-label="自定义底色"
                        data-testid="edit-zone-color-custom"
                      />
                      <span className="edit-zone-custom-label">自定义</span>
                    </label>
                  </div>
                </div>
                <div className="field-row">
                  <span className="field-label">区域备注</span>
                  <input
                    className="field-input"
                    value={zoneNote}
                    onChange={(e) => setZoneNote(e.target.value)}
                    placeholder="如：这段时间集中处理最重要的事"
                    data-testid="edit-zone-note"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="field-row">
            <span className="field-label">备注</span>
            <input
              className="field-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="备注（可选）"
              data-testid="edit-note"
            />
          </div>
        </div>
        {saveError && <div className="qa-error" data-testid="edit-save-error">{saveError}</div>}
        <div className="sheet-footer">
          <button type="button" className="btn btn-primary btn-block" onClick={handleSave} disabled={saving} data-testid="edit-save">
            {saving ? '保存中…' : '保存'}
          </button>
          {!isNew && (
            <button type="button" className="btn btn-danger-text" onClick={() => setConfirmDelete(true)} disabled={saving} data-testid="edit-delete">
              <Trash2 size={16} strokeWidth={2} /> 删除
            </button>
          )}
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        title="删除该时间块？"
        description="删除后不可恢复。"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        testId="delete-confirm"
      />
    </>
  );
}