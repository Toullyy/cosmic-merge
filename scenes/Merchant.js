'use strict';

var Merchant = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function Merchant() { Phaser.Scene.call(this, { key: 'Merchant' }); },

  create: function() {
    sfx.unlock();
    var W = this.scale.width, H = this.scale.height;
    var self = this;

    // background
    var bg = this.add.graphics();
    bg.fillGradientStyle(0x0d0618, 0x0d0618, 0x1a0a2e, 0x1a0a2e, 1);
    bg.fillRect(0, 0, W, H);

    // header
    this.add.text(W/2, 46, '🛒 Monster Egg Shop', {
      fontFamily: FONT, fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    // coins HUD
    var coinBg = this.add.graphics();
    coinBg.fillStyle(0x00000066, 1);
    coinBg.fillRoundedRect(10, 10, 150, 40, 10);
    this.add.text(28, 30, '⬡', { fontFamily: FONT, fontSize: '20px', color: '#FFD700' }).setOrigin(0, 0.5);
    this._coinTxt = this.add.text(52, 30, String(Game.state.coins), {
      fontFamily: FONT, fontSize: '18px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0, 0.5);

    // back button
    makeButton(this, W - 70, 30, 110, 40, '← Back', 0x2a1560, function() {
      self.scene.start('Hub');
    }, 15);

    // habitat filter tabs
    this._filter = 'dirt';
    this._filterGroup = this.add.group();
    this._buildFilterTabs(W);

    // egg grid
    this._gridGroup = this.add.group();
    this._buildGrid(W, H);
  },

  _buildFilterTabs: function(W) {
    var self = this;
    var filters = ['dirt', 'grass', 'aquatic'];
    var labels  = { dirt:'🪨 Dirt', grass:'🌿 Grass', aquatic:'🌊 Aqua' };
    var tabW = (W - 20) / 3;
    filters.forEach(function(f, i) {
      var x = 10 + tabW * i;
      var g = self.add.graphics();
      var lbl = self.add.text(x + tabW/2, 90, labels[f], {
        fontFamily: FONT, fontSize: '15px', color: '#aaaaaa'
      }).setOrigin(0.5);
      self._filterGroup.addMultiple([g, lbl]);
      (function(filter, gfx, lblTxt) {
        var zone = self.add.zone(x + tabW/2, 90, tabW - 4, 36).setInteractive();
        zone.on('pointerdown', function() {
          self._filter = filter;
          self._buildGrid(self.scale.width, self.scale.height);
          self._updateFilterTabs();
        });
        self._filterGroup.add(zone);
        gfx._filterKey = filter;
        lblTxt._filterKey = filter;
      })(f, g, lbl);
    });
    this._updateFilterTabs();
  },

  _updateFilterTabs: function() {
    var self = this;
    var W = this.scale.width;
    var filters = ['dirt', 'grass', 'aquatic'];
    var tabW = (W - 20) / 3;
    this._filterGroup.getChildren().forEach(function(child) {
      if (!child._filterKey) return;
      var isActive = child._filterKey === self._filter;
      if (child.type === 'Graphics') {
        child.clear();
        child.fillStyle(isActive ? 0x4a2080 : 0x1e1040, isActive ? 1 : 0.6);
        var i = filters.indexOf(child._filterKey);
        child.fillRoundedRect(10 + tabW*i + 2, 74, tabW - 4, 32, 8);
      } else if (child.type === 'Text') {
        child.setStyle({ color: isActive ? '#ffffff' : '#777777' });
      }
    });
  },

  _buildGrid: function(W, H) {
    this._gridGroup.clear(true, true);
    var self = this;
    var filtered = CATALOG.filter(function(sp) {
      return self._filter === 'all' || sp.habitat === self._filter;
    });

    var cols = 2, cardW = 210, cardH = 190, gapX = (W - cols*cardW) / (cols+1), startY = 130;
    filtered.forEach(function(sp, idx) {
      var col = idx % cols;
      var row = Math.floor(idx / cols);
      var cx = gapX + cardW/2 + col*(cardW + gapX);
      var cy = startY + 20 + row*(cardH + 16) + cardH/2;

      var unlocked = Game.state.habitats[sp.habitat].unlocked;
      var cardBg = self.add.graphics();
      cardBg.fillStyle(unlocked ? 0x1a0f30 : 0x0d0820, 1);
      cardBg.fillRoundedRect(cx - cardW/2, cy - cardH/2, cardW, cardH, 14);
      cardBg.lineStyle(2, HABITATS[sp.habitat].wallColor, unlocked ? 0.7 : 0.25);
      cardBg.strokeRoundedRect(cx - cardW/2, cy - cardH/2, cardW, cardH, 14);
      self._gridGroup.add(cardBg);

      // egg preview
      var eggG = self.add.graphics();
      var hueShift = ((sp.id * 13) % 12 - 6) * 15;
      var eggColor = shiftHue(sp.baseColor, hueShift);
      if (unlocked) {
        eggG.fillStyle(eggColor, 1);
        eggG.fillEllipse(cx, cy - 38, 46, 58);
        eggG.fillStyle(0xffffff, 0.22);
        eggG.fillEllipse(cx - 7, cy - 49, 14, 20);
      } else {
        eggG.fillStyle(0x333333, 1);
        eggG.fillEllipse(cx, cy - 38, 46, 58);
      }
      self._gridGroup.add(eggG);

      // name + info
      self._gridGroup.add(self.add.text(cx, cy + 0, unlocked ? sp.name : '???', {
        fontFamily: FONT, fontSize: '15px', fontStyle: 'bold',
        color: unlocked ? '#ffffff' : '#555555', align: 'center'
      }).setOrigin(0.5));
      self._gridGroup.add(self.add.text(cx, cy + 22, '⏱ ' + sp.hatchHours + 'h', {
        fontFamily: FONT, fontSize: '13px', color: unlocked ? '#8888cc' : '#333355'
      }).setOrigin(0.5));

      // buy button
      var btnLabel = unlocked ? ('Buy  ' + sp.price + '⬡') : (HABITATS[sp.habitat].unlockCost + '⬡ Unlock');
      var btnCol = unlocked ? 0x2a5030 : 0x251040;
      var btn = makeButton(self, cx, cy + 66, 160, 36, btnLabel, btnCol, function() {
        self._handleBuy(sp, unlocked);
      }, 14);
      btn.setAlpha(unlocked ? 1 : 0.55);
      self._gridGroup.add(btn);
    });
  },

  _handleBuy: function(sp, unlocked) {
    if (!unlocked) {
      var cost = HABITATS[sp.habitat].unlockCost;
      if (Game.state.coins < cost) {
        showToast(this, 'Need ' + cost + '⬡ to unlock ' + HABITATS[sp.habitat].label, '#ff9999');
        return;
      }
      Game.state.coins -= cost;
      Game.state.habitats[sp.habitat].unlocked = true;
      store.setJSON('mps_state', Game.state);
      this._coinTxt.setText(String(Game.state.coins));
      sfx.buy();
      showToast(this, HABITATS[sp.habitat].label + ' unlocked!', '#aaffaa');
      this._buildGrid(this.scale.width, this.scale.height);
      return;
    }
    if (Game.state.coins < sp.price) {
      showToast(this, 'Not enough coins! Need ' + sp.price + '⬡', '#ff9999');
      return;
    }
    Game.state.coins -= sp.price;
    var vi = Math.floor(Math.random() * 100);
    var egg = newEgg(sp.id, vi, 'merchant');
    Game.state.eggs.push(egg);
    store.setJSON('mps_state', Game.state);
    this._coinTxt.setText(String(Game.state.coins));
    sfx.buy();
    showToast(this, sp.name + ' egg added! Hatch in ' + sp.hatchHours + 'h', '#aaffaa');
    this._buildGrid(this.scale.width, this.scale.height);
  }
});
