# 渐进式探索 UI

`window.lingguang.data.explore(query, currentHTML?, onStreamChunk?)` 返回带样式及 `button[data-query]` 入口的 HTML，适合主题探索、分支故事和逐层学习。
只需要固定组件消费结构化事实时用 [data.fetch](API_DATAFETCH.md)；只需要文字对话流时用 [AI Stream Chat](API_AI_STREAM_CHAT.md)。

```ts
export async function exploreTopic(
  query: string,
  currentHTML: string,
  renderHTML: (html: string) => void,
) {
  await window.lingguang.data.explore(query, currentHTML, renderHTML);
}
```

query 包含当前实体、用户选择和必要上下文；currentHTML 提供当前页面/主题，首次可传应用的背景与主题描述。
流式回调得到的是累计 HTML，每次覆盖显示而不是拼接；流式模式完成时 Promise 可返回 null，最终页面来自回调。
未传流式回调时，Promise 返回完整 HTML 或 null；调用异常应显示错误及同一 query 的重试入口，不追加空历史页。

探索状态和历史放在切换页面时仍存活的组件或状态所有者中，子页面负责展示。
每个主题分别维护 HTML、历史和当前位置；返回时恢复已有页面，不重新生成全部历史。
生成下一步成功后再写历史，处于历史中间时继续探索应截断后续分支。
同一主题避免重叠请求；重试保留失败的原 query，不静默改查默认主题。

HTML 容器使用点击委派读取最近的 `button[data-query]`，把该按钮 query 发给下一次 explore。
不要自行硬编码全部探索层级，也不要将用户任意 HTML 或脚本混入返回内容执行。
新的内容生成时保留上一屏和局部加载反馈，完成后展示新页并处理滚动位置。
