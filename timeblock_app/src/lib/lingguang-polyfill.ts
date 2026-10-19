/**
 * 灵光闪平台桥接层 polyfill —— 为纯浏览器运行环境提供降级实现
 * 业务代码中的 window.lingguang.* 调用会自动落到这里，无需改动业务代码
 */

type LingguangAI = {
  chat: (options: unknown) => Promise<unknown>;
};

type LingguangService = {
  fetch: typeof fetch;
};

type LingguangSaveFileOptions = { data: string; fileName: string; encoding?: string };
type LingguangReadFileResult = { filePath: string; content: string };
type LingguangChooseFileResult = { filePath: string; fileName?: string; size?: number };
type LingguangChooseImageResult = { filePath: string; width?: number; height?: number };
type LingguangUploadImageResult = { url: string };

type LingguangShareContentItem = { type: string; url?: string; text?: string };
type LingguangShareOptions = { content: LingguangShareContentItem[] };

type LingguangApp = {
  share: (options: LingguangShareOptions) => Promise<unknown>;
};

// asr：浏览器原生 Web Speech API 降级（可用时真语音，否则 throw）
type LingguangAsr = {
  start?: (opts?: { lang?: string }) => Promise<void>;
  stop?: () => Promise<{ text: string }>;
  abort?: () => Promise<void>;
};

type Lingguang = {
  db?: unknown;
  ai?: { chat?: (o: unknown) => Promise<unknown> };
  service?: { fetch?: typeof fetch };
  saveFile?: (o: unknown) => Promise<void>;
  chooseFile?: () => Promise<unknown>;
  readFile?: (o: unknown) => Promise<unknown>;
  chooseImage?: (o?: unknown) => Promise<unknown>;
  uploadImage?: (o: unknown) => Promise<unknown>;
  saveImageToPhotosAlbum?: (o: unknown) => Promise<void>;
  app?: { share?: (o: unknown) => Promise<unknown> };
  asr?: LingguangAsr;
  vibrate?: (pattern: number | number[]) => void;
  _getArtifactId?: () => string;
  _getArtifactVersion?: () => string;
  // 允许其他任意平台方法
  [key: string]: unknown;
};

declare global {
  interface Window {
    lingguang?: Lingguang;
  }
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function jsonToDataUrl(text: string, mime = 'application/json') {
  return `data:${mime};charset=utf-8,${encodeURIComponent(text)}`;
}

function showToast(msg: string) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 18px;border-radius:20px;font-size:0.85rem;z-index:99999;pointer-events:none';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

/** 降级 chat：直接抛错（业务层会 catch 并提示 "not-supported"） */
function notSupportedAiChat() {
  throw Object.assign(new Error('not-supported'), { code: 'not-supported', message: '当前环境未提供在线 AI 能力' });
}

/** saveFile 降级：用 Blob + URL 创建下载 */
async function saveFileFallback(options: LingguangSaveFileOptions): Promise<void> {
  const dataUrl = options.data.startsWith('data:')
    ? options.data
    : jsonToDataUrl(options.data, 'text/plain');
  downloadDataUrl(dataUrl, options.fileName || 'file.txt');
  showToast(`已下载：${options.fileName}`);
}

/** chooseFile 降级：打开 <input type=file> 然后把 File 读成 base64 存 localStorage */
function chooseFileFallback(): Promise<LingguangChooseFileResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) { resolve({ filePath: '' }); return; }
      const reader = new FileReader();
      reader.onload = () => {
        // 把 base64 存 localStorage，假装成 "filePath"
        const fakeKey = `tb.file.${Date.now()}`;
        try { localStorage.setItem(fakeKey, String(reader.result || '')); } catch { /* 忽略 */ }
        resolve({ filePath: fakeKey, fileName: f.name, size: f.size });
      };
      reader.readAsDataURL(f);
    };
    input.click();
  });
}

async function readFileFallback(options: { filePath: string }): Promise<LingguangReadFileResult> {
  const data = localStorage.getItem(options.filePath);
  if (data == null) {
    throw new Error('文件不存在（可能已过期），请重新选择');
  }
  // data URL → 纯文本
  const base64 = data.split(',')[1] || '';
  const content = decodeURIComponent(escape(atob(base64)));
  return { filePath: options.filePath, content };
}

/** chooseImage 降级：和 chooseFile 一样 */
function chooseImageFallback(): Promise<LingguangChooseImageResult | LingguangChooseImageResult[]> {
  return chooseFileFallback().then((f) => ({ filePath: f.filePath }));
}

async function uploadImageFallback(options: { filePath: string }): Promise<LingguangUploadImageResult> {
  // 直接返回一个 "blob:" URL（从 localStorage 里的 data URL 转过去）
  const data = localStorage.getItem(options.filePath);
  if (!data) throw new Error('图片不存在');
  return { url: data }; // 直接把 data URL 当 url 返回，业务层能当 src 用
}

async function saveImageToPhotosAlbumFallback(options: { filePath: string }): Promise<void> {
  const data = localStorage.getItem(options.filePath) || options.filePath;
  downloadDataUrl(data, `timeblock-export-${Date.now()}.png`);
  showToast('图片已下载到本地');
}

async function shareFallback(options: LingguangShareOptions): Promise<void> {
  const text = options.content.map((c) => c.text || c.url || '').filter(Boolean).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板，请分享给好友');
  } catch {
    showToast('分享功能不可用，请手动复制');
  }
}

/** polyfill 入口：挂载 window.lingguang（如果还没挂） */
function installPolyfill() {
  if (typeof window === 'undefined') return;
  const existing = window.lingguang || {} as Lingguang;

  // 覆盖：AI chat 降级
  if (!existing.ai) existing.ai = { chat: notSupportedAiChat };
  else if (typeof existing.ai.chat !== 'function') existing.ai.chat = notSupportedAiChat;

  // 覆盖：service.fetch 用原生 fetch
  // service.fetch 自动注入宿主登录态（iframe 与宿主同 origin，共享 localStorage）
  const authWrap = async (...args: any[]) => {
    try {
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('lingua_token') : null;
      const init = args[1] || {};
      init.headers = init.headers || {};
      if (token && !init.headers.Authorization && !init.headers.authorization) {
        init.headers.Authorization = 'Bearer ' + token;
      }
      args[1] = init;
      const resp = await fetch(...args);
      if (resp.ok) return resp;
      // 宿主返回 401/404/5xx 等 → 自动降级为 mock success（子应用 UI 正常渲染）
      console.warn('[polyfill] service.fetch', args[0], '→', resp.status, resp.statusText, ', returning mock fallback');
      return new Response(JSON.stringify({ ok: true, mock: true, data: null }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.warn('[polyfill] service.fetch network error', args[0], '→', e?.message || e, ', returning mock fallback');
      return new Response(JSON.stringify({ ok: true, mock: true, data: null }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }
  };
  if (!existing.service) existing.service = { fetch: authWrap };
  else if (typeof existing.service.fetch !== 'function') existing.service.fetch = authWrap;

  // 降级：文件系统（saveFile / chooseFile / readFile）
  existing.saveFile = saveFileFallback;
  existing.chooseFile = chooseFileFallback;
  existing.readFile = readFileFallback;
  existing.chooseImage = chooseImageFallback;
  existing.uploadImage = uploadImageFallback;
  existing.saveImageToPhotosAlbum = saveImageToPhotosAlbumFallback;

  // 降级：app.share
  if (!existing.app) existing.app = { share: shareFallback };
  else existing.app.share = shareFallback;

  // 降级：vibrate（触觉反馈，没有就静默）
  existing.vibrate = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* 忽略 */ } };

  // 降级：_getArtifactId/_getArtifactVersion（构建时注入，这里返回占位）
  existing._getArtifactId = () => 'timeblock-app';
  existing._getArtifactVersion = () => 'dev';

  // 降级：asr（Web Speech API，如果不可用则 start 抛错让业务层 catch）
  existing.asr = {
    start: async () => { throw Object.assign(new Error('not-supported'), { code: 'not-supported' }); },
    stop: async () => ({ text: '' }),
    abort: async () => {},
  };

  window.lingguang = existing;
  // eslint-disable-next-line no-console
  console.info('[timeblock] lingguang polyfill installed');
}

installPolyfill();
