# window.lingguang.ai.streamChat

流式 AI Chat API，替代 legacy `window.lingguang.ai.llmStream`。过程态通过 `onEvent` 接收，Promise resolve 最终结果。

可选 `model` 字段用于指定模型名称；不传时由服务端选择默认模型。只有用户或配置明确给出模型名称时才传，不要臆造模型名。

```typescript
const result = await window.lingguang.ai.streamChat({
  messages: [
    { role: 'system', content: '你是一个简洁、准确的助手。' },
    { role: 'user', content: '请用三句话介绍量子计算。' },
  ],
  responseFormat: { type: 'text' },
  onEvent: (event) => {
    if (event.type === 'text_delta') {
      setText(event.text);
    }
    if (event.type === 'error') {
      showError(event.message);
    }
  },
});

setText(result.content);
```

结构化结果从最终 `result.data` 读取。
`json_schema` 可能缓冲正文，不保证中间文本进度。

## 事件与结构化结果

消息和 `responseFormat` 遵守 [AI_CHAT](API_AI_CHAT.md) 的合同；使用 `messages`，不使用 legacy 的 `prompt/systemPrompt`。

- `text_delta`：`delta` 是增量，`text` 是当前完整文本；通常用 `event.text` 覆盖 UI。
- `message_done`：包含最终 `content`、可选 `data/finishReason/traceId`。
- `error`：包含 `message` 和可选错误信息；调用失败也会 reject，应处理 Promise 的失败状态。
- `json_schema` 输出由服务端缓冲并校验，只消费最终 `data`；不依赖逐段 JSON，也不解析 `text_delta` 作为业务数据。
- Markdown 用 `react-markdown` 渲染；`responseFormat` 没有 markdown 类型。
- 只在用户明确提交时调用，避免输入变化、轮询和重复提交触发请求。
- `onEvent` 是可选回调；取消使用 `signal`，组件卸载时取消仍在执行的请求。

```ts
const controller = new AbortController();
const pending = window.lingguang.ai.streamChat({
  messages: [{ role: 'user', content: '请简要解释光合作用。' }],
  signal: controller.signal,
  onEvent: (event) => {
    if (event.type === 'text_delta') setText(event.text);
  },
});
// 将 controller 保存在本轮请求所属的组件中；取消/卸载时调用 controller.abort()。
try {
  const result = await pending;
  setText(result.content);
} catch (error) {
  showError(String(error));
}
```
