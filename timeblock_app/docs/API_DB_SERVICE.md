# QuickJS 服务端数据库

在 `service/app/controller/` 中从 `@server` 导入 `db`。
Schema、表权限、SQL 限制、主键和时间规则与 [数据库合同](API_DB.md) 相同；先阅读该文档的建表与数据权限部分。
前端通过 [Service API](API_SERVICE.md) 调用 controller，不绕过 controller 直接写同一业务数据。

```ts
import { db } from '@server';
import { json } from '@server/response';
import type { ControllerInput } from '@server/types';

type Note = { id: string; content: string; created_at: number };
type AddNoteInput = ControllerInput<{ id: string; content: string }>;

export function listNotes() {
  const result = db.query<Note>({
    sql: 'SELECT id, content, created_at FROM notes ORDER BY created_at DESC LIMIT ?',
    binds: [50],
  });
  if (!result.success) return json({ message: result.message }, { status: 500 });
  return json({ notes: result.data });
}

export function addNote(input: AddNoteInput) {
  const { id, content } = input.body;
  if (!id || !content.trim()) return json({ message: 'id 和 content 必填' }, { status: 400 });
  const result = db.execute({
    sql: 'INSERT INTO notes (id, content, created_at) VALUES (?, ?, ?)',
    binds: [id, content, Date.now()],
  });
  if (!result.success) return json({ message: result.message }, { status: 500 });
  return json({ id, rowsAffected: result.data?.rowsAffected });
}
```

示例的表和操作须先通过平台 Schema 能力及 `openapi/spec.json` 定义。
controller 校验业务输入，平台从可信调用上下文绑定用户、应用与版本；请求 body 不接受调用方自行指定的平台身份。
`db.query<T>({ sql, binds? })` 返回 `{ success, data?: T[], message? }`，`db.execute` 返回 `{ success, data?: { rowsAffected }, message? }`。
当前 `@server` 方法同步返回宿主结果，调用失败也可能抛出异常；使用 `await` 不会增加并行能力，不把失败写成成功的空数据。
此处没有前端 `timeoutMs` / `AbortSignal` 参数。

QuickJS 没有浏览器的 `window`、DOM、`crypto.randomUUID()`，也不提供 Node 内置模块或任意网络访问。
需要立即返回或跨表复用的新 ID，由浏览器生成后通过 Service 输入传入；平台不返回 `lastInsertId`。
只在前端等待 `currentRoleReady` 并做角色 UI 分流，不在 controller 中访问浏览器全局变量。
