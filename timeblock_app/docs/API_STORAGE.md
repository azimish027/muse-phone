---
skill_name: STORAGE
display_name: 持久化存储
description: 当前用户与应用范围的小型键值数据；业务记录、共享数据和平台权限使用 DB。
api_file: API_STORAGE.md
enable: true
---

# Storage API

`window.lingguang.storage` 提供异步键值存储，适用于少量、固定 key 的设置或单份游戏进度。
有多条记录、增长列表、查询分页、多用户共享或角色权限的需求使用 [DB](API_DB.md)，不把整个业务列表塞进一个 key。

| 方法 | 结果 |
| --- | --- |
| `setItem(key, value)` | `Promise<boolean>` |
| `getItem(key)` | `Promise<value | null>` |
| `removeItem(key)` | `Promise<boolean>` |
| `clear()` | `Promise<boolean>` |

key 使用字符串，value 使用可 JSON 序列化的数据；应用设置通常使用一个明确的对象结构。
读取可能返回 null，写入可能失败或 reject；失败不应显示保存成功，也不在读取失败后覆盖已有数据。
旧版本数据需在读取边界迁移到当前应用结构，再进入业务 state；不在每次渲染时散落修补逻辑。
清空或删除应来自用户明确操作，不作为初始化步骤。

```ts
export async function saveTheme(theme: 'light' | 'dark') {
  const saved = await window.lingguang.storage.setItem('settings', { theme });
  if (!saved) throw new Error('设置保存失败');
}
```

这些是前端方法，参数为位置参数。
QuickJS controller 中使用 `import { storage } from '@server'`，形式为 `storage.setItem({ key, value })` / `storage.getItem({ key })`，并同步返回宿主结果；见 [Service API](API_SERVICE.md)。
两种形式都不允许调用方指定他人的用户 ID、任意应用 ID 或存储凭据。

