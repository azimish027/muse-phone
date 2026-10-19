/* ==========================================================
   缪萨克斯集市 — Service Worker
   策略：网络优先 + 回退缓存（Cache First for static assets）
   版本号改了之后自动触发新缓存
   ========================================================== */

const CACHE_VERSION = 'msf-v3';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

/* ---------- 预缓存：安装时立刻 Cache 核心文件 ---------- */
const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './win98.css',
  './app.js',
  './manifest.json',
  './assets/logo.svg',
  './assets/icon-96.png',
  './assets/icon-180.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())         // 立刻激活新 SW
  );
});

/* ---------- 激活：清理旧版本缓存 ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())       // 立刻接管所有页面
  );
});

/* ---------- 拦截请求：静态资源 → Cache First；API → Network First ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) 只处理 GET
  if (req.method !== 'GET') return;

  // 2) 不处理跨域（比如 CDN / Gravatar / Google Fonts）
  if (url.origin !== self.location.origin) return;

  // 3) HTML 页面（导航请求）→ Network First + 回退缓存
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // 4) 静态资源（CSS / JS / 图片 / JSON / SVG）→ Cache First + 后台刷新
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);   // 网挂了就用缓存
      return cached || networkFetch;
    })
  );
});

/* ---------- 消息：支持手动触发更新 ---------- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  }
});
