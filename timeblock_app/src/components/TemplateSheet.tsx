import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Download, LayoutTemplate, Save, Trash2, Upload } from 'lucide-react';
import type { Tag, TimeBlock } from '../types';
import { Sheet } from './Sheet';
import {
  BUILTIN_TEMPLATES,
  blocksToTemplateBlocks,
  buildTemplatesPackage,
  createTemplateId,
  loadUserTemplates,
  parseTemplatesPackage,
  saveUserTemplates,
} from '../lib/templates';
import type { ScheduleTemplate } from '../lib/templates';
import { fmtDateCN, fmtMinute } from '../lib/timeUtils';
import { utf8ToBase64 } from '../lib/exportUtils';

interface TemplateSheetProps {
  open: boolean;
  onClose: () => void;
  /** 当前日期（默认套用目标） */
  currentDate: string;
  tags: Tag[];
  /** 当前日期的时间块（用于存为模板） */
  dayBlocks: TimeBlock[];
  onApply: (template: ScheduleTemplate, date: string) => void;
  applying: boolean;
  onToast: (msg: string) => void;
}

export function TemplateSheet({ open, onClose, currentDate, tags, dayBlocks, onApply, applying, onToast }: TemplateSheetProps) {
  const [userTemplates, setUserTemplates] = useState<ScheduleTemplate[]>(() => loadUserTemplates());
  const [targetDate, setTargetDate] = useState<string>(() => currentDate);
  const [nameDraft, setNameDraft] = useState('');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setTargetDate(currentDate);
      setUserTemplates(loadUserTemplates());
      setError('');
    }
  }, [open, currentDate]);

  useEffect(() => {
    saveUserTemplates(userTemplates);
  }, [userTemplates]);

  const saveCurrentAsTemplate = () => {
    const blocks = blocksToTemplateBlocks(dayBlocks, tags);
    if (blocks.length === 0) {
      setError('当天还没有可保存的时间块，先建几个时间块再来保存模板');
      return;
    }
    const name = nameDraft.trim() || `我的模板 ${userTemplates.length + 1}`;
    const tpl: ScheduleTemplate = {
      id: createTemplateId(),
      name,
      desc: `来自 ${fmtDateCN(currentDate)} 的 ${blocks.length} 个时间块`,
      blocks,
    };
    setUserTemplates((prev) => [...prev, tpl]);
    setNameDraft('');
    onToast(`已保存模板「${name}」`);
  };

  const removeTemplate = useCallback((id: string) => {
    setUserTemplates((prev) => prev.filter((t) => t.id !== id));
    onToast('已删除模板');
  }, [onToast]);

  /** 导出模板包：保存为本地 JSON 文件 */
  const exportPackage = async () => {
    const all = [...userTemplates];
    if (all.length === 0) {
      onToast('还没有自己的模板，先存一个再导出');
      return;
    }
    setExporting(true);
    try {
      const data = utf8ToBase64(buildTemplatesPackage(all));
      await window.lingguang.saveFile({ data, fileName: '落砂成羽之刻-排期模板.json' });
      onToast(`已导出 ${all.length} 个模板`);
    } catch {
      onToast('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  /** 导入模板包：选择 JSON 文件并合并 */
  const importPackage = async () => {
    setImporting(true);
    setError('');
    try {
      const picked = await window.lingguang.chooseFile();
      const res = await window.lingguang.readFile({ filePath: picked.filePath, encoding: 'utf8' });
      const text = typeof res.data === 'string' ? res.data : '';
      const parsed = parseTemplatesPackage(text);
      if (!parsed || parsed.length === 0) {
        setError('文件内容不是有效的模板包，请检查后重试');
        return;
      }
      setUserTemplates((prev) => {
        const ids = new Set(prev.map((t) => t.id));
        const names = new Set(prev.map((t) => t.name.trim()));
        const next = [...prev];
        parsed.forEach((t) => {
          let id = t.id;
          if (ids.has(id)) id = createTemplateId();
          ids.add(id);
          let nm = t.name.trim();
          const base = nm;
          let k = 2;
          while (names.has(nm)) {
            nm = `${base}（${k}）`;
            k += 1;
          }
          names.add(nm);
          next.push({ ...t, id, name: nm });
        });
        return next;
      });
      onToast(`已导入 ${parsed.length} 个模板`);
    } catch {
      setError('导入失败，请重试');
    } finally {
      setImporting(false);
    }
  };

  const templateCards = useMemo(
    () => (list: ScheduleTemplate[]) =>
      list.map((t) => (
        <div className="tpl-card" key={t.id} data-testid={`tpl-${t.id}`}>
          <div className="tpl-card-head">
            <span className="tpl-card-icon">
              <LayoutTemplate size={15} strokeWidth={2} />
            </span>
            <span className="tpl-card-name">{t.name}</span>
            {t.builtin ? (
              <span className="tpl-card-tag">内置</span>
            ) : (
              <button
                type="button"
                className="tpl-card-del"
                onClick={() => removeTemplate(t.id)}
                aria-label={`删除模板 ${t.name}`}
                data-testid={`tpl-del-${t.id}`}
              >
                <Trash2 size={15} strokeWidth={2} />
              </button>
            )}
          </div>
          <p className="tpl-card-desc">{t.desc || `${t.blocks.length} 个时间块`}</p>
          <div className="tpl-card-blocks">
            {t.blocks.slice(0, 5).map((b, i) => (
              <span className="tpl-card-block" key={`${b.startMinute}-${i}`}>
                {fmtMinute(b.startMinute)}-{fmtMinute(b.endMinute)} {b.title}
              </span>
            ))}
            {t.blocks.length > 5 && <span className="tpl-card-more">+{t.blocks.length - 5} 项</span>}
          </div>
          <button
            type="button"
            className="btn btn-primary btn-block tpl-apply"
            onClick={() => onApply(t, targetDate)}
            disabled={applying}
            data-testid={`tpl-apply-${t.id}`}
          >
            <CalendarDays size={15} strokeWidth={2} />
            {applying ? '正在套用…' : `套用到 ${fmtDateCN(targetDate)}`}
          </button>
        </div>
      )),
    [applying, removeTemplate, targetDate, onApply],
  );

  return (
    <Sheet open={open} onClose={onClose} title="排期模板" testId="templates-sheet">
      <div className="tpl-top" data-testid="tpl-target">
        <span className="tpl-top-label">套用目标日期</span>
        <input
          type="date"
          className="tpl-date-input"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value || currentDate)}
          data-testid="tpl-target-date"
        />
        <p className="tpl-top-hint">
          一键生成时间块后会保留到 <strong>{fmtDateCN(targetDate)}</strong>，可再手动微调。
        </p>
      </div>

      {error && (
        <div className="tpl-error" data-testid="tpl-error">
          {error}
        </div>
      )}

      <div className="tpl-section" data-testid="tpl-builtin-section">
        <div className="tpl-section-head">
          <span className="tpl-section-title">内置模板</span>
          <span className="tpl-section-sub">工作日 / 学习 / 健康 / 周末</span>
        </div>
        <div className="tpl-list">{templateCards(BUILTIN_TEMPLATES)}</div>
      </div>

      <div className="tpl-section" data-testid="tpl-user-section">
        <div className="tpl-section-head">
          <span className="tpl-section-title">我的模板</span>
          <span className="tpl-section-sub">{userTemplates.length} 套</span>
        </div>
        {userTemplates.length === 0 ? (
          <div className="tpl-empty" data-testid="tpl-user-empty">
            还没有自己的模板，把某一天的排期存下来即可复用
          </div>
        ) : (
          <div className="tpl-list">{templateCards(userTemplates)}</div>
        )}
      </div>

      <div className="tpl-section" data-testid="tpl-save-section">
        <div className="tpl-section-head">
          <span className="tpl-section-title">存为模板</span>
          <span className="tpl-section-sub">
            {fmtDateCN(currentDate)} · {dayBlocks.filter((b) => b.endMinute > b.startMinute).length} 个时间块
          </span>
        </div>
        <div className="tpl-save-row">
          <input
            className="tpl-name-input"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            placeholder="模板名称，如：我的晨间流程"
            data-testid="tpl-name-input"
          />
          <button
            type="button"
            className="btn btn-primary tpl-save-btn"
            onClick={saveCurrentAsTemplate}
            data-testid="tpl-save-current"
          >
            <Save size={15} strokeWidth={2} /> 保存
          </button>
        </div>
      </div>

      <div className="tpl-tools" data-testid="tpl-tools">
        <button type="button" className="btn btn-ghost" onClick={() => void importPackage()} disabled={importing} data-testid="tpl-import">
          <Upload size={15} strokeWidth={2} />
          {importing ? '正在导入…' : '导入模板包'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => void exportPackage()} disabled={exporting} data-testid="tpl-export">
          <Download size={15} strokeWidth={2} />
          {exporting ? '正在导出…' : '导出模板包'}
        </button>
      </div>
      <p className="tpl-tools-hint">模板包可导出为本地 JSON 文件，换设备时导入即可迁移。</p>
    </Sheet>
  );
}