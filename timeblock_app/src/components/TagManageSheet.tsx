import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Tag } from '../types';
import { Sheet, ConfirmDialog } from './Sheet';
import { TAG_PALETTE } from '../types';

interface TagManageSheetProps {
  open: boolean;
  tags: Tag[];
  onClose: () => void;
  onSave: (tag: Tag) => Promise<void>;
  onDelete: (tag: Tag) => Promise<void>;
}

interface EditingState {
  id: string; // '' 表示新增
  parentId: string; // 新增时的父级
  name: string;
  color: string;
  error: string;
}

export function TagManageSheet({ open, tags, onClose, onSave, onDelete }: TagManageSheetProps) {
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!open) return;
    setEditing(null);
    setDeleteTarget(null);
    setSaveError('');
  }, [open]);

  if (!open) return null;

  const parents = tags.filter((t) => !t.parentId);
  const childrenOf = (pid: string) => tags.filter((t) => t.parentId === pid);

  const startAdd = (parentId: string) => {
    setEditing({ id: '', parentId, name: '', color: TAG_PALETTE[tags.length % TAG_PALETTE.length], error: '' });
  };

  const startEdit = (tag: Tag) => {
    setEditing({ id: tag.id, parentId: tag.parentId, name: tag.name, color: tag.color, error: '' });
  };

  const validateName = (name: string, parentId: string, selfId: string): string | null => {
    const n = name.trim();
    if (!n) return '请输入标签名称';
    const dup = tags.some((t) => t.parentId === parentId && t.name === n && t.id !== selfId);
    return dup ? '同一层级下已存在同名标签' : null;
  };

  const commitEdit = async () => {
    if (!editing) return;
    const err = validateName(editing.name, editing.parentId, editing.id);
    if (err) {
      setEditing({ ...editing, error: err });
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const now = Date.now();
      const tag: Tag = {
        id: editing.id || `${now}`,
        name: editing.name.trim(),
        color: editing.color,
        parentId: editing.parentId,
        sortOrder: editing.id ? (tags.find((t) => t.id === editing.id)?.sortOrder ?? 0) : now,
        createdAt: editing.id ? (tags.find((t) => t.id === editing.id)?.createdAt ?? now) : now,
      };
      await onSave(tag);
      setEditing(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setSaveError('');
    try {
      await onDelete(deleteTarget);
      setDeleteTarget(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '删除失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const renderTagRow = (tag: Tag, indent: boolean) => (
    <div key={tag.id} className={`tag-row ${indent ? 'tag-row-indent' : ''}`} data-testid={`tag-row-${tag.id}`}>
      <span className="tag-dot" style={{ background: tag.color }} />
      <span className="tag-row-name">{tag.name}</span>
      {!indent && (
        <button type="button" className="tag-row-action" onClick={() => startAdd(tag.id)} aria-label={`在${tag.name}下新增二级标签`} data-testid={`tag-add-child-${tag.id}`}>
          <Plus size={16} strokeWidth={2} />
        </button>
      )}
      <button type="button" className="tag-row-action" onClick={() => startEdit(tag)} aria-label={`编辑${tag.name}`} data-testid={`tag-edit-${tag.id}`}>
        <Pencil size={16} strokeWidth={2} />
      </button>
      <button type="button" className="tag-row-action tag-row-action-danger" onClick={() => setDeleteTarget(tag)} aria-label={`删除${tag.name}`} data-testid={`tag-delete-${tag.id}`}>
        <Trash2 size={16} strokeWidth={2} />
      </button>
    </div>
  );

  const renderEditor = () => {
    if (!editing) return null;
    const isChild = !!editing.parentId;
    return (
      <div className="tag-editor" data-testid="tag-editor">
        <div className="tag-editor-head">
          <span className="tag-editor-title">{editing.id ? '编辑标签' : isChild ? '新增二级标签' : '新增一级标签'}</span>
          <button type="button" className="icon-btn" onClick={() => setEditing(null)} aria-label="关闭编辑" data-testid="tag-editor-cancel">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <input
          className="field-input"
          value={editing.name}
          onChange={(e) => setEditing({ ...editing, name: e.target.value, error: '' })}
          placeholder="标签名称"
          autoFocus
          data-testid="tag-editor-name"
        />
        {editing.error && <div className="qa-error" data-testid="tag-editor-error">{editing.error}</div>}
        <div className="tag-palette">
          {TAG_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              className={`tag-swatch ${editing.color === c ? 'tag-swatch-selected' : ''}`}
              style={{ background: c }}
              onClick={() => setEditing({ ...editing, color: c })}
              aria-label={`选择颜色 ${c}`}
              data-testid={`tag-color-${c.replace('#', '')}`}
            >
              {editing.color === c && <Check size={14} strokeWidth={3} />}
            </button>
          ))}
        </div>
        <div className="tag-editor-actions">
          <button type="button" className="btn btn-primary" onClick={commitEdit} disabled={saving} data-testid="tag-editor-save">
            {saving ? '保存中…' : '保存'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)} data-testid="tag-editor-discard">
            取消
          </button>
        </div>
      </div>
    );
  };

  const childCount = (pid: string) => childrenOf(pid).length;
  const deleteDesc =
    deleteTarget && !deleteTarget.parentId && childCount(deleteTarget.id) > 0
      ? `将删除“${deleteTarget.name}”及其下的 ${childCount(deleteTarget.id)} 个二级标签，这些标签下的时间块将变为无标签。`
      : `删除“${deleteTarget?.name ?? ''}”标签后，该标签下的时间块将变为无标签，时间块本身不会被删除。`;

  return (
    <>
      <Sheet open={open} onClose={onClose} title="标签管理" testId="tag-sheet">
        {tags.length === 0 && !editing && (
          <div className="tag-empty" data-testid="tag-empty">
            <p>还没有标签，先创建一个一级标签给时间块分类着色。</p>
          </div>
        )}
        <div className="tag-list">
          {parents.map((p) => (
            <div key={p.id} className="tag-group">
              {renderTagRow(p, false)}
              <div className="tag-children">{childrenOf(p.id).map((c) => renderTagRow(c, true))}</div>
            </div>
          ))}
        </div>
        {renderEditor()}
        {saveError && <div className="qa-error" data-testid="tag-save-error">{saveError}</div>}
        <div className="sheet-footer">
          <button type="button" className="btn btn-primary btn-block" onClick={() => startAdd('')} data-testid="tag-add-root">
            <Plus size={18} strokeWidth={2} /> 新增一级标签
          </button>
        </div>
      </Sheet>
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除标签？"
        description={deleteDesc}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        testId="tag-delete-confirm"
      />
    </>
  );
}