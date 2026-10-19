import { useState } from 'react';
import { BarChart3, Bookmark, ChevronsDown, ChevronsUp, Clock3, FileDown, Image as ImageIcon, LayoutList, LayoutTemplate, Palette, UserRound } from 'lucide-react';
import type { Granularity, ViewMode } from '../types';
import { Sheet } from './Sheet';

const GRANULARITIES: Granularity[] = [5, 10, 15, 30];
const WEEK_DAY_OPTIONS = [7, 14, 21, 28];

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  viewMode: ViewMode;
  granularity: Granularity;
  weekDays: number;
  onGranularityChange: (g: Granularity) => void;
  onWeekDaysChange: (n: number) => void;
  onOpenTheme: () => void;
  onOpenStats: () => void;
  onOpenTemplates: () => void;
  onOpenCover: () => void;
  /** 打开秘书助手（睡前复盘 / 未完成提醒 / 周报月报） */
  onOpenAssistant: () => void;
  presetName: string;
  /** 今日面板形态：drawer=抽屉收起，always=常驻展开 */
  panelMode: 'drawer' | 'always';
  /** 抽屉模式当前是否展开 */
  drawerOpen: boolean;
  onPanelModeChange: (mode: 'drawer' | 'always') => void;
  /** 即时开合抽屉（上层会持久化并滚动到面板） */
  onDrawerToggle: (open: boolean) => void;
  /** 顶部功能区当前是否已收起 */
  headerCollapsed: boolean;
  /** 一键收起顶部功能区 */
  onHeaderCollapse: () => void;
}

/** 顶栏二级入口：粒度、周天数、主题、统计、页面方案统一收进这里，让顶栏保持轻量。 */
export function MoreSheet({
  open,
  onClose,
  viewMode,
  granularity,
  weekDays,
  onGranularityChange,
  onWeekDaysChange,
  onOpenTheme,
  onOpenStats,
  onOpenTemplates,
  onOpenCover,
  onOpenAssistant,
  presetName,
  panelMode,
  drawerOpen,
  onPanelModeChange,
  onDrawerToggle,
  headerCollapsed,
  onHeaderCollapse,
}: MoreSheetProps) {
  const [sourceState, setSourceState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [sourceError, setSourceError] = useState('');
  const [sourceFileName, setSourceFileName] = useState('');

  const handleExportSource = async () => {
    if (sourceState === 'saving') return;
    setSourceState('saving');
    setSourceError('');
    try {
      const pkg = await import('../lib/sourcePackage');
      await window.lingguang.saveFile({
        data: pkg.SOURCE_PACKAGE_BASE64,
        fileName: pkg.SOURCE_PACKAGE_FILE_NAME,
      });
      setSourceFileName(pkg.SOURCE_PACKAGE_FILE_NAME);
      setSourceState('done');
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : '未知错误');
      setSourceState('error');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="更多设置" testId="more-sheet">
      <div className="more-section" data-testid="more-granularity">
        <div className="more-label">
          <Clock3 size={15} strokeWidth={2} /> 时间粒度（分钟）
        </div>
        <div className="seg" data-testid="granularity-seg">
          {GRANULARITIES.map((g) => (
            <button
              key={g}
              type="button"
              className={`seg-item ${granularity === g ? 'seg-active' : ''}`}
              onClick={() => {
                onGranularityChange(g);
                onClose();
              }}
              data-testid={`granularity-${g}`}
            >
              {g}
            </button>
          ))}
        </div>
        <p className="more-hint">时间粒度决定拖拽创建时间块时的最小单位。</p>
      </div>

      {viewMode === 'week' && (
        <div className="more-section" data-testid="more-weekdays">
          <div className="more-label">周视图显示天数</div>
          <div className="seg" data-testid="week-days-seg">
            {WEEK_DAY_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                className={`seg-item ${weekDays === n ? 'seg-active' : ''}`}
                onClick={() => {
                  onWeekDaysChange(n);
                  onClose();
                }}
                data-testid={`week-days-${n}`}
              >
                {n}天
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="more-section" data-testid="more-panel-mode">
        <div className="more-label">
          <LayoutList size={15} strokeWidth={2} /> 今日面板
        </div>
        <div className="seg" data-testid="panel-mode-seg">
          <button
            type="button"
            className={`seg-item ${panelMode === 'drawer' ? 'seg-active' : ''}`}
            onClick={() => {
              onPanelModeChange('drawer');
              onClose();
            }}
            data-testid="panel-mode-drawer"
          >
            抽屉收起
          </button>
          <button
            type="button"
            className={`seg-item ${panelMode === 'always' ? 'seg-active' : ''}`}
            onClick={() => {
              onPanelModeChange('always');
              onClose();
            }}
            data-testid="panel-mode-always"
          >
            常驻展开
          </button>
        </div>
        <p className="more-hint">抽屉收起后，今日面板只占一行标题条，点击标题即可展开完整内容；选择会记住，下次进来保持上次状态。</p>
        <div className="more-panel-toggle-row" data-testid="panel-toggle-row">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={panelMode === 'always'}
            onClick={() => {
              onDrawerToggle(true);
              onClose();
            }}
            data-testid="panel-open-now"
          >
            <ChevronsDown size={16} strokeWidth={2} /> 打开
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={panelMode === 'always'}
            onClick={() => {
              onDrawerToggle(false);
              onClose();
            }}
            data-testid="panel-close-now"
          >
            <ChevronsUp size={16} strokeWidth={2} /> 收起
          </button>
        </div>
        {panelMode === 'always' ? (
          <p className="more-hint">常驻展开模式下，面板始终完整显示，无需手动开合。</p>
        ) : (
          <p className="more-hint">{drawerOpen ? '当前：面板已展开，可随时从标题条一键收起。' : '当前：面板已收起为一行标题条，点击标题即可展开。'}</p>
        )}
      </div>

      <div className="more-actions" data-testid="more-actions">
        <button
          type="button"
          className="btn btn-ghost btn-block"
          disabled={headerCollapsed}
          onClick={() => {
            onHeaderCollapse();
            onClose();
          }}
          data-testid="header-collapse-now"
        >
          <ChevronsUp size={16} strokeWidth={2} />
          {headerCollapsed ? '顶部已收起' : '收起顶部功能区'}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => {
            onOpenTheme();
            onClose();
          }}
          data-testid="open-theme"
        >
          <Palette size={16} strokeWidth={2} /> 主题与页面方案
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => {
            onOpenTemplates();
            onClose();
          }}
          data-testid="open-templates"
        >
          <LayoutTemplate size={16} strokeWidth={2} /> 排期模板
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => {
            onOpenStats();
            onClose();
          }}
          data-testid="open-stats"
        >
          <BarChart3 size={16} strokeWidth={2} /> 标签统计
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => {
            onOpenAssistant();
            onClose();
          }}
          data-testid="open-assistant"
        >
          <UserRound size={16} strokeWidth={2} /> 秘书助手
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => {
            onOpenTheme();
            onClose();
          }}
          data-testid="open-cover"
        >
          <ImageIcon size={16} strokeWidth={2} /> 应用封面
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          disabled={sourceState === 'saving'}
          onClick={() => {
            void handleExportSource();
          }}
          data-testid="export-source"
        >
          <FileDown size={16} strokeWidth={2} />
          {sourceState === 'saving' ? '正在打包源码…' : '导出源码包'}
        </button>
        {sourceState === 'done' ? (
          <p className="more-hint" data-testid="export-source-done">
            源码包已保存到本地（{sourceFileName}），可在文件管理或聊天中查看。
          </p>
        ) : sourceState === 'error' ? (
          <p className="more-hint" data-testid="export-source-error">
            导出失败：{sourceError}，请稍后重试。
          </p>
        ) : (
          <p className="more-hint">把当前版本完整源码打包为 zip 保存到本地，方便备份或迁移。</p>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => {
            onOpenTheme();
            onClose();
          }}
          data-testid="page-badge"
        >
          <Bookmark size={16} strokeWidth={2} />
          <span className="page-badge-name" data-testid="page-badge-name">
            当前页面方案：{presetName}
          </span>
        </button>
      </div>
    </Sheet>
  );
}