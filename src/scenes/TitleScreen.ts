import Phaser from 'phaser';
import { FONT } from '../utils';
import { SPECIES } from '../data';
import { preloadMonsterTexture } from '../MonsterRenderer';
import type { Monster } from '../types';

export class TitleScreen extends Phaser.Scene {
  private _monsterImgs: Phaser.GameObjects.Image[] = [];
  private _stripSpeed = 0.55;

  constructor() { super({ key: 'TitleScreen' }); }

  create() {
    const W = this.scale.width, H = this.scale.height;

    // ── depth 0: Twilight sky ─────────────────────────────────────────────
    const bg = this.add.graphics().setDepth(0);
    // Deep purple-blue night sky at top
    bg.fillGradientStyle(0x1A0A3E, 0x1A0A3E, 0x2A5AA8, 0x2A5AA8, 1);
    bg.fillRect(0, 0, W, 320);
    // Royal blue to horizon blue
    bg.fillGradientStyle(0x2A5AA8, 0x2A5AA8, 0x5ABFF5, 0x5ABFF5, 1);
    bg.fillRect(0, 320, W, 180);
    // Warm orange glow at horizon
    bg.fillGradientStyle(0xFF8844, 0xFF8844, 0xFFBB66, 0xFFBB66, 1);
    bg.fillRect(0, 440, W, 80);
    bg.fillGradientStyle(0xFFBB66, 0xFFBB66, 0x7ED848, 0x7ED848, 1);
    bg.fillRect(0, 500, W, 60);

    // ── depth 0: Moon ─────────────────────────────────────────────────────
    const moon = this.add.graphics().setDepth(0);
    moon.fillStyle(0xFFFFCC, 0.18); moon.fillCircle(420, 70, 52);
    moon.fillStyle(0xFFFFEE, 0.32); moon.fillCircle(420, 70, 42);
    moon.fillStyle(0xFFFFF8, 1);    moon.fillCircle(420, 70, 34);
    moon.fillStyle(0xFFFFDD, 0.60); moon.fillCircle(416, 66, 22);
    // Moon glow
    moon.fillStyle(0xFFFFAA, 0.06); moon.fillCircle(420, 70, 80);
    moon.fillStyle(0xFFFFCC, 0.04); moon.fillCircle(420, 70, 110);

    // ── depth 0: Stars ────────────────────────────────────────────────────
    const stars = this.add.graphics().setDepth(0);
    const starPositions: [number, number, number][] = [
      [50, 30, 2.2], [110, 55, 1.6], [160, 20, 1.8], [220, 45, 1.4],
      [280, 15, 2.0], [340, 38, 1.5], [390, 22, 1.6], [470, 48, 2.0],
      [510, 18, 1.4], [32, 90, 1.6], [80, 110, 1.3], [180, 105, 1.7],
      [310, 90, 1.5], [380, 118, 1.3], [490, 98, 1.8], [540, 68, 1.5],
      [460, 145, 1.4], [130, 148, 1.6], [240, 168, 1.3], [70, 175, 1.4],
    ];
    starPositions.forEach(([sx, sy, sr]) => {
      stars.fillStyle(0xFFFFFF, 0.90); stars.fillCircle(sx, sy, sr);
      stars.fillStyle(0xFFFFCC, 0.50); stars.fillCircle(sx, sy, sr * 2.2);
    });
    // Twinkle the stars
    this.time.addEvent({
      delay: 180, loop: true,
      callback: () => {
        const [sx, sy] = starPositions[Math.floor(Math.random() * starPositions.length)];
        const twinkle = this.add.graphics().setDepth(0);
        twinkle.fillStyle(0xFFFFFF, 0.80); twinkle.fillCircle(sx, sy, 3.5);
        this.tweens.add({
          targets: twinkle, alpha: 0, scaleX: 2, scaleY: 2,
          duration: 600, ease: 'Quad.Out',
          onComplete: () => { try { twinkle.destroy(); } catch { /**/ } },
        });
      },
    });

    // ── depth 1: Clouds ───────────────────────────────────────────────────
    const cg = this.add.graphics().setDepth(1);
    const drawCloud = (cx: number, cy: number, s: number, alpha = 0.88) => {
      cg.fillStyle(0x8899CC, alpha * 0.35); cg.fillCircle(cx, cy + 9 * s, 30 * s);
      cg.fillStyle(0xCCDDFF, alpha * 0.65);
      cg.fillCircle(cx - 22 * s, cy + 4 * s,  25 * s);
      cg.fillCircle(cx + 4 * s,  cy - 4 * s,  33 * s);
      cg.fillCircle(cx + 28 * s, cy + 2 * s,  27 * s);
      cg.fillCircle(cx - 2 * s,  cy + 14 * s, 22 * s);
      cg.fillStyle(0xEEF4FF, alpha * 0.80);
      cg.fillCircle(cx + 6 * s,  cy + 2 * s,  20 * s);
    };
    drawCloud(90,  100, 1.0); drawCloud(370, 80,  0.80);
    drawCloud(260, 65,  0.65); drawCloud(460, 125, 0.55);
    drawCloud(22,  130, 0.75);

    // ── depth 2: Far hills ────────────────────────────────────────────────
    const hills = this.add.graphics().setDepth(2);
    hills.fillStyle(0x1A5218, 1);
    hills.fillPoints([
      { x: 0, y: 430 }, { x: 55, y: 375 }, { x: 140, y: 352 },
      { x: 265, y: 328 }, { x: 385, y: 355 }, { x: 475, y: 368 },
      { x: 540, y: 342 }, { x: 540, y: 570 }, { x: 0, y: 570 },
    ], true);
    hills.fillStyle(0x2A7228, 0.6);
    hills.fillPoints([
      { x: 0, y: 468 }, { x: 75, y: 415 }, { x: 195, y: 392 },
      { x: 318, y: 402 }, { x: 420, y: 388 }, { x: 540, y: 398 },
      { x: 540, y: 570 }, { x: 0, y: 570 },
    ], true);

    // ── depth 3: Castle ───────────────────────────────────────────────────
    const castle = this.add.graphics().setDepth(3);
    // Castle glow aura
    castle.fillStyle(0xCCDDFF, 0.10); castle.fillCircle(270, 310, 90);
    castle.fillStyle(0xB0C8F0, 0.92);
    // Main tower
    castle.fillRect(248, 286, 44, 74);
    castle.fillTriangle(248, 286, 292, 286, 270, 252);
    // Side towers
    castle.fillRect(224, 306, 26, 54); castle.fillTriangle(224, 306, 250, 306, 237, 278);
    castle.fillRect(290, 306, 26, 54); castle.fillTriangle(290, 306, 316, 306, 303, 278);
    // Windows (lit from inside)
    castle.fillStyle(0xFFEE88, 0.90);
    castle.fillRect(260, 312, 20, 22);
    castle.fillRect(231, 326, 11, 14);
    castle.fillRect(298, 326, 11, 14);
    // Window inner glow
    castle.fillStyle(0xFFFF99, 0.35); castle.fillCircle(270, 323, 14);
    castle.fillStyle(0xFFFF99, 0.25); castle.fillCircle(237, 333, 8);
    castle.fillStyle(0xFFFF99, 0.25); castle.fillCircle(304, 333, 8);
    // Fog/mist base
    castle.fillStyle(0xCCEEFF, 0.22); castle.fillRect(190, 340, 160, 30);

    // ── depth 3: Trees ────────────────────────────────────────────────────
    const trees = this.add.graphics().setDepth(3);
    const drawTree = (tx: number, ty: number, s: number) => {
      trees.fillStyle(0x3A1808, 1); trees.fillRect(tx - 6 * s, ty, 12 * s, 32 * s);
      trees.fillStyle(0x1A4A10, 1); trees.fillCircle(tx, ty - 8 * s, 30 * s);
      trees.fillStyle(0x2A6A18, 1); trees.fillCircle(tx + 2, ty - 20 * s, 24 * s);
      trees.fillStyle(0x3A8A22, 1); trees.fillCircle(tx - 2, ty - 30 * s, 18 * s);
      trees.fillStyle(0x5AB030, 0.50); trees.fillCircle(tx - 5, ty - 26 * s, 10 * s);
    };
    drawTree(28,  485, 1.35); drawTree(80,  512, 1.12); drawTree(-12, 524, 0.92);
    drawTree(508, 492, 1.22); drawTree(558, 518, 1.02); drawTree(488, 522, 1.42);
    drawTree(122, 494, 0.88); drawTree(425, 503, 0.92);

    // ── depth 4: Ground + path ────────────────────────────────────────────
    const ground = this.add.graphics().setDepth(4);
    ground.fillStyle(0x5CC830, 1);
    ground.fillPoints([
      { x: 0, y: 580 }, { x: 0, y: 960 }, { x: 540, y: 960 },
      { x: 540, y: 562 }, { x: 400, y: 556 }, { x: 270, y: 546 }, { x: 140, y: 556 },
    ], true);
    ground.fillStyle(0x7AE840, 0.50);
    ground.fillPoints([
      { x: 0, y: 576 }, { x: 130, y: 550 }, { x: 270, y: 542 },
      { x: 410, y: 552 }, { x: 540, y: 560 }, { x: 540, y: 600 }, { x: 0, y: 608 },
    ], true);
    // Dirt path
    ground.fillStyle(0xC8A050, 1);
    ground.fillPoints([
      { x: 194, y: 960 }, { x: 346, y: 960 }, { x: 296, y: 700 },
      { x: 254, y: 648 }, { x: 260, y: 598 }, { x: 272, y: 579 }, { x: 266, y: 580 },
    ], true);
    ground.fillStyle(0xAA8835, 0.42);
    ground.fillPoints([
      { x: 260, y: 960 }, { x: 296, y: 960 }, { x: 278, y: 700 }, { x: 268, y: 650 },
    ], true);
    // Path edge lines
    ground.lineStyle(1.8, 0xE8C870, 0.45);
    ground.beginPath(); ground.moveTo(200, 960); ground.lineTo(256, 580); ground.strokePath();
    ground.lineStyle(1.8, 0xE8C870, 0.45);
    ground.beginPath(); ground.moveTo(340, 960); ground.lineTo(284, 580); ground.strokePath();

    // ── depth 5: Flowers ──────────────────────────────────────────────────
    const flowers = this.add.graphics().setDepth(5);
    ([
      { x: 56,  y: 675, pc: 0xFF4488, cc: 0xFFEE00 },
      { x: 98,  y: 718, pc: 0xFF8800, cc: 0xFFFF44 },
      { x: 148, y: 692, pc: 0xFF2266, cc: 0xFFDD00 },
      { x: 380, y: 682, pc: 0xAA44FF, cc: 0xFFFF44 },
      { x: 434, y: 708, pc: 0xFF4488, cc: 0xFFCC00 },
      { x: 472, y: 688, pc: 0x44AAFF, cc: 0xFFFF66 },
      { x: 182, y: 742, pc: 0xFF6600, cc: 0xFFEE00 },
      { x: 360, y: 738, pc: 0xFF3399, cc: 0xFFFF44 },
      { x: 500, y: 728, pc: 0x88AAFF, cc: 0xFFEE88 },
      { x: 36,  y: 720, pc: 0xFFAA44, cc: 0xFFFF44 },
    ] as { x: number; y: number; pc: number; cc: number }[]).forEach(f => {
      flowers.lineStyle(2, 0x2A8A10, 1);
      flowers.beginPath(); flowers.moveTo(f.x, f.y + 20); flowers.lineTo(f.x, f.y + 42); flowers.strokePath();
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        flowers.fillStyle(f.pc, 1);
        flowers.fillCircle(f.x + Math.cos(a) * 7, f.y + Math.sin(a) * 7, 5.5);
      }
      flowers.fillStyle(f.cc, 1); flowers.fillCircle(f.x, f.y, 5);
    });

    // ── depth 5: Magic shimmer particles on ground ────────────────────────
    const shimmerColors = [0xFFFF88, 0xFFCC44, 0x88FFCC, 0xFF88CC, 0x88CCFF, 0xFFAA44];
    for (let i = 0; i < 30; i++) {
      const sx = 20 + Math.random() * 500;
      const sy = 560 + Math.random() * 320;
      if (sx > 208 && sx < 332 && sy > 600 && sy < 840) continue;
      const sg = this.add.graphics().setDepth(5);
      const sc = shimmerColors[Math.floor(Math.random() * shimmerColors.length)];
      sg.fillStyle(sc, 0.85); sg.fillCircle(0, 0, 2.2);
      sg.fillStyle(0xFFFFFF, 0.60); sg.fillCircle(0, 0, 1.0);
      sg.setPosition(sx, sy);
      this.tweens.add({
        targets: sg, alpha: { from: 0.1, to: 0.95 },
        scaleX: { from: 0.4, to: 1.4 }, scaleY: { from: 0.4, to: 1.4 },
        y: `-=${12 + Math.random() * 18}`,
        duration: 1100 + Math.random() * 1800, yoyo: true, repeat: -1,
        ease: 'Sine.InOut', delay: Math.random() * 2200,
      });
    }

    // ── depth 6: Title scroll/banner decoration ───────────────────────────
    const banner = this.add.graphics().setDepth(6);
    // Outer glow
    banner.fillStyle(0xFF8800, 0.08); banner.fillRoundedRect(W/2 - 230, 108, 460, 230, 24);
    banner.fillStyle(0xFF6600, 0.05); banner.fillRoundedRect(W/2 - 245, 100, 490, 246, 28);
    // Scroll body
    banner.fillStyle(0x2A0A00, 0.55); banner.fillRoundedRect(W/2 - 222, 114, 444, 218, 18);
    banner.fillStyle(0x5C1E00, 0.22); banner.fillRoundedRect(W/2 - 220, 116, 440, 214, 16);
    // Scroll highlight (top sheen)
    banner.fillStyle(0xFFFFFF, 0.06); banner.fillRoundedRect(W/2 - 218, 116, 436, 60, { tl: 16, tr: 16, bl: 0, br: 0 });
    // Scroll border
    banner.lineStyle(2.5, 0xFF9922, 0.70); banner.strokeRoundedRect(W/2 - 220, 116, 440, 214, 16);
    banner.lineStyle(1, 0xFFCC66, 0.35); banner.strokeRoundedRect(W/2 - 215, 121, 430, 204, 12);
    // Corner ornaments
    ([[W/2 - 220, 116], [W/2 + 220, 116], [W/2 - 220, 330], [W/2 + 220, 330]] as [number,number][]).forEach(([cx, cy]) => {
      banner.fillStyle(0xFFAA33, 0.80); banner.fillCircle(cx, cy, 8);
      banner.fillStyle(0xFFDD88, 0.65); banner.fillCircle(cx, cy, 5);
      banner.lineStyle(1.5, 0xFF8800, 0.60); banner.strokeCircle(cx, cy, 8);
    });

    // ── depth 7: Title text ───────────────────────────────────────────────
    // Shadow/depth layer
    this.add.text(W / 2 + 4, 200, 'Monster\nPet Shop', {
      fontFamily: '"Arial Black", "Impact", sans-serif',
      fontSize: '66px', fontStyle: 'bold', color: '#3A0E00', align: 'center',
    }).setOrigin(0.5).setAlpha(0.45).setDepth(7);

    const titleTxt = this.add.text(W / 2, 196, 'Monster\nPet Shop', {
      fontFamily: '"Arial Black", "Impact", sans-serif',
      fontSize: '66px', fontStyle: 'bold', color: '#FFD700',
      stroke: '#8B2200', strokeThickness: 11, align: 'center',
      shadow: { offsetX: 0, offsetY: 5, color: '#FF6600', blur: 0, stroke: false, fill: true },
    }).setOrigin(0.5).setDepth(8);
    this.tweens.add({ targets: titleTxt, y: '+=6', duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // Stars flanking the title
    for (let side = -1; side <= 1; side += 2) {
      for (let si = 0; si < 3; si++) {
        const sz = 14 + si * 8;
        const sxt = W / 2 + side * (148 + si * 28);
        const syt = 180 + si * 14;
        const sg = this.add.text(sxt, syt, '✦', {
          fontFamily: FONT, fontSize: sz + 'px',
          color: side > 0 ? '#FFDD44' : '#FF88CC',
        }).setOrigin(0.5).setDepth(8).setAlpha(0.80);
        this.tweens.add({
          targets: sg, alpha: { from: 0.3, to: 1 }, scaleX: 1.2, scaleY: 1.2,
          duration: 900 + si * 200, yoyo: true, repeat: -1, ease: 'Sine.InOut',
          delay: si * 280 + (side > 0 ? 0 : 150),
        });
      }
    }

    // Subtitle
    this.add.text(W / 2, 316, '✨ เลี้ยง • ขาย • สะสมมอนสเตอร์น่ารัก ✨', {
      fontFamily: FONT, fontSize: '15px', color: '#FFE8AA',
      stroke: '#441800', strokeThickness: 4,
      shadow: { offsetX: 1, offsetY: 2, color: '#220800', blur: 0, stroke: false, fill: true },
    }).setOrigin(0.5).setDepth(8);

    // ── depth 8: Start button ─────────────────────────────────────────────
    const btnY = 730;
    const btnG = this.add.graphics().setDepth(8);
    // Outer glow ring
    btnG.fillStyle(0xFF8800, 0.14); btnG.fillRoundedRect(W/2 - 165, btnY - 14, 330, 80, 40);
    // Button shadow
    btnG.fillStyle(0x661800, 1);    btnG.fillRoundedRect(W/2 - 150, btnY + 6, 300, 54, 27);
    // Button base
    btnG.fillStyle(0xCC5500, 1);    btnG.fillRoundedRect(W/2 - 150, btnY, 300, 54, 27);
    // Button face (gradient illusion: bright orange)
    btnG.fillStyle(0xFF7700, 1);    btnG.fillRoundedRect(W/2 - 150, btnY - 4, 300, 52, 26);
    // Top shine
    btnG.fillStyle(0xFFCC44, 0.45); btnG.fillRoundedRect(W/2 - 146, btnY - 2, 292, 22, { tl: 24, tr: 24, bl: 0, br: 0 });
    // Border
    btnG.lineStyle(2.5, 0xFFEE44, 0.88); btnG.strokeRoundedRect(W/2 - 150, btnY - 4, 300, 52, 26);

    this.add.text(W / 2, btnY + 22, '▶  เริ่มเล่น !', {
      fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#FFFFFF',
      stroke: '#882200', strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 3, color: '#CC4400', blur: 0, stroke: false, fill: true },
    }).setOrigin(0.5).setDepth(9);

    // Animated glow ring (no bounce — just alpha pulse)
    const glowRing = this.add.graphics().setDepth(7);
    glowRing.lineStyle(3, 0xFFEE88, 1);
    glowRing.strokeRoundedRect(W/2 - 152, btnY - 6, 304, 56, 28);
    this.tweens.add({ targets: glowRing, alpha: { from: 0.2, to: 0.75 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.add.text(W / 2, btnY + 50, 'แตะที่ไหนก็ได้เพื่อเริ่ม', {
      fontFamily: FONT, fontSize: '13px', color: '#FFEEAA',
      stroke: '#332200', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(9).setAlpha(0.82);

    // ── Interactivity ─────────────────────────────────────────────────────
    this.add.rectangle(W / 2, H / 2, W, H)
      .setAlpha(0.001).setDepth(10).setInteractive()
      .on('pointerdown', () => this._goToGame());
    this.add.zone(W / 2, btnY + 22, 310, 60)
      .setDepth(11).setInteractive()
      .on('pointerdown', () => this._goToGame());

    // ── Version ───────────────────────────────────────────────────────────
    this.add.text(W / 2, H - 6, 'Monster Pet Shop  v0.1', {
      fontFamily: FONT, fontSize: '10px', color: '#FFEEAA',
      stroke: '#221100', strokeThickness: 3,
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

    // Fancy golden-framed strip bar
    const bar = this.add.graphics().setDepth(9);
    // Dark gradient base
    bar.fillGradientStyle(0x1A0808, 0x1A0808, 0x2A1008, 0x2A1808, 1);
    bar.fillRect(0, STRIP_Y - 38, W, 76);
    // Top/bottom gold border lines
    bar.lineStyle(2.5, 0xFFAA22, 0.70); bar.lineBetween(0, STRIP_Y - 38, W, STRIP_Y - 38);
    bar.lineStyle(2.5, 0xFFAA22, 0.70); bar.lineBetween(0, STRIP_Y + 38, W, STRIP_Y + 38);
    // Inner subtle gold glow
    bar.fillStyle(0xFFCC44, 0.05); bar.fillRect(0, STRIP_Y - 36, W, 74);
    // Strip label
    this.add.text(W / 2, STRIP_Y - 28, '✦ มอนสเตอร์ทั้งหมด ✦', {
      fontFamily: FONT, fontSize: '11px', color: '#FFD700',
      stroke: '#441100', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(11);

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
          const img = this.add.image(-44 + i * CELL_W + CELL_W / 2, STRIP_Y + 8, key)
            .setDisplaySize(ICON_SZ, ICON_SZ)
            .setDepth(10);
          this._monsterImgs.push(img);
          this.tweens.add({
            targets: img, y: STRIP_Y + 3,
            duration: 950 + (i % 7) * 120,
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
