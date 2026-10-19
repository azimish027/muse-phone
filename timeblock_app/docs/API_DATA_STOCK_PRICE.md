---
skill_name: DATA_STOCK_PRICE
display_name: 稳定股票行情
description: 查询指定股票的最新行情、今日交易数据和最近走势。仅支持 A 股、港股、美股上市股票。用于股价卡片、自选股看板、最近走势概览等公开行情数据场景。在本 API 能力范围内应优先使用本 API；指数、ETF/基金、期货、数字货币/BTC、贵金属、原油及其他超出范围的需求使用 WEB_SEARCH。
api_file: API_DATA_STOCK_PRICE.md
enable: true
---

# Stock Price Data API

使用 `window.lingguang.data.getStockPrice(options)` 获取稳定股票行情数据。
本 API 只面向 A 股、港股、美股的上市股票。
如果用户要查指数、ETF/基金、期货、数字货币/BTC、大宗商品等，不要使用本 API。
这些非股票行情场景应使用 `window.lingguang.data.fetch(query, schema)`。
不要把非股票行情需求改写成“相关股票、ETF、信托、概念股、替代标的”的股票行情查询。

```typescript
type LingguangStockMarket = 'CN' | 'HK' | 'US';

interface LingguangStockPriceOptions {
  symbol?: string;
  name?: string;
  market?: LingguangStockMarket;
  recentDays?: number;
  timeout?: number;
}

interface LingguangStockInstrument {
  name: string;
  symbol: string;
  market: string;
  currency?: string;
  period?: string;
  periodLabel?: string;
  tradeStatus?: string;
  startDate?: string;
  endDate?: string;
}

interface LingguangStockQuoteData {
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

interface LingguangStockPriceResult {
  instrument: LingguangStockInstrument;
  latest: LingguangStockQuoteData | null;
  recentCandles: LingguangStockQuoteData[];
  traceId?: string;
}

window.lingguang.data.getStockPrice(options: LingguangStockPriceOptions): Promise<LingguangStockPriceResult | null>
```

完整 K 线的参数和调用示例见 [Stock Candlestick API](API_DATA_STOCK_CANDLESTICK.md)。

## 参数规则

- `symbol` 和 `name` 至少传一个。优先传 `symbol`，例如 `600519.SH`、`9988.HK`、`AAPL.US`。
- `name` 可能有歧义；使用股票名称查询时建议同时传 `market`。
- `market` 用于限定市场：`CN` 表示 A 股，`HK` 表示港股，`US` 表示美股。
- `recentDays` 用于返回最近走势的小型序列，适合股价卡片迷你图；默认建议为 7，最大建议不超过 30。
- `getStockCandlestickData.startDate` 和 `endDate` 必须使用严格 `YYYY-MM-DD` 格式；两者都合法且 `startDate <= endDate` 时，日期区间优先于 `range` / `lookback` 推导。
- `getStockCandlestickData.range` / `lookback` 可表达 `1mo`、`1y`、`最近1年` 等相对区间；没有合法完整日期区间时，后端会结合 `period` 推导 `count`。
- `period` 表示 K 线粒度，`count` 表示返回多少根 K 线，不等同于自然日数量。
- `period: '1d'` 时，`range: '1y'` 会归一为最多 250 根日 K，`range: '1mo'` 会归一为最多 22 根日 K。
- `period: '1w'` 时，`range: '1y'` 会归一为最多 52 根周 K。
- `period: '1mo'` 时，`range: '1y'` 会归一为最多 12 根月 K。
- 如果日期格式非法，例如 `2026/07/14` 或 `20260714`，后端不会按日期区间处理，会回退到 `range` / `lookback` / `count + period` 归一化。

## 返回字段语义

- `instrument`: 股票基础信息。
- `latest`: 最新交易日行情。`closePrice` 可作为最新价展示；如果当前盘中行情源提供实时价，API 层仍归一到该字段。
- `recentCandles`: 最近走势数据，字段和 `latest` 一致，适合迷你折线图或小型 K 线图。
- `priceChangePercent`: 涨跌幅百分比，例如 `-1.59` 表示下跌 1.59%。
- `volume`: 成交量，API 层应尽量转成数字；源数据无法可靠转换时返回 `null`。
- `amount`: 成交额，API 层应尽量转成数字；源数据无法可靠转换时返回 `null`。

## 使用规则

- 查询“最新股价、今日行情、股票卡片、最近一周走势”时使用 `getStockPrice`。
- 只有当标的是明确的 A 股、港股或美股上市股票时，才使用 `getStockPrice`。
- 指数行情、ETF/基金行情、期货行情、数字货币 / BTC 行情、原油行情，都必须用 `window.lingguang.data.fetch(query, schema)`。
- 对于“上证指数”“深证成指”“创业板指”“沪深300”“BTC 今日价格”等需求，不要调用本 API。
- 需要完整 K 线图、指定日期区间或指定周期时，使用 `getStockCandlestickData`。
- 当用户明确要求“近一年日K线”“近一月日K线”“近一年周K线”等相对区间时，优先传 `period` + `range` / `lookback`，或传严格合法的 `startDate` + `endDate`。
- 图表默认视窗必须匹配用户区间；如果请求最近一年 K 线，首屏不要把 ECharts `dataZoom` 默认设成只显示后半段。
- 市盈率、市值、公司简介、财报、新闻、评级、投资建议等行情以外字段不属于本 API 能力范围；同一需求包含这些内容时，股票行情继续使用本 API，只有超出部分使用 WEB_SEARCH。
- 本 API 只提供公开行情数据，不构成投资建议。生成应用可以展示数据和趋势，但不要用固定规则给出买入、卖出、保证收益等结论。
- 失败或无数据时返回 `null`；调用异常会 reject。单次调用返回 `null`，或发生 reject、超时、临时无数据属于运行失败，不等于能力不覆盖；应展示明确错误态或重试入口，不得静默回退到 WEB_SEARCH，也不要展示写死股价。
- 渲染前检查 `latest` 和数值字段，不要直接对可空字段调用 `.toFixed()`。
- 行情刷新默认同时提供用户主动刷新入口和有间隔的静默自动刷新；自动刷新必须设置合理时间间隔、页面可见性判断、timer 清理和同一模块单请求保护，股票最新价/自选股卡片建议 30-60 秒，非交易时段或静态最近走势可放宽到 3-5 分钟，避免不间断请求。刷新时只更新对应股票卡片或图表 state，保留上次有效行情、`lastUpdatedAt`、局部 `isRefreshing`、失败重试和数据过期提示；手动刷新和静默自动刷新都应有清晰但不打断操作的刷新中反馈，不使用整页 reload 或首屏整体 loading。

## 示例

```typescript
const result = await window.lingguang.data.getStockPrice({
  symbol: '600519.SH',
  market: 'CN',
  recentDays: 7,
  timeout: 8000,
});

if (!result?.latest || typeof result.latest.closePrice !== 'number') {
  showError('股票行情暂时不可用，请稍后重试');
  return;
}

setStockCard({
  name: result.instrument.name,
  symbol: result.instrument.symbol,
  price: result.latest.closePrice,
  changePercent: result.latest.priceChangePercent,
  candles: result.recentCandles,
});
```

```typescript
const kline = await window.lingguang.data.getStockCandlestickData({
  symbol: '600519.SH',
  market: 'CN',
  period: '1d',
  range: '1y',
  timeout: 15000,
});

if (!kline?.candles?.length) {
  showError('股票K线暂时不可用，请稍后重试');
  return;
}

setKlineChart(kline.candles);
```
