import Phaser from 'phaser';
import { Game, FONT, sfx } from '../utils';
import { t } from '../i18n';
import { SPECIES, newMonster, DIAMOND_NEW_SPECIES, DIAMOND_NEW_COLOR } from '../data';
import { shiftHue, darken, lighten, getVariantModifiers, preloadMonsterTexture } from '../MonsterRenderer';
import { makeButton } from '../ui/Button';

export class HatchScene extends Phaser.Scene {
  private _eggId: string = '';
  private _eggGraphic!: Phaser.GameObjects.Graphics;
  private _glowRing: Phaser.GameObjects.Graphics | null = null;
  private _glowTween: Phaser.Tweens.Tween | null = null;

  constructor() { super({ key: 'HatchScene' }); }

  init(data: { eggId: string }) { this._eggId = data.eggId; }

  create() {
    const W = this.scale.width, H = this.scale.height;
    const egg = Game.state!.eggs.find(e => e.id === this._eggId);
    if (!egg) { this.scene.stop(); return; }
    const sp = SPECIES[egg.speciesId];

    // ── Deep space background ─────────────────────────────────────────────
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x000011, 0x000011, 0x180830, 0x180830, 1);
    bg.fillRect(0, 0, W, H * 0.5);
    bg.fillGradientStyle(0x180830, 0x180830, 0x0A0020, 0x0A0020, 1);
    bg.fillRect(0, H * 0.5, W, H * 0.5);

    // Nebula glows
    bg.fillStyle(0x6622BB, 0.08); bg.fillCircle(W * 0.25, H * 0.28, 160);
    bg.fillStyle(0x2244AA, 0.07); bg.fillCircle(W * 0.78, H * 0.18, 130);
    bg.fillStyle(0xAA33FF, 0.05); bg.fillCircle(W * 0.50, H * 0.55, 200);

    // Stars
    for (let i = 0; i < 60; i++) {
      const sx = Math.random() * W;
      const sy = Math.random() * H;
      bg.fillStyle(0xFFFFFF, 0.15 + Math.random() * 0.55);
      bg.fillCircle(sx, sy, 0.5 + Math.random() * 1.2);
    }

    // ── Egg ───────────────────────────────────────────────────────────────
    const cx = W / 2, cy = H / 2 - 100;
    const mods = getVariantModifiers(egg.variantIndex);
    const eggColor = shiftHue(sp.baseColor, mods.hueShift);

    this._eggGraphic = this.add.graphics().setDepth(2);
    this._drawEgg(this._eggGraphic, cx, cy, eggColor, sp.hatchHours);

    // Pulse tween on egg before shake
    this.tweens.add({
      targets: this._eggGraphic,
      alpha: { from: 1.0, to: 0.82 },
      duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut',
    });

    // Hatching title
    this.add.text(W / 2, cy - 190, t('hatch.hatching'), {
      fontFamily: FONT, fontSize: '24px', color: '#CCAAFF',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(3);

    // Species hint text
    this.add.text(W / 2, cy - 158, sp.name + '  ·  ⏱' + sp.hatchHours + 'h', {
      fontFamily: FONT, fontSize: '14px', color: '#8866AA',
    }).setOrigin(0.5).setDepth(3);

    // ── Glow ramp (400ms): ring brightens as hatch approaches ─────────────
    this.time.addEvent({
      delay: 400, callback: () => {
        this._addCracks(cx, cy, eggColor);
        this._startGlowRamp(cx, cy, eggColor);
      },
    });

    this.time.addEvent({
      delay: 900, callback: () => {
        this._shakeAndBurst(cx, cy, egg.id, sp.id, eggColor);
      },
    });
  }

  // ── Egg drawing (rich version matching Merchant style, larger) ────────────

  private _drawEgg(g: Phaser.GameObjects.Graphics, cx: number, cy: number, color: number, hatchHours: number) {
    const eggDark = darken(color, 55);
    const eggLight = lighten(color, 45);

    // Outer glow halos
    g.fillStyle(color, 0.07); g.fillEllipse(cx, cy, 148, 172);
    g.fillStyle(color, 0.13); g.fillEllipse(cx, cy, 124, 146);
    g.fillStyle(color, 0.22); g.fillEllipse(cx, cy, 104, 124);

    // Drop shadow
    g.fillStyle(eggDark, 0.70); g.fillEllipse(cx + 5, cy + 5, 90, 110);

    // Egg body
    g.fillStyle(color, 1); g.fillEllipse(cx, cy, 90, 110);

    // Belly shimmer
    g.fillStyle(eggLight, 0.38); g.fillEllipse(cx + 12, cy + 10, 42, 56);

    // Top highlight
    g.fillStyle(eggLight, 0.62); g.fillEllipse(cx - 14, cy - 28, 32, 42);
    g.fillStyle(0xFFFFFF, 0.74); g.fillEllipse(cx - 15, cy - 30, 18, 22);

    // Speckles
    const speckles: [number, number, number][] = [
      [cx - 20, cy - 12, 4.2], [cx + 18, cy - 5, 3.5], [cx - 8, cy + 16, 4.0],
      [cx + 28, cy - 32, 3.2], [cx - 4, cy + 30, 3.5], [cx + 22, cy + 14, 3.0],
      [cx - 26, cy + 6, 3.0],
    ];
    speckles.forEach(([ex, ey, er]) => {
      g.fillStyle(eggDark, 0.52); g.fillCircle(ex, ey, er);
    });

    // Crack hints
    g.lineStyle(1.8, eggDark, 0.42);
    g.beginPath(); g.moveTo(cx + 8, cy - 26); g.lineTo(cx + 18, cy - 12); g.lineTo(cx + 10, cy); g.strokePath();
    g.lineStyle(1.4, eggDark, 0.28);
    g.beginPath(); g.moveTo(cx - 12, cy + 6); g.lineTo(cx - 5, cy + 16); g.strokePath();

    // Rare star sparkle for long-hatch eggs
    if (hatchHours >= 10) {
      g.fillStyle(0xFFD700, 0.20); g.fillCircle(cx + 34, cy - 44, 18);
      g.fillStyle(0xFFD700, 0.96); g.fillCircle(cx + 34, cy - 44, 9);
      g.fillStyle(0xFFFFFF, 0.90); g.fillCircle(cx + 31, cy - 47, 4.5);
    }
  }

  // ── Glow ramp before burst ────────────────────────────────────────────────

  private _startGlowRamp(cx: number, cy: number, color: number) {
    this._glowRing = this.add.graphics().setDepth(1);
    this._glowRing.fillStyle(color, 0.0);
    this._glowRing.fillCircle(cx, cy, 0);

    let intensity = 0;
    const rampTimer = this.time.addEvent({
      delay: 80, repeat: 5,
      callback: () => {
        intensity += 0.12;
        if (!this._glowRing || !this.scene.isActive('HatchScene')) return;
        this._glowRing.clear();
        this._glowRing.fillStyle(color, Math.min(0.18, intensity * 0.18)); this._glowRing.fillCircle(cx, cy, 120);
        this._glowRing.fillStyle(color, Math.min(0.28, intensity * 0.28)); this._glowRing.fillCircle(cx, cy, 85);
        this._glowRing.lineStyle(6, color, Math.min(0.90, intensity)); this._glowRing.strokeCircle(cx, cy, 72);
        this._glowRing.lineStyle(3, 0xFFFFFF, Math.min(0.45, intensity * 0.45)); this._glowRing.strokeCircle(cx, cy, 88);
      },
    });
    this.events.once('shutdown', () => rampTimer.destroy());
  }

  // ── Cracks ────────────────────────────────────────────────────────────────

  private _addCracks(cx: number, cy: number, color: number) {
    const cg = this.add.graphics().setDepth(3);
    cg.lineStyle(3.5, darken(color, 60), 1);
    cg.beginPath(); cg.moveTo(cx - 12, cy - 46); cg.lineTo(cx + 6, cy - 24);
    cg.lineTo(cx - 6, cy); cg.lineTo(cx + 10, cy + 22); cg.strokePath();
    cg.beginPath(); cg.moveTo(cx + 14, cy - 35); cg.lineTo(cx + 26, cy - 12);
    cg.lineTo(cx + 12, cy + 6); cg.strokePath();
    cg.lineStyle(2, darken(color, 40), 0.60);
    cg.beginPath(); cg.moveTo(cx - 30, cy - 10); cg.lineTo(cx - 18, cy + 4); cg.strokePath();

    this.tweens.add({
      targets: [this._eggGraphic, cg],
      x: { from: -5, to: 5 }, duration: 55, ease: 'Bounce', repeat: 6, yoyo: true,
    });
  }

  // ── Burst ─────────────────────────────────────────────────────────────────

  private _shakeAndBurst(cx: number, cy: number, eggId: string, speciesId: number, eggColor: number) {
    const sp = SPECIES[speciesId];

    // Stop egg pulse tween
    this.tweens.getTweensOf(this._eggGraphic).forEach(tw => tw.stop());
    if (this._glowRing) { this._glowRing.destroy(); this._glowRing = null; }

    // 24 burst particles
    const burstColors = [eggColor, lighten(eggColor, 60), 0xFFFFFF, lighten(eggColor, 30)];
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2;
      const pg = this.add.graphics().setDepth(5);
      pg.fillStyle(burstColors[i % burstColors.length], 1);
      pg.fillCircle(cx, cy, 6 + Math.random() * 10);
      this.tweens.add({
        targets: pg,
        x: Math.cos(angle) * (90 + Math.random() * 90),
        y: Math.sin(angle) * (90 + Math.random() * 90),
        alpha: 0, scaleX: 0.15, scaleY: 0.15,
        duration: 500 + Math.random() * 400, ease: 'Cubic.Out',
        onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
      });
    }

    // Screen flash
    const flash = this.add.graphics().setDepth(20);
    flash.fillStyle(0xFFFFFF, 0.80);
    flash.fillRect(0, 0, this.scale.width, this.scale.height);
    this.tweens.add({ targets: flash, alpha: 0, duration: 220, ease: 'Quad.Out',
      onComplete: () => { flash.destroy(); } });

    // Expanding ring
    const ring = this.add.graphics().setDepth(6);
    ring.lineStyle(4, eggColor, 0.90);
    ring.strokeCircle(cx, cy, 50);
    this.tweens.add({
      targets: ring, scaleX: 3.5, scaleY: 3.5, alpha: 0,
      duration: 550, ease: 'Cubic.Out',
      onComplete: () => { ring.destroy(); },
    });

    // Second ring (white)
    const ring2 = this.add.graphics().setDepth(6);
    ring2.lineStyle(2, 0xFFFFFF, 0.60);
    ring2.strokeCircle(cx, cy, 50);
    this.tweens.add({
      targets: ring2, scaleX: 4.2, scaleY: 4.2, alpha: 0,
      duration: 700, ease: 'Cubic.Out',
      onComplete: () => { ring2.destroy(); },
    });

    // Camera shake
    this.cameras.main.shake(250, 0.008);

    // Confetti rain (~30 pieces)
    const confettiColors = [0xFF5252, 0xFF9800, 0xFFEB3B, 0x4CAF50, 0x2196F3, 0xE91E63, 0x9C27B0, 0x00BCD4];
    for (let i = 0; i < 30; i++) {
      const cc = confettiColors[Math.floor(Math.random() * confettiColors.length)];
      const cg2 = this.add.graphics().setDepth(4);
      cg2.fillStyle(cc, 0.88);
      cg2.fillEllipse(0, 0, 8 + Math.random() * 6, 5 + Math.random() * 4);
      const startX = Math.random() * this.scale.width;
      cg2.setPosition(startX, -10 - Math.random() * 60);
      this.tweens.add({
        targets: cg2,
        y: this.scale.height + 60,
        x: startX + (Math.random() - 0.5) * 120,
        angle: (Math.random() - 0.5) * 540,
        alpha: { from: 1, to: 0.2 },
        duration: 1800 + Math.random() * 1400,
        delay: Math.random() * 400,
        ease: 'Linear',
        onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
      });
    }

    // Egg graphic fades out
    this.tweens.add({ targets: this._eggGraphic, scaleX: 1.4, scaleY: 1.4, alpha: 0, duration: 300 });
    sfx.hatch();

    // ── Monster creation & state update ──────────────────────────────────
    const egg = Game.state!.eggs.find(e => e.id === eggId)!;
    const mon = newMonster(egg.speciesId, egg.variantIndex, egg.source);
    const monMods = getVariantModifiers(mon.variantIndex);
    const isNewSpecies = !Game.state!.stats.discovered.includes(mon.speciesId);
    const goldenList = Game.state!.stats.goldenDiscovered ?? [];
    const isNewGolden = monMods.isGolden && !goldenList.includes(mon.speciesId);

    let diamondReward = 0;
    if (isNewSpecies) {
      if (Game.state!.newDiscoveries && !Game.state!.newDiscoveries.includes(String(mon.speciesId))) {
        Game.state!.newDiscoveries.push(String(mon.speciesId));
      }
      diamondReward = DIAMOND_NEW_SPECIES;
    } else if (isNewGolden) {
      goldenList.push(mon.speciesId);
      Game.state!.stats.goldenDiscovered = goldenList;
      if (Game.state!.newDiscoveries && !Game.state!.newDiscoveries.includes(String(mon.speciesId))) {
        Game.state!.newDiscoveries.push(String(mon.speciesId));
      }
      diamondReward = DIAMOND_NEW_COLOR;
    }

    if (diamondReward > 0) {
      if (Game.state!.diamonds === undefined) Game.state!.diamonds = 0;
      Game.state!.diamonds += diamondReward;
    }

    // ── Monster image reveal ──────────────────────────────────────────────
    preloadMonsterTexture(this, mon).then(texKey => {
      const W = this.scale.width, H = this.scale.height;

      const img = this.add.image(cx, cy, texKey).setDisplaySize(160, 160).setAlpha(0).setDepth(7);
      this.tweens.add({
        targets: img, alpha: 1,
        scaleX: { from: 0.2, to: 1 }, scaleY: { from: 0.2, to: 1 },
        duration: 550, ease: 'Back.Out',
      });
      this.tweens.add({
        targets: img, y: img.y - 10,
        duration: 1200, ease: 'Sine.InOut', yoyo: true, repeat: -1,
      });

      // ── Info card panel ────────────────────────────────────────────────
      const cardY = cy + 130;
      const cardH = diamondReward > 0 ? 118 : 96;

      this.time.delayedCall(300, () => {
        const cardG = this.add.graphics().setDepth(8).setAlpha(0);
        cardG.fillStyle(0x000000, 0.55);
        cardG.fillRoundedRect(W / 2 - 175, cardY - 8, 350, cardH, 16);
        cardG.fillStyle(0xFFFFFF, 0.05);
        cardG.fillRoundedRect(W / 2 - 173, cardY - 6, 346, cardH * 0.45, { tl: 14, tr: 14, bl: 0, br: 0 });

        const borderCol = monMods.isGolden ? 0xFFD700 : (isNewSpecies ? 0x44FFCC : 0x9966FF);
        cardG.lineStyle(2, borderCol, 0.80);
        cardG.strokeRoundedRect(W / 2 - 175, cardY - 8, 350, cardH, 16);
        this.tweens.add({ targets: cardG, alpha: 1, duration: 250, ease: 'Quad.Out' });

        // Species name
        const nameCol = isNewSpecies ? '#44FFCC' : (isNewGolden ? '#88EEFF' : (monMods.isGolden ? '#FFD700' : '#FFFFFF'));
        const nameT = this.add.text(W / 2, cardY + 16, sp.name, {
          fontFamily: FONT, fontSize: '24px', fontStyle: 'bold',
          color: nameCol, stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(9).setAlpha(0);
        this.tweens.add({ targets: nameT, alpha: 1, duration: 250, delay: 80 });

        // Badges row
        const habIcons: Record<string, string> = { dirt: '⛰', grass: '🌿', aquatic: '🌊' };
        const badgeStr = (habIcons[sp.habitat] ?? '') + '  ⏱' + sp.hatchHours + 'h'
          + (monMods.isGolden ? '  ✨ Golden!' : '')
          + (isNewSpecies ? '  🆕 New!' : '');
        const badgeT = this.add.text(W / 2, cardY + 44, badgeStr, {
          fontFamily: FONT, fontSize: '14px', color: '#CCBBFF',
        }).setOrigin(0.5).setDepth(9).setAlpha(0);
        this.tweens.add({ targets: badgeT, alpha: 1, duration: 250, delay: 140 });

        // Diamond reward
        if (diamondReward > 0) {
          const dT = this.add.text(W / 2, cardY + 68, t('hatch.diamonds', { n: diamondReward }) + ' 💎', {
            fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#88EEFF',
            stroke: '#000000', strokeThickness: 2,
          }).setOrigin(0.5).setDepth(9).setAlpha(0);
          this.tweens.add({ targets: dT, alpha: 1, duration: 250, delay: 200 });
        }

        // Continue button
        this.time.delayedCall(500, () => this._showContinueBtn(cx, eggId, mon, cardY + cardH + 32));
      });
    });
  }

  // ── Continue / name input ─────────────────────────────────────────────────

  private _showContinueBtn(cx: number, eggId: string, mon: any, btnY: number) {
    const W = this.scale.width, H = this.scale.height;
    const sp = SPECIES[mon.speciesId];

    this.add.text(cx, btnY, t('hatch.name'), {
      fontFamily: FONT, fontSize: '15px', color: '#CCBBFF',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);

    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleY = rect.height / H;
    const inputTop = rect.top + (btnY + 26) * scaleY;

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.placeholder = sp.name;
    inp.maxLength = 20;
    inp.style.cssText = [
      'position:fixed',
      'left:50%', 'top:' + inputTop + 'px',
      'transform:translateX(-50%)',
      'font-size:17px', 'padding:10px 14px',
      'border-radius:12px', 'border:2px solid #9060ff',
      'background:#1a0a3e', 'color:#fff',
      'width:220px', 'text-align:center',
      'z-index:9999', 'outline:none',
    ].join(';');
    document.body.appendChild(inp);
    inp.focus();

    const confirm = () => {
      const v = inp.value.trim();
      if (v && v !== sp.name) mon.nickname = v;
      try { document.body.removeChild(inp); } catch { /* ignore */ }
      const hub = this.game.scene.getScene('Hub') as any;
      if (hub) hub.onEggHatched(eggId, mon);
      this.scene.stop();
    };

    inp.addEventListener('keydown', (e: KeyboardEvent) => { if (e.key === 'Enter') confirm(); });

    const btn = makeButton(this, cx, btnY + 78, 220, 50, t('btn.letsGo'), 0x2a5030, confirm, 18);
    btn.setDepth(10).setAlpha(0);
    this.tweens.add({ targets: btn, alpha: 1, duration: 250 });

    this.events.once('shutdown', () => {
      try { document.body.removeChild(inp); } catch { /* ignore */ }
    });
  }
}
