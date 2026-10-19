'use strict';

/** 集中式配置：读取环境变量 + 合理默认值（零外部依赖） */

function truthy(v) { return v === '1' || v === 'true' || v === 'yes'; }

const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// 默认本地开发白名单；生产必须显式设 CORS_ORIGINS
if (!CORS_ORIGINS.length) {
  CORS_ORIGINS.push('http://localhost:5173', 'http://localhost:3000');
}

module.exports = {
  PORT: Number(process.env.PORT || 5173),
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PROD: process.env.NODE_ENV === 'production',
  DATA_DIR: process.env.LINGUA_DATA || 'data',
  DB_PATH: process.env.LINGUA_DB || null,
  // 安全：cookie 默认值
  COOKIE: {
    NAME: 'sid',
    MAX_AGE_SECONDS: 30 * 86400,
    HttpOnly: true,
    Secure: truthy(process.env.COOKIE_SECURE) || process.env.NODE_ENV === 'production',
    SameSite: (process.env.COOKIE_SAMESITE || 'Lax'),
    Path: '/',
  },
  // CORS
  CORS_ORIGINS,
  // gzip 开关
  GZIP: truthy(process.env.ENABLE_GZIP) || true,
  // 种子数据（社区示例用户） — 仅在显式开启时注入
  // 默认关闭，避免 demo1234 弱密码泄漏到线上
  ENABLE_DEMO_SEED: truthy(process.env.ENABLE_DEMO_SEED) || process.env.NODE_ENV !== 'production',
  // 日志级别
  LOG_LEVEL: (process.env.LOG_LEVEL || 'info').toLowerCase(),
};
