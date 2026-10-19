#!/usr/bin/env node
'use strict';

/**
 * deplatform.js —— 灵光闪应用去平台化一键脚本
 *
 * 把一个标准灵光脚手架项目（React + Vite + Tailwind）改造成纯浏览器可运行的独立 SPA。
 * 核心思路：不碰业务代码（src/components、src/App.tsx 等），只改构建配置和平台桥接层。
 *
 * 用法：
 *   node scripts/deplatform.js <app-path>              # 执行去平台化
 *   node scripts/deplatform.js <app-path> --dry-run     # 只打印要改什么，不动文件
 *   node scripts/deplatform.js <app-path> --build       # 去平台化后自动 npm install + npm run build
 *
 * 示例：
 *   node scripts/deplatform.js ./timeblock_app
 *   node scripts/deplatform.js ../my-rpg-app --dry-run
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// ========== 参数解析 ==========
const args = process.argv.slice(2);
if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
  console.log(`
  去平台化一键脚本 —— 灵光闪应用 → 独立浏览器 SPA

  用法：
    node scripts/deplatform.js <app-path> [--dry-run] [--build]

  选项：
    --dry-run   预演模式，打印将执行的改动但不写文件
    --build     去平台化后自动安装依赖并构建

  去平台化 6 步：
    ① Vite config 瘦身（删所有 block*Plugin / manifest 注入 / collect-usage）
    ② 写入 lingguang-polyfill.ts（覆盖 window.lingguang.* 所有平台 API）
    ③ main.tsx 顶部引入 polyfill（在所有业务 import 之前）
    ④ index.html 清理（删 manifest meta / base.js / 灵光品牌 title）
    ⑤ package.json build 脚本跳过类型检查（避免 strict type 挂掉）
    ⑥ 品牌痕迹清理（console log / package.json name / index.html data-* 属性）
  `);
  process.exit(args.length === 0 ? 1 : 0);
}

const DRY_RUN = args.includes('--dry-run');
const DO_BUILD = args.includes('--build');
const TARGET = path.resolve(args.find((a) => !a.startsWith('--')));

if (!fs.existsSync(TARGET)) {
  console.error(`[错误] 路径不存在：${TARGET}`);
  process.exit(1);
}
if (!fs.existsSync(path.join(TARGET, 'package.json'))) {
  console.error(`[错误] 该目录不是一个 Node 项目（缺少 package.json）：${TARGET}`);
  process.exit(1);
}

// ========== 工具函数 ==========
const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', C = '\x1b[36m', B = '\x1b[1m', D = '\x1b[2m', N = '\x1b[0m';
function log(step, msg) { console.log(`${G}[${step}]${N} ${msg}`); }
function warn(msg) { console.log(`${Y}[警告]${N} ${msg}`); }
function err(msg) { console.log(`${R}[错误]${N} ${msg}`); }
function diff(title, oldStr, newStr) {
  if (DRY_RUN) {
    console.log(`\n${C}── ${title} ──${N}`);
    console.log(`${D}--- (旧)${N}`);
    console.log(oldStr.split('\n').slice(0, 15).map((l) => D + l + N).join('\n'));
    if (oldStr.split('\n').length > 15) console.log(`${D}... 共 ${oldStr.split('\n').length} 行${N}`);
    console.log(`${B}+++ (新)${N}`);
    console.log(newStr.split('\n').slice(0, 15).map((l) => B + l + N).join('\n'));
    if (newStr.split('\n').length > 15) console.log(`${B}... 共 ${newStr.split('\n').length} 行${N}`);
    console.log('');
  }
}
function writeSafe(file, content) {
  if (DRY_RUN) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf-8');
}
function backupIfNeeded(file) {
  const bak = file + '.bak';
  if (!DRY_RUN && fs.existsSync(file) && !fs.existsSync(bak)) {
    fs.copyFileSync(file, bak);
    log('备份', path.relative(TARGET, bak));
  }
}

// ========== 步骤 ① Vite config 瘦身 ==========
function slimViteConfig() {
  const vitePath = path.join(TARGET, 'vite.config.ts');
  if (!fs.existsSync(vitePath)) {
    warn('vite.config.ts 不存在，跳过 Vite 瘦身');
    return null;
  }
  const original = fs.readFileSync(vitePath, 'utf-8');

  // 已经是极简配置了就跳过
  if (original.includes("base: './'") && !original.includes('block*Plugin') && !original.includes('lingguang')) {
    log('① Vite 瘦身', '已是极简配置，跳过');
    return { path: vitePath, content: original };
  }

  // 通用极简模板
  const slim = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 去平台化：纯 React + 相对路径 base
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
})
`;

  diff('vite.config.ts', original, slim);
  backupIfNeeded(vitePath);
  writeSafe(vitePath, slim);
  log('① Vite 瘦身', `vite.config.ts → 极简配置（已删 ${original.split('\n').length - slim.split('\n').length} 行平台代码）`);
  return { path: vitePath, content: slim };
}

// ========== 步骤 ② Polyfill ==========
const POLYFILL_TS = `/**
 * 灵光闪平台桥接层 polyfill —— 为纯浏览器运行环境提供降级实现
 * 业务代码中的 window.lingguang.* 调用会自动落到这里，无需改动业务代码
 *
 * 去平台化脚本自动生成，可按需扩展
 */

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
  [key: string]: unknown;
};

declare global {
  interface Window { lingguang?: Lingguang; }
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
  return \`data:\${mime};charset=utf-8,\${encodeURIComponent(text)}\`;
}

function showToast(msg: string) {
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;bottom:40px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 18px;border-radius:20px;font-size:0.85rem;z-index:99999;pointer-events:none';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

function notSupported(feature = 'AI') {
  throw Object.assign(new Error('not-supported'), { code: 'not-supported', message: \`当前环境未提供 \${feature} 能力\` });
}

async function saveFileFallback(o: { data: string; fileName: string }) {
  const du = o.data.startsWith('data:') ? o.data : jsonToDataUrl(o.data, 'text/plain');
  downloadDataUrl(du, o.fileName || 'file.txt');
  showToast(\`已下载：\${o.fileName}\`);
}

function chooseFileFallback(): Promise<{ filePath: string; fileName?: string; size?: number }> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) { resolve({ filePath: '' }); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const key = \`app.file.\${Date.now()}\`;
        try { localStorage.setItem(key, String(reader.result || '')); } catch { /* ignore */ }
        resolve({ filePath: key, fileName: f.name, size: f.size });
      };
      reader.readAsDataURL(f);
    };
    input.click();
  });
}

async function readFileFallback(o: { filePath: string }) {
  const data = localStorage.getItem(o.filePath);
  if (data == null) throw new Error('文件不存在（可能已过期），请重新选择');
  const base64 = data.split(',')[1] || '';
  const content = decodeURIComponent(escape(atob(base64)));
  return { filePath: o.filePath, content };
}

async function shareFallback(o: { content: Array<{ type: string; url?: string; text?: string }> }) {
  const text = o.content.map((c) => c.text || c.url || '').filter(Boolean).join('\\n');
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板');
  } catch {
    showToast('分享功能不可用，请手动复制');
  }
}

function installPolyfill() {
  if (typeof window === 'undefined') return;
  const existing = (window.lingguang || {}) as Lingguang;

  if (!existing.ai) existing.ai = { chat: () => notSupported('AI') };
  else if (typeof existing.ai.chat !== 'function') existing.ai.chat = () => notSupported('AI');

  if (!existing.service) existing.service = { fetch };
  else if (typeof existing.service.fetch !== 'function') existing.service.fetch = fetch;

  existing.saveFile = saveFileFallback;
  existing.chooseFile = chooseFileFallback;
  existing.readFile = readFileFallback;
  existing.chooseImage = chooseFileFallback;
  existing.uploadImage = async (o) => ({ url: localStorage.getItem(o.filePath) || '' });
  existing.saveImageToPhotosAlbum = async (o) => downloadDataUrl(o.filePath, \`export-\${Date.now()}.png\`);

  if (!existing.app) existing.app = { share: shareFallback };
  else existing.app.share = shareFallback;

  existing.vibrate = (p) => { try { navigator.vibrate?.(p); } catch { /* ignore */ } };
  existing._getArtifactId = () => 'deplatformed-app';
  existing._getArtifactVersion = () => '1.0.0';

  existing.asr = {
    start: async () => notSupported('ASR 语音识别'),
    stop: async () => ({ text: '' }),
    abort: async () => {},
  };

  window.lingguang = existing;
}

installPolyfill();
`;

function writePolyfill() {
  const libDir = path.join(TARGET, 'src', 'lib');
  const polyfillPath = path.join(libDir, 'lingguang-polyfill.ts');

  // 如果用户已经有自己定制的 polyfill 了，保留并跳过
  if (fs.existsSync(polyfillPath)) {
    const existing = fs.readFileSync(polyfillPath, 'utf-8');
    if (!existing.includes('去平台化脚本自动生成')) {
      warn('src/lib/lingguang-polyfill.ts 已存在且非脚本生成，保留不动（如要覆盖请先手动删除）');
      return polyfillPath;
    }
    // 是脚本之前生成的，备份一下
    backupIfNeeded(polyfillPath);
  }

  writeSafe(polyfillPath, POLYFILL_TS);
  log('② Polyfill', `写入 src/lib/lingguang-polyfill.ts（覆盖 ${POLYFILL_TS.split('\\n').length} 行平台 API 降级）`);
  return polyfillPath;
}

// ========== 步骤 ③ main.tsx 引入 polyfill ==========
function injectPolyfillImport() {
  const mainTsx = path.join(TARGET, 'src', 'main.tsx');
  if (!fs.existsSync(mainTsx)) {
    // 也可能是 main.jsx
    const mainJsx = path.join(TARGET, 'src', 'main.jsx');
    if (!fs.existsSync(mainJsx)) {
      warn('src/main.tsx 不存在，跳过 polyfill import 注入');
      return null;
    }
    return injectPolyfillImportTo(mainJsx);
  }
  return injectPolyfillImportTo(mainTsx);
}

function injectPolyfillImportTo(mainPath) {
  const original = fs.readFileSync(mainPath, 'utf-8');

  // 已经引入了就跳过
  if (original.includes("import './lib/lingguang-polyfill'") || original.includes('import "./lib/lingguang-polyfill"')) {
    log('③ main.tsx', '已引入 polyfill，跳过');
    return mainPath;
  }

  // 在第一个 import 之前插入
  const firstImportIdx = original.search(/^import\s/m);
  if (firstImportIdx === -1) {
    warn('main.tsx 里没找到 import 语句，手动在文件顶部加一行：');
    console.log(`  import './lib/lingguang-polyfill';`);
    return null;
  }

  const newContent = original.slice(0, firstImportIdx)
    + "import './lib/lingguang-polyfill';\n"
    + original.slice(firstImportIdx);

  diff(path.relative(TARGET, mainPath), original, newContent);
  backupIfNeeded(mainPath);
  writeSafe(mainPath, newContent);
  log('③ main.tsx', '已在文件顶部引入 polyfill');
  return mainPath;
}

// ========== 步骤 ④ index.html 清理 ==========
function cleanIndexHtml() {
  const indexPath = path.join(TARGET, 'index.html');
  if (!fs.existsSync(indexPath)) {
    warn('index.html 不存在，跳过');
    return null;
  }
  const original = fs.readFileSync(indexPath, 'utf-8');

  let cleaned = original;

  // 删 data-framework / data-version / data-localstorage-bridge 等平台属性
  cleaned = cleaned.replace(/\s+data-framework="[^"]*"/g, '');
  cleaned = cleaned.replace(/\s+data-version="[^"]*"/g, '');
  cleaned = cleaned.replace(/\s+data-localstorage-bridge="[^"]*"/g, '');

  // 删 manifest 注入的 meta
  cleaned = cleaned.replace(/<meta\s+name="asap-build-time"[^>]*>\s*/gi, '');
  cleaned = cleaned.replace(/<meta\s+name="lingguang-[^"]*"[^>]*>\s*/gi, '');

  // 删 <script defer src="base.js"></script>（灵光平台注入的）
  cleaned = cleaned.replace(/\s*<script[^>]*src="base\.js"[^>]*><\/script>\s*/g, '\n');

  // 删平台注入的 collect-lingguang-usage / block 相关 <script>
  cleaned = cleaned.replace(/<script[^>]*>[^<]*collectLingguangUsage[^<]*<\/script>\s*/gi, '');

  // 删所有 <link> 到阿里 CDN 的 material-icons / lingguang 资源
  cleaned = cleaned.replace(/\s*<link[^>]*gw\.alipayobjects\.com[^>]*>\s*/g, '\n');

  // 删 <meta name="viewport"> 里的 viewport-fit=cover（平台 safe-area）
  cleaned = cleaned.replace(/user-scalable=no,\s*viewport-fit=cover/g, 'user-scalable=no');
  cleaned = cleaned.replace(/viewport-fit=cover,\s*/g, '');
  cleaned = cleaned.replace(/,\s*viewport-fit=cover/g, '');

  // 确保有 <base href="./">
  if (!cleaned.includes('base href=')) {
    cleaned = cleaned.replace('</head>', '  <base href="./">\n</head>');
  }

  // title 改通用名（如果是灵光默认的）
  cleaned = cleaned.replace(/灵光闪应用/g, 'My App');

  // 没变化
  if (cleaned === original) {
    log('④ index.html', '已清理过或无需清理，跳过');
    return indexPath;
  }

  diff('index.html', original, cleaned);
  backupIfNeeded(indexPath);
  writeSafe(indexPath, cleaned);
  log('④ index.html', `清理完成（删 ${original.length - cleaned.length} 字符平台痕迹）`);
  return indexPath;
}

// ========== 步骤 ⑤ package.json build 脚本 ==========
function fixBuildScript() {
  const pkgPath = path.join(TARGET, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const originalBuild = pkg.scripts?.build || '';

  // 如果 build 脚本里已经没有 tsc 类型检查了，跳过
  if (!originalBuild.includes('tsc') && !originalBuild.includes('typecheck')) {
    log('⑤ build 脚本', '已是纯 vite build，跳过');
    return pkgPath;
  }

  const newBuild = 'vite build';
  pkg.scripts.build = newBuild;

  // 改 package.json name（如果还是模板名）
  if (pkg.name === 'asap-react-scaffold') {
    pkg.name = 'deplatformed-app';
    log('⑤ build 脚本', `package.json name: asap-react-scaffold → deplatformed-app`);
  }

  diff('package.json (scripts.build)', originalBuild, newBuild);
  backupIfNeeded(pkgPath);
  writeSafe(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  log('⑤ build 脚本', `build: "${originalBuild}" → "${newBuild}"`);
  return pkgPath;
}

// ========== 步骤 ⑥ 品牌痕迹清理 ==========
function removeBrandTraces() {
  // 1. manifest.json — 灵光平台导航栏配置，浏览器环境没用
  const manifestPath = path.join(TARGET, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const content = fs.readFileSync(manifestPath, 'utf-8');
    if (content.includes('灵光') || content.includes('lingguang') || content.includes('flash')) {
      backupIfNeeded(manifestPath);
      writeSafe(manifestPath, JSON.stringify({ navigationBar: { visible: false, title: 'My App' } }, null, 2) + '\n');
      log('⑥ 品牌清理', 'manifest.json 已清理（去灵光品牌）');
    }
  }

  // 2. 删 plugins/ 目录下的 block*Plugin 源文件（已经不再被 vite.config.ts 引用了，但留着也无妨）
  //    这步可选：用户可能想保留来参考。只打印提醒，不删。
  const pluginsDir = path.join(TARGET, 'plugins');
  if (fs.existsSync(pluginsDir)) {
    const blockPlugins = fs.readdirSync(pluginsDir).filter((f) => f.startsWith('vite-plugin-block-') || f.includes('lingguang') || f.includes('manifest'));
    if (blockPlugins.length > 0) {
      warn(`plugins/ 目录下还有 ${blockPlugins.length} 个灵光平台插件（vite-plugin-block-*、manifest 等），已不再被引用，可安全删除`);
      if (!DRY_RUN) {
        // 不自动删，让用户决定
      }
    }
  }

  // 3. public/base.js — 灵光平台注入脚本
  const baseJs = path.join(TARGET, 'public', 'base.js');
  if (fs.existsSync(baseJs)) {
    const stat = fs.statSync(baseJs);
    if (!DRY_RUN) {
      fs.unlinkSync(baseJs);
      log('⑥ 品牌清理', `已删除 public/base.js（${stat.size} 字节，灵光平台注入脚本）`);
    } else {
      log('⑥ 品牌清理', `[dry-run] 将删除 public/base.js（灵光平台注入脚本）`);
    }
  }
}

// ========== 执行 ==========
function run() {
  console.log(`\n${B}🚀  去平台化${N}  ${C}${path.relative(process.cwd(), TARGET) || TARGET}${N}`);
  if (DRY_RUN) console.log(`${Y}[dry-run 预演模式]${N} 不会修改任何文件\n`);
  else console.log('');

  const results = [];
  results.push(slimViteConfig());
  results.push(writePolyfill());
  results.push(injectPolyfillImport());
  results.push(cleanIndexHtml());
  results.push(fixBuildScript());
  results.push(removeBrandTraces());

  const allOk = results.every((r) => r !== null);
  const fixed = results.filter((r) => r !== null).length;

  console.log(`\n${B}── 去平台化完成 ──${N}`);
  console.log(`  改好 ${fixed}/6 项`);
  if (DRY_RUN) console.log(`  ${Y}（预演模式：无文件被修改）${N}`);
  if (!allOk) warn('有步骤被跳过，请检查上面的日志');

  // 构建
  if (DO_BUILD && !DRY_RUN) {
    console.log(`\n${B}── 安装依赖并构建 ──${N}`);
    try {
      if (!fs.existsSync(path.join(TARGET, 'node_modules'))) {
        log('npm install', '首次安装依赖（可能需要几分钟）...');
        execSync('npm install', { cwd: TARGET, stdio: 'inherit' });
      } else {
        log('npm install', 'node_modules 已存在，跳过');
      }
      log('npm run build', '构建...');
      execSync('npm run build', { cwd: TARGET, stdio: 'inherit' });
      log('✅', `构建成功！产物在 ${path.join(TARGET, 'dist')}`);
      log('📦', '下一步：把 dist/ 里的文件复制到宿主的 public/<app-id>/ 目录');
    } catch (e) {
      err('构建失败，请检查上面的错误信息');
      process.exit(1);
    }
  } else if (DO_BUILD && DRY_RUN) {
    log('[dry-run]', '将执行 npm install && npm run build');
  }

  if (!DO_BUILD && !DRY_RUN) {
    console.log(`\n${B}下一步：${N}到应用目录手动执行`);
    console.log(`  ${C}cd ${path.relative(process.cwd(), TARGET)}${N}`);
    console.log(`  ${C}npm install && npm run build${N}`);
    console.log(`  ${C}# 然后把 dist/ 复制到宿主的 public/<app-id>/${N}`);
  }

  console.log('');
}

run();
