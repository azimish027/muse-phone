'use strict';

/**
 * 「言灵魔法」模块 —— 英语专属的独立子系统。
 * 只读写 phrases / phrase_progress / battle_log 三张新表，
 * 绝不触碰现有 17 张表，也不影响现有任何路由。
 */

const crypto = require('node:crypto');
const { q } = require('./db');
const { HttpError, route } = require('./http');

/* ------------------------------------------------------------------ *
 * 可调参数（集中在此，便于后续调参；?debug=1 可回显）
 * ------------------------------------------------------------------ */

const TUNING = {
  dailyNew: 3,            // 每日新短语条数
  dailyReview: 3,         // 每日待复习条数
  battleRounds: 6,        // 战斗回合数
  playerMaxHp: 50,        // 自身血量
  enemyHpFactor: 0.72,    // 敌方血量 = 系数 × Σ各短语基础攻击力（自适应，稍宽松）
  masterySpellWeight: 0.6,
  masterySelfWeight: 0.4,
  atkBase: 10,            // baseAtk = atkBase + mastery × atkPerMastery
  atkPerMastery: 0.9,
  superMastery: 70,       // 熟练度 ≥ 此值且「全对+及格」→ 超常
  weakFactor: 0.5,        // 削弱档伤害系数
  superFactor: 2,         // 超常档伤害系数
  selfDamageRatio: 0.35,  // 「没发挥」反噬 = max(min, baseAtk × ratio)
  selfDamageMin: 12,
  blankMinRatio: 0.25,    // 挖空比例下限（熟练度 0）
  blankMaxRatio: 0.8,     // 挖空比例上限（熟练度 100）
};

const TIER = {
  super: { key: 'super', label: '妖精级' },
  normal: { key: 'normal', label: '完美'   },
  weak:  { key: 'weak',  label: '稍弱'   },
  miss:  { key: 'miss',  label: '走神啦' },
};
const TIER_RANK = { super: 3, normal: 2, weak: 1, miss: 0 };

const ENEMIES = ['糖果小妖', '云朵怪', '甜酱精灵', '饼干幽灵', '布丁蝙蝠', '彩虹史莱姆'];

/* ------------------------------------------------------------------ *
 * 工具
 * ------------------------------------------------------------------ */

function nowIso() { return new Date().toISOString(); }
function todayStr(d = new Date()) {
  return new Date(d.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
}
function parseJson(raw, fb) {
  try { const v = JSON.parse(raw); return v ?? fb; } catch { return fb; }
}
function lettersOf(phrase) { return String(phrase).toLowerCase().replace(/[^a-z]/g, ''); }

/** 编辑距离，用于「全对 / 小错 / 大错」判定 */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i, ...Array(n).fill(0)];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

/** 拼写判定：exact 全对 / minor 小错（1-2 字母）/ miss 大错（≥3 字母或无法辨识） */
function classifySpelling(input, phrase) {
  const target = lettersOf(phrase);
  const given = String(input == null ? '' : input).toLowerCase().replace(/[^a-z]/g, '');
  if (!given) return { tier: 'miss', distance: target.length };
  const distance = levenshtein(target, given);
  if (distance === 0) return { tier: 'exact', distance };
  if (distance <= 2) return { tier: 'minor', distance };
  return { tier: 'miss', distance };
}

/* ------------------------------------------------------------------ *
 * 熟练度 / 攻击力 / 复习节奏
 * ------------------------------------------------------------------ */

function computeMastery(row) {
  const spellRate = (row.spell_corrects || 0) / Math.max(row.spell_attempts || 0, 1);
  const selfRate = (row.self_passes || 0) / Math.max(row.self_attempts || 0, 1);
  return Math.round((spellRate * TUNING.masterySpellWeight + selfRate * TUNING.masterySelfWeight) * 100);
}

function baseAttack(mastery) {
  return Math.round((TUNING.atkBase + mastery * TUNING.atkPerMastery) * 10) / 10;
}

function reviewIntervalDays(mastery) {
  if (mastery < 40) return 1;
  if (mastery < 70) return 2;
  if (mastery < 90) return 4;
  return 7;
}

function getProgress(userId, phraseId) {
  let row = q.get('SELECT * FROM phrase_progress WHERE user_id=? AND phrase_id=?', userId, phraseId);
  if (!row) {
    q.run('INSERT INTO phrase_progress (user_id,phrase_id) VALUES (?,?)', userId, phraseId);
    row = q.get('SELECT * FROM phrase_progress WHERE user_id=? AND phrase_id=?', userId, phraseId);
  }
  return row;
}

/** 动态挖空：熟练度越高挖得越多；按 blank_priority 从高到低取前 N 个字母 */
function blankIndexes(phrase, priority, mastery) {
  const letters = lettersOf(phrase);
  const L = letters.length;
  if (!L) return [];
  const ratio = TUNING.blankMinRatio
    + (TUNING.blankMaxRatio - TUNING.blankMinRatio) * (Math.max(0, Math.min(100, mastery)) / 100);
  const n = Math.max(1, Math.min(L - 1, Math.round(L * ratio)));
  const order = Array.from({ length: L }, (_, i) => i)
    .sort((a, b) => (priority[b] ?? 1) - (priority[a] ?? 1) || a - b);
  return order.slice(0, n).sort((a, b) => a - b);
}

/* ------------------------------------------------------------------ *
 * 序列化
 * ------------------------------------------------------------------ */

function langMeta() {
  return { code: 'en', name: '英语', flag: '🇬🇧', voice: 'en-US' };
}

function briefPhrase(p, mastery) {
  return {
    id: p.id,
    phrase: p.phrase,
    tokens: parseJson(p.tokens, []),
    simple_def: p.simple_def,
    grammar_tag: p.grammar_tag,
    hint_script: p.hint_script,
    mastery: mastery ?? 0,
    baseAtk: baseAttack(mastery ?? 0),
  };
}

function fullPhrase(p, mastery) {
  return {
    id: p.id,
    phrase: p.phrase,
    tokens: parseJson(p.tokens, []),
    simple_def: p.simple_def,
    examples: parseJson(p.examples, []),
    pitfalls: parseJson(p.pitfalls, []),
    hint_script: p.hint_script,
    grammar_tag: p.grammar_tag,
    audio_path: p.audio_path,
    blank_priority: parseJson(p.blank_priority, []),
    mastery: mastery ?? 0,
    baseAtk: baseAttack(mastery ?? 0),
  };
}

function withMastery(rows, userId) {
  const map = new Map(
    q.all('SELECT phrase_id, mastery_score FROM phrase_progress WHERE user_id=?', userId)
      .map((r) => [r.phrase_id, r.mastery_score]));
  return rows.map((r) => ({ ...r, mastery: map.get(r.id) ?? 0 }));
}

/* ------------------------------------------------------------------ *
 * 连续学习天数（言灵模块口径：学习提交日 ∪ 战斗日）
 * ------------------------------------------------------------------ */

function studyDates(userId) {
  const set = new Set();
  for (const r of q.all('SELECT last_reviewed_at AS t FROM phrase_progress WHERE user_id=? AND last_reviewed_at IS NOT NULL', userId)) {
    set.add(todayStr(new Date(r.t)));
  }
  for (const r of q.all('SELECT created_at AS t FROM battle_log WHERE user_id=?', userId)) {
    set.add(todayStr(new Date(r.t)));
  }
  return set;
}

function streakFrom(set) {
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const key = todayStr(new Date(Date.now() - i * 86400e3));
    if (set.has(key)) streak++;
    else if (i === 0) continue;   // 今天还没开始不算中断
    else break;
  }
  return streak;
}

function masteryOverview(userId) {
  const total = q.get('SELECT COUNT(*) AS n FROM phrases').n;
  const stats = q.get(`SELECT COUNT(*) AS studied, COALESCE(AVG(mastery_score),0) AS avg,
                              SUM(CASE WHEN mastery_score >= ? THEN 1 ELSE 0 END) AS mastered
                         FROM phrase_progress WHERE user_id=?`, TUNING.superMastery, userId);
  return {
    totalPhrases: Number(total),
    studied: Number(stats.studied || 0),
    mastered: Number(stats.mastered || 0),
    avgMastery: Math.round(Number(stats.avg || 0)),
  };
}

/* ------------------------------------------------------------------ *
 * 战斗状态（服务端内存，不落库；重启即失效）
 * ------------------------------------------------------------------ */

const battles = new Map();
const BATTLE_TTL = 2 * 3600e3;

function sweepBattles() {
  const now = Date.now();
  for (const [id, b] of battles) if (now - b.createdAt > BATTLE_TTL) battles.delete(id);
}

/* ------------------------------------------------------------------ *
 * API 1：今日任务
 * ------------------------------------------------------------------ */

route('GET', '/api/lingua/today', async (ctx) => {
  const uid = String(ctx.user.id);
  const due = q.all(
    `SELECT ph.*, p.mastery_score FROM phrase_progress p JOIN phrases ph ON ph.id = p.phrase_id
      WHERE p.user_id = ? AND p.next_review_at IS NOT NULL AND p.next_review_at <= ?
      ORDER BY p.next_review_at LIMIT ?`, uid, nowIso(), TUNING.dailyReview);
  const fresh = q.all(
    `SELECT * FROM phrases ph
      WHERE NOT EXISTS (SELECT 1 FROM phrase_progress p WHERE p.user_id = ? AND p.phrase_id = ph.id)
      ORDER BY ph.id LIMIT ?`, uid, TUNING.dailyNew);
  const dates = studyDates(uid);
  return {
    language: langMeta(),
    newPhrases: withMastery(fresh, uid).map((p) => briefPhrase(p, p.mastery)),
    reviewPhrases: due.map((p) => briefPhrase(p, p.mastery_score)),
    counts: { newCount: fresh.length, reviewCount: due.length },
    overview: masteryOverview(uid),
    streak: streakFrom(dates),
    tuning: ctx.query.debug ? TUNING : undefined,
  };
}, { auth: true });

/* ------------------------------------------------------------------ *
 * API 2：单条短语详情
 * ------------------------------------------------------------------ */

route('GET', '/api/lingua/phrase/:id', async (ctx) => {
  const uid = String(ctx.user.id);
  const p = q.get('SELECT * FROM phrases WHERE id=?', ctx.params.id);
  if (!p) throw new HttpError(404, '短语不存在');
  const progress = getProgress(uid, p.id);
  const mastery = computeMastery(progress);
  return {
    language: langMeta(),
    phrase: fullPhrase(p, mastery),
    progress: {
      masteryScore: mastery,
      spellAttempts: progress.spell_attempts,
      spellCorrects: progress.spell_corrects,
      selfAttempts: progress.self_attempts,
      selfPasses: progress.self_passes,
      lastReviewedAt: progress.last_reviewed_at,
      nextReviewAt: progress.next_review_at,
      battleBestTier: progress.battle_best_tier,
    },
    blanks: blankIndexes(p.phrase, parseJson(p.blank_priority, []), mastery),
    tuning: ctx.query.debug ? TUNING : undefined,
  };
}, { auth: true });

/* ------------------------------------------------------------------ *
 * API 3：学习页正式拼写提交
 * ------------------------------------------------------------------ */

route('POST', '/api/lingua/learn/submit', async (ctx) => {
  const uid = String(ctx.user.id);
  const phraseId = String(ctx.body.phraseId || '');
  const p = q.get('SELECT * FROM phrases WHERE id=?', phraseId);
  if (!p) throw new HttpError(404, '短语不存在');

  const selfResult = ctx.body.selfResult === 'pass' ? 'pass' : 'retry';
  const cls = classifySpelling(ctx.body.input, p.phrase);

  const row = getProgress(uid, phraseId);
  const spellAttempts = row.spell_attempts + 1;
  const spellCorrects = row.spell_corrects + (cls.tier === 'exact' ? 1 : 0);
  const selfAttempts = row.self_attempts + 1;
  const selfPasses = row.self_passes + (selfResult === 'pass' ? 1 : 0);
  const mastery = computeMastery({ spell_attempts: spellAttempts, spell_corrects: spellCorrects, self_attempts: selfAttempts, self_passes: selfPasses });
  const interval = reviewIntervalDays(mastery);
  const nextReview = new Date(Date.now() + interval * 86400e3).toISOString();

  q.run(
    `UPDATE phrase_progress SET spell_attempts=?, spell_corrects=?, self_attempts=?, self_passes=?,
       mastery_score=?, last_reviewed_at=?, next_review_at=? WHERE user_id=? AND phrase_id=?`,
    spellAttempts, spellCorrects, selfAttempts, selfPasses, mastery, nowIso(), nextReview, uid, phraseId);

  return {
    result: cls.tier,                       // exact | minor | miss
    distance: cls.distance,
    target: p.phrase,
    masteryScore: mastery,
    baseAtk: baseAttack(mastery),
    reviewedAt: nowIso(),
    nextReviewAt: nextReview,
    intervalDays: interval,
    nextBlanks: blankIndexes(p.phrase, parseJson(p.blank_priority, []), mastery),
  };
}, { auth: true });

/* ------------------------------------------------------------------ *
 * API 4：开始战斗
 * ------------------------------------------------------------------ */

function pickBattlePhrases(uid, n) {
  const picked = q.all(
    `SELECT ph.*, p.mastery_score FROM phrase_progress p JOIN phrases ph ON ph.id = p.phrase_id
      WHERE p.user_id=? AND p.next_review_at IS NOT NULL AND p.next_review_at <= ?
      ORDER BY p.next_review_at LIMIT ?`, uid, nowIso(), n);
  if (picked.length < n) {
    const excludeIds = picked.map((r) => r.id);
    const clause = excludeIds.length ? `AND ph.id NOT IN (${excludeIds.map(() => '?').join(',')})` : '';
    const more = q.all(
      `SELECT ph.*, COALESCE(p.mastery_score, 0) AS mastery_score FROM phrases ph
        LEFT JOIN phrase_progress p ON p.phrase_id = ph.id AND p.user_id = ?
        WHERE 1=1 ${clause} ORDER BY RANDOM() LIMIT ?`, uid, ...excludeIds, n - picked.length);
    picked.push(...more);
  }
  return picked;
}

route('GET', '/api/lingua/battle/start', async (ctx) => {
  const uid = String(ctx.user.id);
  sweepBattles();
  const rounds = pickBattlePhrases(uid, TUNING.battleRounds);
  if (!rounds.length) throw new HttpError(400, '短语库为空，无法进入战斗');
  const sequence = rounds.map((p) => {
    const mastery = p.mastery_score ?? 0;
    return {
      phraseId: p.id,
      phrase: p.phrase,
      tokens: parseJson(p.tokens, []),
      simple_def: p.simple_def,
      hint_script: p.hint_script,
      grammar_tag: p.grammar_tag,
      mastery,
      baseAtk: baseAttack(mastery),
      blanks: blankIndexes(p.phrase, parseJson(p.blank_priority, []), mastery),
    };
  });
  const totalAtk = sequence.reduce((s, r) => s + r.baseAtk, 0);
  const enemyMaxHp = Math.max(20, Math.round(totalAtk * TUNING.enemyHpFactor));

  const battle = {
    battleId: crypto.randomBytes(12).toString('hex'),
    userId: uid,
    createdAt: Date.now(),
    sequence,
    round: 0,
    enemyName: ENEMIES[Math.floor(Math.random() * ENEMIES.length)],
    enemyMaxHp,
    enemyHp: enemyMaxHp,
    playerMaxHp: TUNING.playerMaxHp,
    playerHp: TUNING.playerMaxHp,
    combo: 0,
    maxCombo: 0,
    totalDamage: 0,
    rounds: [],
  };
  battles.set(battle.battleId, battle);

  return {
    battleId: battle.battleId,
    enemyName: battle.enemyName,
    enemyMaxHp,
    enemyHp: battle.enemyHp,
    playerMaxHp: battle.playerMaxHp,
    playerHp: battle.playerHp,
    totalRounds: sequence.length,
    sequence,
    narration: [
      '🍭 一片棉花糖云飘来，上面坐着一只小妖怪…',
      `${battle.enemyName} 咧开嘴笑了笑，糖果味的烟雾弥漫开来——`,
      '🪄 快念出咒语！让魔法生效吧！',
    ],
    tuning: ctx.query.debug ? TUNING : undefined,
  };
}, { auth: true });

/* ------------------------------------------------------------------ *
 * API 5：战斗一回合
 * ------------------------------------------------------------------ */

route('POST', '/api/lingua/battle/round', async (ctx) => {
  const uid = String(ctx.user.id);
  const battle = battles.get(String(ctx.body.battleId || ''));
  if (!battle || battle.userId !== uid) throw new HttpError(404, '战斗不存在或已结束');
  if (battle.enemyHp <= 0 || battle.playerHp <= 0 || battle.round >= battle.sequence.length) {
    throw new HttpError(400, '战斗已经结束了');
  }

  const current = battle.sequence[battle.round];
  if (ctx.body.phraseId && String(ctx.body.phraseId) !== current.phraseId) {
    throw new HttpError(400, '提交的短语与本回合不符');
  }

  const cls = classifySpelling(ctx.body.input, current.phrase);
  const selfResult = ctx.body.selfResult === 'pass' ? 'pass' : 'retry';
  const mastery = current.mastery;
  const atk = current.baseAtk;

  let tier;
  let enemyDamage = 0;
  let selfDamage = 0;
  if (cls.tier === 'miss') {
    tier = 'miss';
    selfDamage = Math.max(TUNING.selfDamageMin, Math.round(atk * TUNING.selfDamageRatio));
  } else if (cls.tier === 'minor' || selfResult === 'retry') {
    tier = 'weak';
    enemyDamage = Math.round(atk * TUNING.weakFactor);
  } else {
    tier = mastery >= TUNING.superMastery ? 'super' : 'normal';
    enemyDamage = Math.round(atk * (tier === 'super' ? TUNING.superFactor : 1));
  }

  battle.enemyHp = Math.max(0, battle.enemyHp - enemyDamage);
  battle.playerHp = Math.max(0, battle.playerHp - selfDamage);
  battle.totalDamage += enemyDamage;
  if (tier === 'super' || tier === 'normal') {
    battle.combo += 1;
    battle.maxCombo = Math.max(battle.maxCombo, battle.combo);
  } else {
    battle.combo = 0;
  }

  // ===== 批次 3：6 维评分（基于现有数据估算）=====
  const spellingScore = cls.tier === 'exact' ? 100 : cls.tier === 'minor' ? 65 : Math.max(0, 40 - (cls.distance || 0) * 8);
  const accentScore = selfResult === 'pass' ? 85 : tier === 'miss' ? 30 : 55;
  const rhythmScore = Math.round((Math.max(0, 100 - (cls.distance || 0) * 10) + mastery) / 2);
  const stabilityScore = battle.combo >= 3 ? 95 : battle.combo >= 2 ? 85 : battle.combo >= 1 ? 72 : 55;
  const masteryScore = mastery;
  const comboScore = Math.min(100, battle.combo * 25 + 40);

  // 分 tier 维度解释
  const dimInsights = {
    super: {
      spelling: '每一个字母都像被星光点亮 ✨',
      accent: '念起来像从魔法书里飘出来的 📖',
      rhythm: '节奏感完美，像风铃在叮咚响 🎐',
      stability: '连续妖精级，稳定性爆炸 🎆',
      mastery: `熟练度已经 ${mastery}%，刻进脑海了 🌈`,
      combo: `连击 ${battle.combo} 次，妖精力量在累积！🦄`,
    },
    normal: {
      spelling: '拼写基本正确，有小瑕疵 🎯',
      accent: '发音不错，继续保持 🎤',
      rhythm: '节奏 OK，可以更流畅一点 🎶',
      stability: '状态平稳，再来就是妖精级 💫',
      mastery: `当前熟练度 ${mastery}%`,
      combo: `连击 ${battle.combo}，继续攒！💪`,
    },
    weak: {
      spelling: '拼写还有空间 📝',
      accent: '自评稍弱，多念几次试试 🎧',
      rhythm: '节奏有点卡壳，可以慢一点来 🐢',
      stability: '本轮断档了，别灰心～',
      mastery: `熟练度 ${mastery}%，加油！`,
      combo: '连击中断，重新开始攒吧 🔁',
    },
    miss: {
      spelling: '拼写错了不少，回去翻翻咒语书 📚',
      accent: '没念对也没关系，小妖怪笑你但不会真怪你 🍬',
      rhythm: '节奏和拼写一起重来 ✨',
      stability: '小失误，深呼吸再来 🌿',
      mastery: `熟练度 ${mastery}%，需要更多次修炼`,
      combo: '没关系，连击从 0 开始 ⭐',
    },
  };
  const ins = dimInsights[tier];

  const narrationByTier = {
    super: '🧚 妖精级魔法爆发！金色星光炸开——小妖怪被击飞了！',
    normal: '🌟 完美！咒语清亮如风铃，小妖怪退了半步。',
    weak: '💫 魔法有点虚弱，只击中了一半——小妖怪笑嘻嘻的。',
    miss: '🍬 念错了！糖果烟雾呛到自己啦——哎呀！',
  };

  const record = {
    phraseId: current.phraseId,
    phrase: current.phrase,
    tier,
    damage: enemyDamage,
    selfDamage,
    selfResult,
    spelling: cls.tier,
    distance: cls.distance,
    mastery,
  };
  battle.rounds.push(record);
  battle.round += 1;

  const lastRound = battle.round >= battle.sequence.length;
  return {
    round: battle.round,
    totalRounds: battle.sequence.length,
    tier,
    tierLabel: TIER[tier].label,
    damage: enemyDamage,
    selfDamage,
    narration: narrationByTier[tier],
    target: current.phrase,
    yourAnswer: String(ctx.body.input == null ? '' : ctx.body.input),
    enemyHp: battle.enemyHp,
    enemyMaxHp: battle.enemyMaxHp,
    playerHp: battle.playerHp,
    playerMaxHp: battle.playerMaxHp,
    combo: battle.combo,
    maxCombo: battle.maxCombo,
    defeated: battle.enemyHp <= 0,
    finished: lastRound || battle.enemyHp <= 0 || battle.playerHp <= 0,
    nextHint: !lastRound && battle.enemyHp > 0 ? battle.sequence[battle.round].hint_script : null,
    nextBlanks: !lastRound && battle.enemyHp > 0 ? battle.sequence[battle.round].blanks : null,
    dimensions: [
      { key: 'spelling', score: spellingScore, label: '拼写完整度', emoji: '📝', tip: ins.spelling },
      { key: 'accent', score: accentScore, label: '发音准确度', emoji: '🎤', tip: ins.accent },
      { key: 'rhythm', score: rhythmScore, label: '节奏流畅度', emoji: '🎶', tip: ins.rhythm },
      { key: 'stability', score: stabilityScore, label: '稳定性', emoji: '🎯', tip: ins.stability },
      { key: 'mastery', score: masteryScore, label: '熟练度基础', emoji: '🌈', tip: ins.mastery },
      { key: 'combo', score: comboScore, label: '连击加成', emoji: '💪', tip: ins.combo },
    ],
  };
}, { auth: true });

/* ------------------------------------------------------------------ *
 * API 6：战斗结算
 * ------------------------------------------------------------------ */

function battleTitle(battle) {
  const victory = battle.enemyHp <= 0;
  if (!victory) return { key: 'defeat', label: '再接再厉', blurb: '魔法暂时累了，休息一下再来！' };
  const supers = battle.rounds.filter((r) => r.tier === 'super').length;
  const hpRatio = battle.playerHp / battle.playerMaxHp;
  if (supers >= 2) return { key: 'nova', label: '🌟 魔法新星', blurb: '妖精级魔法连发！你已经是咒语大师啦～' };
  if (hpRatio >= 0.6) return { key: 'steady', label: '🌸 稳扎稳打', blurb: '每句咒语都像风铃一样准确。' };
  return { key: 'narrow', label: '🍭 险胜', blurb: '最后一个咒语才击退小妖怪——惊险又开心！' };
}

route('POST', '/api/lingua/battle/finish', async (ctx) => {
  const uid = String(ctx.user.id);
  const battle = battles.get(String(ctx.body.battleId || ''));
  if (!battle || battle.userId !== uid) throw new HttpError(404, '战斗不存在或已结束');

  const distribution = { super: 0, normal: 0, weak: 0, miss: 0 };
  for (const r of battle.rounds) distribution[r.tier] += 1;

  let mvp = null;
  for (const r of battle.rounds) {
    if (!mvp || r.damage > mvp.damage) mvp = r;
  }

  const createdAt = nowIso();
  for (const r of battle.rounds) {
    q.run('INSERT INTO battle_log (user_id,phrase_id,tier,damage,created_at) VALUES (?,?,?,?,?)',
      uid, r.phraseId, TIER[r.tier].label, r.damage, createdAt);
    const row = getProgress(uid, r.phraseId);
    const best = row.battle_best_tier;
    if (!best || (TIER_RANK[bestKeyFromLabel(best)] ?? -1) < TIER_RANK[r.tier]) {
      q.run('UPDATE phrase_progress SET battle_best_tier=? WHERE user_id=? AND phrase_id=?',
        TIER[r.tier].label, uid, r.phraseId);
    }
  }

  const victory = battle.enemyHp <= 0;
  const title = battleTitle(battle);
  const summary = {
    totalDamage: battle.totalDamage,
    maxCombo: battle.maxCombo,
    distribution,
    title: title.label,
    titleKey: title.key,
    titleBlurb: title.blurb,
    victory,
    enemyName: battle.enemyName,
    enemyHp: battle.enemyHp,
    enemyMaxHp: battle.enemyMaxHp,
    playerHp: battle.playerHp,
    playerMaxHp: battle.playerMaxHp,
    rounds: battle.rounds,
    mvp: mvp ? { phraseId: mvp.phraseId, phrase: mvp.phrase, tier: mvp.tier, tierLabel: TIER[mvp.tier].label, damage: mvp.damage } : null,
    totalRounds: battle.sequence.length,
  };

  battles.delete(battle.battleId);

  const overview = masteryOverview(uid);
  return {
    summary,
    overview,
    streak: streakFrom(studyDates(uid)),
  };
}, { auth: true });

function bestKeyFromLabel(label) {
  const hit = Object.values(TIER).find((t) => t.label === label);
  return hit ? hit.key : 'miss';
}

/* ------------------------------------------------------------------ *
 * API 7：状态页
 * ------------------------------------------------------------------ */

route('GET', '/api/lingua/profile', async (ctx) => {
  const uid = String(ctx.user.id);
  const overview = masteryOverview(uid);
  const distribution = q.all(
    `SELECT tier, COUNT(*) AS n, SUM(damage) AS damage FROM battle_log WHERE user_id=? GROUP BY tier`, uid)
    .map((r) => ({ tier: r.tier, count: Number(r.n), damage: Number(r.damage || 0) }));
  // 同一场战斗的所有回合共享同一个 created_at，故去重后即场次
  const battleCount = q.get(
    'SELECT COUNT(DISTINCT created_at) AS n FROM battle_log WHERE user_id=?', uid).n;
  const progressRows = q.all(
    `SELECT p.mastery_score, p.next_review_at, p.battle_best_tier, ph.phrase, ph.simple_def
       FROM phrase_progress p JOIN phrases ph ON ph.id = p.phrase_id
      WHERE p.user_id = ? ORDER BY p.mastery_score DESC LIMIT 8`, uid);
  const dates = studyDates(uid);
  return {
    language: langMeta(),
    overview,
    streak: streakFrom(dates),
    studyDays: dates.size,
    distribution,
    battles: Number(battleCount || 0),
    topPhrases: progressRows.map((r) => ({
      phrase: r.phrase,
      simple_def: r.simple_def,
      mastery: Math.round(r.mastery_score || 0),
      nextReviewAt: r.next_review_at,
      battleBestTier: r.battle_best_tier,
    })),
    tuning: ctx.query.debug ? TUNING : undefined,
  };
}, { auth: true });

/* ------------------------------------------------------------------ *
 * API 8：魔法书 / 打卡本数据（批次 1 新增）
 * ------------------------------------------------------------------ */

function fmtDate(iso) { return iso ? iso.slice(0, 10) : ''; }

route('GET', '/api/lingua/calendar', async (ctx) => {
  const uid = String(ctx.user.id);

  // 30 天打卡日历（每天：是否有战斗 / 最佳等级）
  const days = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push(key);
  }

  const battleByDay = {};
  const bl = q.all(
    `SELECT tier, damage, created_at FROM battle_log
      WHERE user_id=? AND created_at >= date('now','-30 days')`, uid);
  for (const row of bl) {
    const day = String(row.created_at).slice(0, 10);
    if (!battleByDay[day]) battleByDay[day] = { count: 0, tiers: {}, damage: 0 };
    battleByDay[day].count++;
    battleByDay[day].tiers[row.tier] = (battleByDay[day].tiers[row.tier] || 0) + 1;
    battleByDay[day].damage += row.damage || 0;
  }

  const calendar = days.map((day) => {
    const info = battleByDay[day];
    if (!info) return { date: day, hasBattle: false, tier: null, damage: 0, count: 0 };
    let bestTier = 'miss';
    let bestRank = TIER_RANK[bestTier];
    for (const t of Object.keys(info.tiers)) {
      const r = TIER_RANK[t];
      if (r > bestRank) { bestRank = r; bestTier = t; }
    }
    return { date: day, hasBattle: true, tier: bestTier, damage: info.damage, count: info.count };
  });

  // 咒语记忆曲线：每条咒语的熟练度 + 下次复习时间
  const phrases = q.all(
    `SELECT ph.id, ph.phrase, ph.simple_def,
            p.mastery_score, p.next_review_at, p.battle_best_tier
       FROM phrase_progress p JOIN phrases ph ON ph.id = p.phrase_id
      WHERE p.user_id = ?
      ORDER BY p.mastery_score DESC`, uid);

  // 统计未来复习时间分布（7 天内哪些到期）
  const nowIso = new Date().toISOString();
  const reviewBuckets = {
    today: 0,
    week: 0,
    soon: 0,
    later: 0,
  };
  for (const p of phrases) {
    const nr = p.next_review_at;
    if (!nr) { reviewBuckets.later++; continue; }
    const diff = (new Date(nr) - new Date()) / 86400000;
    if (diff <= 0) reviewBuckets.today++;
    else if (diff <= 7) reviewBuckets.week++;
    else if (diff <= 30) reviewBuckets.soon++;
    else reviewBuckets.later++;
  }

  // 熟练度分布图（0-100 分 5 档）
  const masteryBuckets = { novice: 0, warming: 0, steady: 0, fluent: 0, master: 0 };
  for (const p of phrases) {
    const m = p.mastery_score || 0;
    if (m < 20) masteryBuckets.novice++;
    else if (m < 40) masteryBuckets.warming++;
    else if (m < 65) masteryBuckets.steady++;
    else if (m < 85) masteryBuckets.fluent++;
    else masteryBuckets.master++;
  }

  return {
    calendar,            // 30 天打卡
    phrases: phrases.map((p) => ({
      id: p.id, phrase: p.phrase, simple_def: p.simple_def,
      mastery: Math.round(p.mastery_score || 0),
      nextReviewAt: p.next_review_at,
      battleBestTier: p.battle_best_tier,
    })),
    reviewBuckets,       // 复习时间分布
    masteryBuckets,      // 熟练度分布
    streak: streakFrom(studyDates(uid)),
    today: fmtDate(nowIso),
  };
}, { auth: true });

/* ------------------------------------------------------------------ *
 * 批次 4：自制魔法书分享（3 API）
 * ------------------------------------------------------------------ */

route('POST', '/api/lingua/template/create', async (ctx) => {
  const uid = String(ctx.user.id);
  const { title, emoji = '📖', description = '', phraseIds = [] } = ctx.body || {};
  if (!title) return { ok: false, error: '标题必填' };
  if (!Array.isArray(phraseIds) || phraseIds.length === 0)
    return { ok: false, error: '至少选一条咒语' };
  q.run(
    `INSERT INTO spell_templates (owner_id,title,emoji,description,phrase_ids,created_at,public,copies)
     VALUES (?,?,?,?,?,?,1,0)`,
    uid, title, emoji, description, JSON.stringify(phraseIds), nowIso());
  return { ok: true };
}, { auth: true });

route('GET', '/api/lingua/template/list', async (ctx) => {
  const uid = String(ctx.user.id);
  const mine = q.all("SELECT * FROM spell_templates WHERE owner_id=? ORDER BY created_at DESC", uid);
  const pub = q.all("SELECT * FROM spell_templates WHERE public=1 AND owner_id!=? ORDER BY copies DESC LIMIT 24", uid);
  const fmt = (r) => ({
    id: r.id, ownerId: r.owner_id,
    title: r.title, emoji: r.emoji, description: r.description,
    phraseIds: JSON.parse(r.phrase_ids || '[]'),
    createdAt: r.created_at, copies: Number(r.copies || 0),
  });
  return { mine: mine.map(fmt), public: pub.map(fmt) };
}, { auth: true });

route('POST', '/api/lingua/template/copy/:id', async (ctx) => {
  const uid = String(ctx.user.id);
  const tid = Number(ctx.params.id);
  const t = q.get('SELECT * FROM spell_templates WHERE id=? AND public=1', tid);
  if (!t) return { ok: false, error: '魔法书不存在' };
  // 把模板里的每条咒语都注入学习进度（如果还没有）
  const ids = JSON.parse(t.phrase_ids || '[]');
  for (const pid of ids) {
    const dup = q.get('SELECT 1 FROM phrase_progress WHERE user_id=? AND phrase_id=?', uid, pid);
    if (!dup) {
      q.run('INSERT INTO phrase_progress (user_id,phrase_id,mastery_score,next_review_at) VALUES (?,?,0,date("now"))',
        uid, pid);
    }
  }
  q.run('UPDATE spell_templates SET copies=copies+1 WHERE id=?', tid);
  return { ok: true, added: ids.length };
}, { auth: true });

module.exports = { TUNING };
