'use strict';

var Hub = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function Hub() {
    Phaser.Scene.call(this, { key: 'Hub' });
    this._currentHabitat = 'dirt';
    this._eggTimer = null;
    this._displayGroup = null;
    this._tabBtns = {};
    this._coinTxt = null;
    this._bgGraphics = null;
    this._bobTweens = [];
  },

  create: function() {
    sfx.unlock();
    var W = this.scale.width, H = this.scale.height;
    this._displayGroup = this.add.group();

    this._buildBackground(W, H);
    this._buildHUD(W);
    this._buildTabs(W);
    this._buildBottomNav(W, H);
    this._bgGraphics = this.add.graphics().setDepth(1);
    this._buildHabitatBg(W, H);
    this.refreshAll();
    this._startEggTimer();

    document.getElementById('boot').style.display = 'none';
  },

  _buildBackground: function(W, H) {
    var bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x1a0a2e, 0x1a0a2e, 0x0a0420, 0x0a0420, 1);
    bg.fillRect(0, 0, W, H);
    // subtle star field
    bg.fillStyle(0xffffff, 0.25);
    var stars = [[42,140],[95,310],[140,520],[188,88],[220,680],[270,200],[310,450],[355,130],
                 [400,580],[448,260],[490,380],[520,100],[55,720],[135,800],[310,750],[460,810]];
    for (var i = 0; i < stars.length; i++) {
      bg.fillCircle(stars[i][0], stars[i][1], i % 3 === 0 ? 1.5 : 1);
    }
  },

  _buildHabitatBg: function(W, H) {
    var g = this._bgGraphics;
    g.clear();
    var hCfg = HABITATS[this._currentHabitat];
    // outer glow
    g.fillStyle(hCfg.wallColor, 0.08);
    g.fillRoundedRect(6, 128, W - 12, H - 230, 18);
    // main bg
    g.fillStyle(hCfg.bgColor, 0.5);
    g.fillRoundedRect(10, 132, W - 20, H - 238, 14);
    g.lineStyle(2, hCfg.wallColor, 0.65);
    g.strokeRoundedRect(10, 132, W - 20, H - 238, 14);
  },

  _buildHUD: function(W) {
    var coinBg = this.add.graphics().setDepth(10);
    coinBg.fillStyle(0x00000077, 1);
    coinBg.fillRoundedRect(10, 10, 166, 44, 12);
    coinBg.lineStyle(1, 0xffd700, 0.3);
    coinBg.strokeRoundedRect(10, 10, 166, 44, 12);
    this.add.text(30, 32, '⬡', { fontFamily: FONT, fontSize: '22px', color: '#FFD700' }).setOrigin(0, 0.5).setDepth(11);
    this._coinTxt = this.add.text(58, 32, String(Game.state.coins), {
      fontFamily: FONT, fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(11);

    var self = this;
    var sndTxt = this.add.text(W - 16, 32, sfx.muted ? '🔇' : '🔊', {
      fontFamily: FONT, fontSize: '22px', color: '#cccccc'
    }).setOrigin(1, 0.5).setDepth(11).setInteractive({ useHandCursor: true });
    sndTxt.on('pointerdown', function() {
      sfx.toggle(); sndTxt.setText(sfx.muted ? '🔇' : '🔊');
    });
  },

  _buildTabs: function(W) {
    var types = ['dirt', 'grass', 'aquatic'];
    var labels = { dirt: '🪨 Dirt', grass: '🌿 Grass', aquatic: '🌊 Aqua' };
    var self = this;
    var tabW = (W - 20) / 3;
    types.forEach(function(type, i) {
      var x = 10 + tabW * i;
      var unlocked = Game.state.habitats[type].unlocked;
      var isActive = type === self._currentHabitat;
      var tabBg = self.add.graphics().setDepth(5);
      self._drawTab(tabBg, x, 76, tabW, 50, isActive, unlocked);
      var lbl = unlocked ? labels[type] : (labels[type] + ' 🔒');
      var tabTxt = self.add.text(x + tabW/2, 101, lbl, {
        fontFamily: FONT, fontSize: '15px',
        color: isActive ? '#ffffff' : (unlocked ? '#aaaaaa' : '#555555')
      }).setOrigin(0.5).setDepth(6);
      self._tabBtns[type] = { bg: tabBg, txt: tabTxt };

      var zone = self.add.zone(x + tabW/2, 101, tabW - 4, 46).setInteractive().setDepth(7);
      zone.on('pointerdown', function() {
        if (!Game.state.habitats[type].unlocked) { self._tryUnlockHabitat(type); return; }
        self._currentHabitat = type;
        self._buildHabitatBg(self.scale.width, self.scale.height);
        self._updateTabs();
        self.refreshAll();
      });
    });
  },

  _drawTab: function(g, x, y, w, h, active, unlocked) {
    g.clear();
    g.fillStyle(active ? 0x4a2080 : (unlocked ? 0x1e1040 : 0x110825), active ? 1 : 0.7);
    g.fillRoundedRect(x + 2, y, w - 4, h, { tl: 10, tr: 10, bl: 0, br: 0 });
    if (active) {
      g.lineStyle(2, 0x9060ff, 1);
      g.strokeRoundedRect(x + 2, y, w - 4, h, { tl: 10, tr: 10, bl: 0, br: 0 });
    }
  },

  _updateTabs: function() {
    var self = this;
    var types = ['dirt', 'grass', 'aquatic'];
    var labels = { dirt: '🪨 Dirt', grass: '🌿 Grass', aquatic: '🌊 Aqua' };
    var W = this.scale.width, tabW = (W - 20) / 3;
    types.forEach(function(type, i) {
      var x = 10 + tabW * i;
      var btn = self._tabBtns[type];
      var isActive = type === self._currentHabitat;
      var unlocked = Game.state.habitats[type].unlocked;
      self._drawTab(btn.bg, x, 76, tabW, 50, isActive, unlocked);
      btn.txt.setStyle({ color: isActive ? '#ffffff' : (unlocked ? '#aaaaaa' : '#555555') });
      var lbl = unlocked ? labels[type] : (labels[type] + ' 🔒');
      btn.txt.setText(lbl);
    });
  },

  _buildBottomNav: function(W, H) {
    var self = this;
    var btnY = H - 54;
    makeButton(this, W/2 - 100, btnY, 180, 52, '🛒 Shop', 0x2a1560, function() {
      Ads.maybeInterstitial(function() { self.scene.start('Merchant'); });
    }, 17).setDepth(10);
    makeButton(this, W/2 + 100, btnY, 180, 52, '🧬 Breed', 0x1a3060, function() {
      var eligible = Game.state.monsters.filter(function(m) { return m.level >= 4; });
      if (eligible.length < 2) {
        showToast(self, 'Need 2 monsters at Level 4+', '#ff9999');
      } else {
        Ads.maybeInterstitial(function() { self.scene.start('BreedingLab'); });
      }
    }, 17).setDepth(10);
  },

  _tryUnlockHabitat: function(type) {
    var cost = HABITATS[type].unlockCost;
    if (Game.state.coins < cost) {
      showToast(this, 'Need ' + cost + '⬡ to unlock ' + HABITATS[type].label, '#ff9999');
      return;
    }
    Game.state.coins -= cost;
    Game.state.habitats[type].unlocked = true;
    store.setJSON('mps_state', Game.state);
    this._updateCoinDisplay();
    this._updateTabs();
    showToast(this, HABITATS[type].label + ' unlocked!', '#aaffaa');
  },

  refreshAll: function() {
    this._bobTweens.forEach(function(t) { try { t.stop(); } catch (e) {} });
    this._bobTweens = [];
    this._displayGroup.clear(true, true);
    var W = this.scale.width;
    var self = this;
    var monsters = Game.state.monsters.filter(function(m) { return m.habitatType === self._currentHabitat; });
    var eggs     = Game.state.eggs.filter(function(e) { return e.habitatType === self._currentHabitat; });

    if (monsters.length === 0 && eggs.length === 0) {
      var emptyTxt = this.add.text(W/2, 460, 'No monsters here yet!', {
        fontFamily: FONT, fontSize: '18px', color: '#7060a0', align: 'center'
      }).setOrigin(0.5).setDepth(20);
      this._displayGroup.add(emptyTxt);
      var shopBtn = makeButton(this, W/2, 520, 200, 50, '🛒 Go to Shop', 0x2a1560, function() {
        Ads.maybeInterstitial(function() { self.scene.start('Merchant'); });
      }, 16).setDepth(20);
      this._displayGroup.add(shopBtn);
      return;
    }

    var slots = this._getSlotPositions(W);
    var idx = 0;

    eggs.forEach(function(egg) {
      if (idx >= slots.length) return;
      self._drawEggTerrarium(slots[idx].x, slots[idx].y, egg);
      idx++;
    });
    monsters.forEach(function(mon) {
      if (idx >= slots.length) return;
      self._drawTerrarium(slots[idx].x, slots[idx].y, mon);
      idx++;
    });
  },

  _getSlotPositions: function(W) {
    var col1 = W / 4, col2 = W * 3 / 4;
    var startY = 232, spacing = 210;
    return [
      { x: col1, y: startY },
      { x: col2, y: startY },
      { x: col1, y: startY + spacing },
      { x: col2, y: startY + spacing },
      { x: col1, y: startY + spacing * 2 },
      { x: col2, y: startY + spacing * 2 }
    ];
  },

  _drawTerrarium: function(cx, cy, mon) {
    var CW = 234, CH = 196, innerH = CH - 50;
    var sp = SPECIES[mon.speciesId];
    var hCfg = HABITATS[sp.habitat];
    var mods = getVariantModifiers(mon.variantIndex);
    var self = this;

    // outer shadow
    var shadow = this.add.graphics().setDepth(19);
    shadow.fillStyle(0x000000, 0.22);
    shadow.fillRoundedRect(cx - CW/2 + 4, cy - CH/2 + 6, CW, CH, 16);
    this._displayGroup.add(shadow);

    // outer frame
    var frame = this.add.graphics().setDepth(20);
    frame.fillStyle(darken(hCfg.wallColor, 30), 0.55);
    frame.fillRoundedRect(cx - CW/2, cy - CH/2, CW, CH, 16);
    frame.lineStyle(2, hCfg.wallColor, 0.85);
    frame.strokeRoundedRect(cx - CW/2, cy - CH/2, CW, CH, 16);
    this._displayGroup.add(frame);

    // inner habitat area
    var inX = cx - CW/2 + 7, inY = cy - CH/2 + 7;
    var inW = CW - 14;
    var innerBg = this.add.graphics().setDepth(21);
    innerBg.fillStyle(hCfg.bgColor, 0.65);
    innerBg.fillRoundedRect(inX, inY, inW, innerH, 11);
    this._displayGroup.add(innerBg);

    // glass highlight corner
    var glass = this.add.graphics().setDepth(24);
    glass.fillStyle(0xffffff, 0.09);
    glass.fillRoundedRect(inX, inY, inW / 2.6, innerH / 2.8, 9);
    glass.lineStyle(1, 0xffffff, 0.14);
    glass.strokeRoundedRect(inX, inY, inW / 2.6, innerH / 2.8, 9);
    this._displayGroup.add(glass);

    // monster image
    var innerCY = inY + innerH / 2;
    var texKey = makeMonsterTexture(this, mon);
    var img = this.add.image(cx, innerCY + 3, texKey).setDisplaySize(86, 86).setDepth(22);
    this._displayGroup.add(img);
    var tween = this.tweens.add({
      targets: img, y: img.y - 5,
      duration: 1100 + Math.random() * 400, ease: 'Sine.InOut', yoyo: true, repeat: -1
    });
    this._bobTweens.push(tween);

    // level badge
    var lvlBadge = this.add.graphics().setDepth(23);
    lvlBadge.fillStyle(0x000000, 0.75);
    lvlBadge.fillRoundedRect(cx + CW/2 - 47, inY + 4, 40, 22, 8);
    this._displayGroup.add(lvlBadge);
    var lvlTxt = this.add.text(cx + CW/2 - 27, inY + 15, 'Lv' + mon.level, {
      fontFamily: FONT, fontSize: '12px', color: '#ffdd55', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(24);
    this._displayGroup.add(lvlTxt);

    // golden star
    if (mods.isGolden) {
      var starTxt = this.add.text(inX + 6, inY + 6, '★', {
        fontFamily: FONT, fontSize: '14px', color: '#FFD700'
      }).setOrigin(0).setDepth(24);
      this._displayGroup.add(starTxt);
    }

    // bottom info strip
    var btmY = cy + CH/2 - 40;
    var nameTxt = this.add.text(cx, btmY + 8, sp.name, {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#ffffff'
    }).setOrigin(0.5).setDepth(22);
    this._displayGroup.add(nameTxt);

    // happiness mini bar
    var pct = Math.max(0, Math.min(1, mon.happiness / 100));
    var barColor = mon.happiness > 66 ? 0x44cc88 : mon.happiness > 33 ? 0xffcc44 : 0xff5555;
    var barW = CW - 32;
    var barBg = this.add.graphics().setDepth(22);
    barBg.fillStyle(0x00000055, 1);
    barBg.fillRoundedRect(cx - barW/2, btmY + 25, barW, 8, 4);
    var barFill = this.add.graphics().setDepth(23);
    barFill.fillStyle(barColor, 1);
    barFill.fillRoundedRect(cx - barW/2, btmY + 25, Math.max(8, barW * pct), 8, 4);
    this._displayGroup.add(barBg);
    this._displayGroup.add(barFill);

    // tap → HabitatRoom
    var zone = this.add.zone(cx, cy, CW, CH).setInteractive().setDepth(25);
    zone.on('pointerdown', function() {
      sfx.unlock();
      var freshMon = Game.state.monsters.find(function(m) { return m.id === mon.id; });
      if (freshMon) self.scene.start('HabitatRoom', { monsterId: freshMon.id });
    });
    this._displayGroup.add(zone);
  },

  _drawEggTerrarium: function(cx, cy, egg) {
    var CW = 234, CH = 196, innerH = CH - 50;
    var sp = SPECIES[egg.speciesId];
    var hCfg = HABITATS[sp.habitat];
    var mods = getVariantModifiers(egg.variantIndex);
    var self = this;
    var now = Date.now();
    var isReady = now >= egg.hatchEndAt;
    var eggColor = shiftHue(sp.baseColor, mods.hueShift);

    // outer shadow
    var shadow = this.add.graphics().setDepth(19);
    shadow.fillStyle(0x000000, 0.22);
    shadow.fillRoundedRect(cx - CW/2 + 4, cy - CH/2 + 6, CW, CH, 16);
    this._displayGroup.add(shadow);

    // outer frame
    var frameColor = isReady ? 0x88ff88 : hCfg.wallColor;
    var frame = this.add.graphics().setDepth(20);
    frame.fillStyle(darken(frameColor, 30), 0.5);
    frame.fillRoundedRect(cx - CW/2, cy - CH/2, CW, CH, 16);
    frame.lineStyle(isReady ? 3 : 2, frameColor, isReady ? 1 : 0.75);
    frame.strokeRoundedRect(cx - CW/2, cy - CH/2, CW, CH, 16);
    this._displayGroup.add(frame);

    // inner area
    var inX = cx - CW/2 + 7, inY = cy - CH/2 + 7, inW = CW - 14;
    var innerBg = this.add.graphics().setDepth(21);
    innerBg.fillStyle(hCfg.bgColor, 0.55);
    innerBg.fillRoundedRect(inX, inY, inW, innerH, 11);
    this._displayGroup.add(innerBg);

    // glass highlight
    var glass = this.add.graphics().setDepth(24);
    glass.fillStyle(0xffffff, 0.08);
    glass.fillRoundedRect(inX, inY, inW / 2.6, innerH / 2.8, 9);
    this._displayGroup.add(glass);

    // egg drawing
    var innerCY = inY + innerH / 2;
    var eggG = this.add.graphics().setDepth(22);
    eggG.fillStyle(darken(eggColor, 18), 1);
    eggG.fillEllipse(cx + 2, innerCY + 4, 50, 62);
    eggG.fillStyle(eggColor, 1);
    eggG.fillEllipse(cx, innerCY, 50, 62);
    eggG.fillStyle(lighten(eggColor, 40), 0.4);
    eggG.fillEllipse(cx - 8, innerCY - 14, 16, 24);
    if (isReady) {
      eggG.lineStyle(2, darken(eggColor, 80), 1);
      eggG.beginPath();
      eggG.moveTo(cx - 4, innerCY - 20);
      eggG.lineTo(cx + 5, innerCY - 5);
      eggG.lineTo(cx - 2, innerCY + 7);
      eggG.strokePath();
      eggG.beginPath();
      eggG.moveTo(cx + 6, innerCY - 16);
      eggG.lineTo(cx - 2, innerCY - 8);
      eggG.strokePath();
    }
    this._displayGroup.add(eggG);

    var tween = this.tweens.add({
      targets: eggG, y: isReady ? -4 : -3,
      duration: isReady ? 550 : 1400, ease: 'Sine.InOut', yoyo: true, repeat: -1
    });
    this._bobTweens.push(tween);

    // bottom info
    var btmY = cy + CH/2 - 40;
    var nameTxt = this.add.text(cx, btmY + 6, sp.name, {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold',
      color: isReady ? '#aaffaa' : '#ccccdd'
    }).setOrigin(0.5).setDepth(22);
    this._displayGroup.add(nameTxt);

    var remaining = Math.max(0, egg.hatchEndAt - now);
    var timerTxt = this.add.text(cx, btmY + 24, isReady ? '✨ Tap to hatch!' : this._formatMs(remaining), {
      fontFamily: FONT, fontSize: '12px',
      color: isReady ? '#aaffaa' : '#9999cc', align: 'center'
    }).setOrigin(0.5).setDepth(22);
    timerTxt._eggId = egg.id;
    this._displayGroup.add(timerTxt);

    // tap zone
    var zone = this.add.zone(cx, cy, CW, CH).setInteractive().setDepth(25);
    zone.on('pointerdown', function() {
      var refreshedEgg = Game.state.eggs.find(function(e) { return e.id === egg.id; });
      if (!refreshedEgg) return;
      if (Date.now() >= refreshedEgg.hatchEndAt) {
        self.scene.launch('HatchScene', { eggId: refreshedEgg.id });
      } else {
        showToast(self, sp.name + ' is still incubating… ⏳', '#aabbff');
      }
    });
    this._displayGroup.add(zone);
  },

  _startEggTimer: function() {
    var self = this;
    if (this._eggTimer) this._eggTimer.remove();
    this._eggTimer = this.time.addEvent({
      delay: 1000, loop: true, callback: function() { self._updateEggTimers(); }
    });
  },

  _updateEggTimers: function() {
    var now = Date.now();
    this._displayGroup.getChildren().forEach(function(child) {
      if (!child._eggId) return;
      var egg = Game.state.eggs.find(function(e) { return e.id === child._eggId; });
      if (!egg) return;
      var remaining = Math.max(0, egg.hatchEndAt - now);
      child.setText(remaining <= 0 ? '✨ Ready!' : this._formatMs(remaining));
      child.setStyle({ color: remaining <= 0 ? '#aaffaa' : '#9999cc' });
    }, this);
  },

  _formatMs: function(ms) {
    if (ms <= 0) return '✨ Ready!';
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + sec + 's';
    return sec + 's';
  },

  _updateCoinDisplay: function() {
    if (this._coinTxt) this._coinTxt.setText(String(Game.state.coins));
  },

  updateCoins: function() { this._updateCoinDisplay(); },

  onEggHatched: function(eggId, monster) {
    Game.state.eggs = Game.state.eggs.filter(function(e) { return e.id !== eggId; });
    Game.state.monsters.push(monster);
    Game.state.stats.hatched++;
    store.setJSON('mps_state', Game.state);
    this._updateCoinDisplay();
    this.refreshAll();
  }
});
