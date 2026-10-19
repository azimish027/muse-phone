---
skill_name: DATA_PRECIOUS_METAL_PRICE
display_name: 稳定贵金属行情
description: 查询黄金、白银、铂金等贵金属的最新价格和 K 线走势。覆盖上海黄金交易所和国际金价等公开行情场景。在本 API 能力范围内应优先使用本 API；需求超出文档声明的标的、字段、时间范围或数据粒度时，可对超出部分使用 WEB_SEARCH。
api_file: API_DATA_PRECIOUS_METAL_PRICE.md
enable: true
---

# Precious Metal Price Data API

使用 `window.lingguang.data.getPreciousMetalPrice(options)` 获取稳定贵金属行情数据。

```typescript
type LingguangPreciousMetal = 'gold' | 'silver' | 'platinum';
type LingguangPreciousMetalMarket = 'SGE' | 'LBMA';
type LingguangPreciousMetalPeriod = '1d' | '1w' | '1mo';

interface LingguangPreciousMetalPriceOptions {
  metal?: LingguangPreciousMetal;
  symbol?: 'AU9999.SGE' | 'AG9999.SGE' | 'PT9995.SGE' | 'XAUUSD' | 'XAGUSD' | string;
  market?: LingguangPreciousMetalMarket;
  period?: LingguangPreciousMetalPeriod;
  startDate?: string;
  endDate?: string;
  count?: number;
  timeout?: number;
}

interface LingguangPreciousMetalInstrument {
  name: string;
  symbol: string;
  market: string;
  metal?: LingguangPreciousMetal;
  currency?: string;
  unit?: string;
  period?: string;
  periodLabel?: string;
  startDate?: string;
  endDate?: string;
}

interface LingguangPreciousMetalQuoteData {
  date: string;
  openPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  closePrice: number | null;
  previousClosePrice?: number | null;
  priceChange?: number | null;
  priceChangePercent?: number | null;
  volume?: number | null;
  amount?: number | null;
}

interface LingguangPreciousMetalPriceResult {
  instrument: LingguangPreciousMetalInstrument;
  latest: LingguangPreciousMetalQuoteData | null;
  candles: LingguangPreciousMetalQuoteData[];
  traceId?: string;
}

window.lingguang.data.getPreciousMetalPrice(
  options: LingguangPreciousMetalPriceOptions
): Promise<LingguangPreciousMetalPriceResult | null>
```

## 参数规则

- `metal` 和 `symbol` 至少传一个。优先传 `symbol`，例如 `AU9999.SGE`、`AG9999.SGE`、`PT9995.SGE`、`XAUUSD`、`XAGUSD`。
- `metal: 'gold'` 且未传 `symbol` 时，默认可由服务端选择主流黄金行情品种；需要明确品种时必须传 `symbol`。
- `market` 用于限定市场：`SGE` 表示上海黄金交易所，`LBMA` 表示国际贵金属市场。
- `period` 默认为 `1d`。当前只定义日线、周线、月线，不定义分钟级行情。
- `startDate` / `endDate` 使用 `YYYY-MM-DD`。
- `count` 用于查询最近 N 根行情数据。传了 `startDate` / `endDate` 时，优先以日期区间为准。

## Symbol-State 映射要求

- 同一个页面同时展示多个贵金属品种时，必须用 `symbol` 做唯一 state key。
- 更新数据时必须按请求使用的精确 `symbol` 写回对应 state：`AU9999.SGE`、`AG9999.SGE`、`PT9995.SGE`、`XAUUSD`、`XAGUSD` 彼此独立。
- 不要只按 `gold/silver`、`market` 或“是否国际市场”分发 state；例如 `XAGUSD` 的返回结果不能写入 `AG9999.SGE` 的 state，`XAUUSD` 的返回结果不能写入 `AU9999.SGE` 的 state。
- 展示名称可以使用 `instrument.name`，但 state key 仍应使用请求入参里的 `symbol`，不要用返回的实际数据源代码替换 state key。

## 返回字段语义

- `instrument`: 贵金属品种、市场、币种、报价单位和实际查询周期。
- `unit`: 报价单位，例如上海黄金交易所黄金通常可归一为 `CNY/g`，国际金价通常可归一为 `USD/oz`；无法确认时返回空。
- `latest`: 最新可用行情。
  `XAUUSD` 和 `XAGUSD` 优先返回实时快照；未取得完整快照时，返回最近有效周期线，以实际返回时间为准。
- `candles`: 已完成周期的行情数组，API 层按 `date` 升序返回，方便图表直接渲染。
  盘中快照不表示一根已完成 K 线。
- 对 `XAUUSD` / `XAGUSD`，`latest.date` 可以是盘中时间戳，而 `candles` 最后一项通常是最近交易日的已完成周期线。
  调用方不得假设 `latest` 与 `candles[candles.length - 1]` 相同。
- `closePrice`: 当前或最新收盘价，可作为价格卡片主价格。
- `priceChangePercent`: 涨跌幅百分比，例如 `-2.17` 表示下跌 2.17%。

## 使用规则

- 查询“黄金 9999 最新价格、最近 30 天金价走势、白银走势、铂金价格”时使用 `getPreciousMetalPrice`。
- 金店零售价、首饰回收价、品牌金价、手工费以及文档未声明的品种、市场或数据粒度使用 WEB_SEARCH / `window.lingguang.data.fetch`，不要要求本 API 返回未公开数据。
- 当用户说“最近 30 天、近半年、本月”时，应在运行时用 `new Date()` 计算 `startDate` / `endDate`，不要把生成当天日期硬编码进代码。
- 本 API 只提供公开行情数据，不构成投资建议。生成应用可以展示价格和趋势，但不要用固定规则给出买入、卖出、保证收益等结论。
- 失败或无数据时返回 `null`；调用异常会 reject。单次调用返回 `null`，或发生 reject、超时、临时无数据属于运行失败，不等于能力不覆盖；应展示明确错误态或重试入口，不得静默回退到 WEB_SEARCH，也不要展示写死金价。
- 渲染前检查 `latest` 和数值字段，不要直接对可空字段调用 `.toFixed()`。
- 展示 `XAUUSD` / `XAGUSD` 时，价格卡片使用 `latest`，K 线图仅使用 `candles`。
- 行情刷新默认同时提供用户主动刷新入口和有间隔的静默自动刷新；自动刷新必须设置合理时间间隔、页面可见性判断、timer 清理和同一模块单请求保护，贵金属价格卡片建议 30-60 秒，K 线或趋势图建议 1-5 分钟，避免不间断请求。刷新时只更新对应贵金属品种的价格卡片或图表 state，保留上次有效行情、`lastUpdatedAt`、局部 `isRefreshing`、失败重试和数据过期提示；手动刷新和静默自动刷新都应有清晰但不打断操作的刷新中反馈，不使用整页 reload 或首屏整体 loading。

## 示例

```typescript
const result = await window.lingguang.data.getPreciousMetalPrice({
  symbol: 'AU9999.SGE',
  market: 'SGE',
  period: '1d',
  count: 30,
  timeout: 8000,
});

if (!result?.latest || typeof result.latest.closePrice !== 'number') {
  showError('贵金属行情暂时不可用，请稍后重试');
  return;
}

setMetalPrice({
  name: result.instrument.name,
  price: result.latest.closePrice,
  unit: result.instrument.unit,
  changePercent: result.latest.priceChangePercent,
  candles: result.candles,
});
```
