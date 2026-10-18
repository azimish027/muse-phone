'use strict';

/** 认证：scrypt 口令哈希 + 服务端会话令牌（零外部依赖） */

const crypto = require('node:crypto');
const { q } = require('./db');
const config = require('./config');

const SESSION_DAYS = 30;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hash] = parts;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(String(password), salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function nowIso() {
  return new Date().toISOString();
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  q.run('INSERT INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)',
    token, userId, nowIso(), expires);
  return token;
}

function deleteSession(token) {
  if (token) q.run('DELETE FROM sessions WHERE token=?', token);
}

function userFromToken(token) {
  if (!token) return null;
  const row = q.get(
    `SELECT u.id, u.email, u.nickname, u.avatar_color, u.created_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`, token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    deleteSession(token);
    return null;
  }
  return row;
}

function bearerToken(req) {
  const header = req.headers['authorization'] || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  const cookie = req.headers['cookie'] || '';
  const hit = cookie.split(';').map((s) => s.trim()).find((s) => s.startsWith(config.COOKIE.NAME + '='));
  return hit ? hit.slice(config.COOKIE.NAME.length + 1) : null;
}

/** 生成安全的 Set-Cookie header 值 */
function cookieHeader(token, opts = {}) {
  const parts = [
    `${config.COOKIE.NAME}=${token}`,
    `Path=${config.COOKIE.Path}`,
    `Max-Age=${opts.maxAge ?? config.COOKIE.MAX_AGE_SECONDS}`,
    'HttpOnly',
    `SameSite=${opts.SameSite ?? config.COOKIE.SameSite}`,
  ];
  if (config.COOKIE.Secure) parts.push('Secure');
  return parts.join('; ');
}

function clearCookieHeader() {
  return `${config.COOKIE.NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=${config.COOKIE.SameSite}${config.COOKIE.Secure ? '; Secure' : ''}`;
}

/** 校验注册/登录入参 */
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function assertCredentials(email, password) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('邮箱格式不正确'), { status: 400 });
  if (String(password || '').length < 6) throw Object.assign(new Error('密码至少 6 位'), { status: 400 });
}

module.exports = {
  hashPassword, verifyPassword, createSession, deleteSession,
  userFromToken, bearerToken, cookieHeader, clearCookieHeader,
  normalizeEmail, assertCredentials, nowIso, SESSION_DAYS,
};
