import { useEffect, useState } from 'react';
import { Check, ImagePlus, Pencil, Trash2 } from 'lucide-react';
import type { CustomSticker, StickerLib } from '../lib/stickers';
import { createStickerId, STICKER_PACKS } from '../lib/stickers';
import { Sheet, ConfirmDialog } from './Sheet';

interface StickerLibSheetProps {
  open: boolean;
  lib: StickerLib;
  onClose: () => void;
  onChange: (lib: StickerLib) => void;
}

export function StickerLibSheet({ open, lib, onClose, onChange }: StickerLibSheetProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CustomSticker | null>(null);
  /** 正在改名中的自定义表情 id */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!open) return;
    setNotice('');
    setUploadError('');
    setDeleteTarget(null);
    setRenamingId(null);
  }, [open]);

  if (!open) return null;

  const togglePack = (id: string) => {
    const enabled = lib.enabled.includes(id) ? lib.enabled.filter((x) => x !== id) : [...lib.enabled, id];
    onChange({ ...lib, enabled });
  };

  const handleUpload = async () => {
    setUploading(true);
    setUploadError('');
    try {
      const res = await window.lingguang.chooseImage({
        count: 1,
        sourceType: ['album', 'camera'],
        sizeType: ['original'],
      });
      const filePath = res.tempFiles[0]?.path;
      if (!filePath) {
        return;
      }
      const uploaded = await window.lingguang.uploadImage({ filePath, compress: 'auto' });
      if (!uploaded.url) {
        throw new Error('上传后未返回可用图片地址');
      }
      const st: CustomSticker = {
        id: createStickerId(),
        name: `自定义表情 ${lib.custom.length + 1}`,
        url: uploaded.url,
        createdAt: Date.now(),
      };
      // 新表情置顶展示，并直接进入重命名，方便立即改名字
      onChange({ ...lib, custom: [st, ...lib.custom] });
      setRenamingId(st.id);
      setNameDraft(st.name);
      setNotice('已添加自定义表情，可立即改名，心情和任务表情里都能用');
    } catch (e) {
      const raw = (typeof e === 'object' && e !== null ? e : {}) as { name?: string; message?: string };
      if (raw.name === 'USER_CANCEL' || raw.message === '用户取消了选择') {
        return;
      }
      setUploadError(raw.message && raw.message !== '用户取消了选择' ? raw.message : '选择或上传图片失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const commitRename = (st: CustomSticker) => {
    const name = nameDraft.trim();
    onChange({
      ...lib,
      custom: lib.custom.map((s) => (s.id === st.id ? { ...s, name: name || s.name } : s)),
    });
    setRenamingId(null);
    setNameDraft('');
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    onChange({ ...lib, custom: lib.custom.filter((s) => s.id !== deleteTarget.id) });
    setDeleteTarget(null);
    setNotice('已删除自定义表情，历史里该表情将显示为占位符');
  };

  return (
    <>
      <Sheet open={open} onClose={onClose} title="表情库" testId="sticker-sheet">
        <p className="stk-intro">表情包可自选开关；上传图片可定义为自定义表情，心情和任务表情里都能用。</p>

        <button
          type="button"
          className="btn btn-primary btn-block stk-upload-top"
          onClick={() => void handleUpload()}
          disabled={uploading}
          data-testid="sticker-upload-top"
        >
          <ImagePlus size={18} strokeWidth={2} /> {uploading ? '上传中…' : '上传图片定义表情'}
        </button>

        <div className="theme-custom-subtitle" data-testid="sticker-packs-title">
          <span className="material-icons">emoji_emotions</span> 预设表情包
        </div>
        <div className="stk-packs" data-testid="sticker-packs">
          {STICKER_PACKS.map((p) => {
            const on = lib.enabled.includes(p.id);
            return (
              <div key={p.id} className={`stk-pack ${on ? 'stk-pack-on' : ''}`} data-testid={`sticker-pack-${p.id}`}>
                <div className="stk-pack-head">
                  <span className="stk-pack-name">{p.name}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    className={`theme-toggle ${on ? 'theme-toggle-on' : ''}`}
                    onClick={() => togglePack(p.id)}
                    data-testid={`sticker-pack-toggle-${p.id}`}
                  >
                    <span className="theme-toggle-knob" />
                  </button>
                </div>
                <div className="stk-pack-emojis">
                  {p.emojis.slice(0, 8).map((em) => (
                    <span key={em} className="stk-pack-emoji">
                      {em}
                    </span>
                  ))}
                  {p.emojis.length > 8 && <span className="stk-pack-more">+{p.emojis.length - 8}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="theme-custom-subtitle" data-testid="sticker-custom-title">
          <span className="material-icons">add_photo_alternate</span> 我的自定义表情
        </div>
        {lib.custom.length === 0 ? (
          <div className="stk-empty" data-testid="sticker-custom-empty">
            还没有自定义表情，上传一张图片定义成表情吧（可做头像、贴纸、专属标记）。
          </div>
        ) : (
          <div className="stk-custom-grid" data-testid="sticker-custom-grid">
            {lib.custom.map((st) => (
              <div key={st.id} className="stk-custom-item" data-testid={`sticker-custom-${st.id}`}>
                <img className="stk-custom-img" src={st.url} alt={st.name} />
                {renamingId === st.id ? (
                  <input
                    className="stk-custom-name-input"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={() => commitRename(st)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        commitRename(st);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    autoFocus
                    data-testid={`sticker-custom-name-${st.id}`}
                  />
                ) : (
                  <span className="stk-custom-name">{st.name}</span>
                )}
                <div className="stk-custom-actions">
                  <button
                    type="button"
                    className="stk-custom-action"
                    onClick={() => {
                      setRenamingId(st.id);
                      setNameDraft(st.name);
                    }}
                    aria-label={`重命名${st.name}`}
                    data-testid={`sticker-custom-rename-${st.id}`}
                  >
                    <Pencil size={14} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    className="stk-custom-action stk-custom-action-danger"
                    onClick={() => setDeleteTarget(st)}
                    aria-label={`删除${st.name}`}
                    data-testid={`sticker-custom-del-${st.id}`}
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {uploadError && (
          <div className="qa-error stk-upload-error" data-testid="sticker-upload-error">
            <span>{uploadError}</span>
            <button type="button" className="tg-retry" onClick={() => void handleUpload()} data-testid="sticker-upload-retry">
              重试
            </button>
          </div>
        )}
        <div className="sheet-footer">
          <button type="button" className="btn btn-primary btn-block" onClick={() => void handleUpload()} disabled={uploading} data-testid="sticker-upload">
            <ImagePlus size={18} strokeWidth={2} /> {uploading ? '上传中…' : '上传图片定义表情'}
          </button>
        </div>
        {notice && (
          <div className="app-toast stk-notice" data-testid="sticker-notice">
            <Check size={14} strokeWidth={2.5} /> {notice}
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={!!deleteTarget}
        title="删除自定义表情？"
        description={`删除“${deleteTarget?.name ?? ''}”后，历史记录里使用它的位置会显示为占位符，面板数据本身不受影响。`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        testId="sticker-delete-confirm"
      />
    </>
  );
}