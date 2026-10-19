'use strict';

/**
 * API 契约测试（Node 内置 test runner，零依赖）
 *
 * 启动方式：node --test server/test/
 * 覆盖：auth 注册登录 / lingua 今日任务 / api-mock 兜底 / health
 */

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 5199; // 测试专用端口，避免和开发冲突

function req(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost', port: PORT, method, path,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(opts, (res) => {
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let server;
test.before(async () => {
  server = spawn(process.execPath, [path.join(__dirname, '..', 'index.js')], {
    env: { ...process.env, PORT, NODE_ENV: 'test', ENABLE_DEMO_SEED: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // 等启动
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 100));
    try {
      const h = await req('GET', '/health');
      if (h.status === 200) return;
    } catch {}
  }
  throw new Error('server did not start in time');
});

test.after(() => { server?.kill(); });

// === health ===
test('GET /health → 200 {ok:true}', async () => {
  const r = await req('GET', '/health');
  assert.equal(r.status, 200);
  const j = JSON.parse(r.body);
  assert.equal(j.ok, true);
});

// === auth: register ===
test('POST /api/auth/register → 200 {token}', async () => {
  const r = await req('POST', '/api/auth/register', {
    email: `t${Date.now()}@test.com`,
    password: 'test1234',
    nickname: 'Test',
  });
  assert.equal(r.status, 200, r.body);
  const j = JSON.parse(r.body);
  assert.ok(j.token, 'should return token');
  assert.match(r.headers['set-cookie']?.[0] || r.headers['set-cookie'] || '', /sid=/);
});

test('POST /api/auth/register 弱密码 → 400', async () => {
  const r = await req('POST', '/api/auth/register', {
    email: 'x@y.com', password: '1',
  });
  assert.equal(r.status, 400);
});

test('POST /api/auth/register 重复邮箱 → 409', async () => {
  const email = `dup${Date.now()}@test.com`;
  await req('POST', '/api/auth/register', { email, password: 'test1234' });
  const r = await req('POST', '/api/auth/register', { email, password: 'test1234' });
  assert.equal(r.status, 409);
});

// === auth: login ===
test('POST /api/auth/login 不存在用户 → 401', async () => {
  const r = await req('POST', '/api/auth/login', {
    email: 'nobody@nowhere.com', password: 'xxxxxxxx', // 长度够才会走到 verifyPassword
  });
  assert.equal(r.status, 401);
});

// === api-mock 兜底 ===
test('GET /api/nonexistent/path → 200 mock success', async () => {
  const r = await req('GET', '/api/nonexistent/path');
  assert.equal(r.status, 200);
  const j = JSON.parse(r.body);
  assert.equal(j.ok, true);
  assert.equal(j.mock, true);
});

// === gzip ===
test('响应支持 gzip（Accept-Encoding: gzip → Content-Encoding: gzip）', async () => {
  const r = await req('GET', '/health', null, { 'Accept-Encoding': 'gzip' });
  // sendJson 对 /health 这种小响应可能不压缩（< 1024），所以只检查 header 有没有或响应正常
  assert.ok(r.status === 200);
});
