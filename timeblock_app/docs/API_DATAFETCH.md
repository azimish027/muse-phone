---
skill_name: DATAFETCH
display_name: 通用联网数据获取
description: 获取公开网页信息并按 JSON Schema 返回；专用数据 API 能满足需求时优先使用对应接口。
api_file: API_DATAFETCH.md
enable: true
---

# 公开信息与结构化数据获取

前端使用 `window.lingguang.data.fetch(query, schema, location?)`；QuickJS 后端使用 [webSearch.fetch](API_WEBSEARCH_SERVICE.md)。
它获取已公开发布的信息，不读取用户私有数据，不是任意公网 HTTP 客户端，也不保证指定 URL 抓取。
事实、来源和更新时间以真实返回为准；AI chat 用于加工已取得的信息，不替代事实取数。

## API 选择

| 需求 | 优先入口 |
| --- | --- |
| 天气、预报、空气质量、生活指数 | [data.getWeather](API_DATA_WEATHER.md) |
| 法币汇率 | [data.getExchangeRate](API_DATA_EXCHANGE_RATE.md) |
| 股票现价与最近走势 | [data.getStockPrice](API_DATA_STOCK_PRICE.md) |
| 股票 K 线 | [data.getStockCandlestickData](API_DATA_STOCK_CANDLESTICK.md) |
| 贵金属行情 | [data.getPreciousMetalPrice](API_DATA_PRECIOUS_METAL_PRICE.md) |
| 新闻、百科、商品参数、攻略等通用公开信息 | `data.fetch` |

专用 API 链路更短、结构更明确；公开合同不能满足所需标的、字段、范围、粒度或结构时，仍可使用 `data.fetch`。
这不表示通用检索不支持五类专用场景。
五类数据改走通用检索时，先读取 [结构化返回兼容说明](WEBSEARCH_MCP_CANONICAL.md)。
混合需求可以分别取数；需要同一份数据一致性时，按完整消费结构查询。

## 参数与结果

- `query`：自然语言，写清实体、时间范围、条数、市场、币种/单位和筛选条件；时效信息使用实际日期，不把示例日期作为“今天”。
- `schema`：应用应显式提供 JSON Schema，顶层为 object，不能是 array。
- `location`：附近/周边查询必传；先用 `window.lingguang.getLocation({ poi: true })` 获取，不猜测用户所在地。包含 `longitude/latitude`，可带 `province/city/district/pois/nearbyPoi`。
- 返回 Promise，成功为结构化对象；无结果可能为 null，宿主失败或超时也可能 reject，不能只处理 null。

schema 字段写明语义、单位、格式和必要示例，使用 `required` 和 `additionalProperties: false`。
会渲染、筛选、点击、统计的集合使用 array/object，不用“JSON 字符串”替代结构。
可操作实体使用对象数组，分开稳定 `id/key` 与展示 `title/name/text`；选择、收藏、提交和关联使用 ID，不用展示文本或数组位置作主键。
选择题选项也使用 `{ key, text }`，答案引用选项 key。
结果在进入 UI state 前按业务类型归一化，渲染时不再拆字符串或解析半结构化 JSON。

## 示例

```ts
export async function searchNews(date: string, keyword: string) {
  const result = await window.lingguang.data.fetch(
    `获取 ${date} 与 ${keyword} 相关的公开新闻 5 条，包含原始标题和来源链接`,
    {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: '本次检索的公开新闻',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: '稳定新闻标识，用于选择与关联' },
              title: { type: 'string', description: '新闻原始标题，用于展示' },
              sourceUrl: { type: 'string', description: '新闻来源页面 URL' },
              publishedAt: { type: 'string', description: '原文发布时间，ISO 8601 格式' },
            },
            required: ['id', 'title', 'sourceUrl', 'publishedAt'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  );
  if (result === null) throw new Error('未取得新闻数据');
  return result;
}
```

## 交互与数据真实性

搜索、切换和筛选记录待确认的目标，并针对该目标显示加载状态。
成功取得并归一化新结果后再更新当前选择；失败保留同一目标的重试入口，不清空选择后偷偷查默认值。
旧结果可以继续展示，但应标注“上次结果”和更新时间，不冒充新目标的数据。

动态内容按需提供手动与有间隔的局部刷新；新闻/热点通常 3–5 分钟，普通资料通常 5–10 分钟或仅在条件变化时查询。
自动刷新检查页面可见性，清理 timer，同一模块不重叠请求。
加载、刷新、错误和空结果分别表达，刷新不整页 reload，也不清空用户输入。
失败不生成默认榜单、静态假数据或虚构来源；部分数据不完整应明确说明。

## 生成期预置与运行时检索

固定且无需运行时维护的资料放在 `src/data/` 等资源文件。
需要可信来源时，先用当前可用的生成期取数能力取得数据和来源，再落为静态资源或少量公共 DB seed。
大批稳定资料不通过首次打开时批量检索再写 DB/localStorage 的方式初始化，也不凭模型记忆冒充权威内容。
目录稳定而正文较长时，可先提供真实目录与元数据，按单条检索补齐正文并缓存；用户收藏、打卡、阅读进度另存个人状态表。
实时新闻、行情和用户主动搜索走运行时 API，不把预置数据说成实时查询。
