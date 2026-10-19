# API 与开发规范导航

先读 [基础规范](spec.md)，再按需求读取对应 API 文档。
这些文件可在应用工作区直接阅读，不需要模板渲染或文档查询工具。
前端签名以 [src/global.d.ts](../src/global.d.ts) 为准，QuickJS 后端以 [service/runtime/sdk](../service/runtime/sdk/server.ts) 为准。
文档里的类型片段用于解释合同，不要复制为第二份全局声明。

文档和 SDK 中存在某个接口，不表示所有客户端、账号、场景或版本都可用。
结合当前任务提供的能力信息和文档中的适用条件使用；宿主返回不支持或失败时如实展示，不伪造成功。
文档头部的 `enable` / `implemented` 等资料元数据不代替本次调用授权，开发 mock 也不能证明线上能力可用。

## 数据与业务服务

| 需求 | 文档 | 运行位置 |
| --- | --- | --- |
| 业务记录、分页、多用户权限 | [数据库](API_DB.md) | 纯前端使用 `window.lingguang.db` |
| controller 访问同一平台 DB | [服务端数据库](API_DB_SERVICE.md) | QuickJS `@server.db` |
| 页面与业务后端联通 | [Service API](API_SERVICE.md) | 前端生成客户端 → QuickJS controller |
| 通用公开事实检索（WEB_SEARCH） | [data.fetch](API_DATAFETCH.md) | 前端 |
| 后端聚合公开信息 | [服务端 WebSearch](API_WEBSEARCH_SERVICE.md) | QuickJS `@server.webSearch` |
| 天气与预报 | [天气](API_DATA_WEATHER.md) | 前端 |
| 股票最新价、K 线 | [股票](API_DATA_STOCK_PRICE.md)、[K 线](API_DATA_STOCK_CANDLESTICK.md) | 前端 |
| 法币汇率、贵金属 | [汇率](API_DATA_EXCHANGE_RATE.md)、[贵金属](API_DATA_PRECIOUS_METAL_PRICE.md) | 前端 |
| 专用数据改用通用检索时的 schema | [结构化返回兼容说明](WEBSEARCH_MCP_CANONICAL.md) | 前端或 QuickJS |
| 个人小型键值数据 | [Storage](API_STORAGE.md) | 前端；QuickJS 形式见 Service API |

## AI 与素材

| 需求 | 文档 |
| --- | --- |
| 文本或结构化输出 | [AI Chat](API_AI_CHAT.md) |
| 流式对话或渐进展示 | [AI Stream Chat](API_AI_STREAM_CHAT.md) |
| 按按钮逐层探索，返回 HTML | [渐进式探索](API_AGENTIC_DATAFETCH.md) |
| 用户运行时生成图片、理解图片 | [ImageGen](API_IMAGEGEN.md)、[VLLM](API_VLLM.md) |
| 用户运行时生成音乐 | [MusicGen](API_MUSICGEN.md) |
| 开发阶段取得真实图片素材 | [图片搜索](API_IMAGE_SEARCH.md)，使用生成期 capability，不是浏览器 API |

默认封面、配图和内置音乐在开发阶段使用当前可用的素材能力准备；运行时 AI 接口用于用户在应用内主动触发。
保留现有接口的编辑场景可查 [callLLM](API_CALLLLM.md)、[llmStream](API_LLM_STREAM.md) 和 [AI 兼容资料](API_AI.md)，新开发优先使用上表合同。
[后端 Agent](API_AGENT_RUN_STREAM.md) 有独立接入前提；存在类型声明不代表普通闪应用任务已获准使用。
录音文件、克隆声音、视频生成、支付等没有在此列为可调用入口的能力，不凭名称或示例构造 SDK 方法。

## 文件、设备与音频

| 需求 | 文档 |
| --- | --- |
| 选择/上传/预览/保存文件，文件解析 | [FS](API_FS.md)、[FileSystemManager](fsmanager-api.md) |
| 图片和视频选择、拍摄、上传、保存相册 | [Media](API_MEDIA.md) |
| 麦克风/摄像头流 | [getUserMedia](API_GET_USER_MEDIA.md) |
| 语音转文字、文字朗读 | [ASR](API_ASR.md)、[TTS](API_PLAYTTS.md) |
| 播放内置音效或音乐 | [音效库](API_SOUND_LIB.md)，从 `@/lib/audio` 使用播放器 |
| 合成音频、频谱等处理 | [Tone](API_TONE_AUDIO.md)；[AudioContext2](API_AUDIOCONTEXT2.md) 说明兼容边界 |
| 定位与地图 | [Location](API_LOCATION.md)、[Map](API_MAP.md) |
| 扫码、分享、震动 | [ScanCode](API_SCANCODE.md)、[Share](API_SHARE.md)、[Vibrate](API_VIBRATE.md) |
| 加速度、设备姿态、罗盘、陀螺仪 | [Accelerometer](API_ACCELEROMETER.md)、[DeviceMotion](API_DEVICEMOTION.md)、[Compass](API_COMPASS.md)、[Gyroscope](API_GYROSCOPE.md) |

## 前端库

图表用 [ECharts](API_ECHARTS.md)，日历用 [FullCalendar](API_FULLCALENDAR.md)，数学计算用 [MathJS](API_MATHJS.md)。
动画和三维见 [Framer Motion](API_FRAMER_MOTION.md)、[Three.js](API_THREEJS.md)，二维码和截图见 [QRCode](API_QRCODE.md)、[html2canvas](API_HTML2CANVAS.md)。
这些是工作区依赖，不是平台授权 API；组件入口见 [shadcn/ui](API_SHADCN_UI.md)，安装版本以 `package.json` 为准。
