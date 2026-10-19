---
skill_name: AUDIOCONTEXT2
display_name: 音频合成入口
description: React scaffold 的音效与乐器合成使用受控 Tone.js 入口。
api_file: API_AUDIOCONTEXT2.md
enable: false
---

# React scaffold 音频合成

本脚手架的音效、乐器、节拍和波形分析使用 `@/lib/tone`。
完整用法见 [Tone.js 音效 API](API_TONE_AUDIO.md)。
音频文件和预置素材使用 `@/lib/audio`，参见 [SOUND_LIB](API_SOUND_LIB.md)；文本朗读使用 [PLAYTTS](API_PLAYTTS.md)。

业务代码不使用 `AudioContext2` 或浏览器原生 `AudioContext`。
全局声明中的历史 AudioContext2 类型不代表当前构建允许新业务调用。

- 由用户点击或触摸触发 `await Tone.start()`。
- 乐器与效果节点保存在稳定实例中，不在 React render 中反复创建。
- 退出功能或组件卸载时停止调度并 `dispose()` 节点。
- 宿主静音由受控入口同步，业务不修改 Tone.js 总输出静音状态。
- 使用 `useHostMediaConstraints()` 同步播放入口；宿主暂停时不发起新播放，不在响应宿主状态变化的订阅或 effect 中再次控制底层播放器。

## React 示例：按键音符

```tsx
import { useEffect, useRef, useState } from 'react';
import * as Tone from '@/lib/tone';
import { useHostMediaConstraints } from '@/hooks/useHostMediaConstraints';

function NoteButton() {
  const { hostPaused } = useHostMediaConstraints();
  const synthRef = useRef<Tone.Synth | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const synth = new Tone.Synth().toDestination();
    synthRef.current = synth;
    return () => {
      synthRef.current = null;
      synth.dispose();
    };
  }, []);

  const playNote = async () => {
    if (hostPaused) return;
    setError('');
    try {
      await Tone.start();
      // 等待音频启动期间若组件已卸载，不再触发音符。
      synthRef.current?.triggerAttackRelease('C5', '8n');
    } catch (error) {
      setError(String(error));
    }
  };

  return (
    <div>
      <button disabled={hostPaused} onClick={playNote}>播放音符</button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```
