'use strict';

/**
 * 全部业务 API 路由。
 * 覆盖：认证、分级课程、互动学习模块（词汇 SRS / 语法 / 口语跟读 / 听力）、
 * 学习进度追踪、个性化路径推荐、社区与成就系统。
 */

const { q } = require('./db');
const { HttpError, route } = require('./http');
const A = require('./auth');

/* ------------------------------------------------------------------ *
 * 通用工具
 * ------------------------------------------------------------------ */

const MODULES = ['vocabulary', 'grammar', 'speaking', 'listening'];
const MODULE_LABEL = {
  vocabulary: '单词记忆', grammar: '语法练习', speaking: '口语跟读', listening: '听力训练',
};

// Level 常量从共享模块导入（单一数据源，前后端共用）
const { LEVEL_STEPS, LEVEL_TITLES, computeLevel } = require('./constants');

function parseJson(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function todayStr(date = new Date()) {
  return new Date(date.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}
function yesterdayStr() {
  return todayStr(new Date(Date.now() - 86400_000));
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', '#0ea5e9', '#f59e0b', '#84cc16'];
function pickColor(seed) {
  let h = 0;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return COLORS[h % COLORS.length];
}

function ensureProfile(userId) {
  let p = q.get('SELECT * FROM profiles WHERE user_id=?', userId);
  if (!p) {
    q.run('INSERT INTO profiles (user_id) VALUES (?)', userId);
    p = q.get('SELECT * FROM profiles WHERE user_id=?', userId);
  }
  return p;
}

function ensureStats(userId) {
  let s = q.get('SELECT * FROM user_stats WHERE user_id=?', userId);
  if (!s) {
    q.run('INSERT INTO user_stats (user_id) VALUES (?)', userId);
    s = q.get('SELECT * FROM user_stats WHERE user_id=?', userId);
  }
  return s;
}

function targetLangs(userId) {
  const langs = parseJson(ensureProfile(userId).target_langs, ['en']);
  return Array.isArray(langs) && langs.length ? langs : ['en'];
}

/* ------------------------------------------------------------------ *
 * 成就系统
 * ------------------------------------------------------------------ */

function computeMetrics(userId) {
  const stats = ensureStats(userId);
  const lessons = q.get(
    `SELECT COUNT(*) AS n FROM lesson_progress WHERE user_id=? AND status='completed'`, userId).n;
  const perfect = q.get(
    `SELECT COUNT(*) AS n FROM lesson_progress WHERE user_id=? AND best_score=100`, userId).n;
  const wordsMastered = q.get(
    `SELECT COUNT(*) AS n FROM cards WHERE user_id=? AND status='mastered'`, userId).n;
  const byModule = (m) => q.get(
    `SELECT COUNT(DISTINCT p.lesson_id) AS n
       FROM lesson_progress p JOIN lessons l ON l.id=p.lesson_id
      WHERE p.user_id=? AND p.status='completed' AND l.module=?`, userId, m).n;
  const languages = q.get(
    `SELECT COUNT(DISTINCT c.lang) AS n
       FROM lesson_progress p JOIN lessons l ON l.id=p.lesson_id JOIN courses c ON c.id=l.course_id
      WHERE p.user_id=? AND p.status='completed'`, userId).n;
  const posts = q.get(`SELECT COUNT(*) AS n FROM posts WHERE user_id=?`, userId).n;
  return {
    xp: stats.xp,
    streak: stats.best_streak,
    current_streak: stats.streak,
    lessons,
    perfect,
    words_mastered: wordsMastered,
    speaking: byModule('speaking'),
    listening: byModule('listening'),
    languages,
    posts,
  };
}

/** 检查并解锁新成就，返回本次新解锁的成就列表 */
function checkAchievements(userId) {
  const metrics = computeMetrics(userId);
  const defs = q.all('SELECT * FROM achievements ORDER BY sort_order');
  const owned = new Set(q.all('SELECT code FROM user_achievements WHERE user_id=?', userId).map((r) => r.code));
  const unlocked = [];
  const stmt = q; // eslint-disable-line
  for (const def of defs) {
    if (owned.has(def.code)) continue;
    const value = metrics[def.metric];
    if (typeof value === 'number' && value >= def.threshold) {
      q.run('INSERT OR IGNORE INTO user_achievements (user_id,code,unlocked_at) VALUES (?,?,?)',
        userId, def.code, A.nowIso());
      unlocked.push({ ...def, value });
    }
  }
  return unlocked;
}

/* ------------------------------------------------------------------ *
 * 学习记录与统计
 * ------------------------------------------------------------------ */

function logStudy(userId, { lang, module, minutes, xp, correct, total }) {
  const date = todayStr();
  q.run(
    `INSERT INTO study_log (user_id,lang,module,minutes,xp,correct,total,study_date,created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    userId, lang || null, module || null, minutes || 0, xp || 0, correct || 0, total || 0,
    date, A.nowIso()
  );
}

/** 结算经验、连续打卡天数 */
function award(userId, xp, minutes) {
  const stats = ensureStats(userId);
  const date = todayStr();
  let streak = stats.streak;
  if (stats.last_study_date !== date) {
    streak = stats.last_study_date === yesterdayStr() ? stats.streak + 1 : 1;
  }
  const best = Math.max(stats.best_streak, streak);
  q.run(
    `UPDATE user_stats SET xp = xp + ?, streak = ?, best_streak = ?, last_study_date = ?,
       total_minutes = total_minutes + ? WHERE user_id = ?`,
    xp, streak, best, date, minutes, userId
  );
  const fresh = ensureStats(userId);
  return { ...fresh, ...computeLevel(fresh.xp) };
}

function buildUser(userId) {
  const u = q.get('SELECT id,email,nickname,avatar_color,created_at FROM users WHERE id=?', userId);
  if (!u) throw new HttpError(404, '用户不存在');
  const profile = ensureProfile(userId);
  const stats = ensureStats(userId);
  const unlocked = q.all(
    `SELECT a.*, ua.unlocked_at FROM user_achievements ua
       JOIN achievements a ON a.code = ua.code WHERE ua.user_id=? ORDER BY a.sort_order`, userId);
  return {
    id: u.id,
    email: u.email,
    nickname: u.nickname,
    avatar_color: u.avatar_color,
    created_at: u.created_at,
    profile: { ...profile, target_langs: parseJson(profile.target_langs, ['en']) },
    stats: { ...stats, ...computeLevel(stats.xp) },
    achievements: unlocked,
  };
}
/* ------------------------------------------------------------------ *
 * 语言与课程（分级课程体系）
 * ------------------------------------------------------------------ */

function lessonStatsForLang(userId, lang) {
  const total = q.get(
    `SELECT COUNT(*) AS n FROM lessons l JOIN courses c ON c.id=l.course_id WHERE c.lang=?`, lang).n;
  if (!userId) return { total: Number(total), completed: 0, percent: 0 };
  const completed = q.get(
    `SELECT COUNT(*) AS n FROM lesson_progress p JOIN lessons l ON l.id=p.lesson_id
       JOIN courses c ON c.id=l.course_id WHERE p.user_id=? AND p.status='completed' AND c.lang=?`,
    userId, lang).n;
  return {
    total: Number(total),
    completed: Number(completed),
    percent: total ? Math.round((Number(completed) / Number(total)) * 100) : 0,
  };
}

route('GET', '/api/languages', async (ctx) => {
  const users = ctx.user ? ctx.user.id : null;
  const langs = q.all('SELECT * FROM languages ORDER BY CASE code WHEN \'en\' THEN 1 WHEN \'ja\' THEN 2 WHEN \'ko\' THEN 3 ELSE 9 END, code');
  return {
    languages: langs.map((l) => ({
      ...l,
      courses: q.get('SELECT COUNT(*) AS n FROM courses WHERE lang=?', l.code).n,
      words: q.get('SELECT COUNT(*) AS n FROM words WHERE lang=?', l.code).n,
      progress: lessonStatsForLang(users, l.code),
    })),
  };
});

route('GET', '/api/courses', async (ctx) => {
  const uid = ctx.user ? ctx.user.id : null;
  const lang = ctx.query.lang;
  const rows = lang
    ? q.all('SELECT * FROM courses WHERE lang=? ORDER BY level_order', lang)
    : q.all('SELECT * FROM courses ORDER BY lang, level_order');
  return {
    courses: rows.map((c) => {
      const total = q.get('SELECT COUNT(*) AS n FROM lessons WHERE course_id=?', c.id).n;
      const completed = uid
        ? q.get(`SELECT COUNT(*) AS n FROM lesson_progress WHERE user_id=? AND status='completed'
                   AND lesson_id IN (SELECT id FROM lessons WHERE course_id=?)`, uid, c.id).n
        : 0;
      return {
        ...c,
        lessons: Number(total),
        completed: Number(completed),
        percent: total ? Math.round((Number(completed) / Number(total)) * 100) : 0,
      };
    }),
  };
});

route('GET', '/api/courses/:id', async (ctx) => {
  const uid = ctx.user ? ctx.user.id : null;
  const course = q.get('SELECT * FROM courses WHERE id=?', Number(ctx.params.id));
  if (!course) throw new HttpError(404, '课程不存在');
  const lessons = q.all('SELECT * FROM lessons WHERE course_id=? ORDER BY order_index', course.id);
  const progress = uid
    ? q.all(`SELECT lesson_id,status,best_score,attempts FROM lesson_progress WHERE user_id=?`, uid)
    : [];
  const map = new Map(progress.map((p) => [p.lesson_id, p]));
  return {
    course,
    lessons: lessons.map((l) => {
      const p = map.get(l.id);
      return {
        ...l,
        moduleLabel: MODULE_LABEL[l.module] || l.module,
        status: p ? p.status : 'locked',
        best_score: p ? p.best_score : 0,
        attempts: p ? p.attempts : 0,
        exerciseCount: q.get('SELECT COUNT(*) AS n FROM exercises WHERE lesson_id=?', l.id).n,
      };
    }),
  };
});

route('GET', '/api/lessons/:id', async (ctx) => {
  const uid = ctx.user ? ctx.user.id : null;
  const lesson = q.get('SELECT * FROM lessons WHERE id=?', Number(ctx.params.id));
  if (!lesson) throw new HttpError(404, '课节不存在');
  const course = q.get('SELECT * FROM courses WHERE id=?', lesson.course_id);
  const raw = q.all('SELECT * FROM exercises WHERE lesson_id=? ORDER BY order_index', lesson.id);
  const progress = uid
    ? q.get('SELECT * FROM lesson_progress WHERE user_id=? AND lesson_id=?', uid, lesson.id) : null;
  return {
    lesson: { ...lesson, moduleLabel: MODULE_LABEL[lesson.module] || lesson.module },
    course,
    language: q.get('SELECT * FROM languages WHERE code=?', course.lang),
    progress,
    exercises: raw.map((e) => ({
      id: e.id,
      order_index: e.order_index,
      type: e.type,
      prompt: e.prompt,
      prompt_translation: e.prompt_translation,
      audio: e.audio,
      options: e.options ? parseJson(e.options, []) : null,
      answer: e.answer,
      explanation: e.explanation,
      hint: e.hint,
    })),
  };
});

route('GET', '/api/words', async (ctx) => {
  const lang = ctx.query.lang;
  const level = ctx.query.level;
  const limit = Math.min(Number(ctx.query.limit) || 100, 300);
  const clauses = [];
  const params = [];
  if (lang) { clauses.push('lang=?'); params.push(lang); }
  if (level) { clauses.push('level=?'); params.push(level); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { words: q.all(`SELECT * FROM words ${where} ORDER BY level, id LIMIT ?`, ...params, limit) };
});

/* ------------------------------------------------------------------ *
 * 互动学习模块：课节完成结算
 * ------------------------------------------------------------------ */

route('POST', '/api/lessons/:id/complete', async (ctx) => {
  const uid = ctx.user.id;
  const lessonId = Number(ctx.params.id);
  const lesson = q.get('SELECT * FROM lessons WHERE id=?', lessonId);
  if (!lesson) throw new HttpError(404, '课节不存在');
  const course = q.get('SELECT * FROM courses WHERE id=?', lesson.course_id);

  const total = Math.max(0, Number(ctx.body.total) || 0);
  const correct = Math.min(total, Math.max(0, Number(ctx.body.correct) || 0));
  const minutes = Math.min(60, Math.max(0.2, Number(ctx.body.minutes) || lesson.duration_min));
  const score = total ? Math.round((correct / total) * 100) : 100;

  const baseXp = lesson.xp;
  let xp = Math.max(2, Math.round(baseXp * (0.5 + 0.5 * (score / 100))));
  if (score === 100) xp += 5;

  const prev = q.get('SELECT * FROM lesson_progress WHERE user_id=? AND lesson_id=?', uid, lessonId);
  if (prev) {
    q.run(`UPDATE lesson_progress SET status='completed', best_score=MAX(best_score,?), attempts=attempts+1,
             last_at=?, completed_at=COALESCE(completed_at,?) WHERE user_id=? AND lesson_id=?`,
      score, A.nowIso(), A.nowIso(), uid, lessonId);
  } else {
    q.run(`INSERT INTO lesson_progress (user_id,lesson_id,status,best_score,attempts,last_at,completed_at)
           VALUES (?,?,'completed',?,1,?,?)`, uid, lessonId, score, A.nowIso(), A.nowIso());
  }

  logStudy(uid, { lang: course.lang, module: lesson.module, minutes, xp, correct, total });
  const stats = award(uid, xp, minutes);
  const unlocked = checkAchievements(uid);
  return {
    score, correct, total, xpGained: xp, stats, unlocked,
    message: score === 100 ? '完美通关！' : score >= 80 ? '表现很棒！' : '继续加油，再来一次会更好。',
  };
}, { auth: true });

/* ------------------------------------------------------------------ *
 * 单词记忆：间隔重复（SM-2 简化版）
 * ------------------------------------------------------------------ */

function ensureCards(userId, limit = 10) {
  const langs = targetLangs(userId);
  const placement = ensureProfile(userId).placement;
  const ph = langs.map(() => '?').join(',');
  const rows = q.all(
    `SELECT w.id FROM words w
      WHERE w.lang IN (${ph})
        AND NOT EXISTS (SELECT 1 FROM cards c WHERE c.user_id=? AND c.word_id=w.id)
      ORDER BY CASE w.level WHEN ? THEN 0 ELSE 1 END, w.level, w.id LIMIT ?`,
    ...langs, userId, placement, limit);
  for (const r of rows) {
    q.run(`INSERT INTO cards (user_id,word_id,status,due_at,ease,interval_days,reps,lapses)
           VALUES (?,?,'new',?,2.5,0,0,0)`, userId, r.id, A.nowIso());
  }
}

function reviewQueue(userId, limit, lang) {
  const params = [userId, A.nowIso()];
  let langClause = '';
  if (lang) { langClause = 'AND w.lang=?'; params.push(lang); }
  params.push(limit);
  return q.all(
    `SELECT c.word_id, c.ease, c.interval_days, c.reps, c.lapses, c.due_at, c.status,
            w.word, w.reading, w.meaning, w.pos, w.example, w.example_translation, w.lang, w.level
       FROM cards c JOIN words w ON w.id = c.word_id
      WHERE c.user_id=? AND (c.due_at IS NULL OR c.due_at <= ?) ${langClause}
      ORDER BY CASE c.status WHEN 'learning' THEN 0 WHEN 'new' THEN 1 ELSE 2 END, c.due_at
      LIMIT ?`, ...params);
}

route('GET', '/api/review/queue', async (ctx) => {
  const uid = ctx.user.id;
  const limit = Math.min(Number(ctx.query.limit) || 20, 60);
  ensureCards(uid, 10);
  const cards = reviewQueue(uid, limit, ctx.query.lang);
  const counts = {
    due: q.get(`SELECT COUNT(*) AS n FROM cards c JOIN words w ON w.id=c.word_id
                 WHERE c.user_id=? AND (c.due_at IS NULL OR c.due_at<=?)${ctx.query.lang ? ' AND w.lang=?' : ''}`,
      uid, A.nowIso(), ...(ctx.query.lang ? [ctx.query.lang] : [])).n,
    learning: q.get(`SELECT COUNT(*) AS n FROM cards WHERE user_id=? AND status='learning'`, uid).n,
    mastered: q.get(`SELECT COUNT(*) AS n FROM cards WHERE user_id=? AND status='mastered'`, uid).n,
    total: q.get('SELECT COUNT(*) AS n FROM cards WHERE user_id=?', uid).n,
  };
  return {
    cards: cards.map((c) => ({
      word_id: c.word_id, word: c.word, reading: c.reading, meaning: c.meaning, pos: c.pos,
      example: c.example, example_translation: c.example_translation, lang: c.lang, level: c.level,
      status: c.status, reps: c.reps,
    })),
    counts,
  };
}, { auth: true });

route('POST', '/api/review/submit', async (ctx) => {
  const uid = ctx.user.id;
  const wordId = Number(ctx.body.word_id);
  const quality = Math.max(0, Math.min(5, Number(ctx.body.quality) || 0));
  const card = q.get('SELECT * FROM cards WHERE user_id=? AND word_id=?', uid, wordId);
  if (!card) throw new HttpError(404, '该单词不在你的复习库中');
  const word = q.get('SELECT * FROM words WHERE id=?', wordId);

  let { ease, interval_days: interval, reps, lapses } = card;
  let status;
  if (quality < 3) {
    reps = 0;
    interval = 0.5;
    lapses += 1;
    ease = Math.max(1.3, ease - 0.2);
    status = 'learning';
  } else {
    reps += 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.min(365, Math.round(Math.max(1, interval) * ease));
    ease = Math.max(1.3, Math.min(2.8, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))));
    status = interval >= 21 ? 'mastered' : 'review';
  }
  const dueAt = new Date(Date.now() + interval * 86400_000).toISOString();
  q.run(`UPDATE cards SET ease=?, interval_days=?, reps=?, lapses=?, due_at=?, status=?, last_review=?
         WHERE user_id=? AND word_id=?`,
    ease, interval, reps, lapses, dueAt, status, A.nowIso(), uid, wordId);

  const xp = quality >= 4 ? 5 : quality === 3 ? 3 : 1;
  logStudy(uid, {
    lang: word.lang, module: 'vocabulary', minutes: 0.3, xp,
    correct: quality >= 3 ? 1 : 0, total: 1,
  });
  const stats = award(uid, xp, 0.3);
  const unlocked = checkAchievements(uid);
  return {
    card: { word_id: wordId, ease, interval_days: interval, reps, lapses, due_at: dueAt, status },
    xpGained: xp, stats, unlocked,
  };
}, { auth: true });

/* ------------------------------------------------------------------ *
 * 学习进度追踪
 * ------------------------------------------------------------------ */

route('GET', '/api/progress/overview', async (ctx) => {
  const uid = ctx.user.id;
  const stats = ensureStats(uid);
  const today = todayStr();
  const todayRow = q.get(
    `SELECT COALESCE(SUM(minutes),0) AS minutes, COALESCE(SUM(xp),0) AS xp, COUNT(*) AS sessions
       FROM study_log WHERE user_id=? AND study_date=?`, uid, today);
  const totals = {
    lessonsCompleted: q.get(`SELECT COUNT(*) AS n FROM lesson_progress WHERE user_id=? AND status='completed'`, uid).n,
    wordsTotal: q.get('SELECT COUNT(*) AS n FROM cards WHERE user_id=?', uid).n,
    wordsDue: q.get(`SELECT COUNT(*) AS n FROM cards WHERE user_id=? AND (due_at IS NULL OR due_at<=?)`, uid, A.nowIso()).n,
    wordsMastered: q.get(`SELECT COUNT(*) AS n FROM cards WHERE user_id=? AND status='mastered'`, uid).n,
    posts: q.get('SELECT COUNT(*) AS n FROM posts WHERE user_id=?', uid).n,
    achievements: q.get('SELECT COUNT(*) AS n FROM user_achievements WHERE user_id=?', uid).n,
    perfect: q.get('SELECT COUNT(*) AS n FROM lesson_progress WHERE user_id=? AND best_score=100', uid).n,
  };

  const langRows = q.all(
    `SELECT c.lang AS code, COUNT(DISTINCT l.id) AS total,
            COUNT(DISTINCT CASE WHEN p.status='completed' THEN l.id END) AS completed
       FROM courses c JOIN lessons l ON l.course_id=c.id
       LEFT JOIN lesson_progress p ON p.lesson_id=l.id AND p.user_id=?
      GROUP BY c.lang`, uid);
  const langMeta = q.all('SELECT * FROM languages');
  const languages = langRows.map((r) => {
    const meta = langMeta.find((m) => m.code === r.code) || {};
    return {
      code: r.code, name: meta.name || r.code, flag: meta.flag || '🏳️',
      total: Number(r.total), completed: Number(r.completed),
      percent: r.total ? Math.round((Number(r.completed) / Number(r.total)) * 100) : 0,
    };
  }).sort((a, b) => b.completed - a.completed);

  const moduleRows = q.all(
    `SELECT module, SUM(correct) AS correct, SUM(total) AS total, COUNT(*) AS sessions,
            SUM(minutes) AS minutes
       FROM study_log WHERE user_id=? AND module IS NOT NULL GROUP BY module`, uid);
  const modules = MODULES.map((m) => {
    const r = moduleRows.find((x) => x.module === m) || { correct: 0, total: 0, sessions: 0, minutes: 0 };
    const completed = q.get(
      `SELECT COUNT(DISTINCT p.lesson_id) AS n FROM lesson_progress p JOIN lessons l ON l.id=p.lesson_id
        WHERE p.user_id=? AND p.status='completed' AND l.module=?`, uid, m).n;
    return {
      module: m, label: MODULE_LABEL[m],
      accuracy: r.total ? Math.round((r.correct / r.total) * 100) : null,
      sessions: Number(r.sessions), minutes: Math.round((Number(r.minutes) || 0)),
      lessons: Number(completed),
    };
  });

  const heat = q.all(
    `SELECT study_date AS date, ROUND(SUM(minutes),1) AS minutes, SUM(xp) AS xp, COUNT(*) AS sessions
       FROM study_log WHERE user_id=? AND study_date >= date(?, '-29 day')
      GROUP BY study_date ORDER BY study_date`, uid, today);
  const heatMap = new Map(heat.map((h) => [h.date, h]));

  const days = [];
  for (let i = 29; i >= 0; i--) {
    const date = todayStr(new Date(Date.now() - i * 86400_000));
    const hit = heatMap.get(date);
    days.push({
      date, weekday: new Date(date + 'T00:00:00Z').getUTCDay(),
      minutes: hit ? Number(hit.minutes) : 0,
      xp: hit ? Number(hit.xp) : 0,
      sessions: hit ? Number(hit.sessions) : 0,
    });
  }

  const profile = ensureProfile(uid);
  const goal = profile.daily_goal_min || 20;
  return {
    stats: { ...stats, ...computeLevel(stats.xp), level: computeLevel(stats.xp).level },
    today: {
      minutes: Math.round((Number(todayRow.minutes) || 0) * 10) / 10,
      xp: Number(todayRow.xp) || 0,
      sessions: Number(todayRow.sessions) || 0,
      goal, goalPercent: Math.min(100, Math.round(((Number(todayRow.minutes) || 0) / goal) * 100)),
    },
    totals, languages, modules, days,
  };
}, { auth: true });

/* ------------------------------------------------------------------ *
 * 个性化学习路径推荐
 * ------------------------------------------------------------------ */

function nextLessonFor(userId, lang, module) {
  const cond = module ? 'AND l.module=?' : '';
  const params = [lang, ...(module ? [module] : []), userId];
  const row = q.get(
    `SELECT l.id, l.title, l.module, l.xp, l.duration_min, l.order_index,
            c.level, c.title AS course_title, c.lang, c.icon
       FROM lessons l JOIN courses c ON c.id=l.course_id
      WHERE c.lang=? ${cond}
        AND NOT EXISTS (SELECT 1 FROM lesson_progress p
                         WHERE p.user_id=? AND p.lesson_id=l.id AND p.status='completed')
      ORDER BY c.level_order, l.order_index LIMIT 1`, ...params);
  return row || null;
}

function weakestModule(userId) {
  const rows = q.all(
    `SELECT module, SUM(correct) AS c, SUM(total) AS t FROM study_log
      WHERE user_id=? AND module IS NOT NULL AND total > 0 GROUP BY module`, userId);
  if (!rows.length) return { module: 'vocabulary', accuracy: null, reason: '先积累词汇，为后续学习打基础' };
  let worst = null;
  for (const r of rows) {
    const acc = r.c / r.t;
    if (!worst || acc < worst.acc) worst = { module: r.module, acc, samples: r.t };
  }
  return {
    module: worst.module,
    accuracy: Math.round(worst.acc * 100),
    reason: `你在「${MODULE_LABEL[worst.module] || worst.module}」的准确率只有 ${Math.round(worst.acc * 100)}%，建议重点突破`,
  };
}

route('GET', '/api/path/today', async (ctx) => {
  const uid = ctx.user.id;
  const stats = ensureStats(uid);
  const profile = ensureProfile(uid);
  const langs = targetLangs(uid);
  const today = todayStr();

  const minutesToday = Number(q.get(
    `SELECT COALESCE(SUM(minutes),0) AS m FROM study_log WHERE user_id=? AND study_date=?`, uid, today).m) || 0;
  const dueCount = q.get(
    `SELECT COUNT(*) AS n FROM cards WHERE user_id=? AND (due_at IS NULL OR due_at<=?)`, uid, A.nowIso()).n;

  const tasks = [];
  const seen = new Set();
  const push = (t) => {
    const key = t.lessonId ? `l${t.lessonId}` : t.kind;
    if (seen.has(key) || tasks.length >= 4) return;
    seen.add(key);
    tasks.push(t);
  };

  if (dueCount > 0) {
    push({
      kind: 'review', icon: '🔁', title: `复习 ${dueCount} 个到期单词`,
      module: 'vocabulary', moduleLabel: MODULE_LABEL.vocabulary,
      reason: '遗忘曲线提醒：这些单词已到最佳复习时间，趁热打铁记得牢',
      minutes: Math.max(2, Math.ceil(dueCount * 0.5)), xp: dueCount * 4, href: '#/review', count: dueCount,
    });
  }

  const weak = weakestModule(uid);
  for (const lang of langs) {
    const lesson = nextLessonFor(uid, lang, weak.module);
    if (!lesson) continue;
    const meta = q.get('SELECT * FROM languages WHERE code=?', lang) || {};
    push({
      kind: 'practice', icon: '🎯', title: `强化训练：${lesson.title}`,
      subtitle: `${meta.flag || ''} ${meta.name || lang} · ${lesson.course_title} · ${lesson.level}`,
      module: lesson.module, moduleLabel: MODULE_LABEL[lesson.module], lessonId: lesson.id,
      reason: weak.reason, minutes: lesson.duration_min, xp: lesson.xp, href: `#/lesson/${lesson.id}`,
    });
    break;
  }

  for (const lang of langs) {
    const meta = q.get('SELECT * FROM languages WHERE code=?', lang) || {};
    const lesson = nextLessonFor(uid, lang, null);
    if (!lesson) continue;
    push({
      kind: 'next', icon: '📈', title: `继续学习：${lesson.title}`,
      subtitle: `${meta.flag || ''} ${meta.name || lang} · ${lesson.course_title} · ${lesson.level}`,
      module: lesson.module, moduleLabel: MODULE_LABEL[lesson.module], lessonId: lesson.id,
      reason: '沿着当前分级课程体系稳步前进', minutes: lesson.duration_min, xp: lesson.xp,
      href: `#/lesson/${lesson.id}`,
    });
    break;
  }

  // 模块均衡：找出完成课节最少的模块，补齐沉浸式训练
  const byModule = MODULES.map((m) => ({
    module: m,
    n: q.get(`SELECT COUNT(DISTINCT p.lesson_id) AS n FROM lesson_progress p JOIN lessons l ON l.id=p.lesson_id
               WHERE p.user_id=? AND p.status='completed' AND l.module=?`, uid, m).n,
  })).sort((a, b) => a.n - b.n);
  for (const cand of byModule) {
    const lang = langs[0];
    const lesson = nextLessonFor(uid, lang, cand.module);
    if (!lesson) continue;
    push({
      kind: 'balance', icon: cand.module === 'listening' ? '👂' : cand.module === 'speaking' ? '🗣️' : '🧩',
      title: `均衡训练：${lesson.title}`,
      module: lesson.module, moduleLabel: MODULE_LABEL[lesson.module], lessonId: lesson.id,
      reason: `「${MODULE_LABEL[cand.module]}」练得最少，沉浸式学习需要四项能力均衡发展`,
      minutes: lesson.duration_min, xp: lesson.xp, href: `#/lesson/${lesson.id}`,
    });
    break;
  }

  const goal = profile.daily_goal_min || 20;
  return {
    tasks,
    motivation: dueCount > 0 ? `今天有 ${dueCount} 个单词等着你复习` :
      minutesToday >= goal ? '今日目标已达成，继续保持！' : '完成今日任务即可延续连续打卡',
    goal: {
      minutes: goal, done: Math.round(minutesToday * 10) / 10,
      percent: Math.min(100, Math.round((minutesToday / goal) * 100)),
    },
    stats: { ...stats, ...computeLevel(stats.xp) },
  };
}, { auth: true });

/* ------------------------------------------------------------------ *
 * 成就
 * ------------------------------------------------------------------ */

route('GET', '/api/achievements', async (ctx) => {
  const uid = ctx.user.id;
  checkAchievements(uid);
  const metrics = computeMetrics(uid);
  const defs = q.all('SELECT * FROM achievements ORDER BY sort_order');
  const owned = new Map(q.all(
    'SELECT code,unlocked_at FROM user_achievements WHERE user_id=?', uid).map((r) => [r.code, r.unlocked_at]));
  const list = defs.map((d) => {
    const value = metrics[d.metric] ?? 0;
    return {
      ...d,
      value,
      progress: Math.min(100, Math.round((value / d.threshold) * 100)),
      unlocked: owned.has(d.code),
      unlocked_at: owned.get(d.code) || null,
    };
  });
  return {
    achievements: list,
    metrics,
    summary: { unlocked: list.filter((a) => a.unlocked).length, total: list.length },
  };
}, { auth: true });

route('GET', '/api/community/leaderboard', async (ctx) => {
  const rows = q.all(
    `SELECT u.id, u.nickname, u.avatar_color, s.xp, s.streak,
            (SELECT COUNT(*) FROM lesson_progress p WHERE p.user_id=u.id AND p.status='completed') AS lessons,
            (SELECT COUNT(*) FROM user_achievements a WHERE a.user_id=u.id) AS badges
       FROM user_stats s JOIN users u ON u.id=s.user_id
      ORDER BY s.xp DESC, s.streak DESC LIMIT 10`);
  return { leaderboard: rows.map((r, i) => ({ ...r, rank: i + 1 })) };
});

/* ------------------------------------------------------------------ *
 * 社区交流
 * ------------------------------------------------------------------ */

const TOPICS = ['经验分享', '答疑求助', '学习打卡', '资源推荐', '语伴招募'];

function serializePost(row, userId) {
  return {
    id: row.id, lang: row.lang, topic: row.topic, title: row.title, body: row.body,
    created_at: row.created_at, author: row.nickname, author_id: row.user_id,
    avatar_color: row.avatar_color, likes: row.likes, comments: row.comments, liked: !!row.liked,
  };
}

route('GET', '/api/community/posts', async (ctx) => {
  const uid = ctx.user ? ctx.user.id : 0;
  const lang = ctx.query.lang || null;
  const limit = Math.min(Number(ctx.query.limit) || 30, 100);
  const rows = q.all(
    `SELECT p.*, u.nickname, u.avatar_color,
            (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS likes,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS comments,
            EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=?) AS liked
       FROM posts p JOIN users u ON u.id=p.user_id
      WHERE (? IS NULL OR p.lang = ?)
      ORDER BY p.created_at DESC LIMIT ?`, uid, lang, lang, limit);
  return { posts: rows.map((r) => serializePost(r, uid)), topics: TOPICS };
});

route('POST', '/api/community/posts', async (ctx) => {
  const title = String(ctx.body.title || '').trim();
  const body = String(ctx.body.body || '').trim();
  if (title.length < 2) throw new HttpError(400, '标题至少 2 个字');
  if (body.length < 2) throw new HttpError(400, '内容至少 2 个字');
  q.run('INSERT INTO posts (user_id,lang,topic,title,body,created_at) VALUES (?,?,?,?,?,?)',
    ctx.user.id, ctx.body.lang || null, ctx.body.topic || '经验分享', title.slice(0, 120),
    body.slice(0, 4000), A.nowIso());
  const id = Number(q.get('SELECT last_insert_rowid() AS id').id);
  checkAchievements(ctx.user.id);
  return { id };
}, { auth: true });

route('GET', '/api/community/posts/:id', async (ctx) => {
  const uid = ctx.user ? ctx.user.id : 0;
  const id = Number(ctx.params.id);
  const row = q.get(
    `SELECT p.*, u.nickname, u.avatar_color,
            (SELECT COUNT(*) FROM post_likes l WHERE l.post_id=p.id) AS likes,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS comments,
            EXISTS(SELECT 1 FROM post_likes l WHERE l.post_id=p.id AND l.user_id=?) AS liked
       FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=?`, uid, id);
  if (!row) throw new HttpError(404, '帖子不存在');
  const comments = q.all(
    `SELECT c.*, u.nickname, u.avatar_color FROM comments c JOIN users u ON u.id=c.user_id
      WHERE c.post_id=? ORDER BY c.created_at`, id);
  return { post: serializePost(row, uid), comments };
});

route('POST', '/api/community/posts/:id/comments', async (ctx) => {
  const id = Number(ctx.params.id);
  const body = String(ctx.body.body || '').trim();
  if (body.length < 1) throw new HttpError(400, '评论内容不能为空');
  if (!q.get('SELECT id FROM posts WHERE id=?', id)) throw new HttpError(404, '帖子不存在');
  q.run('INSERT INTO comments (post_id,user_id,body,created_at) VALUES (?,?,?,?)',
    id, ctx.user.id, body.slice(0, 1000), A.nowIso());
  return { ok: true };
}, { auth: true });

route('POST', '/api/community/posts/:id/like', async (ctx) => {
  const id = Number(ctx.params.id);
  if (!q.get('SELECT id FROM posts WHERE id=?', id)) throw new HttpError(404, '帖子不存在');
  const existing = q.get('SELECT 1 AS x FROM post_likes WHERE post_id=? AND user_id=?', id, ctx.user.id);
  if (existing) {
    q.run('DELETE FROM post_likes WHERE post_id=? AND user_id=?', id, ctx.user.id);
    return { liked: false };
  }
  q.run('INSERT INTO post_likes (post_id,user_id,created_at) VALUES (?,?,?)', id, ctx.user.id, A.nowIso());
  return { liked: true };
}, { auth: true });

/* ------------------------------------------------------------------ *
 * 个人资料与引导
 * ------------------------------------------------------------------ */

function applyProfile(userId, body) {
  const field = [];
  const params = [];
  if (body.native_lang) { field.push('native_lang=?'); params.push(body.native_lang); }
  if (body.target_langs && Array.isArray(body.target_langs) && body.target_langs.length) {
    field.push('target_langs=?'); params.push(JSON.stringify(body.target_langs.slice(0, 3)));
  }
  if (body.placement) { field.push('placement=?'); params.push(body.placement); }
  if (body.goal) { field.push('goal=?'); params.push(body.goal); }
  if (body.daily_goal_min) {
    field.push('daily_goal_min=?');
    params.push(Math.max(5, Math.min(180, Number(body.daily_goal_min))));
  }
  if (field.length) q.run(`UPDATE profiles SET ${field.join(',')} WHERE user_id=?`, ...params, userId);
  if (body.onboarded !== undefined) {
    q.run('UPDATE profiles SET onboarded=? WHERE user_id=?', body.onboarded ? 1 : 0, userId);
  }
  if (body.nickname) {
    q.run('UPDATE users SET nickname=? WHERE id=?', String(body.nickname).slice(0, 24), userId);
  }
  ensureCards(userId, 12);
}

route('GET', '/api/profile', async (ctx) => ({ user: buildUser(ctx.user.id) }), { auth: true });

route('PUT', '/api/profile', async (ctx) => {
  applyProfile(ctx.user.id, ctx.body);
  return { user: buildUser(ctx.user.id) };
}, { auth: true });

route('POST', '/api/profile/onboarding', async (ctx) => {
  applyProfile(ctx.user.id, { ...ctx.body, onboarded: true });
  return { user: buildUser(ctx.user.id) };
}, { auth: true });

module.exports = { MODULES, MODULE_LABEL, buildUser, targetLangs, computeLevel, ensureCards, checkAchievements };
