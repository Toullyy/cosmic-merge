'use strict';

var HabitatRoom = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function HabitatRoom() {
    Phaser.Scene.call(this, { key: 'HabitatRoom' });
    this._monsterId = null;
    this._monster   = null;
    this._monImg    = null;
    this._walkTween = null;
    this._bars      = {};
    this._fpItems   = [];
    this._sellPrice = 0;
    this._W = 540; this._H = 960;
  },

  init: function(data) { this._monsterId = data.monsterId; },

  create: function() {
    sfx.unlock();
    var W = this.scale.width, H = this.scale.height;
    this._W = W; this._H = H;
    var self = this;

    this._monster = Game.state.monsters.find(function(m) { return m.id === self._monsterId; });
    if (!this._monster) { this.scene.start('Hub'); return; }

    var sp = SPECIES[this._monster.speciesId];
    this._sp = sp;
    this._sellPrice = this._calcSell(sp);

    this._drawBackground(W, H, sp.habitat);
    this._buildMonsterArea(W, H, sp);
    this._buildStats(W, H);
    this._buildActions(W, H);
    this._buildHUD(W, H, sp);
    this._startAmbient(W, H, sp.habitat);
  },

  _calcSell: function(sp) {
    var m = this._monster;
    return Math.max(10, Math.round(sp.price * (1 + m.level * 0.2) * (m.happiness / 100) * 0.8));
  },

  // ─── BACKGROUND ──────────────────────────────────────────────────────────

  _drawBackground: function(W, H, habitat) {
    var g = this.add.graphics().setDepth(0);

    if (habitat === 'dirt') {
      g.fillGradientStyle(0x3D1200, 0x3D1200, 0x180600, 0x180600, 1);
      g.fillRect(0, 0, W, H);
      // stalactites
      var stalData = [[70, 58], [160, 44], [265, 72], [370, 52], [470, 66]];
      stalData.forEach(function(s, i) {
        var col = [0x5A3015, 0x4A2810, 0x6A3A1A][i % 3];
        g.fillStyle(col, 1);
        g.fillTriangle(s[0] - s[1]/2, 0, s[0] + s[1]/2, 0, s[0], s[1] * 1.6);
        g.fillStyle(lighten(col, 15), 0.3);
        g.fillTriangle(s[0] - s[1]/4, 0, s[0], s[1] * 0.5, s[0] + s[1]/4, 0);
      });
      // ground
      g.fillStyle(0x2C1A0A, 1);
      g.fillRect(0, H * 0.70, W, H * 0.30);
      g.fillStyle(0x5D3510, 1);
      g.fillRect(0, H * 0.70, W, 7);
      g.fillStyle(0x3D2008, 1);
      g.fillRect(0, H * 0.703, W, 4);
      // rocks
      var rocks = [[55, H*0.76, 48, 28], [165, H*0.74, 38, 22], [310, H*0.77, 56, 30],
                   [430, H*0.75, 42, 26], [495, H*0.79, 34, 20]];
      rocks.forEach(function(r, i) {
        var rc = [0x4A2E10, 0x3D2408, 0x5E3C18][i % 3];
        g.fillStyle(rc, 1);
        g.fillEllipse(r[0], r[1], r[2], r[3]);
        g.fillStyle(lighten(rc, 18), 0.3);
        g.fillEllipse(r[0] - r[2]*0.12, r[1] - r[3]*0.25, r[2]*0.55, r[3]*0.45);
      });
      // crystals
      var crystals = [[28, 240, 0xFFD700], [108, 390, 0xFF8C00], [195, 510, 0xFF4500],
                      [355, 290, 0xFFD700], [440, 440, 0xE0C060], [500, 180, 0xFF8C00]];
      crystals.forEach(function(c) {
        g.fillStyle(c[2], 0.75);
        g.fillCircle(c[0], c[1], 4.5);
        g.fillStyle(c[2], 0.18);
        g.fillCircle(c[0], c[1], 11);
        g.fillStyle(0xffffff, 0.4);
        g.fillCircle(c[0] - 1.5, c[1] - 1.5, 1.5);
      });

    } else if (habitat === 'grass') {
      g.fillGradientStyle(0x082800, 0x082800, 0x194D1E, 0x194D1E, 1);
      g.fillRect(0, 0, W, H * 0.5);
      g.fillGradientStyle(0x194D1E, 0x194D1E, 0x2A7030, 0x2A7030, 1);
      g.fillRect(0, H * 0.5, W, H * 0.5);
      // far trees
      var farTrees = [[38, H*0.54, 58], [155, H*0.50, 68], [318, H*0.52, 63], [435, H*0.53, 55], [515, H*0.55, 48]];
      farTrees.forEach(function(t) {
        g.fillStyle(0x0C3810, 1);
        g.fillRect(t[0] - 5, t[1] + 10, 10, H - t[1]);
        g.fillStyle(0x0C3810, 0.85);
        g.fillCircle(t[0], t[1], t[2] * 0.48);
        g.fillCircle(t[0] - t[2]*0.26, t[1] + t[2]*0.26, t[2]*0.38);
        g.fillCircle(t[0] + t[2]*0.22, t[1] + t[2]*0.18, t[2]*0.36);
      });
      // ground
      g.fillStyle(0x2A7030, 1);
      g.fillRect(0, H * 0.70, W, H * 0.30);
      g.fillStyle(0x3D9045, 1);
      g.fillRect(0, H * 0.70, W, 8);
      g.fillStyle(0x4CAF50, 0.4);
      g.fillRect(0, H * 0.703, W, 4);
      // grass tufts
      for (var gi = 0; gi < 9; gi++) {
        var gx = 28 + gi * 58;
        var gy = H * 0.702;
        g.fillStyle(0x4CAF50, 1);
        g.fillTriangle(gx, gy, gx - 6, gy + 16, gx + 6, gy + 16);
        g.fillTriangle(gx + 10, gy + 3, gx + 4, gy + 17, gx + 16, gy + 17);
        g.fillStyle(0x66BB6A, 0.7);
        g.fillTriangle(gx + 2, gy - 3, gx - 2, gy + 10, gx + 6, gy + 10);
      }
      // flowers
      var flowers = [[75, H*0.755, 0xFF9800], [195, H*0.745, 0xFFEB3B],
                     [325, H*0.760, 0xFF5722], [448, H*0.750, 0xE91E63]];
      flowers.forEach(function(fl) {
        g.fillStyle(fl[2], 1);
        for (var pi = 0; pi < 5; pi++) {
          var pa = (pi / 5) * Math.PI * 2;
          g.fillCircle(fl[0] + Math.cos(pa) * 5, fl[1] + Math.sin(pa) * 5, 4);
        }
        g.fillStyle(0xFFFDE7, 1);
        g.fillCircle(fl[0], fl[1], 3.5);
      });

    } else { // aquatic
      g.fillGradientStyle(0x00537A, 0x00537A, 0x001833, 0x001833, 1);
      g.fillRect(0, 0, W, H);
      // caustic light rays
      for (var ri = 0; ri < 7; ri++) {
        var rx = 20 + ri * 78;
        g.fillStyle(0x4FC3F7, 0.035);
        g.fillTriangle(rx, 0, rx + 18, 0, rx + 55, H * 0.62);
        g.fillStyle(0x81D4FA, 0.025);
        g.fillTriangle(rx + 8, 0, rx + 24, 0, rx + 20, H * 0.48);
      }
      // sandy floor
      g.fillStyle(0xC2A05C, 1);
      g.fillRect(0, H * 0.72, W, H * 0.28);
      g.fillStyle(0xD4B483, 1);
      g.fillRect(0, H * 0.72, W, 9);
      g.fillStyle(0xE0C898, 0.35);
      g.fillRect(0, H * 0.724, W, 4);
      // pebbles
      var pebbles = [[48, H*0.74], [118, H*0.72], [202, H*0.745], [298, H*0.73],
                     [385, H*0.74], [458, H*0.72], [505, H*0.745]];
      pebbles.forEach(function(pb, i) {
        var pc = [0xA08060, 0x8B7355, 0xC4A882][i % 3];
        g.fillStyle(pc, 1);
        g.fillEllipse(pb[0], pb[1], 18, 11);
        g.fillStyle(lighten(pc, 20), 0.35);
        g.fillEllipse(pb[0] - 3, pb[1] - 2, 8, 5);
      });
      // coral
      var corals = [[88, H*0.695, 0xFF5252], [245, H*0.705, 0xFF9800],
                    [375, H*0.690, 0xE91E63], [490, H*0.700, 0x7C4DFF]];
      corals.forEach(function(cr) {
        g.fillStyle(cr[2], 1);
        g.fillRect(cr[0] - 4, cr[1], 8, 44);
        g.fillCircle(cr[0], cr[1], 15);
        g.fillCircle(cr[0] - 11, cr[1] + 9, 11);
        g.fillCircle(cr[0] + 11, cr[1] + 11, 12);
        g.fillStyle(lighten(cr[2], 35), 0.45);
        g.fillCircle(cr[0] - 4, cr[1] - 5, 6);
      });
      // seaweed (using lineTo segments)
      for (var swi = 0; swi < 5; swi++) {
        var swx = 28 + swi * 108;
        var swBase = H * 0.72;
        g.lineStyle(4, 0x1B5E20, 0.8);
        g.beginPath();
        g.moveTo(swx, swBase);
        g.lineTo(swx + 13, swBase - 52);
        g.lineTo(swx - 7, swBase - 105);
        g.lineTo(swx + 11, swBase - 155);
        g.strokePath();
        g.lineStyle(3, 0x388E3C, 0.55);
        g.beginPath();
        g.moveTo(swx + 18, swBase - 8);
        g.lineTo(swx + 7, swBase - 65);
        g.lineTo(swx + 20, swBase - 115);
        g.strokePath();
      }
    }
  },

  // ─── MONSTER AREA ────────────────────────────────────────────────────────

  _buildMonsterArea: function(W, H, sp) {
    var self = this;
    var groundY = H * 0.70;
    var monY    = groundY - 78;
    var leftX   = 112, rightX = W - 112;

    // shadow ellipse under monster (static, centered)
    var shadowG = this.add.graphics().setDepth(4);
    shadowG.fillStyle(0x000000, 0.22);
    shadowG.fillEllipse(W / 2, groundY - 2, 115, 22);

    var texKey = makeMonsterTexture(this, this._monster);
    this._monImg = this.add.image(leftX, monY, texKey)
      .setDisplaySize(152, 152)
      .setDepth(5);

    // walking tween
    this._walkTween = this.tweens.add({
      targets:  this._monImg,
      x:        rightX,
      duration: 3200,
      ease:     'Sine.InOut',
      yoyo:     true,
      repeat:   -1,
      onYoyo:   function() { self._monImg.setFlipX(true); },
      onRepeat: function() { self._monImg.setFlipX(false); }
    });

    // idle bob tween
    this.tweens.add({
      targets:  this._monImg,
      y:        monY - 9,
      duration: 950,
      ease:     'Sine.InOut',
      yoyo:     true,
      repeat:   -1
    });

    this._monY = monY;
  },

  // ─── STATS BARS ──────────────────────────────────────────────────────────

  _buildStats: function(W, H) {
    var self = this;
    var statsY = H * 0.72 + 18;
    var defs = [
      { key: 'hunger',      label: '🍖', col: 0xF57C00 },
      { key: 'happiness',   label: '💛', col: 0xFDD835 },
      { key: 'cleanliness', label: '✨', col: 0x42A5F5 }
    ];
    var barW = W - 100;
    this._bars = {};

    defs.forEach(function(d, i) {
      var by = statsY + i * 46;
      self.add.text(28, by, d.label, {
        fontFamily: FONT, fontSize: '20px'
      }).setOrigin(0, 0.5).setDepth(10);

      var bg = self.add.graphics().setDepth(10);
      bg.fillStyle(0x00000066, 1);
      bg.fillRoundedRect(58, by - 10, barW, 20, 10);

      var fill = self.add.graphics().setDepth(11);
      var val  = self.add.text(W - 26, by, '0', {
        fontFamily: FONT, fontSize: '13px', color: '#cccccc'
      }).setOrigin(1, 0.5).setDepth(12);

      self._bars[d.key] = {
        fill: fill, col: d.col,
        bx: 58, by: by - 10, bw: barW, val: val
      };
    });

    this._refreshStats();
  },

  _refreshStats: function() {
    var m = this._monster;
    var keys = ['hunger', 'happiness', 'cleanliness'];
    keys.forEach(function(k) {
      var e = this._bars[k];
      if (!e) return;
      var pct = Math.max(0, Math.min(1, m[k] / 100));
      e.fill.clear();
      e.fill.fillStyle(e.col, 1);
      e.fill.fillRoundedRect(e.bx, e.by, Math.max(16, e.bw * pct), 20, 10);
      e.val.setText(Math.round(m[k]));
    }, this);
  },

  // ─── ACTION BUTTONS ──────────────────────────────────────────────────────

  _buildActions: function(W, H) {
    var self = this;
    var btnY = H - 58;
    var sp = 148;
    makeButton(this, W/2 - sp, btnY, 128, 52, '🍽 Feed', 0x8B2200, function() {
      self._showFoodPicker();
    }, 16).setDepth(10);
    makeButton(this, W/2, btnY, 128, 52, '💆 Pet', 0x6A2090, function() {
      self._doPet();
    }, 16).setDepth(10);
    makeButton(this, W/2 + sp, btnY, 128, 52, '🧹 Clean', 0x1A5580, function() {
      self._doClean();
    }, 16).setDepth(10);
  },

  // ─── HUD ─────────────────────────────────────────────────────────────────

  _buildHUD: function(W, H, sp) {
    var self = this;
    var mods = getVariantModifiers(this._monster.variantIndex);

    makeButton(this, 56, 34, 92, 44, '← Back', 0x1a0a2e, function() {
      self.scene.start('Hub');
    }, 15).setDepth(20);

    this.add.text(W / 2, 24, sp.name + (mods.isGolden ? ' ★' : ''), {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold',
      color: mods.isGolden ? '#FFD700' : '#ffffff',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5, 0.5).setDepth(20);

    this.add.text(W / 2, 50, 'Lv ' + this._monster.level + '  ·  ' +
      sp.habitat.charAt(0).toUpperCase() + sp.habitat.slice(1), {
      fontFamily: FONT, fontSize: '13px', color: '#9999bb'
    }).setOrigin(0.5).setDepth(20);

    this._sellBtn = makeButton(this, W - 72, 34, 116, 44,
      '💰 ' + this._sellPrice + '⬡', 0x1A5030, function() {
        self._doSell();
      }, 14);
    this._sellBtn.setDepth(20);

    this._coinTxt = this.add.text(W / 2, H * 0.72 + 5, '⬡ ' + Game.state.coins, {
      fontFamily: FONT, fontSize: '15px', color: '#FFD700'
    }).setOrigin(0.5).setDepth(20);
  },

  // ─── FOOD PICKER ─────────────────────────────────────────────────────────

  _showFoodPicker: function() {
    var self = this;
    if (this._fpItems.length > 0) { this._clearFoodPicker(); return; }
    var W = this._W, H = this._H;
    var fpW = W - 30, fpH = 130;
    var fpX = 15, fpY = H - 202;

    var fpBg = this.add.graphics().setDepth(28);
    fpBg.fillStyle(0x0a0416, 0.96);
    fpBg.fillRoundedRect(fpX, fpY, fpW, fpH, 14);
    fpBg.lineStyle(1, 0x5040b0, 0.9);
    fpBg.strokeRoundedRect(fpX, fpY, fpW, fpH, 14);
    this._fpItems.push(fpBg);

    var btnW = Math.floor((fpW - 24) / 3);
    FOOD_TYPES.forEach(function(food, i) {
      var bx = fpX + 12 + i * (btnW + 4) + btnW / 2;
      var by = fpY + fpH / 2 + 4;
      var canAfford = Game.state.coins >= food.cost;
      var lbl = food.name + '\n+' + food.hungerGain + '🍖  +' + food.happinessGain + '💛\n' + food.cost + '⬡';
      var fbtn = makeButton(self, bx, by, btnW - 2, fpH - 20, lbl,
        canAfford ? 0x2A4A18 : 0x1A1A2A, function() {
          if (Game.state.coins < food.cost) {
            showToast(self, 'Not enough coins!', '#ff9999');
            return;
          }
          Game.state.coins -= food.cost;
          self._monster.hunger    = Math.min(100, self._monster.hunger    + food.hungerGain);
          self._monster.happiness = Math.min(100, self._monster.happiness + food.happinessGain);
          self._monster.lastCaredAt = Date.now();
          self._gainXP(10);
          store.setJSON('mps_state', Game.state);
          sfx.feed();
          self._spawnParticles(self._monImg.x, self._monImg.y - 30, 0xFFAA00, 10);
          showFloat(self, self._monImg.x, self._monImg.y - 85, '+' + food.hungerGain + ' 🍖', '#ffcc44');
          self._refreshStats();
          self._updateCoinDisplay();
          self._clearFoodPicker();
        }, 12);
      fbtn.setDepth(29);
      self._fpItems.push(fbtn);
    });
  },

  _clearFoodPicker: function() {
    this._fpItems.forEach(function(o) { try { o.destroy(); } catch (e) {} });
    this._fpItems = [];
  },

  // ─── CARE ACTIONS ────────────────────────────────────────────────────────

  _doPet: function() {
    this._monster.happiness   = Math.min(100, this._monster.happiness + 8);
    this._monster.lastCaredAt = Date.now();
    this._gainXP(5);
    store.setJSON('mps_state', Game.state);
    sfx.pet();
    this._spawnParticles(this._monImg.x, this._monImg.y - 40, 0xFF88DD, 8);
    showFloat(this, this._monImg.x, this._monImg.y - 85, '+8 💛', '#ffdd55');
    this._refreshStats();
  },

  _doClean: function() {
    this._monster.cleanliness = Math.min(100, this._monster.cleanliness + 25);
    this._monster.lastCaredAt = Date.now();
    this._gainXP(5);
    store.setJSON('mps_state', Game.state);
    sfx.clean();
    this._spawnParticles(this._monImg.x, this._monImg.y - 40, 0x88CCFF, 9);
    showFloat(this, this._monImg.x, this._monImg.y - 85, '+25 ✨', '#88ccff');
    this._refreshStats();
  },

  _doSell: function() {
    var self = this;
    var price = this._sellPrice;
    Game.state.coins += price;
    Game.state.monsters = Game.state.monsters.filter(function(m) { return m.id !== self._monster.id; });
    Game.state.stats.sold++;
    Game.state.stats.totalEarned += price;
    store.setJSON('mps_state', Game.state);
    sfx.sell();
    this._spawnParticles(this._W / 2, this._H / 2 - 80, 0xFFD700, 22);
    showFloat(this, this._W / 2, this._H / 2 - 120, '+' + price + ' ⬡', '#ffd700');
    this.time.delayedCall(950, function() { self.scene.start('Hub'); });
  },

  // ─── XP + LEVEL UP ───────────────────────────────────────────────────────

  _gainXP: function(amount) {
    var m = this._monster;
    m.xp = (m.xp || 0) + amount;
    if (m.level < 10) {
      var needed = XP_TABLE[m.level] || 9999;
      if (m.xp >= needed) {
        m.xp -= needed;
        m.level = Math.min(10, m.level + 1);
        sfx.levelup();
        this._spawnParticles(this._monImg.x, this._monImg.y, 0xFFD700, 24);
        this._spawnParticles(this._monImg.x, this._monImg.y, 0xFFFFFF, 12);
        showToast(this, SPECIES[m.speciesId].name + ' leveled up! Lv ' + m.level + ' 🎉', '#FFD700');
        this._sellPrice = this._calcSell(this._sp);
      }
    }
  },

  // ─── PARTICLES ───────────────────────────────────────────────────────────

  _spawnParticles: function(x, y, color, count) {
    var self = this;
    for (var i = 0; i < count; i++) {
      var angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      var speed = 45 + Math.random() * 85;
      var pg = self.add.graphics().setDepth(32);
      var pr = 3 + Math.random() * 4;
      pg.fillStyle(color, 1);
      pg.fillCircle(0, 0, pr);
      pg.x = x; pg.y = y;
      self.tweens.add({
        targets:  pg,
        x:        x + Math.cos(angle) * speed,
        y:        y + Math.sin(angle) * speed - 22,
        alpha:    0,
        scaleX:   0.2,
        scaleY:   0.2,
        duration: 400 + Math.random() * 300,
        ease:     'Cubic.Out',
        onComplete: function(tw, tg) { try { tg[0].destroy(); } catch (e) {} }
      });
    }
  },

  // ─── AMBIENT ─────────────────────────────────────────────────────────────

  _startAmbient: function(W, H, habitat) {
    if (habitat !== 'aquatic') return;
    var self = this;
    function spawnBubble() {
      if (!self.scene || !self.scene.isActive('HabitatRoom')) return;
      var bx = 18 + Math.random() * (W - 36);
      var br = 2 + Math.random() * 5;
      var bg = self.add.graphics().setDepth(3);
      bg.lineStyle(1.5, 0x4FC3F7, 0.65);
      bg.strokeCircle(0, 0, br);
      bg.x = bx; bg.y = H * 0.70;
      self.tweens.add({
        targets:  bg,
        y:        bg.y - (180 + Math.random() * 260),
        alpha:    0,
        duration: 1800 + Math.random() * 2000,
        ease:     'Linear',
        onComplete: function(tw, tg) { try { tg[0].destroy(); } catch (e) {} }
      });
    }
    this.time.addEvent({ delay: 420, loop: true, callback: spawnBubble });
    for (var i = 0; i < 5; i++) spawnBubble();
  },

  // ─── UTILS ───────────────────────────────────────────────────────────────

  _updateCoinDisplay: function() {
    if (this._coinTxt) this._coinTxt.setText('⬡ ' + Game.state.coins);
  }
});
