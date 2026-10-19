/* ==========================================================
   缪萨克斯集市 — Service Worker
   策略：网络优先 + 回退缓存（Cache First for static assets）
   版本号改了之后自动触发新缓存
   
   ⚠️ 强制刷新策略：
     - CACHE_VERSION 每次大跳（v3→v99→v100...），确保旧缓存 100% 被清
     - install 时 skipWaiting，activate 时 clients.claim
     - reset.html 可以一键 unregister 所有 SW + 硬刷新
   ========================================================== */

const CACHE_VERSION = 'msf-v99';
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
      .then(() => self.skipWaiting())         // 立刻激活，不等旧 SW 退休
  );
});

/* ---------- 激活：清理所有旧版本缓存（核弹级） ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      // 删掉所有不以 msf-v99 开头的缓存（包括 msf-v1, v2, v3, v4... 全部）
      const old = keys.filter((k) => !k.startsWith(CACHE_VERSION));
      console.log('🧹 SW: 删除旧缓存', old);
      return Promise.all(old.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())       // 立刻接管所有打开的页面
  );
});

/* ---------- 拦截请求：静态资源 → Cache First；HTML → Network First ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) 只处理 GET
  if (req.method !== 'GET') return;

  // 2) 不处理跨域
  if (url.origin !== self.location.origin) return;

  // 3) reset.html 永远不走缓存（让用户能重置 SW）
  if (url.pathname.includes('reset')) {
    return;  // 直接走网络
  }

  // 4) HTML 页面 → Network First + 回退缓存
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // 5) 静态资源 → Cache First + 后台刷新
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req, { cache: 'no-cache' })
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

/* ---------- 消息：支持手动触发更新 / 自爆 ---------- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
  if (event.data === 'NUKE_ALL') {
    // 核弹：清缓存 + unregister 自己
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
    );
  }
});
