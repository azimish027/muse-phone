'use strict';

/**
 * 数据库层：基于 Node 内置 node:sqlite（零外部依赖）。
 * 负责建表、查询封装与种子数据导入。
 *
 * Schema 版本通过 PRAGMA user_version 记录。每次新增破坏性变更时 bump SCHEMA_VERSION
 * 并在 migrate() 里写对应的 ALTER TABLE / CREATE INDEX。
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

// === schema version ===
const SCHEMA_VERSION = 1;
const MIGRATIONS = {
  1: null, // 初始版本：全量 CREATE TABLE IF NOT EXISTS（由 SCHEMA 常量覆盖）
};

function ensureMigrated(db) {
  const cur = db.prepare('PRAGMA user_version').get();
  let version = cur?.user_version ?? 0;
  while (version < SCHEMA_VERSION) {
    version += 1;
    const fn = MIGRATIONS[version];
    if (fn) fn(db);
  }
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  return version;
}

const DATA_DIR = path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = process.env.LINGUA_DB || path.join(DATA_DIR, 'lingua.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
ensureMigrated(db);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS languages (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  name_native TEXT,
  flag        TEXT,
  voice       TEXT,
  intro       TEXT
);

CREATE TABLE IF NOT EXISTS courses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lang        TEXT NOT NULL,
  level       TEXT NOT NULL,
  level_order INTEGER NOT NULL DEFAULT 1,
  title       TEXT NOT NULL,
  subtitle    TEXT,
  description TEXT,
  icon        TEXT,
  UNIQUE(lang, level)
);

CREATE TABLE IF NOT EXISTS lessons (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id    INTEGER NOT NULL,
  title        TEXT NOT NULL,
  module       TEXT NOT NULL,
  order_index  INTEGER NOT NULL DEFAULT 1,
  xp           INTEGER NOT NULL DEFAULT 10,
  duration_min INTEGER NOT NULL DEFAULT 5,
  description  TEXT,
  FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exercises (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id          INTEGER NOT NULL,
  order_index        INTEGER NOT NULL DEFAULT 1,
  type               TEXT NOT NULL,
  prompt             TEXT,
  prompt_translation TEXT,
  audio              TEXT,
  options            TEXT,
  answer             TEXT,
  explanation        TEXT,
  hint               TEXT,
  FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS words (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  lang                TEXT NOT NULL,
  level               TEXT,
  word                TEXT NOT NULL,
  reading             TEXT,
  meaning             TEXT NOT NULL,
  pos                 TEXT,
  example             TEXT,
  example_translation TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname      TEXT NOT NULL,
  avatar_color  TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id        INTEGER PRIMARY KEY,
  native_lang    TEXT DEFAULT 'zh',
  target_langs   TEXT DEFAULT '["en"]',
  placement      TEXT DEFAULT 'A1',
  goal           TEXT DEFAULT 'daily',
  daily_goal_min INTEGER DEFAULT 20,
  onboarded      INTEGER DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id         INTEGER PRIMARY KEY,
  xp              INTEGER NOT NULL DEFAULT 0,
  streak          INTEGER NOT NULL DEFAULT 0,
  best_streak     INTEGER NOT NULL DEFAULT 0,
  last_study_date TEXT,
  total_minutes   REAL NOT NULL DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  user_id      INTEGER NOT NULL,
  lesson_id    INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'in_progress',
  best_score   INTEGER NOT NULL DEFAULT 0,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_at      TEXT,
  completed_at TEXT,
  PRIMARY KEY(user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS cards (
  user_id      INTEGER NOT NULL,
  word_id      INTEGER NOT NULL,
  ease         REAL NOT NULL DEFAULT 2.5,
  interval_days REAL NOT NULL DEFAULT 0,
  reps         INTEGER NOT NULL DEFAULT 0,
  lapses       INTEGER NOT NULL DEFAULT 0,
  due_at       TEXT,
  status       TEXT NOT NULL DEFAULT 'new',
  last_review  TEXT,
  PRIMARY KEY(user_id, word_id)
);

CREATE TABLE IF NOT EXISTS study_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  lang       TEXT,
  module     TEXT,
  minutes    REAL NOT NULL DEFAULT 0,
  xp         INTEGER NOT NULL DEFAULT 0,
  correct    INTEGER NOT NULL DEFAULT 0,
  total      INTEGER NOT NULL DEFAULT 0,
  study_date TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  lang       TEXT,
  topic      TEXT,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id    INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS achievements (
  code        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  tier        TEXT,
  metric      TEXT NOT NULL,
  threshold   INTEGER NOT NULL,
  sort_order  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id     INTEGER NOT NULL,
  code        TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY(user_id, code)
);

/* ---- 「言灵魔法」模块专用表（3 张，独立于以上现有表，互不读写） ---- */

CREATE TABLE IF NOT EXISTS phrases (
  id             TEXT PRIMARY KEY,
  phrase         TEXT NOT NULL,
  tokens         TEXT NOT NULL,
  simple_def     TEXT NOT NULL,
  examples       TEXT NOT NULL,
  pitfalls       TEXT NOT NULL,
  hint_script    TEXT NOT NULL,
  grammar_tag    TEXT,
  audio_path     TEXT,
  blank_priority TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS phrase_progress (
  user_id          TEXT NOT NULL,
  phrase_id        TEXT NOT NULL,
  mastery_score    REAL DEFAULT 0,
  spell_attempts   INTEGER DEFAULT 0,
  spell_corrects   INTEGER DEFAULT 0,
  self_passes      INTEGER DEFAULT 0,
  self_attempts    INTEGER DEFAULT 0,
  last_reviewed_at TEXT,
  next_review_at   TEXT,
  battle_best_tier TEXT,
  PRIMARY KEY (user_id, phrase_id)
);

CREATE TABLE IF NOT EXISTS battle_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  phrase_id   TEXT NOT NULL,
  tier        TEXT NOT NULL,
  damage      INTEGER NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_phrase_progress_due ON phrase_progress(user_id, next_review_at);
CREATE INDEX IF NOT EXISTS idx_battle_log_user ON battle_log(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id, order_index);

/* 批次 2：群组学习（零破坏性新增） */
CREATE TABLE IF NOT EXISTS groups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  emoji       TEXT DEFAULT '🪄',
  owner_id    TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS group_members (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id    INTEGER NOT NULL,
  user_id     TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',   -- member / leader
  joined_at   TEXT NOT NULL,
  UNIQUE(group_id, user_id)
);
CREATE TABLE IF NOT EXISTS group_tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id    INTEGER NOT NULL,
  author_id   TEXT NOT NULL,
  title       TEXT NOT NULL,
  phrase_id   INTEGER,
  verify_type TEXT NOT NULL DEFAULT 'spell',    -- spell / photo / self
  description TEXT DEFAULT '',
  due_date    TEXT,
  created_at  TEXT NOT NULL,
  assignee_id TEXT,                              -- 抽签随机分配
  status      TEXT NOT NULL DEFAULT 'open'       -- open / drawn / done
);
CREATE TABLE IF NOT EXISTS group_checkins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     INTEGER NOT NULL,
  group_id    INTEGER NOT NULL,
  user_id     TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  note        TEXT DEFAULT '',
  UNIQUE(task_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_tasks_group ON group_tasks(group_id, status);
CREATE INDEX IF NOT EXISTS idx_group_checkins_task ON group_checkins(task_id);
CREATE INDEX IF NOT EXISTS idx_exercises_lesson ON exercises(lesson_id, order_index);
CREATE INDEX IF NOT EXISTS idx_words_lang ON words(lang, level);
CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(user_id, due_at);

/* 批次 4：自制魔法书分享 */
CREATE TABLE IF NOT EXISTS spell_templates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id    TEXT NOT NULL,
  title       TEXT NOT NULL,
  emoji       TEXT DEFAULT '📖',
  description TEXT DEFAULT '',
  phrase_ids  TEXT NOT NULL DEFAULT '[]',  -- JSON array
  created_at  TEXT NOT NULL,
  public      INTEGER NOT NULL DEFAULT 1,
  copies      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_spell_templates_public ON spell_templates(public);
CREATE INDEX IF NOT EXISTS idx_log_user_date ON study_log(user_id, study_date);
`;

db.exec(SCHEMA);

/** 便捷查询封装 */
const q = {
  run: (sql, ...params) => db.prepare(sql).run(...params),
  get: (sql, ...params) => db.prepare(sql).get(...params),
  all: (sql, ...params) => db.prepare(sql).all(...params),
  exec: (sql) => db.exec(sql),
  tx: (fn) => {
    db.exec('BEGIN');
    try {
      const out = fn();
      db.exec('COMMIT');
      return out;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },
};

/** 成就定义 */
const ACHIEVEMENTS = [
  { code: 'first_step', title: '启程', description: '完成你的第一节课', icon: '🌱', tier: 'bronze', metric: 'lessons', threshold: 1, sort_order: 1 },
  { code: 'lesson_10', title: '持之以恒', description: '累计完成 10 节课', icon: '📚', tier: 'bronze', metric: 'lessons', threshold: 10, sort_order: 2 },
  { code: 'lesson_30', title: '学海无涯', description: '累计完成 30 节课', icon: '🎓', tier: 'silver', metric: 'lessons', threshold: 30, sort_order: 3 },
  { code: 'streak_3', title: '三天热度', description: '连续学习 3 天', icon: '🔥', tier: 'bronze', metric: 'streak', threshold: 3, sort_order: 4 },
  { code: 'streak_7', title: '一周不辍', description: '连续学习 7 天', icon: '🔥', tier: 'silver', metric: 'streak', threshold: 7, sort_order: 5 },
  { code: 'streak_30', title: '铁人意志', description: '连续学习 30 天', icon: '🏆', tier: 'gold', metric: 'streak', threshold: 30, sort_order: 6 },
  { code: 'xp_500', title: '小有所成', description: '累计获得 500 经验', icon: '⭐', tier: 'bronze', metric: 'xp', threshold: 500, sort_order: 7 },
  { code: 'xp_2000', title: '融会贯通', description: '累计获得 2000 经验', icon: '🌟', tier: 'gold', metric: 'xp', threshold: 2000, sort_order: 8 },
  { code: 'words_50', title: '词汇新芽', description: '掌握 50 个单词', icon: '🌿', tier: 'silver', metric: 'words_mastered', threshold: 50, sort_order: 9 },
  { code: 'speak_5', title: '开口达人', description: '完成 5 次口语跟读训练', icon: '🗣️', tier: 'silver', metric: 'speaking', threshold: 5, sort_order: 10 },
  { code: 'listen_5', title: '顺风耳', description: '完成 5 次听力训练', icon: '👂', tier: 'silver', metric: 'listening', threshold: 5, sort_order: 11 },
  { code: 'social_1', title: '破冰', description: '在社区发布第一条动态', icon: '💬', tier: 'bronze', metric: 'posts', threshold: 1, sort_order: 12 },
  { code: 'polyglot', title: '多语达人', description: '在 2 门以上语言中完成课程', icon: '🌍', tier: 'gold', metric: 'languages', threshold: 2, sort_order: 13 },
  { code: 'perfect_5', title: '完美主义', description: '单节课获得满分 5 次', icon: '💯', tier: 'silver', metric: 'perfect', threshold: 5, sort_order: 14 },
];

/** 写入成就定义（幂等） */
function seedAchievements() {
  const stmt = db.prepare(
    `INSERT INTO achievements (code,title,description,icon,tier,metric,threshold,sort_order)
     VALUES (?,?,?,?,?,?,?,?)
     ON CONFLICT(code) DO UPDATE SET title=excluded.title, description=excluded.description,
       icon=excluded.icon, tier=excluded.tier, metric=excluded.metric, threshold=excluded.threshold,
       sort_order=excluded.sort_order`
  );
  for (const a of ACHIEVEMENTS) {
    stmt.run(a.code, a.title, a.description, a.icon, a.tier, a.metric, a.threshold, a.sort_order);
  }
}

/** 导入一门语言的种子数据 */
function insertLanguageSeed(seed) {
  const lang = seed.language;
  q.run(
    `INSERT INTO languages (code,name,name_native,flag,voice,intro) VALUES (?,?,?,?,?,?)
     ON CONFLICT(code) DO UPDATE SET name=excluded.name, name_native=excluded.name_native,
       flag=excluded.flag, voice=excluded.voice, intro=excluded.intro`,
    lang.code, lang.name, lang.name_native, lang.flag, lang.voice, lang.intro
  );

  for (const course of seed.courses || []) {
    q.run(
      `INSERT INTO courses (lang,level,level_order,title,subtitle,description,icon)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(lang,level) DO UPDATE SET level_order=excluded.level_order, title=excluded.title,
         subtitle=excluded.subtitle, description=excluded.description, icon=excluded.icon`,
      course.lang || lang.code, course.level, course.level_order || 1,
      course.title, course.subtitle || '', course.description || '', course.icon || '📘'
    );
    const courseRow = q.get('SELECT id FROM courses WHERE lang=? AND level=?', lang.code, course.level);

    for (const lesson of course.lessons || []) {
      q.run(
        `INSERT INTO lessons (course_id,title,module,order_index,xp,duration_min,description)
         VALUES (?,?,?,?,?,?,?)`,
        courseRow.id, lesson.title, lesson.module, lesson.order_index || 1,
        lesson.xp || 10, lesson.duration_min || 5, lesson.description || ''
      );
      const lessonRow = q.get('SELECT last_insert_rowid() AS id');
      const lessonId = Number(lessonRow.id);
      let idx = 1;
      for (const ex of lesson.exercises || []) {
        q.run(
          `INSERT INTO exercises (lesson_id,order_index,type,prompt,prompt_translation,audio,options,answer,explanation,hint)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          lessonId, ex.order_index || idx++, ex.type, ex.prompt || '', ex.prompt_translation || '',
          ex.audio || null,
          ex.options ? JSON.stringify(ex.options) : null,
          typeof ex.answer === 'string' ? ex.answer : JSON.stringify(ex.answer ?? ''),
          ex.explanation || '', ex.hint || ''
        );
      }
    }
  }

  for (const w of seed.words || []) {
    q.run(
      `INSERT INTO words (lang,level,word,reading,meaning,pos,example,example_translation)
       VALUES (?,?,?,?,?,?,?,?)`,
      lang.code, w.level || null, w.word, w.reading || '', w.meaning, w.pos || '',
      w.example || '', w.example_translation || ''
    );
  }
}

/** 「言灵魔法」短语种子导入（独立于语言课程种子，幂等 upsert） */
function seedPhrases() {
  const file = path.join(__dirname, 'seed', 'en_phrases.js');
  if (!fs.existsSync(file)) return 0;
  const seed = require(file);
  if (!seed || !Array.isArray(seed.phrases)) return 0;

  const existing = q.get('SELECT COUNT(*) AS n FROM phrases').n;
  const needReseed = process.env.LINGUA_RESEED === '1' || process.argv.includes('--reseed');
  if (existing > 0 && !needReseed) return Number(existing);

  const stmt = db.prepare(
    `INSERT INTO phrases (id,phrase,tokens,simple_def,examples,pitfalls,hint_script,grammar_tag,audio_path,blank_priority)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET phrase=excluded.phrase, tokens=excluded.tokens,
       simple_def=excluded.simple_def, examples=excluded.examples, pitfalls=excluded.pitfalls,
       hint_script=excluded.hint_script, grammar_tag=excluded.grammar_tag,
       audio_path=excluded.audio_path, blank_priority=excluded.blank_priority`
  );
  let n = 0;
  for (const p of seed.phrases) {
    const letterCount = String(p.phrase).toLowerCase().replace(/[^a-z]/g, '').length;
    const bpArr = Array.isArray(p.blank_priority) ? p.blank_priority : [];
    if (bpArr.length !== letterCount) {
      throw new Error(`短语 ${p.id} 的 blank_priority 长度(${bpArr.length}) 与字母数(${letterCount}) 不一致`);
    }
    stmt.run(p.id, p.phrase, JSON.stringify(p.tokens || []), p.simple_def,
      JSON.stringify(p.examples || []), JSON.stringify(p.pitfalls || []),
      p.hint_script, p.grammar_tag || null, p.audio_path ?? null, JSON.stringify(bpArr));
    n++;
  }
  return n;
}

/** 初始化：首次启动导入种子数据 */
function ensureSeed() {
  seedAchievements();
  const phraseCount = seedPhrases();
  const needReseed = process.env.LINGUA_RESEED === '1' || process.argv.includes('--reseed');
  const count = q.get('SELECT COUNT(*) AS n FROM languages').n;

  if (count > 0 && !needReseed) return { seeded: false, languages: Number(count), phrases: phraseCount };

  if (needReseed) {
    db.exec(`
      DELETE FROM exercises; DELETE FROM lessons; DELETE FROM courses;
      DELETE FROM words; DELETE FROM cards; DELETE FROM languages;
    `);
  }

  const SEED_DIR = path.join(__dirname, 'seed');
  let loaded = 0;
  if (fs.existsSync(SEED_DIR)) {
    for (const file of fs.readdirSync(SEED_DIR).filter((f) => f.endsWith('.js'))) {
      const seed = require(path.join(SEED_DIR, file));
      if (seed && seed.language) {
        insertLanguageSeed(seed);
        loaded++;
      }
    }
  }
  return { seeded: true, languages: loaded, phrases: phraseCount };
}

module.exports = { db, q, ensureSeed, seedAchievements, seedPhrases, ACHIEVEMENTS, DB_PATH };
