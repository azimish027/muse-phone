---
skill_name: GET_USER_MEDIA
display_name: 浏览器原生getUserMedia能力
description: 摄像头媒体流及麦克风声音检测、音量和波形分析；不提供录音文件或语义识别。
api_file: API_GET_USER_MEDIA.md
enable: true
min_client_version: "1.0.70"
---

# getUserMedia

摄像头预览使用 `navigator.mediaDevices.getUserMedia`，麦克风分析使用 `@/lib/tone`。

- 麦克风分析通过 `Tone.UserMedia`、`Tone.Meter` 和 `Tone.Waveform` 完成，不直接创建原生 AudioContext。
- 由用户操作触发 `Tone.start()` 和麦克风权限请求；声音存在检测不代表录音或识别语义，语音转文字参见 [ASR](API_ASR.md)。
- 摄像头流绑定到 `video.srcObject`，不要赋给 `video.src`；设置 `autoplay`、`playsInline`，本地预览设置 `muted`。
- 调用者保存下面函数返回的清理函数，在停止采集或组件卸载时执行；异步启动完成时若页面已退出，立即执行清理，不再更新页面。

## 示例 1：麦克风音量与波形

```ts
import * as Tone from '@/lib/tone';

async function startMicrophoneAnalysis(
  onFrame: (frame: { volume: number; waveform: number[] }) => void,
) {
  await Tone.start();
  const microphone = new Tone.UserMedia();
  const meter = new Tone.Meter({ normalRange: true, smoothing: 0.8 });
  const waveform = new Tone.Waveform(128);
  microphone.connect(meter);
  microphone.connect(waveform);

  const dispose = () => {
    microphone.close();
    microphone.dispose();
    meter.dispose();
    waveform.dispose();
  };

  try {
    await microphone.open();
  } catch (error) {
    dispose();
    throw error;
  }

  let rafId = 0;
  const update = () => {
    const value = meter.getValue();
    const volume = typeof value === 'number' ? value : Math.max(...value);
    onFrame({ volume, waveform: Array.from(waveform.getValue()) });
    rafId = requestAnimationFrame(update);
  };
  update();

  return () => {
    cancelAnimationFrame(rafId);
    dispose();
  };
}
```

## 示例 2：采集摄像头并绑定到 `<video>`

React 调用者通过 `@/hooks/useHostMediaConstraints` 的 `useHostMediaConstraints()` 同步启动入口；`hostPaused` 时不启动预览。
下面的函数在 `play()` 失败后释放采集资源并原样抛出错误；调用者应区分 `AbortError`，不将宿主中断误报为权限失败，也不在宿主状态订阅中再次操作播放器。

```ts
async function startCamera(videoEl: HTMLVideoElement) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });

  videoEl.srcObject = stream;
  videoEl.autoplay = true;
  videoEl.playsInline = true;
  videoEl.muted = true; // 本地预览建议静音

  try {
    await videoEl.play();
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    videoEl.srcObject = null;
    throw error;
  }

  return () => {
    stream.getTracks().forEach((track) => track.stop());
    videoEl.srcObject = null;
  };
}
```
