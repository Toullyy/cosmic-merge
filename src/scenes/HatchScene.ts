import Phaser from 'phaser';
import { Game, FONT, sfx } from '../utils';
import { SPECIES, newMonster } from '../data';
import { shiftHue, darken, lighten, getVariantModifiers, makeMonsterTexture } from '../MonsterRenderer';
import { makeButton } from '../ui/Button';

export class HatchScene extends Phaser.Scene {
  private _eggId: string = '';
  private _eggGraphic!: Phaser.GameObjects.Graphics;

  constructor() { super({ key: 'HatchScene' }); }

  init(data: { eggId: string }) { this._eggId = data.eggId; }

  create() {
    const W = this.scale.width, H = this.scale.height;
    const egg = Game.state!.eggs.find(e => e.id === this._eggId);
    if (!egg) { this.scene.stop(); return; }
    const sp = SPECIES[egg.speciesId];

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.78);
    overlay.fillRect(0, 0, W, H);

    const cx = W/2, cy = H/2 - 80;
    const mods = getVariantModifiers(egg.variantIndex);
    const eggColor = shiftHue(sp.baseColor, mods.hueShift);
    this._eggGraphic = this.add.graphics();
    this._drawEgg(this._eggGraphic, cx, cy, eggColor);

    this.add.text(W/2, cy - 170, 'Something is hatching…', {
      fontFamily: FONT, fontSize: '22px', color: '#ccccff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    this.time.addEvent({ delay: 400, callback: () => { this._addCracks(cx, cy, eggColor); } });
    this.time.addEvent({ delay: 900, callback: () => { this._shakeAndBurst(cx, cy, egg.id, sp.id, eggColor); } });
  }

  private _drawEgg(g: Phaser.GameObjects.Graphics, cx: number, cy: number, color: number) {
    g.clear();
    g.fillStyle(darken(color, 30), 1); g.fillEllipse(cx, cy, 110, 140);
    g.fillStyle(color, 1);             g.fillEllipse(cx - 2, cy - 3, 104, 132);
    g.fillStyle(lighten(color, 50), 0.35); g.fillEllipse(cx - 16, cy - 30, 32, 48);
  }

  private _addCracks(cx: number, cy: number, color: number) {
    const cg = this.add.graphics();
    cg.lineStyle(3, darken(color, 60), 1);
    cg.beginPath(); cg.moveTo(cx - 10, cy - 40); cg.lineTo(cx + 5, cy - 20);
    cg.lineTo(cx - 5, cy); cg.lineTo(cx + 8, cy + 18); cg.strokePath();
    cg.beginPath(); cg.moveTo(cx + 12, cy - 30); cg.lineTo(cx + 22, cy - 10);
    cg.lineTo(cx + 10, cy + 5); cg.strokePath();
    this.tweens.add({
      targets: [this._eggGraphic, cg],
      x: { from: -4, to: 4 }, duration: 60, ease: 'Bounce', repeat: 5, yoyo: true,
    });
  }

  private _shakeAndBurst(cx: number, cy: number, eggId: string, speciesId: number, eggColor: number) {
    const sp = SPECIES[speciesId];
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const pg = this.add.graphics();
      pg.fillStyle(i % 2 === 0 ? eggColor : lighten(eggColor, 60), 1);
      pg.fillCircle(cx, cy, 8 + Math.random() * 8);
      this.tweens.add({
        targets: pg,
        x: Math.cos(angle) * (80 + Math.random() * 70),
        y: Math.sin(angle) * (80 + Math.random() * 70),
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 500 + Math.random() * 300,
        ease: 'Cubic.Out',
        onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* ignore */ } },
      });
    }

    this.tweens.add({ targets: this._eggGraphic, scaleX: 1.3, scaleY: 1.3, alpha: 0, duration: 350 });
    sfx.hatch();

    const egg = Game.state!.eggs.find(e => e.id === eggId)!;
    const mon = newMonster(egg.speciesId, egg.variantIndex, egg.source);
    const texKey = makeMonsterTexture(this, mon);
    const img = this.add.image(cx, cy, texKey).setDisplaySize(140, 140).setAlpha(0);
    this.tweens.add({ targets: img, alpha: 1, scaleX: { from: 0.3, to: 1 }, scaleY: { from: 0.3, to: 1 }, duration: 500, ease: 'Back.Out' });
    this.tweens.add({ targets: img, y: img.y - 8, duration: 1100, ease: 'Sine.InOut', yoyo: true, repeat: -1 });

    const mods = getVariantModifiers(mon.variantIndex);
    this.add.text(cx, cy + 110, sp.name + (mods.isGolden ? ' ✨ GOLDEN!' : '!'), {
      fontFamily: FONT, fontSize: '26px', fontStyle: 'bold',
      color: mods.isGolden ? '#FFD700' : '#ffffff', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.add.text(cx, cy + 145, sp.habitat.charAt(0).toUpperCase() + sp.habitat.slice(1) + ' Monster', {
      fontFamily: FONT, fontSize: '16px', color: '#aaaacc',
    }).setOrigin(0.5);

    this.time.addEvent({ delay: 900, callback: () => { this._showContinueBtn(cx, eggId, mon); } });
  }

  private _showContinueBtn(cx: number, eggId: string, mon: any) {
    makeButton(this, cx, this.scale.height / 2 + 220, 200, 50, '✅ Continue', 0x2a5030, () => {
      const hub = this.game.scene.getScene('Hub') as any;
      if (hub) hub.onEggHatched(eggId, mon);
      this.scene.stop();
    }, 18);
  }
}
