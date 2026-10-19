---
skill_name: DEVICEMOTION
display_name: 设备方向
description: 用于读取设备方向数据，获取 alpha/beta/gamma 三轴方向角，支持设置采样频率和监听数据变化回调。适用于姿态识别、体感控制、方向交互等场景。
api_file: API_DEVICEMOTION.md
enable: true
min_client_version: "1.0.58"
---

你可以使用设备方向 API 获取设备姿态变化，用于体感交互、姿态识别和方向控制等场景。

# 设备方向 API

```typescript
window.lingguang.startDeviceMotionListening(options?: DeviceMotionStartOptions): Promise<void>
window.lingguang.stopDeviceMotionListening(): Promise<void>
window.lingguang.onDeviceMotionChange(callback: (reading: DeviceMotionReading) => void): void
```

**window.lingguang.startDeviceMotionListening 方法失败时（reject）返回：**

```javascript
{
  code: 'PERMISSION_REQUIRED',  // 错误类型枚举（string）
  message: '需要权限'  // 错误信息（string）
}
```

```typescript
type SensorInterval = 'game' | 'ui' | 'normal'

interface DeviceMotionReading {
  alpha: number // 绕 Z 轴旋转角（单位：度），范围 [0, 360)
  beta: number  // 绕 X 轴旋转角（单位：度），范围 [-180, 180)
  gamma: number // 绕 Y 轴旋转角（单位：度），范围 [-90, 90)
}

interface DeviceMotionStartOptions {
  /**
   * 监听频率，可选值：'game'（约 20ms/次）、'ui'（约 60ms/次）、'normal'（约 200ms/次）。
   * 默认值为 'normal'。
   */
  interval?: SensorInterval
}
```

## 倾斜控制与生命周期

- `beta` 表示前后倾斜，`gamma` 表示左右倾斜；高频交互使用 `interval: 'game'`。
- 在功能进入活动状态时注册回调并启动监听，在退出或组件卸载时调用 `stopDeviceMotionListening()`。
- 启动、订阅和停止由同一功能生命周期管理；不要让订阅 effect 依赖读数、分数、位置等高频变化的 state。
- 高频读数保存在 `useRef` 中，动画帧读取最新值；需要测量边界时，先让目标 DOM 渲染完成。
- `onDeviceMotionChange` 返回 `void`；当前接口没有退订函数，不要把其返回值当作 React cleanup，也不要重复注册回调。
