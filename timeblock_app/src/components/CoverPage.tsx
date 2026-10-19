import { Feather } from 'lucide-react';
import coverArt from '../assets/aigc_1792171981656_Usecaseillustrati.png';

interface CoverPageProps {
  open: boolean;
  onEnter: () => void;
}

/** 应用封面：首次进入展示一张「刻砂求羽」意境的二次元封面插画，点击进入主界面；看过一次后不再自动出现。 */
export function CoverPage({ open, onEnter }: CoverPageProps) {
  if (!open) return null;
  return (
    <div className="cv-root" data-testid="app-cover">
      <img className="cv-art" src={coverArt} alt="落砂成羽之刻封面" />
      <div className="cv-shade" aria-hidden="true" />
      <div className="cv-body">
        <div className="cv-brand">
          <Feather size={16} strokeWidth={2} />
          <span>落砂成羽之刻</span>
        </div>
        <h1 className="cv-title">
          把时间刻成砂，
          <br />
          让每一刻落羽成诗
        </h1>
        <p className="cv-slogan">刻砂求羽，落砂成羽之刻。</p>
        <p className="cv-desc">
          用时间块记下每天的真实安排，打上标签、一键套用排期模板，到周末把标签汇总生成图片周报，看清时间都流向了哪里。
        </p>
        <button type="button" className="btn btn-primary cv-enter" onClick={onEnter} data-testid="cover-enter">
          开始使用
        </button>
        <p className="cv-tip">记录 · 复盘 · 分享，让时间有迹可循</p>
      </div>
    </div>
  );
}