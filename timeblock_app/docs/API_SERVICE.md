# 应用 Service API

Service 将业务操作放在 QuickJS controller 中，页面通过平台服务桥调用。
纯前端应用直接使用适用的前端 SDK，不因脚手架有 `service/` 目录就必须创建 Service。
Service-only 应用只实现后端与合同，不需要创建页面。

## 合同与客户端

`openapi/spec.json` 是操作、输入和返回值的合同。
每个 `operationId` 对应 `service/app/controller/service.ts` 导出的函数；其他模块可由该文件导出。
修改操作后生成客户端再接入前端，使用当前提供的 `GenerateOpenApiClient`，不要手改生成文件。

前端使用 [createServiceApi](../src/lib/service-api.ts)：

```ts
import { createServiceApi } from '@/lib/service-api';

const api = createServiceApi();
// 方法和参数以生成的 src/generated/openapi/client 类型为准。
```

该工厂将 `window.lingguang.service.fetch` 注入生成客户端的 `Configuration.fetchApi`。
不要裸用 `new DefaultApi()`、原生 `fetch`、axios 或 `servers.url` 直连后端。
OpenAPI 中的 URL 用于客户端构造请求路径，不是可任意访问的公网服务地址。
复用其他 Service 时使用准备阶段提供的精确版本合同及 external client，不能只改 URL 或猜测应用 ID。

## 服务桥

`src/global.d.ts` 声明前端接口：

```ts
const response = await window.lingguang.service.request({
  method: 'POST',
  path: '/hello',
  body: JSON.stringify({ foo: 'Hello', bar: 'World' }),
  headers: { 'content-type': 'application/json' },
});
if (response.status < 200 || response.status >= 300) throw new Error(response.body ?? 'Service 请求失败');
```

`request` 接收 `method/path/query?/headers?/body?/signal?`，返回 `{ status, headers?, body? }`。
`body` 是序列化字符串或 null，不是业务对象。
`service.fetch` 是供生成客户端注入的类 fetch 适配器，返回 `Response`；不能把它当作公网 fetch。
请求取消或宿主失败可能抛错，业务 HTTP 失败通过响应状态返回；页面保留用户输入并显示实际失败。

## Controller

从 `@server/types` 导入 `ControllerInput<Body, Query, Params>`。
它提供 `body/query/params/headers/rawBody`、`operationId` 和 `request`；使用已定义的业务字段，不自行从环境猜测身份。
从 `@server/response` 导入 `json` / `text` / `html`，返回状态和响应体。

```ts
import { json } from '@server/response';
import type { ControllerInput } from '@server/types';

export function sayHello(input: ControllerInput<{ foo: string; bar: string }>) {
  return json({ result: `Hello ${input.body.foo} ${input.body.bar}` });
}
```

`@server` 当前提供以下宿主能力，精确参数以 [server.ts](../service/runtime/sdk/server.ts) 为准：

| 能力 | 用途与入口 |
| --- | --- |
| `db.query/execute` | 结构化数据与平台权限，见 [服务端 DB](API_DB_SERVICE.md) |
| `webSearch.fetch` | 公开信息检索，见 [服务端 WebSearch](API_WEBSEARCH_SERVICE.md) |
| `storage.getItem/setItem/removeItem/clear` | 当前用户和应用范围的小型键值数据；读/删传 `{ key }`，写传 `{ key, value }`，`clear()` 无参数，与前端位置参数形式不同 |
| `oss.readText/writeText/delete/list/readJson/writeJson` | 平台提供的应用对象存储；使用相对 key，不提供自己的 OSS 凭据或任意 bucket |
| `runtime.getRequestContext` | 只读当前可信请求上下文；不能用它更改身份或越过 DB 权限 |

这些 SDK 方法通过平台宿主执行，不建立独立 HTTP 服务，也不启动第二套开发沙箱。
`host.call` 是 SDK 传输基础设施，不表示可以猜测任意方法名调用平台。
构建、协议 smoke 与集成测试入口见 [Service 目录说明](../service/README.md)。
