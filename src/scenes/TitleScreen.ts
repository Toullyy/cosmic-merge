import Phaser from 'phaser';
import { FONT } from '../utils';
import { SPECIES } from '../data';
import { preloadMonsterTexture } from '../MonsterRenderer';
import type { Monster } from '../types';

export class TitleScreen extends Phaser.Scene {
  private _monsterImgs: Phaser.GameObjects.Image[] = [];
  private _stripSpeed = 0.6;

  constructor() { super({ key: 'TitleScreen' }); }

  create() {
    const W = this.scale.width, H = this.scale.height;

    // ── depth 0: Sky ──────────────────────────────────────────────────────
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x5BB8F5, 0x5BB8F5, 0x9ADCFF, 0x9ADCFF, 1);
    bg.fillRect(0, 0, W, 560);
    bg.fillGradientStyle(0xC8EEFF, 0xC8EEFF, 0x7FCC55, 0x7FCC55, 1);
    bg.fillRect(0, 340, W, 80);

    // ── depth 0: Clouds ───────────────────────────────────────────────────
    const cg = this.add.graphics().setDepth(0);
    const drawCloud = (cx: number, cy: number, s: number) => {
      cg.fillStyle(0xE8F8FF, 0.6);
      cg.fillCircle(cx, cy + 8 * s, 28 * s);
      cg.fillStyle(0xFFFFFF, 1);
      cg.fillCircle(cx - 20 * s, cy + 4 * s, 24 * s);
      cg.fillCircle(cx + 4 * s,  cy - 4 * s, 32 * s);
      cg.fillCircle(cx + 28 * s, cy + 2 * s, 26 * s);
      cg.fillCircle(cx - 2 * s,  cy + 14 * s, 22 * s);
    };
    drawCloud(110, 80,  1.0);
    drawCloud(390, 60,  0.80);
    drawCloud(260, 50,  0.60);
    drawCloud(440, 110, 0.55);
    drawCloud(50,  110, 0.75);

    // ── depth 1: Far hills ────────────────────────────────────────────────
    const hills = this.add.graphics().setDepth(1);
    hills.fillStyle(0x3A8A28, 1);
    hills.fillPoints([
      { x: 0,   y: 420 }, { x: 60,  y: 370 }, { x: 150, y: 350 },
      { x: 270, y: 330 }, { x: 390, y: 355 }, { x: 480, y: 365 },
      { x: 540, y: 340 }, { x: 540, y: 560 }, { x: 0,   y: 560 },
    ], true);
    hills.fillStyle(0x4AAF38, 0.5);
    hills.fillPoints([
      { x: 0,   y: 460 }, { x: 80,  y: 410 }, { x: 200, y: 390 },
      { x: 320, y: 400 }, { x: 420, y: 385 }, { x: 540, y: 395 },
      { x: 540, y: 560 }, { x: 0,   y: 560 },
    ], true);

    // ── depth 2: Castle ───────────────────────────────────────────────────
    const castle = this.add.graphics().setDepth(2);
    castle.fillStyle(0xB8C8E8, 0.85);
    castle.fillRect(248, 290, 44, 70);
    castle.fillTriangle(248, 290, 292, 290, 270, 258);
    castle.fillRect(226, 308, 26, 52);
    castle.fillTriangle(226, 308, 252, 308, 239, 282);
    castle.fillRect(294, 308, 26, 52);
    castle.fillTriangle(294, 308, 320, 308, 307, 282);
    castle.fillStyle(0x8898B8, 0.7);
    castle.fillRect(260, 312, 20, 24);
    castle.fillRect(232, 322, 12, 16);
    castle.fillRect(298, 322, 12, 16);
    castle.fillStyle(0xC8EEFF, 0.30);
    castle.fillRect(200, 340, 140, 30);

    // ── depth 3: Trees ────────────────────────────────────────────────────
    const trees = this.add.graphics().setDepth(3);
    const drawTree = (tx: number, ty: number, s: number) => {
      trees.fillStyle(0x6B3A1A, 1); trees.fillRect(tx - 6 * s, ty, 12 * s, 32 * s);
      trees.fillStyle(0x8B5A2A, 1); trees.fillRect(tx - 5 * s, ty + 2, 5 * s, 28 * s);
      trees.fillStyle(0x2E7A18, 1); trees.fillCircle(tx, ty - 8 * s, 30 * s);
      trees.fillStyle(0x3A9A22, 1); trees.fillCircle(tx + 2, ty - 20 * s, 24 * s);
      trees.fillStyle(0x4AB82A, 1); trees.fillCircle(tx - 2, ty - 30 * s, 18 * s);
      trees.fillStyle(0x72D840, 0.45); trees.fillCircle(tx - 6, ty - 26 * s, 10 * s);
    };
    drawTree(30,  480, 1.3); drawTree(80,  510, 1.1); drawTree(-10, 520, 0.9);
    drawTree(510, 490, 1.2); drawTree(555, 515, 1.0); drawTree(490, 520, 1.4);
    drawTree(120, 490, 0.85); drawTree(420, 500, 0.90);

    // ── depth 4: Ground + path ────────────────────────────────────────────
    const ground = this.add.graphics().setDepth(4);
    ground.fillStyle(0x5CC830, 1);
    ground.fillPoints([
      { x: 0, y: 580 }, { x: 0, y: 960 }, { x: 540, y: 960 },
      { x: 540, y: 560 }, { x: 400, y: 555 }, { x: 270, y: 545 }, { x: 140, y: 555 },
    ], true);
    ground.fillStyle(0x78E840, 0.45);
    ground.fillPoints([
      { x: 0, y: 575 }, { x: 130, y: 550 }, { x: 270, y: 542 },
      { x: 410, y: 552 }, { x: 540, y: 558 }, { x: 540, y: 600 }, { x: 0, y: 608 },
    ], true);
    ground.fillStyle(0xC8A050, 1);
    ground.fillPoints([
      { x: 195, y: 960 }, { x: 345, y: 960 }, { x: 295, y: 700 },
      { x: 255, y: 650 }, { x: 260, y: 600 }, { x: 275, y: 580 }, { x: 265, y: 580 },
    ], true);
    ground.fillStyle(0xAA8835, 0.45);
    ground.fillPoints([
      { x: 260, y: 960 }, { x: 295, y: 960 }, { x: 278, y: 700 }, { x: 268, y: 650 },
    ], true);
    ground.lineStyle(2, 0xE8C870, 0.55);
    ground.beginPath(); ground.moveTo(200, 960); ground.lineTo(258, 580); ground.strokePath();

    // ── depth 5: Flowers ──────────────────────────────────────────────────
    const flowers = this.add.graphics().setDepth(5);
    ([
      { x: 60,  y: 680, petals: 0xFF4488, center: 0xFFEE00 },
      { x: 100, y: 720, petals: 0xFF8800, center: 0xFFFF44 },
      { x: 145, y: 695, petals: 0xFF2266, center: 0xFFDD00 },
      { x: 380, y: 685, petals: 0x8844FF, center: 0xFFFF44 },
      { x: 430, y: 710, petals: 0xFF4488, center: 0xFFCC00 },
      { x: 470, y: 690, petals: 0x44AAFF, center: 0xFFFF66 },
      { x: 180, y: 740, petals: 0xFF6600, center: 0xFFEE00 },
      { x: 360, y: 740, petals: 0xFF3399, center: 0xFFFF44 },
    ] as { x: number; y: number; petals: number; center: number }[]).forEach(f => {
      flowers.lineStyle(2, 0x2A8A10, 1);
      flowers.beginPath(); flowers.moveTo(f.x, f.y + 20); flowers.lineTo(f.x, f.y + 42); flowers.strokePath();
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        flowers.fillStyle(f.petals, 1);
        flowers.fillCircle(f.x + Math.cos(a) * 7, f.y + Math.sin(a) * 7, 5.5);
      }
      flowers.fillStyle(f.center, 1); flowers.fillCircle(f.x, f.y, 5);
      flowers.lineStyle(1, 0xAA7700, 0.5); flowers.strokeCircle(f.x, f.y, 5);
    });

    // ── depth 6-7: Title ──────────────────────────────────────────────────
    this.add.text(W / 2 + 4, 178, 'Monster\nPet Shop', {
      fontFamily: '"Arial Black", "Impact", sans-serif',
      fontSize: '68px', fontStyle: 'bold', color: '#4A1A00', align: 'center',
    }).setOrigin(0.5).setAlpha(0.55).setDepth(6);

    const titleTxt = this.add.text(W / 2, 174, 'Monster\nPet Shop', {
      fontFamily: '"Arial Black", "Impact", sans-serif',
      fontSize: '68px', fontStyle: 'bold', color: '#FFD700',
      stroke: '#8B3A00', strokeThickness: 10, align: 'center',
      shadow: { offsetX: 0, offsetY: 4, color: '#FF6600', blur: 0, stroke: false, fill: true },
    }).setOrigin(0.5).setDepth(7);
    this.tweens.add({ targets: titleTxt, y: '+=6', duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.add.text(W / 2, 308, '✨ เลี้ยง • ขาย • สะสมมอนสเตอร์น่ารัก ✨', {
      fontFamily: FONT, fontSize: '16px', color: '#FFFFFF',
      stroke: '#2A5A00', strokeThickness: 4,
      shadow: { offsetX: 1, offsetY: 2, color: '#004400', blur: 0, stroke: false, fill: true },
    }).setOrigin(0.5).setDepth(7);

    // ── depth 7: Sparkles ─────────────────────────────────────────────────
    const sparkColors = [0xFFFF88, 0xFFCC44, 0x88FFCC, 0xFF88CC, 0x88CCFF];
    for (let i = 0; i < 25; i++) {
      const sx = 30 + Math.random() * 480;
      const sy = 380 + Math.random() * 340; // keep above monster strip
      if (sx > 210 && sx < 330 && sy > 600) continue;
      const sg = this.add.graphics().setDepth(7);
      const sc = sparkColors[Math.floor(Math.random() * sparkColors.length)];
      sg.fillStyle(sc, 0.90); sg.fillCircle(sx, sy, 2.5);
      sg.fillStyle(0xFFFFFF, 0.70); sg.fillCircle(sx, sy, 1.2);
      this.tweens.add({
        targets: sg, alpha: { from: 0.1, to: 1 },
        scaleX: { from: 0.5, to: 1.2 }, scaleY: { from: 0.5, to: 1.2 },
        y: `-=${15 + Math.random() * 20}`,
        duration: 1200 + Math.random() * 1800, yoyo: true, repeat: -1,
        ease: 'Sine.InOut', delay: Math.random() * 2000,
      });
    }

    // ── depth 8: Start button (moved up to y=730 to leave room for strip) ─
    const btnG = this.add.graphics().setDepth(8);
    btnG.fillStyle(0xFFAA00, 0.30); btnG.fillRoundedRect(W / 2 - 155, 725, 310, 70, 35);
    btnG.fillStyle(0xAA4400, 1);    btnG.fillRoundedRect(W / 2 - 150, 738, 300, 62, 30);
    btnG.fillStyle(0xFF8800, 1);    btnG.fillRoundedRect(W / 2 - 150, 730, 300, 58, 30);
    btnG.fillStyle(0xFFCC44, 0.50); btnG.fillRoundedRect(W / 2 - 148, 732, 296, 26, { tl: 28, tr: 28, bl: 0, br: 0 });
    btnG.lineStyle(3, 0xFFEE44, 0.90); btnG.strokeRoundedRect(W / 2 - 150, 730, 300, 58, 30);
    this.add.text(W / 2, 760, '▶  เริ่มเล่น !', {
      fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#FFFFFF',
      stroke: '#882200', strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 3, color: '#CC4400', blur: 0, stroke: false, fill: true },
    }).setOrigin(0.5).setDepth(9);

    // ── Interactivity ─────────────────────────────────────────────────────
    this.add.rectangle(W / 2, H / 2, W, H)
      .setAlpha(0.001).setDepth(10).setInteractive()
      .on('pointerdown', () => this._goToGame());
    this.add.zone(W / 2, 760, 310, 64)
      .setDepth(11).setInteractive()
      .on('pointerdown', () => this._goToGame());

    // ── Version ───────────────────────────────────────────────────────────
    this.add.text(W / 2, H - 8, 'Monster Pet Shop  v0.1', {
      fontFamily: FONT, fontSize: '10px', color: '#FFEEAA',
      stroke: '#224400', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(12);

    this._buildMonsterStrip();
  }

  update() {
    if (this._monsterImgs.length === 0) return;
    const totalW = this._monsterImgs.length * 76;
    this._monsterImgs.forEach(img => {
      img.x -= this._stripSpeed;
      if (img.x < -44) img.x += totalW;
    });
  }

  private _buildMonsterStrip() {
    const W       = this.scale.width;
    const STRIP_Y = 878;
    const CELL_W  = 76;
    const ICON_SZ = 58;

    // Dark backdrop bar
    const bar = this.add.graphics().setDepth(9);
    bar.fillStyle(0x000000, 0.38);
    bar.fillRect(0, STRIP_Y - 36, W, 72);
    bar.lineStyle(1.5, 0xFFFFFF, 0.18);
    bar.lineBetween(0, STRIP_Y - 36, W, STRIP_Y - 36);
    bar.lineBetween(0, STRIP_Y + 36, W, STRIP_Y + 36);
    this.add.text(10, STRIP_Y - 29, '✨ ALL MONSTERS', {
      fontFamily: FONT, fontSize: '10px', color: '#FFEEAA',
    }).setDepth(11);

    const fakeMonsters = SPECIES.map(sp => ({
      id: 'title_' + sp.id,
      speciesId: sp.id,
      variantIndex: 6,
      habitatType: sp.habitat,
      level: 1, xp: 0, happiness: 100, hunger: 100, cleanliness: 100,
      lastCaredAt: 0, source: 'title',
    })) as unknown as Monster[];

    Promise.all(fakeMonsters.map(m => preloadMonsterTexture(this, m)))
      .then(keys => {
        if (!this.scene.isActive('TitleScreen')) return;
        const allKeys = [...keys, ...keys];
        allKeys.forEach((key, i) => {
          const img = this.add.image(-44 + i * CELL_W + CELL_W / 2, STRIP_Y, key)
            .setDisplaySize(ICON_SZ, ICON_SZ)
            .setDepth(10);
          this._monsterImgs.push(img);
          this.tweens.add({
            targets: img, y: STRIP_Y - 5,
            duration: 900 + (i % 7) * 120,
            yoyo: true, repeat: -1, ease: 'Sine.InOut',
            delay: (i % 13) * 80,
          });
        });
      });
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
