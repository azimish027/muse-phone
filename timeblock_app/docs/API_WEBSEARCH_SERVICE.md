# QuickJS 服务端公开信息检索

controller 从 `@server` 导入 `webSearch`，按自然语言 query 和 JSON Schema 获取公开网页信息。
用于后端需要聚合公开事实、与业务数据合并或对页面提供统一操作的场景。
只需要前端展示公开信息时可以使用 [data.fetch](API_DATAFETCH.md)；它们不是用户私有数据读取或任意 URL 抓取接口。

```ts
import { webSearch } from '@server';
import { json } from '@server/response';
import type { ControllerInput } from '@server/types';

type News = { items: Array<{ id: string; title: string; sourceUrl: string }> };

export function searchNews(input: ControllerInput<{ query: string }>) {
  if (!input.body.query.trim()) return json({ message: 'query 必填' }, { status: 400 });
  const result = webSearch.fetch<News>({
    query: input.body.query,
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: '检索到的公开新闻',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: '稳定新闻标识，用于选择与关联' },
              title: { type: 'string', description: '新闻原始标题，供用户展示' },
              sourceUrl: { type: 'string', description: '新闻来源页面 URL' },
            },
            required: ['id', 'title', 'sourceUrl'],
            additionalProperties: false,
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  });
  if (result === null) return json({ message: '未取得新闻数据' }, { status: 502 });
  return json(result);
}
```

参数为 `{ query, schema, location? }`；SDK 同步返回 `T | null`，宿主调用失败也可能抛错。
位置查询由前端取得位置，再通过业务输入传给 controller 的 `location`；它可包含经纬度、省市区、`pois` 或 `nearbyPoi`。
SDK 负责把该结构传给检索服务，不在 QuickJS 中调用 `window.lingguang.getLocation`。

query、schema、来源、错误展示和稳定资料的规则见 [数据获取 API](API_DATAFETCH.md)。
天气、股票、K 线、贵金属和汇率需求还可参考 [结构化返回兼容说明](WEBSEARCH_MCP_CANONICAL.md)。
前端专用 `data.getWeather` 等方法不能直接作为 `@server` 方法调用。
结果只能作为实际取得的数据展示，不在失败时返回默认榜单或虚构来源。
