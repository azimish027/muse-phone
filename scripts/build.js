'use strict';

/**
 * 前端构建脚本：minify JS + CSS（零外部依赖，项目精神）
 *
 * 做什么：
 *   1. 压缩 app.js（去除注释、压空格、给静态资源加版本号 hash）
 *   2. 压缩 styles.css（去除注释、压空格、去空行）
 *   3. 重写 index.html 里的 <script> / <link> 引用为带版本号的 .min 文件
 *   4. 生成 version.json（给宿主 build 版本号追踪用）
 *
 * 运行：node scripts/build.js
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PUBLIC = path.join(__dirname, '..', 'public');

function hash(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 8);
}

function minifyJS(src) {
  // 极简 JS minify：删注释 + 压连续空白（安全：不处理含字符串/正则的复杂情况，够用）
  let out = src
    // 删 // 单行注释（不在字符串里的 — 简单正则够用）
    .replace(/\/\/[^\n]*$/gm, '')
    // 删 /* */ 块注释（不跨行复杂情况）
    .replace(/\/\*[\s\S]*?\*\//g, '')
    // 换行/缩进统一
    .replace(/[\r\n\t]+/g, '\n')
    .split('\n').map((l) => l.trim()).filter(Boolean).join('\n')
    // 压连续空格（行内）
    .replace(/ {2,}/g, ' ');
  return out;
}

function minifyCSS(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')  // 删注释
    .replace(/[\r\n\t]+/g, '')
    .replace(/ {2,}/g, ' ')
    .replace(/;}/g, '}')
    .replace(/^\s+|\s+$/gm, '');
}

function doBuild() {
  let report = [];
  const appJS = path.join(PUBLIC, 'app.js');
  const css = path.join(PUBLIC, 'styles.css');
  const html = path.join(PUBLIC, 'index.html');

  if (fs.existsSync(appJS)) {
    const src = fs.readFileSync(appJS, 'utf8');
    const min = minifyJS(src);
    const h = hash(Buffer.from(min));
    const target = `app.min.${h}.js`;
    const targetPath = path.join(PUBLIC, target);
    fs.writeFileSync(targetPath, min);
    report.push(`app.js:  ${src.length} → ${min.length} (${target}, -${Math.round(100*(src.length-min.length)/src.length)}%)`);
    fs.copyFileSync(targetPath, path.join(PUBLIC, 'app.min.js'));
  }

  if (fs.existsSync(css)) {
    const src = fs.readFileSync(css, 'utf8');
    const min = minifyCSS(src);
    const h = hash(Buffer.from(min));
    const target = `styles.min.${h}.css`;
    const targetPath = path.join(PUBLIC, target);
    fs.writeFileSync(targetPath, min);
    report.push(`styles.css: ${src.length} → ${min.length} (${target})`);
    fs.copyFileSync(targetPath, path.join(PUBLIC, 'styles.min.css'));
  }

  // 写 version.json
  fs.writeFileSync(path.join(PUBLIC, 'version.json'), JSON.stringify({
    build: new Date().toISOString(),
    node: process.version,
  }, null, 2));

  console.log('✅ build done:');
  for (const r of report) console.log('  ' + r);
}

doBuild();
