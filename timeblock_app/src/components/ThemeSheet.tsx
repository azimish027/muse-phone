import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Check, Copy, Download, Palette, Plus, RotateCcw, Save, Sparkles, Trash2, Upload, X } from 'lucide-react';
import type {
  BackupPayload,
  BaseMode,
  BorderLevel,
  CustomThemeConfig,
  DensityLevel,
  GradientDirection,
  PagePreset,
  PanelArrangement,
  PatternType,
  RadiusLevel,
  TimelineStyle,
  ZoneAdjust,
  ZoneKey,
} from '../lib/themes';
import {
  ARRANGEMENT_OPTIONS,
  BORDER_LEVEL_OPTIONS,
  BUILTIN_PROFILES,
  buildPatternLayer,
  BUTTON_TEXTURE_OPTIONS,
  CARD_STYLE_OPTIONS,
  createCustomThemeId,
  CUSTOM_PRIMARY_PRESETS,
  DENSITY_LEVEL_OPTIONS,
  DEFAULT_CUSTOM_THEME,
  FONT_PRESETS,
  GRADIENT_DIR_OPTIONS,
  isBuiltinThemeId,
  LINE_WIDTH_OPTIONS,
  mixHex,
  normalizeHex,
  normalizeBackupPayload,
  PATTERN_OPTIONS,
  PREVIEW_COLORS,
  RADIUS_BY_LEVEL,
  RADIUS_LEVEL_OPTIONS,
  SIZE_LEVEL_OPTIONS,
  THEMES,
  TIMELINE_DASH_OPTIONS,
  TIMELINE_GRID_OPTIONS,
  ZONE_KEYS,
  ZONE_LABELS,
} from '../lib/themes';
import { ColorField } from './ColorField';
import { utf8ToBase64 } from '../lib/exportUtils';
import type { AiThemeIntent } from '../lib/ai';
import { parseThemeIntentWithAI } from '../lib/ai';

interface ThemeSheetProps {
  open: boolean;
  /** 当前激活主题：内置主题 id 或自定义主题 id */
  theme: string;
  customThemes: CustomThemeConfig[];
  /** 内置主题叠加的视觉细节档位（时间轴 / 按钮 / 字体 / 分区微调） */
  pageDetails: CustomThemeConfig;
  /** 页面存档列表 */
  pagePresets: PagePreset[];
  activePresetId: string;
  onPageDetailsChange: (cfg: CustomThemeConfig) => void;
  onSavePreset: (name: string) => void;
  onUpdatePreset: (id: string) => void;
  onApplyPreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  onSelect: (id: string) => void;
  /** 保存为一套新主题（自动生成新 id） */
  onSaveNew: (cfg: CustomThemeConfig) => void;
  /** 更新已有自定义主题（实时保存） */
  onUpdate: (cfg: CustomThemeConfig) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  /** 导入备份：合并（保留现有）或覆盖 */
  onImportBackup: (payload: BackupPayload, mode: 'merge' | 'replace') => void;
  /** 一句话主题配置：应用 AI 解析出的主题参数 */
  onAiApply: (r: AiThemeIntent) => void;
}

interface PreviewSpec {
  bg: string;
  card: string;
  border: string;
  base: BaseMode;
  radiusLevel: RadiusLevel;
  borderLevel: BorderLevel;
  arrangement: PanelArrangement;
  pattern: PatternType;
  patternOpacity?: number;
  bgImage?: string;
  bgImageOpacity?: number;
  bgImageBlur?: number;
}

/** 迷你预览卡：同时展示配色、圆角、背景图案与卡片布局 */
function MiniPreview({ spec }: { spec: PreviewSpec }) {
  const r = RADIUS_BY_LEVEL[spec.radiusLevel];
  const bw = spec.borderLevel === 'none' ? 0 : spec.borderLevel === 'bold' ? 2 : 1;
  const patternColor = spec.base === 'dark' ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';
  const layer = buildPatternLayer(spec.pattern, patternColor, spec.base === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)');
  const colStyle: CSSProperties = {
    background: spec.card,
    borderRadius: r.block,
    border: `${bw}px solid ${spec.border}`,
  };
  return (
    <div
      className="theme-mini-preview"
      style={{
        background: spec.bg,
      }}
    >
      {spec.bgImage && (
        <span
          className="theme-mini-bgimg"
          style={{
            backgroundImage: `url("${spec.bgImage}")`,
            opacity: (spec.bgImageOpacity ?? 40) / 100,
            filter: `blur(${spec.bgImageBlur ?? 0}px)`,
          }}
        />
      )}
      <span
        className="theme-mini-pattern"
        style={{
          backgroundImage: layer.image,
          backgroundSize: layer.size,
          opacity: (spec.patternOpacity ?? 100) / 100,
        }}
      />
      {spec.arrangement === 'duo' ? (
        <>
          <span className="theme-mini-col" style={colStyle} />
          <span className="theme-mini-col" style={colStyle} />
        </>
      ) : (
        <span className="theme-mini-col theme-mini-col-lg" style={colStyle} />
      )}
    </div>
  );
}

function customPreview(cfg: CustomThemeConfig): PreviewSpec {
  const dark = cfg.base === 'dark';
  const borderHex = dark ? '#252d39' : '#e8e4dc';
  const textHex = dark ? '#e8ecf2' : '#211f1b';
  return {
    bg: dark ? '#0f1217' : '#f7f6f2',
    card: dark ? '#161b23' : '#ffffff',
    border: cfg.borderLevel === 'bold' ? mixHex(borderHex, textHex, 0.3) : borderHex,
    base: cfg.base,
    radiusLevel: cfg.radiusLevel,
    borderLevel: cfg.borderLevel,
    arrangement: cfg.arrangement,
    pattern: cfg.pattern,
    patternOpacity: cfg.patternOpacity,
    bgImage: cfg.bgImage || undefined,
    bgImageOpacity: cfg.bgImageOpacity,
    bgImageBlur: cfg.bgImageBlur,
  };
}

interface ThemeEditorProps {
  cfg: CustomThemeConfig;
  isDraft: boolean;
  nextThemeNo: number;
  onChange: (cfg: CustomThemeConfig) => void;
  onSaveNew: (cfg: CustomThemeConfig) => void;
  onOverwrite: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCancelDraft: () => void;
}

function SegRow<T extends string>({
  label,
  value,
  options,
  onPick,
  testid,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onPick: (v: T) => void;
  testid: string;
}) {
  return (
    <div className="theme-custom-row">
      <span className="theme-custom-label">{label}</span>
      <div className="seg seg-mini" data-testid={testid}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`seg-item ${value === o.value ? 'seg-active' : ''}`}
            onClick={() => onPick(o.value)}
            data-testid={`${testid}-${o.value}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min = 0,
  max,
  suffix,
  onPick,
  testid,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  suffix: string;
  onPick: (v: number) => void;
  testid: string;
}) {
  return (
    <div className="theme-custom-row">
      <span className="theme-custom-label">{label}</span>
      <div className="theme-slider-wrap">
        <input
          type="range"
          className="theme-slider"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onPick(Number(e.target.value))}
          aria-label={label}
          data-testid={testid}
        />
        <span className="theme-slider-val" data-testid={`${testid}-val`}>
          {value}
          {suffix}
        </span>
      </div>
    </div>
  );
}

/** 颜色选择行：取色器 + 色值输入 + 跟随主题重置（统一使用应用内取色面板） */
function ColorRow({
  label,
  value,
  onPick,
  onReset,
  testid,
  hexTestid,
  bgImageUrl,
}: {
  label: string;
  value: string;
  onPick: (c: string) => void;
  onReset?: () => void;
  testid: string;
  hexTestid?: string;
  bgImageUrl?: string;
}) {
  return <ColorField label={label} value={value} onPick={onPick} onReset={onReset} testid={testid} hexTestid={hexTestid} bgImageUrl={bgImageUrl} />;
}

/** 单个分区微调：背景色 + 透明度 + 大小倍率 */
function ZoneEditor({
  label,
  adj,
  onChange,
  testid,
  bgImageUrl,
}: {
  label: string;
  adj: ZoneAdjust;
  onChange: (a: ZoneAdjust) => void;
  testid: string;
  bgImageUrl?: string;
}) {
  return (
    <div className="detail-zone-box" data-testid={testid}>
      <span className="detail-zone-title">{label}</span>
      <ColorRow
        label="背景色"
        value={adj.bgColor}
        onPick={(c) => onChange({ ...adj, bgColor: c })}
        onReset={() => onChange({ ...adj, bgColor: '' })}
        testid={`${testid}-bg`}
        bgImageUrl={bgImageUrl}
      />
      <SliderRow label="透明度" value={adj.opacity} max={100} suffix="%" onPick={(v) => onChange({ ...adj, opacity: v })} testid={`${testid}-opacity`} />
      <SliderRow label="大小倍率" value={adj.scale} min={80} max={130} suffix="%" onPick={(v) => onChange({ ...adj, scale: v })} testid={`${testid}-scale`} />
    </div>
  );
}

/** 渐变一键预设：两个主色直接套用 */
const GRADIENT_PRESETS: { name: string; colors: [string, string] }[] = [
  { name: '日落', colors: ['#F97316', '#DB2777'] },
  { name: '晨雾', colors: ['#38BDF8', '#E0F2FE'] },
  { name: '彩虹', colors: ['#F43F5E', '#8B5CF6'] },
  { name: '极光', colors: ['#34D399', '#6366F1'] },
];

function GradientPresetRow({ onApply, testid }: { onApply: (c1: string, c2: string) => void; testid: string }) {
  return (
    <div className="theme-custom-row theme-custom-row-top">
      <span className="theme-custom-label">渐变预设</span>
      <div className="gradient-preset-chips" data-testid={testid}>
        {GRADIENT_PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            className="gradient-preset-chip"
            onClick={() => onApply(p.colors[0], p.colors[1])}
            data-testid={`${testid}-${p.name}`}
          >
            <span className="gradient-preset-dot" style={{ background: `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]})` }} />
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 视觉细节档位：时间轴质感 / 按钮质感 / 字体 / 分区微调 */
function DetailsSections({ cfg, onChange }: { cfg: CustomThemeConfig; onChange: (cfg: CustomThemeConfig) => void }) {
  const tl = cfg.timeline ?? DEFAULT_CUSTOM_THEME.timeline;
  const zones = cfg.zones ?? DEFAULT_CUSTOM_THEME.zones;
  const setTl = (patch: Partial<TimelineStyle>) => onChange({ ...cfg, timeline: { ...tl, ...patch } });
  const setZone = (key: ZoneKey, adj: ZoneAdjust) => onChange({ ...cfg, zones: { ...zones, [key]: adj } });
  const bgImageUrl = cfg.bgImage || undefined;
  return (
    <>
      <div className="theme-custom-subtitle" data-testid="details-section-timeline">
        <span className="material-icons">timeline</span> 时间轴质感
      </div>
      <SegRow label="网格样式" value={tl.gridStyle} options={TIMELINE_GRID_OPTIONS} onPick={(v) => setTl({ gridStyle: v })} testid="custom-tl-grid" />
      <SliderRow label="背景透明度" value={tl.bgOpacity} max={100} suffix="%" onPick={(v) => setTl({ bgOpacity: v })} testid="custom-tl-bgopacity" />
      <ColorRow label="网格线颜色" value={tl.lineColor} onPick={(c) => setTl({ lineColor: c })} onReset={() => setTl({ lineColor: '' })} testid="custom-tl-linecolor" bgImageUrl={bgImageUrl} />
      <SliderRow label="线透明度" value={tl.lineOpacity} max={100} suffix="%" onPick={(v) => setTl({ lineOpacity: v })} testid="custom-tl-lineopacity" />
      <SegRow label="线宽" value={String(tl.lineWidth)} options={LINE_WIDTH_OPTIONS} onPick={(v) => setTl({ lineWidth: Number(v) })} testid="custom-tl-linewidth" />
      <SegRow label="线型预设" value={tl.lineDash ?? 'solid'} options={TIMELINE_DASH_OPTIONS} onPick={(v) => setTl({ lineDash: v })} testid="custom-tl-dash" />
      <div className="theme-custom-row">
        <span className="theme-custom-label">渐变线</span>
        <button
          type="button"
          role="switch"
          aria-checked={tl.lineGradient === true}
          className={`theme-toggle ${tl.lineGradient ? 'theme-toggle-on' : ''}`}
          onClick={() => setTl({ lineGradient: !(tl.lineGradient === true) })}
          data-testid="custom-tl-gradient"
        >
          <span className="theme-toggle-knob" />
        </button>
      </div>
      {tl.lineGradient === true && (
        <>
          <ColorRow label="渐变第二色" value={tl.lineGradientColor ?? ''} onPick={(c) => setTl({ lineGradientColor: c })} onReset={() => setTl({ lineGradientColor: '' })} testid="custom-tl-gradcolor" bgImageUrl={bgImageUrl} />
          <SegRow label="渐变方向" value={tl.lineGradientDir ?? 'horizontal'} options={GRADIENT_DIR_OPTIONS} onPick={(v: GradientDirection) => setTl({ lineGradientDir: v })} testid="custom-tl-graddir" />
          <GradientPresetRow onApply={(c1, c2) => setTl({ lineColor: c1, lineGradientColor: c2 })} testid="custom-tl-gradpreset" />
        </>
      )}
      <SliderRow label="刻度字号" value={tl.tickFontSize ?? 12} min={10} max={20} suffix="px" onPick={(v) => setTl({ tickFontSize: v })} testid="custom-tl-tickfont" />

      <div className="theme-custom-subtitle" data-testid="details-section-buttons">
        <span className="material-icons">smart_button</span> 按钮质感
      </div>
      <SegRow label="按钮质感" value={cfg.buttonTexture ?? 'solid'} options={BUTTON_TEXTURE_OPTIONS} onPick={(v) => onChange({ ...cfg, buttonTexture: v })} testid="custom-btn-texture" />
      <SegRow label="按钮尺寸" value={cfg.buttonSize ?? 'standard'} options={SIZE_LEVEL_OPTIONS} onPick={(v) => onChange({ ...cfg, buttonSize: v })} testid="custom-btn-size" />
      {cfg.buttonTexture === 'gradient' && (
        <>
          <ColorRow label="渐变第二色" value={cfg.btnGradientColor ?? ''} onPick={(c) => onChange({ ...cfg, btnGradientColor: c })} onReset={() => onChange({ ...cfg, btnGradientColor: '' })} testid="custom-btn-gradcolor" bgImageUrl={bgImageUrl} />
          <SegRow label="渐变方向" value={cfg.btnGradientDir ?? 'diagonal'} options={GRADIENT_DIR_OPTIONS} onPick={(v: GradientDirection) => onChange({ ...cfg, btnGradientDir: v })} testid="custom-btn-graddir" />
          <SliderRow label="渐变过渡位置" value={cfg.btnGradientStop ?? 100} max={100} suffix="%" onPick={(v) => onChange({ ...cfg, btnGradientStop: v })} testid="custom-btn-gradstop" />
          <GradientPresetRow onApply={(c1, c2) => onChange({ ...cfg, primary: c1, btnGradientColor: c2 })} testid="custom-btn-gradpreset" />
        </>
      )}
      {cfg.buttonTexture === 'glass' && (
        <SliderRow label="玻璃程度" value={cfg.btnGlassLevel ?? 50} max={100} suffix="%" onPick={(v) => onChange({ ...cfg, btnGlassLevel: v })} testid="custom-btn-glass" />
      )}
      {cfg.buttonTexture === 'outline' && (
        <SliderRow label="描边粗细" value={cfg.btnOutlineWidth ?? 2} min={1} max={4} suffix="px" onPick={(v) => onChange({ ...cfg, btnOutlineWidth: v })} testid="custom-btn-outline" />
      )}

      <div className="theme-custom-subtitle" data-testid="details-section-font">
        <span className="material-icons">format_size</span> 字体
      </div>
      <ColorRow label="字体颜色" value={cfg.fontColor ?? ''} onPick={(c) => onChange({ ...cfg, fontColor: c })} onReset={() => onChange({ ...cfg, fontColor: '' })} testid="custom-font-color" bgImageUrl={bgImageUrl} />
      <SegRow label="字体预设" value={cfg.fontFamily ?? 'system'} options={FONT_PRESETS} onPick={(v) => onChange({ ...cfg, fontFamily: v })} testid="custom-font-family" />
      <SegRow label="字号档位" value={cfg.fontSizeLevel ?? 'standard'} options={SIZE_LEVEL_OPTIONS} onPick={(v) => onChange({ ...cfg, fontSizeLevel: v })} testid="custom-font-size" />

      <div className="theme-custom-subtitle" data-testid="details-section-zones">
        <span className="material-icons">dashboard_customize</span> 分区微调
      </div>
      <div className="detail-zones" data-testid="custom-zones">
        {ZONE_KEYS.map((k) => (
          <ZoneEditor key={k} label={ZONE_LABELS[k]} adj={zones[k] ?? { bgColor: '', opacity: 100, scale: 100 }} onChange={(a) => setZone(k, a)} testid={`custom-zone-${k}`} bgImageUrl={bgImageUrl} />
        ))}
      </div>
    </>
  );
}

function fmtPresetTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 页面存档：命名保存整套设置，支持多套管理与一键切换 */
function PagePresetSection({
  presets,
  activePresetId,
  customThemes,
  pageDetails,
  onSave,
  onUpdate,
  onApply,
  onDelete,
  onImportBackup,
}: {
  presets: PagePreset[];
  activePresetId: string;
  customThemes: CustomThemeConfig[];
  pageDetails: CustomThemeConfig;
  onSave: (name: string) => void;
  onUpdate: (id: string) => void;
  onApply: (id: string) => void;
  onDelete: (id: string) => void;
  onImportBackup: (payload: BackupPayload, mode: 'merge' | 'replace') => void;
}) {
  const [name, setName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [importPreview, setImportPreview] = useState<BackupPayload | null>(null);

  const handleExport = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    setBackupMsg('');
    try {
      const payload: BackupPayload = {
        app: 'time-block-page-presets',
        version: 2,
        exportedAt: Date.now(),
        pagePresets: presets,
        customThemes,
        pageDetails,
        activePresetId,
      };
      const text = JSON.stringify(payload);
      const data = utf8ToBase64(text);
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
      await window.lingguang.saveFile({
        data,
        fileName: `页面方案备份_${stamp}.json`,
      });
      setBackupMsg('备份已保存到本地');
    } catch (e) {
      const errName = (e as { name?: string })?.name;
      if (errName !== 'USER_CANCEL') setBackupMsg('导出失败，请重试');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleImportPick = async () => {
    if (backupBusy) return;
    setBackupBusy(true);
    setBackupMsg('');
    try {
      const chosen = await window.lingguang.chooseFile();
      const read = await window.lingguang.readFile({ filePath: chosen.filePath, encoding: 'utf8' });
      if (typeof read.data !== 'string') throw new Error('EMPTY_FILE');
      const parsed = JSON.parse(read.data) as unknown;
      const payload = normalizeBackupPayload(parsed);
      if (!payload) {
        setBackupMsg('文件不是有效的页面方案备份');
        return;
      }
      setImportPreview(payload);
    } catch (e) {
      const errName = (e as { name?: string })?.name;
      if (errName !== 'USER_CANCEL') setBackupMsg('导入失败，请确认选择的是备份 JSON 文件');
    } finally {
      setBackupBusy(false);
    }
  };

  const themeNameOf = (p: PagePreset) => {
    if (isBuiltinThemeId(p.themeId)) return THEMES.find((t) => t.id === p.themeId)?.name ?? '内置主题';
    const ct = customThemes.find((t) => t.id === p.themeId);
    return ct ? ct.name.trim() : (p.snapshot.name.trim() || '自定义主题');
  };

  return (
    <div className="page-preset-box" data-testid="page-preset-section">
      <div className="page-preset-row">
        <input
          className="page-preset-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="给整个页面起个名字"
          maxLength={20}
          data-testid="preset-name-input"
        />
        <button
          type="button"
          className="theme-action-btn theme-action-primary"
          onClick={() => {
            onSave(name);
            setName('');
          }}
          data-testid="preset-save"
        >
          <Save size={14} strokeWidth={2} /> 保存页面方案
        </button>
      </div>
      <p className="page-preset-tip">整套设置（主题 + 视觉细节 + 分区微调）命名保存，可一键切换。</p>
      <div className="page-preset-backup" data-testid="preset-backup-bar">
        <button
          type="button"
          className="theme-action-btn"
          onClick={() => void handleExport()}
          disabled={backupBusy}
          data-testid="preset-export"
        >
          <Download size={14} strokeWidth={2} /> 导出备份
        </button>
        <button
          type="button"
          className="theme-action-btn"
          onClick={() => void handleImportPick()}
          disabled={backupBusy}
          data-testid="preset-import"
        >
          <Upload size={14} strokeWidth={2} /> 导入备份
        </button>
        {backupBusy && <span className="page-preset-backup-msg">处理中…</span>}
        {backupMsg && <span className="page-preset-backup-msg" data-testid="preset-backup-msg">{backupMsg}</span>}
      </div>
      {importPreview && (
        <div className="preset-import-preview" data-testid="preset-import-preview">
          <p className="preset-import-title">
            备份包含 {importPreview.pagePresets.length} 套页面方案、{importPreview.customThemes.length} 套自定义主题
          </p>
          <ul className="preset-import-list">
            {importPreview.pagePresets.map((p) => (
              <li key={p.id} className="preset-import-item">
                <span className="preset-import-name">{p.name}</span>
                <span className="preset-import-meta">{themeNameOf(p)}</span>
              </li>
            ))}
          </ul>
          <div className="preset-import-actions">
            <button
              type="button"
              className="theme-action-btn theme-action-primary"
              onClick={() => {
                onImportBackup(importPreview, 'merge');
                setImportPreview(null);
                setBackupMsg('已合并导入，重名方案自动改名');
              }}
              data-testid="preset-import-merge"
            >
              合并导入（保留现有）
            </button>
            <button
              type="button"
              className="theme-action-btn"
              onClick={() => {
                onImportBackup(importPreview, 'replace');
                setImportPreview(null);
                setBackupMsg('已覆盖导入');
              }}
              data-testid="preset-import-replace"
            >
              覆盖导入
            </button>
            <button type="button" className="theme-action-btn" onClick={() => setImportPreview(null)} data-testid="preset-import-cancel">
              取消
            </button>
          </div>
        </div>
      )}
      {presets.length === 0 ? (
        <div className="page-preset-empty" data-testid="preset-empty">
          还没有保存的方案，起个名字保存第一套吧
        </div>
      ) : (
        <div className="page-preset-list" data-testid="preset-list">
          {presets.map((p) => {
            const active = p.id === activePresetId;
            const themeName = isBuiltinThemeId(p.themeId)
              ? (THEMES.find((t) => t.id === p.themeId)?.name ?? '内置主题')
              : (p.snapshot.name.trim() || '自定义主题');
            return (
              <div className={`page-preset-item ${active ? 'page-preset-item-active' : ''}`} key={p.id} data-testid={`preset-item-${p.id}`}>
                <button type="button" className="page-preset-main" onClick={() => onApply(p.id)} data-testid={`preset-apply-${p.id}`}>
                  <span className="page-preset-name">{p.name}</span>
                  <span className="page-preset-meta">
                    {themeName} · {fmtPresetTime(p.updatedAt)}
                  </span>
                </button>
                <div className="page-preset-actions">
                  {confirmDelete === p.id ? (
                    <>
                      <button
                        type="button"
                        className="theme-action-btn theme-action-danger"
                        onClick={() => {
                          onDelete(p.id);
                          setConfirmDelete(null);
                        }}
                        data-testid={`preset-confirm-delete-${p.id}`}
                      >
                        删除
                      </button>
                      <button type="button" className="theme-action-btn" onClick={() => setConfirmDelete(null)} data-testid={`preset-cancel-delete-${p.id}`}>
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="page-preset-btn"
                        onClick={() => onUpdate(p.id)}
                        aria-label="用当前设置覆盖此方案"
                        title="覆盖保存"
                        data-testid={`preset-update-${p.id}`}
                      >
                        <Save size={13} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="page-preset-btn page-preset-btn-danger"
                        onClick={() => setConfirmDelete(p.id)}
                        aria-label="删除方案"
                        title="删除"
                        data-testid={`preset-delete-${p.id}`}
                      >
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ThemeEditor({ cfg, isDraft, nextThemeNo, onChange, onSaveNew, onOverwrite, onDuplicate, onDelete, onCancelDraft }: ThemeEditorProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgError, setBgError] = useState('');
  const primary = normalizeHex(cfg.primary) ?? DEFAULT_CUSTOM_THEME.primary;

  const saveNew = () => {
    onSaveNew({
      ...cfg,
      id: cfg.id || createCustomThemeId(),
      name: cfg.name.trim() || `自定义主题 ${nextThemeNo}`,
    });
  };

  const pickBgImage = async () => {
    if (bgUploading) return;
    setBgUploading(true);
    setBgError('');
    try {
      const res = await window.lingguang.chooseImage({
        count: 1,
        sourceType: ['album', 'camera'],
        sizeType: ['original'],
      });
      const filePath = res.tempFiles[0]?.path;
      if (!filePath) return;
      const up = await window.lingguang.uploadImage({ filePath, compress: 'auto' });
      if (!up.url) throw new Error('上传未返回可用地址');
      onChange({ ...cfg, bgImage: up.url });
    } catch (e) {
      const raw = (typeof e === 'object' && e !== null ? e : {}) as { name?: string; message?: string };
      if (raw.name === 'USER_CANCEL' || raw.message === '用户取消了选择') return;
      setBgError(raw.message && raw.message !== '用户取消了选择' ? raw.message : '图片选择或上传失败，请重试');
    } finally {
      setBgUploading(false);
    }
  };

  return (
    <div className="theme-custom-box" data-testid="custom-theme-editor">
      <div className="theme-editor-head">
        <span className="theme-editor-title">
          <Palette size={15} strokeWidth={2} />
          {isDraft ? '新建自定义主题' : '编辑主题'}
        </span>
        <span className="theme-editor-badge">{isDraft ? '未保存' : '我的主题'}</span>
      </div>

      <div className="theme-custom-row">
        <span className="theme-custom-label">名称</span>
        <input
          className="theme-name-input"
          value={cfg.name}
          onChange={(e) => onChange({ ...cfg, name: e.target.value })}
          placeholder={`自定义主题 ${nextThemeNo}`}
          maxLength={20}
          data-testid="custom-name-input"
        />
      </div>

      <div className="theme-custom-row">
        <span className="theme-custom-label">底色模式</span>
        <div className="seg seg-mini" data-testid="custom-base-seg">
          <button
            type="button"
            className={`seg-item ${cfg.base === 'light' ? 'seg-active' : ''}`}
            onClick={() => onChange({ ...cfg, base: 'light' })}
            data-testid="custom-base-light"
          >
            浅色
          </button>
          <button
            type="button"
            className={`seg-item ${cfg.base === 'dark' ? 'seg-active' : ''}`}
            onClick={() => onChange({ ...cfg, base: 'dark' })}
            data-testid="custom-base-dark"
          >
            深色
          </button>
        </div>
      </div>

      <div className="theme-custom-row theme-custom-row-top">
        <span className="theme-custom-label">主色</span>
        <div className="theme-custom-swatches" role="radiogroup" aria-label="主色预设">
          {CUSTOM_PRIMARY_PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={primary === c}
              aria-label={`主色 ${c}`}
              className={`theme-custom-dot ${primary === c ? 'theme-custom-dot-active' : ''}`}
              style={{ background: c }}
              onClick={() => onChange({ ...cfg, primary: c })}
              data-testid={`custom-color-${c.replace('#', '')}`}
            />
          ))}
        </div>
      </div>

      <ColorRow
        label="取色"
        value={primary}
        onPick={(c) => onChange({ ...cfg, primary: c })}
        testid="custom-color-picker"
        hexTestid="custom-color-hex"
        bgImageUrl={cfg.bgImage || undefined}
      />

      <SegRow label="边框样式" value={cfg.borderLevel} options={BORDER_LEVEL_OPTIONS} onPick={(v) => onChange({ ...cfg, borderLevel: v })} testid="custom-border" />
      <SegRow label="圆角档位" value={cfg.radiusLevel} options={RADIUS_LEVEL_OPTIONS} onPick={(v) => onChange({ ...cfg, radiusLevel: v })} testid="custom-radius" />
      <SegRow label="卡片密度" value={cfg.density} options={DENSITY_LEVEL_OPTIONS} onPick={(v) => onChange({ ...cfg, density: v })} testid="custom-density" />
      <SegRow label="面板排布" value={cfg.arrangement} options={ARRANGEMENT_OPTIONS} onPick={(v) => onChange({ ...cfg, arrangement: v })} testid="custom-layout" />
      <SegRow label="卡片质感" value={cfg.cardStyle} options={CARD_STYLE_OPTIONS} onPick={(v) => onChange({ ...cfg, cardStyle: v })} testid="custom-cardstyle" />

      <div className="theme-custom-row theme-custom-row-top">
        <span className="theme-custom-label">背景图案</span>
        <div className="theme-pattern-chips" data-testid="custom-pattern-chips">
          {PATTERN_OPTIONS.map((p) => {
            const dark = cfg.base === 'dark';
            const layer = buildPatternLayer(p.value, dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.22)', dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)');
            return (
              <button
                key={p.value}
                type="button"
                className={`theme-pattern-chip ${cfg.pattern === p.value ? 'theme-pattern-chip-active' : ''}`}
                onClick={() => onChange({ ...cfg, pattern: p.value })}
                data-testid={`custom-pattern-${p.value}`}
              >
                {p.value !== 'none' && (
                  <span
                    className="theme-pattern-dot"
                    style={{ backgroundImage: layer.image, backgroundSize: layer.size, backgroundColor: cfg.base === 'dark' ? '#1a2029' : '#f2f1ec' }}
                  />
                )}
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <SliderRow
        label="图案透明度"
        value={cfg.patternOpacity}
        max={100}
        suffix="%"
        onPick={(v) => onChange({ ...cfg, patternOpacity: v })}
        testid="custom-pattern-opacity"
      />
      <SliderRow
        label="按钮透明度"
        value={cfg.btnOpacity}
        max={100}
        suffix="%"
        onPick={(v) => onChange({ ...cfg, btnOpacity: v })}
        testid="custom-btn-opacity"
      />

      <div className="theme-bgimg-box" data-testid="theme-bgimg-box">
        <div className="theme-custom-row">
          <span className="theme-custom-label">背景图片</span>
          <div className="theme-bgimg-actions">
            <button type="button" className="theme-action-btn" onClick={pickBgImage} disabled={bgUploading} data-testid="theme-bgimg-pick">
              {bgUploading ? '上传中…' : cfg.bgImage ? '更换图片' : '选择图片'}
            </button>
            {cfg.bgImage && (
              <button type="button" className="theme-action-btn theme-action-danger" onClick={() => onChange({ ...cfg, bgImage: '', bgImageOpacity: DEFAULT_CUSTOM_THEME.bgImageOpacity, bgImageBlur: DEFAULT_CUSTOM_THEME.bgImageBlur })} data-testid="theme-bgimg-remove">
                移除
              </button>
            )}
          </div>
        </div>
        {bgError && (
          <p className="theme-bgimg-error" data-testid="theme-bgimg-error">
            <span>{bgError}</span>
            <button type="button" className="theme-action-btn" onClick={() => void pickBgImage()} data-testid="theme-bgimg-retry">
              重试
            </button>
          </p>
        )}
        {cfg.bgImage ? (
          <>
            <div className="theme-bgimg-preview">
              <img src={cfg.bgImage} alt="背景图预览" />
            </div>
            <SliderRow
              label="图片透明度"
              value={cfg.bgImageOpacity}
              max={100}
              suffix="%"
              onPick={(v) => onChange({ ...cfg, bgImageOpacity: v })}
              testid="custom-bgimg-opacity"
            />
            <SliderRow
              label="图片模糊"
              value={cfg.bgImageBlur}
              max={40}
              suffix="px"
              onPick={(v) => onChange({ ...cfg, bgImageBlur: v })}
              testid="custom-bgimg-blur"
            />
          </>
        ) : (
          <p className="theme-bgimg-tip">从相册或相机选择一张图片作为页面背景，可调节透明度与模糊度。</p>
        )}
      </div>

      <div className="theme-details-divider" />
      <DetailsSections cfg={cfg} onChange={onChange} />

      {confirmDelete ? (
        <div className="theme-confirm-bar" data-testid="theme-delete-confirm">
          <span className="theme-confirm-text">删除「{cfg.name.trim() || '未命名主题'}」？此操作不可恢复。</span>
          <div className="theme-actions" style={{ flex: '0 0 auto' }}>
            <button type="button" className="theme-action-btn" onClick={() => setConfirmDelete(false)} data-testid="theme-delete-cancel">
              取消
            </button>
            <button type="button" className="theme-action-btn theme-action-danger" onClick={onDelete} data-testid="theme-confirm-delete">
              删除
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="theme-actions">
            {isDraft ? (
              <>
                <button type="button" className="theme-action-btn theme-action-primary" onClick={saveNew} data-testid="theme-save-new">
                  <Save size={14} strokeWidth={2} /> 保存为新主题
                </button>
                <button type="button" className="theme-action-btn" onClick={onCancelDraft} data-testid="theme-draft-cancel">
                  取消
                </button>
              </>
            ) : (
              <>
                <button type="button" className="theme-action-btn theme-action-primary" onClick={saveNew} data-testid="theme-save-new">
                  <Plus size={14} strokeWidth={2} /> 另存为新主题
                </button>
                <button type="button" className="theme-action-btn" onClick={onOverwrite} data-testid="theme-overwrite">
                  <Save size={14} strokeWidth={2} /> 覆盖保存
                </button>
                <button type="button" className="theme-action-btn" onClick={onDuplicate} data-testid="theme-duplicate">
                  <Copy size={14} strokeWidth={2} /> 复制
                </button>
                <button type="button" className="theme-action-btn theme-action-danger" onClick={() => setConfirmDelete(true)} data-testid="theme-delete">
                  <Trash2 size={14} strokeWidth={2} /> 删除
                </button>
              </>
            )}
          </div>
          <div className="theme-custom-foot">
            <button type="button" className="theme-custom-reset" onClick={() => onChange({ ...DEFAULT_CUSTOM_THEME, id: cfg.id, name: cfg.name })} data-testid="custom-reset">
              <RotateCcw size={13} strokeWidth={2} /> 恢复默认档位
            </button>
            <span className="theme-custom-tip">
              <Palette size={12} strokeWidth={2} />
              {isDraft ? '调整仅留在草稿，保存后才会应用' : '改动实时生效并自动保存在本地'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export function ThemeSheet({ open, theme, customThemes, pageDetails, pagePresets, activePresetId, onPageDetailsChange, onSavePreset, onUpdatePreset, onApplyPreset, onDeletePreset, onSelect, onSaveNew, onUpdate, onDelete, onClose, onImportBackup, onAiApply }: ThemeSheetProps) {
  const [draft, setDraft] = useState<CustomThemeConfig | null>(null);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const editingCfg = useMemo<CustomThemeConfig | null>(() => {
    if (draft) return draft;
    if (isBuiltinThemeId(theme)) return null;
    return customThemes.find((t) => t.id === theme) ?? null;
  }, [draft, theme, customThemes]);

  const isDraft = draft !== null;
  const nextThemeNo = customThemes.length + 1;

  if (!open) return null;

  const pickBuiltin = (id: string) => {
    setDraft(null);
    onSelect(id);
  };

  const pickCustom = (ct: CustomThemeConfig) => {
    setDraft(null);
    onSelect(ct.id);
  };

  const startDraft = () => {
    setDraft({ ...DEFAULT_CUSTOM_THEME, id: '', name: '' });
  };

  const handleChange = (cfg: CustomThemeConfig) => {
    if (draft) setDraft(cfg);
    else onUpdate(cfg);
  };

  const handleSaveNew = (cfg: CustomThemeConfig) => {
    onSaveNew(cfg);
    setDraft(null);
  };

  const handleDuplicate = () => {
    if (!editingCfg) return;
    onSaveNew({ ...editingCfg, id: createCustomThemeId(), name: `${editingCfg.name.trim() || '未命名主题'} 副本` });
  };

  const handleDelete = () => {
    if (!editingCfg) return;
    onDelete(editingCfg.id);
    setDraft(null);
  };

  const handleAiTheme = async () => {
    const t = aiText.trim();
    if (!t || aiBusy) return;
    setAiBusy(true);
    setAiMsg(null);
    try {
      const r = await parseThemeIntentWithAI(t);
      onAiApply(r);
      setAiMsg({ type: 'ok', text: r.description || '已应用主题配置' });
      setAiText('');
    } catch {
      setAiMsg({ type: 'err', text: 'AI 配置暂时不可用（可能网络异常），可继续使用下方手动选项调整。' });
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="sheet-root" data-testid="theme-sheet">
      <div className="sheet-mask" onClick={onClose} />
      <div className="sheet-panel">
        <div className="sheet-header">
          <span className="sheet-grabber" />
          <h3 className="sheet-title">主题与布置</h3>
          <button type="button" className="icon-btn sheet-close" onClick={onClose} aria-label="关闭主题选择" data-testid="theme-close">
            <X size={20} strokeWidth={2} />
          </button>
        </div>
        <div className="sheet-body">
          <p className="theme-hint">主题 = 配色 + 布置 + 背景图案 + 视觉细节（时间轴 / 按钮 / 字体 / 分区），整套设置可命名保存为页面方案一键切换。</p>

          <div className="theme-ai-box" data-testid="theme-ai-box">
            <div className="theme-ai-row">
              <input
                className="field-input theme-ai-input"
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleAiTheme();
                }}
                placeholder="一句话配置：如「换成深色商务风，圆角大一点，主色用蓝色」"
                data-testid="theme-ai-input"
              />
              <button
                type="button"
                className="btn btn-primary theme-ai-btn"
                onClick={() => void handleAiTheme()}
                disabled={aiBusy || !aiText.trim()}
                data-testid="theme-ai-apply"
              >
                <Sparkles size={15} strokeWidth={2} /> {aiBusy ? '配置中…' : '一句话配置'}
              </button>
            </div>
            <p className="theme-ai-hint">
              支持切换内置主题（深色 / 商务 / 卡通 / 极简等），调整主色、圆角、密度、卡片质感、背景图案；不可用时回到手动选项。
            </p>
            {aiMsg && (
              <div className={`theme-ai-msg ${aiMsg.type === 'ok' ? 'theme-ai-msg-ok' : 'theme-ai-msg-err'}`} data-testid="theme-ai-msg">
                {aiMsg.text}
              </div>
            )}
          </div>

          <PagePresetSection
            presets={pagePresets}
            activePresetId={activePresetId}
            customThemes={customThemes}
            pageDetails={pageDetails}
            onSave={onSavePreset}
            onUpdate={onUpdatePreset}
            onApply={onApplyPreset}
            onDelete={onDeletePreset}
            onImportBackup={onImportBackup}
          />

          <p className="theme-section-label">
            <span className="material-icons">palette</span> 内置主题
          </p>
          <div className="theme-grid" role="listbox" aria-label="内置主题列表">
            {THEMES.map((t) => {
              const profile = BUILTIN_PROFILES[t.id];
              const colors = PREVIEW_COLORS[t.id];
              const active = theme === t.id && !draft;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`theme-mini-card ${active ? 'theme-mini-card-active' : ''}`}
                  onClick={() => pickBuiltin(t.id)}
                  data-testid={`theme-${t.id}`}
                >
                  <MiniPreview
                    spec={{
                      bg: colors.bg,
                      card: colors.card,
                      border: colors.border,
                      base: t.id === 'dark' ? 'dark' : 'light',
                      radiusLevel: profile.layout.radiusLevel,
                      borderLevel: profile.layout.borderLevel,
                      arrangement: profile.layout.arrangement,
                      pattern: profile.pattern,
                    }}
                  />
                  <span className="theme-mini-name">{t.name}</span>
                  <span className="theme-mini-tags">
                    <span className="theme-mini-tag">{profile.layout.arrangement === 'duo' ? '双栏' : '单栏'}</span>
                    <span className="theme-mini-tag">{PATTERN_OPTIONS.find((p) => p.value === profile.pattern)?.label ?? ''}</span>
                    <span className="theme-mini-tag">{RADIUS_LEVEL_OPTIONS.find((r) => r.value === profile.layout.radiusLevel)?.label ?? ''}</span>
                  </span>
                  {active && (
                    <span className="theme-mini-check">
                      <Check strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="theme-section-label">
            <span className="material-icons">bookmark</span> 我的主题
            {customThemes.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>{customThemes.length} 套</span>
            )}
          </p>
          <div className="theme-grid" role="listbox" aria-label="我的主题列表">
            {customThemes.map((ct) => {
              const active = theme === ct.id && !draft;
              return (
                <button
                  key={ct.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`theme-mini-card ${active ? 'theme-mini-card-active' : ''}`}
                  onClick={() => pickCustom(ct)}
                  data-testid={`theme-${ct.id}`}
                >
                  <MiniPreview spec={customPreview(ct)} />
                  <span className="theme-mini-name">{ct.name.trim() || '未命名主题'}</span>
                  <span className="theme-mini-tags">
                    <span className="theme-mini-tag">{ct.arrangement === 'duo' ? '双栏' : '单栏'}</span>
                    <span className="theme-mini-tag">{PATTERN_OPTIONS.find((p) => p.value === ct.pattern)?.label ?? ''}</span>
                    <span className="theme-mini-tag">{RADIUS_LEVEL_OPTIONS.find((r) => r.value === ct.radiusLevel)?.label ?? ''}</span>
                  </span>
                  {active && (
                    <span className="theme-mini-check">
                      <Check strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
            <button type="button" className="theme-mini-card theme-mini-new" onClick={startDraft} data-testid="theme-start-new">
              <span className="material-icons">add</span>
              <span>新建自定义主题</span>
            </button>
          </div>

          {editingCfg && (
            <ThemeEditor
              cfg={editingCfg}
              isDraft={isDraft}
              nextThemeNo={nextThemeNo}
              onChange={handleChange}
              onSaveNew={handleSaveNew}
              onOverwrite={() => {
                if (!editingCfg) return;
                onUpdate(editingCfg);
              }}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onCancelDraft={() => setDraft(null)}
            />
          )}

          {!editingCfg && (
            <div className="theme-custom-box" data-testid="page-details-editor">
              <div className="theme-editor-head">
                <span className="theme-editor-title">
                  <Palette size={15} strokeWidth={2} />
                  页面细节
                </span>
                <span className="theme-editor-badge">内置主题叠加</span>
              </div>
              <p className="page-details-tip">当前是内置主题，以下视觉细节独立保存并叠加生效；切换到「我的主题」后，会随主题一起保存。</p>
              <DetailsSections cfg={pageDetails} onChange={onPageDetailsChange} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}