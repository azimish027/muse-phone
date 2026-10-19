/* ==========================================================
   缪萨克斯集市 — Service Worker v100
   策略：Network First 为主，回退缓存
   
   核心改动（修复白屏）：
     - CACHE_VERSION 大跳到 msf-v100
     - install 阶段不用 cache.addAll（一个失败全挂）
     - 改成逐个 fetch + try-catch，某个文件 404 不阻塞整体
     - 所有资源 fetch 都加 cache:'no-cache' 绕过 HTTP 缓存
   ========================================================== */

const CACHE_VERSION = 'msf-v100';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

/* ---------- 预缓存：逐个 fetch，容错 ---------- */
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
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // 逐个 fetch，单个失败不阻塞整体
      const results = await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const res = await fetch(url, { cache: 'no-cache' });
            if (res && res.status === 200) {
              await cache.put(url, res.clone());
              return `✅ ${url}`;
            }
            return `⚠️ ${url} → ${res?.status || 'no res'}`;
          } catch (e) {
            return `⚠️ ${url} → ${e.message}`;
          }
        })
      );
      // 不阻塞 install！就算有些文件 fetch 失败，SW 也要装上
      self.skipWaiting();
    })()
  );
});

/* ---------- 激活：核弹级清所有旧缓存 ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      const old = keys.filter((k) => !k.startsWith(CACHE_VERSION));
      if (old.length) console.log('🧹 删除旧缓存:', old);
      return Promise.all(old.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

/* ---------- 拦截请求：全部 Network First，回退缓存 ---------- */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // reset.html / sw.js 注册 永远走网络
  if (url.pathname.includes('reset') || url.pathname.includes('sw.js')) {
    return;
  }

  // 全部 Network First + 回退缓存（HTML、CSS、JS、图片、JSON 一视同仁）
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, clone));
        }
        return res;
      })
      .catch(async () => {
        // 网挂了 → 用缓存回退
        const cached = await caches.match(req);
        if (cached) return cached;
        // 导航请求回退到 index.html
        if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
          return caches.match('./index.html');
        }
      })
  );
});

/* ---------- 消息 ---------- */
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'NUKE_ALL') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.registration.unregister())
    );
  }
});
