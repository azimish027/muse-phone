---
skill_name: DATA_WEATHER
display_name: 稳定天气数据
description: 查询指定城市或位置的实时天气、空气质量、逐小时预报、多日预报和生活指数。用于天气卡片、出行建议、穿搭建议、运动建议等公开天气数据场景。在本 API 能力范围内应优先使用本 API；需求超出文档声明的标的、字段、时间范围或数据粒度时，可对超出部分使用 WEB_SEARCH。
api_file: API_DATA_WEATHER.md
enable: true
---

# Weather Data API

使用 `window.lingguang.data.getWeather(options)` 获取稳定天气数据。

```typescript
type LingguangWeatherInclude = 'realtime' | 'daily' | 'hourly' | 'lifeIndex';

interface LingguangWeatherLocation {
  province?: string;
  city: string;
  district?: string;
  longitude?: number;
  latitude?: number;
}

interface LingguangWeatherOptions {
  location: string | LingguangWeatherLocation;
  include?: LingguangWeatherInclude[];
  forecastDays?: 1 | 3 | 7 | 15;
  hourlyHours?: 0 | 24 | 48;
  timeout?: number;
}

interface LingguangWeatherResult {
  location: {
    country?: string;
    province?: string;
    city: string;
    district?: string;
  };
  updatedAt?: string;
  realtime?: LingguangWeatherRealtime;
  dailyForecast: LingguangWeatherDailyForecast[];
  hourlyForecast: LingguangWeatherHourlyForecast[];
  lifeIndex: LingguangWeatherLifeIndex[];
  traceId?: string;
}

interface LingguangWeatherRealtime {
  date?: string;
  condition: string;
  temperatureC: number | null;
  tempHighC?: number | null;
  tempLowC?: number | null;
  feelsLikeC?: number | null;
  humidityPercent?: number | null;
  windDirection?: string;
  windLevel?: string;
  windSpeedMps?: number | null;
  visibilityMeters?: number | null;
  pressureHpa?: number | null;
  uvIndex?: number | null;
  uvLevel?: string;
  dewPointC?: number | null;
  sunrise?: string;
  sunset?: string;
  observationTime?: string;
  travelReminder?: string;
  pm25Level?: string;
  pm25Aqi?: number | null;
  precipitationProbabilityPercent?: number | null;
}

interface LingguangWeatherDailyForecast {
  date: string;
  weekday?: string;
  conditionDay: string;
  conditionNight?: string;
  tempHighC: number | null;
  tempLowC: number | null;
  windDirectionDay?: string;
  windDirectionNight?: string;
  windLevelDay?: string;
  windLevelNight?: string;
  humidityPercent?: number | null;
  humidityNightPercent?: number | null;
  precipitationProbabilityPercent?: number | null;
  pm25Level?: string;
  pm25Aqi?: number | null;
  iconDay?: string;
  iconNight?: string;
}

interface LingguangWeatherHourlyForecast {
  time: string;
  hour: number | null;
  condition: string;
  temperatureC: number | null;
  humidityPercent?: number | null;
  windDirection?: string;
  windLevel?: string;
  rainProbabilityPercent?: number | null;
  precipitationMm?: number | null;
  qpfMm?: number | null;
  visibilityMeters?: number | null;
  uvIndex?: number | null;
  pm25Level?: string;
  pm25Aqi?: number | null;
  isNow?: boolean;
}

interface LingguangWeatherLifeIndex {
  date?: string;
  type: string;
  typeId?: string | number;
  value?: string;
  level?: string;
  levelDesc?: string;
  description?: string;
  detail?: string;
}

window.lingguang.data.getWeather(options: LingguangWeatherOptions): Promise<LingguangWeatherResult | null>
```

## 使用规则

- 实时天气、空气质量、逐小时预报、未来多日预报、生活指数等场景优先使用 `getWeather`，不要再用 `window.lingguang.data.fetch('杭州天气', schema)`。
- 历史天气、超过本 API 预报范围的数据或返回类型未声明的字段不属于本 API 能力范围；同一需求包含这些内容时，已覆盖的实时天气和预报仍使用 `getWeather`，只有超出部分使用 WEB_SEARCH。
- `location` 必填。明确城市时可传 `"杭州"`；依赖当前位置时应先用定位能力拿到城市、经纬度后再调用。
- `include` 用于减少不需要的数据。天气卡片通常传 `['realtime', 'daily']`；生活建议页可传 `['realtime', 'lifeIndex']`。
- `forecastDays` 最大 15；`hourlyHours` 建议只在需要小时趋势图时传 24 或 48。
- 需要展示降雨概率或降水量时，必须在 `include` 中加入 `'hourly'`，并将 `hourlyHours` 设为 24 或 48；当前小时取 `hourlyForecast` 中 `isNow === true` 的记录，未来一小时取该记录的下一条。
- 部分天气源不提供独立的实时降水概率；此时后端会用明确标记为当前小时的 `rainProbabilityPercent` 回填 `realtime.precipitationProbabilityPercent`，但不会用普通未来小时猜测实时值。
- `0` 是有效概率，`null` 或字段缺失表示数据不可用；渲染可空数值时使用 `value == null` 判断并显示“暂无”，禁止用 `value || 0` 把缺失值伪装成 `0`。
- 必须把“当前是否下雨”和“未来一小时降雨概率”作为两个独立指标展示，禁止把任意概率字段标成“当前是否下雨”。
- “当前是否下雨”优先依据 `realtime.condition`，当前小时 `precipitationMm` / `qpfMm` 只作补充；`realtime.precipitationProbabilityPercent` 表示当前时段预报概率，不表示已经观测到降雨。
- “未来一小时降雨概率”必须读取 `hourlyForecast` 中 `isNow === true` 记录的下一条 `rainProbabilityPercent`；没有当前小时标记、没有下一条或概率缺失时显示“暂无”，不得使用 `realtime.precipitationProbabilityPercent` 或其他小时替代。
- 所有数值字段都已经按字段名中的单位归一化，例如 `temperatureC` 是摄氏度，`humidityPercent` 是百分比，`windSpeedMps` 是米/秒。
- 字段仍然要按外部数据处理：渲染前判断数组、对象和数值是否存在，不要直接对可空字段调用 `.toFixed()`。
- 失败或无数据时返回 `null`；调用异常会 reject。单次调用返回 `null`，或发生 reject、超时、临时无数据属于运行失败，不等于能力不覆盖；应展示明确错误态或重试入口，不得静默回退到 WEB_SEARCH，也不要改用假天气。
- 输入变化、定位变化或自动刷新触发的重复查询应做防抖或间隔控制；用户点击刷新完成后保留可再次触发入口，仅请求进行中用 `isRefreshing` 防并发。不要在输入框 `onChange` 或高频 `useEffect` 中直接调用。
- 天气刷新默认同时提供用户主动刷新入口和有间隔的静默自动刷新；自动刷新必须设置合理时间间隔、页面可见性判断、timer 清理和同一模块单请求保护，天气实况/空气质量建议 10 分钟起，多日预报/生活指数建议 30-60 分钟，避免不间断请求。刷新时只更新天气模块 state，保留上次有效天气、`lastUpdatedAt`、局部 `isRefreshing`、失败重试和数据过期提示；手动刷新和静默自动刷新都应有清晰但不打断操作的刷新中反馈，不使用整页 reload 或首屏整体 loading。

## 示例

```typescript
const weather = await window.lingguang.data.getWeather({
  location: { province: '浙江省', city: '杭州市' },
  include: ['realtime', 'daily', 'hourly', 'lifeIndex'],
  forecastDays: 7,
  hourlyHours: 24,
  timeout: 8000,
});

if (!weather?.realtime) {
  showError('天气数据暂时不可用，请稍后重试');
  return;
}

const hourlyForecast = Array.isArray(weather.hourlyForecast)
  ? weather.hourlyForecast
  : [];
const currentHourIndex = hourlyForecast.findIndex((item) => item.isNow === true);
const currentHour = currentHourIndex >= 0
  ? hourlyForecast[currentHourIndex]
  : undefined;
const nextHour = currentHourIndex >= 0
  ? hourlyForecast[currentHourIndex + 1]
  : undefined;
const currentPrecipitationMm =
  currentHour?.precipitationMm ?? currentHour?.qpfMm;
const isCurrentlyRaining =
  weather.realtime.condition.includes('雨') ||
  (currentPrecipitationMm != null && currentPrecipitationMm > 0);
const nextHourRainProbability = nextHour?.rainProbabilityPercent;

setWeatherCard({
  city: weather.location.city,
  condition: weather.realtime.condition,
  temperature: weather.realtime.temperatureC,
  pm25Level: weather.realtime.pm25Level,
  currentRain: isCurrentlyRaining ? '当前正在下雨' : '当前没有下雨',
  nextHourRainProbability:
    nextHourRainProbability == null
      ? '暂无'
      : `${nextHourRainProbability}%`,
  forecast: weather.dailyForecast.slice(0, 7),
});
```
