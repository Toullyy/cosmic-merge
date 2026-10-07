/* Cosmic Merge — เกมรวมดาว แนวตั้ง เล่นต่อเนื่อง (Phaser 3 + Matter physics)
 * ทิ้งดาวลงกล่อง ดาวระดับเดียวกันชนกันจะรวมเป็นดวงใหญ่ขึ้น
 * ถ้ากองดาวค้างเหนือเส้นแดงนานเกินไป เกมจบ
 */
(function () {
  'use strict';

  var W = 540, H = 960;
  var WALL_L = 40, WALL_R = 500, FLOOR = 880, DANGER = 215, DROP_Y = 140;
  var DROP_COOLDOWN = 450;   // ms ระหว่างการทิ้งแต่ละครั้ง
  var SETTLE_MS = 1200;      // ดาวต้องวางนิ่งนานเท่านี้ก่อนนับว่า "ค้างเหนือเส้น"
  var OVER_MS = 2200;        // ค้างเหนือเส้นนานเท่านี้ = จบเกม
  var CLEAR_COUNT = 5;       // ปุ่มล้างกอง (ดูโฆษณา) เอาดาวบนสุดออกกี่ดวง
  var CLEAR_COOLDOWN = 30000;
  var CONTINUE_CLEAR = 6;    // เล่นต่อหลังจบเกม (ดูโฆษณา) เอาดาวบนสุดออกกี่ดวง
  var FONT = '"Noto Sans Thai", "Sarabun", system-ui, sans-serif';

  // ระดับดาว: รัศมี (px) และสี
  var LEVELS = [
    { r: 18,  c: 0xff7a8a },
    { r: 25,  c: 0xffa94d },
    { r: 33,  c: 0xffd43b },
    { r: 42,  c: 0x94d82d },
    { r: 52,  c: 0x38d9a9 },
    { r: 63,  c: 0x4dabf7 },
    { r: 75,  c: 0x748ffc },
    { r: 88,  c: 0xb197fc },
    { r: 102, c: 0xf783ac },
    { r: 117, c: 0xff8787 },
    { r: 133, c: 0xfff3bf }
  ];
  var MAX = LEVELS.length - 1;
  var POOL = [0, 0, 0, 1, 1, 2, 2, 3]; // ดาวที่จะสุ่มให้ทิ้ง (ระดับเล็กออกบ่อยกว่า)

  function pick() { return POOL[Math.floor(Math.random() * POOL.length)]; }

  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  // เสียงเล็กๆ ด้วย WebAudio (ไม่ต้องมีไฟล์เสียง)
  var sfx = {
    ctx: null,
    muted: store.get('cm_mute', '0') === '1',
    unlock: function () {
      if (!this.ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone: function (f, d, type, v, slide) {
      if (this.muted || !this.ctx) return;
      var t = this.ctx.currentTime;
      var o = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
      g.gain.setValueAtTime(v || 0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + d + 0.02);
    },
    drop: function () { this.tone(260, 0.07, 'triangle', 0.06, -80); },
    merge: function (lv) { this.tone(320 + lv * 55, 0.16, 'sine', 0.09, 120); },
    over: function () { this.tone(300, 0.5, 'sawtooth', 0.07, -220); },
    toggle: function () { this.muted = !this.muted; store.set('cm_mute', this.muted ? '1' : '0'); }
  };

  // สร้างภาพดาวแต่ละระดับด้วยโค้ด (ไม่ต้องมีไฟล์รูป)
  function makeTextures(scene) {
    LEVELS.forEach(function (L, i) {
      var key = 'lv' + i;
      if (scene.textures.exists(key)) return;
      var r = L.r, s = r * 2 + 6, cx = s / 2, cy = s / 2;
      var g = scene.make.graphics({ x: 0, y: 0, add: false });
      var base = Phaser.Display.Color.IntegerToColor(L.c);

      g.fillStyle(base.clone().darken(30).color, 1);
      g.fillCircle(cx, cy, r);
      g.fillStyle(L.c, 1);
      g.fillCircle(cx - r * 0.04, cy - r * 0.05, r * 0.93);
      g.fillStyle(base.clone().lighten(30).color, 0.55);
      g.fillCircle(cx - r * 0.3, cy - r * 0.35, r * 0.38);

      var ey = cy - r * 0.05, ex = r * 0.3, er = Math.max(2, r * 0.1);
      g.fillStyle(0x1b1b2f, 1);
      g.fillCircle(cx - ex, ey, er);
      g.fillCircle(cx + ex, ey, er);
      g.lineStyle(Math.max(2, r * 0.06), 0x1b1b2f, 1);
      g.beginPath();
      g.arc(cx, ey + r * 0.12, r * 0.28, 0.2 * Math.PI, 0.8 * Math.PI, false);
      g.strokePath();

      g.generateTexture(key, s, s);
      g.destroy();
    });
  }

  var Main = new Phaser.Class({
    Extends: Phaser.Scene,

    initialize: function Main() { Phaser.Scene.call(this, { key: 'Main' }); },

    txt: function (x, y, str, size, color) {
      return this.add.text(x, y, str, {
        fontFamily: FONT, fontSize: size + 'px', color: color || '#ffffff',
        fontStyle: 'bold', resolution: 2
      });
    },

    create: function () {
      makeTextures(this);

      this.state = 'play';
      this.isPaused = false;
      this.score = 0;
      this.best = parseInt(store.get('cm_best', '0'), 10) || 0;
      this.startBest = this.best;
      this.items = new Set();
      this.queue = [];
      this.lastDrop = 0;
      this.lastMerge = 0;
      this.combo = 0;
      this.continued = false;
      this.clearReadyAt = 0;
      this.current = null;
      this.currentLv = 0;
      this.nextLv = pick();
      this.overlay = null;
      this.aimX = W / 2;

      this.drawBackground();
      this.buildWalls();
      this.buildHud();
      this.guide = this.add.graphics().setDepth(1);
      this.dangerG = this.add.graphics().setDepth(0);

      var self = this;
      this.matter.world.on('collisionstart', function (ev) {
        for (var i = 0; i < ev.pairs.length; i++) {
          var p = ev.pairs[i];
          var a = p.bodyA.gameObject, b = p.bodyB.gameObject;
          if (!a || !b || !a.isItem || !b.isItem) continue;
          if (a.level !== b.level || a.merged || b.merged) continue;
          a.merged = b.merged = true;
          self.queue.push([a, b]); // รวมใน update เพื่อไม่ลบวัตถุกลางรอบฟิสิกส์
        }
      });

      this.input.on('pointermove', function (p) { self.aim(p.worldX); });
      this.input.on('pointerdown', function (p) { sfx.unlock(); self.aim(p.worldX); });
      this.input.on('pointerup', function (p, over) {
        if (over && over.length) return; // กดโดนปุ่ม ไม่ต้องทิ้งดาว
        self.aim(p.worldX);
        self.drop();
      });

      Ads.onPause = function () { self.pauseGame(); };
      Ads.onResume = function () { self.resumeGame(); };

      var boot = document.getElementById('boot');
      if (boot) boot.remove();

      this.prepare();
    },

    // ---------- ฉาก ----------
    drawBackground: function () {
      var g = this.add.graphics().setDepth(-10);
      g.fillGradientStyle(0x0b1026, 0x0b1026, 0x1d2b64, 0x1d2b64, 1);
      g.fillRect(0, 0, W, H);
      var rnd = new Phaser.Math.RandomDataGenerator(['cosmic']);
      for (var i = 0; i < 70; i++) {
        g.fillStyle(0xffffff, rnd.realInRange(0.2, 0.8));
        g.fillCircle(rnd.between(0, W), rnd.between(0, H), rnd.realInRange(0.6, 1.8));
      }
      g.fillStyle(0x000000, 0.28);
      g.fillRoundedRect(WALL_L - 6, 100, WALL_R - WALL_L + 12, FLOOR - 100 + 10, 18);
      g.lineStyle(4, 0x6c7bd6, 0.9);
      g.strokeRoundedRect(WALL_L - 6, 100, WALL_R - WALL_L + 12, FLOOR - 100 + 10, 18);
    },

    buildWalls: function () {
      var o = { isStatic: true, friction: 0.1, restitution: 0 };
      this.matter.add.rectangle(WALL_L - 30, H / 2, 60, H * 2, o);
      this.matter.add.rectangle(WALL_R + 30, H / 2, 60, H * 2, o);
      this.matter.add.rectangle(W / 2, FLOOR + 30, W, 60, o);
    },

    buildHud: function () {
      var self = this;
      this.txt(WALL_L, 10, 'คะแนน', 16, '#8aa0ff');
      this.scoreT = this.txt(WALL_L, 28, '0', 44);
      this.txt(WALL_R, 10, 'สูงสุด', 16, '#8aa0ff').setOrigin(1, 0);
      this.bestT = this.txt(WALL_R, 28, String(this.best), 44, '#ffd43b').setOrigin(1, 0);

      this.txt(W / 2, 10, 'ถัดไป', 16, '#8aa0ff').setOrigin(0.5, 0);
      this.nextImg = this.add.image(W / 2, 66, 'lv0').setDepth(2);

      this.soundBtn = this.button(WALL_L + 26, 928, 52, 52, sfx.muted ? '🔇' : '🔊', 0x334155, function () {
        sfx.toggle();
        self.soundBtn.label.setText(sfx.muted ? '🔇' : '🔊');
      }, 26);

      this.clearBtn = this.button(W / 2 + 36, 928, 330, 56, '💥 ล้างกอง  🎬 ดูโฆษณา', 0x7c3aed, function () {
        self.onClear();
      }, 22);
    },

    button: function (x, y, w, h, label, fill, cb, size) {
      var c = this.add.container(x, y).setDepth(20);
      var g = this.add.graphics();
      g.fillStyle(fill, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
      g.lineStyle(3, 0xffffff, 0.35);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
      var t = this.txt(0, 0, label, size || 24).setOrigin(0.5);
      var hit = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
      c.add([g, t, hit]);
      hit.on('pointerdown', function () { c.setScale(0.96); });
      hit.on('pointerout', function () { c.setScale(1); });
      hit.on('pointerup', function () { c.setScale(1); sfx.unlock(); cb(); });
      c.label = t;
      return c;
    },

    toast: function (msg) {
      var t = this.txt(W / 2, H / 2 - 60, msg, 28).setOrigin(0.5).setDepth(200).setStroke('#000000', 6).setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 200 });
      this.tweens.add({ targets: t, alpha: 0, y: t.y - 40, delay: 1300, duration: 400, onComplete: function () { t.destroy(); } });
    },

    floatText: function (x, y, msg, color) {
      var t = this.txt(x, y, msg, 26, color || '#ffffff').setOrigin(0.5).setDepth(30).setStroke('#000000', 5);
      this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 800, onComplete: function () { t.destroy(); } });
    },

    ring: function (x, y, r, col) {
      var c = this.add.circle(x, y, r, col, 0.55).setDepth(5);
      this.tweens.add({ targets: c, scale: 1.7, alpha: 0, duration: 320, onComplete: function () { c.destroy(); } });
      for (var i = 0; i < 8; i++) {
        var a = (i / 8) * Math.PI * 2;
        var d = this.add.circle(x, y, 4, col, 1).setDepth(5);
        this.tweens.add({
          targets: d, x: x + Math.cos(a) * r * 1.4, y: y + Math.sin(a) * r * 1.4,
          alpha: 0, duration: 400, onComplete: function () { d.destroy(); }
        });
      }
    },

    // ---------- การเล่น ----------
    prepare: function () {
      if (this.state !== 'play') return;
      this.currentLv = this.nextLv;
      this.nextLv = pick();
      if (this.current) this.current.destroy();
      this.current = this.add.image(this.aimX, DROP_Y, 'lv' + this.currentLv).setDepth(2);
      this.aim(this.aimX);
      this.nextImg.setTexture('lv' + this.nextLv);
      var size = LEVELS[this.nextLv].r * 2 + 6;
      this.nextImg.setScale(Math.min(1, 44 / size));
    },

    aim: function (x) {
      var r = this.current ? LEVELS[this.currentLv].r : 20;
      this.aimX = Phaser.Math.Clamp(x, WALL_L + r + 3, WALL_R - r - 3);
      if (this.current) this.current.x = this.aimX;
    },

    drop: function () {
      if (this.state !== 'play' || this.isPaused || !this.current) return;
      if (this.time.now - this.lastDrop < DROP_COOLDOWN) return;
      var lv = this.currentLv;
      this.current.destroy();
      this.current = null;
      this.spawnItem(this.aimX, DROP_Y, lv);
      this.lastDrop = this.time.now;
      sfx.drop();
      this.time.delayedCall(DROP_COOLDOWN, this.prepare, [], this);
    },

    spawnItem: function (x, y, lv) {
      var s = this.matter.add.image(x, y, 'lv' + lv, null, {
        shape: { type: 'circle', radius: LEVELS[lv].r },
        restitution: 0.12, friction: 0.25, frictionAir: 0.004, density: 0.0012
      });
      s.isItem = true;
      s.level = lv;
      s.merged = false;
      s.over = 0;
      s.dropTime = this.time.now;
      s.setDepth(3);
      this.items.add(s);
      var items = this.items;
      s.once('destroy', function () { items.delete(s); });
      return s;
    },

    doMerge: function (a, b) {
      var lv = a.level;
      var x = (a.x + b.x) / 2, y = (a.y + b.y) / 2;
      var col = LEVELS[lv].c;
      a.destroy(); b.destroy();

      var now = this.time.now;
      this.combo = (now - this.lastMerge < 1000) ? this.combo + 1 : 1;
      this.lastMerge = now;

      var pts = (lv + 1) * 10 * this.combo;
      this.ring(x, y, LEVELS[lv].r, col);

      if (lv >= MAX) {
        pts += 500;
        this.floatText(x, y, '✨ ดาวสมบูรณ์! +' + pts, '#fff3bf');
        sfx.merge(MAX);
      } else {
        var n = this.spawnItem(x, y, lv + 1);
        n.dropTime = now;
        sfx.merge(lv);
        this.floatText(x, y, '+' + pts, '#ffffff');
      }
      if (this.combo >= 2) this.floatText(x, y - 36, 'Combo x' + this.combo, '#ffd43b');
      this.addScore(pts);
    },

    addScore: function (pts) {
      this.score += pts;
      this.scoreT.setText(String(this.score));
      if (this.score > this.best) {
        this.best = this.score;
        this.bestT.setText(String(this.best));
      }
    },

    clearTop: function (n) {
      var list = Array.from(this.items).sort(function (a, b) { return a.y - b.y; }).slice(0, n);
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        this.ring(it.x, it.y, LEVELS[it.level].r, LEVELS[it.level].c);
        it.destroy();
      }
    },

    onClear: function () {
      var self = this;
      if (this.state !== 'play' || this.isPaused) return;
      var wait = this.clearReadyAt - this.time.now;
      if (wait > 0) { this.toast('รออีก ' + Math.ceil(wait / 1000) + ' วินาที'); return; }
      Ads.showRewarded(function (res) {
        if (res && res.rewarded) {
          self.clearReadyAt = self.time.now + CLEAR_COOLDOWN;
          self.clearTop(CLEAR_COUNT);
        } else {
          self.toast(res && res.status === 'notReady' ? 'ตอนนี้ยังไม่มีโฆษณา ลองใหม่อีกครั้ง' : 'ดูโฆษณาไม่จบ จึงไม่ได้รับสิทธิ์');
        }
      });
    },

    pauseGame: function () {
      this.isPaused = true;
      if (this.matter && this.matter.world) this.matter.world.pause();
    },

    resumeGame: function () {
      this.isPaused = false;
      if (this.matter && this.matter.world) this.matter.world.resume();
      this.items.forEach(function (i) { i.over = 0; });
    },

    // ---------- จบเกม ----------
    gameOver: function () {
      if (this.state !== 'play') return;
      this.state = 'over';
      sfx.over();
      store.set('cm_best', String(this.best));
      if (this.current) { this.current.destroy(); this.current = null; }
      this.showOverlay();
    },

    showOverlay: function () {
      var self = this;
      var c = this.add.container(0, 0).setDepth(100);
      this.overlay = c;

      var dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72).setInteractive();
      var panel = this.add.graphics();
      panel.fillStyle(0x151d4a, 1);
      panel.fillRoundedRect(W / 2 - 220, H / 2 - 250, 440, 500, 22);
      panel.lineStyle(4, 0x6c7bd6, 1);
      panel.strokeRoundedRect(W / 2 - 220, H / 2 - 250, 440, 500, 22);
      c.add([dim, panel]);

      c.add(this.txt(W / 2, H / 2 - 195, 'จบเกม', 52).setOrigin(0.5));
      c.add(this.txt(W / 2, H / 2 - 130, 'คะแนน', 20, '#8aa0ff').setOrigin(0.5));
      c.add(this.txt(W / 2, H / 2 - 85, String(this.score), 64).setOrigin(0.5));
      var isNew = this.score > 0 && this.score > this.startBest;
      c.add(this.txt(W / 2, H / 2 - 25, isNew ? '🏆 สถิติใหม่!' : 'สูงสุด ' + this.best, 26, '#ffd43b').setOrigin(0.5));

      var y = H / 2 + 60;
      if (!this.continued) {
        c.add(this.button(W / 2, y, 360, 70, '🎬 ดูโฆษณา เล่นต่อ', 0x16a34a, function () {
          Ads.showRewarded(function (res) {
            if (res && res.rewarded) {
              self.continued = true;
              self.closeOverlay();
              self.clearTop(CONTINUE_CLEAR);
              self.state = 'play';
              self.lastDrop = self.time.now;
              self.prepare();
            } else {
              self.toast(res && res.status === 'notReady' ? 'ตอนนี้ยังไม่มีโฆษณา ลองใหม่อีกครั้ง' : 'ดูโฆษณาไม่จบ จึงไม่ได้รับสิทธิ์');
            }
          });
        }, 26));
        y += 90;
      }
      c.add(this.button(W / 2, y, 360, 70, '🔄 เล่นใหม่', 0x2563eb, function () {
        Ads.maybeInterstitial(function () { self.scene.restart(); });
      }, 26));
    },

    closeOverlay: function () {
      if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
    },

    // ---------- วนทุกเฟรม ----------
    update: function (time, delta) {
      this.guide.clear();
      this.dangerG.clear();
      if (this.state !== 'play') return;

      if (this.current) {
        var r = LEVELS[this.currentLv].r;
        this.guide.lineStyle(2, 0xffffff, 0.18);
        this.guide.lineBetween(this.aimX, DROP_Y + r, this.aimX, FLOOR);
      }

      var warn = false;
      if (!this.isPaused) {
        while (this.queue.length) {
          var pair = this.queue.shift();
          if (!pair[0].active || !pair[1].active) continue;
          this.doMerge(pair[0], pair[1]);
        }

        var over = false;
        this.items.forEach(function (it) {
          var rr = LEVELS[it.level].r;
          if (time - it.dropTime > SETTLE_MS && it.y - rr < DANGER && it.body.speed < 0.6) {
            it.over += delta;
            warn = true;
            if (it.over > OVER_MS) over = true;
          } else {
            it.over = 0;
          }
        });
        if (over) { this.gameOver(); return; }
      }

      var alpha = warn ? 0.55 + 0.45 * Math.sin(time / 110) : 0.28;
      this.dangerG.lineStyle(3, warn ? 0xff4d4d : 0xffffff, alpha);
      for (var x = WALL_L; x < WALL_R; x += 24) {
        this.dangerG.lineBetween(x, DANGER, Math.min(x + 12, WALL_R), DANGER);
      }
    }
  });

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: '#0b1026',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'matter', matter: { gravity: { y: 1.15 }, debug: false } },
    input: { activePointers: 1 },
    scene: [Main]
  });
})();
