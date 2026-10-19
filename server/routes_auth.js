'use strict';

/** 认证路由（独立文件，单一职责） */

const { q } = require('./db');
const { HttpError, route } = require('./http');
const A = require('./auth');

/** 简易色彩池：根据 nickname 稳定哈希选一个 */
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#0ea5e9', '#f59e0b', '#84cc16'];
function pickColor(seed) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return COLORS[h % COLORS.length];
}

route('POST', '/api/auth/register', async (ctx) => {
  const email = A.normalizeEmail(ctx.body.email);
  A.assertCredentials(email, ctx.body.password);
  if (q.get('SELECT id FROM users WHERE email=?', email)) {
    throw new HttpError(409, '该邮箱已注册，请直接登录');
  }
  const nickname = String(ctx.body.nickname || '').trim() || email.split('@')[0];
  const targets = Array.isArray(ctx.body.target_langs) && ctx.body.target_langs.length
    ? ctx.body.target_langs.slice(0, 3) : ['en'];
  const userId = q.tx(() => {
    q.run('INSERT INTO users (email,password_hash,nickname,avatar_color,created_at) VALUES (?,?,?,?,?)',
      email, A.hashPassword(ctx.body.password), nickname, pickColor(nickname), A.nowIso());
    const id = Number(q.get('SELECT last_insert_rowid() AS id').id);
    q.run(
      `INSERT INTO profiles (user_id,native_lang,target_langs,placement,goal,daily_goal_min,onboarded)
       VALUES (?,?,?,?,?,?,?)`,
      id, ctx.body.native_lang || 'zh', JSON.stringify(targets),
      ctx.body.placement || 'A1', ctx.body.goal || 'daily', ctx.body.daily_goal_min || 20, 0);
    q.run('INSERT INTO user_stats (user_id) VALUES (?)', id);
    return id;
  });
  const token = A.createSession(userId);
  // token 返回给前端（index.js 自动 Set-Cookie）
  return { token };
});

route('POST', '/api/auth/login', async (ctx) => {
  const email = A.normalizeEmail(ctx.body.email);
  A.assertCredentials(email, ctx.body.password);
  const user = q.get('SELECT * FROM users WHERE email=?', email);
  if (!user || !A.verifyPassword(ctx.body.password, user.password_hash)) {
    throw new HttpError(401, '邮箱或密码错误');
  }
  const token = A.createSession(user.id);
  return { token };
});

route('POST', '/api/auth/logout', async (ctx) => {
  A.deleteSession(A.bearerToken(ctx.req));
  return { ok: true, _clearCookie: true };
});

route('GET', '/api/auth/me', async (ctx) => {
  // 返回完整 user（复用 routes.js buildUser）
  const { buildUser } = require('./routes');
  return { user: buildUser(ctx.user.id) };
}, { auth: true });
