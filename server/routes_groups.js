/* ==========================================================================
 * 批次 2：群组学习 API（7 个端点）
 * ========================================================================== */

const { q } = require('./db');
const { route } = require('./http');

function nowIso() { return new Date().toISOString(); }
function inviteCode() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }

/* API 1：创建群组 */
route('POST', '/api/group/create', async (ctx) => {
  const uid = String(ctx.user.id);
  const { name = '小魔女团', emoji = '🪄', description = '' } = ctx.body || {};
  const code = inviteCode();
  const res = q.run(
    'INSERT INTO groups (name, emoji, owner_id, invite_code, description, created_at) VALUES (?,?,?,?,?,?)',
    name, emoji, uid, code, description, nowIso());
  q.run('INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?,?,?,?)',
    res.lastInsertRowid, uid, 'leader', nowIso());
  return { ok: true, groupId: res.lastInsertRowid, inviteCode: code };
}, { auth: true });

/* API 2：我的群组列表 */
route('GET', '/api/group/my', async (ctx) => {
  const uid = String(ctx.user.id);
  const rows = q.all(
    `SELECT g.*, gm.role,
            (SELECT COUNT(*) FROM group_members WHERE group_id=g.id) AS member_count
       FROM groups g JOIN group_members gm ON gm.group_id=g.id
      WHERE gm.user_id=?
      ORDER BY g.created_at DESC`, uid);
  return { groups: rows.map((r) => ({
    id: r.id, name: r.name, emoji: r.emoji, ownerId: r.owner_id,
    inviteCode: r.invite_code, description: r.description, created_at: r.created_at,
    role: r.role, memberCount: Number(r.member_count || 0),
  })) };
}, { auth: true });

/* API 3：加入群组 */
route('POST', '/api/group/join', async (ctx) => {
  const uid = String(ctx.user.id);
  const { inviteCode } = ctx.body || {};
  if (!inviteCode) return { ok: false, error: '缺少邀请码' };
  const g = q.get('SELECT * FROM groups WHERE invite_code=?', String(inviteCode).toUpperCase());
  if (!g) return { ok: false, error: '找不到这个魔法团' };
  const dup = q.get('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?', g.id, uid);
  if (dup) return { ok: false, error: '你已经在这个团里了' };
  q.run('INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?,?,?,?)',
    g.id, uid, 'member', nowIso());
  return { ok: true, groupId: g.id };
}, { auth: true });

/* API 4：群组详情 */
route('GET', '/api/group/:id', async (ctx) => {
  const uid = String(ctx.user.id);
  const gid = Number(ctx.params.id);
  const g = q.get('SELECT * FROM groups WHERE id=?', gid);
  if (!g) return { ok: false, error: '群组不存在' };
  const me = q.get('SELECT role FROM group_members WHERE group_id=? AND user_id=?', gid, uid);
  if (!me) return { ok: false, error: '你不是这个团的成员' };
  const members = q.all(
    `SELECT gm.user_id, gm.role, gm.joined_at,
            (SELECT COUNT(*) FROM battle_log WHERE user_id=gm.user_id) AS battles
       FROM group_members gm WHERE gm.group_id=? ORDER BY gm.role DESC, gm.joined_at ASC`, gid);
  const tasks = q.all(
    `SELECT t.*,
            (SELECT nickname FROM users WHERE id=t.author_id) AS author_name,
            (SELECT nickname FROM users WHERE id=t.assignee_id) AS assignee_name
       FROM group_tasks t WHERE t.group_id=? ORDER BY t.created_at DESC`, gid);
  const checkins = q.all(
    `SELECT c.*, (SELECT nickname FROM users WHERE id=c.user_id) AS user_name
       FROM group_checkins c WHERE c.group_id=? ORDER BY c.verified_at DESC LIMIT 100`, gid);
  return {
    ok: true,
    group: { id: g.id, name: g.name, emoji: g.emoji, inviteCode: g.invite_code,
             ownerId: g.owner_id, description: g.description },
    myRole: me.role,
    members: members.map((m) => ({
      userId: m.user_id, role: m.role, joinedAt: m.joined_at, battles: Number(m.battles || 0),
    })),
    tasks: tasks.map((t) => ({
      id: t.id, title: t.title, authorId: t.author_id, authorName: t.author_name,
      phraseId: t.phrase_id, verifyType: t.verify_type, description: t.description,
      dueDate: t.due_date, createdAt: t.created_at, assigneeId: t.assignee_id,
      assigneeName: t.assignee_name, status: t.status,
    })),
    checkins: checkins.map((c) => ({
      taskId: c.task_id, userId: c.user_id, userName: c.user_name,
      verifiedAt: c.verified_at, note: c.note,
    })),
  };
}, { auth: true });

/* API 5：发布任务 */
route('POST', '/api/group/:id/task', async (ctx) => {
  const uid = String(ctx.user.id);
  const gid = Number(ctx.params.id);
  const { title, phraseId, verifyType = 'spell', description = '', dueDate = '' } = ctx.body || {};
  if (!title) return { ok: false, error: '任务标题必填' };
  const me = q.get('SELECT role FROM group_members WHERE group_id=? AND user_id=?', gid, uid);
  if (!me || me.role !== 'leader') return { ok: false, error: '只有团长才能发布任务' };
  const res = q.run(
    `INSERT INTO group_tasks (group_id, author_id, title, phrase_id, verify_type, description, due_date, created_at, status)
     VALUES (?,?,?,?,?,?,?,?, 'open')`,
    gid, uid, title, phraseId || null, verifyType, description, dueDate || null, nowIso());
  return { ok: true, taskId: res.lastInsertRowid };
}, { auth: true });

/* API 6：抽签分配 */
route('POST', '/api/group/:id/draw', async (ctx) => {
  const uid = String(ctx.user.id);
  const gid = Number(ctx.params.id);
  const me = q.get('SELECT role FROM group_members WHERE group_id=? AND user_id=?', gid, uid);
  if (!me || me.role !== 'leader') return { ok: false, error: '只有团长才能抽签' };
  const openTask = q.get("SELECT * FROM group_tasks WHERE group_id=? AND status='open' ORDER BY created_at DESC LIMIT 1", gid);
  if (!openTask) return { ok: false, error: '没有待抽签的任务' };
  const members = q.all("SELECT user_id FROM group_members WHERE group_id=? AND role='member'", gid);
  if (members.length === 0) return { ok: false, error: '团里没有成员' };
  const lucky = members[Math.floor(Math.random() * members.length)];
  q.run("UPDATE group_tasks SET assignee_id=?, status='drawn' WHERE id=?", lucky.user_id, openTask.id);
  return { ok: true, taskId: openTask.id, assigneeId: lucky.user_id };
}, { auth: true });

/* API 7：打卡 */
route('POST', '/api/group/:group_id/checkin/:task_id', async (ctx) => {
  const uid = String(ctx.user.id);
  const gid = Number(ctx.params.group_id);
  const tid = Number(ctx.params.task_id);
  const { note = '' } = ctx.body || {};
  const task = q.get('SELECT * FROM group_tasks WHERE id=? AND group_id=?', tid, gid);
  if (!task) return { ok: false, error: '任务不存在' };
  const me = q.get('SELECT 1 FROM group_members WHERE group_id=? AND user_id=?', gid, uid);
  if (!me) return { ok: false, error: '你不是这个团的成员' };
  const dup = q.get('SELECT 1 FROM group_checkins WHERE task_id=? AND user_id=?', tid, uid);
  if (dup) return { ok: false, error: '你已经打过卡了' };
  q.run('INSERT INTO group_checkins (task_id, group_id, user_id, verified_at, note) VALUES (?,?,?,?,?)',
    tid, gid, uid, nowIso(), note);
  const stillOpen = q.get(
    `SELECT gm.user_id FROM group_members gm
      LEFT JOIN group_checkins ck ON ck.task_id=? AND ck.user_id=gm.user_id
     WHERE gm.group_id=? AND ck.id IS NULL`, tid, gid);
  if (!stillOpen) q.run("UPDATE group_tasks SET status='done' WHERE id=?", tid);
  return { ok: true };
}, { auth: true });

module.exports = {};
