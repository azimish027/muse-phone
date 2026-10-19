/// SQLite 数据库层 — 完整迁移自 server/db.js
/// 22 张表 + 种子数据 + 成就定义
///
/// 使用 sqflite（纯原生 SQLite，支持事务 / WAL / 外键）
/// schema version 通过 user_version PRAGMA 管理

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

class AppDatabase {
  AppDatabase._();
  static final AppDatabase instance = AppDatabase._();
  static Database? _db;

  static const int _schemaVersion = 2;

  Future<Database> get db async {
    if (_db != null) return _db!;
    _db = await _open();
    return _db!;
  }

  Future<Database> _open() async {
    final dir = await getApplicationDocumentsDirectory();
    final path = p.join(dir.path, 'musarches_fair.db');
    return await openDatabase(
      path,
      version: _schemaVersion,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
      onConfigure: _onConfigure,
    );
  }

  Future<void> _onConfigure(Database db) async {
    await db.execute('PRAGMA journal_mode = WAL;');
    await db.execute('PRAGMA foreign_keys = ON;');
  }

  Future<void> _onCreate(Database db, int version) async {
    await db.execute(_schema);
    await db.execute(_timeBlockSchema);
    await db.transaction((tx) async {
      await _seedAchievements(tx);
      await _seedDefaultUser(tx);
    });
  }

  Future<void> _onUpgrade(Database db, int old, int cur) async {
    if (old < 2) {
      await db.execute(_timeBlockSchema);
    }
  }

  static const String _schema = '''
CREATE TABLE languages (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  name_native TEXT,
  flag        TEXT,
  voice       TEXT,
  intro       TEXT
);

CREATE TABLE courses (
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

CREATE TABLE lessons (
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

CREATE TABLE exercises (
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

CREATE TABLE words (
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

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nickname      TEXT NOT NULL,
  avatar_color  TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE profiles (
  user_id        INTEGER PRIMARY KEY,
  native_lang    TEXT DEFAULT 'zh',
  target_langs   TEXT DEFAULT '["en"]',
  placement      TEXT DEFAULT 'A1',
  goal           TEXT DEFAULT 'daily',
  daily_goal_min INTEGER DEFAULT 20,
  onboarded      INTEGER DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_stats (
  user_id         INTEGER PRIMARY KEY,
  xp              INTEGER NOT NULL DEFAULT 0,
  streak          INTEGER NOT NULL DEFAULT 0,
  best_streak     INTEGER NOT NULL DEFAULT 0,
  last_study_date TEXT,
  total_minutes   REAL NOT NULL DEFAULT 0,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE lesson_progress (
  user_id      INTEGER NOT NULL,
  lesson_id    INTEGER NOT NULL,
  status       TEXT NOT NULL DEFAULT 'in_progress',
  best_score   INTEGER NOT NULL DEFAULT 0,
  attempts     INTEGER NOT NULL DEFAULT 0,
  last_at      TEXT,
  completed_at TEXT,
  PRIMARY KEY(user_id, lesson_id)
);

CREATE TABLE cards (
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

CREATE TABLE study_log (
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

CREATE TABLE posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  lang       TEXT,
  topic      TEXT,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE post_likes (
  post_id    INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(post_id, user_id)
);

CREATE TABLE achievements (
  code        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  tier        TEXT,
  metric      TEXT NOT NULL,
  threshold   INTEGER NOT NULL,
  sort_order  INTEGER DEFAULT 0
);

CREATE TABLE user_achievements (
  user_id     INTEGER NOT NULL,
  code        TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY(user_id, code)
);

CREATE TABLE phrases (
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

CREATE TABLE phrase_progress (
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

CREATE TABLE battle_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  phrase_id   TEXT NOT NULL,
  tier        TEXT NOT NULL,
  damage      INTEGER NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX idx_lesson_progress_due ON phrase_progress(user_id, next_review_at);
CREATE INDEX idx_battle_log_user ON battle_log(user_id, created_at);
CREATE INDEX idx_lessons_course ON lessons(course_id, order_index);
CREATE INDEX idx_exercises_lesson ON exercises(lesson_id, order_index);
CREATE INDEX idx_words_lang ON words(lang, level);
CREATE INDEX idx_cards_due ON cards(user_id, due_at);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_tasks_group ON group_tasks(group_id, status);
CREATE INDEX idx_group_checkins_task ON group_checkins(task_id);
CREATE INDEX idx_spell_templates_public ON spell_templates(public);
CREATE INDEX idx_log_user_date ON study_log(user_id, study_date);
''';

  /// Time Block (Sand Chron) 专用表 — schema v2 新增
  static const String _timeBlockSchema = '''
CREATE TABLE IF NOT EXISTS time_blocks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL DEFAULT 1,
  title       TEXT NOT NULL DEFAULT '',
  emoji       TEXT DEFAULT '⏳',
  color       TEXT DEFAULT '#C45A3B',
  block_date  TEXT NOT NULL,           -- YYYY-MM-DD
  start_min   INTEGER NOT NULL,        -- 0..1440 (分钟数)
  end_min     INTEGER NOT NULL,        -- > start_min
  mood_emoji  TEXT,                    -- 心情标记
  note        TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_time_blocks_date ON time_blocks(user_id, block_date);
''';

  /// 成就定义（与 server/db.js 保持一致）
  Future<void> _seedAchievements(Database db) async {
    const rows = [
      ('first_step', '启程', '完成你的第一节课', '🌱', 'bronze', 'lessons', 1, 1),
      ('lesson_10', '持之以恒', '累计完成 10 节课', '📚', 'bronze', 'lessons', 10, 2),
      ('lesson_30', '学海无涯', '累计完成 30 节课', '🎓', 'silver', 'lessons', 30, 3),
      ('streak_3', '三天热度', '连续学习 3 天', '🔥', 'bronze', 'streak', 3, 4),
      ('streak_7', '一周不辍', '连续学习 7 天', '🔥', 'silver', 'streak', 7, 5),
      ('streak_30', '铁人意志', '连续学习 30 天', '🏆', 'gold', 'streak', 30, 6),
      ('xp_500', '小有所成', '累计获得 500 经验', '⭐', 'bronze', 'xp', 500, 7),
      ('xp_2000', '融会贯通', '累计获得 2000 经验', '🌟', 'gold', 'xp', 2000, 8),
      ('words_50', '词汇新芽', '掌握 50 个单词', '🌿', 'silver', 'words_mastered', 50, 9),
      ('speak_5', '开口达人', '完成 5 次口语跟读训练', '🗣️', 'silver', 'speaking', 5, 10),
      ('listen_5', '顺风耳', '完成 5 次听力训练', '👂', 'silver', 'listening', 5, 11),
      ('social_1', '破冰', '在社区发布第一条动态', '💬', 'bronze', 'posts', 1, 12),
      ('polyglot', '多语达人', '在 2 门以上语言中完成课程', '🌍', 'gold', 'languages', 2, 13),
      ('perfect_5', '完美主义', '单节课获得满分 5 次', '💯', 'silver', 'perfect', 5, 14),
    ];
    final batch = db.batch();
    for (final r in rows) {
      batch.insert(
        'achievements',
        {
          'code': r[0],
          'title': r[1],
          'description': r[2],
          'icon': r[3],
          'tier': r[4],
          'metric': r[5],
          'threshold': r[6],
          'sort_order': r[7],
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  /// 创建本地默认用户（单机优先，不需要注册流程）
  Future<void> _seedDefaultUser(Database db) async {
    final existing = await db.query('users', limit: 1);
    if (existing.isNotEmpty) return;

    final now = DateTime.now().toIso8601String();
    await db.insert('users', {
      'email': 'local@muse-phone.app',
      'password_hash': 'local_only_no_auth_needed',
      'nickname': '旅人',
      'avatar_color': '#C45A3B',
      'created_at': now,
    });
    final userId = Sqflite.firstIntValue(
      await db.rawQuery('SELECT last_insert_rowid()'),
    );
    if (userId == null) return;
    await db.insert('profiles', {
      'user_id': userId,
      'native_lang': 'zh',
      'target_langs': '["en"]',
      'placement': 'A1',
      'goal': 'daily',
      'daily_goal_min': 20,
      'onboarded': 1,
    });
    await db.insert('user_stats', {
      'user_id': userId,
      'xp': 0,
      'streak': 0,
      'best_streak': 0,
      'last_study_date': null,
      'total_minutes': 0.0,
    });
  }

  /// 简单查询封装
  Future<List<Map<String, dynamic>>> query(String sql, [List<dynamic>? args]) async {
    return await db.then((d) => d.rawQuery(sql, args));
  }

  Future<int> insert(String table, Map<String, dynamic> row) async {
    return await db.then((d) => d.insert(table, row,
        conflictAlgorithm: ConflictAlgorithm.replace));
  }

  Future<int> update(String sql, [List<dynamic>? args]) async {
    return await db.then((d) => d.rawUpdate(sql, args));
  }

  Future<int> delete(String sql, [List<dynamic>? args]) async {
    return await db.then((d) => d.rawDelete(sql, args));
  }

  Future<void> close() async {
    await _db?.close();
    _db = null;
  }
}
