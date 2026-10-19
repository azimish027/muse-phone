---
skill_name: DATA_EXCHANGE_RATE
display_name: 稳定汇率数据
description: 查询明确货币对的实时汇率和金额换算。用于外汇汇率卡片、旅行预算、购物换算、资产展示等公开汇率数据场景。在本 API 能力范围内应优先使用本 API；需求超出文档声明的货币、字段、时间范围或数据粒度时，可对超出部分使用 WEB_SEARCH。
api_file: API_DATA_EXCHANGE_RATE.md
enable: true
---

# Exchange Rate Data API

使用 `window.lingguang.data.getExchangeRate(options)` 获取稳定汇率数据。

```typescript
interface LingguangExchangeRateOptions {
  from: string;
  to: string;
  amount?: number;
  timeout?: number;
}

interface LingguangExchangeRateResult {
  from: string;
  to: string;
  title: string;
  rate: number | null;
  inverseRate: number | null;
  amount?: number;
  convertedAmount?: number | null;
  updateTime?: string;
  changeRatePercent?: number | null;
  changeValue?: number | null;
  traceId?: string;
}

window.lingguang.data.getExchangeRate(options: LingguangExchangeRateOptions): Promise<LingguangExchangeRateResult | null>
```

## 字段语义

- `from`: 源货币代码，使用 ISO 4217 三位大写代码，例如 `AUD`、`USD`、`CNY`。
- `to`: 目标货币代码，使用 ISO 4217 三位大写代码。
- `rate`: 以调用参数为准的汇率，语义固定为 `1 from = rate to`。
- `inverseRate`: 反向汇率，语义固定为 `1 to = inverseRate from`。
- `amount`: 调用方传入的源货币金额。
- `convertedAmount`: 当传入 `amount` 且 `rate` 可用时返回，语义为 `amount * rate`。
- `updateTime`: 汇率更新时间，格式通常为 `YYYY-MM-DD HH:mm:ss`。
- `changeRatePercent`: 汇率涨跌幅百分比，例如 `0.23` 表示上涨 0.23%。

## 使用规则

- 汇率换算必须传明确货币对，不要只传“澳元汇率”这种缺少方向的查询。
- 调用方传入 `from: 'AUD', to: 'CNY'` 时，`rate` 必须表示 `1 澳元 = 多少人民币`。即使底层数据源以人民币视角返回，API 层也应归一化为调用方视角。
- 本 API 只用于法币汇率，不用于股票、基金、虚拟货币、黄金、白银或铂金价格。
- 历史汇率序列、银行具体牌价或手续费以及返回类型未声明的字段不属于本 API 能力范围；同一需求包含这些内容时，受支持的实时法币汇率和金额换算仍使用本 API，超出部分请使用 WEB_SEARCH。
- 单个页面需要多个货币对时，可以并发调用多个 `getExchangeRate`，但同屏活跃请求建议控制在 3 个以内。
- 失败或无数据时返回 `null`；调用异常会 reject。单次调用返回 `null`，或发生 reject、超时、临时无数据属于运行失败，不等于能力不覆盖；应展示明确错误态或重试入口，不得静默回退到 WEB_SEARCH，也不要展示写死汇率。
- 金额展示前应自行处理小数位和本地化格式；不要把 `rate` 当作已经格式化好的展示文案。
- 汇率刷新默认同时提供用户主动刷新入口和有间隔的静默自动刷新；自动刷新必须设置合理时间间隔、页面可见性判断、timer 清理和同一模块单请求保护，汇率卡片或换算结果建议 2-5 分钟，避免不间断请求。刷新时只更新对应货币对卡片或换算结果 state，保留上次有效汇率、`lastUpdatedAt`、局部 `isRefreshing`、失败重试和数据过期提示；手动刷新和静默自动刷新都应有清晰但不打断操作的刷新中反馈，不使用整页 reload 或首屏整体 loading。

## 示例

```typescript
const result = await window.lingguang.data.getExchangeRate({
  from: 'AUD',
  to: 'CNY',
  amount: 100,
  timeout: 8000,
});

if (!result || typeof result.rate !== 'number') {
  showError('汇率数据暂时不可用，请稍后重试');
  return;
}

setExchangeRate({
  title: result.title,
  rateText: `1 ${result.from} = ${result.rate.toFixed(4)} ${result.to}`,
  convertedText:
    typeof result.convertedAmount === 'number'
      ? `${result.amount} ${result.from} = ${result.convertedAmount.toFixed(2)} ${result.to}`
      : '',
  updateTime: result.updateTime,
});
```
