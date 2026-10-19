---
skill_name: MUSICGEN
display_name: 音乐生成
description: 用户在应用运行时主动生成纯音乐或带歌词歌曲，返回可播放的音频 URL。
api_file: API_MUSICGEN.md
enable: true
---

# window.lingguang.ai.musicGeneration

## 适用范围

用户在应用内点击生成音乐时使用本接口。
应用内置曲目在生成阶段准备并直接引用，不在首次打开时调用本接口生成。
固定预置素材参见 [SOUND_LIB](API_SOUND_LIB.md)，实时音高、节拍和音效合成参见 [Tone.js](API_TONE_AUDIO.md)。

## 函数签名

```typescript
window.lingguang.ai.musicGeneration(params: {
  prompt: string;
  lyrics?: string;
  duration?: number;
}): Promise<{
  url: string;
  duration?: number;
}>
```

- `prompt`：必填的英文音乐风格描述，例如 `"ambient piano, calm mood, slow tempo"`；中文界面选项应映射为英文描述。
- `lyrics`：可选，留空或空字符串表示纯音乐；歌曲歌词使用 `[intro]`、`[verse]`、`[chorus]`、`[outro]` 分段。
- `duration`：可选的请求时长，单位秒，范围 30–240，默认 30；通常先生成约 30 秒短版，不根据歌词行数自动请求长歌。
- 成功返回音频 `url`；返回的 `duration` 是可选的实际时长，不保证每次存在。
- 失败时 Promise reject，界面展示错误；不要自动循环重试同一组参数。
- 长时长或过长、未分段歌词会增加等待和失败风险，应先调整输入。

## React 示例：生成与播放

播放通过 `@/lib/audio`，由独立的用户点击触发。
每次生成新曲目时释放旧播放器，组件卸载时停止播放；异步生成完成后仅更新仍在挂载的页面。
使用 `useHostMediaConstraints()` 同步播放入口；宿主暂停只影响播放，不阻止生成音乐。
页面播放状态由业务播放意图与 `hostPaused` 派生，不在响应宿主状态变化的订阅或 effect 中再次操作底层播放器。

```tsx
import { useEffect, useRef, useState } from 'react';
import { Howl } from '@/lib/audio';
import { useHostMediaConstraints } from '@/hooks/useHostMediaConstraints';

function MusicGenerator() {
  const { hostPaused } = useHostMediaConstraints();
  const [url, setUrl] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const soundRef = useRef<Howl | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      soundRef.current?.unload();
      soundRef.current = null;
    };
  }, []);

  const generate = async () => {
    setIsGenerating(true);
    setError('');
    setUrl('');
    soundRef.current?.unload();
    soundRef.current = null;
    try {
      const result = await window.lingguang.ai.musicGeneration({
        prompt: 'ambient piano, calm mood, slow tempo',
        lyrics: '',
        duration: 30,
      });
      if (mountedRef.current) setUrl(result.url);
    } catch (error) {
      if (mountedRef.current) setError(String(error));
    } finally {
      if (mountedRef.current) setIsGenerating(false);
    }
  };

  const togglePlayback = () => {
    if (hostPaused) return;
    if (!soundRef.current) {
      soundRef.current = new Howl({
        src: [url],
        loop: true,
        onloaderror: (_id, error) => setError(String(error)),
        onplayerror: (_id, error) => setError(String(error)),
      });
    }
    if (soundRef.current.playing()) soundRef.current.pause();
    else soundRef.current.play();
  };

  return (
    <div>
      <button disabled={isGenerating} onClick={generate}>生成音乐</button>
      <button disabled={!url || hostPaused} onClick={togglePlayback}>播放/暂停</button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

带歌词请求使用同一接口，例如：

```ts
const result = await window.lingguang.ai.musicGeneration({
  prompt: 'mandopop ballad, nostalgic mood, warm acoustic guitar',
  lyrics: '[verse]\n夜色深处有道光\n[chorus]\n照亮回家的方向\n[outro]',
  duration: 30,
});
```

不要添加 BPM、参考旋律等未声明参数。
