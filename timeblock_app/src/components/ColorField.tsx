import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent as RPointerEvent } from 'react';
import { Check, Pipette, X } from 'lucide-react';
import { normalizeHex } from '../lib/themes';

/** 常用色板：主色系 + 中性色 */
const PRESET_SWATCHES = [
  '#4F46E5',
  '#7C3AED',
  '#DB2777',
  '#EA580C',
  '#CA8A04',
  '#0891B2',
  '#0E9F6E',
  '#1D4ED8',
  '#B42318',
  '#0F172A',
  '#64748B',
  '#D1D5DB',
  '#FFFFFF',
  '#000000',
];

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** 默认 HSL（面板无选中色时使用） */
const DEFAULT_HSL = { h: 217, s: 60, l: 50 };

/** #RRGGBB → HSL（h 0-360, s 0-100, l 0-100） */
export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const n = normalizeHex(hex) ?? '#4F46E5';
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const l = (max + min) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** HSL → #RRGGBB */
export function hslToHex(h: number, s: number, l: number): string {
  const hn = ((h % 360) + 360) % 360;
  const sn = clamp01(s / 100);
  const ln = clamp01(l / 100);
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hn < 60) [r, g, b] = [c, x, 0];
  else if (hn < 120) [r, g, b] = [x, c, 0];
  else if (hn < 180) [r, g, b] = [0, c, x];
  else if (hn < 240) [r, g, b] = [0, x, c];
  else if (hn < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to2 = (n: number) => Math.round((n + m) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

interface ColorFieldProps {
  label: string;
  /** 当前色值；空字符串表示跟随主题（自动） */
  value: string;
  onPick: (c: string) => void;
  onReset?: () => void;
  /** 取色入口按钮的 testid */
  testid: string;
  /** 色号输入框的 testid，缺省为 `${testid}-hex` */
  hexTestid?: string;
  /** 提供背景图 URL 后，取色面板支持「从背景图取色」 */
  bgImageUrl?: string;
}

/**
 * 应用内自建取色器：点色块展开取色面板（常用色板 + 色相/饱和度/亮度滑块 + 实时预览），
 * 色号支持带或不带 # 的 3 位 / 6 位写法，边输入边校验并实时预览，无效时明确提示。
 * 主色、网格线颜色、字体颜色、分区背景色、渐变第二色统一复用此组件。
 */
export function ColorField({ label, value, onPick, onReset, testid, hexTestid, bgImageUrl }: ColorFieldProps) {
  const [open, setOpen] = useState(false);
  const [hexText, setHexText] = useState('');
  const [hexError, setHexError] = useState('');
  const [sampling, setSampling] = useState(false);
  const [sampleError, setSampleError] = useState('');
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sampleDimsRef = useRef<{ w: number; h: number } | null>(null);

  const current = normalizeHex(value) ?? null;

  // 滑块拖动时使用内部草稿 HSL 作为唯一数据源，
  // 避免“取整→存回→反推”回路在低饱和/接近黑白颜色上丢失色相、导致滑块反复跳回。
  const [draftHsl, setDraftHsl] = useState<{ h: number; s: number; l: number }>(() =>
    current ? hexToHsl(current) : DEFAULT_HSL
  );
  const [prevCurrent, setPrevCurrent] = useState<string | null>(current);
  if (current !== prevCurrent) {
    setPrevCurrent(current);
    if (!current) {
      setDraftHsl(DEFAULT_HSL);
    } else if (hslToHex(draftHsl.h, draftHsl.s, draftHsl.l) !== current) {
      // 外部色值变化（色板/色号输入/重置/切换字段）时同步滑块位置
      setDraftHsl(hexToHsl(current));
    }
  }

  const togglePanel = () => {
    setOpen((o) => {
      const next = !o;
      if (next) {
        setHexText(value || '');
        setHexError('');
      }
      return next;
    });
  };

  const commitHexText = (raw: string) => {
    setHexText(raw);
    const n = normalizeHex(raw);
    if (n) {
      setHexError('');
      if (n !== current) onPick(n);
    } else {
      setHexError(raw.trim() ? '色号无效：请输入 3 位或 6 位十六进制，可带 #' : '');
    }
  };

  const handleHexBlur = () => {
    if (!normalizeHex(hexText)) {
      setHexText(value || '');
      setHexError('');
    }
  };

  const pickHsl = (h: number, s: number, l: number) => {
    setDraftHsl({ h, s, l });
    const hex = hslToHex(h, s, l);
    setHexText(hex);
    onPick(hex);
  };

  /** 拖动色相时，若颜色处于无彩色（灰/白/黑）状态，自动激活一组可感知的饱和/亮度，避免“拖了没反应” */
  const handleHueChange = (h: number) => {
    let s = draftHsl.s;
    let l = draftHsl.l;
    if (s < 15) s = 60;
    if (l <= 8) l = 50;
    if (l >= 92) l = 50;
    pickHsl(h, s, l);
  };

  /** 打开取色遮罩时，把背景图绘制到 canvas 供点按取样 */
  useEffect(() => {
    if (!sampling || !bgImageUrl) return;
    let cancelled = false;
    sampleDimsRef.current = null;
    setSampleError('');
    const imgEl = new Image();
    const draw = () => {
      const canvas = sampleCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      try {
        canvas.width = imgEl.naturalWidth;
        canvas.height = imgEl.naturalHeight;
        ctx.drawImage(imgEl, 0, 0);
        sampleDimsRef.current = { w: imgEl.naturalWidth, h: imgEl.naturalHeight };
        setSampleError('');
      } catch {
        setSampleError('该图片暂不支持直接取色，请改用色板或色号输入');
      }
    };
    imgEl.onload = () => {
      if (!cancelled) draw();
    };
    imgEl.onerror = () => {
      if (cancelled) return;
      if (imgEl.crossOrigin) {
        imgEl.crossOrigin = '';
        imgEl.src = bgImageUrl;
      } else {
        setSampleError('图片加载失败，无法取色');
      }
    };
    imgEl.crossOrigin = 'anonymous';
    imgEl.src = bgImageUrl;
    return () => {
      cancelled = true;
    };
  }, [sampling, bgImageUrl]);

  const handleSamplePointer = (e: RPointerEvent<HTMLImageElement>) => {
    const dims = sampleDimsRef.current;
    const canvas = sampleCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!dims || !canvas || !ctx) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scale = Math.min(rect.width / dims.w, rect.height / dims.h);
    const dispW = dims.w * scale;
    const dispH = dims.h * scale;
    const offX = (rect.width - dispW) / 2;
    const offY = (rect.height - dispH) / 2;
    const px = (e.clientX - rect.left - offX) / dispW;
    const py = (e.clientY - rect.top - offY) / dispH;
    if (px < 0 || px > 1 || py < 0 || py > 1) return;
    try {
      const data = ctx.getImageData(Math.round(px * (dims.w - 1)), Math.round(py * (dims.h - 1)), 1, 1).data;
      const hex = `#${[data[0], data[1], data[2]].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
      setHexText(hex);
      onPick(hex);
      setSampling(false);
      setSampleError('');
    } catch {
      setSampleError('该图片暂不支持直接取色，请改用色板或色号输入');
    }
  };

  return (
    <div className="cf-wrap">
      <div className="theme-custom-row">
        <span className="theme-custom-label">{label}</span>
        <div className="theme-custom-pick">
          <button
            type="button"
            className={`cf-swatch ${current ? '' : 'cf-swatch-auto'}`}
            style={current ? { background: current } : undefined}
            onClick={togglePanel}
            aria-label={`${label}取色`}
            data-testid={testid}
          >
            {!current && <span className="cf-swatch-auto-label">自动</span>}
          </button>
          {open && (
            <button
              type="button"
              className="cf-close"
              onClick={() => setOpen(false)}
              aria-label="收起取色面板"
              data-testid={`${testid}-collapse`}
            >
              <X size={14} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="cf-panel" data-testid={`${testid}-panel`}>
          <div className="cf-presets" role="listbox" aria-label={`${label}色板`}>
            {PRESET_SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                role="option"
                aria-selected={current === c}
                className={`cf-dot ${current === c ? 'cf-dot-active' : ''}`}
                style={{ background: c }}
                onClick={() => {
                  setHexText(c);
                  onPick(c);
                }}
                aria-label={`${label} ${c}`}
                data-testid={`${testid}-preset-${c.replace('#', '')}`}
              >
                {current === c && <Check size={12} strokeWidth={3} className="cf-dot-check" />}
              </button>
            ))}
          </div>

          <div className="cf-slider-row">
            <span className="cf-slider-name">色相</span>
            <input
              type="range"
              className="cf-slider cf-slider-hue"
              min={0}
              max={359}
              step={1}
              value={draftHsl.h}
              onChange={(e) => handleHueChange(Number(e.target.value))}
              aria-label={`${label}色相`}
              data-testid={`${testid}-hue`}
            />
            <span className="cf-slider-val">{draftHsl.h}°</span>
          </div>
          <div className="cf-slider-row">
            <span className="cf-slider-name">饱和度</span>
            <input
              type="range"
              className="cf-slider"
              min={0}
              max={100}
              step={1}
              value={draftHsl.s}
              onChange={(e) => pickHsl(draftHsl.h, Number(e.target.value), draftHsl.l)}
              aria-label={`${label}饱和度`}
              data-testid={`${testid}-sat`}
            />
            <span className="cf-slider-val">{draftHsl.s}%</span>
          </div>
          <div className="cf-slider-row">
            <span className="cf-slider-name">亮度</span>
            <input
              type="range"
              className="cf-slider"
              min={0}
              max={100}
              step={1}
              value={draftHsl.l}
              onChange={(e) => pickHsl(draftHsl.h, draftHsl.s, Number(e.target.value))}
              aria-label={`${label}亮度`}
              data-testid={`${testid}-lig`}
            />
            <span className="cf-slider-val">{draftHsl.l}%</span>
          </div>

          <div className="cf-hexline">
            <span className="cf-preview" style={{ background: current ?? 'transparent' }} />
            <input
              type="text"
              className={`theme-custom-hex cf-hex-input ${hexError ? 'cf-hex-input-error' : ''}`}
              value={hexText}
              onChange={(e: ChangeEvent<HTMLInputElement>) => commitHexText(e.target.value)}
              onBlur={handleHexBlur}
              placeholder="自动"
              maxLength={7}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label={`${label}色值`}
              data-testid={hexTestid ?? `${testid}-hex`}
            />
            {onReset && (
              <button type="button" className="theme-color-reset" onClick={onReset} data-testid={`${testid}-reset`}>
                自动
              </button>
            )}
            {bgImageUrl && (
              <button type="button" className="cf-bgpick" onClick={() => setSampling(true)} data-testid={`${testid}-bgpick`}>
                <Pipette size={13} strokeWidth={2} /> 取背景色
              </button>
            )}
          </div>
          {hexError && (
            <p className="cf-error" data-testid={`${testid}-hex-error`}>
              {hexError}
            </p>
          )}
        </div>
      )}

      {sampling && bgImageUrl && (
        <div className="cf-sample-overlay" data-testid={`${testid}-bgpick-overlay`}>
          <div className="cf-sample-head">
            <span className="cf-sample-title">点按图片任意位置取色</span>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSampling(false)}
              aria-label="关闭取色"
              data-testid={`${testid}-bgpick-close`}
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
          <div className="cf-sample-body">
            <img src={bgImageUrl} alt="背景图取色" draggable={false} onPointerDown={handleSamplePointer} />
          </div>
          {sampleError && (
            <p className="cf-sample-error" data-testid={`${testid}-bgpick-error`}>
              {sampleError}
            </p>
          )}
          <canvas ref={sampleCanvasRef} style={{ display: 'none' }} />
        </div>
      )}
    </div>
  );
}

export default ColorField;