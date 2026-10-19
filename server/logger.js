'use strict';

/** 轻量 leveled logger（零依赖）：debug/info/warn/error */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
let minLevel = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? 1;

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function write(level, ...args) {
  if (LEVELS[level] < minLevel) return;
  const prefix = `[${ts()}] [${level.toUpperCase()}]`;
  if (level === 'error') process.stderr.write(`${prefix} ${args.map((a) => typeof a === 'object' ? (a.stack || a.message || JSON.stringify(a)) : a).join(' ')}\n`);
  else process.stdout.write(`${prefix} ${args.join(' ')}\n`);
}

module.exports = {
  debug: (...a) => write('debug', ...a),
  info: (...a) => write('info', ...a),
  warn: (...a) => write('warn', ...a),
  error: (...a) => write('error', ...a),
  setLevel: (l) => { minLevel = LEVELS[l] ?? 1; },
};
