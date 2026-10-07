'use strict';

var BreedingLab = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function BreedingLab() {
    Phaser.Scene.call(this, { key: 'BreedingLab' });
    this._selectedA = null;
    this._selectedB = null;
  },

  create: function() {
    sfx.unlock();
    var W = this.scale.width, H = this.scale.height;
    var self = this;

    var bg = this.add.graphics();
    bg.fillGradientStyle(0x060312, 0x060312, 0x1a0a2e, 0x1a0a2e, 1);
    bg.fillRect(0, 0, W, H);

    this.add.text(W/2, 46, '🧬 Breeding Lab', {
      fontFamily: FONT, fontSize: '24px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.add.text(W/2, 76, 'Select 2 monsters (Level 4+) to breed', {
      fontFamily: FONT, fontSize: '15px', color: '#8888cc'
    }).setOrigin(0.5);

    makeButton(this, W - 70, 30, 110, 40, '← Back', 0x2a1560, function() {
      Ads.maybeInterstitial(function() { self.scene.start('Hub'); });
    }, 15);

    // parent slots
    this._slotA = this._buildParentSlot(W/2 - 100, 180, 'Parent A');
    this._slotB = this._buildParentSlot(W/2 + 100, 180, 'Parent B');

    // + symbol between
    this.add.text(W/2, 190, '+', {
      fontFamily: FONT, fontSize: '32px', color: '#6040c0'
    }).setOrigin(0.5);

    // eligible monsters list
    this._listGroup = this.add.group();
    this._buildMonsterList(W, H);

    // breed button (bottom)
    this._breedBtn = makeButton(this, W/2, H - 60, 220, 54, '🧬 Breed!', 0x2a0860, function() {
      self._doBreed();
    }, 18);
    this._breedBtn.setAlpha(0.4);
  },

  _buildParentSlot: function(x, y, label) {
    var g = this.add.graphics();
    g.lineStyle(2, 0x4030a0, 0.8);
    g.strokeRoundedRect(x - 60, y - 70, 120, 130, 12);
    g.fillStyle(0x0d0618, 0.8);
    g.fillRoundedRect(x - 60, y - 70, 120, 130, 12);
    this.add.text(x, y + 48, label, { fontFamily: FONT, fontSize: '13px', color: '#6655aa' }).setOrigin(0.5);
    var slot = { x: x, y: y, graphics: g, img: null, labelTxt: null };
    slot.labelTxt = this.add.text(x, y, '?', { fontFamily: FONT, fontSize: '28px', color: '#3a2a60' }).setOrigin(0.5);
    return slot;
  },

  _buildMonsterList: function(W, H) {
    this._listGroup.clear(true, true);
    var self = this;
    var eligible = Game.state.monsters.filter(function(m) { return m.level >= 4; });
    var scrollY = 340;

    if (eligible.length === 0) {
      this._listGroup.add(this.add.text(W/2, scrollY + 40, 'No monsters at Level 4+ yet.\nRaise your monsters to breed!', {
        fontFamily: FONT, fontSize: '16px', color: '#6655aa', align: 'center', lineSpacing: 8
      }).setOrigin(0.5));
      return;
    }

    eligible.forEach(function(mon, idx) {
      var col = idx % 3;
      var row = Math.floor(idx / 3);
      var cx = W/2 - 140 + col * 140;
      var cy = scrollY + row * 150;
      var sp = SPECIES[mon.speciesId];

      var cardBg = self.add.graphics();
      var isA = self._selectedA && self._selectedA.id === mon.id;
      var isB = self._selectedB && self._selectedB.id === mon.id;
      var borderCol = isA ? 0xff8844 : (isB ? 0x44aaff : 0x2a2a4a);
      cardBg.fillStyle(0x100820, 1);
      cardBg.fillRoundedRect(cx - 58, cy - 58, 116, 126, 12);
      cardBg.lineStyle(2, borderCol, isA || isB ? 1 : 0.4);
      cardBg.strokeRoundedRect(cx - 58, cy - 58, 116, 126, 12);
      self._listGroup.add(cardBg);

      var texKey = makeMonsterTexture(self, mon);
      var img = self.add.image(cx, cy - 8, texKey).setDisplaySize(80, 80);
      self._listGroup.add(img);

      self._listGroup.add(self.add.text(cx, cy + 44, sp.name, {
        fontFamily: FONT, fontSize: '13px', color: '#ccccdd', align: 'center'
      }).setOrigin(0.5));
      self._listGroup.add(self.add.text(cx, cy + 62, 'Lv ' + mon.level, {
        fontFamily: FONT, fontSize: '12px', color: '#ffdd55'
      }).setOrigin(0.5));

      var zone = self.add.zone(cx, cy, 116, 126).setInteractive();
      zone.on('pointerdown', function() { self._selectMonster(mon); });
      self._listGroup.add(zone);
    });
  },

  _selectMonster: function(mon) {
    if (this._selectedA && this._selectedA.id === mon.id) {
      this._selectedA = null;
    } else if (this._selectedB && this._selectedB.id === mon.id) {
      this._selectedB = null;
    } else if (!this._selectedA) {
      this._selectedA = mon;
    } else if (!this._selectedB) {
      this._selectedB = mon;
    } else {
      this._selectedA = mon;
    }
    this._updateSlots();
    this._buildMonsterList(this.scale.width, this.scale.height);
    this._breedBtn.setAlpha(this._selectedA && this._selectedB ? 1 : 0.4);
  },

  _updateSlots: function() {
    this._updateSlot(this._slotA, this._selectedA);
    this._updateSlot(this._slotB, this._selectedB);
  },

  _updateSlot: function(slot, mon) {
    if (slot.img) { slot.img.destroy(); slot.img = null; }
    if (slot.labelTxt) slot.labelTxt.destroy();
    if (mon) {
      var texKey = makeMonsterTexture(this, mon);
      slot.img = this.add.image(slot.x, slot.y, texKey).setDisplaySize(88, 88);
      slot.labelTxt = this.add.text(slot.x, slot.y + 32, SPECIES[mon.speciesId].name, {
        fontFamily: FONT, fontSize: '12px', color: '#dddddd'
      }).setOrigin(0.5);
    } else {
      slot.labelTxt = this.add.text(slot.x, slot.y, '?', {
        fontFamily: FONT, fontSize: '28px', color: '#3a2a60'
      }).setOrigin(0.5);
    }
  },

  _doBreed: function() {
    if (!this._selectedA || !this._selectedB) return;
    var a = this._selectedA, b = this._selectedB;
    if (a.id === b.id) { showToast(this, 'A monster cannot breed with itself!', '#ff9999'); return; }

    // determine child species
    var childSpeciesId;
    if (a.speciesId === b.speciesId) {
      childSpeciesId = a.speciesId;
    } else {
      // cross-breed → rare species (15–24) based on combo hash
      var combo = (a.speciesId + b.speciesId) % 10;
      childSpeciesId = 15 + combo;
    }

    // child variant is blend of parents ± random
    var blendVi = Math.floor((a.variantIndex + b.variantIndex) / 2);
    var childVi = Math.max(0, Math.min(99, blendVi + Math.floor(Math.random() * 21) - 10));

    // hatch time = max parent hatch × 1.5
    var spA = SPECIES[a.speciesId], spB = SPECIES[b.speciesId];
    var baseHours = Math.max(spA.hatchHours, spB.hatchHours) * 1.5;
    var childSp = SPECIES[childSpeciesId];
    var finalHours = Math.max(baseHours, childSp.hatchHours * 0.5);

    var egg = newEgg(childSpeciesId, childVi, 'breeding', [a.id, b.id]);
    egg.hatchEndAt = Date.now() + finalHours * 3600000;
    Game.state.eggs.push(egg);
    store.setJSON('mps_state', Game.state);
    sfx.buy();
    showToast(this, 'Breeding started! Hatch in ' + Math.ceil(finalHours) + 'h', '#aaffaa');

    this._selectedA = null;
    this._selectedB = null;
    this._updateSlots();
    this._buildMonsterList(this.scale.width, this.scale.height);
    this._breedBtn.setAlpha(0.4);
  }
});
