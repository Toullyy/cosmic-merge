declare global {
  interface Window {
    adsbygoogle: unknown[];
    adBreak: (o: Record<string, unknown>) => void;
    adConfig: (o: Record<string, unknown>) => void;
  }
}

const cfg = {
  provider: 'mock' as 'mock' | 'adsense',
  adsenseClient: 'ca-pub-XXXXXXXXXXXXXXXX',
  testMode: true,
  interstitialAfterGames: 2,
  interstitialMinGapMs: 90000,
  mockInterstitialSec: 2,
  mockRewardSec: 3,
};

function mockAd(kind: 'interstitial' | 'rewarded', secs: number, cb: (ok: boolean) => void) {
  Ads.onPause();
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:rgba(5,8,20,.94);color:#fff;' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;' +
    'font-family:system-ui,sans-serif;text-align:center;padding:24px;touch-action:manipulation';
  const isReward = kind === 'rewarded';
  wrap.innerHTML =
    '<div style="font-size:14px;letter-spacing:2px;color:#8aa0ff">โฆษณาจำลอง (MOCK)</div>' +
    '<div style="font-size:26px;font-weight:700">' + (isReward ? 'ดูจนจบเพื่อรับรางวัล' : 'โฆษณาเต็มจอ') + '</div>' +
    '<div id="mk-count" style="font-size:56px;font-weight:800"></div>';
  const btn = document.createElement('button');
  btn.style.cssText =
    'font-size:20px;font-weight:700;padding:14px 28px;border:0;border-radius:14px;background:#3b82f6;color:#fff;opacity:.4';
  btn.disabled = true;
  btn.textContent = isReward ? 'รับรางวัล' : 'ปิด';
  wrap.appendChild(btn);
  let skip: HTMLButtonElement | null = null;
  if (isReward) {
    skip = document.createElement('button');
    skip.style.cssText = 'font-size:15px;padding:8px 16px;border:0;background:none;color:#8aa0ff';
    skip.textContent = 'ข้าม (ไม่รับรางวัล)';
    wrap.appendChild(skip);
  }
  document.body.appendChild(wrap);
  let left = secs;
  const count = wrap.querySelector('#mk-count') as HTMLElement;
  count.textContent = String(left);
  const timer = setInterval(() => {
    left--;
    count.textContent = String(Math.max(0, left));
    if (left <= 0) { clearInterval(timer); btn.disabled = false; btn.style.opacity = '1'; }
  }, 1000);
  function close(ok: boolean) { clearInterval(timer); wrap.remove(); cb(ok); }
  btn.onclick = () => close(isReward);
  if (skip) skip.onclick = () => close(false);
}

export const Ads = {
  cfg,
  games: 0,
  lastInterstitial: Date.now(),
  onPause: () => {},
  onResume: () => {},

  init() {
    if (cfg.provider !== 'adsense') return;
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = (o) => { window.adsbygoogle.push(o); };
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + cfg.adsenseClient;
    s.setAttribute('data-ad-client', cfg.adsenseClient);
    if (cfg.testMode) s.setAttribute('data-adbreak-test', 'on');
    document.head.appendChild(s);
    window.adConfig({ sound: 'on', preloadAdBreaks: 'on', onReady: () => {} });
  },

  maybeInterstitial(done: () => void) {
    this.games++;
    const enoughGames = this.games > cfg.interstitialAfterGames;
    const enoughGap = Date.now() - this.lastInterstitial > cfg.interstitialMinGapMs;
    if (!(enoughGames && enoughGap)) { done(); return; }
    this.lastInterstitial = Date.now();
    this.showInterstitial(done);
  },

  showInterstitial(done: () => void) {
    let finished = false;
    const fin = () => { if (finished) return; finished = true; this.onResume(); done(); };
    if (cfg.provider === 'adsense' && window.adBreak) {
      window.adBreak({ type:'next', name:'restart', beforeAd: this.onPause, afterAd: () => {}, adBreakDone: fin });
    } else {
      mockAd('interstitial', cfg.mockInterstitialSec, fin);
    }
  },

  showRewarded(cb: (result: { rewarded: boolean; status: string }) => void) {
    let finished = false;
    const fin = (res: { rewarded: boolean; status: string }) => {
      if (finished) return; finished = true; this.onResume(); cb(res);
    };
    if (cfg.provider === 'adsense' && window.adBreak) {
      let viewed = false;
      window.adBreak({
        type:'reward', name:'bonus',
        beforeAd: this.onPause, afterAd: () => {},
        beforeReward: (showAd: () => void) => { showAd(); },
        adViewed: () => { viewed = true; },
        adDismissed: () => {},
        adBreakDone: (info: any) => {
          const status = info?.breakStatus ?? '';
          fin({ rewarded: viewed || status === 'viewed', status });
        },
      });
    } else {
      mockAd('rewarded', cfg.mockRewardSec, (ok) => fin({ rewarded: ok, status: ok ? 'viewed' : 'dismissed' }));
    }
  },
};

Ads.init();
