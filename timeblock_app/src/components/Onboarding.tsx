import { useEffect, useState } from 'react';
import { Feather, LayoutTemplate, X } from 'lucide-react';

/**
 * 新手引导：首次进入弹出分步引导，右上角可跳过，看过一次后不再出现。
 */

const ONBOARD_KEY = 'tb.onboarded';

const STEPS = [
  {
    icon: 'add_box',
    title: '建时间块',
    desc: '点底部「快速添加」，输入“14:00-15:30 产品评审”一句话就能建块；也可以直接按住时间轴空白处拖出时间块。',
  },
  {
    icon: 'sell',
    title: '打标签',
    desc: '每个时间块都可以挂一级/二级标签。统计页按标签汇总时长与占比，筛选条可以只高亮某个标签。',
  },
  {
    icon: 'calendar_month',
    title: '模板与周报',
    desc: '模板面板内置工作日、学习冲刺、健康作息等排期，选日期一键套用；统计页可把标签汇总生成图片周报，保存到相册发周报。',
  },
  {
    icon: 'auto_awesome',
    title: '复盘闭环',
    desc: '每天写一句今日小结，周末在统计页写周小结并生成海报分享——记录、复盘、分享，让时间花在哪一眼可见。',
  },
];

export function Onboarding() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      const done = window.localStorage.getItem(ONBOARD_KEY);
      if (done !== '1') setVisible(true);
    } catch {
      setVisible(false);
    }
  }, []);

  const finish = () => {
    try {
      window.localStorage.setItem(ONBOARD_KEY, '1');
    } catch {
      // 忽略持久化失败
    }
    setVisible(false);
  };

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="ob-root" data-testid="onboarding">
      <div className="ob-mask" />
      <div className="ob-panel" role="dialog" aria-label="新手引导">
        <button type="button" className="ob-skip" onClick={finish} data-testid="ob-skip">
          <X size={16} strokeWidth={2} /> 跳过
        </button>
        <div className="ob-brand">
          <Feather size={22} strokeWidth={2} />
          <span>落砂成羽之刻</span>
        </div>
        <div className="ob-illus" data-testid={`ob-step-${step}`}>
          <span className="material-icons ob-illus-icon">{current.icon}</span>
        </div>
        <h2 className="ob-title">{current.title}</h2>
        <p className="ob-desc">{current.desc}</p>
        <div className="ob-dots" data-testid="ob-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={`ob-dot ${i === step ? 'ob-dot-active' : ''}`} />
          ))}
        </div>
        <div className="ob-actions">
          {!isLast ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} data-testid="ob-prev">
                上一步
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} data-testid="ob-next">
                下一步
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary ob-start" onClick={finish} data-testid="ob-start">
              <LayoutTemplate size={16} strokeWidth={2} /> 开始使用
            </button>
          )}
        </div>
        <p className="ob-slogan">刻砂求羽，落砂成羽之刻。</p>
      </div>
    </div>
  );
}