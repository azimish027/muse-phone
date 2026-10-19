# 稳定 MCP Canonical 返回说明

本文档是 `data.fetch` / `@server.webSearch` 命中 Stable MCP 时的 schema 兼容参考。
它不是独立 API；使用通用检索获取下列领域数据时，按需直接读取本文并对照对应的 API_DATA 文档。

WEB_SEARCH 能力覆盖天气、股票现价、股票 K 线、贵金属和法币汇率。
新前端应用在对应专用 API 的公开契约能够满足需求时，应优先使用 `DATA_WEATHER`、`DATA_STOCK_PRICE`、`DATA_STOCK_CANDLESTICK`、`DATA_PRECIOUS_METAL_PRICE` 和 `DATA_EXCHANGE_RATE` 文档中的快速路径 API 与 public DTO。
专用 API 的公开契约不能满足需求而改用 `data.fetch` / `@server.webSearch` 时，应参考本文档设计 query 和 schema。

存量 `data.fetch` / `@server.webSearch` 命中 Stable MCP 时按以下顺序处理：

1. 后端优先从 MCP `intention` evidence 中提取并校验 canonical 数据。
2. 确定性适配器依次尝试 `canonical_subset`、`public_dto`、`public_dto_collection` 或 `canonical_collection` 候选，并按调用方 schema 做同名字段裁剪和安全标量类型转换。
3. 适配器不根据字段 description 或相似语义猜测任意字段重命名，也不执行通用 flatten。
4. 只有确定性 schema 对齐成功时才直接返回结果，并跳过 `data_api_agent`。
5. schema 不兼容时会保留 Stable MCP evidence，回退到通用检索和 `data_api_agent` 提取路径；该路径可能超时，也不保证一定返回 `null`。

所有 `data.fetch` / `@server.webSearch` schema 的最外层必须是 `type: "object"`。
query 只影响部分 public DTO 候选的优先顺序，最终是否匹配由 schema 决定。
WebSearch evidence 只会在确定性直返成功后被忽略；进入 `generic_retrieval` 回退时仍可作为通用提取 evidence。

---

## 1. 天气 `weather`

适合 query：
- `北京天气`
- `杭州今天天气`
- `上海未来7天天气`
- `深圳空气质量`

canonical 顶层结构：

```json
{
  "realtime": {
    "city": "",
    "country": "",
    "province": "",
    "district": "",
    "date": "",
    "weather": "",
    "temp": "",
    "tempHigh": "",
    "tempLow": "",
    "realFeel": "",
    "humidity": "",
    "windDir": "",
    "windLevel": "",
    "windSpeed": "",
    "visibility": "",
    "pressure": "",
    "uvIndex": "",
    "uvLevel": "",
    "dewpoint": "",
    "sunRise": "",
    "sunDown": "",
    "obsTime": "",
    "travelReminder": "",
    "pm25Level": "",
    "pm25Aqi": "",
    "precipitationProbability": ""
  },
  "lifeIndex": [
    {
      "date": "",
      "type": "",
      "typeId": "",
      "desc": "",
      "value": "",
      "level": "",
      "levelDesc": "",
      "detail": ""
    }
  ],
  "dailyForecast": [
    {
      "date": "",
      "weekday": "",
      "weatherDay": "",
      "weatherNight": "",
      "tempHigh": "",
      "tempLow": "",
      "windDirDay": "",
      "windDirNight": "",
      "windLevelDay": "",
      "windLevelNight": "",
      "humidity": "",
      "humidityNight": "",
      "precipitationProbability": "",
      "pm25Level": "",
      "pm25Aqi": "",
      "iconDay": "",
      "iconNight": ""
    }
  ],
  "hourlyForecast": [
    {
      "time": "",
      "hour": "",
      "weather": "",
      "temp": "",
      "humidity": "",
      "windDir": "",
      "windLevel": "",
      "rainProbability": "",
      "precipitation": "",
      "qpf": "",
      "visibility": "",
      "uvIndex": "",
      "pm25Level": "",
      "pm25Aqi": "",
      "isNow": false
    }
  ]
}
```

可确定性使用的 schema：

- 可以使用同名 canonical 子集，例如 `realtime.temp`、`realtime.weather` 或 `dailyForecast[].weatherDay`。
- 也可以使用固定天气 public DTO 根字段 `location/updatedAt/realtime/dailyForecast/hourlyForecast/lifeIndex`，其中公开字段以 `API_DATA_WEATHER.md` 为准。
- 任意 view model 重命名不属于确定性映射，例如顶层 `temperature <- realtime.temp` 或 `condition <- realtime.weather` 会进入 `generic_retrieval` 回退。
- 不要要求 canonical 和固定 public DTO 中都没有来源的业务字段。

完整 canonical 样例（真实值风格）：

```json
{
  "realtime": {
    "city": "杭州市",
    "country": "中国",
    "province": "浙江省",
    "district": "",
    "date": "",
    "weather": "中雨",
    "temp": "11",
    "tempHigh": "",
    "tempLow": "",
    "realFeel": "6",
    "humidity": "92",
    "windDir": "东北风",
    "windLevel": "4",
    "windSpeed": "7.69",
    "visibility": "6800",
    "pressure": "1015",
    "uvIndex": "1",
    "uvLevel": "",
    "dewpoint": "11",
    "sunRise": "2026-04-29 05:18:00",
    "sunDown": "2026-04-29 18:35:00",
    "obsTime": "2026-04-29 16:40:08",
    "travelReminder": "",
    "pm25Level": "优",
    "pm25Aqi": "25",
    "precipitationProbability": ""
  },
  "lifeIndex": [
    {
      "date": "2026-05-01",
      "type": "旅游指数",
      "typeId": "14",
      "desc": "天气晴朗，适合旅游。",
      "value": "适宜",
      "level": "1",
      "levelDesc": "适宜",
      "detail": "天气较好，适合外出活动。"
    },
    {
      "date": "2026-05-01",
      "type": "穿衣指数",
      "typeId": "20",
      "desc": "建议着薄外套等服装。",
      "value": "暖",
      "level": "3",
      "levelDesc": "暖",
      "detail": "天气渐暖，单衣单裤。"
    }
  ],
  "dailyForecast": [
    {
      "date": "2026-04-29",
      "weekday": "",
      "weatherDay": "中雨",
      "weatherNight": "多云",
      "tempHigh": "11",
      "tempLow": "9",
      "windDirDay": "东北风",
      "windDirNight": "东北风",
      "windLevelDay": "3",
      "windLevelNight": "2",
      "humidity": "92",
      "humidityNight": "",
      "precipitationProbability": "60",
      "pm25Level": "",
      "pm25Aqi": "",
      "iconDay": "",
      "iconNight": ""
    },
    {
      "date": "2026-04-30",
      "weekday": "",
      "weatherDay": "晴",
      "weatherNight": "晴",
      "tempHigh": "20",
      "tempLow": "11",
      "windDirDay": "东北风",
      "windDirNight": "西南风",
      "windLevelDay": "2",
      "windLevelNight": "2",
      "humidity": "67",
      "humidityNight": "",
      "precipitationProbability": "0",
      "pm25Level": "",
      "pm25Aqi": "",
      "iconDay": "",
      "iconNight": ""
    }
  ],
  "hourlyForecast": [
    {
      "time": "2026-04-29 16:00:00",
      "hour": "16",
      "weather": "中雨",
      "temp": "11",
      "humidity": "92",
      "windDir": "东北风",
      "windLevel": "4",
      "rainProbability": "90",
      "precipitation": "2",
      "qpf": "2",
      "visibility": "",
      "uvIndex": "1",
      "pm25Level": "",
      "pm25Aqi": "",
      "isNow": false
    }
  ]
}
```

推荐子集 1：当前天气卡片

```json
{
  "realtime": {
    "city": "杭州市",
    "weather": "中雨",
    "temp": "11",
    "realFeel": "6",
    "humidity": "92",
    "windDir": "东北风",
    "windSpeed": "7.69",
    "uvIndex": "1",
    "pm25Level": "优",
    "pm25Aqi": "25"
  }
}
```

推荐子集 2：7/15 天天气趋势

```json
{
  "dailyForecast": [
    {
      "date": "2026-04-29",
      "weatherDay": "中雨",
      "weatherNight": "多云",
      "tempHigh": "11",
      "tempLow": "9",
      "precipitationProbability": "60"
    }
  ]
}
```

推荐子集 3：生活指数页

```json
{
  "lifeIndex": [
    {
      "date": "2026-05-01",
      "type": "旅游指数",
      "value": "适宜",
      "level": "1",
      "desc": "天气晴朗，适合旅游。",
      "detail": "天气较好，适合外出活动。"
    }
  ]
}
```

不推荐写法：
- ❌ 强依赖 canonical 中没有来源的业务字段
- ❌ 让一个字段同时混合多个不同语义来源，例如把 `pressure` 当作 `airQuality`
- ❌ 一次性要求 `realtime + lifeIndex + dailyForecast + hourlyForecast` 之外的自定义新字段

最小可用片段：

```json
{
  "realtime": {
    "city": "杭州市",
    "country": "中国",
    "province": "浙江省",
    "weather": "中雨",
    "temp": "11",
    "realFeel": "6",
    "humidity": "92",
    "windDir": "东北风",
    "windLevel": "4",
    "windSpeed": "7.69",
    "pressure": "1015",
    "uvIndex": "1",
    "pm25Level": "优",
    "pm25Aqi": "25"
  },
  "dailyForecast": [
    {
      "date": "2026-04-29",
      "weatherDay": "中雨",
      "weatherNight": "多云",
      "tempHigh": "11",
      "tempLow": "9"
    }
  ]
}
```

---

## 2. 股票 `stock`

适合 query：
- `贵州茅台股票`
- `比亚迪最近一周K线`
- `阿里股价走势`

canonical 顶层结构：

```json
{
  "stockInfo": {
    "stockName": "",
    "symbol": "",
    "market": "",
    "period": "",
    "periodChinese": "",
    "stockPrice": "",
    "tradeStatus": "",
    "startDate": "",
    "endDate": ""
  },
  "latestData": {
    "date": "",
    "openPrice": "",
    "highPrice": "",
    "lowPrice": "",
    "closePrice": "",
    "previousPrice": "",
    "priceChange": "",
    "priceChangePercent": "",
    "volume": "",
    "amount": ""
  },
  "klineList": [
    {
      "date": "",
      "openPrice": "",
      "highPrice": "",
      "lowPrice": "",
      "closePrice": "",
      "previousPrice": "",
      "priceChange": "",
      "priceChangePercent": "",
      "volume": "",
      "amount": ""
    }
  ]
}
```

可确定性使用的 schema：

- 可以使用同名 canonical 子集 `stockInfo/latestData/klineList`。
- 股票现价 public DTO 使用 `instrument/latest/recentCandles`，股票 K 线 public DTO 使用 `instrument/latest/candles`，详细字段以对应 `API_DATA_*` 文档为准。
- 适配器会同时生成股票现价和股票 K 线候选；query 只决定优先顺序，目标 schema 决定最终采用哪一套。
- 不要新增 canonical 和固定 public DTO 中都没有来源的字段，例如：
  - `marketCap`
  - `pe`

完整 canonical 样例（真实值风格）：

```json
{
  "stockInfo": {
    "stockName": "贵州茅台",
    "symbol": "600519.SH",
    "market": "CN",
    "period": "P_Day1",
    "periodChinese": "日线",
    "stockPrice": "1401.17",
    "startDate": "2026-01-28",
    "endDate": "2026-04-29"
  },
  "latestData": {
    "date": "2026-04-29 00:00:00",
    "openPrice": "1405.0",
    "closePrice": "1401.17",
    "highPrice": "1409.75",
    "lowPrice": "1400.28",
    "volume": "3481313.0",
    "amount": "4881691348",
    "priceChange": "-3.83",
    "priceChangePercent": "-0.27"
  }
}
```

推荐子集 1：K 线图

```json
{
  "klineList": [
    {
      "date": "2026-04-29 00:00:00",
      "openPrice": "1405.0",
      "closePrice": "1401.17",
      "highPrice": "1409.75",
      "lowPrice": "1400.28"
    }
  ]
}
```

推荐子集 2：成交量分析

```json
{
  "klineList": [
    {
      "date": "2026-04-29 00:00:00",
      "volume": "3481313.0",
      "amount": "4881691348",
      "priceChange": "-3.83",
      "priceChangePercent": "-0.27"
    }
  ]
}
```

不推荐写法：
- ❌ 新增 `marketCap`、`pe`
- ❌ 要求从 canonical 中无法稳定推出的“公司简介”“市值排行”等字段

最小可用片段：

```json
{
  "latestData": {
    "date": "2026-04-29 00:00:00",
    "closePrice": "1401.17",
    "priceChangePercent": "-0.27"
  }
}
```

---

## 3. 金价 `gold_price`

适合 query：
- `今日黄金价格`
- `最近一周金价走势`

canonical 顶层结构：

```json
{
  "stockInfo": {
    "stockName": "",
    "symbol": "",
    "market": "",
    "period": "",
    "periodChinese": "",
    "stockPrice": "",
    "startDate": "",
    "endDate": ""
  },
  "latestData": {
    "date": "",
    "openPrice": "",
    "highPrice": "",
    "lowPrice": "",
    "closePrice": "",
    "previousPrice": "",
    "priceChange": "",
    "priceChangePercent": "",
    "volume": "",
    "amount": ""
  },
  "klineList": [
    {
      "date": "",
      "openPrice": "",
      "highPrice": "",
      "lowPrice": "",
      "closePrice": "",
      "previousPrice": "",
      "priceChange": "",
      "priceChangePercent": "",
      "volume": "",
      "amount": ""
    }
  ]
}
```

完整 canonical 样例（真实值风格）：

```json
{
  "stockInfo": {
    "stockName": "黄金9999",
    "symbol": "AU9999.SGE",
    "market": "SGE",
    "period": "P_Day1",
    "periodChinese": "日线",
    "stockPrice": "1009.88",
    "startDate": "2026-01-28",
    "endDate": "2026-04-29"
  },
  "latestData": {
    "date": "2026-04-29 00:00:00",
    "openPrice": "1007.0",
    "highPrice": "1020.0",
    "lowPrice": "1006.32",
    "closePrice": "1009.88",
    "previousPrice": "1020.73",
    "priceChange": "-10.85",
    "priceChangePercent": "-1.06",
    "volume": "5519120.0",
    "amount": "5587794669.2"
  }
}
```

推荐同名 canonical 子集 1：当前价格卡片

```json
{
  "stockInfo": {
    "stockName": "黄金9999",
    "symbol": "AU9999.SGE",
    "stockPrice": "1009.88"
  }
}
```

推荐同名 canonical 子集 2：最近走势

```json
{
  "klineList": [
    {
      "date": "2026-04-29 00:00:00",
      "openPrice": "1007.0",
      "closePrice": "1009.88",
      "highPrice": "1020.0",
      "lowPrice": "1006.32",
      "priceChange": "-10.85",
      "priceChangePercent": "-1.06"
    }
  ]
}
```

不推荐写法：
- ❌ 任意平铺成 `price`、`trend`、`changePercent`
- ❌ 新增 extractor 中没有的“美元金价”“国际金价”字段

固定贵金属 public DTO 使用 `instrument/latest/candles`，详细字段以 `API_DATA_PRECIOUS_METAL_PRICE.md` 为准。

最小可用片段：

```json
{
  "latestData": {
    "date": "2026-04-29 00:00:00",
    "closePrice": "1009.88",
    "priceChangePercent": "-1.06"
  }
}
```

---

## 4. 汇率 `exchange_rate`

适合 query：
- `美元兑人民币汇率`
- `欧元汇率`

canonical 结构：

```json
[
  {
    "fromCode": "CNY",
    "toCode": "",
    "title": "",
    "inverseRate": "",
    "rate": "",
    "updateTime": "",
    "changeRate": "",
    "changeValue": ""
  }
]
```

完整 canonical 样例（真实值风格）：

```json
[
  {
    "fromCode": "CNY",
    "toCode": "AUD",
    "title": "人民币兑换澳元",
    "inverseRate": "4.9019598961",
    "rate": "0.2040000370",
    "updateTime": "2026-04-29 17:24:40",
    "changeRate": "",
    "changeValue": ""
  }
]
```

注意：
- 当前稳定 extractor 更适合“人民币货币对”表达
- 推荐 query：
  - `澳元兑人民币汇率`
  - `今日澳元对人民币汇率`
- 避免只写：
  - `澳元汇率`

推荐 public DTO 1：展示汇率卡片

```json
{
  "from": "CNY",
  "to": "AUD",
  "title": "人民币兑换澳元",
  "rate": 0.204000037,
  "inverseRate": 4.9019598961,
  "updateTime": "2026-04-29 17:24:40"
}
```

推荐 public DTO 2：只展示货币对和更新时间

```json
{
  "from": "CNY",
  "to": "AUD",
  "title": "人民币兑换澳元",
  "updateTime": "2026-04-29 17:24:40"
}
```

不推荐写法：
- ❌ 要求 extractor 中没有的第三货币交叉汇率字段
- ❌ 把 `data.fetch` / `@server.webSearch` schema 写成顶层数组
- ❌ 只写 `澳元汇率` 这种不完整 query

---

## 5. 指数 `index`

指数是存量 Stable MCP 兼容场景，不属于五个新公开 API。

多指数 canonical 候选可确定性包装为顶层对象：

```json
{
  "indices": [
    {
      "indexName": "上证指数",
      "indexCode": "000001.SH",
      "latestPrice": "3380.12"
    }
  ]
}
```

schema 应使用顶层对象和 `indices` 数组，不要使用顶层数组。

---

## 6. 当前范围说明

当前确定性 Stable MCP 兼容链路覆盖：

- `weather`
- `stock`
- `gold_price`
- `exchange_rate`
- `index`

其他 MCP 场景（如 `map`）当前不纳入这条强约束链路，避免因为 extractor 语义还不稳而误伤。

---

## 7. 规则总结

- 新前端应用的五类稳定数据优先使用专用公开 API，不再手写 `data.fetch` schema。
- 存量兼容 schema 只能依赖同名 canonical 子集、固定 public DTO、集合包装和安全标量类型转换。
- 任意语义重命名或 flatten 不属于确定性保证，会进入 `generic_retrieval` 和通用 `data_api_agent` 回退。
- `canonical_subset` 表示从 canonical 按目标 schema 保留同名字段，`canonical_collection` 表示确定性集合包装。
- `public_dto` 表示单个固定公开 DTO，`public_dto_collection` 表示多个固定公开 DTO 的数组或已知 wrapper。
- 只有确定性映射成功时才跳过 `data_api_agent` 并忽略其他 WebSearch evidence。
