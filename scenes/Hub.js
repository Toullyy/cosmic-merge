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
    bg.fillGradientStyle(0x1a0a2e, 0x1a0a2e, 0x0d0618, 0x0d0618, 1);
    bg.fillRect(0, 0, W, H);
  },

  _buildHabitatBg: function(W, H) {
    var g = this._bgGraphics;
    g.clear();
    var hCfg = HABITATS[this._currentHabitat];
    g.fillStyle(hCfg.bgColor, 0.55);
    g.fillRoundedRect(10, 130, W - 20, H - 235, 16);
    g.lineStyle(2, hCfg.wallColor, 0.7);
    g.strokeRoundedRect(10, 130, W - 20, H - 235, 16);
  },

  _buildHUD: function(W) {
    // coins
    var coinBg = this.add.graphics().setDepth(10);
    coinBg.fillStyle(0x00000066, 1);
    coinBg.fillRoundedRect(10, 10, 160, 44, 10);
    this.add.text(28, 32, '⬡', { fontFamily: FONT, fontSize: '22px', color: '#FFD700' }).setOrigin(0, 0.5).setDepth(11);
    this._coinTxt = this.add.text(56, 32, String(Game.state.coins), {
      fontFamily: FONT, fontSize: '20px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(11);

    // sound toggle
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
      self._drawTab(tabBg, x, 76, tabW, 48, isActive, unlocked);
      var lbl = unlocked ? labels[type] : (labels[type] + ' 🔒');
      var tabTxt = self.add.text(x + tabW/2, 100, lbl, {
        fontFamily: FONT, fontSize: '15px',
        color: isActive ? '#ffffff' : (unlocked ? '#aaaaaa' : '#555555')
      }).setOrigin(0.5).setDepth(6);
      self._tabBtns[type] = { bg: tabBg, txt: tabTxt };

      var zone = self.add.zone(x + tabW/2, 100, tabW - 4, 44).setInteractive().setDepth(7);
      zone.on('pointerdown', function() {
        if (!Game.state.habitats[type].unlocked) {
          self._tryUnlockHabitat(type);
          return;
        }
        self._currentHabitat = type;
        self._buildHabitatBg(self.scale.width, self.scale.height);
        self._updateTabs();
        self.refreshAll();
      });
    });
  },

  _drawTab: function(g, x, y, w, h, active, unlocked) {
    g.clear();
    var fill = active ? 0x4a2080 : (unlocked ? 0x1e1040 : 0x110825);
    var alpha = active ? 1 : 0.7;
    g.fillStyle(fill, alpha);
    g.fillRoundedRect(x + 2, y, w - 4, h, { tl:10, tr:10, bl:0, br:0 });
    if (active) {
      g.lineStyle(2, 0x9060ff, 1);
      g.strokeRoundedRect(x + 2, y, w - 4, h, { tl:10, tr:10, bl:0, br:0 });
    }
  },

  _updateTabs: function() {
    var self = this;
    var types = ['dirt', 'grass', 'aquatic'];
    var labels = { dirt: '🪨 Dirt', grass: '🌿 Grass', aquatic: '🌊 Aqua' };
    var W = this.scale.width;
    var tabW = (W - 20) / 3;
    types.forEach(function(type, i) {
      var x = 10 + tabW * i;
      var btn = self._tabBtns[type];
      var isActive = type === self._currentHabitat;
      var unlocked = Game.state.habitats[type].unlocked;
      self._drawTab(btn.bg, x, 76, tabW, 48, isActive, unlocked);
      btn.txt.setStyle({ color: isActive ? '#ffffff' : (unlocked ? '#aaaaaa' : '#555555') });
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
        showToast(self, 'Need 2 monsters at level 4+', '#ff9999');
      } else {
        Ads.maybeInterstitial(function() { self.scene.start('BreedingLab'); });
      }
    }, 17).setDepth(10);
  },

  _tryUnlockHabitat: function(type) {
    var cost = HABITATS[type].unlockCost;
    if (Game.state.coins < cost) {
      showToast(this, 'Need ' + cost + ' coins to unlock ' + HABITATS[type].label, '#ff9999');
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
    this._bobTweens.forEach(function(t) { t.stop(); });
    this._bobTweens = [];
    this._displayGroup.clear(true, true);
    var W = this.scale.width;
    var monsters = Game.state.monsters.filter(function(m) { return m.habitatType === this._currentHabitat; }, this);
    var eggs     = Game.state.eggs.filter(function(e) { return e.habitatType === this._currentHabitat; }, this);

    if (monsters.length === 0 && eggs.length === 0) {
      var emptyTxt = this.add.text(W/2, 490, 'Empty habitat\nBuy an egg from the Shop!', {
        fontFamily: FONT, fontSize: '18px', color: '#7060a0',
        align: 'center', lineSpacing: 8
      }).setOrigin(0.5).setDepth(20);
      this._displayGroup.add(emptyTxt);
      return;
    }

    var slotPositions = this._getSlotPositions(W);
    var slotIdx = 0;
    var self = this;

    eggs.forEach(function(egg) {
      if (slotIdx >= slotPositions.length) return;
      var pos = slotPositions[slotIdx++];
      self._drawEggSlot(pos.x, pos.y, egg);
    });

    monsters.forEach(function(mon) {
      if (slotIdx >= slotPositions.length) return;
      var pos = slotPositions[slotIdx++];
      self._drawMonsterSlot(pos.x, pos.y, mon);
    });
  },

  _getSlotPositions: function(W) {
    var zoneTop = 145;
    return [
      { x: W/2 - 110, y: zoneTop + 120 },
      { x: W/2 + 110, y: zoneTop + 120 },
      { x: W/2 - 110, y: zoneTop + 300 },
      { x: W/2 + 110, y: zoneTop + 300 },
      { x: W/2 - 110, y: zoneTop + 480 },
      { x: W/2 + 110, y: zoneTop + 480 }
    ];
  },

  _drawEggSlot: function(x, y, egg) {
    var sp = SPECIES[egg.speciesId];
    var hCfg = HABITATS[sp.habitat];
    var g = this.add.graphics().setDepth(20);
    // slot bg
    g.fillStyle(0x00000055, 1);
    g.fillRoundedRect(x - 62, y - 75, 124, 140, 12);
    g.lineStyle(1, hCfg.wallColor, 0.6);
    g.strokeRoundedRect(x - 62, y - 75, 124, 140, 12);
    this._displayGroup.add(g);

    // egg shape
    var eggG = this.add.graphics().setDepth(21);
    var hueShift = getVariantModifiers(egg.variantIndex).hueShift;
    var eggColor = shiftHue(sp.baseColor, hueShift);
    eggG.fillStyle(eggColor, 1);
    eggG.fillEllipse(x, y - 20, 52, 64);
    eggG.fillStyle(0xffffff, 0.25);
    eggG.fillEllipse(x - 8, y - 32, 16, 24);
    this._displayGroup.add(eggG);

    // name
    var nameTxt = this.add.text(x, y + 28, sp.name, {
      fontFamily: FONT, fontSize: '13px', color: '#dddddd', align: 'center'
    }).setOrigin(0.5).setDepth(22);
    this._displayGroup.add(nameTxt);

    // timer text (updated by egg timer)
    var now = Date.now();
    var remaining = Math.max(0, egg.hatchEndAt - now);
    var timerTxt = this.add.text(x, y + 46, this._formatMs(remaining), {
      fontFamily: FONT, fontSize: '12px',
      color: remaining <= 0 ? '#aaffaa' : '#aabbff', align: 'center'
    }).setOrigin(0.5).setDepth(22);
    timerTxt._eggId = egg.id;
    this._displayGroup.add(timerTxt);

    // tap zone
    var self = this;
    var zone = this.add.zone(x, y - 15, 124, 140).setInteractive().setDepth(23);
    zone.on('pointerdown', function() {
      var refreshedEgg = Game.state.eggs.find(function(e) { return e.id === egg.id; });
      if (!refreshedEgg) return;
      if (Date.now() >= refreshedEgg.hatchEndAt) {
        self.scene.launch('HatchScene', { eggId: refreshedEgg.id });
      } else {
        showToast(self, sp.name + ' is still incubating…', '#aabbff');
      }
    });
    this._displayGroup.add(zone);
  },

  _drawMonsterSlot: function(x, y, mon) {
    var sp = SPECIES[mon.speciesId];
    var g = this.add.graphics().setDepth(20);
    // slot bg + stat indicator colors
    var avgStat = (mon.happiness + mon.hunger + mon.cleanliness) / 3;
    var borderCol = avgStat > 66 ? 0x44cc88 : avgStat > 33 ? 0xffcc44 : 0xff5555;
    g.fillStyle(0x00000055, 1);
    g.fillRoundedRect(x - 62, y - 75, 124, 140, 12);
    g.lineStyle(2, borderCol, 0.7);
    g.strokeRoundedRect(x - 62, y - 75, 124, 140, 12);
    this._displayGroup.add(g);

    // monster sprite
    var texKey = makeMonsterTexture(this, mon);
    var img = this.add.image(x, y - 18, texKey).setDisplaySize(92, 92).setDepth(21);
    this._displayGroup.add(img);
    this._bobTweens.push(this.tweens.add({ targets: img, y: img.y - 6, duration: 1200, ease: 'Sine.InOut', yoyo: true, repeat: -1 }));

    // level badge
    var lvlBg = this.add.graphics().setDepth(22);
    lvlBg.fillStyle(0x1a0a2e, 0.85);
    lvlBg.fillRoundedRect(x + 26, y - 74, 28, 20, 6);
    this._displayGroup.add(lvlBg);
    var lvlTxt = this.add.text(x + 40, y - 64, 'Lv' + mon.level, {
      fontFamily: FONT, fontSize: '11px', color: '#ffdd55'
    }).setOrigin(0.5).setDepth(23);
    this._displayGroup.add(lvlTxt);

    // name
    var nameTxt = this.add.text(x, y + 32, sp.name, {
      fontFamily: FONT, fontSize: '13px', color: '#dddddd', align: 'center'
    }).setOrigin(0.5).setDepth(22);
    this._displayGroup.add(nameTxt);

    // happiness quick indicator
    var happyIcon = mon.happiness > 60 ? '😊' : mon.happiness > 30 ? '😐' : '😢';
    var iconTxt = this.add.text(x, y + 48, happyIcon, {
      fontFamily: FONT, fontSize: '14px'
    }).setOrigin(0.5).setDepth(22);
    this._displayGroup.add(iconTxt);

    // tap to open panel
    var self = this;
    var zone = this.add.zone(x, y - 15, 124, 140).setInteractive().setDepth(23);
    zone.on('pointerdown', function() {
      sfx.unlock();
      var freshMon = Game.state.monsters.find(function(m) { return m.id === mon.id; });
      if (freshMon) openMonsterPanel(self, freshMon);
    });
    this._displayGroup.add(zone);
  },

  _startEggTimer: function() {
    var self = this;
    if (this._eggTimer) this._eggTimer.remove();
    this._eggTimer = this.time.addEvent({
      delay: 1000, loop: true, callback: function() {
        self._updateEggTimers();
      }
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
      child.setStyle({ color: remaining <= 0 ? '#aaffaa' : '#aabbff' });
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

  // called from HatchScene when egg hatches — remove egg, add monster
  onEggHatched: function(eggId, monster) {
    Game.state.eggs = Game.state.eggs.filter(function(e) { return e.id !== eggId; });
    Game.state.monsters.push(monster);
    Game.state.stats.hatched++;
    store.setJSON('mps_state', Game.state);
    this._updateCoinDisplay();
    this.refreshAll();
  }
});
