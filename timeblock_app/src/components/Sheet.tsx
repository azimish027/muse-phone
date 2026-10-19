import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testId?: string;
}

/** 底部抽屉：轻遮罩 + 白色圆角面板，面板内部唯一滚动区。 */
export function Sheet({ open, onClose, title, children, testId }: SheetProps) {
  if (!open) return null;
  return (
    <div className="sheet-root" data-testid={testId ?? 'sheet'}>
      <div className="sheet-mask" onClick={onClose} />
      <div className="sheet-panel" role="dialog" aria-label={title}>
        <div className="sheet-header">
          <span className="sheet-grabber" />
          <h2 className="sheet-title">{title}</h2>
          <button type="button" className="icon-btn sheet-close" onClick={onClose} aria-label="关闭" data-testid="sheet-close">
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
}

/** 居中确认弹窗，遮罩较强。 */
export function ConfirmDialog({ open, title, description, confirmText = '删除', cancelText = '取消', onConfirm, onCancel, testId }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="dialog-root" data-testid={testId ?? 'confirm-dialog'}>
      <div className="dialog-mask" onClick={onCancel} />
      <div className="dialog-panel" role="alertdialog" aria-label={title}>
        <h3 className="dialog-title">{title}</h3>
        <p className="dialog-desc">{description}</p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} data-testid="dialog-cancel">
            {cancelText}
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} data-testid="dialog-confirm">
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}