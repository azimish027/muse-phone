'use strict';

/** 演示用社区内容：首次启动时注入示例用户、帖子与互动数据 */

const { q } = require('./db');
const A = require('./auth');

const DEMO_USERS = [
  { email: 'linxiaoyu@example.com', nickname: '林小雨', color: '#ec4899', xp: 2480, streak: 24, lang: 'en', lessons: 13 },
  { email: 'kenji@example.com', nickname: 'Kenji', color: '#0ea5e9', xp: 1930, streak: 15, lang: 'ja', lessons: 9 },
  { email: 'minji@example.com', nickname: '민지', color: '#8b5cf6', xp: 3120, streak: 31, lang: 'ko', lessons: 10 },
  { email: 'alex@example.com', nickname: 'Alex', color: '#f97316', xp: 860, streak: 6, lang: 'en', lessons: 6 },
  { email: 'wangzhe@example.com', nickname: '王者风范', color: '#14b8a6', xp: 610, streak: 3, lang: 'ja', lessons: 4 },
];

const DEMO_POSTS = [
  {
    user: 0, lang: 'en', topic: '经验分享',
    title: '坚持 24 天，我把「影子跟读法」用出了效果',
    body: '每天 15 分钟，先听原句，再延迟 0.5 秒跟读。刚开始舌头打结，两周后发音明显顺了。关键是不要看文本，逼自己用耳朵抓节奏。推荐大家把「口语跟读」模块当成每天的第一件事。',
  },
  {
    user: 1, lang: 'ja', topic: '答疑求助',
    title: 'は 和 が 到底怎么区分？',
    body: '学到 A2 还是经常选错。「私は学生です」和「私が学生です」语感差别好大，有没有好记的判断方法？',
  },
  {
    user: 2, lang: 'ko', topic: '学习打卡',
    title: '连续 31 天打卡 ✅ 韩语敬语体系入门了',
    body: '从 -습니다 到 -요，终于不再混用。今天把 A2 的语法课全部刷完，听力正确率从 60% 提到了 85%。明天挑战口语跟读满分。',
  },
  {
    user: 3, lang: 'en', topic: '资源推荐',
    title: '用「听力跟写」压榨每一段音频',
    body: '听完立刻默写，错的词直接加进生词本，第二天复习。这样比单纯刷题效率高很多，一周能稳定掌握 30 个新词。',
  },
  {
    user: 0, lang: 'en', topic: '语伴招募',
    title: '找一起练英语口语的伙伴（B1 水平）',
    body: '每天晚上 8 点，各挑一段课文互相跟读打分。有兴趣的留言或者私信我～',
  },
  {
    user: 4, lang: 'ja', topic: '经验分享',
    title: '日语假名不要死记，放进句子里的效率高 3 倍',
    body: '我一开始每天抄五十音，记住了又会忘。后来改成用单词卡片带假名，配合例句朗读，两周就稳了。',
  },
  {
    user: 2, lang: 'ko', topic: '资源推荐',
    title: '韩语收音（받침）零基础也能听出来',
    body: '别怕连音规则，先把常见收音单独练熟，再看句子。听力题里最容易丢分的就是收音。',
  },
];

const DEMO_COMMENTS = [
  { post: 0, user: 3, body: '影子跟读法确实有效，我坚持两周也感觉语速上来了。' },
  { post: 0, user: 2, body: '试试配合录音对比，进步会更快！' },
  { post: 1, user: 1, body: 'は 提示主题（已知信息），が 提示主语（新信息/焦点）。' },
  { post: 1, user: 0, body: '看上下文重点，焦点在「谁」就用が。' },
  { post: 2, user: 4, body: '31 天太强了，求带！' },
  { post: 3, user: 0, body: '默写这个方法我明天就用起来。' },
  { post: 5, user: 2, body: '假名配例句真的香，赞一个。' },
];

function seedDemoContent() {
  const existing = q.get('SELECT COUNT(*) AS n FROM posts').n;
  if (existing > 0) return { seeded: false };

  const ids = [];
  for (const u of DEMO_USERS) {
    let row = q.get('SELECT id FROM users WHERE email=?', u.email);
    if (!row) {
      q.run('INSERT INTO users (email,password_hash,nickname,avatar_color,created_at) VALUES (?,?,?,?,?)',
        u.email, A.hashPassword('demo1234'), u.nickname, u.color, A.nowIso());
      const id = Number(q.get('SELECT last_insert_rowid() AS id').id);
      q.run('INSERT INTO profiles (user_id,target_langs,placement,onboarded) VALUES (?,?,?,1)',
        id, JSON.stringify([u.lang]), u.lessons > 10 ? 'A2' : 'A1');
      q.run(`INSERT INTO user_stats (user_id,xp,streak,best_streak,total_minutes,last_study_date)
             VALUES (?,?,?,?,?,?)`,
        id, u.xp, u.streak, u.streak, u.xp * 0.8, new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10));
      ids.push(id);
    } else {
      ids.push(Number(row.id));
    }
  }

  // 让示例用户拥有真实的课程进度，排行榜与社区数据更可信
  DEMO_USERS.forEach((u, i) => {
    const lessons = q.all(
      `SELECT l.id, l.module, l.xp, l.duration_min, c.lang FROM lessons l JOIN courses c ON c.id=l.course_id
        WHERE c.lang=? ORDER BY c.level_order, l.order_index LIMIT ?`, u.lang, u.lessons);
    lessons.forEach((l, idx) => {
      const score = 100 - ((idx * 7) % 30);
      q.run(`INSERT OR IGNORE INTO lesson_progress (user_id,lesson_id,status,best_score,attempts,last_at,completed_at)
             VALUES (?,?,'completed',?,?,?,?)`, ids[i], l.id, score, 1, A.nowIso(), A.nowIso());
    });
  });

  DEMO_POSTS.forEach((p) => {
    q.run('INSERT INTO posts (user_id,lang,topic,title,body,created_at) VALUES (?,?,?,?,?,?)',
      ids[p.user], p.lang, p.topic, p.title, p.body,
      new Date(Date.now() - Math.round(Math.random() * 6 + 1) * 86400e3).toISOString());
  });
  DEMO_COMMENTS.forEach((c) => {
    q.run('INSERT INTO comments (post_id,user_id,body,created_at) VALUES (?,?,?,?)',
      c.post + 1, ids[c.user], c.body, new Date(Date.now() - Math.round(Math.random() * 3) * 86400e3).toISOString());
  });
  for (let i = 1; i <= DEMO_POSTS.length; i++) {
    DEMO_USERS.forEach((_, idx) => {
      if ((i + idx) % 3 !== 0) return;
      q.run('INSERT OR IGNORE INTO post_likes (post_id,user_id,created_at) VALUES (?,?,?)',
        i, ids[idx], A.nowIso());
    });
  }
  return { seeded: true, posts: DEMO_POSTS.length, users: ids.length };
}

module.exports = { seedDemoContent };
