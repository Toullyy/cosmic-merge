'use strict';

var HatchScene = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function HatchScene() {
    Phaser.Scene.call(this, { key: 'HatchScene' });
  },

  init: function(data) {
    this._eggId = data.eggId;
  },

  create: function() {
    var W = this.scale.width, H = this.scale.height;
    var egg = Game.state.eggs.find(function(e) { return e.id === this._eggId; }, this);
    if (!egg) { this.scene.stop(); return; }
    var sp = SPECIES[egg.speciesId];

    // dark overlay
    var overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.78);
    overlay.fillRect(0, 0, W, H);

    // egg graphic
    var cx = W/2, cy = H/2 - 80;
    var mods = getVariantModifiers(egg.variantIndex);
    var eggColor = shiftHue(sp.baseColor, mods.hueShift);
    this._eggGraphic = this.add.graphics();
    this._drawEgg(this._eggGraphic, cx, cy, eggColor);

    // title
    this.add.text(W/2, cy - 170, 'Something is hatching…', {
      fontFamily: FONT, fontSize: '22px', color: '#ccccff',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);

    // crack animation sequence
    var self = this;
    this.time.addEvent({ delay: 400, callback: function() { self._addCracks(cx, cy, eggColor); }});
    this.time.addEvent({ delay: 900, callback: function() { self._shakeAndBurst(cx, cy, egg, sp, eggColor); }});
  },

  _drawEgg: function(g, cx, cy, color) {
    g.clear();
    g.fillStyle(darken(color, 30), 1);
    g.fillEllipse(cx, cy, 110, 140);
    g.fillStyle(color, 1);
    g.fillEllipse(cx - 2, cy - 3, 104, 132);
    g.fillStyle(lighten(color, 50), 0.35);
    g.fillEllipse(cx - 16, cy - 30, 32, 48);
  },

  _addCracks: function(cx, cy, color) {
    var cg = this.add.graphics();
    cg.lineStyle(3, darken(color, 60), 1);
    // zig-zag cracks
    cg.beginPath();
    cg.moveTo(cx - 10, cy - 40);
    cg.lineTo(cx + 5, cy - 20);
    cg.lineTo(cx - 5, cy);
    cg.lineTo(cx + 8, cy + 18);
    cg.strokePath();
    cg.beginPath();
    cg.moveTo(cx + 12, cy - 30);
    cg.lineTo(cx + 22, cy - 10);
    cg.lineTo(cx + 10, cy + 5);
    cg.strokePath();
    // shake
    this.tweens.add({
      targets: [this._eggGraphic, cg],
      x: { from: -4, to: 4 }, duration: 60, ease: 'Bounce', repeat: 5, yoyo: true
    });
  },

  _shakeAndBurst: function(cx, cy, egg, sp, eggColor) {
    var self = this;
    // burst particles (colored dots flying out)
    for (var i = 0; i < 14; i++) {
      var angle = (i / 14) * Math.PI * 2;
      var pg = this.add.graphics();
      pg.fillStyle(i % 2 === 0 ? eggColor : lighten(eggColor, 60), 1);
      pg.fillCircle(cx, cy, 8 + Math.random() * 8);
      this.tweens.add({
        targets: pg,
        x: Math.cos(angle) * (80 + Math.random() * 70),
        y: Math.sin(angle) * (80 + Math.random() * 70),
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 500 + Math.random() * 300,
        ease: 'Cubic.Out',
        onComplete: function() { pg.destroy(); }
      });
    }

    // hide egg
    this.tweens.add({ targets: this._eggGraphic, scaleX: 1.3, scaleY: 1.3, alpha: 0, duration: 350 });
    sfx.hatch();

    // show monster
    var mon = newMonster(egg.speciesId, egg.variantIndex, egg.source);
    var texKey = makeMonsterTexture(this, mon);
    var img = this.add.image(cx, cy, texKey).setDisplaySize(140, 140).setAlpha(0);
    this.tweens.add({ targets: img, alpha: 1, scaleX: { from: 0.3, to: 1 }, scaleY: { from: 0.3, to: 1 }, duration: 500, ease: 'Back.Out' });
    this.tweens.add({ targets: img, y: img.y - 8, duration: 1100, ease: 'Sine.InOut', yoyo: true, repeat: -1 });

    var mods = getVariantModifiers(mon.variantIndex);
    this.add.text(cx, cy + 110, sp.name + (mods.isGolden ? ' ✨ GOLDEN!' : '!'), {
      fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: mods.isGolden ? '#FFD700' : '#ffffff',
      stroke: '#000000', strokeThickness: 4
    }).setOrigin(0.5);
    this.add.text(cx, cy + 145, sp.habitat.charAt(0).toUpperCase() + sp.habitat.slice(1) + ' Monster', {
      fontFamily: FONT, fontSize: '16px', color: '#aaaacc'
    }).setOrigin(0.5);

    this.time.addEvent({ delay: 900, callback: function() { self._showContinueBtn(cx, egg.id, mon); }});
  },

  _showContinueBtn: function(cx, eggId, mon) {
    var self = this;
    makeButton(this, cx, this.scale.height / 2 + 220, 200, 50, '✅ Continue', 0x2a5030, function() {
      var hub = self.game.scene.getScene('Hub');
      if (hub) hub.onEggHatched(eggId, mon);
      self.scene.stop();
    }, 18);
  }
});
