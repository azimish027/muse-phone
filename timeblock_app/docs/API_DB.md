# 数据库 API

关系型 DB 用于会增长的业务记录、按条增删改查、筛选分页和多用户权限。
小型、固定 key 的个人偏好可以使用 [Storage](API_STORAGE.md) 或应用已有的本地存储；它们不能替代共享数据和平台权限。
天气、新闻、行情等公开信息使用 [数据获取 API](API_DATAFETCH.md)，DB 保存用户记录和需要维护的业务状态。

纯前端应用调用 `window.lingguang.db`。
有业务 Service 的应用在 controller 中使用 [服务端 DB](API_DB_SERVICE.md)，前端通过 Service API 访问同一业务合同。
两种方式使用相同的平台数据库、Schema 和权限规则，不需要为不同运行时再建一份数据。

## 建表与数据权限

运行时代码只执行 SELECT / INSERT / UPDATE / DELETE。
建表、修改 Schema 和查看表结构在开发阶段通过 `CapabilityCall` 的 `db.get_table_schema` / `db.update_table_schema` 完成；调用前读取对应 capability 的 help。
按需求确定每个数据对象由谁创建、谁可读写、普通用户之间是否可见、管理员是否需要汇总；`data_object` 和 `table_kind` 与该业务定义保持一致。

| table_kind | 数据边界 |
| --- | --- |
| `user` | 用户真私有；管理员也不能用它汇总其他用户的私人记录 |
| `managed_user` | 普通用户隔离；管理员可汇总和管理 |
| `share` | 所有人共享读写 |
| `share_owned` | 所有人可读，普通用户写自己的记录，管理员可管理全部 |

公共清单与个人完成状态应分表；公开预置资料与私人新增内容也应分开。
例如公共课程用 `share_owned`，个人学习进度用 `user`；需要教师汇总的作业提交用 `managed_user`。
平台负责身份和版本隔离，应用不要自行写系统用户、应用 ID 或版本列来替代权限策略。

少量公共初始化数据可通过 `CapabilityCall` 的 `db.seed_data` 登记，读取 help 后按平台限制使用。
固定展示的大语料或长文本放入静态资源；实时数据不做 seed，也不在首次打开时批量搜索并冒充预置数据。
需要可信来源的预置资料先使用当前可用的生成期取数能力核实来源，不凭模型记忆标成权威资料。

## 前端接口

类型声明位于 [src/global.d.ts](../src/global.d.ts)，业务代码不重新声明 `window.lingguang`。

```ts
type Note = { id: string; content: string; created_at: number };

export async function listNotes() {
  const result = await window.lingguang.db.query<Note>({
    sql: 'SELECT id, content, created_at FROM notes ORDER BY created_at DESC LIMIT ?',
    binds: [50],
  });
  if (!result.success) throw new Error(result.message);
  return result.data;
}

export async function addNote(content: string) {
  const id = crypto.randomUUID();
  const result = await window.lingguang.db.execute({
    sql: 'INSERT INTO notes (id, content, created_at) VALUES (?, ?, ?)',
    binds: [id, content, Date.now()],
  });
  if (!result.success) throw new Error(result.message);
  return { id, rowsAffected: result.data.rowsAffected };
}
```

示例以开发阶段已创建 `notes` 表为前提。
`query` 返回 `{ success, data, message? }`，成功时 `data` 为对象数组，不是直接返回数组。
`execute` 成功时 `data.rowsAffected` 表示受影响行数；平台不支持 `lastInsertId`。
`DbReq` 还可传 `timeoutMs` 和 `signal`；调用失败可能返回 `success: false` 或抛错，页面应显示实际错误及重试入口，不显示“保存成功”。

## SQL 合同

- 所有动态值使用 `?` 和顺序对应的 `binds`，不拼接 SQL 值。
- SELECT 必须带 `LIMIT`，上限 5000；列表使用分页。
- 显式列出输出列，只有改名、表达式或消除 JOIN 重名时使用 `AS`。
- 支持基本 WHERE、LIKE / ILIKE、字面量或占位符列表的 IN；不支持子查询、EXISTS、CTE、UNION / INTERSECT / EXCEPT、事务语句。
- 最多两表 INNER / LEFT JOIN，ON 为简单等值条件；ORDER BY 最多 3 项，GROUP BY 最多 5 项，DISTINCT 最多 5 个输出列。
- 聚合使用 COUNT / SUM / AVG / MAX / MIN；不使用 GROUP_CONCAT、窗口函数、RAND / RANDOM、FIELD 等未支持函数。
- INSERT 显式指定列和主键，一次最多 1000 行；不使用 AUTO_INCREMENT / AUTOINCREMENT。
- UPDATE / DELETE 使用明确的业务条件，不使用子查询或元组比较。
- 运行时不执行 DDL，也不查询 `information_schema`、`mysql`、`performance_schema` 或 `sys`。

业务 ID 默认使用字符串，与接口和 Schema 保持一致。
浏览器可以生成 UUID 并传给后端；只在 INSERT 内生成且无需立即返回/复用时，可以使用受支持的 SQL `UUID()`；`SELECT UUID()` 不支持。
日期时间列返回字符串，数值列返回 number，JSON 列返回对象或数组；业务代码不要把数据库日期直接声明为 `Date`。
用户可见时间和业务日期应在代码中明确时区并通过 `binds` 写入，例如 `Date.now()`；不要用数据库 session 的 `NOW()` 表达用户当地时间。

## 角色与业务身份

前端管理入口等待 `window.currentRoleReady` 后，根据 `window.currentRole === 'MANAGER'` 展示。
普通用户自己的提交、评论、报名不等于管理员操作；实际读写权限仍由后端控制，UI 显隐不是鉴权。
不设计管理员密码、角色选择或首个用户自动成为管理员，也不新建角色表替代平台角色。

姓名、昵称等用于展示；需要业务用户资料时，先查询当前用户已保存的资料并复用，查不到才创建。
不要使用假想的 `window.lingguang.userId`，也不要每次刷新随机生成一个新身份。
定位“我的公开记录”使用已保存的业务 ID 或个人状态表，不从全量公开列表按姓名、时间或标题猜测归属。

## 列表刷新

进入页面、筛选/分页变化和写操作成功后，回读当前查询并提供手动刷新入口。
需要持续更新的业务列表按需求设置有间隔的局部刷新，清理 timer，并避免同一列表重叠请求。
刷新保留已有列表、筛选和输入；失败时保留旧内容并标注更新时间及错误，不用空数组冒充最新结果。
