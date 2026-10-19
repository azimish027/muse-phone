---
skill_name: DATA_STOCK_CANDLESTICK
display_name: 稳定股票K线
description: 查询指定股票在指定周期和日期范围内的 K 线数据。仅支持 A 股、港股、美股上市股票，用于股票 K 线图、区间走势、成交量分析等公开行情数据场景。在本 API 能力范围内应优先使用本 API；指数、ETF/基金、期货、数字货币/BTC、贵金属、原油、分钟级 K 线及其他超出范围的需求使用 WEB_SEARCH。
api_file: API_DATA_STOCK_CANDLESTICK.md
enable: true
---

# Stock Candlestick Data API

使用 `window.lingguang.data.getStockCandlestickData(options)` 获取稳定股票 K 线数据。
本 API 只面向 A 股、港股、美股的上市股票。
如果用户要查指数、ETF/基金、期货、数字货币/BTC、贵金属、原油或 1 分钟 / 5 分钟等分钟级 K 线，不要使用本 API。
这些非股票 K 线场景应使用 `window.lingguang.data.fetch(query, schema)`。
不要把非股票 K 线需求改写成“相关股票、ETF、信托、概念股、替代标的”的股票 K 线查询。
例如用户要看 BTC K 线时，不能改成 IBIT、GBTC、MSTR 等美股标的；用户要看期货 K 线时，不能改成期货公司股票或商品 ETF。

```typescript
type LingguangStockMarket = 'CN' | 'HK' | 'US';
type LingguangStockPeriod = '1d' | '1w' | '1mo';

interface LingguangStockCandlestickOptions {
  symbol?: string;
  name?: string;
  market?: LingguangStockMarket;
  period?: LingguangStockPeriod;
  startDate?: string;
  endDate?: string;
  range?: string;
  lookback?: string;
  count?: number;
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

interface LingguangStockCandle {
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

interface LingguangStockCandlestickResult {
  instrument: LingguangStockInstrument;
  latest: LingguangStockCandle | null;
  candles: LingguangStockCandle[];
  traceId?: string;
}

window.lingguang.data.getStockCandlestickData(
  options: LingguangStockCandlestickOptions
): Promise<LingguangStockCandlestickResult | null>
```

## 参数规则

- `symbol` 和 `name` 至少传一个。优先传 `symbol`，例如 `600519.SH`、`9988.HK`、`AAPL.US`。
- `name` 可能有歧义；使用股票名称查询时建议同时传 `market`。
- `period` 默认为 `1d`。当前只定义日线、周线、月线，不定义分钟级 K 线。
- 禁止把指数代码、ETF/基金代码、期货合约代码、数字货币交易对或贵金属 / 原油代码伪装成股票代码传入。
- 禁止为了绕过限制给非股票标的拼接 `.SH`、`.SZ`、`.HK`、`.US` 后缀。
- 禁止为了绕过限制，把原始需求中的 BTC、期货、指数、ETF/基金等非股票标的替换成相关股票、ETF、信托、概念股或其他代理标的。
- `startDate` / `endDate` 使用严格 `YYYY-MM-DD`，完整合法且开始不晚于结束时优先使用该区间。
- `range` / `lookback` 可表示 `1mo`、`1y`、`最近1年` 等相对区间；没有完整合法日期区间时，服务端结合 `period` 推导 `count`。
- `count` 表示 K 线根数，不是自然日数；一年日/周/月 K 分别最多约 250/52/12 根，一个月日 K 约 22 根。
- 图表初始视窗应覆盖用户要求的区间，不只显示后半段。
- `count` 建议不超过 250，避免一次性拉取过多数据影响页面性能。

## 返回字段语义

- `instrument`: 股票基础信息和实际查询周期。
- `latest`: 返回序列中的最新一根 K 线。
- `candles`: K 线数组，API 层应按 `date` 升序返回，方便图表直接渲染。
- `openPrice`、`highPrice`、`lowPrice`、`closePrice`: 开盘、最高、最低、收盘价。
- `previousClosePrice`: 前收价。
- `priceChangePercent`: 涨跌幅百分比，例如 `0.38` 表示上涨 0.38%。
- `volume`: 成交量。
- `amount`: 成交额。

## 使用规则

- 查询“指定股票最近 30 天走势、K 线图、区间涨跌、成交量走势”时使用 `getStockCandlestickData`。
- 只有当标的是明确的 A 股、港股或美股上市股票时，才使用 `getStockCandlestickData`。
- 指数 K 线、ETF/基金 K 线、期货 K 线、数字货币 / BTC K 线、贵金属 K 线、原油 K 线以及分钟级 K 线，都必须用 `window.lingguang.data.fetch(query, schema)`。
- 对于“沪深300 K线”“创业板指数走势”“BTC 近90天K线”“期货 1分钟/5分钟K线”“ETF 历史K线”等需求，不要调用本 API。
- 同一需求同时包含受支持的股票 K 线和超出范围的标的、字段或粒度时，受支持部分继续使用本 API，只有超出部分使用 WEB_SEARCH。
- 用户明确要求生成应用时，遇到上述非股票 K 线场景不要停留在“需要确认 / 无法稳定获取”的澄清回复；应继续生成应用，用 `window.lingguang.data.fetch(query, schema)` 获取公开数据，并在失败或数据不足时展示清晰错误态、数据来源和限制说明。
- 只需要一个股票卡片或最新价时，使用 `getStockPrice`。
- 当用户说“最近 30 天、近半年、本月”时，应在运行时用 `new Date()` 计算 `startDate` / `endDate`，不要把生成当天日期硬编码进代码。
- 不要要求本 API 返回均线、MACD、KDJ、RSI 等技术指标；当前稳定返回只定义 OHLC、成交量、成交额和涨跌幅。需要指标时在前端基于 `candles` 自行计算。
- 本 API 只提供公开行情数据，不构成投资建议。生成应用可以展示数据和趋势，但不要用固定规则给出买入、卖出、保证收益等结论。
- 失败或无数据时返回 `null`；调用异常会 reject。单次调用返回 `null`，或发生 reject、超时、临时无数据属于运行失败，不等于能力不覆盖；应展示明确错误态或重试入口，不得静默回退到 WEB_SEARCH，也不要展示写死 K 线。
- K 线或区间走势刷新默认同时提供用户主动刷新入口和有间隔的静默自动刷新；自动刷新必须设置合理时间间隔、页面可见性判断、timer 清理和同一模块单请求保护，日/周/月线或较长区间走势建议 5 分钟，避免不间断请求。刷新时只更新对应股票图表 state，保留上次有效 K 线、`lastUpdatedAt`、局部 `isRefreshing`、失败重试和数据过期提示；手动刷新和静默自动刷新都应有清晰但不打断操作的刷新中反馈，不使用整页 reload 或首屏整体 loading。

## 示例

```typescript
const today = new Date();
const endDate = today.toISOString().slice(0, 10);
const start = new Date(today);
start.setDate(start.getDate() - 30);

const result = await window.lingguang.data.getStockCandlestickData({
  symbol: '9988.HK',
  market: 'HK',
  period: '1d',
  startDate: start.toISOString().slice(0, 10),
  endDate,
  timeout: 8000,
});

if (!result || result.candles.length === 0) {
  showError('K 线数据暂时不可用，请稍后重试');
  return;
}

setCandlestickChart({
  name: result.instrument.name,
  candles: result.candles,
});
```
