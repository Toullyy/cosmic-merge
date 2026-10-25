import Phaser from 'phaser';
import { FONT } from '../utils';

function lighten(c: number, amt: number): number {
  return (Math.min(255, ((c >> 16) & 0xff) + amt) << 16) |
         (Math.min(255, ((c >>  8) & 0xff) + amt) <<  8) |
          Math.min(255, ( c        & 0xff) + amt);
}

function darken(c: number, amt: number): number {
  return (Math.max(0, ((c >> 16) & 0xff) - amt) << 16) |
         (Math.max(0, ((c >>  8) & 0xff) - amt) <<  8) |
          Math.max(0, ( c        & 0xff) - amt);
}

export class TitleScreen extends Phaser.Scene {
  constructor() { super({ key: 'TitleScreen' }); }

  create() {
    const W = this.scale.width, H = this.scale.height;

    // ── Background ────────────────────────────────────────────────────────
    const bg = this.add.graphics().setDepth(0);
    bg.fillStyle(0x040112, 1);
    bg.fillRect(0, 0, W, H);

    // Static stars
    for (let i = 0; i < 65; i++) {
      const sx = Math.random() * W, sy = Math.random() * H;
      bg.fillStyle(0xFFFFFF, 0.15 + Math.random() * 0.55);
      bg.fillCircle(sx, sy, 0.5 + Math.random() * 1.3);
    }

    // Nebula puffs
    bg.fillStyle(0x5511AA, 0.06); bg.fillCircle(W * 0.15, H * 0.20, 160);
    bg.fillStyle(0x2233CC, 0.04); bg.fillCircle(W * 0.82, H * 0.65, 140);
    bg.fillStyle(0x991166, 0.03); bg.fillCircle(W * 0.50, H * 0.50, 180);

    // Twinkling stars
    for (let i = 0; i < 22; i++) {
      const tg = this.add.graphics().setDepth(0);
      const tx = 30 + Math.random() * (W - 60), ty = 30 + Math.random() * (H - 60);
      tg.fillStyle(0xFFFFFF, 0.65);
      tg.fillCircle(tx, ty, 0.8 + Math.random() * 1.0);
      this.tweens.add({
        targets: tg, alpha: { from: 0.15, to: 0.85 },
        duration: 800 + Math.random() * 1600, yoyo: true, repeat: -1,
        ease: 'Sine.InOut', delay: Math.random() * 1400,
      });
    }

    // ── Sparkle particles (depth 1) ───────────────────────────────────────
    for (let i = 0; i < 12; i++) {
      const spark = this.add.graphics().setDepth(1);
      const sx = 40 + Math.random() * 460, sy = 100 + Math.random() * 760;
      spark.fillStyle(0xFFFFFF, 0.65); spark.fillCircle(sx, sy, 1.5);
      spark.fillStyle(0xCC88FF, 0.40); spark.fillCircle(sx, sy, 3);
      this.tweens.add({
        targets: spark,
        alpha: { from: 0.10, to: 0.80 },
        y: `-=${20 + Math.random() * 30}`,
        duration: 1800 + Math.random() * 2200, yoyo: true, repeat: -1,
        ease: 'Sine.InOut', delay: Math.random() * 2000,
      });
    }

    // ── Title area (depth 2-3) ────────────────────────────────────────────
    this.add.text(W / 2, 148, '🐾', {
      fontFamily: FONT, fontSize: '58px',
    }).setOrigin(0.5).setDepth(3);

    // Glow shadow
    this.add.text(W / 2 + 2, 222, 'Monster Pet Shop', {
      fontFamily: FONT, fontSize: '42px', fontStyle: 'bold', color: '#9955FF',
    }).setOrigin(0.5).setDepth(2).setAlpha(0.55);

    // Main title
    this.add.text(W / 2, 220, 'Monster Pet Shop', {
      fontFamily: FONT, fontSize: '42px', fontStyle: 'bold', color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(3);

    // Subtitle
    this.add.text(W / 2, 270, 'เลี้ยง • ขาย • สะสมมอนสเตอร์แฟนตาซี', {
      fontFamily: FONT, fontSize: '17px', color: '#BB88FF',
    }).setOrigin(0.5).setDepth(3);

    // ── Floating eggs ────────────────────────────────────────────────────
    const EGG_DEFS = [
      { ex: W / 2 - 130, ey: 430, color: 0xFF9900 },
      { ex: W / 2,        ey: 415, color: 0x66EE33 },
      { ex: W / 2 + 130, ey: 430, color: 0x22CCFF },
    ];

    EGG_DEFS.forEach(({ ex, ey, color }, i) => {
      const lc = lighten(color, 40);
      const dc = darken(color, 50);
      const g = this.add.graphics().setDepth(3);

      g.fillStyle(color, 0.12); g.fillEllipse(ex, ey, 70, 86);
      g.fillStyle(color, 0.18); g.fillEllipse(ex, ey, 56, 70);
      g.fillStyle(lc, 1);       g.fillEllipse(ex, ey, 44, 56);
      g.lineStyle(2.5, dc, 1);  g.strokeEllipse(ex, ey, 44, 56);
      g.fillStyle(0xFFFFFF, 0.55); g.fillEllipse(ex - 8, ey - 12, 14, 10);

      // Speckles
      g.fillStyle(dc, 0.55);
      g.fillCircle(ex - 6, ey + 14, 3);
      g.fillCircle(ex + 8, ey + 10, 2.5);
      g.fillCircle(ex,     ey + 18, 2);

      // Crack hint
      g.lineStyle(1.5, dc, 0.35);
      g.beginPath(); g.moveTo(ex - 4, ey - 6); g.lineTo(ex,     ey);     g.lineTo(ex - 6, ey + 6);  g.strokePath();
      g.beginPath(); g.moveTo(ex + 2, ey - 4); g.lineTo(ex + 6, ey + 2); g.strokePath();

      this.tweens.add({
        targets: g, y: '+=12',
        duration: 1600 + i * 200, yoyo: true, repeat: -1,
        ease: 'Sine.InOut', delay: i * 300,
      });
    });

    // ── Start button (depth 4) ────────────────────────────────────────────
    const btnG = this.add.graphics().setDepth(4);
    btnG.fillStyle(0x6600CC, 0.20); btnG.fillRoundedRect(W / 2 - 185, 625, 370, 74, 37);
    btnG.fillStyle(0x3300AA, 1);    btnG.fillRoundedRect(W / 2 - 175, 627, 350, 70, 35);
    btnG.fillStyle(0xFFFFFF, 0.08); btnG.fillRoundedRect(W / 2 - 175, 627, 350, 36, { tl: 35, tr: 35, bl: 0, br: 0 });
    btnG.lineStyle(2, 0x9944FF, 0.90); btnG.strokeRoundedRect(W / 2 - 175, 627, 350, 70, 35);

    this.add.text(W / 2, 663, '▶  เริ่มเล่น', {
      fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#FFFFFF',
    }).setOrigin(0.5).setDepth(5);

    this.tweens.add({
      targets: btnG,
      scaleX: { from: 1.0, to: 1.025 }, scaleY: { from: 1.0, to: 1.025 },
      duration: 850, yoyo: true, repeat: -1, ease: 'Sine.InOut',
    });

    // ── Interactivity ────────────────────────────────────────────────────
    this.add.rectangle(W / 2, H / 2, W, H)
      .setAlpha(0.001).setDepth(10).setInteractive()
      .on('pointerdown', () => this._goToGame());

    this.add.zone(W / 2, 663, 360, 80)
      .setDepth(11).setInteractive()
      .on('pointerdown', () => this._goToGame());

    // ── Version ───────────────────────────────────────────────────────────
    this.add.text(W / 2, H - 30, 'Monster Pet Shop  v0.1', {
      fontFamily: FONT, fontSize: '11px', color: '#443366',
    }).setOrigin(0.5).setDepth(2);
  }

  private _goToGame() {
    if ((this as any)._leaving) return;
    (this as any)._leaving = true;
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('Hub');
    });
  }
}
