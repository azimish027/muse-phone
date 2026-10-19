# window.lingguang.ai.chat

非流式 AI Chat API，替代 legacy `window.callLLM`。支持 `messages` 多轮上下文和 `responseFormat` 结构化输出。

可选 `model` 字段用于指定模型名称；不传时由服务端选择默认模型。只有用户或配置明确给出模型名称时才传，不要臆造模型名。

```typescript
const result = await window.lingguang.ai.chat({
  messages: [
    { role: 'system', content: '你是一个简洁、准确的助手。' },
    { role: 'user', content: '请用三句话介绍量子计算。' },
  ],
  responseFormat: { type: 'text' },
  timeout: 60000,
});

setText(result.content);
```
需要稳定 JSON 时使用 `json_schema`，并从 `result.data` 读取：

```typescript
const result = await window.lingguang.ai.chat({
  messages: [
    { role: 'system', content: '你是一个信息抽取助手。' },
    { role: 'user', content: '提取：杭州，亲子展览。' },
  ],
  responseFormat: {
    type: 'json_schema',
    jsonSchema: {
      name: 'event_query',
      strict: true,
      schema: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          topic: { type: 'string' },
        },
        required: ['city', 'topic'],
        additionalProperties: false,
      },
    },
  },
});
```

## 调用合同

- 使用非空 `messages` 表达上下文，消息角色为 `system | user | assistant`，每条 `content` 是非空字符串。
- `responseFormat.type` 支持 `text`、`json_object`、`json_schema`；Markdown 属于 text 内容，不是独立类型。
- 文本从 `result.content` 读取；需要字段结构时使用 `json_schema`，从最终 `result.data` 读取，不重复解析 `result.content`。
- JSON 字段结构只通过 `responseFormat.jsonSchema.schema` 声明，不在 system message 中重复描述 Schema 或 JSON 示例。
- `jsonSchema.name` 描述当前输出结构，不使用受管能力保留名称 `dsv4_flash_interpretation`。
- JSON 解析或 Schema 校验失败时 Promise reject；TypeScript 类型断言不会转换结果或代替运行时校验。
- Markdown 内容使用 `react-markdown` 渲染；只需纯文本时，在消息中明确要求纯文本。
- 由按钮、提交或 Enter 等明确动作触发，调用期间禁用重复提交；不在输入监听、轮询、渲染或自动重试循环中调用。
- `timeout` 单位为毫秒；通过 `signal: controller.signal` 传入 AbortController 的信号，取消或组件卸载时调用 `controller.abort()`。
- 失败时进入错误状态，不写入伪造业务结果。

依赖公开事实、实时信息或原文资料时，先按工作区对应数据 API 合同取得资料，再作为 messages 上下文交给 AI 加工。
