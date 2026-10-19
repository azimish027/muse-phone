import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 语音输入 Hook：统一处理识别启停衔接、权限引导、失败重试与卡死兜底。
 *
 * 设计要点：
 * - 单飞保护：启动中 / 聆听中再次点击 = 停止，不会并发启动两个会话。
 * - 会话失效：stop/abort 时递增 sessionId，旧会话的回调全部忽略，避免误报。
 * - 卡死兜底：聆听超过 45s 无任何结束回调，自动 abort 并复位；stop 后 2.5s 无 onEnd 强制复位。
 * - 错误分类：not-allowed / audio-capture / no-speech / network / engine 分别给出可理解的引导。
 */

export type VoicePhase = 'idle' | 'starting' | 'listening' | 'stopping' | 'error';

export interface VoiceErrorInfo {
  kind: 'permission' | 'device' | 'no-speech' | 'network' | 'engine' | 'aborted' | 'unknown';
  message: string;
  /** 是否可通过重试按钮再次尝试 */
  retryable: boolean;
}

/** 权限被拒时的引导文案（供界面直接展示） */
export const PERMISSION_GUIDE_TEXT = '请在系统设置中允许「麦克风」权限，然后回到应用重试。';

function classifyError(err: unknown): VoiceErrorInfo {
  const e = (typeof err === 'object' && err !== null ? err : {}) as Record<string, unknown>;
  const code = typeof e.code === 'string' ? e.code : '';
  const error = typeof e.error === 'string' ? e.error : '';
  const message = typeof e.message === 'string' && e.message.trim() ? e.message.trim() : '';
  if (code === 'PERMISSION_REQUIRED' || error === 'not-allowed') {
    return { kind: 'permission', message: `麦克风权限被拒绝，${PERMISSION_GUIDE_TEXT}`, retryable: true };
  }
  if (error === 'audio-capture') {
    return { kind: 'device', message: '麦克风不可用或被占用，请检查是否有其他应用正在使用麦克风后重试。', retryable: true };
  }
  if (error === 'no-speech') {
    return { kind: 'no-speech', message: '没有听清内容，请靠近麦克风再试一次。', retryable: true };
  }
  if (error === 'network') {
    return { kind: 'network', message: '网络不可用，语音识别需要联网，请检查网络后重试。', retryable: true };
  }
  if (error === 'engine') {
    return { kind: 'engine', message: '语音识别引擎暂时不可用，请稍后重试。', retryable: true };
  }
  if (error === 'aborted') {
    return { kind: 'aborted', message: '', retryable: false };
  }
  if (message.includes('权限')) {
    return { kind: 'permission', message: `麦克风权限被拒绝，${PERMISSION_GUIDE_TEXT}`, retryable: true };
  }
  return { kind: 'unknown', message: message || '语音识别失败，请重试或直接输入。', retryable: true };
}

const LISTEN_STUCK_MS = 45000;
const STOP_RESET_MS = 2500;

export function useVoiceInput(onText: (text: string) => void) {
  const [phase, setPhaseState] = useState<VoicePhase>('idle');
  const [error, setError] = useState<VoiceErrorInfo | null>(null);
  const phaseRef = useRef<VoicePhase>('idle');
  const sessionRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const setPhase = useCallback((p: VoicePhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopVoice = useCallback(async () => {
    if (phaseRef.current === 'idle' || phaseRef.current === 'error') return;
    sessionRef.current += 1; // 旧会话回调全部失效
    clearTimer();
    setPhase('stopping');
    try {
      await window.lingguang.asr.stop();
    } catch {
      // stop 幂等，失败也继续复位
    }
    // 若 stop 后 onEnd 迟迟不来，强制复位，避免界面卡在「聆听中」
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      if (phaseRef.current === 'stopping') setPhase('idle');
    }, STOP_RESET_MS);
  }, [clearTimer, setPhase]);

  const abortVoice = useCallback(async () => {
    sessionRef.current += 1;
    clearTimer();
    try {
      await window.lingguang.asr.abort();
    } catch {
      // 幂等
    }
    setPhase('idle');
  }, [clearTimer, setPhase]);

  const startVoice = useCallback(async () => {
    // 单飞保护：正在启动 / 聆听 / 停止中 → 停止当前会话
    if (phaseRef.current === 'starting' || phaseRef.current === 'listening' || phaseRef.current === 'stopping') {
      void stopVoice();
      return;
    }
    const session = sessionRef.current + 1;
    sessionRef.current = session;
    setError(null);
    setPhase('starting');
    try {
      await window.lingguang.asr.start({
        lang: 'zh-CN',
        interim: true,
        onText: ({ text }) => {
          if (sessionRef.current !== session) return;
          onTextRef.current(text);
        },
        onError: (err) => {
          if (sessionRef.current !== session) return;
          clearTimer();
          const info = classifyError(err);
          if (info.kind === 'aborted') {
            setPhase('idle');
            return;
          }
          setError(info);
          setPhase('error');
        },
        onEnd: () => {
          if (sessionRef.current !== session) return;
          clearTimer();
          // 出错流程里 onError 已置 error，onEnd 不再覆盖错误展示
          if (phaseRef.current !== 'error') setPhase('idle');
        },
      });
      if (sessionRef.current !== session) return;
      clearTimer();
      setPhase('listening');
      // 卡死兜底：长时间无结束回调 → 自动停止并提示
      timerRef.current = window.setTimeout(() => {
        if (sessionRef.current === session && phaseRef.current === 'listening') {
          setError({ kind: 'unknown', message: '识别没有响应，已自动停止，请重试。', retryable: true });
          setPhase('idle');
          void window.lingguang.asr.abort().catch(() => {});
        }
      }, LISTEN_STUCK_MS);
    } catch (err) {
      if (sessionRef.current !== session) return;
      clearTimer();
      setError(classifyError(err));
      setPhase('error');
    }
  }, [clearTimer, setPhase, stopVoice]);

  // 卸载时中止可能仍在进行的识别
  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      clearTimer();
      void window.lingguang.asr.abort().catch(() => {});
    };
  }, [clearTimer]);

  const resetError = useCallback(() => setError(null), []);

  return { phase, error, startVoice, stopVoice, abortVoice, resetError };
}