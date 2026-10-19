/* ==========================================================================
   语缪 Musē Phōnē · 缪斯的语言集市 —— 忒拉蓬出品 · 前端应用（原生 SPA，无构建依赖）
   ========================================================================== */
(function () {
  'use strict';

  const TOKEN_KEY = 'lingua_token';
  const MODULE_LABEL = {
    vocabulary: '单词记忆', grammar: '语法练习', speaking: '口语跟读', listening: '听力训练',
  };
  const MODULE_ICON = {
    vocabulary: '🧠', grammar: '🧩', speaking: '🗣️', listening: '👂',
  };
  const LANG_LABEL = { en: '英语', ja: '日语', ko: '韩语', zh: '中文' };

  const app = document.getElementById('app');
  const toastHost = document.getElementById('toast');
  const modalHost = document.getElementById('modal');

  const state = {
    user: null,
    words: [],
    route: '',
    meta: { title: '', sub: '' },
    reviewCount: 0,
    apps: null, // 从 apps.json 加载的子应用列表（懒加载，首次 render 时 fetch）
    social: null, // 社证明数字
  };

  /* ---------------------------------------------------------------- 埋点（轻量，零依赖） */
  // 生产接 Google Analytics / Plausible 时改这里；开发时只打 console
  function emit(event, props = {}) {
    const payload = { event, ts: Date.now(), route: state.route, ...props };
    if (typeof window !== 'undefined' && (window.DEBUG_ANALYTICS || location.hostname === 'localhost')) {
      // console.debug('[emit]', payload); // 开发时开
    }
    // 未来对接：window.plausible?.('CustomEvent', { props });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try { navigator.sendBeacon('/_collect', JSON.stringify(payload)); } catch {}
    }
  }

  /* ---------------------------------------------------------------- 基础工具 */

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t) { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }

  // ====== 静态部署模式 Mock 数据（后端没跑时自动启用）======
  const MOCK_USER = {
    user: {
      id: 'demo-001',
      email: 'demo@musarches.local',
      username: '缪斯旅人',
      profile: { onboarded: true, lang: 'zh-CN', avatar: '', bio: '欢迎来到缪萨克斯集市！' },
      xp: 1280, level: 5, streak: 7,
      stats: { levelProgress: 0.35, todayMinutes: 45, totalMinutes: 1280, streakDays: 7 },
    }
  };
  const STATIC_MOCK_ENDPOINTS = new Set(['/api/auth/me', '/api/path/today', '/api/progress/overview', '/api/courses', '/api/achievements', '/api/profile']);

  async function api(path, method = 'GET', body) {
    const headers = {};
    const token = getToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(path, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      // 网络失败 → 看是不是 mock 过的端点
      if (STATIC_MOCK_ENDPOINTS.has(path) && method === 'GET') {
        console.warn('🔌 后端不可达，启用静态 Mock:', path);
        return MOCK_USER;
      }
      throw new Error('网络请求失败 — 后端服务未启动');
    }
    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }
    if (!res.ok) {
      // 404 / 401 等 → mock 一下静态部署
      if (STATIC_MOCK_ENDPOINTS.has(path) && method === 'GET') {
        console.warn('🔌 后端返回', res.status, '，启用静态 Mock:', path);
        return MOCK_USER;
      }
      if (res.status === 401) { setToken(''); state.user = null; }
      throw new Error((data && data.error) || `请求失败（${res.status}）`);
    }
    if (data == null) {
      throw new Error('服务器未返回有效数据');
    }
    return data;
  }

  function toast(msg, kind = '') {
    const node = document.createElement('div');
    node.className = 'toast ' + kind;
    node.innerHTML = `<span>${esc(msg)}</span>`;
    toastHost.appendChild(node);
    setTimeout(() => {
      node.style.transition = 'opacity .3s, transform .3s';
      node.style.opacity = '0';
      node.style.transform = 'translateX(18px)';
      setTimeout(() => node.remove(), 320);
    }, 2800);
  }

  function openModal(html, onMount) {
    modalHost.hidden = false;
    modalHost.innerHTML = `<div class="modal-backdrop" data-close="1"></div>
      <div class="modal-card">
        <button class="btn btn-sm btn-ghost modal-close" data-close="1">✕</button>
        ${html}
      </div>`;
    qsa('[data-close]', modalHost).forEach((n) => n.addEventListener('click', closeModal));
    if (onMount) onMount(qs('.modal-card', modalHost));
  }
  function closeModal() { modalHost.hidden = true; modalHost.innerHTML = ''; }

  function timeAgo(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return '刚刚';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
    if (diff < 86400 * 30) return Math.floor(diff / 86400) + ' 天前';
    return new Date(iso).toLocaleDateString('zh-CN');
  }

  function initials(name) { return String(name || '?').trim().slice(0, 2).toUpperCase(); }

  function avatar(user, size = 38) {
    const color = user.avatar_color || '#6366f1';
    const s = size ? `width:${size}px;height:${size}px;flex:0 0 ${size}px;font-size:${size * 0.36}px` : '';
    return `<div class="avatar" style="background:${color};${s}">${esc(initials(user.nickname))}</div>`;
  }

  /* ---------------------------------------------------------------- 语音能力 */

  let voices = [];
  function refreshVoices() { try { voices = window.speechSynthesis.getVoices() || []; } catch { voices = []; } }
  if ('speechSynthesis' in window) {
    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }

  function pickVoice(lang) {
    const want = String(lang || 'en-US').toLowerCase();
    const base = want.slice(0, 2);
    return voices.find((v) => v.lang.replace('_', '-').toLowerCase() === want)
      || voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(base))
      || null;
  }

  /** 朗读文本；返回 Promise，在朗读结束时 resolve */
  function speak(text, lang, opts = {}) {
    if (!('speechSynthesis' in window)) {
      toast('当前浏览器不支持语音朗读，请使用 Chrome / Edge', 'no');
      return Promise.resolve();
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text || ''));
    u.lang = lang || 'en-US';
    const v = pickVoice(u.lang);
    if (v) u.voice = v;
    u.rate = opts.rate || 0.92;
    u.pitch = opts.pitch ?? 1;
    return new Promise((resolve) => {
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }

  // 批次 3：绘本模式 emoji 关键词匹配
  function pictoStoryEmoji(phrase) {
    const p = String(phrase || '').toLowerCase();
    const map = [
      ['love|like|heart', '💕'],
      ['happy|glad|great|good', '😊'],
      ['sad|sorry|excuse', '😢'],
      ['water|rain|drink', '💧'],
      ['fire|hot|warm', '🔥'],
      ['book|read|study', '📖'],
      ['school|class|learn', '🏫'],
      ['morning|wake|up', '☀️'],
      ['night|sleep|bed', '🌙'],
      ['food|eat|hungry', '🍎'],
      ['family|mother|father|mom|dad', '👨‍👩‍👧'],
      ['friend|people|you', '👥'],
      ['time|clock|hour', '⏰'],
      ['money|dollar|buy', '💰'],
      ['work|job|busy', '💼'],
      ['home|house|room', '🏠'],
      ['car|drive|road', '🚗'],
      ['phone|call|ring', '📞'],
      ['music|song|listen', '🎵'],
      ['magic|spell|witch|wizard', '🪄'],
      ['cloud|sky|fly', '☁️'],
      ['star|dream|wish', '⭐'],
      ['tree|plant|garden', '🌳'],
    ];
    for (const [kw, e] of map) if (new RegExp(kw).test(p)) return e;
    return '📖';
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  /** 文本规范化，用于跟读评分 */
  function normalizeText(str, lang) {
    let s = String(str || '').toLowerCase().trim();
    if (['ja', 'ko', 'zh'].includes(lang)) {
      return s.replace(/[\s\u3000、。！？，・.,!?'"“”‘’…—\-·:;()（）\[\]]/g, '');
    }
    return s.replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ').trim();
  }

  /** 相似度 0~1（基于编辑距离） */
  function similarity(a, b) {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    const m = a.length, n = b.length;
    if (Math.abs(m - n) / Math.max(m, n) > 0.75) return 0;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
    }
    return 1 - dp[m][n] / Math.max(m, n);
  }

  function answerVariants(answer) {
    return String(answer || '').split(/\s*[|/]\s*/).map((s) => s.trim()).filter(Boolean);
  }

  function checkAnswer(input, answer, lang) {
    const target = answerVariants(answer);
    const given = normalizeText(input, lang);
    if (!given) return false;
    return target.some((t) => {
      const n = normalizeText(t, lang);
      return n === given || (n.length > 3 && similarity(n, given) >= 0.9);
    });
  }

  /* ---------------------------------------------------------------- 路由 */

  function navigate(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function parseRoute() {
    const raw = location.hash.replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean);
    return { name: parts[0] || 'home', param: parts[1] || null, parts };
  }

  window.addEventListener('hashchange', () => render());

  // 抽屉开关：手机端 hamburger 点开 sidebar 抽屉，点遮罩关闭
  // 每次 render 后调用 setupDrawer() 重新绑定（因为 innerHTML 会替换 DOM）
  function setupDrawer() {
    var root = document.getElementById("shell-root");
    if (!root) return;
    // 避免重复绑定
    if (root.__drawerBound) return;
    root.__drawerBound = true;
    // 打开
    root.querySelectorAll("[data-drawer]").forEach(function(btn) {
      btn.addEventListener("click", function(e) {
        e.stopPropagation();
        root.classList.toggle("drawer-open");
      });
    });
    // 点 sidebar 里的 nav-item 后自动关闭
    root.querySelectorAll(".sidebar .nav-item").forEach(function(item) {
      item.addEventListener("click", function() {
        root.classList.remove("drawer-open");
      });
    });
    // 点击遮罩（通过 ::after 伪元素实现）—— 用 document 级捕获
    document.addEventListener("click", function(e) {
      if (!root.classList.contains("drawer-open")) return;
      var sb = root.querySelector(".sidebar");
      if (sb && !sb.contains(e.target) && !e.target.closest("[data-drawer]")) {
        root.classList.remove("drawer-open");
      }
    }, { once: true }); // 每次 drawer 打开只绑定一次，避免累积
  }

  /* ---------------------------------------------------------------- 外壳 */

  // 核心导航（固定，不随 apps.json 变化）
  const CORE_NAV = [
    { id: 'home', icon: '🏠', label: '首页', title: '今日学习', sub: '个性化路径为你安排好了今天的任务' },
    { id: 'courses', icon: '📚', label: '课程', title: '分级课程', sub: '英语 · 日语 · 韩语，从 A1 到 B1 循序渐进' },
    { id: 'review', icon: '🔁', label: '复习', title: '单词复习', sub: '基于遗忘曲线的间隔重复记忆' },
    { id: 'community', icon: '💬', label: '社区', title: '学习社区', sub: '和同伴交流经验、互相激励' },
    { id: 'achievements', icon: '🏆', label: '成就', title: '成就殿堂', sub: '记录你的每一个里程碑' },
  ];
  const PROFILE_NAV = { id: 'profile', icon: '👤', label: '我的', title: '个人中心', sub: '学习数据与偏好设置' };

  // 向后兼容：旧版硬编码的时间块（在 apps.json 加载失败时兜底）
  const LEGACY_TIME = { id: 'time', icon: '⏰', label: '时间块', title: '精细时间管理', sub: '日/周双视图 · 拖拽创建 · 标签系统' };

  // 合并核心 NAV + 动态工具应用 + 我的
  function buildNAV() {
    let toolApps = [];
    if (state.apps && state.apps.length) {
      toolApps = state.apps
        .filter((a) => a.enabled !== false)
        .map((a) => ({
          id: a.id,
          icon: a.icon,
          label: a.name,
          title: a.name,
          sub: a.desc,
          _toolApp: true, // 标记这是个 iframe 工具应用
        }));
    } else {
      toolApps = [LEGACY_TIME]; // 兜底
    }
    return [...CORE_NAV, ...toolApps, PROFILE_NAV];
  }

  // 懒加载 apps.json（只 fetch 一次，失败则用兜底）
  async function ensureApps() {
    if (state.apps) return;
    try {
      const resp = await fetch('/apps.json?t=' + Date.now());
      if (!resp.ok) throw new Error('apps.json not found');
      const data = await resp.json();
      state.apps = data.apps || [];
    } catch {
      state.apps = []; // 兜底为空，buildNAV 会用 LEGACY_TIME
    }
  }

  // 通用 iframe 工具应用渲染器 —— 走统一 shell 骨架，iframe 放 .view 内
  function renderToolApp(conf) {
    const u = state.user;
    const stats = u.stats;
    const pct = Math.round((stats.levelProgress || 0) * 100);
    const active = state.route;
    const navHtml = buildNAV().map((n) => {
      const on = n.id === active || (active === 'course' && n.id === 'courses')
        || (active === 'lesson' && n.id === 'courses') || (active === 'post' && n.id === 'community');
      return `<a class="nav-item ${on ? 'on' : ''}" href="#/${n.id}">
        <span class="ni">${n.icon}</span><span class="label">${n.label}</span></a>`;
    }).join('');

    // 底部 tab bar（手机端）
    const tabHtml = CORE_NAV.map((n) => {
      const on = n.id === active || (active === 'course' && n.id === 'courses')
        || (active === 'lesson' && n.id === 'courses') || (active === 'post' && n.id === 'community');
      return `<a class="tab-item ${on ? 'on' : ''}" href="#/${n.id}">
        <span class="ti-ico">${n.icon}</span><span>${n.label}</span></a>`;
    }).join('');

    // 面包屑：首页 › 工具名
    const breadcrumb = `<button class="bc-home" title="返回首页" onclick="location.hash='#/home'">🏠 首页</button><span class="bc-sep">›</span><span class="bc-cur">${conf.icon} ${conf.name}</span>`;

    // iframe 放 view 里，自适应 topbar 以下剩余空间；无 inline style
    // 骨架屏先显示，iframe load 后自动隐藏
    const iframeHtml = `
      <div class="iframe-wrapper">
        <div class="iframe-skeleton" id="skeleton-${conf.id}">
          <div class="sk-line" style="width:60%"></div>
          <div class="sk-line" style="width:80%"></div>
          <div class="sk-block"></div>
          <div class="sk-block" style="width:40%"></div>
          <p class="sk-tip">正在打开 ${conf.name}… 首次加载可能需要 2-3 秒</p>
        </div>
        <iframe id="tool-iframe" class="tool-iframe" src="${conf.path}?v=${Date.now()}" allow="clipboard-read; clipboard-write"
                onload="(function(){var s=document.getElementById('skeleton-${conf.id}');if(s){s.style.display='none'}})()"></iframe>
      </div>`;

    // postMessage 双向桥
    const bridgeSetup = `
      (function(){
        var iframe = document.getElementById('tool-iframe');
        if (!iframe) return;
        // ① iframe 就绪后发启动上下文（包含用户 token，方便 deplatform 子应用拿）
        iframe.addEventListener('load', function(){
          try {
            iframe.contentWindow.postMessage({
              type: 'tool-market',
              host: '语缪',
              theme: 'notion-minimal',
              appId: '${conf.id}',
              token: localStorage.getItem('lingua_token') || null,
              user: ${JSON.stringify({ nickname: u.nickname, level: stats.level })},
            }, '*');
          } catch(e){}
        }, { once: true });
        // ② 监听 iframe 发来的 back / title 请求
        window.addEventListener('message', function(evt){
          var d = evt.data; if (!d || typeof d !== 'object') return;
          if (d.type === 'back') { history.length > 1 ? history.back() : (location.hash = '#/home'); }
          if (d.type === 'title' && d.text) {
            var h1 = document.querySelector('.topbar h1'); if (h1) h1.textContent = d.text;
          }
        });
      })();`;

    app.innerHTML = `
      <div class="shell tool-mode" id="shell-root">
        <aside class="sidebar">
          <div class="brand-mark brand-sun-mark">
  <svg viewBox="0 0 48 48" width="28" height="28">
    <circle cx="24" cy="24" r="14" fill="none" stroke="#C45A3B" stroke-width="2.5"/>
    <circle cx="24" cy="24" r="8.5" fill="none" stroke="#9B7B9F" stroke-width="1.5"/>
    <g stroke="#C45A3B" stroke-width="2" stroke-linecap="butt">
      <line x1="24" y1="5" x2="24" y2="10"/>
      <line x1="24" y1="38" x2="24" y2="43"/>
      <line x1="5" y1="24" x2="10" y2="24"/>
      <line x1="38" y1="24" x2="43" y2="24"/>
    </g>
  </svg>
  <span class="brand-name-short">语缪</span>
</div>
          <nav class="nav">${navHtml}</nav>
          <div class="sidebar-foot">
            <div class="user-chip" data-nav="#/profile">
              ${avatar(u)}
              <div><div class="u-name">${esc(u.nickname)}</div><div class="u-sub">Lv.${stats.level} ${esc(stats.levelTitle || '')}</div></div>
            </div>
          </div>
        </aside>
        <main class="main">
          <header class="topbar tool-topbar">
            <button class="hamburger" aria-label="打开菜单" data-drawer>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div class="bc">${breadcrumb}</div>
            <div class="topbar-spacer"></div>
            <button class="back-btn" title="返回上一页" onclick="history.length>1?history.back():(location.hash='#/home')">← 返回</button>
          </header>
          <div class="view tool-view">${iframeHtml}</div>
        </main>
        <nav class="tab-bar">${tabHtml}</nav>
        <script>${bridgeSetup}<\/script>
      </div>`;

    // drawer 逻辑
    setTimeout(() => setupDrawer(), 0);
  }

  function shell(viewHtml) {
    const u = state.user;
    const stats = u.stats;
    const pct = Math.round((stats.levelProgress || 0) * 100);
    const active = state.route;
    const navHtml = buildNAV().map((n) => {
      const on = n.id === active || (active === 'course' && n.id === 'courses')
        || (active === 'lesson' && n.id === 'courses') || (active === 'post' && n.id === 'community');
      const badge = n.id === 'review' && state.reviewCount > 0
        ? `<span class="badge">${state.reviewCount}</span>` : '';
      return `<a class="nav-item ${on ? 'on' : ''}" href="#/${n.id}">
        <span class="ni">${n.icon}</span><span class="label">${n.label}</span>${badge}</a>`;
    }).join('');

    // 底部 tab bar（手机端 5 项核心导航）
    const tabHtml = CORE_NAV.map((n) => {
      const on = n.id === active || (active === 'course' && n.id === 'courses')
        || (active === 'lesson' && n.id === 'courses') || (active === 'post' && n.id === 'community');
      const badge = n.id === 'review' && state.reviewCount > 0
        ? `<span class="tab-badge">${state.reviewCount}</span>` : '';
      return `<a class="tab-item ${on ? 'on' : ''}" href="#/${n.id}">
        <span class="ti-ico">${n.icon}</span><span>${n.label}</span>${badge}</a>`;
    }).join('');

    app.innerHTML = `
      <div class="shell" id="shell-root">
        <aside class="sidebar">
          <div class="brand-mark brand-sun-mark">
  <svg viewBox="0 0 48 48" width="28" height="28">
    <circle cx="24" cy="24" r="14" fill="none" stroke="#C45A3B" stroke-width="2.5"/>
    <circle cx="24" cy="24" r="8.5" fill="none" stroke="#9B7B9F" stroke-width="1.5"/>
    <g stroke="#C45A3B" stroke-width="2" stroke-linecap="butt">
      <line x1="24" y1="5" x2="24" y2="10"/>
      <line x1="24" y1="38" x2="24" y2="43"/>
      <line x1="5" y1="24" x2="10" y2="24"/>
      <line x1="38" y1="24" x2="43" y2="24"/>
    </g>
  </svg>
  <span class="brand-name-short">语缪</span>
</div>
          <nav class="nav">${navHtml}</nav>
          <div class="sidebar-foot">
            <div class="user-chip" data-nav="#/profile">
              ${avatar(u)}
              <div>
                <div class="u-name">${esc(u.nickname)}</div>
                <div class="u-sub">Lv.${stats.level} ${esc(stats.levelTitle)}</div>
              </div>
            </div>
          </div>
        </aside>
        <main class="main">
          <header class="topbar">
            <button class="hamburger" aria-label="打开菜单" data-drawer>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div>
              <h1>${esc(state.meta.title)}</h1>
              <div class="sub">${esc(state.meta.sub)}</div>
            </div>
            <div class="topbar-spacer"></div>
            <div class="stat-chips">
              <div class="stat-chip xp" title="累计经验值">⭐ <span class="v">${stats.xp}</span> XP</div>
              <div class="stat-chip flame" title="连续学习天数">🔥 <span class="v">${stats.streak}</span> 天</div>
              <div class="stat-chip hide-sm" title="累计学习时长">⏱ <span class="v">${Math.round(stats.total_minutes)}</span> 分钟</div>
            </div>
            <div class="level-ring" style="--p:${pct}" title="等级进度 ${pct}%">
              <span>Lv.${stats.level}</span>
            </div>
          </header>
          <div class="view" id="view">${viewHtml}</div>
        </main>
        <nav class="tab-bar">${tabHtml}</nav>
      </div>`;

    // 抽屉逻辑（hamburger + 点击遮罩关闭）
    setTimeout(() => setupDrawer(), 0);
  }

  function setView(html) { const v = document.getElementById('view'); if (v) v.innerHTML = html; }

  /* ---------------------------------------------------------------- 登录 / 注册 */

  let authMode = 'login';
  let authLang = 'en';

  function renderAuth() {
    app.innerHTML = `
      <div class="auth-wrap">

        <!-- ========== 左栏：Hero + Feature Grid + Stats ========== -->
        <section class="auth-hero">
          <!-- 装饰：角落的太阳光晕圆圈 -->
          <div class="auth-deco auth-deco-sun"></div>
          <div class="auth-deco auth-deco-ring"></div>
          <div class="auth-deco auth-deco-line"></div>

          <!-- 顶部小标签 -->
          <div class="auth-topbar">
            <svg class="brand-sun-logo" viewBox="0 0 100 100" width="28" height="28">
              <circle cx="50" cy="50" r="28" fill="none" stroke="#C45A3B" stroke-width="5"/>
              <circle cx="50" cy="50" r="17" fill="none" stroke="#9B7B9F" stroke-width="3"/>
              <g stroke="#C45A3B" stroke-width="3.5" stroke-linecap="butt">
                <line x1="50" y1="8"  x2="50" y2="16"/>
                <line x1="50" y1="84" x2="50" y2="92"/>
                <line x1="8"  y1="50" x2="16" y2="50"/>
                <line x1="84" y1="50" x2="92" y2="50"/>
              </g>
            </svg>
            <span class="brand-chip">忒拉蓬 Therapōn Musarches</span>
            <span class="brand-dot">·</span>
            <span class="brand-chip-sub">By azimish</span>
          </div>

          <!-- 大 Hero 标题区 -->
          <div class="auth-hero-body">
            <p class="hero-kicker">缪 斯 的 语 言 集 市</p>
            <h1 class="brand-name">缪萨克斯<span class="brand-name-accent">集市</span><em>Musarches Fair</em></h1>
            <p class="hero-slogan">在一个铺子里，逛完语言学习的全部工具</p>
            <p class="hero-sublog">从分级课程到咒语游戏，从时间管理到心流冥想 — 它们共用同一个账户、同一个进度、同一个你。</p>

            <!-- 语言选择 pill -->
            <div class="lang-pills">
              <span class="lang-pills-label">选一门开始：</span>
              <button data-lang="en" class="lang-pill ${authLang==='en'?'on':''}">🇬🇧 English</button>
              <button data-lang="ja" class="lang-pill ${authLang==='ja'?'on':''}">🇯🇵 日本語</button>
              <button data-lang="ko" class="lang-pill ${authLang==='ko'?'on':''}">🇰🇷 한국어</button>
            </div>
          </div>

          <!-- 复古分隔线 -->
          <div class="auth-divider"><span></span><svg viewBox="0 0 60 12" width="48"><path d="M0 6 L52 6 M48 3 L54 6 L48 9" stroke="#C45A3B" stroke-width="2" fill="none" stroke-linecap="round"/></svg><span></span></div>

          <!-- Feature Grid（4 个卖点） -->
          <div class="feature-grid">
            <div class="feature-card">
              <div class="feature-ico">📘</div>
              <div class="feature-name">分级课程</div>
              <div class="feature-sub">A1 → B1 · 每节课 5 分钟</div>
              <div class="feature-why">从入门到进阶，每一步都有明确目标，学完能立刻开口。</div>
            </div>
            <div class="feature-card">
              <div class="feature-ico">🏹</div>
              <div class="feature-name">猎语征途</div>
              <div class="feature-sub">念英语咒语 · 击败小妖怪</div>
              <div class="feature-why">学英语的最大敌人是无聊 — 把短语变成魔法，把句子变成武器。</div>
            </div>
            <div class="feature-card">
              <div class="feature-ico">⏳</div>
              <div class="feature-name">时之砂刻</div>
              <div class="feature-sub">日周双视图 · 落砂成羽之刻</div>
              <div class="feature-why">一眼看清时间去哪了，把每一天都变成可测量的修行。</div>
            </div>
            <div class="feature-card">
              <div class="feature-ico">🌌</div>
              <div class="feature-name">星空梦想乡</div>
              <div class="feature-sub">星球陪伴你的心流冥想</div>
              <div class="feature-why">让大脑降温。不只是语言工具 — 是你照顾自己的地方。</div>
            </div>
          </div>

          <!-- Stats Strip（社会证明 · 故意一眼假的数字） -->
          <div class="stats-strip">
            <div class="stat-cell">
              <div class="stat-num">12345</div>
              <div class="stat-label">正在逛集市的人</div>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-cell">
              <div class="stat-num">2222</div>
              <div class="stat-label">今天新加入</div>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-cell">
              <div class="stat-num">3</div>
              <div class="stat-label">语言 · 完整课程</div>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-cell">
              <div class="stat-num">∞</div>
              <div class="stat-label">免费 · 不追踪 · 不卖</div>
            </div>
          </div>

          <!-- 底部链接 -->
          <div class="hero-footer-links">
            <a data-action="about">🏛️ 忒拉蓬 · 关于</a>
            <span class="hf-dot">·</span>
            <a data-action="privacy">🔒 隐私</a>
            <span class="hf-dot">·</span>
            <a data-action="azimish">By azimish</a>
          </div>
        </section>

        <!-- ========== 右栏：登录 / 注册 ========== -->
        <section class="auth-panel">
          <div class="auth-card">
            <div class="auth-card-head">
              <div class="auth-card-title">进入集市</div>
              <div class="auth-card-sub">已有账号？登录继续。没有？30 秒创建。</div>
            </div>
            <div class="auth-tabs">
              <button data-mode="login" class="${authMode === 'login' ? 'on' : ''}">登录</button>
              <button data-mode="register" class="${authMode === 'register' ? 'on' : ''}">注册</button>
            </div>
            <div id="auth-fields"></div>
            <div class="form-error" id="auth-error"></div>
            <button class="btn btn-primary btn-block btn-lg auth-submit-btn" id="auth-submit">
              ${authMode === 'login' ? '立刻开始学习 →' : '创建账号并开始 →'}
            </button>
            <div class="auth-or-line"><span>或</span></div>
            <p class="form-hint">演示账号：<b>linxiaoyu@example.com</b> / <b>demo1234</b> · 直接体验</p>
          </div>
          <div class="auth-panel-foot">
            缪萨克斯集市 Musarches Fair · 忒拉蓬出品 · © ${new Date().getFullYear()}
          </div>
        </section>

      </div>`;

    renderAuthFields();

    qsa('[data-mode]', app).forEach((b) => b.addEventListener('click', () => {
      authMode = b.dataset.mode;
      renderAuth();
    }));

    qsa('.lang-pill[data-lang]', app).forEach((b) => b.addEventListener('click', () => {
      authLang = b.dataset.lang;
      renderAuth();
    }));

    qs('#auth-submit', app).addEventListener('click', submitAuth);
    qs('#auth-fields', app).addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAuth(); });

    // About / Privacy modal（忒拉蓬故事）
    qsa('[data-action]', app).forEach((a) => a.addEventListener('click', () => {
      const action = a.dataset.action;
      if (action === 'about') showAbout();
      else if (action === 'privacy') showPrivacy();
      else if (action === 'azimish') showAzimish();
    }));
  }

  function showAbout() {
    modalHost.innerHTML = `
      <div class="modal-box">
        <h2>🏛️ 忒拉蓬 Therapōn Musarches</h2>
        <p class="card-sub" style="margin-bottom:16px">缪斯的大祭司侍从团</p>
        <p>忒拉蓬 <em>Therapōn</em> + <em>Musarches</em>，来自希腊语。</p>
        <ul style="padding-left:20px;line-height:1.8">
          <li><b>Therapōn</b> — 侍从、追随者、专司某神仪式的人</li>
          <li><b>Musarches</b> — 缪斯之首、大祭司、主持艺术与仪式的人</li>
        </ul>
        <p style="margin-top:16px">这不是一个人，是一个<strong>集体</strong> — <b>azimish</b> 和 AI 协作组建的工作室。我们共同服务于缪斯的技艺，为你做语言学习工具。</p>
        <p style="margin-top:12px">语缪 Musē Phōnē 是忒拉蓬的第一个品牌。未来还会有更多。</p>
        <div style="text-align:right;margin-top:20px"><button class="btn" onclick="document.getElementById('modal').innerHTML=''">好</button></div>
      </div>`;
  }
  function showPrivacy() {
    modalHost.innerHTML = `
      <div class="modal-box">
        <h2>🔒 隐私政策</h2>
        <p class="card-sub" style="margin-bottom:16px">简单、透明、可理解</p>
        <ul style="padding-left:20px;line-height:1.8">
          <li>我们不收集任何你没主动填的信息</li>
          <li>学习数据存在你自己的浏览器和我们的 SQLite 数据库里</li>
          <li>不追踪、不分析、不导出、不卖</li>
          <li>子应用（Hunter Quest / 时之砂刻 / 星空梦想乡）与宿主同域，不发送数据到任何第三方</li>
          <li>密码永远是 hash，明文字符串不会存储</li>
        </ul>
        <div style="text-align:right;margin-top:20px"><button class="btn" onclick="document.getElementById('modal').innerHTML=''">好</button></div>
      </div>`;
  }
  function showAzimish() {
    modalHost.innerHTML = `
      <div class="modal-box">
        <h2>👤 azimish</h2>
        <p class="card-sub" style="margin-bottom:16px">个人协作体 · 忒拉蓬所属</p>
        <p>azimish 是我的个人名。我和多个 AI 协作组建了忒拉蓬工作室，正在做一系列面向语言学习者的小工具。</p>
        <p style="margin-top:12px">如果你想联系我或者一起做点什么 — 私信就行。</p>
        <div style="text-align:right;margin-top:20px"><button class="btn" onclick="document.getElementById('modal').innerHTML=''">好</button></div>
      </div>`;
  }

  function renderAuthFields() {
    const box = qs('#auth-fields', app);
    if (authMode === 'login') {
      box.innerHTML = `
        <div class="field"><label>邮箱</label>
          <input class="input" id="f-email" type="email" placeholder="you@example.com" autocomplete="email" /></div>
        <div class="field"><label>密码</label>
          <input class="input" id="f-password" type="password" placeholder="至少 6 位" autocomplete="current-password" /></div>`;
    } else {
      box.innerHTML = `
        <div class="field"><label>昵称</label>
          <input class="input" id="f-nickname" placeholder="给自己起个名字" /></div>
        <div class="field"><label>邮箱</label>
          <input class="input" id="f-email" type="email" placeholder="you@example.com" autocomplete="email" /></div>
        <div class="field"><label>密码</label>
          <input class="input" id="f-password" type="password" placeholder="至少 6 位" autocomplete="new-password" /></div>`;
    }
  }

  async function submitAuth() {
    const errBox = qs('#auth-error', app);
    errBox.textContent = '';
    const btn = qs('#auth-submit', app);
    const email = (qs('#f-email', app) || {}).value || '';
    const password = (qs('#f-password', app) || {}).value || '';
    const nickname = (qs('#f-nickname', app) || {}).value || '';
    btn.disabled = true;
    btn.textContent = '处理中…';
    try {
      const payload = authMode === 'login'
        ? { email, password }
        : { email, password, nickname };
      const out = await api('/api/auth/' + authMode, 'POST', payload);
      setToken(out.token);
      state.user = out.user;
      const onboarded = out.user?.profile?.onboarded ?? false;
      toast(authMode === 'login' ? `欢迎回来，${out.user.nickname}` : '注册成功，开始你的语言之旅！', 'ok');
      navigate(onboarded ? '#/home' : '#/onboarding');
    } catch (e) {
      errBox.textContent = e.message;
      btn.disabled = false;
      btn.textContent = authMode === 'login' ? '进入学习空间' : '创建账号并开始学习';
    }
  }

  /* ---------------------------------------------------------------- 新手引导 */

  const LANG_META = {
    en: { name: '英语', flag: '🇬🇧' },
    ja: { name: '日语', flag: '🇯🇵' },
    ko: { name: '韩语', flag: '🇰🇷' },
  };

  function renderOnboarding() {
    const p = state.user.profile;
    const chosen = new Set(p.target_langs && p.target_langs.length ? p.target_langs : ['en']);
    app.innerHTML = `
      <div class="auth-wrap" style="grid-template-columns:1fr">
        <section class="auth-panel">
          <div class="auth-card" style="width:min(560px,94vw)">
            <h2 style="margin:0 0 6px">定制你的学习方案</h2>
            <p class="card-sub" style="margin-bottom:22px">选择想学的语言与当前水平，系统会据此推荐每日学习路径。</p>

            <div class="field">
              <label>我想学习（可多选）</label>
              <div class="tabs" id="ob-langs">
                ${Object.entries(LANG_META).map(([code, m]) =>
                  `<button class="tab ${chosen.has(code) ? 'on' : ''}" data-lang="${code}">${m.flag} ${m.name}</button>`).join('')}
              </div>
            </div>
            <div class="field">
              <label>我的水平</label>
              <select class="select" id="ob-level">
                ${['A1', 'A2', 'B1', 'B2'].map((l) =>
                  `<option value="${l}" ${p.placement === l ? 'selected' : ''}>${l} · ${
                    { A1: '零基础 / 入门', A2: '能简单交流', B1: '能日常对话', B2: '能深入讨论' }[l]}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>每日学习目标</label>
              <select class="select" id="ob-goal">
                ${[10, 20, 30, 45, 60].map((g) =>
                  `<option value="${g}" ${(p.daily_goal_min || 20) === g ? 'selected' : ''}>${g} 分钟 / 天</option>`).join('')}
              </select>
            </div>
            <button class="btn btn-primary btn-block btn-lg" id="ob-submit" style="margin-top:8px">开始沉浸式学习</button>
          </div>
        </section>
      </div>`;

    qsa('#ob-langs .tab', app).forEach((b) => b.addEventListener('click', () => {
      const code = b.dataset.lang;
      if (chosen.has(code)) { if (chosen.size > 1) chosen.delete(code); }
      else chosen.add(code);
      b.classList.toggle('on', chosen.has(code));
    }));

    qs('#ob-submit', app).addEventListener('click', async () => {
      try {
        const out = await api('/api/profile/onboarding', 'POST', {
          target_langs: [...chosen],
          placement: qs('#ob-level', app).value,
          daily_goal_min: Number(qs('#ob-goal', app).value),
        });
        state.user = out.user;
        toast('方案已生成，开始今天的学习吧！', 'ok');
        navigate('#/home');
      } catch (e) { toast(e.message, 'no'); }
    });
  }

  /* ---------------------------------------------------------------- 首页仪表盘 */

  async function renderHome() {
    // 加载 apps.json（工具摊位）
    let apps = [];
    try {
      const resp = await fetch('/apps.json?t=' + Date.now());
      if (resp.ok) { const j = await resp.json(); apps = (j.apps || []).filter(a => a.enabled); }
    } catch(e) { apps = []; }

    state.meta = CORE_NAV[0];
    setView('<div class="empty"><span class="ico">⏳</span>正在生成今日学习路径…</div>');
    const [path, prog] = await Promise.all([
      api('/api/path/today'),
      api('/api/progress/overview'),
    ]);
    state.reviewCount = path.goal ? (path.tasks.find((t) => t.kind === 'review') || {}).count || 0 : 0;
    state.user.stats = { ...state.user.stats, ...path.stats };
    refreshShellChrome();

    const u = state.user;
    const t = prog.today;
    const s = prog.stats;

    const taskHtml = path.tasks.length ? path.tasks.map((task) => `
      <div class="plan-item" data-nav="${esc(task.href)}">
        <div class="pi">${task.icon}</div>
        <div style="flex:1">
          <div class="pt">${esc(task.title)}</div>
          ${task.subtitle ? `<div class="pr">${esc(task.subtitle)}</div>` : ''}
          <div class="pr" style="margin-top:4px;color:var(--text-faint)">${esc(task.reason)}</div>
          <div class="pm"><span>⏱ 约 ${task.minutes} 分钟</span><span>⭐ +${task.xp} XP</span>
            ${task.moduleLabel ? `<span>${MODULE_ICON[task.module] || ''} ${esc(task.moduleLabel)}</span>` : ''}</div>
        </div>
        <div class="go">›</div>
      </div>`).join('') : `<div class="empty"><span class="ico">🎉</span>今天的任务都完成啦，明天继续！</div>`;

    const langHtml = prog.languages.length ? prog.languages.map((l) => `
      <div class="row" style="gap:14px">
        <div style="font-size:1.5rem">${l.flag}</div>
        <div style="flex:1">
          <div class="row" style="justify-content:space-between">
            <span style="font-weight:640">${esc(l.name)}</span>
            <span style="font-size:.78rem;color:var(--text-faint)">${l.completed}/${l.total} 课</span>
          </div>
          <div class="progress thin" style="margin-top:7px"><i style="width:${l.percent}%"></i></div>
        </div>
      </div>`).join('') : '<div class="card-sub">还没有学习记录，去课程页开始第一节课吧。</div>';

    const modHtml = prog.modules.map((m) => `
      <div style="margin-bottom:14px">
        <div class="row" style="justify-content:space-between;margin-bottom:6px">
          <span style="font-size:.86rem">${MODULE_ICON[m.module]} ${esc(m.label)}</span>
          <span style="font-size:.78rem;color:var(--text-faint)">
            ${m.accuracy === null ? '暂无数据' : `准确率 ${m.accuracy}%`} · 完成 ${m.lessons} 课</span>
        </div>
        <div class="progress thin ${m.module === 'speaking' ? 'gold' : m.module === 'listening' ? 'cool' : 'green'}">
          <i style="width:${m.accuracy === null ? 0 : m.accuracy}%"></i></div>
      </div>`).join('');

    const heat = prog.days.map((d) => {
      const lvl = d.minutes >= 30 ? 'l4' : d.minutes >= 15 ? 'l3' : d.minutes >= 5 ? 'l2' : d.minutes > 0 ? 'l1' : '';
      return `<div class="heat-cell ${lvl}" title="${d.date} · ${d.minutes} 分钟 · ${d.xp} XP"></div>`;
    }).join('');

    setView(`
      <div class="stack">

        
        <!-- ========== 品牌 Banner（集市入口） ========== -->
        <div class="market-banner">
          <svg class="market-banner-sun" viewBox="0 0 100 100" width="56" height="56">
            <circle cx="50" cy="50" r="26" fill="none" stroke="#C45A3B" stroke-width="5"/>
            <circle cx="50" cy="50" r="15" fill="none" stroke="#9B7B9F" stroke-width="3"/>
            <path d="M 41 47 Q 50 53 59 47" fill="none" stroke="#C45A3B" stroke-width="3.5" stroke-linecap="round"/>
            <path d="M 41 53 Q 50 47 59 53" fill="none" stroke="#9B7B9F" stroke-width="2.5" stroke-linecap="round"/>
            <g stroke="#C45A3B" stroke-width="3" stroke-linecap="butt">
              <line x1="50" y1="8"  x2="50" y2="16"/>
              <line x1="50" y1="84" x2="50" y2="92"/>
              <line x1="8"  y1="50" x2="16" y2="50"/>
              <line x1="84" y1="50" x2="92" y2="50"/>
            </g>
          </svg>
          <div class="market-banner-title">语缪 · Musē Phōnē</div>
          <div class="market-banner-sub">缪 斯 的 语 言 集 市</div>
          <div class="market-banner-stats">
            <span class="market-stat">🔥 连续 ${s.streak} 天</span>
            <span class="market-stat">📖 ${prog.totals.lessonsCompleted || 0} 课</span>
            <span class="market-stat">⚡ ${t.xp} XP</span>
          </div>
          <div class="market-banner-by">By azimish · 忒拉蓬 Therapōn Musarches 出品</div>
        </div>

        <!-- ========== 工具摊位（三个） ========== -->
        ${apps.length ? `<div class="grid cols-3" style="gap:var(--sp-3)">${apps.map(a => `
          <button class="tool-card market-stall" data-nav="#${a.id}" data-app="${esc(a.id)}">
            <img class="tool-card-cover" src="${a.cover || ''}" alt="${esc(a.name)}"
                 width="640" height="360"
                 onerror="this.style.background='#EDE4D3';this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 640 360%22><rect width=%22640%22 height=%22360%22 fill=%22%23F5EFE6%22/><text x=%22320%22 y=%22200%22 font-size=%2280%22 text-anchor=%22middle%22>${a.icon}</text></svg>'">
            <div class="tool-card-info">
              <div class="tool-card-name">${a.icon} ${esc(a.name)}</div>
              ${a.name_zh ? `<div class="tool-card-zh">${esc(a.name_zh)}</div>` : ''}
              <div class="tool-card-desc">${esc(a.desc)}</div>
              ${a.why ? `<div class="tool-card-why">💡 ${esc(a.why)}</div>` : ''}
            </div>
          </button>`).join('')}</div>` : ''}

<!-- ① 今日路径（顶部主视觉，全宽） -->
        <div class="card pad-lg">
          <div class="section-head">
            <h2>📅 今日路径</h2>
            <div class="spacer"></div>
            <span class="pill brand">✨ 个性化推荐</span>
          </div>
          <p class="card-sub" style="margin-bottom:14px">${esc(path.motivation)}</p>
          <div class="stack" style="gap:12px">${taskHtml}</div>
        </div>

        <!-- ② 修炼仪表盘（目标环 + 4 指标 + 热力图 三合一） -->
        <div class="grid cols-2" style="align-items:start">
          <div class="card pad-lg">
            <div class="section-head">
              <h2>🎯 修炼仪表盘</h2>
              <div class="spacer"></div>
              <span class="pill gold">🔥 连续 ${s.streak} 天</span>
            </div>
            <div class="grid cols-2" style="align-items:center">
              <div style="text-align:center">
                <div class="goal-ring" style="--p:${t.goalPercent}">
                  <div class="inner"><b>${t.minutes}<small style="font-size:.9rem">′</small></b><span>/ ${t.goal} 分钟</span></div>
                </div>
                <div style="margin-top:12px;font-weight:700;color:var(--text)">今日 ${t.goalPercent}% · ${t.sessions || 0} 次</div>
              </div>
              <div class="grid cols-2" style="gap:14px">
                <div class="metric"><span class="k">最高连续</span><span class="v">${s.best_streak}<small>天</small></span></div>
                <div class="metric"><span class="k">今日 XP</span><span class="v">${t.xp}<small></small></span></div>
                <div class="metric"><span class="k">完成课节</span><span class="v">${prog.totals.lessonsCompleted}<small>节</small></span></div>
                <div class="metric"><span class="k">掌握单词</span><span class="v">${prog.totals.wordsMastered}<small>个</small></span></div>
              </div>
            </div>
            <div class="divider"></div>
            <div class="card-sub" style="margin-bottom:10px">最近 30 天修炼</div>
            <div class="heatmap">${heat}</div>
            <div class="heat-legend">
              <span>少</span><i style="background:#F0EAE2"></i>
              <i style="background:rgba(155,139,240,0.35)"></i>
              <i style="background:rgba(155,139,240,0.58)"></i>
              <i style="background:rgba(155,139,240,0.80)"></i>
              <i style="background:var(--grad-brand)"></i>
              <span>多</span>
            </div>
          </div>

          <!-- ③ 社区动态 + 复习入口 -->
          <div class="stack">
            <div class="card pad-lg" id="home-community">
              <div class="section-head">
                <h2>💬 社区动态</h2>
                <div class="spacer"></div>
                <span class="pill cyan">共学更有动力</span>
              </div>
              <div id="home-posts"><div class="card-sub">加载中…</div></div>
            </div>
            <div class="card pad-lg" style="display:flex;gap:var(--sp-4);align-items:center">
              <div style="font-size:2rem">📚</div>
              <div style="flex:1">
                <div class="card-title">复习</div>
                <div class="card-sub">${prog.totals.wordsDue} 个单词到期待复习 · 共 ${prog.totals.wordsTotal} 个在记忆库</div>
              </div>
              <button class="btn btn-primary" data-nav="#/review">去复习</button>
            </div>
          </div>
        </div>

        <!-- ④ 语言进度（全宽） -->
        <div class="card pad-lg">
          <div class="section-head">
            <h2>🗣️ 语言进度</h2>
            <div class="spacer"></div>
            <button class="btn btn-sm btn-ghost" data-nav="#/courses">浏览全部 ›</button>
          </div>
          <div class="grid cols-3">${langHtml}</div>
        </div>

      </div>`);

    try {
      const posts = await api('/api/community/posts?limit=3');
      const box = qs('#home-posts');
      if (box) {
        box.innerHTML = posts.posts.map((p) => `
          <div class="plan-item" data-nav="#/post/${p.id}" style="margin-bottom:10px">
            ${avatar({ nickname: p.author, avatar_color: p.avatar_color }, 36)}
            <div style="flex:1;min-width:0">
              <div class="pt" style="font-size:.94rem">${esc(p.title)}</div>
              <div class="pm"><span>${esc(p.author)}</span><span>❤ ${p.likes}</span><span>💬 ${p.comments}</span>
                <span>${timeAgo(p.created_at)}</span></div>
            </div>
          </div>`).join('') || '<div class="card-sub">还没有动态，来发第一条吧。</div>';
      }
    } catch { /* ignore */ }
  }

  function refreshShellChrome() {
    const s = state.user.stats;
    const ring = qs('.level-ring');
    if (ring) {
      ring.style.setProperty('--p', Math.round((s.levelProgress || 0) * 100));
      qs('span', ring).textContent = 'Lv.' + s.level;
    }
    const chips = qsa('.stat-chip .v');
    if (chips[0]) chips[0].textContent = s.xp;
    if (chips[1]) chips[1].textContent = s.streak;
    if (chips[2]) chips[2].textContent = Math.round(s.total_minutes);
  }

  /* ---------------------------------------------------------------- 课程列表 */

  let courseFilter = 'all';

  async function renderCourses() {
    state.meta = CORE_NAV[1];
    setView('<div class="empty"><span class="ico">⏳</span>加载课程…</div>');
    const { languages } = await api('/api/languages');
    const { courses } = await api('/api/courses');

    const tabs = [`<button class="tab ${courseFilter === 'all' ? 'on' : ''}" data-lang="all">全部语言</button>`]
      .concat(languages.map((l) =>
        `<button class="tab ${courseFilter === l.code ? 'on' : ''}" data-lang="${l.code}">${l.flag} ${esc(l.name)}</button>`)).join('');

    const visible = courseFilter === 'all' ? courses : courses.filter((c) => c.lang === courseFilter);
    const byLang = {};
    visible.forEach((c) => { (byLang[c.lang] = byLang[c.lang] || []).push(c); });

    const groups = Object.entries(byLang).map(([code, list]) => {
      const meta = languages.find((l) => l.code === code) || {};
      return `
        <div class="stack">
          <div class="section-head">
            <h2>${meta.flag || ''} ${esc(meta.name || code)}</h2>
            <div class="spacer"></div>
            <span class="card-sub">${esc(meta.intro || '')}</span>
          </div>
          <div class="grid cols-3">
            ${list.map((c) => `
              <div class="card hover course-card" data-nav="#/course/${c.id}">
                <div class="row">
                  <span class="level-tag ${String(c.level).toLowerCase()}">${esc(c.level)}</span>
                  <div style="font-size:1.4rem">${c.icon || '📘'}</div>
                  <div class="spacer"></div>
                  <span class="pill">${c.lessons} 节课</span>
                </div>
                <div>
                  <div class="card-title">${esc(c.title)}</div>
                  <div class="card-sub" style="font-style:italic">${esc(c.subtitle || '')}</div>
                </div>
                <p class="card-sub">${esc(c.description || '')}</p>
                <div>
                  <div class="row" style="justify-content:space-between;font-size:.76rem;color:var(--text-faint);margin-bottom:6px">
                    <span>学习进度</span><span>${c.percent}%</span>
                  </div>
                  <div class="progress thin"><i style="width:${c.percent}%"></i></div>
                </div>
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');

    setView(`
      <div class="stack">
        <div class="tabs" id="course-tabs">${tabs}</div>
        ${groups || '<div class="empty"><span class="ico">📭</span>该语言暂无课程</div>'}
      </div>`);

    qsa('#course-tabs .tab').forEach((b) => b.addEventListener('click', () => {
      courseFilter = b.dataset.lang;
      renderCourses();
    }));
  }

  /* ---------------------------------------------------------------- 课程详情 */

  async function renderCourseDetail(id) {
    state.meta = { title: '课程详情', sub: '按顺序完成课节，巩固每一项能力' };
    setView('<div class="empty"><span class="ico">⏳</span>加载中…</div>');
    const data = await api('/api/courses/' + id);
    const { course, lessons } = data;

    const done = lessons.filter((l) => l.status === 'completed').length;
    const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;

    setView(`
      <div class="stack" style="max-width:920px;margin:0 auto">
        <a class="btn btn-sm btn-ghost" href="#/courses" style="align-self:flex-start">‹ 返回课程列表</a>
        <div class="card pad-lg">
          <div class="row">
            <span class="level-tag ${String(course.level).toLowerCase()}">${esc(course.level)}</span>
            <div style="font-size:1.8rem">${course.icon || '📘'}</div>
            <div>
              <h2 style="margin:0;font-size:1.35rem">${esc(course.title)}</h2>
              <div class="card-sub">${esc(course.subtitle || '')}</div>
            </div>
            <div class="spacer"></div>
            <span class="pill brand">${done}/${lessons.length} 已完成</span>
          </div>
          <p class="card-sub" style="margin-top:14px">${esc(course.description || '')}</p>
          <div class="progress" style="margin-top:16px"><i style="width:${pct}%"></i></div>
        </div>
        <div class="stack" style="gap:10px">
          ${lessons.map((l) => `
            <div class="lesson-item ${l.status === 'completed' ? 'done' : ''}" data-nav="#/lesson/${l.id}">
              <div class="idx">${l.status === 'completed' ? '✓' : l.order_index}</div>
              <div style="flex:1;min-width:0">
                <div class="lt">${esc(l.title)}</div>
                <div class="ls">
                  <span>${MODULE_ICON[l.module] || ''} ${esc(l.moduleLabel)}</span>
                  <span>⏱ ${l.duration_min} 分钟</span>
                  <span>⭐ ${l.xp} XP</span>
                  <span>${l.exerciseCount} 题</span>
                </div>
              </div>
              <div class="right">
                ${l.best_score ? `<span class="pill ${l.best_score === 100 ? 'gold' : 'green'}">最高 ${l.best_score} 分</span>` : ''}
                <span class="btn btn-sm ${l.status === 'completed' ? '' : 'btn-primary'}">
                  ${l.status === 'completed' ? '再练一次' : l.attempts ? '继续' : '开始'}</span>
              </div>
            </div>`).join('')}
        </div>
      </div>`);
  }

  /* ---------------------------------------------------------------- 学习播放器 */

  let player = null;

  async function renderLesson(id) {
    state.meta = { title: '沉浸式学习中', sub: '完成全部练习即可结算经验值' };
    setView('<div class="empty"><span class="ico">⏳</span>准备学习内容…</div>');
    const data = await api('/api/lessons/' + id);
    player = {
      ...data,
      idx: 0,
      correct: 0,
      answered: false,
      startedAt: Date.now(),
      log: [],
    };
    if (!player.exercises.length) {
      setView('<div class="empty"><span class="ico">📭</span>这节课还没有练习题</div>');
      return;
    }
    renderPlayer();
  }

  function playerHeader() {
    const p = player;
    const total = p.exercises.length;
    const pct = Math.round((p.idx / total) * 100);
    return `
      <div class="player-head">
        <a class="btn btn-sm btn-ghost" href="#/course/${p.course.id}">‹ 退出</a>
        <div style="flex:1">
          <div style="font-weight:680">${esc(p.lesson.title)}</div>
          <div class="card-sub">${p.language?.flag || ''} ${esc(p.language?.name || '')} · ${p.course.level} · ${esc(p.lesson.moduleLabel)}</div>
        </div>
        <span class="pill brand">${p.idx + 1} / ${total}</span>
        <span class="pill green">✓ ${p.correct}</span>
      </div>
      <div class="player-progress"><i style="width:${pct}%"></i></div>`;
  }

  const TYPE_LABEL = {
    mcq: '选择题', fill: '填空题', listen_choice: '听力选择', listen_type: '听力听写', speak: '口语跟读',
  };

  function renderPlayer() {
    const p = player;
    if (p.idx >= p.exercises.length) return renderLessonSummary();
    const ex = p.exercises[p.idx];
    const lang = p.language?.voice || (p.course.lang === 'ja' ? 'ja-JP' : p.course.lang === 'ko' ? 'ko-KR' : 'en-US');
    const isAudio = ['listen_choice', 'listen_type', 'speak'].includes(ex.type);

    let body = '';
    if (ex.options && ex.options.length) {
      body = `<div class="options" id="options">
        ${ex.options.map((o, i) => `
          <div class="opt" data-opt="${i}">
            <span class="mark">${String.fromCharCode(65 + i)}</span><span>${esc(o)}</span>
          </div>`).join('')}
      </div>`;
    } else if (['fill', 'listen_type'].includes(ex.type)) {
      body = `<div>
        <input class="input" id="answer-input" placeholder="在此输入答案…" autocomplete="off" />
      </div>`;
    } else if (ex.type === 'speak') {
      body = `
        <div class="audio-bar">
          <button class="play-btn" id="play-audio" title="播放示范发音">🔊</button>
          <div class="waves" id="waves">${Array.from({ length: 28 }, () => '<i></i>').join('')}</div>
        </div>
        <div class="mic-zone">
          <button class="mic-btn" id="mic-btn" title="点击开始跟读">🎤</button>
          <div class="heard" id="heard">${SR ? '点击麦克风，朗读上面的句子' : '当前浏览器不支持语音识别，可先听示范再自行练习'}</div>
          ${SR ? '' : '<button class="btn btn-sm" id="manual-pass">我已跟读完成</button>'}
        </div>`;
    }

    setView(`
      <div class="player-wrap">
        ${playerHeader()}
        <div class="ex-card">
          <div>
            <div class="ex-type">${TYPE_LABEL[ex.type] || ex.type}</div>
            <div class="ex-prompt" style="margin-top:8px">${esc(ex.prompt || '')}</div>
            ${ex.prompt_translation ? `<div class="ex-trans" style="margin-top:8px">${esc(ex.prompt_translation)}</div>` : ''}
          </div>
          ${isAudio && ex.type !== 'speak' ? `
            <div class="audio-bar">
              <button class="play-btn" id="play-audio" title="播放音频">🔊</button>
              <div class="waves" id="waves">${Array.from({ length: 28 }, () => '<i></i>').join('')}</div>
            </div>` : ''}
          ${body}
          ${ex.hint ? `<div class="ex-hint">💡 ${esc(ex.hint)}</div>` : ''}
          <div id="feedback"></div>
          <div class="row" id="ex-footer">
            ${['fill', 'listen_type'].includes(ex.type)
              ? '<button class="btn btn-primary" id="submit-answer" disabled>提交答案</button>' : ''}
            <div class="spacer"></div>
            <button class="btn" id="skip-btn" style="display:none">下一题 ›</button>
          </div>
        </div>
      </div>`);

    bindExercise(ex, lang);
  }

  function bindExercise(ex, lang) {
    const p = player;
    p.answered = false;

    const playBtn = qs('#play-audio');
    const waves = qs('#waves');
    if (playBtn && ex.audio) {
      const doPlay = async () => {
        playBtn.classList.add('playing');
        if (waves) waves.classList.add('active');
        await speak(ex.audio, lang);
        playBtn.classList.remove('playing');
        if (waves) waves.classList.remove('active');
      };
      playBtn.addEventListener('click', doPlay);
      setTimeout(doPlay, 420); // 听力题自动播放一次
    }

    const nextBtn = qs('#skip-btn');

    const finishAnswer = (isCorrect, detailHtml) => {
      if (p.answered) return;
      p.answered = true;
      if (isCorrect) p.correct++;
      p.log.push({ id: ex.id, correct: isCorrect });
      qs('#feedback').innerHTML = `
        <div class="feedback ${isCorrect ? 'ok' : 'no'}">
          <b>${isCorrect ? '✅ 回答正确' : '❌ 回答有误'}</b>
          ${ex.answer && !isCorrect ? `<div>正确答案：<b>${esc(ex.answer)}</b></div>` : ''}
          ${ex.explanation ? `<div style="margin-top:6px;color:var(--text-dim)">${esc(ex.explanation)}</div>` : ''}
          ${detailHtml || ''}
        </div>`;
      qsa('.opt').forEach((n) => n.classList.add('disabled'));
      const inp = qs('#answer-input'); if (inp) inp.disabled = true;
      const sub = qs('#submit-answer'); if (sub) sub.disabled = true;
      const mic = qs('#mic-btn'); if (mic) mic.disabled = true;
      if (nextBtn) {
        nextBtn.style.display = '';
        nextBtn.className = 'btn btn-primary';
        nextBtn.textContent = p.idx + 1 >= p.exercises.length ? '查看结果 ›' : '下一题 ›';
        nextBtn.onclick = () => { p.idx++; renderPlayer(); };
        nextBtn.focus();
      }
    };

    // 选择题
    qsa('.opt').forEach((node) => node.addEventListener('click', () => {
      if (p.answered) return;
      const chosen = ex.options[Number(node.dataset.opt)];
      const isCorrect = checkAnswer(chosen, ex.answer, ex.lang || p.course.lang)
        || chosen === ex.answer;
      qsa('.opt').forEach((n) => {
        const val = ex.options[Number(n.dataset.opt)];
        if (val === ex.answer) n.classList.add('right');
        else if (n === node) n.classList.add('wrong');
      });
      finishAnswer(isCorrect);
    }));

    // 填空题 / 听写
    const inp = qs('#answer-input');
    const subBtn = qs('#submit-answer');
    if (inp && subBtn) {
      inp.addEventListener('input', () => { subBtn.disabled = !inp.value.trim(); });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && inp.value.trim()) { e.preventDefault(); subBtn.click(); }
      });
      subBtn.addEventListener('click', () => {
        const ok = checkAnswer(inp.value, ex.answer, p.course.lang);
        finishAnswer(ok, `<div style="margin-top:6px;color:var(--text-dim)">你的答案：${esc(inp.value.trim())}</div>`);
      });
      setTimeout(() => inp.focus(), 60);
    }

    // 口语跟读
    const micBtn = qs('#mic-btn');
    if (micBtn && SR) {
      const rec = new SR();
      rec.lang = lang;
      rec.interimResults = false;
      rec.maxAlternatives = 3;
      let recording = false;
      micBtn.addEventListener('click', () => {
        if (recording || player.answered) return;
        recording = true;
        micBtn.classList.add('rec');
        qs('#heard').textContent = '正在聆听…请朗读句子';
        try { rec.start(); } catch { /* already started */ }
      });
      rec.onresult = (ev) => {
        const alts = Array.from(ev.results[0]).map((a) => a.transcript);
        const best = alts.reduce((acc, cur) => {
          const s = similarity(normalizeText(cur, p.course.lang), normalizeText(ex.answer, p.course.lang));
          return s > acc.score ? { text: cur, score: s } : acc;
        }, { text: alts[0], score: 0 });
        const score = Math.round(best.score * 100);
        const ok = best.score >= 0.72;
        qs('#heard').innerHTML = `识别到：<b>${esc(best.text)}</b>`;
        finishAnswer(ok, `<div style="margin-top:6px;color:var(--text-dim)">跟读相似度 <b>${score}%</b>（阈值 72%）</div>`);
      };
      rec.onerror = (e) => {
        recording = false;
        micBtn.classList.remove('rec');
        const msg = e.error === 'not-allowed' ? '麦克风权限被拒绝，请在浏览器中允许后重试'
          : e.error === 'no-speech' ? '没有听到声音，请再试一次' : '语音识别失败：' + e.error;
        qs('#heard').textContent = msg;
      };
      rec.onend = () => { recording = false; micBtn.classList.remove('rec'); };
    }

    const manual = qs('#manual-pass');
    if (manual) manual.addEventListener('click', () => finishAnswer(true, '<div style="margin-top:6px;color:var(--text-dim)">已按自评记录完成</div>'));

    // 允许跳过未答题目（不计分）
    if (nextBtn) {
      nextBtn.style.display = '';
      nextBtn.className = 'btn btn-ghost';
      nextBtn.textContent = '跳过 ›';
      nextBtn.onclick = () => { p.idx++; renderPlayer(); };
    }
  }

  async function renderLessonSummary() {
    const p = player;
    const total = p.exercises.length;
    const score = Math.round((p.correct / total) * 100);
    const minutes = Math.max(0.5, Math.round(((Date.now() - p.startedAt) / 60000) * 10) / 10);
    setView('<div class="empty"><span class="ico">⏳</span>正在结算…</div>');

    let result;
    try {
      result = await api(`/api/lessons/${p.lesson.id}/complete`, 'POST', {
        correct: p.correct, total, minutes,
      });
    } catch (e) {
      setView(`<div class="empty"><span class="ico">⚠️</span>${esc(e.message)}
        <div style="margin-top:16px"><a class="btn" href="#/course/${p.course.id}">返回课程</a></div></div>`);
      return;
    }

    state.user.stats = { ...state.user.stats, ...result.stats };
    (result.unlocked || []).forEach((a) => toast(`成就解锁：${a.icon} ${a.title}`, 'badge'));

    setView(`
      <div class="player-wrap">
        <div class="card pad-lg" style="text-align:center">
          <div class="score-hero">
            <div class="big">${result.score}</div>
            <div class="card-sub" style="margin-top:6px">答对 ${result.correct} / ${result.total} 题 · 用时 ${minutes} 分钟</div>
          </div>
          <div style="margin:18px 0">
            <span class="xp-pop">⭐ +${result.xpGained} XP</span>
          </div>
          <p style="color:var(--text-dim)">${esc(result.message)}</p>
          <div class="grid cols-3" style="margin:22px 0">
            <div class="metric"><span class="k">当前等级</span><span class="v">Lv.${result.stats.level}<small>${esc(result.stats.levelTitle)}</small></span></div>
            <div class="metric"><span class="k">连续打卡</span><span class="v">${result.stats.streak}<small>天</small></span></div>
            <div class="metric"><span class="k">累计经验</span><span class="v">${result.stats.xp}<small>XP</small></span></div>
          </div>
          <div class="progress" style="margin-bottom:22px"><i style="width:${Math.round((result.stats.levelProgress || 0) * 100)}%"></i></div>
          <div class="row" style="justify-content:center">
            <button class="btn" id="retry">再练一次</button>
            <a class="btn" href="#/course/${p.course.id}">返回课程</a>
            <a class="btn btn-primary" href="#/home">回到首页</a>
          </div>
          ${result.unlocked && result.unlocked.length ? `
            <div class="divider"></div>
            <div class="card-sub">本次解锁成就</div>
            <div class="row" style="justify-content:center;margin-top:10px">
              ${result.unlocked.map((a) => `<span class="pill gold">${a.icon} ${esc(a.title)}</span>`).join('')}
            </div>` : ''}
        </div>
      </div>`);

    const retry = qs('#retry');
    if (retry) retry.addEventListener('click', () => renderLesson(p.lesson.id));
  }

  /* ---------------------------------------------------------------- 单词复习（SRS） */

  let reviewState = null;

  async function renderReview() {
    state.meta = CORE_NAV[2];
    setView('<div class="empty"><span class="ico">⏳</span>正在准备复习队列…</div>');
    const data = await api('/api/review/queue?limit=20');
    state.reviewCount = data.counts.due;
    reviewState = { ...data, i: 0, flipped: false, done: 0, xp: 0, revealed: new Set() };

    if (!data.cards.length) {
      setView(`
        <div class="flash-wrap">
          <div class="card pad-lg" style="text-align:center">
            <div style="font-size:3rem">🎉</div>
            <div class="card-title" style="justify-content:center;margin-top:12px">今日复习已清空</div>
            <p class="card-sub">记忆库中共有 ${data.counts.total} 个单词，已掌握 ${data.counts.mastered} 个。</p>
            <div class="grid cols-3" style="margin:22px 0">
              <div class="metric"><span class="k">等待复习</span><span class="v">${data.counts.due}</span></div>
              <div class="metric"><span class="k">学习中的词</span><span class="v">${data.counts.learning}</span></div>
              <div class="metric"><span class="k">已掌握</span><span class="v">${data.counts.mastered}</span></div>
            </div>
            <a class="btn btn-primary" href="#/courses">去学新课程</a>
          </div>
        </div>`);
      return;
    }
    renderReviewCard();
  }

  function renderReviewCard() {
    const r = reviewState;
    if (r.i >= r.cards.length) return renderReviewDone();
    const card = r.cards[r.i];
    const lang = card.lang === 'ja' ? 'ja-JP' : card.lang === 'ko' ? 'ko-KR' : 'en-US';

    setView(`
      <div class="flash-wrap stack">
        <div class="row">
          <a class="btn btn-sm btn-ghost" href="#/home">‹ 返回</a>
          <div class="spacer"></div>
          <span class="pill">${r.i + 1} / ${r.cards.length}</span>
          <span class="pill brand" id="rv-xp">⭐ ${r.xp} XP</span>
        </div>
        <div class="progress thin"><i style="width:${Math.round((r.i / r.cards.length) * 100)}%"></i></div>

        <div class="flashcard ${r.flipped ? 'flipped' : ''}" id="flashcard">
          <div class="flash-inner">
            <div class="flash-face">
              <span class="pill">${(LANG_META[card.lang] || {}).flag || ''} ${esc(LANG_LABEL[card.lang] || card.lang)} · ${esc(card.level || '')}</span>
              <div class="flash-word">${esc(card.word)}</div>
              ${card.reading && card.reading !== card.word ? `<div class="flash-reading">${esc(card.reading)}</div>` : ''}
              <button class="btn btn-sm" id="rv-play">🔊 听发音</button>
              <div class="card-sub">点击卡片查看释义</div>
            </div>
            <div class="flash-face back">
              <div class="flash-meaning">${esc(card.meaning)}</div>
              ${card.pos ? `<span class="pill">${esc(card.pos)}</span>` : ''}
              ${card.example ? `<div class="flash-ex">${esc(card.example)}<br/><span style="color:var(--text-faint)">${esc(card.example_translation || '')}</span></div>` : ''}
            </div>
          </div>
        </div>

        <div id="rate-zone">
          ${r.flipped ? `
            <div class="rate-grid">
              <button class="btn rate-btn" data-q="0"><b>完全忘记</b><span>重来</span></button>
              <button class="btn rate-btn" data-q="3"><b>有点困难</b><span>1 天后</span></button>
              <button class="btn rate-btn" data-q="4"><b>记得住</b><span>约 6 天后</span></button>
              <button class="btn btn-primary rate-btn" data-q="5"><b>非常轻松</b><span>更久之后</span></button>
            </div>` : `
            <button class="btn btn-primary btn-block btn-lg" id="rv-flip">显示释义</button>`}
        </div>
      </div>`);

    const playBtn = qs('#rv-play');
    const doPlay = (e) => { e.stopPropagation(); speak(card.word, lang); };
    if (playBtn) playBtn.addEventListener('click', doPlay);

    qs('#flashcard').addEventListener('click', () => {
      if (r.flipped) return;
      r.flipped = true;
      renderReviewCard();
    });

    const flip = qs('#rv-flip');
    if (flip) flip.addEventListener('click', () => { r.flipped = true; renderReviewCard(); });

    qsa('[data-q]').forEach((b) => b.addEventListener('click', () => submitReview(Number(b.dataset.q))));
  }

  async function submitReview(quality) {
    const r = reviewState;
    const card = r.cards[r.i];
    try {
      const out = await api('/api/review/submit', 'POST', { word_id: card.word_id, quality });
      r.xp += out.xpGained;
      state.user.stats = { ...state.user.stats, ...out.stats };
      (out.unlocked || []).forEach((a) => toast(`成就解锁：${a.icon} ${a.title}`, 'badge'));
      r.i++;
      r.flipped = false;
      renderReviewCard();
    } catch (e) { toast(e.message, 'no'); }
  }

  function renderReviewDone() {
    const r = reviewState;
    setView(`
      <div class="flash-wrap">
        <div class="card pad-lg" style="text-align:center">
          <div style="font-size:3rem">🌟</div>
          <div class="card-title" style="justify-content:center;margin-top:10px">本轮复习完成</div>
          <p class="card-sub">共复习 ${r.cards.length} 个单词，获得 ${r.xp} 经验值</p>
          <div class="row" style="justify-content:center;margin-top:22px">
            <a class="btn" href="#/home">回到首页</a>
            <button class="btn btn-primary" id="rv-again">再来一轮</button>
          </div>
        </div>
      </div>`);
    qs('#rv-again').addEventListener('click', () => renderReview());
  }

  /* ---------------------------------------------------------------- 社区 */

  let communityFilter = 'all';
  let communityPosts = [];

  async function renderCommunity() {
    state.meta = CORE_NAV[3];
    setView('<div class="empty"><span class="ico">⏳</span>加载社区内容…</div>');
    const [posts, board] = await Promise.all([
      api('/api/community/posts' + (communityFilter === 'all' ? '' : '?lang=' + communityFilter)),
      api('/api/community/leaderboard'),
    ]);
    communityPosts = posts.posts;

    const tabs = [`<button class="tab ${communityFilter === 'all' ? 'on' : ''}" data-lang="all">全部</button>`]
      .concat(['en', 'ja', 'ko'].map((c) =>
        `<button class="tab ${communityFilter === c ? 'on' : ''}" data-lang="${c}">${LANG_META[c].flag} ${LANG_META[c].name}</button>`)).join('');

    setView(`
      <div class="grid" style="grid-template-columns:minmax(0,1fr) 320px;align-items:start;gap:20px">
        <div class="stack">
          <div class="row">
            <div class="tabs" id="cm-tabs">${tabs}</div>
            <div class="spacer"></div>
            <button class="btn btn-primary btn-sm" id="new-post">✍️ 发布动态</button>
          </div>
          <div class="stack" id="post-list">
            ${communityPosts.length ? communityPosts.map((p) => `
              <div class="card hover post-card" data-nav="#/post/${p.id}">
                <div class="row">
                  ${avatar({ nickname: p.author, avatar_color: p.avatar_color }, 34)}
                  <div>
                    <div style="font-weight:640;font-size:.9rem">${esc(p.author)}</div>
                    <div class="card-sub" style="font-size:.74rem">${timeAgo(p.created_at)}</div>
                  </div>
                  <div class="spacer"></div>
                  ${p.lang ? `<span class="pill">${(LANG_META[p.lang] || {}).flag || ''} ${esc(LANG_LABEL[p.lang] || '')}</span>` : ''}
                  <span class="pill brand">${esc(p.topic)}</span>
                </div>
                <h3 class="post-title">${esc(p.title)}</h3>
                <div class="post-body">${esc(p.body)}</div>
                <div class="post-meta">
                  <span>❤ ${p.likes} 赞</span><span>💬 ${p.comments} 评论</span>
                </div>
              </div>`).join('')
              : '<div class="empty"><span class="ico">💬</span>还没有动态，点右上角发布第一条吧</div>'}
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <div class="card-title">🏅 学习排行榜</div>
            <p class="card-sub" style="margin-bottom:12px">按累计经验值排名</p>
            <div id="board"></div>
          </div>
          <div class="card">
            <div class="card-title">💡 共学小贴士</div>
            <ul style="margin:10px 0 0;padding-left:18px;color:var(--text-dim);font-size:.85rem;line-height:1.9">
              <li>每天固定时段学习，更容易形成习惯</li>
              <li>发帖分享进度，互相督促更持久</li>
              <li>用「口语跟读」录音对比，进步看得见</li>
            </ul>
          </div>
        </div>
      </div>`);

    const boardBox = qs('#board');
    boardBox.innerHTML = board.leaderboard.map((u) => `
      <div class="rank-row ${u.id === state.user.id ? 'me' : ''}">
        <div class="rank-no ${u.rank <= 3 ? 'top' : ''}">${u.rank}</div>
        ${avatar({ nickname: u.nickname, avatar_color: u.avatar_color }, 30)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:620;font-size:.88rem">${esc(u.nickname)}${u.id === state.user.id ? ' <span style="color:var(--text-faint);font-size:.72rem">(我)</span>' : ''}</div>
          <div class="card-sub" style="font-size:.72rem">${u.lessons} 课 · ${u.badges} 徽章 · 🔥${u.streak}</div>
        </div>
        <div style="font-weight:750;font-size:.9rem">${u.xp}</div>
      </div>`).join('');

    qsa('#cm-tabs .tab').forEach((b) => b.addEventListener('click', () => {
      communityFilter = b.dataset.lang;
      renderCommunity();
    }));

    qs('#new-post').addEventListener('click', openNewPost);
  }

  function openNewPost() {
    openModal(`
      <h3>发布学习动态</h3>
      <p class="card-sub" style="margin-bottom:18px">分享经验、提问求助或者打卡记录，都能获得社区关注。</p>
      <div class="field"><label>标题</label><input class="input" id="np-title" placeholder="例如：坚持 7 天，我的听力正确率提升了 20%" /></div>
      <div class="field"><label>内容</label><textarea class="textarea" id="np-body" placeholder="说说你的学习方法或遇到的问题…"></textarea></div>
      <div class="grid cols-2" style="gap:14px">
        <div class="field"><label>关联语言</label>
          <select class="select" id="np-lang">
            <option value="">不限</option>
            <option value="en">🇬🇧 英语</option><option value="ja">🇯🇵 日语</option><option value="ko">🇰🇷 韩语</option>
          </select></div>
        <div class="field"><label>话题</label>
          <select class="select" id="np-topic">
            <option>经验分享</option><option>答疑求助</option><option>学习打卡</option><option>资源推荐</option><option>语伴招募</option>
          </select></div>
      </div>
      <button class="btn btn-primary btn-block btn-lg" id="np-submit">发布</button>
    `, (card) => {
      qs('#np-submit', card).addEventListener('click', async () => {
        const title = qs('#np-title', card).value.trim();
        const body = qs('#np-body', card).value.trim();
        if (title.length < 2 || body.length < 2) { toast('标题和内容都需要至少 2 个字', 'no'); return; }
        try {
          const out = await api('/api/community/posts', 'POST', {
            title, body, lang: qs('#np-lang', card).value || null, topic: qs('#np-topic', card).value,
          });
          closeModal();
          toast('发布成功！', 'ok');
          communityFilter = 'all';
          renderCommunity();
        } catch (e) { toast(e.message, 'no'); }
      });
    });
  }

  async function renderPost(id) {
    state.meta = { title: '帖子详情', sub: '参与讨论，共学共进' };
    setView('<div class="empty"><span class="ico">⏳</span>加载中…</div>');
    const { post, comments } = await api('/api/community/posts/' + id);

    setView(`
      <div class="stack" style="max-width:820px;margin:0 auto">
        <a class="btn btn-sm btn-ghost" href="#/community" style="align-self:flex-start">‹ 返回社区</a>
        <div class="card pad-lg">
          <div class="row">
            ${avatar({ nickname: post.author, avatar_color: post.avatar_color }, 42)}
            <div>
              <div style="font-weight:660">${esc(post.author)}</div>
              <div class="card-sub" style="font-size:.76rem">${timeAgo(post.created_at)}</div>
            </div>
            <div class="spacer"></div>
            ${post.lang ? `<span class="pill">${(LANG_META[post.lang] || {}).flag || ''} ${esc(LANG_LABEL[post.lang] || '')}</span>` : ''}
            <span class="pill brand">${esc(post.topic)}</span>
          </div>
          <h2 style="margin:18px 0 10px;font-size:1.4rem">${esc(post.title)}</h2>
          <div style="color:var(--text-dim);white-space:pre-wrap;line-height:1.85">${esc(post.body)}</div>
          <div class="divider"></div>
          <div class="post-actions">
            <button class="icon-btn ${post.liked ? 'on' : ''}" id="like-btn">${post.liked ? '❤' : '🤍'} <span>${post.likes}</span></button>
            <span class="icon-btn" style="pointer-events:none">💬 ${post.comments}</span>
          </div>
        </div>

        <div class="card pad-lg">
          <div class="card-title">💬 评论（${post.comments}）</div>
          <div class="field" style="margin-top:14px">
            <textarea class="textarea" id="cm-input" placeholder="写下你的想法…"></textarea>
          </div>
          <button class="btn btn-primary btn-sm" id="cm-submit">发表评论</button>
          <div style="margin-top:10px">
            ${comments.length ? comments.map((c) => `
              <div class="comment">
                ${avatar({ nickname: c.nickname, avatar_color: c.avatar_color }, 34)}
                <div class="body">
                  <div class="who">${esc(c.nickname)}<span class="when">${timeAgo(c.created_at)}</span></div>
                  <div class="text">${esc(c.body)}</div>
                </div>
              </div>`).join('') : '<div class="card-sub" style="padding:14px 0">还没有评论，来抢沙发～</div>'}
          </div>
        </div>
      </div>`);

    qs('#like-btn').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      try {
        const out = await api(`/api/community/posts/${id}/like`, 'POST', {});
        btn.classList.toggle('on', out.liked);
        btn.innerHTML = `${out.liked ? '❤' : '🤍'} <span>${post.likes + (out.liked ? 1 : -1)}</span>`;
        post.liked = out.liked;
        post.likes += out.liked ? 1 : -1;
      } catch (err) { toast(err.message, 'no'); }
    });

    qs('#cm-submit').addEventListener('click', async () => {
      const box = qs('#cm-input');
      const body = box.value.trim();
      if (!body) { toast('评论内容不能为空', 'no'); return; }
      try {
        await api(`/api/community/posts/${id}/comments`, 'POST', { body });
        toast('评论已发布', 'ok');
        renderPost(id);
      } catch (err) { toast(err.message, 'no'); }
    });
  }

  /* ---------------------------------------------------------------- 成就 */

  async function renderAchievements() {
    state.meta = CORE_NAV[4];
    setView('<div class="empty"><span class="ico">⏳</span>加载成就…</div>');
    const data = await api('/api/achievements');
    const { summary, achievements, metrics } = data;

    const badges = achievements.map((a) => `
      <div class="badge ${a.unlocked ? 'unlocked' : 'locked'} ${a.tier === 'gold' ? 'tier-gold' : a.tier === 'silver' ? 'tier-silver' : ''}">
        <div class="ico">${a.unlocked ? a.icon : '🔒'}</div>
        <div class="bt">${esc(a.title)}</div>
        <div class="bd">${esc(a.description)}</div>
        <div class="bp">
          <div class="progress thin"><i style="width:${a.unlocked ? 100 : a.progress}%"></i></div>
          <small>${a.unlocked ? `已解锁 · ${timeAgo(a.unlocked_at)}` : `${a.value} / ${a.threshold}`}</small>
        </div>
      </div>`).join('');

    setView(`
      <div class="stack">
        <div class="card pad-lg">
          <div class="row">
            <div>
              <div class="card-title" style="font-size:1.15rem">🏆 成就殿堂</div>
              <p class="card-sub">已点亮 ${summary.unlocked} / ${summary.total} 枚徽章，继续学习解锁更多</p>
            </div>
            <div class="spacer"></div>
            <div class="level-ring" style="--p:${Math.round((summary.unlocked / summary.total) * 100)};width:66px;height:66px">
              <span style="width:52px;height:52px;font-size:.9rem">${summary.unlocked}/${summary.total}</span>
            </div>
          </div>
          <div class="progress" style="margin-top:16px">
            <i style="width:${Math.round((summary.unlocked / summary.total) * 100)}%"></i></div>
        </div>

        <div class="grid cols-4">
          <div class="card"><div class="metric"><span class="k">完成课节</span><span class="v">${metrics.lessons}<small>节</small></span></div></div>
          <div class="card"><div class="metric"><span class="k">掌握单词</span><span class="v">${metrics.words_mastered}<small>个</small></span></div></div>
          <div class="card"><div class="metric"><span class="k">最高连续</span><span class="v">${metrics.streak}<small>天</small></span></div></div>
          <div class="card"><div class="metric"><span class="k">累计经验</span><span class="v">${metrics.xp}<small>XP</small></span></div></div>
        </div>

        <div class="section-head"><h2>徽章墙</h2></div>
        <div class="badge-grid">${badges}</div>
      </div>`);
  }

  /* ---------------------------------------------------------------- 个人中心 */

  async function renderProfile() {
    state.meta = PROFILE_NAV;
    setView('<div class="empty"><span class="ico">⏳</span>加载中…</div>');
    const [me, prog] = await Promise.all([api('/api/profile'), api('/api/progress/overview')]);
    state.user = me.user;
    const u = me.user;
    const p = u.profile;
    const s = prog.stats;

    const langTabs = ['en', 'ja', 'ko'].map((c) => {
      const on = (p.target_langs || []).includes(c);
      return `<button class="tab ${on ? 'on' : ''}" data-tl="${c}">${LANG_META[c].flag} ${LANG_META[c].name}</button>`;
    }).join('');

    setView(`
      <div class="stack">
        <div class="card pad-lg">
          <div class="row" style="gap:20px">
            ${avatar(u, 72)}
            <div style="flex:1">
              <h2 style="margin:0;font-size:1.4rem">${esc(u.nickname)}</h2>
              <div class="card-sub">${esc(u.email)} · 加入于 ${new Date(u.created_at).toLocaleDateString('zh-CN')}</div>
              <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
                <span class="pill brand">Lv.${s.level} ${esc(s.levelTitle)}</span>
                <span class="pill gold">🔥 连续 ${s.streak} 天</span>
                <span class="pill cyan">⭐ ${s.xp} XP</span>
                <span class="pill green">🏅 ${u.achievements.length} 徽章</span>
              </div>
            </div>
            <button class="btn btn-sm" id="logout">退出登录</button>
          </div>
          <div class="divider"></div>
          <div class="row" style="justify-content:space-between;font-size:.8rem;color:var(--text-faint);margin-bottom:6px">
            <span>距 Lv.${s.level + 1} 还需 ${Math.max(0, s.nextLevelXp - s.xp)} XP</span>
            <span>${Math.round((s.levelProgress || 0) * 100)}%</span>
          </div>
          <div class="progress"><i style="width:${Math.round((s.levelProgress || 0) * 100)}%"></i></div>
        </div>

        <div class="grid cols-4">
          <div class="card"><div class="metric"><span class="k">累计学习时长</span><span class="v">${Math.round(s.total_minutes)}<small>分钟</small></span></div></div>
          <div class="card"><div class="metric"><span class="k">完成课节</span><span class="v">${prog.totals.lessonsCompleted}<small>节</small></span></div></div>
          <div class="card"><div class="metric"><span class="k">记忆库单词</span><span class="v">${prog.totals.wordsTotal}<small>个</small></span></div></div>
          <div class="card"><div class="metric"><span class="k">满分课节</span><span class="v">${prog.totals.perfect}<small>次</small></span></div></div>
        </div>

        <div class="grid cols-2">
          <div class="card pad-lg">
            <div class="card-title">⚙️ 学习偏好</div>
            <p class="card-sub" style="margin-bottom:16px">调整后推荐的每日路径会立即生效</p>
            <div class="field"><label>昵称</label><input class="input" id="pf-nick"> </div>
            <div class="field"><label>学习语言</label><div class="tabs" id="pf-langs">${langTabs}</div></div>
            <div class="field"><label>当前水平</label>
              <select class="select" id="pf-level">
                ${['A1', 'A2', 'B1', 'B2'].map((l) => `<option value="${l}" ${p.placement === l ? 'selected' : ''}>${l}</option>`).join('')}
              </select></div>
            <div class="field"><label>每日目标</label>
              <select class="select" id="pf-goal">
                ${[10, 20, 30, 45, 60].map((g) => `<option value="${g}" ${p.daily_goal_min === g ? 'selected' : ''}>${g} 分钟 / 天</option>`).join('')}
              </select></div>
            <button class="btn btn-primary btn-block" id="pf-save">保存偏好</button>
          </div>

          <div class="card pad-lg">
            <div class="card-title">📊 学习概览</div>
            <p class="card-sub" style="margin-bottom:16px">各语言与各能力模块的表现</p>
            ${prog.languages.length ? prog.languages.map((l) => `
              <div style="margin-bottom:14px">
                <div class="row" style="justify-content:space-between;font-size:.86rem;margin-bottom:6px">
                  <span>${l.flag} ${esc(l.name)}</span><span style="color:var(--text-faint)">${l.completed}/${l.total} 课</span>
                </div>
                <div class="progress thin"><i style="width:${l.percent}%"></i></div>
              </div>`).join('') : '<div class="card-sub">暂无学习记录</div>'}
            <div class="divider"></div>
            ${prog.modules.map((m) => `
              <div class="row" style="justify-content:space-between;font-size:.84rem;padding:7px 0">
                <span>${MODULE_ICON[m.module]} ${esc(m.label)}</span>
                <span style="color:var(--text-faint)">${m.accuracy === null ? '暂无数据' : m.accuracy + '%'} · ${m.minutes} 分钟</span>
              </div>`).join('')}
          </div>
        </div>
      </div>`);

    qs('#pf-nick', app).value = u.nickname;
    const chosen = new Set(p.target_langs);
    qsa('#pf-langs .tab').forEach((b) => b.addEventListener('click', () => {
      const c = b.dataset.tl;
      if (chosen.has(c)) { if (chosen.size > 1) chosen.delete(c); } else chosen.add(c);
      b.classList.toggle('on', chosen.has(c));
    }));

    qs('#pf-save').addEventListener('click', async () => {
      try {
        const out = await api('/api/profile', 'PUT', {
          nickname: qs('#pf-nick', app).value.trim(),
          target_langs: [...chosen],
          placement: qs('#pf-level', app).value,
          daily_goal_min: Number(qs('#pf-goal', app).value),
        });
        state.user = out.user;
        toast('偏好已保存', 'ok');
        renderProfile();
      } catch (e) { toast(e.message, 'no'); }
    });

    qs('#logout').addEventListener('click', async () => {
      try { await api('/api/auth/logout', 'POST', {}); } catch { /* ignore */ }
      setToken('');
      state.user = null;
      location.hash = '';
      render();
    });
  }

  /* ================================================================ *
   * 「言灵魔法」模块（英语专属，独立子系统，不影响任何现有页面）
   * ================================================================ */

  const LINGUA_NOTICE_KEY = 'lingua_magic_notice_v1';
  const LG_LANG = 'en-US';

  function awaitingLessonShell(title, sub) {
    state.meta = { title, sub };
    shell('<div class="empty"><span class="ico">⏳</span>加载中…</div>');
  }

  /** 首次进入言灵模式时的使用须知（每个用户只弹一次） */
  function maybeShowLinguaNotice() {
    if (localStorage.getItem(LINGUA_NOTICE_KEY)) return;
    openModal(`
      <div class="lg-notice">
        <div class="lg-notice-rune">🧙‍♀️✨</div>
        <h3>🪄 小魔女的咒语课堂</h3>
        <p>欢迎来到咒语魔法学园！英语短语就是你的魔法咒语，念对了就能让魔法生效 ✨</p>
        <p class="card-sub" style="margin-top:10px">🌟 判定超级温柔：拼写接近就好，发音自然就行 —— 慢慢来，我们等你～</p>
        <button class="btn btn-primary btn-block btn-lg" id="lg-notice-ok" style="margin-top:18px">📖 翻开咒语书</button>
      </div>`, (card) => {
      qs('#lg-notice-ok', card).addEventListener('click', () => {
        localStorage.setItem(LINGUA_NOTICE_KEY, '1');
        closeModal();
      });
    });
  }

  /** 首页仪表盘入口卡片：以 DOM 注入方式挂载，renderHome 本体零改动 */
  function injectLinguaEntry() {
    const host = qs('#view .stack');
    if (!host || qs('#lingua-entry', host)) return;
    const node = document.createElement('div');
    node.className = 'card pad-lg hover lingua-entry';
    node.id = 'lingua-entry';
    node.setAttribute('data-nav', '#/lingua');
    node.innerHTML = `
      <div class="lg-entry-glow"></div>
      <div class="row" style="gap:18px;position:relative">
        <div class="lg-emblem">🧙‍♀️</div>
        <div style="flex:1;min-width:0">
          <div class="card-title" style="font-size:1.12rem">🪄 咒语魔法学园
            <span class="pill pink">英语专属</span></div>
          <p class="card-sub">小魔女的英语咒语课堂 —— 六步学会一句魔法短语，然后去云朵上跟小妖怪们决斗吧～</p>
        </div>
        <span class="btn btn-primary">翻开咒语书 ›</span>
      </div>`;
    host.insertBefore(node, host.firstChild);
  }

  /* ---------------- 录音（MediaRecorder，无外部依赖） ---------------- */

  const mic = { stream: null, recorder: null, chunks: [], url: null };
  const micSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

  async function micStart() {
    if (!micSupported()) throw new Error('当前浏览器不支持录音');
    mic.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mic.chunks = [];
    const mr = new MediaRecorder(mic.stream);
    mic.recorder = mr;
    mr.ondataavailable = (e) => { if (e.data && e.data.size) mic.chunks.push(e.data); };
    mr.start();
  }

  function micStop() {
    return new Promise((resolve) => {
      if (!mic.recorder) return resolve(null);
      const mr = mic.recorder;
      mr.onstop = () => {
        const blob = new Blob(mic.chunks, { type: mr.mimeType || 'audio/webm' });
        if (mic.url) URL.revokeObjectURL(mic.url);
        mic.url = URL.createObjectURL(blob);
        if (mic.stream) mic.stream.getTracks().forEach((t) => t.stop());
        mic.stream = null;
        mic.recorder = null;
        resolve(mic.url);
      };
      mr.stop();
    });
  }

  function micReset() {
    if (mic.url) { URL.revokeObjectURL(mic.url); mic.url = null; }
    if (mic.stream) { mic.stream.getTracks().forEach((t) => t.stop()); mic.stream = null; }
    mic.recorder = null;
  }

  /* ---------------- 填空格组件（学习页第 3 步 / 战斗拼写共用） ---------------- */

  function linguaTokens(phrase, blankIdx) {
    const set = new Set(blankIdx);
    let gi = 0;
    return phrase.toLowerCase().split(/\s+/).map((w) => ({
      word: w.split('').map((ch) => {
        const idx = gi++;
        return { ch, idx, blank: set.has(idx) };
      }),
    }));
  }

  function linguaMakeFill(phrase, blankIdx) {
    const letters = phrase.toLowerCase().replace(/[^a-z]/g, '');
    const bank = blankIdx.map((i) => letters[i]);
    for (let i = bank.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bank[i], bank[j]] = [bank[j], bank[i]];
    }
    return {
      phrase,
      blankIdx: [...blankIdx],
      tokens: linguaTokens(phrase, blankIdx),
      bank: bank.map((letter) => ({ letter, used: false })),
      fill: {},
    };
  }

  const linguaFillDone = (f) => f.blankIdx.every((i) => f.fill[i] !== undefined);

  function linguaFillAnswer(f) {
    const letters = f.phrase.toLowerCase().replace(/[^a-z]/g, '');
    let out = '';
    let gi = 0;
    for (const ch of f.phrase.toLowerCase()) {
      if (!/[a-z]/.test(ch)) { out += ch; continue; }
      const b = f.fill[gi];
      out += b === undefined ? letters[gi] : f.bank[b].letter;
      gi += 1;
    }
    return out;
  }

  function linguaPaintFill(host, f, onChange) {
    const words = f.tokens.map((w) => `<div class="fword">${w.word.map((cell) => {
      if (!cell.blank) return `<span class="fcell fixed">${esc(cell.ch)}</span>`;
      const b = f.fill[cell.idx];
      return `<button type="button" class="fcell slot${b === undefined ? '' : ' on'}" data-slot="${cell.idx}">${
        b === undefined ? '' : esc(f.bank[b].letter)}</button>`;
    }).join('')}</div>`).join('<span class="fspace"></span>');

    const bank = f.bank.map((t, i) =>
      `<button type="button" class="ltile${t.used ? ' used' : ''}" data-bank="${i}"${
        t.used ? ' disabled' : ''}>${esc(t.letter)}</button>`).join('');

    host.innerHTML = `
      <div class="fill-words">${words}</div>
      <div class="fill-note">点击下方字母填入空格（自动跳下一格），点击已填的空格可取回字母</div>
      <div class="bank">${bank}</div>`;

    qsa('[data-bank]', host).forEach((btn) => btn.addEventListener('click', () => {
      const i = Number(btn.dataset.bank);
      if (f.bank[i].used) return;
      const empty = f.blankIdx.find((idx) => f.fill[idx] === undefined);
      if (empty === undefined) return;
      f.bank[i].used = true;
      f.fill[empty] = i;
      linguaPaintFill(host, f, onChange);
      if (onChange) onChange();
    }));

    qsa('[data-slot]', host).forEach((btn) => btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.slot);
      const b = f.fill[idx];
      if (b === undefined) return;
      f.bank[b].used = false;
      delete f.fill[idx];
      linguaPaintFill(host, f, onChange);
      if (onChange) onChange();
    }));
  }

  /** 录音面板：录音 → 回放 → 自评（无麦克风时降级为纯自评，不阻塞流程） */
  function linguaRecordPanelHtml(rec) {
    if (!micSupported()) {
      return `
        <div class="lg-downgrade">当前环境无法调用麦克风，已切换为「跟读自评」模式 —— 请先听标准音，
          自己大声跟读一遍，再如实选择。</div>
        <div class="row wrap" style="gap:10px;margin-top:14px">
          <button class="btn" id="lg-retry-rec">再试一次</button>
          <button class="btn btn-primary" id="lg-pass-rec">及格，继续</button>
        </div>`;
    }
    if (rec.state === 'recording') {
      return `<div class="mic-zone">
          <button class="mic-btn rec" id="lg-rec-toggle">⏹</button>
          <div class="heard">正在聆听你的言灵…再次点击结束录音</div>
        </div>`;
    }
    if (rec.state === 'recorded') {
      return `
        <div class="lg-playback">
          <audio controls src="${rec.url}"></audio>
        </div>
        <div class="row wrap" style="gap:10px;margin-top:14px">
          <button class="btn" id="lg-retry-rec">再试一次</button>
          <button class="btn btn-primary" id="lg-pass-rec">及格，继续</button>
        </div>`;
    }
    return `<div class="mic-zone">
        <button class="mic-btn" id="lg-rec-toggle">🎤</button>
        <div class="heard">点击麦克风，跟读上面的咒语</div>
      </div>`;
  }

  function linguaBindRecordPanel(host, rec, opts) {
    const toggle = qs('#lg-rec-toggle', host);
    if (toggle) toggle.addEventListener('click', async () => {
      if (mic.recorder) {
        await micStop();
        rec.state = 'recorded';
        rec.url = mic.url;
        paint();
        return;
      }
      try {
        await micStart();
        rec.state = 'recording';
        paint();
      } catch (e) {
        toast(e.message || '无法开始录音，请检查麦克风权限', 'no');
      }
    });

    const retry = qs('#lg-retry-rec', host);
    if (retry) retry.addEventListener('click', async () => {
      micReset();
      rec.state = 'idle';
      rec.retried = true;
      opts.onRetry && opts.onRetry();
      paint();
      await speak(opts.phrase, LG_LANG);   // 再放一遍标准音
    });

    const pass = qs('#lg-pass-rec', host);
    if (pass) pass.addEventListener('click', () => {
      micReset();
      opts.onPass && opts.onPass(rec.retried);
    });

    function paint() { linguaPaintRecord(host, rec, opts); }
  }

  function linguaPaintRecord(host, rec, opts) {
    host.innerHTML = linguaRecordPanelHtml(rec);
    linguaBindRecordPanel(host, rec, opts);
  }

  /* ---------------- 言灵首页 #/lingua ---------------- */

  async function renderLinguaHome() {
    // 加载 apps.json（工具摊位卡）
    let apps = [];
    try {
      const resp = await fetch('/apps.json?t=' + Date.now());
      if (resp.ok) { const j = await resp.json(); apps = (j.apps || []).filter(a => a.enabled); }
    } catch(e) { apps = []; }

    const [today, prof] = await Promise.all([api('/api/lingua/today'), api('/api/lingua/profile')]);
    const newList = today.newPhrases || [];
    const dueList = today.reviewPhrases || [];
    const first = newList[0] ? newList[0].id : (dueList[0] ? dueList[0].id : null);

    const taskRow = (icon, title, sub, count, list) => `
      <div class="lg-task market-task">
        <div class="lg-task-ico">${icon}</div>
        <div style="flex:1;min-width:0">
          <div class="pt">${esc(title)} <span class="pill brand">${count} 条</span></div>
          <div class="pr">${esc(sub)}</div>
          ${list.length ? `<div class="lg-chips">${list.map((p) =>
            `<button class="lg-chip" data-nav="#/lingua/learn/${p.id}">${esc(p.phrase)}<i>${
              p.mastery ? p.mastery + '%' : '新'}</i></button>`).join('')}</div>` : ''}
        </div>
      </div>`;

    const toolCards = apps.map(a => `
      <button class="tool-card market-stall" data-nav="#${a.id}">
        <img class="tool-card-cover" src="${a.cover || ''}" alt="${esc(a.name)}"
             onerror="this.style.background='#EDE4D3';this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 640 360%22><rect width=%22640%22 height=%22360%22 fill=%22%23F5EFE6%22/><text x=%22320%22 y=%22200%22 font-size=%2280%22 text-anchor=%22middle%22>${a.icon}</text></svg>'">
        <div class="tool-card-info">
          <div class="tool-card-name">${a.icon} ${esc(a.name)}</div>
          ${a.name_zh ? `<div class="tool-card-zh">${esc(a.name_zh)}</div>` : ''}
          <div class="tool-card-desc">${esc(a.desc)}</div>
        </div>
      </button>`).join('');

    setView(`
      <div class="stack lg-wrap market-home">

        <!-- ========== 品牌 Banner（集市入口） ========== -->
        <div class="market-banner">
          <svg class="market-banner-sun" viewBox="0 0 100 100" width="56" height="56">
            <circle cx="50" cy="50" r="26" fill="none" stroke="#C45A3B" stroke-width="5"/>
            <circle cx="50" cy="50" r="15" fill="none" stroke="#9B7B9F" stroke-width="3"/>
            <path d="M 41 47 Q 50 53 59 47" fill="none" stroke="#C45A3B" stroke-width="3.5" stroke-linecap="round"/>
            <path d="M 41 53 Q 50 47 59 53" fill="none" stroke="#9B7B9F" stroke-width="2.5" stroke-linecap="round"/>
            <g stroke="#C45A3B" stroke-width="3" stroke-linecap="butt">
              <line x1="50" y1="8"  x2="50" y2="16"/>
              <line x1="50" y1="84" x2="50" y2="92"/>
              <line x1="8"  y1="50" x2="16" y2="50"/>
              <line x1="84" y1="50" x2="92" y2="50"/>
            </g>
          </svg>
          <div class="market-banner-title">语缪 · Musē Phōnē</div>
          <div class="market-banner-sub">缪 斯 的 语 言 集 市</div>
          <div class="market-banner-stats">
            <span class="market-stat">🔥 ${today.streak} 天</span>
            <span class="market-stat">✨ ${prof.overview.mastered}/${prof.overview.totalPhrases}</span>
            <span class="market-stat">🏆 ${prof.battles} 胜</span>
          </div>
        </div>

        <!-- ========== 工具摊位区 ========== -->
        ${toolCards ? `
        <div class="market-section">
          <div class="market-section-head">
            <h2>🧺 今日摊位</h2>
            <span class="market-section-sub">挑一个趁手的工具逛逛</span>
          </div>
          <div class="grid cols-3" style="gap:var(--sp-3)">
            ${toolCards}
          </div>
        </div>` : ''}

        <!-- ========== 语言学习入口 ========== -->
        <div class="market-section">
          <div class="market-section-head">
            <h2>📚 语言小课堂</h2>
            <span class="market-section-sub">咒语魔法学园</span>
          </div>
          <button class="card pad-lg market-lesson-card hover" data-nav="#/lingua" style="text-align:left;display:flex;gap:16px;align-items:center;width:100%">
            <div style="font-size:2.6rem">🧙‍♀️</div>
            <div style="flex:1">
              <div class="card-title" style="margin-top:0">咒语魔法学园</div>
              <div class="card-sub">念对咒语，云朵会下雨、糖果会发芽 · 点击进入学习主界面</div>
            </div>
            <div>
              <button class="btn btn-primary btn-lg" id="lg-start-learn" ${first ? '' : 'disabled'} style="pointer-events:auto">
                ${first ? '📖 翻开咒语书' : '🌟 今日已完成'}
              </button>
            </div>
          </button>
        </div>

        <!-- ========== 今日任务 ========== -->
        <div class="grid cols-2" style="align-items:start">
          <div class="card pad-lg market-card">
            <div class="market-section-head" style="margin-bottom:14px">
              <h2>📋 今日要逛的摊位</h2>
              <span class="market-section-sub">按遗忘曲线打卡</span>
            </div>
            <div class="stack" style="gap:12px">
              ${taskRow('🌱', '学习新咒语', '从零掌握 3 条常用短语', newList.length, newList)}
              ${taskRow('🔁', '复习到期咒语', '巩固已学短语', dueList.length, dueList)}
            </div>
          </div>

          <div class="stack" style="gap:16px">
            <div class="card pad-lg market-card">
              <div class="market-section-head" style="margin-bottom:14px">
                <h2>📖 熟练度统计</h2>
              </div>
              <div class="grid cols-2" style="gap:14px">
                <div class="metric market-metric"><span class="k">平均熟练度</span><span class="v">${prof.overview.avgMastery}<small>%</small></span></div>
                <div class="metric market-metric"><span class="k">已学咒语</span><span class="v">${prof.overview.studied}<small>条</small></span></div>
                <div class="metric market-metric"><span class="k">已掌握</span><span class="v">${prof.overview.mastered}<small>条</small></span></div>
                <div class="metric market-metric"><span class="k">连续天数</span><span class="v">${prof.streak}<small>天</small></span></div>
              </div>
            </div>

            <!-- 四个集市入口卡（2×2） -->
            <div class="grid cols-2" style="gap:var(--sp-3)">
              <button class="card pad-md market-entry hover" data-nav="#/lingua/book" style="text-align:center">
                <div style="font-size:1.6rem">📖</div>
                <div class="market-entry-title">咒语书</div>
              </button>
              <button class="card pad-md market-entry hover" data-nav="#/lingua/calendar" style="text-align:center">
                <div style="font-size:1.6rem">📅</div>
                <div class="market-entry-title">打卡本</div>
              </button>
              <button class="card pad-md market-entry hover" data-nav="#/lingua/profile" style="text-align:center">
                <div style="font-size:1.6rem">🧙‍♀️</div>
                <div class="market-entry-title">小魔女档案</div>
              </button>
              <button class="card pad-md market-entry hover" data-nav="#/lingua/group" style="text-align:center">
                <div style="font-size:1.6rem">✨</div>
                <div class="market-entry-title">小魔女团</div>
              </button>
            </div>
          </div>
        </div>

        <!-- 战斗小入口 -->
        <div class="market-battle-banner" id="lg-start-battle" style="cursor:pointer">
          <div class="market-battle-left">
            <div style="font-size:1.8rem">🗡️</div>
            <div>
              <div class="market-battle-title">去找小妖怪决斗</div>
              <div class="card-sub">念咒语 · 打怪练级 · XP 升级</div>
            </div>
          </div>
          <span class="market-battle-go">出 发 →</span>
        </div>
      </div>`);

    bindNav();
    const learnBtn = qs('#lg-start-learn');
    if (learnBtn && first) learnBtn.addEventListener('click', () => navigate('#/lingua/learn/' + first));
    qs('#lg-start-battle').addEventListener('click', () => navigate('#/lingua/battle'));
  }

  let lingLearn = null;

  const LEARN_STEPS = ['听音', '释义', '试拼', '跟读', '正式拼写', '内容展开'];
  const TIER_RANK = { super: 3, normal: 2, weak: 1, miss: 0 };

  // 绑定所有 data-nav 跳转 + 通用交互（批次 1 新增）
  function bindNav(root = document) {
    root.querySelectorAll('[data-nav]').forEach((el) => {
      if (el._navBound) return;
      el._navBound = true;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const hash = el.dataset.nav;
        if (hash && hash !== location.hash) location.hash = hash;
      });
    });
  }

  async function renderLinguaLearn(phraseId) {
    setView('<div class="empty"><span class="ico">⏳</span>正在凝聚咒语…</div>');
    if (!phraseId) {
      setView('<div class="empty"><span class="ico">📭</span>没有指定咒语，请从言灵首页进入</div>');
      return;
    }
    const data = await api('/api/lingua/phrase/' + phraseId);
    lingLearn = {
      data,
      phrase: data.phrase,
      step: 1,
      fill: linguaMakeFill(data.phrase.phrase, data.blanks),
      trial: null,
      result: null,
      rec: { state: 'idle', url: null, retried: false },
      done: false,
    };
    renderLearnStep();
    speak(data.phrase.phrase, LG_LANG);
  }

  function learnHeader() {
    const p = lingLearn;
    const pct = Math.round(((p.step - 1) / 6) * 100);
    return `
      <div class="lg-head">
        <a class="btn btn-sm btn-ghost" href="#/lingua">‹ 退出</a>
        <div style="flex:1">
          <div class="lg-step-name">${LEARN_STEPS[p.step - 1]}</div>
          <div class="card-sub">第 ${p.step} / 6 步 · 熟练度 ${p.data.progress.masteryScore}%</div>
        </div>
        <span class="pill brand">✦ 言灵魔法</span>
      </div>
      <div class="player-progress"><i style="width:${pct}%"></i></div>`;
  }

  function renderLearnStep() {
    const p = lingLearn;
    if (p.done) return renderLearnDone();
    const ph = p.phrase;

    let body = '';

    if (p.step === 1) {
      body = `
        <div class="lg-center">
          <div class="lg-rune">🔊</div>
          <p class="lg-lead">先只听声音，不要看文字。仔细记住这条咒语的节奏。</p>
          <button class="play-btn" id="lg-play" title="重播">🔊</button>
        </div>`;

    } else if (p.step === 2) {
      body = `
        <div class="lg-center">
          <div class="lg-label">它的意思</div>
          <div class="lg-meaning">${esc(ph.simple_def)}</div>
          <div class="card-sub" style="margin-top:8px">${esc(ph.grammar_tag || '')}</div>
          <button class="play-btn" id="lg-play" title="再听一次">🔊</button>
        </div>`;

    } else if (p.step === 3) {
      body = `
        <div class="lg-label">把缺失的字母填回去（不计分，随便试）</div>
        <div id="lg-fill"></div>
        <div id="lg-trial"></div>
        <div class="row wrap" style="gap:10px">
          <button class="btn btn-primary" id="lg-try" disabled>试试看</button>
          <button class="btn" id="lg-play">🔊 再听一次</button>
        </div>`;

    } else if (p.step === 4) {
      body = `
        <div class="lg-center">
          <div class="lg-label">正确咒语</div>
          <div class="lg-spell">${esc(ph.phrase)}</div>
          <p class="card-sub">先听标准音，再跟读一遍并录下来回放对比。</p>
          <button class="play-btn" id="lg-play" title="播放标准音">🔊</button>
        </div>
        <div id="lg-rec"></div>`;

    } else if (p.step === 5) {
      body = `
        <div class="lg-label">不看提示，完整拼出这条咒语</div>
        <input class="input lg-input" id="lg-input" placeholder="在此输入咒语…" autocomplete="off" spellcheck="false" />
        <div id="lg-result"></div>
        <button class="btn btn-primary" id="lg-submit" disabled>提交咒语</button>`;

    } else {
      const pictoId = 'lg-picto-' + (ph.id || 'x');
      body = `
        <div class="lg-label">例句</div>
        <ul class="lg-list">${(ph.examples || []).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
        <div class="lg-label" style="margin-top:16px">易错点</div>
        <ul class="lg-list warn">${(ph.pitfalls || []).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
        <!-- 批次 3：绘本模式 -->
        <button class="btn btn-sm btn-ghost" id="${pictoId}" style="margin-top:14px">📚 点读绘本模式</button>
        <div id="lg-picto-host" style="margin-top:12px"></div>
        <div class="row wrap" style="gap:10px;margin-top:14px">
          <span class="pill">${esc(ph.grammar_tag || '短语')}</span>
          <span class="pill brand">熟练度 ${p.result ? p.result.masteryScore : p.data.progress.masteryScore}%</span>
          ${p.result ? `<span class="pill cyan">将于 ${p.result.intervalDays} 天后复习</span>` : ''}
        </div>`;
    }

    const nextLabel = p.step === 6 ? '完成本节 ✓' : '下一步 ›';
    setView(`
      <div class="lg-wrap stack">
        ${learnHeader()}
        <div class="lg-card">
          ${body}
          <div class="lg-foot">
            <div class="spacer"></div>
            ${p.step === 4 ? '' : `<button class="btn btn-primary" id="lg-next">${nextLabel}</button>`}
          </div>
        </div>
      </div>`);

    bindLearnStep();
  }

  function bindLearnStep() {
    const p = lingLearn;
    const ph = p.phrase;

    const play = qs('#lg-play');
    if (play) play.addEventListener('click', () => speak(ph.phrase, LG_LANG));

    if (p.step === 3) {
      const host = qs('#lg-fill');
      const tryBtn = qs('#lg-try');
      linguaPaintFill(host, p.fill, () => {
        tryBtn.disabled = !linguaFillDone(p.fill) || !!p.trial;
      });
      tryBtn.addEventListener('click', () => {
        const answer = linguaFillAnswer(p.fill);
        const ok = normalizeText(answer, 'en') === normalizeText(ph.phrase, 'en');
        p.trial = { answer, ok };
        qs('#lg-trial').innerHTML = `
          <div class="feedback ${ok ? 'ok' : 'no'}" style="margin-top:14px">
            <b>${ok ? '✅ 拼对了' : '📝 记录一下'}</b>
            <div>正确拼写：<b>${esc(ph.phrase)}</b>${ok ? '' : `<br/>你拼的是：<span style="color:var(--text-faint)">${esc(answer)}</span>`}</div>
            <div style="margin-top:6px;color:var(--text-dim)">这一步不计分，接下来会进入跟读环节。</div>
          </div>`;
        tryBtn.disabled = true;
      });
    }

    if (p.step === 4) {
      const host = qs('#lg-rec');
      linguaPaintRecord(host, p.rec, {
        phrase: ph.phrase,
        onPass: () => { p.step = 5; renderLearnStep(); },
      });
    }

    if (p.step === 5) {
      const input = qs('#lg-input');
      const submit = qs('#lg-submit');
      input.addEventListener('input', () => { submit.disabled = !input.value.trim(); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) submit.click(); });
      submit.addEventListener('click', async () => {
        submit.disabled = true;
        try {
          const selfResult = p.rec.retried ? 'retry' : 'pass';
          const out = await api('/api/lingua/learn/submit', 'POST', {
            phraseId: ph.id, input: input.value.trim(), selfResult,
          });
          p.result = out;
          const label = { exact: '✅ 全对！咒语完全生效', minor: '⚠️ 小错（1-2 个字母）', miss: '❌ 大错，需要重新记忆' }[out.result];
          qs('#lg-result').innerHTML = `
            <div class="feedback ${out.result === 'exact' ? 'ok' : 'no'}" style="margin-top:14px">
              <b>${label}</b>
              <div>正确拼写：<b>${esc(out.target)}</b></div>
              ${out.result === 'exact' ? '' : `<div>你拼的是：<span style="color:var(--text-faint)">${esc(input.value.trim())}</span>（编辑距离 ${out.distance}）</div>`}
              <div style="margin-top:6px;color:var(--text-dim)">熟练度更新为 <b>${out.masteryScore}%</b>，
                基础攻击力 <b>${out.baseAtk}</b>，${out.intervalDays} 天后再次复习。</div>
            </div>`;
          input.disabled = true;
        } catch (e) {
          toast(e.message, 'no');
          submit.disabled = false;
        }
      });
      setTimeout(() => input.focus(), 60);
    }

    // 批次 3：点读绘本模式（step 6）
    if (p.step === 6) {
      const pictoBtn = document.querySelector('[id^="lg-picto-"]');
      const pictoHost = qs('#lg-picto-host');
      if (pictoBtn && pictoHost) {
        pictoBtn.addEventListener('click', () => {
          pictoBtn.style.display = 'none';
          const words = ph.phrase.split(/\s+/);
          const storyEmoji = (pictoStoryEmoji(ph.phrase));
          const tokens = ph.phrase.match(/[\w']+|[^\w\s]/g) || words;
          pictoHost.innerHTML = `
            <div class="picto-book">
              <div style="text-align:center">
                <div class="picto-emoji">${storyEmoji}</div>
              </div>
              <div class="picto-text" id="lg-picto-line">
                ${tokens.map((w, i) => `<span class="picto-word" data-idx="${i}">${esc(w)}</span>`).join('')}
              </div>
              <div class="picto-controls">
                <button class="btn btn-sm" id="lg-picto-slow">🐢 慢速播放</button>
                <button class="btn btn-sm" id="lg-picto-normal">🔊 正常</button>
                <button class="btn btn-sm btn-ghost" id="lg-picto-hide">隐藏绘本</button>
              </div>
            </div>`;
          // 逐词高亮播放（慢速）
          let stopFlag = false;
          const playWithHighlight = async (rate) => {
            stopFlag = false;
            const tokenEls = pictoHost.querySelectorAll('.picto-word');
            for (let i = 0; i < tokens.length; i++) {
              if (stopFlag) break;
              tokenEls.forEach((el) => el.classList.remove('highlight'));
              tokenEls[i]?.classList.add('highlight');
              // 播放该词
              speak(tokens[i], LG_LANG, { rate });
              // 等待一个词的时长
              await new Promise((r) => setTimeout(r, Math.max(250, 800 / (rate || 1))));
            }
            if (!stopFlag) tokenEls.forEach((el) => el.classList.remove('highlight'));
          };
          pictoHost.querySelector('#lg-picto-slow')?.addEventListener('click', () => playWithHighlight(0.65));
          pictoHost.querySelector('#lg-picto-normal')?.addEventListener('click', () => playWithHighlight(1.0));
          pictoHost.querySelector('#lg-picto-hide')?.addEventListener('click', () => {
            stopFlag = true;
            if (speechSynthesis) speechSynthesis.cancel();
            pictoHost.innerHTML = '';
            pictoBtn.style.display = '';
          });
        });
      }
    }

    const nextBtn = qs('#lg-next');
    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (p.step === 6) { p.done = true; renderLearnStep(); return; }
      p.step += 1;
      renderLearnStep();
      if (p.step === 1 || p.step === 2 || p.step === 4) speak(ph.phrase, LG_LANG);
    });
  }

  function renderLearnDone() {
    const ph = lingLearn.phrase;
    const r = lingLearn.result;
    setView(`
      <div class="lg-wrap stack">
        <div class="lg-card lg-center">
          <div class="lg-rune big">🧙‍♀️✨</div>
          <div class="lg-title">咒语写进小魔女的魔法书啦！</div>
          <div class="lg-spell">${esc(ph.phrase)}</div>
          ${r ? `<div class="row wrap" style="gap:10px;justify-content:center">
            <span class="pill brand">熟练度 ${r.masteryScore}%</span>
            <span class="pill cyan">✨ 魔法攻击 ${r.baseAtk}</span>
            <span class="pill gold">🍄 ${r.intervalDays} 天后再练</span></div>` : ''}
          <div class="row wrap" style="gap:10px;justify-content:center;margin-top:20px">
            <button class="btn" id="lg-again">🔁 再念一遍</button>
            <a class="btn" href="#/lingua/battle">🗡️ 去找小妖怪决斗</a>
            <a class="btn btn-primary" href="#/lingua">返回言灵首页</a>
          </div>
        </div>
      </div>`);
    qs('#lg-again').addEventListener('click', () => renderLinguaLearn(ph.id));
  }

  /* ---------------- 战斗页 #/lingua/battle ---------------- */

  let lingBattle = null;

  async function renderLinguaBattle() {
    setView('<div class="empty"><span class="ico">⏳</span>正在推演战局…</div>');
    const start = await api('/api/lingua/battle/start');
    lingBattle = {
      start,
      seq: start.sequence,
      i: 0,
      phase: 'narration',
      narrIdx: 0,
      fill: null,
      rec: { state: 'idle', url: null, retried: false },
      last: null,
      log: [],
      enemyHp: start.enemyHp,
      playerHp: start.playerHp,
    };
    micReset();
    renderBattle();
  }

  function battleHud() {
    const b = lingBattle;
    const eHp = Math.max(0, b.enemyHp);
    const pHp = Math.max(0, b.playerHp);
    return `
      <div class="lg-hud">
        <div class="hud-side">
          <div class="hud-name">🍬 ${esc(b.start.enemyName)}</div>
          <div class="hud-bar enemy"><i style="width:${Math.round((eHp / b.start.enemyMaxHp) * 100)}%"></i></div>
          <div class="hud-num">${eHp} / ${b.start.enemyMaxHp} 🍭</div>
        </div>
        <div class="hud-round">回合<br/><b>${Math.min(b.i + 1, b.start.totalRounds)}</b>/${b.start.totalRounds}</div>
        <div class="hud-side right">
          <div class="hud-name">🧙‍♀️ 你</div>
          <div class="hud-bar self"><i style="width:${Math.round((pHp / b.start.playerMaxHp) * 100)}%"></i></div>
          <div class="hud-num">${pHp} / ${b.start.playerMaxHp} ✨</div>
        </div>
      </div>`;
  }

  const TIER_CLASS = { super: 'tier-super', normal: 'tier-normal', weak: 'tier-weak', miss: 'tier-miss' };

  function renderBattle() {
    const b = lingBattle;

    if (b.phase === 'narration') {
      const lines = b.start.narration.slice(0, b.narrIdx + 1);
      setView(`
        <div class="lg-wrap stack">
          <div class="lg-card lg-center">
            <div class="lg-rune big">🧙‍♀️✨</div>
            <div class="lg-narration">${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
            <div class="row" style="justify-content:center;margin-top:20px">
              <button class="btn btn-primary" id="lg-narr-next">
                ${b.narrIdx + 1 < b.start.narration.length ? '继续听…' : '🧹 拿上扫帚出发！'}</button>
            </div>
            <a class="btn btn-sm btn-ghost" href="#/lingua" style="margin-top:14px">‹ 退出战斗</a>
          </div>
        </div>`);
      qs('#lg-narr-next').addEventListener('click', () => {
        if (b.narrIdx + 1 < b.start.narration.length) { b.narrIdx += 1; renderBattle(); return; }
        b.phase = 'hint';
        renderBattle();
      });
      return;
    }

    if (b.phase === 'settle') return renderBattleSettle();

    const cur = b.seq[b.i];
    let body = '';

    if (b.phase === 'hint') {
      body = `
        <div class="lg-center">
          <div class="lg-label">系统提示 · B 档线索</div>
          <div class="lg-hint">「${esc(cur.hint_script)}」</div>
          <div class="card-sub" style="margin-top:10px">${esc(cur.simple_def)}</div>
          <button class="btn btn-primary btn-lg" id="lg-to-spell" style="margin-top:18px">开始填充咒语</button>
        </div>`;
    } else if (b.phase === 'spell') {
      body = `
        <div class="lg-label">把缺失的字母填回去，补全咒语</div>
        <div id="lg-fill"></div>
        <div class="lg-foot" style="justify-content:flex-end">
          <button class="btn btn-primary" id="lg-confirm" disabled>确认咒语 →</button>
        </div>`;
    } else if (b.phase === 'record') {
      body = `
        <div class="lg-center">
          <div class="lg-spell">${esc(cur.phrase)}</div>
          <p class="card-sub">言灵必须出声才有力量 —— 跟读并录音（此环节无法跳过）</p>
          <button class="play-btn" id="lg-play" title="标准音">🔊</button>
        </div>
        <div id="lg-rec"></div>`;
    } else if (b.phase === 'result') {
      const r = b.last;
      const dims = r.dimensions || [];
      const dimsHtml = dims.map((d) => {
        const barCls = d.score >= 80 ? 'green' : d.score >= 50 ? 'cyan' : d.score >= 30 ? 'gold' : 'pink';
        return `
          <div style="background:#FFFDF7;border:1px solid #E8DFD0;border-radius:var(--r-md);padding:10px 12px">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.78rem;color:var(--text-dim);margin-bottom:6px">
              <span style="font-weight:700;color:var(--text)">${d.emoji} ${d.label}</span>
              <span style="font-weight:800;color:var(--text)">${d.score}</span>
            </div>
            <div class="progress thin"><i style="width:${d.score}%;background:var(--grad-${barCls === 'green' ? 'success' : barCls === 'cyan' ? 'teal' : barCls === 'gold' ? 'warn' : 'danger'})"></i></div>
            <div style="font-size:0.72rem;color:var(--text-faint);margin-top:5px;line-height:1.5">${esc(d.tip)}</div>
          </div>`;
      }).join('');
      body = `
        <div class="lg-center">
          <div class="lg-tier ${TIER_CLASS[r.tier]}">${esc(r.tierLabel)}</div>
          <div class="lg-narration"><p>${esc(r.narration)}</p></div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%;max-width:580px;margin-top:14px">
            ${dimsHtml}
          </div>
          <div class="lg-verdict" style="margin-top:10px">
            <div>正确咒语：<b>${esc(r.target)}</b></div>
            ${r.spelling === 'exact' ? '' : `<div>你拼的是：<span style="color:var(--text-faint)">${esc(r.yourAnswer || '（未填）')}</span></div>`}
          </div>
          <div class="row wrap" style="gap:10px;justify-content:center;margin-top:8px">
            <span class="pill ${r.tier === 'super' ? 'gold' : r.tier === 'normal' ? 'green' : r.tier === 'weak' ? 'cyan' : 'pink'}">敌人 ${r.enemyHp} / ${r.enemyMaxHp}</span>
            <span class="pill">自身 ${r.playerHp} / ${r.playerMaxHp}</span>
            <span class="pill brand">连击 ${r.combo}</span>
          </div>
          <button class="btn btn-primary btn-lg" id="lg-next-round" style="margin-top:18px">
            ${r.finished ? '进入结算 →' : '下一回合 →'}</button>
        </div>`;
    }

    setView(`
      <div class="lg-wrap stack">
        ${battleHud()}
        <div class="lg-card lg-battle">${body}</div>
      </div>`);

    if (b.phase === 'hint') {
      qs('#lg-to-spell').addEventListener('click', () => {
        b.fill = linguaMakeFill(cur.phrase, cur.blanks);
        b.phase = 'spell';
        renderBattle();
      });
    }

    if (b.phase === 'spell') {
      const host = qs('#lg-fill');
      const confirm = qs('#lg-confirm');
      linguaPaintFill(host, b.fill, () => { confirm.disabled = !linguaFillDone(b.fill); });
      confirm.addEventListener('click', () => {
        b.rec = { state: 'idle', url: null, retried: false };
        b.phase = 'record';
        renderBattle();
      });
    }

    if (b.phase === 'record') {
      const play = qs('#lg-play');
      if (play) play.addEventListener('click', () => speak(cur.phrase, LG_LANG));
      const host = qs('#lg-rec');
      linguaPaintRecord(host, b.rec, {
        phrase: cur.phrase,
        onPass: (retried) => submitBattleRound(retried),
      });
      speak(cur.phrase, LG_LANG);
    }

    if (b.phase === 'result') {
      qs('#lg-next-round').addEventListener('click', () => {
        if (b.last.finished) { b.phase = 'settle'; renderBattle(); return; }
        b.i += 1;
        b.rec = { state: 'idle', url: null, retried: false };
        b.phase = 'hint';
        renderBattle();
      });
    }
  }

  async function submitBattleRound(retried) {
    const b = lingBattle;
    const cur = b.seq[b.i];
    const answer = linguaFillAnswer(b.fill);
    try {
      const r = await api('/api/lingua/battle/round', 'POST', {
        battleId: b.start.battleId,
        phraseId: cur.phraseId,
        input: answer,
        selfResult: retried ? 'retry' : 'pass',
      });
      b.last = r;
      b.enemyHp = r.enemyHp;
      b.playerHp = r.playerHp;
      b.log.push(r);
      b.phase = 'result';
      renderBattle();
    } catch (e) {
      toast(e.message, 'no');
    }
  }

  async function renderBattleSettle() {
    const b = lingBattle;
    setView('<div class="empty"><span class="ico">⏳</span>正在结算战果…</div>');
    let out;
    try {
      out = await api('/api/lingua/battle/finish', 'POST', { battleId: b.start.battleId });
    } catch (e) {
      setView(`<div class="empty"><span class="ico">⚠️</span>${esc(e.message)}
        <div style="margin-top:16px"><a class="btn" href="#/lingua">返回言灵首页</a></div></div>`);
      return;
    }
    const s = out.summary;
    const dist = ['super', 'normal', 'weak', 'miss'].map((k) => {
      const labels = { super: '🧚 妖精级', normal: '🌟 完美', weak: '💫 稍弱', miss: '🍬 走神啦' };
      return { k, label: labels[k], n: s.distribution[k] };
    });

    setView(`
      <div class="lg-wrap stack">
        <div class="lg-card lg-center">
          <div class="lg-rune big">${s.victory ? '🏆✨' : '🕯️'}</div>
          <div class="lg-title">${s.victory ? '🎉 击退了 ' + esc(s.enemyName) + '！' : '💤 魔法暂时耗尽了…'}</div>
          <div class="lg-tier-big ${s.titleKey === 'nova' ? 'tier-super' : s.titleKey === 'steady' ? 'tier-normal' : s.titleKey === 'narrow' ? 'tier-weak' : 'tier-miss'}">
            ${esc(s.title)}
          </div>
          <p class="card-sub">${esc(s.titleBlurb)}</p>

          <div class="grid cols-3" style="gap:14px;margin:24px 0;width:100%">
            <div class="metric"><span class="k">总伤害</span><span class="v">${s.totalDamage}</span></div>
            <div class="metric"><span class="k">最高连击</span><span class="v">${s.maxCombo}</span></div>
            <div class="metric"><span class="k">敌方剩余</span><span class="v">${s.enemyHp}<small>/ ${s.enemyMaxHp}</small></span></div>
          </div>

          <div class="lg-label">四档分布</div>
          <div class="lg-dist-grid">
            ${dist.map((d) => `<div class="lg-dist-cell"><b class="tier-${d.k}">${d.label}</b><span>${d.n} 次</span></div>`).join('')}
          </div>

          ${s.mvp ? `<div class="lg-mvp">
            <div class="lg-label">MVP 魔咒</div>
            <div class="lg-mvp-phrase">${esc(s.mvp.phrase)}</div>
            <div class="card-sub">${esc(s.mvp.tierLabel)} · 单回合 ${s.mvp.damage} 点伤害</div>
          </div>` : ''}

          <div class="row wrap" style="gap:10px;justify-content:center;margin-top:22px">
            <button class="btn btn-primary" id="lg-battle-again">再战一场 ⚔️</button>
            <a class="btn" href="#/lingua">返回言灵首页</a>
          </div>
          <div class="card-sub" style="margin-top:14px">
            平均熟练度 ${out.overview.avgMastery}% · 已掌握 ${out.overview.mastered}/${out.overview.totalPhrases} · 连续 ${out.streak} 天
          </div>
        </div>
      </div>`);

    qs('#lg-battle-again').addEventListener('click', () => { lingBattle = null; renderLinguaBattle(); });
  }

  /* ---------------------------------------------------------------- 全局事件委托 */

  document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      e.preventDefault();
      navigate(nav.dataset.nav);
    }
  });

  /* ============================================================
   * 批次 1 新增：咒语魔法书 / 打卡本 / 小魔女档案
   * ============================================================ */

  // --- 辅助：30 天日历构建（周一开头） ---
  function buildMonthGrid(calendar) {
    const today = new Date();
    const cells = [];
    // 计算 30 天的第一天是周几，前面补 empty
    const firstDay = new Date();
    firstDay.setDate(today.getDate() - 29);
    const firstDow = firstDay.getDay() === 0 ? 7 : firstDay.getDay(); // 周一=1…周日=7
    for (let i = 1; i < firstDow; i++) cells.push({ empty: true });
    const tierEmoji = { super: '✨', normal: '🌟', weak: '💫', miss: '🍬' };
    for (const d of calendar) {
      const isToday = d.date === today.toISOString().slice(0, 10);
      if (!d.hasBattle) {
        cells.push({ date: d.date, empty: true, isToday });
      } else {
        cells.push({ date: d.date, tier: d.tier, emoji: tierEmoji[d.tier] || '', count: d.count, isToday, has: true });
      }
    }
    return cells;
  }

  // --- 咒语魔法书（可翻阅） ---
  let spellbookPage = 0;
  async function renderLinguaBook() {
    let data;
    try { data = await api('/api/lingua/calendar'); } catch { data = { phrases: [], masteryBuckets: {}, reviewBuckets: {} }; }
    const phrases = data.phrases || [];

    if (phrases.length === 0) {
      setView(`
        <div class="lg-wrap">
          <div class="spellbook">
            <div class="spellbook-cover">
              <h3 class="sb-title">📖 咒语魔法书</h3>
              <p class="sb-sub">翻开属于你的小魔女修炼记录</p>
            </div>
            <div class="empty" style="padding:40px 20px">
              <span class="ico">🧙‍♀️</span>
              <p>还没有学过咒语哦，去念第一条吧！</p>
              <button class="btn btn-primary" data-nav="#/lingua">去首页挑选咒语 →</button>
            </div>
          </div>
        </div>`);
      bindNav(); return;
    }

    // 按熟练度排序
    phrases.sort((a, b) => b.mastery - a.mastery);

    // 初始 page
    const total = phrases.length;
    if (spellbookPage >= total) spellbookPage = 0;

    const renderPage = (idx) => {
      const p = phrases[idx];
      const tierBadge = { super: '🧚 妖精级', normal: '🌟 完美', weak: '💫 稍弱', miss: '🍬 走神啦' };
      const tierLabel = p.battleBestTier ? tierBadge[p.battleBestTier] || '—' : '尚未战斗';
      const reviewLabel = !p.nextReviewAt ? '还没安排复习' :
        new Date(p.nextReviewAt) <= new Date() ? '✨ 今天该复习啦' :
        `下次复习：${p.nextReviewAt.slice(0, 10)}`;
      return `
        <div class="spell-page">
          <div class="lg-sticker s1">✨</div>
          <div class="lg-sticker s2">🧹</div>
          <h2 class="sp-title">${esc(p.phrase)}</h2>
          <div class="sp-def">${esc(p.simple_def || '')}</div>
          <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:14px 0">
            <div class="progress" style="flex:1;min-width:140px"><i style="width:${p.mastery}%"></i></div>
            <span style="font-weight:700;color:var(--text)">${p.mastery} / 100</span>
          </div>
          <div class="sp-stats">
            <span class="pill">🏆 ${esc(tierLabel)}</span>
            <span class="pill">📅 ${esc(reviewLabel)}</span>
            <button class="pill brand lg-go-learn" data-id="${p.id}" style="cursor:pointer;border-color:rgba(155,139,240,0.4);background:rgba(155,139,240,0.14)">
              🔮 回去再念一次
            </button>
          </div>
        </div>
      `;
    };

    const shellBook = (idx) => {
      setView(`
        <div class="lg-wrap">
          <div class="spellbook">
            <div class="lg-sticker hang">✨</div>
            ${renderPage(idx)}
            <div class="sb-nav">
              <button class="btn btn-ghost sb-prev" ${idx === 0 ? 'disabled' : ''}>‹ 上一页</button>
              <span class="page-indicator">第 ${idx + 1} / ${total} 条咒语</span>
              <button class="btn btn-ghost sb-next" ${idx === total - 1 ? 'disabled' : ''}>下一页 ›</button>
            </div>
          </div>
          <div style="display:flex;gap:var(--sp-3);margin-top:var(--sp-3);flex-wrap:wrap">
            ${phrases.map((p, i) => `
              <div class="spell-list-item" data-book-idx="${i}" style="padding:8px 14px;font-size:0.78rem;background:${i === idx ? 'rgba(155,139,240,0.18)' : '#FFFDF7'}">
                ${esc(p.phrase)} · ${p.mastery}分
              </div>
            `).join('')}
          </div>
        </div>`);
      bindNav();
      qs('.sb-prev')?.addEventListener('click', () => { spellbookPage = Math.max(0, idx - 1); shellBook(spellbookPage); });
      qs('.sb-next')?.addEventListener('click', () => { spellbookPage = Math.min(total - 1, idx + 1); shellBook(spellbookPage); });
      document.querySelectorAll('[data-book-idx]').forEach((el) => {
        el.addEventListener('click', () => { spellbookPage = Number(el.dataset.bookIdx); shellBook(spellbookPage); });
      });
      document.querySelectorAll('.lg-go-learn').forEach((el) => {
        el.addEventListener('click', () => { navigate(`#/lingua/learn/${el.dataset.id}`); });
      });
    };
    shellBook(spellbookPage);
  }

  // --- 打卡本（月视图 + 记忆曲线 + 熟练度分布） ---
  async function renderLinguaCalendar() {
    let data;
    try { data = await api('/api/lingua/calendar'); } catch { data = { calendar: [], masteryBuckets: {}, reviewBuckets: {}, streak: 0 }; }

    const cells = buildMonthGrid(data.calendar || []);
    const cellsHtml = cells.map((c) => {
      if (c.empty) return `<div class="cal-cell empty"></div>`;
      const cls = ['cal-cell'];
      if (c.has) cls.push('has');
      if (c.tier) cls.push(`t-${c.tier}`);
      if (c.isToday) cls.push('is-today');
      return `<div class="${cls.join(' ')}"
        ${c.tier ? `data-tier="${c.tier}"` : ''}
        data-emoji="${c.emoji || ''}"
        title="${c.date}${c.has ? ` · ${c.count} 场 · 最佳 ${c.tier}` : ' · 今日未修炼'}">
        ${c.date.slice(-2)}
      </div>`;
    }).join('');

    const mb = data.masteryBuckets || {};
    const rb = data.reviewBuckets || {};

    setView(`
      <div class="lg-wrap">
        <!-- 顶部魔法书封面 -->
        <div class="spellbook-cover" style="padding:32px;position:relative">
          <h3 class="sb-title">📅 小魔女打卡本</h3>
          <p class="sb-sub">${data.streak || 0} 天连续修炼 · 最近 30 天回顾</p>
        </div>

        <!-- 月视图 -->
        <div class="calendar-wrap">
          <span class="lg-sticker s2">🌙</span>
          <span class="lg-sticker s3">✨</span>
          <div class="section-head" style="margin-bottom:var(--sp-3)">
            <h2>🗓️ 30 天修炼日历</h2>
            <div class="spacer"></div>
            <span class="pill gold">🔥 连续 ${data.streak || 0} 天</span>
          </div>
          <div class="cal-head">
            <div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div><div>日</div>
          </div>
          <div class="cal-grid">${cellsHtml}</div>
          <div class="row wrap" style="gap:14px;margin-top:var(--sp-4);justify-content:center">
            <span class="pill gold">✨ 妖精级</span>
            <span class="pill green">🌟 完美</span>
            <span class="pill cyan">💫 稍弱</span>
            <span class="pill pink">🍬 走神</span>
          </div>
        </div>

        <!-- 复习时间分布 -->
        <div class="curve-wrap">
          <span class="lg-sticker s1">🧹</span>
          <div class="section-head" style="margin-bottom:var(--sp-3)">
            <h2>⏰ 复习时间分布</h2>
            <div class="spacer"></div>
            <span class="pill brand">记忆曲线提醒</span>
          </div>
          <div class="review-buckets">
            <div class="review-bucket rb-today"><div class="r-num">${rb.today || 0}</div><div class="r-label">今天到期</div></div>
            <div class="review-bucket rb-week"><div class="r-num">${rb.week || 0}</div><div class="r-label">7 天内</div></div>
            <div class="review-bucket rb-soon"><div class="r-num">${rb.soon || 0}</div><div class="r-label">30 天内</div></div>
            <div class="review-bucket rb-later"><div class="r-num">${rb.later || 0}</div><div class="r-label">以后再说</div></div>
          </div>
        </div>

        <!-- 熟练度分布 -->
        <div class="curve-wrap">
          <span class="lg-sticker s4">🪄</span>
          <div class="section-head" style="margin-bottom:var(--sp-3)">
            <h2>📈 咒语熟练度分布</h2>
            <div class="spacer"></div>
            <button class="btn btn-sm btn-primary" data-nav="#/lingua/book">📖 翻书</button>
          </div>
          <div class="curve-buckets">
            <div class="curve-bucket cb-novice"><div class="b-num">${mb.novice || 0}</div><div class="b-label">刚入门 0-20</div></div>
            <div class="curve-bucket cb-warming"><div class="b-num">${mb.warming || 0}</div><div class="b-label">加温中 20-40</div></div>
            <div class="curve-bucket cb-steady"><div class="b-num">${mb.steady || 0}</div><div class="b-label">稳定期 40-65</div></div>
            <div class="curve-bucket cb-fluent"><div class="b-num">${mb.fluent || 0}</div><div class="b-label">流利 65-85</div></div>
            <div class="curve-bucket cb-master"><div class="b-num">${mb.master || 0}</div><div class="b-label">刻入脑海 85+</div></div>
          </div>
        </div>
      </div>`);
      bindNav();
  }

  // --- 小魔女档案（综合统计 + 战斗分布） ---
  async function renderLinguaProfile() {
    let p, cal;
    try { p = await api('/api/lingua/profile'); } catch { p = { overview: {}, distribution: [], distribution: [], battles: 0, topPhrases: [] }; }
    try { cal = await api('/api/lingua/calendar'); } catch { cal = { calendar: [], masteryBuckets: {}, reviewBuckets: {}, streak: 0 }; }

    // 安全计算
    const mb = cal.masteryBuckets || {};
    const totalPhrases = (mb.novice||0)+(mb.warming||0)+(mb.steady||0)+(mb.fluent||0)+(mb.master||0);
    const langName = (p.language && p.language.name) || (typeof p.language === 'string' ? p.language : '咒语');
    const dist = (p.distribution || []).sort((a, b) => (TIER_RANK[b.tier] || 0) - (TIER_RANK[a.tier] || 0));
    const distHtml = dist.map((d) => {
      const pct = p.battles > 0 ? Math.round((d.count / p.battles) * 100) : 0;
      const tierBadge = { super: '🧚 妖精级', normal: '🌟 完美', weak: '💫 稍弱', miss: '🍬 走神啦' };
      return `<div style="display:flex;gap:var(--sp-3);align-items:center">
        <span style="min-width:80px;font-weight:700">${tierBadge[d.tier] || d.tier}</span>
        <div class="progress" style="flex:1"><i style="width:${pct}%"></i></div>
        <span style="min-width:60px;text-align:right;color:var(--text-dim);font-size:0.82rem">${d.count} 场 · ${pct}%</span>
      </div>`;
    }).join('');

    setView(`
      <div class="lg-wrap">
        <!-- 档案卡 -->
        <div class="spellbook" style="padding:var(--sp-8)">
          <span class="lg-sticker hang">🧙‍♀️</span>
          <div style="display:grid;grid-template-columns:120px 1fr;gap:var(--sp-5);align-items:center">
            <div style="width:120px;height:120px;border-radius:50%;background:var(--grad-brand);display:grid;place-content:center;font-size:3rem;color:#fff;box-shadow:0 8px 22px rgba(155,139,240,0.32)">🧙‍♀️</div>
            <div>
              <h2 style="margin:0;font-size:1.6rem;font-weight:800">小魔女档案</h2>
              <p style="color:var(--text-dim);margin:4px 0 14px">${langName}咒语修炼者</p>
              <div class="grid cols-3" style="gap:14px">
                <div class="metric"><span class="k">连续修炼</span><span class="v">${cal.streak || 0}<small>天</small></span></div>
                <div class="metric"><span class="k">累计战斗</span><span class="v">${p.battles || 0}<small>场</small></span></div>
                <div class="metric"><span class="k">修炼咒语</span><span class="v">${totalPhrases}<small>条</small></span></div>
              </div>
            </div>
          </div>
        </div>

        <!-- 战斗分布 -->
        <div class="card pad-lg">
          <div class="section-head"><h2>⚔️ 战斗判定分布</h2>
            <div class="spacer"></div>
            <button class="btn btn-sm btn-primary" data-nav="#/lingua/battle">再来一场</button>
          </div>
          <div class="stack" style="gap:10px">
            ${distHtml || '<div class="empty"><span class="ico">🍬</span>还没打过妖怪哦</div>'}
          </div>
        </div>

        <!-- 快捷入口 -->
        <div class="grid cols-3">
          <button class="card pad-lg hover" data-nav="#/lingua/book" style="text-align:center">
            <div style="font-size:2.4rem">📖</div>
            <div class="card-title" style="justify-content:center;margin-top:10px">咒语魔法书</div>
            <div class="card-sub">翻阅已学咒语</div>
          </button>
          <button class="card pad-lg hover" data-nav="#/lingua/calendar" style="text-align:center">
            <div style="font-size:2.4rem">📅</div>
            <div class="card-title" style="justify-content:center;margin-top:10px">打卡本</div>
            <div class="card-sub">30 天回顾 + 记忆曲线</div>
          </button>
          <button class="card pad-lg hover" data-nav="#/lingua" style="text-align:center">
            <div style="font-size:2.4rem">🪄</div>
            <div class="card-title" style="justify-content:center;margin-top:10px">咒语首页</div>
            <div class="card-sub">今日新咒语推荐</div>
          </button>
        </div>
      </div>`);
      bindNav();
  }

  // --- 批次 2 新增：群组学习页面 ---
  async function renderLinguaGroup(gid) {
    if (!gid) {
      // 群组列表页（我的所有群 + 创建/加入入口）
      let mine = [];
      try { mine = (await api('/api/group/my')).groups || []; } catch {}
      setView(`
        <div class="lg-wrap">
          <div class="spellbook-cover" style="padding:40px">
            <span class="lg-sticker hang">✨</span>
            <h3 class="sb-title">✨ 小魔女团</h3>
            <p class="sb-sub">一群小魔女一起修炼咒语，互相抽签、一起打卡！</p>
          </div>

          <div class="grid cols-2">
            <!-- 创建 -->
            <div class="card pad-lg">
              <div class="card-title">🧙‍♀️ 创建一个小魔女团</div>
              <p class="card-sub">成为团长，发布任务、抽签分配、验收打卡</p>
              <div class="field" style="margin-top:14px">
                <label>团名</label>
                <input id="lg-group-name" placeholder="例：咒语初级班" value="我的小魔女团">
              </div>
              <div class="field" style="margin-top:10px">
                <label>团徽 emoji</label>
                <input id="lg-group-emoji" placeholder="🧙‍♀️" value="🧙‍♀️">
              </div>
              <button class="btn btn-primary btn-block" id="lg-group-create" style="margin-top:14px">✨ 创建魔法团</button>
            </div>
            <!-- 加入 -->
            <div class="card pad-lg">
              <div class="card-title">🎫 加入已有的团</div>
              <p class="card-sub">团长会给你一个 6 位邀请码</p>
              <div class="field" style="margin-top:14px">
                <label>邀请码</label>
                <input id="lg-group-code" placeholder="例：WE9XF4" style="text-transform:uppercase">
              </div>
              <button class="btn btn-primary btn-block" id="lg-group-join" style="margin-top:14px">🚪 加入魔法团</button>
            </div>
          </div>

          ${mine.length ? `<div class="card pad-lg">
            <div class="section-head"><h2>📚 我的魔法团（${mine.length}）</h2></div>
            <div class="stack" style="gap:10px">
              ${mine.map((g) => `
                <div class="plan-item hover" data-nav="#/lingua/group/${g.id}">
                  <div class="pi">${g.emoji || '🪄'}</div>
                  <div style="flex:1;min-width:0">
                    <div class="pt">${esc(g.name)} ${g.role === 'leader' ? '👑' : ''}</div>
                    <div class="pr">${g.memberCount} 位小魔女 · 邀请码 <b style="font-family:monospace">${g.inviteCode}</b></div>
                  </div>
                  <span class="go">›</span>
                </div>`).join('')}
            </div>
          </div>` : `<div class="empty"><span class="ico">🌈</span>你还没有加入任何魔法团哦</div>`}
        </div>`);
      bindNav();
      document.getElementById('lg-group-create')?.addEventListener('click', async () => {
        const name = document.getElementById('lg-group-name').value.trim();
        const emoji = document.getElementById('lg-group-emoji').value.trim() || '🪄';
        if (!name) return alert('起个团名吧～');
        const r = await api('/api/group/create', 'POST', { name, emoji });
        if (r.ok) navigate(`#/lingua/group/${r.groupId}`);
        else alert(r.error || '创建失败');
      });
      document.getElementById('lg-group-join')?.addEventListener('click', async () => {
        const code = document.getElementById('lg-group-code').value.trim().toUpperCase();
        if (!code) return alert('输入邀请码吧～');
        const r = await api('/api/group/join', 'POST', { inviteCode: code });
        if (r.ok) navigate(`#/lingua/group/${r.groupId}`);
        else alert(r.error || '加入失败');
      });
      return;
    }

    // 群组详情页
    let g;
    try { g = await api(`/api/group/${gid}`); } catch { setView('<div class="empty"><span class="ico">💥</span>加载失败，团是不是没了？</div>'); return; }
    if (!g.ok) { setView(`<div class="empty"><span class="ico">❓</span>${g.error || '找不到这个魔法团'}</div>`); return; }
    const isLeader = g.myRole === 'leader';

    const checkinBtn = (tid, tStatus) => tStatus === 'open' || tStatus === 'drawn'
      ? `<button class="btn btn-primary btn-sm lg-checkin" data-task="${tid}">✍️ 打卡</button>`
      : `<span class="pill green">✅ 已打卡</span>`;

    setView(`
      <div class="lg-wrap">
        <div class="spellbook-cover" style="padding:28px;position:relative">
          <span class="lg-sticker hang">${g.group.emoji}</span>
          <div class="row" style="gap:var(--sp-4)">
            <div style="font-size:2.6rem">${g.group.emoji}</div>
            <div style="flex:1">
              <h3 class="sb-title">${esc(g.group.name)}</h3>
              <p class="sb-sub">${g.members.length} 位小魔女${isLeader ? ' · 👑 你是团长' : ''} · 邀请码 <b style="font-family:monospace;background:rgba(255,255,255,0.25);padding:2px 10px;border-radius:20px">${g.group.inviteCode}</b></p>
            </div>
            <button class="btn btn-ghost" data-nav="#/lingua/group">‹ 返回团列表</button>
          </div>
        </div>

        <div class="grid cols-2" style="align-items:start">
          <!-- 成员列表 -->
          <div class="card pad-lg">
            <div class="section-head"><h2>🧙‍♀️ 成员（${g.members.length}）</h2></div>
            <div class="stack" style="gap:8px">
              ${g.members.map((m) => `
                <div class="row" style="gap:12px;padding:10px 12px;background:#FFFDF7;border-radius:12px;border:1px solid var(--border)">
                  <div style="width:32px;height:32px;border-radius:50%;background:var(--grad-brand);color:#fff;display:grid;place-content:center;font-size:0.85rem;font-weight:700">${(m.userId || '?').slice(-2)}</div>
                  <div style="flex:1">
                    <div style="font-weight:650">${esc(m.role === 'leader' ? '👑 团长' : '小魔女')}</div>
                    <div style="font-size:0.72rem;color:var(--text-faint)">${m.battles || 0} 场战斗</div>
                  </div>
                </div>`).join('')}
            </div>
          </div>

          <!-- 今日任务 -->
          <div class="card pad-lg">
            <div class="section-head">
              <h2>📋 今日任务（${g.tasks.length}）</h2>
              <div class="spacer"></div>
              ${isLeader ? `<button class="btn btn-sm btn-primary" id="lg-new-task">➕ 发布任务</button>
                           <button class="btn btn-sm" id="lg-draw">🎲 抽签</button>` : ''}
            </div>
            ${g.tasks.length ? `<div class="stack" style="gap:10px">${g.tasks.map((t) => `
              <div style="padding:12px 14px;background:#FFFDF7;border-radius:12px;border:1px solid var(--border)">
                <div class="row" style="gap:10px">
                  <div style="flex:1">
                    <div style="font-weight:650">${esc(t.title)}</div>
                    <div style="font-size:0.75rem;color:var(--text-faint);margin-top:2px">
                      发布：${esc(t.authorName || '团长')} · ${t.verifyType === 'spell' ? '咒语验证' : t.verifyType === 'photo' ? '照片验证' : '自行确认'}
                      ${t.assigneeName ? ` · 指派：${esc(t.assigneeName)}` : ''}
                    </div>
                  </div>
                  ${checkinBtn(t.id, t.status)}
                </div>
              </div>`).join('')}</div>` : '<div class="card-sub">还没有任务，团长发布第一个吧 ✨</div>'}
          </div>
        </div>

        <!-- 批次 4：飞书风甘特图（任务时间轴） -->
        ${g.tasks.length ? `
        <div class="card pad-lg">
          <div class="section-head"><h2>📊 任务甘特图</h2>
            <div class="spacer"></div>
            <span class="pill cyan">${g.tasks.length} 个任务 · ${g.tasks.filter((t)=>t.status==='done').length} 已完成</span>
          </div>
          <div class="gantt-wrap">
            ${(() => {
              // 计算时间轴跨度：从最早 created_at 到最晚 due_date（或 created_at+7天）
              const now = new Date();
              const starts = g.tasks.map((t) => new Date(t.createdAt || now).getTime());
              const ends = g.tasks.map((t) => {
                if (t.dueDate) return new Date(t.dueDate).getTime();
                return new Date((t.createdAt || now)).getTime() + 7 * 86400000;
              });
              const minT = Math.min(...starts, now.getTime() - 86400000 * 2);
              const maxT = Math.max(...ends, now.getTime() + 86400000 * 2);
              const span = Math.max(86400000, maxT - minT);
              const todayPct = Math.max(0, Math.min(100, ((now.getTime() - minT) / span) * 100));
              const barCls = (s) => s === 'done' ? 'done' : s === 'drawn' ? 'drawn' : '';
              return g.tasks.map((t) => {
                const sT = new Date(t.createdAt || now).getTime();
                const eT = t.dueDate ? new Date(t.dueDate).getTime() : sT + 7 * 86400000;
                const left = ((sT - minT) / span) * 100;
                const w = Math.max(4, ((eT - sT) / span) * 100);
                return `<div class="gantt-row">
                  <div class="gantt-name">${esc(t.title)}${t.status === 'done' ? ' ✅' : t.status === 'drawn' ? ' 🎲' : ''}</div>
                  <div class="gantt-bar-wrap" style="position:relative">
                    <div class="gantt-bar ${barCls(t.status)}" style="left:${left}%;width:${w}%">${esc(t.title)}</div>
                    <div style="position:absolute;top:-14px;bottom:-4px;width:2px;background:rgba(251,113,133,0.55);left:${todayPct}%">
                      <span style="position:absolute;top:-14px;left:-12px;font-size:0.62rem;color:var(--danger);font-weight:700">今天</span>
                    </div>
                  </div>
                </div>`;
              }).join('');
            })()}
          </div>
        </div>` : ''}
      </div>`);
      bindNav();
      // 打卡
      document.querySelectorAll('.lg-checkin').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const tid = btn.dataset.task;
          const r = await api(`/api/group/${gid}/checkin/${tid}`, 'POST', { note: '' });
          if (r.ok) renderLinguaGroup(gid);
          else alert(r.error || '打卡失败');
        });
      });
      // 抽签
      document.getElementById('lg-draw')?.addEventListener('click', async () => {
        const r = await api(`/api/group/${gid}/draw`, 'POST');
        if (r.ok) renderLinguaGroup(gid);
        else alert(r.error || '抽签失败');
      });
      // 发布任务（简易弹窗）
      document.getElementById('lg-new-task')?.addEventListener('click', async () => {
        const title = prompt('任务名称（例：练 5 条咒语）：');
        if (!title) return;
        const verifyType = prompt('验证方式（spell 咒语 / photo 照片 / self 自行）：', 'spell');
        const r = await api(`/api/group/${gid}/task`, 'POST', { title, verifyType: verifyType || 'spell' });
        if (r.ok) renderLinguaGroup(gid);
        else alert(r.error || '发布失败');
      });
  }

  // 批次 2：在 lingua 首页加群组入口卡
  // （复用之前插入的 cols-3 grid，追加第 4 张卡 → 改成 cols-4）
  function _patchLinguaHomeGroup() { /* placeholder — 已在 renderLinguaHome 模板插入 */ }

  /* ---------------------------------------------------------------- Win98 任务栏 / 时钟 / 开始菜单 */

  function ensureWin98Taskbar() {
    if (document.getElementById('w98-taskbar')) return;
    const bar = document.createElement('div');
    bar.id = 'w98-taskbar';
    bar.className = 'w98-taskbar';
    bar.innerHTML = `
      <button class="w98-start-btn" id="w98-start-btn">
        <span class="w98-flag"><span></span><span></span></span>
        <span>开始</span>
      </button>
      <div class="w98-taskbar-sep"></div>
      <div class="w98-taskbar-windows">
        <button class="w98-task-btn active" id="w98-task-home">🏠 缪萨克斯集市</button>
      </div>
      <div class="w98-tray">
        <span class="w98-tray-icon">🔊</span>
        <span class="w98-tray-icon">📶</span>
        <span class="w98-clock" id="w98-clock">--:--</span>
      </div>
    `;
    document.body.appendChild(bar);

    // 开始菜单 DOM
    const menu = document.createElement('div');
    menu.id = 'w98-start-menu';
    menu.className = 'w98-start-menu';
    menu.innerHTML = `
      <div class="w98-start-menu-header">
        <span class="w98-flag"></span>
        <span>缪萨克斯集市</span>
      </div>
      <button class="w98-start-menu-item" data-act="home">
        <span class="w98-icon">🏠</span><span>进入集市</span>
      </button>
      <button class="w98-start-menu-item" data-act="courses">
        <span class="w98-icon">📚</span><span>完整课程</span>
      </button>
      <button class="w98-start-menu-item" data-act="lingua">
        <span class="w98-icon">🎮</span><span>学语言</span>
      </button>
      <div class="w98-start-menu-sep"></div>
      <button class="w98-start-menu-item" data-act="about">
        <span class="w98-icon">ℹ️</span><span>关于忒拉蓬</span>
      </button>
      <button class="w98-start-menu-item" data-act="azimish">
        <span class="w98-icon">👤</span><span>关于 azimish</span>
      </button>
      <div class="w98-start-menu-sep"></div>
      <button class="w98-start-menu-item" data-act="settings">
        <span class="w98-icon">⚙️</span><span>控制面板</span>
      </button>
      <button class="w98-start-menu-item" data-act="shutdown">
        <span class="w98-icon">⏻</span><span>关闭集市…</span>
      </button>
    `;
    document.body.appendChild(menu);

    // 事件绑定
    document.getElementById('w98-start-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('open');
      document.getElementById('w98-start-btn').classList.toggle('pressed', menu.classList.contains('open'));
    });
    document.addEventListener('click', () => {
      menu.classList.remove('open');
      document.getElementById('w98-start-btn').classList.remove('pressed');
    });
    document.getElementById('w98-task-home').addEventListener('click', () => navigate('#/'));

    menu.querySelectorAll('.w98-start-menu-item').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = btn.dataset.act;
        menu.classList.remove('open');
        document.getElementById('w98-start-btn').classList.remove('pressed');
        switch (act) {
          case 'home': navigate('#/'); break;
          case 'courses': navigate('#/courses'); break;
          case 'lingua': navigate('#/lingua'); break;
          case 'about': navigate('#/about'); break;
          case 'azimish': navigate('#/azimish'); break;
          case 'settings': alert('🚫 控制面板还没做。在 Win98 里这个按钮本来也经常是空的 😄'); break;
          case 'shutdown': if (confirm('确定要关闭缪萨克斯集市吗？')) { window.close(); setTimeout(() => { location.href = 'about:blank'; }, 300); } break;
        }
      });
    });
  }

  function startWin98Clock() {
    if (window.__w98ClockStarted) return;
    window.__w98ClockStarted = true;
    const tick = () => {
      const el = document.getElementById('w98-clock');
      if (!el) return;
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      el.textContent = `${hh}:${mm}`;
    };
    tick();
    setInterval(tick, 30000); // 半分钟更新一次
  }

  /* ---------------------------------------------------------------- 渲染入口 */

  async function render() {
    const route = parseRoute();
    state.route = route.name;

    // === Win98 开机画面 + 任务栏 + 时钟 ===
    // 首次进入时显示开机画面（只播一次）
    if (!window.__w98Booted) {
      window.__w98Booted = true;
      const oldBoot = document.querySelector('#app > .boot');
      if (oldBoot) oldBoot.style.display = 'none';
      const w98boot = document.getElementById('w98-boot');
      if (w98boot) w98boot.style.display = 'flex';
      // 3.5s 后 CSS 动画自动淡出；2 秒后彻底移除
      setTimeout(() => {
        if (w98boot) { w98boot.style.display = 'none'; }
      }, 6000);
    }

    // 默认加 Win98 皮肤（主页 + 语言学习模块）
    document.body.classList.add('win98');

    // 注入 Win98 任务栏 + 开始菜单（只注入一次）
    ensureWin98Taskbar();
    // 启动时钟
    startWin98Clock();

    if (!state.user) {
      try {
        const me = await api('/api/auth/me');
        state.user = me.user;
      } catch {
        state.user = null;
      }
    }

    if (!state.user) { renderAuth(); return; }

    const uOnboarded = state.user?.profile?.onboarded ?? false;
    if (!uOnboarded && route.name !== 'onboarding') {
      navigate('#/onboarding');
      return;
    }
    if (route.name === 'onboarding' && uOnboarded) {
      // 允许主动重进引导页
    }

    try {
      // 加载工具小市场注册表（懒加载，只 fetch 一次）
      await ensureApps();

      // 通用工具应用检测：route.name 命中已注册 enabled 应用 → 走 iframe 渲染器
      const enabledApps = (state.apps || []).filter((a) => a.enabled !== false);
      const toolApp = enabledApps.find((a) => a.id === route.name);
      if (toolApp) {
        document.body.classList.remove('win98'); // 子应用有自己的 UI
        state.meta = { title: toolApp.name, sub: toolApp.desc };
        renderToolApp(toolApp);
        return; // 提前 return，不走 switch
      }
      // 兜底：apps.json 加载失败但用户访问 /time
      if (route.name === 'time' && (!state.apps || state.apps.length === 0)) {
        document.body.classList.remove('win98'); // 子应用有自己的 UI
        state.meta = { title: '精细时间管理', sub: '日/周双视图 · 拖拽创建 · 标签系统' };
        renderToolApp({ ...LEGACY_TIME, path: '/time/' });
        return;
      }

      switch (route.name) {
        case 'onboarding': renderOnboarding(); break;
        case 'home': {
          state.meta = CORE_NAV[0];
          shell('<div class="empty"><span class="ico">⏳</span>加载中…</div>');
          await renderHome();
          injectLinguaEntry();
          break;
        }
        case 'courses': {
          state.meta = CORE_NAV[1];
          shell('<div class="empty"><span class="ico">⏳</span>加载中…</div>');
          await renderCourses();
          break;
        }
        case 'course': {
          state.meta = { title: '课程详情', sub: '按顺序完成课节' };
          shell('<div class="empty"><span class="ico">⏳</span>加载中…</div>');
          await renderCourseDetail(route.param);
          break;
        }
        case 'lesson': {
          state.meta = { title: '沉浸式学习中', sub: '完成全部练习即可结算经验值' };
          shell('<div class="empty"><span class="ico">⏳</span>加载中…</div>');
          await renderLesson(route.param);
          break;
        }
        case 'review': {
          state.meta = CORE_NAV[2];
          shell('<div class="empty"><span class="ico">⏳</span>加载中…</div>');
          await renderReview();
          break;
        }
        case 'community': {
          state.meta = CORE_NAV[3];
          shell('<div class="empty"><span class="ico">⏳</span>加载中…</div>');
          await renderCommunity();
          break;
        }
        case 'post': {
          state.meta = { title: '帖子详情', sub: '参与讨论，共学共进' };
          shell('<div class="empty"><span class="ico">⏳</span>加载中…</div>');
          await renderPost(route.param);
          break;
        }
        case 'achievements': {
          state.meta = CORE_NAV[4];
          shell('<div class="empty"><span class="ico">⏳</span>加载中…</div>');
          await renderAchievements();
          break;
        }
        case 'profile': {
          state.meta = PROFILE_NAV;
          shell('<div class="empty"><span class="ico">⏳</span>加载中…</div>');
          await renderProfile();
          break;
        }
        case 'lingua': {
          maybeShowLinguaNotice();
          const sub = route.parts[1];
          if (sub === 'learn') {
            awaitingLessonShell('言灵魔法 · 学习', '六步掌握一条咒语');
            await renderLinguaLearn(route.parts[2]);
          } else if (sub === 'battle') {
            awaitingLessonShell('言灵魔法 · 战斗', '说出正确咒语，让魔法生效');
            await renderLinguaBattle();
          } else if (sub === 'book') {
            awaitingLessonShell('🪄 咒语魔法书', '翻阅你学过的每一条咒语');
            await renderLinguaBook();
          } else if (sub === 'calendar') {
            awaitingLessonShell('📅 打卡本', '30 天修炼回顾 · 记忆曲线');
            await renderLinguaCalendar();
          } else if (sub === 'profile') {
            awaitingLessonShell('🧙‍♀️ 小魔女档案', '你的魔法修炼全纪录');
            await renderLinguaProfile();
          } else if (sub === 'group') {
            awaitingLessonShell('✨ 小魔女团', '群组修炼 · 一起念咒语');
            await renderLinguaGroup(route.parts[2]);
          } else {
            awaitingLessonShell('言灵魔法', '英语专属 · 沉浸式咒语训练');
            await renderLinguaHome();
          }
          break;
        }
        default: {
          state.meta = CORE_NAV[0];
          shell('<div class="empty"><span class="ico">⏳</span>加载中…</div>');
          await renderHome();
          injectLinguaEntry();
        }
      }
    } catch (err) {
      if (!state.user) { renderAuth(); return; }
      state.meta = state.meta.title ? state.meta : { title: '出错了', sub: '' };
      shell(`<div class="empty"><span class="ico">⚠️</span>${esc(err.message)}
        <div style="margin-top:16px"><a class="btn" href="#/home">回到首页</a></div></div>`);
    }
  }

  // 启动
  render();
})();
