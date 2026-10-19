'use strict';

/** 服务入口：HTTP 服务 + API 路由分发 + 静态资源 */

const origEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...rest) => {
  const name = typeof warning === 'object' ? warning.name : rest[0];
  if (name === 'ExperimentalWarning') return;
  return origEmitWarning.call(process, warning, ...rest);
};

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const config = require('./config');
const log = require('./logger');
const { ensureSeed } = require('./db');
const { matchRoute, sendJson, readBody, serveStatic, HttpError } = require('./http');
const A = require('./auth');
require('./routes_auth');
require('./routes');
require('./routes_lingua');
require('./routes_groups');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const APPS_JSON_PATH = path.join(PUBLIC_DIR, 'apps.json');

// 启动时读 apps.json，动态获取子应用列表；热更新友好（每次 serve 前再读一次）
function loadApps() {
  try {
    const raw = fs.readFileSync(APPS_JSON_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return data.apps || [];
  } catch {
    return [];
  }
}

// 通配匹配子应用：第一个 path segment 命中已注册的 app id 就 serve 对应目录
function serveSubApp(pathname, res) {
  const apps = loadApps();
  for (const app of apps) {
    const prefix = '/' + app.id;
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      const appDir = path.join(PUBLIC_DIR, app.id);
      if (!fs.existsSync(appDir)) return false;
      let rel = pathname.replace(new RegExp('^' + prefix.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')), '') || '/';
      if (rel === '/') rel = '/index.html';
      if (serveStatic(appDir, rel, res)) return true;
      if (serveStatic(appDir, '/index.html', res)) return true; // SPA fallback
      return false;
    }
  }
  return false;
}

function originAllowed(origin) {
  if (!origin) return false;
  return config.CORS_ORIGINS.includes(origin);
}

const seedInfo = ensureSeed();
let demoInfo = { seeded: false };
if (config.ENABLE_DEMO_SEED) {
  try {
    const { seedDemoContent } = require('./demo');
    demoInfo = seedDemoContent();
  } catch (e) {
    log.warn('demo seed skipped:', e.message);
  }
} else {
  log.info('demo seed disabled (ENABLE_DEMO_SEED=0 or production)');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const query = Object.fromEntries(url.searchParams.entries());

  // === CORS：白名单化 ===
  const origin = req.headers.origin || '';
  if (originAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(originAllowed(origin) ? 204 : 403).end();
    return;
  }

  if (!pathname.startsWith('/api/')) {
    if (pathname === '/health') {
      sendJson(res, 200, { ok: true, uptime: process.uptime(), version: '1.0.0' });
      return;
    }
    if (serveSubApp(pathname, res)) return;
    if (serveStatic(PUBLIC_DIR, pathname, res)) return;
    if (serveStatic(PUBLIC_DIR, '/index.html', res)) return;
    res.writeHead(404).end('Not Found');
    return;
  }

  try {
    const m = matchRoute(req.method, pathname);
    if (!m) {
      if (pathname.startsWith('/api/')) {
        log.debug(`[api-mock] ${req.method} ${pathname} → mock success`);
        sendJson(res, 200, { ok: true, mock: true, data: null });
        return;
      }
      throw new HttpError(404, `接口不存在：${pathname}`);
    }
    if (m.methodMismatch) throw new HttpError(405, `${pathname} 不支持 ${req.method}`);

    let body = {};
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) body = await readBody(req);

    const ctx = { req, res, params: m.params, query, body, user: null };
    if (m.auth) {
      const user = A.userFromToken(A.bearerToken(req));
      if (!user) throw new HttpError(401, '登录已过期，请重新登录');
      ctx.user = user;
    }
    const out = await m.handler(ctx);

    // === Set-Cookie：登录/注册 自动挂 sid cookie，登出自动清 cookie ===
    if (out && typeof out === 'object') {
      if (out.token && typeof out.token === 'string') {
        res.setHeader('Set-Cookie', A.cookieHeader(out.token));
      }
      if (out._clearCookie) {
        res.setHeader('Set-Cookie', A.clearCookieHeader());
        delete out._clearCookie;
      }
    }

    sendJson(res, 200, out);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : (err.status || 500);
    if (status >= 500) log.error(`[500] ${req.method} ${pathname}`, err.stack || err.message);
    else log.debug(`[${status}] ${req.method} ${pathname} — ${err.message}`);
    sendJson(res, status, { error: err.message || '服务器内部错误' });
  }
});

server.listen(config.PORT, () => {
  log.info('');
  log.info('🌍  语缪 Musē Phōnē · 缪斯的语言集市');
  log.info('   http://localhost:' + config.PORT);
  log.info('   NODE_ENV=' + config.NODE_ENV + '  CORS=' + config.CORS_ORIGINS.join(','));
  log.info('   seed: languages=' + seedInfo.languages + '  phrases=' + seedInfo.phrases + '  demo=' + (demoInfo.seeded ? 'on(' + demoInfo.users + 'u/' + demoInfo.posts + 'p)' : 'off'));
  log.info('');
});

process.on('SIGINT', () => { log.info('shutting down...'); server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { log.info('SIGTERM, shutting down...'); server.close(() => process.exit(0)); });
