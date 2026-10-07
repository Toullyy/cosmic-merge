/* ads.js — ชั้นกลางสำหรับโฆษณา
 * เกมเรียกแค่ Ads.maybeInterstitial / Ads.showRewarded เท่านั้น
 * จะเปลี่ยนเจ้าของโฆษณา (พอร์ทัลเกม, AdSense, อื่นๆ) ก็แก้ไฟล์นี้ไฟล์เดียว
 *
 * provider:
 *   'mock'    = โฆษณาจำลอง ใช้ตอนพัฒนา/ทดสอบ (ไม่มีรายได้)
 *   'adsense' = Google AdSense for Games (H5 Games Ads) ต้องสมัครและได้รับอนุมัติก่อน
 */
(function () {
  'use strict';

  var cfg = {
    provider: 'mock',
    adsenseClient: 'ca-pub-XXXXXXXXXXXXXXXX', // ใส่ publisher id ของตัวเองเมื่อใช้ 'adsense'
    testMode: true,                            // เปิด data-adbreak-test ระหว่างทดสอบ ปิดตอนขึ้นจริง

    interstitialAfterGames: 2,    // ไม่ให้ขึ้นใน 2 เกมแรก ให้ผู้เล่นติดเกมก่อน
    interstitialMinGapMs: 90000,  // เว้นอย่างน้อย 90 วินาทีระหว่างโฆษณาเต็มจอ
    mockInterstitialSec: 2,
    mockRewardSec: 3
  };

  var Ads = {
    cfg: cfg,
    games: 0,
    lastInterstitial: Date.now(),
    // เกมกำหนดฟังก์ชันพวกนี้ไว้ เพื่อหยุด/เล่นต่อระหว่างโฆษณา
    onPause: function () {},
    onResume: function () {}
  };

  Ads.init = function () {
    if (cfg.provider !== 'adsense') return;
    window.adsbygoogle = window.adsbygoogle || [];
    window.adBreak = window.adConfig = function (o) { window.adsbygoogle.push(o); };

    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + cfg.adsenseClient;
    s.setAttribute('data-ad-client', cfg.adsenseClient);
    if (cfg.testMode) s.setAttribute('data-adbreak-test', 'on');
    document.head.appendChild(s);

    window.adConfig({ sound: 'on', preloadAdBreaks: 'on', onReady: function () {} });
  };

  // เรียกตอนผู้เล่นกด "เล่นใหม่" — ตัดสินใจเองว่าจะโชว์โฆษณาเต็มจอหรือไม่
  Ads.maybeInterstitial = function (done) {
    Ads.games++;
    var enoughGames = Ads.games > cfg.interstitialAfterGames;
    var enoughGap = Date.now() - Ads.lastInterstitial > cfg.interstitialMinGapMs;
    if (!(enoughGames && enoughGap)) { done(); return; }
    Ads.lastInterstitial = Date.now();
    Ads.showInterstitial(done);
  };

  Ads.showInterstitial = function (done) {
    var finished = false;
    function fin() {
      if (finished) return;
      finished = true;
      Ads.onResume();
      done();
    }
    if (cfg.provider === 'adsense' && window.adBreak) {
      window.adBreak({
        type: 'next',
        name: 'restart',
        beforeAd: function () { Ads.onPause(); },
        afterAd: function () {},
        adBreakDone: fin
      });
    } else {
      mockAd('interstitial', cfg.mockInterstitialSec, fin);
    }
  };

  // โฆษณาแบบให้รางวัล — cb({rewarded: boolean, status: string})
  Ads.showRewarded = function (cb) {
    var finished = false;
    function fin(res) {
      if (finished) return;
      finished = true;
      Ads.onResume();
      cb(res);
    }
    if (cfg.provider === 'adsense' && window.adBreak) {
      var viewed = false;
      window.adBreak({
        type: 'reward',
        name: 'bonus',
        beforeAd: function () { Ads.onPause(); },
        afterAd: function () {},
        beforeReward: function (showAd) { showAd(); }, // ผู้เล่นกดปุ่มแล้ว ถือว่ายินยอมดู
        adViewed: function () { viewed = true; },
        adDismissed: function () {},
        adBreakDone: function (info) {
          var status = info && info.breakStatus;
          fin({ rewarded: viewed || status === 'viewed', status: status || '' });
        }
      });
    } else {
      mockAd('rewarded', cfg.mockRewardSec, function (ok) {
        fin({ rewarded: ok, status: ok ? 'viewed' : 'dismissed' });
      });
    }
  };

  // ---------- โฆษณาจำลอง (DOM overlay) ----------
  function mockAd(kind, secs, cb) {
    Ads.onPause();
    var wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;inset:0;z-index:99999;background:rgba(5,8,20,.94);color:#fff;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;' +
      'font-family:system-ui,sans-serif;text-align:center;padding:24px;touch-action:manipulation';
    var isReward = kind === 'rewarded';
    wrap.innerHTML =
      '<div style="font-size:14px;letter-spacing:2px;color:#8aa0ff">โฆษณาจำลอง (MOCK)</div>' +
      '<div style="font-size:26px;font-weight:700">' + (isReward ? 'ดูจนจบเพื่อรับรางวัล' : 'โฆษณาเต็มจอ') + '</div>' +
      '<div id="mk-count" style="font-size:56px;font-weight:800"></div>';
    var btn = document.createElement('button');
    btn.style.cssText =
      'font-size:20px;font-weight:700;padding:14px 28px;border:0;border-radius:14px;' +
      'background:#3b82f6;color:#fff;opacity:.4';
    btn.disabled = true;
    btn.textContent = isReward ? 'รับรางวัล' : 'ปิด';
    wrap.appendChild(btn);

    var skip = null;
    if (isReward) {
      skip = document.createElement('button');
      skip.style.cssText = 'font-size:15px;padding:8px 16px;border:0;background:none;color:#8aa0ff';
      skip.textContent = 'ข้าม (ไม่รับรางวัล)';
      wrap.appendChild(skip);
    }
    document.body.appendChild(wrap);

    var left = secs;
    var count = wrap.querySelector('#mk-count');
    count.textContent = left;
    var timer = setInterval(function () {
      left--;
      count.textContent = Math.max(0, left);
      if (left <= 0) {
        clearInterval(timer);
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    }, 1000);

    function close(ok) {
      clearInterval(timer);
      wrap.remove();
      cb(ok);
    }
    btn.onclick = function () { close(isReward); };
    if (skip) skip.onclick = function () { close(false); };
  }

  window.Ads = Ads;
  Ads.init();
})();
