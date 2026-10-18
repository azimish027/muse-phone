'use strict';

/** 轻量 HTTP 路由与静态资源服务（含 gzip 压缩 + ETag） */

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.webp': 'image/webp',
};

const COMPRESSIBLE = new Set(['text/html', 'text/css', 'application/javascript', 'application/json', 'image/svg+xml']);

const routes = [];

function route(method, pattern, handler, opts = {}) {
  const names = [];
  const regex = new RegExp('^' + pattern.replace(/:([A-Za-z0-9_]+)/g, (_, name) => {
    names.push(name);
    return '([^/]+)';
  }).replace(/\*/g, '.*') + '$');
  routes.push({ method, regex, names, handler, auth: !!opts.auth, admin: !!opts.admin });
}

function matchRoute(method, pathname) {
  let pathExists = false;
  for (const r of routes) {
    const m = r.regex.exec(pathname);
    if (!m) continue;
    pathExists = true;
    if (r.method !== method) continue;
    const params = {};
    r.names.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
    return { handler: r.handler, params, auth: r.auth };
  }
  return pathExists ? { methodMismatch: true } : null;
}


function sendJson(res, status, payload) {
  const body = JSON.stringify(payload ?? null);
  const rawBuf = Buffer.from(body);

  // ① 先尝试 gzip（必须在 writeHead 之前设置 Content-Encoding）
  const accepts = (res.req?.headers['accept-encoding'] || '').toString();
  let out = rawBuf;
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  if (accepts.includes('gzip') && rawBuf.length > 1024) {
    out = zlib.gzipSync(rawBuf);
    headers['Content-Encoding'] = 'gzip';
  }
  headers['Content-Length'] = out.length;
  res.writeHead(status, headers);
  res.end(out);
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, '请求体过大'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, '请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(root, pathname, res) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const full = path.join(root, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
  if (!full.startsWith(root)) {
    res.writeHead(403).end('Forbidden');
    return true;
  }
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return false;
  const ext = path.extname(full).toLowerCase();
  const stat = fs.statSync(full);
  const noStore = ['.html'].includes(ext);
  const mimeType = MIME[ext] || 'application/octet-stream';
  const etag = `"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;

  // 先尝试 gzip（必须在 writeHead 之前）
  const accepts = (res.req?.headers['accept-encoding'] || '').toString();
  const canGzip = accepts.includes('gzip') && COMPRESSIBLE.has(mimeType) && stat.size > 1024;

  const headers = {
    'Content-Type': mimeType,
    'ETag': etag,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': noStore ? 'no-store, must-revalidate' : 'public, max-age=3600',
  };

  if (canGzip) {
    try {
      const raw = fs.readFileSync(full);
      const out = zlib.gzipSync(raw);
      headers['Content-Encoding'] = 'gzip';
      headers['Content-Length'] = out.length;
      res.writeHead(200, headers);
      res.end(out);
      return true;
    } catch { /* fallback below */ }
  }

  headers['Content-Length'] = stat.size;
  res.writeHead(200, headers);
  fs.createReadStream(full).pipe(res);
  return true;
}

module.exports = { HttpError, route, matchRoute, sendJson, readBody, serveStatic, routes };
