import Phaser from 'phaser';
import { FONT } from '../utils';
import { SPECIES } from '../data';
import { preloadMonsterTexture } from '../MonsterRenderer';
import type { Monster } from '../types';

const BTN_Y = 370;

export class TitleScreen extends Phaser.Scene {
  private _monsterImgs: Phaser.GameObjects.Image[] = [];
  private _stripSpeed = 0.55;

  constructor() { super({ key: 'TitleScreen' }); }

  create() {
    const W = this.scale.width, H = this.scale.height;

    this._drawBackground(W, H);
    this._drawDecorations(W, H);
    this._drawTitleBoard(W, H);
    this._drawButton(W, H);
    this._startAmbient(W, H);

    // Full-screen tap
    this.add.rectangle(W / 2, H / 2, W, H)
      .setAlpha(0.001).setDepth(20).setInteractive()
      .on('pointerdown', () => this._goToGame());
    // Button hot-zone
    this.add.zone(W / 2, BTN_Y + 22, 310, 64)
      .setDepth(21).setInteractive()
      .on('pointerdown', () => this._goToGame());

    this.add.text(W / 2, H - 6, 'Monster Pet Shop  v0.1', {
      fontFamily: FONT, fontSize: '10px', color: '#FFEEAA',
      stroke: '#221100', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15);

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

  // ── Background: same warm wood wall as Hub ────────────────────────────────
  private _drawBackground(W: number, H: number) {
    const bg = this.add.graphics().setDepth(0);

    // Warm wood-panel wall — same gradient as Hub
    bg.fillGradientStyle(0xB87830, 0xB87830, 0xD4A050, 0xD4A050, 1);
    bg.fillRect(0, 0, W, H);

    // Horizontal plank seams
    bg.lineStyle(1.5, 0x8A5018, 0.35);
    for (let py = 64; py < H * 0.84; py += 52) {
      bg.beginPath(); bg.moveTo(0, py); bg.lineTo(W, py); bg.strokePath();
    }
    // Subtle wood grain
    bg.lineStyle(1, 0xCC9040, 0.18);
    for (let py = 4; py < H; py += 16) {
      bg.beginPath(); bg.moveTo(0, py); bg.lineTo(W, py); bg.strokePath();
    }

    // Header ledge strip (same as Hub)
    bg.fillStyle(0xD4A050, 0.7); bg.fillRect(0, 68, W, 6);
    bg.fillStyle(0x8A5018, 0.3); bg.fillRect(0, 74, W, 2);

    // Wooden floor at bottom (same as Hub)
    bg.fillStyle(0xA06828, 1);
    bg.fillRect(0, H * 0.84, W, H * 0.16);
    bg.lineStyle(2, 0x7A4E18, 0.55);
    for (let fx = 20; fx < W; fx += 76) {
      bg.beginPath(); bg.moveTo(fx, H * 0.84); bg.lineTo(fx, H); bg.strokePath();
    }
    bg.lineStyle(2, 0x7A4E18, 0.45);
    bg.beginPath(); bg.moveTo(0, H * 0.84); bg.lineTo(W, H * 0.84); bg.strokePath();

    // Vignette edges
    const vig = this.add.graphics().setDepth(2);
    vig.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.14, 0.14, 0, 0);
    vig.fillRect(0, 0, W, H * 0.14);
    vig.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.08, 0, 0, 0.08);
    vig.fillRect(0, 0, W * 0.10, H);
    vig.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.08, 0.08, 0);
    vig.fillRect(W * 0.90, 0, W * 0.10, H);
  }

  // ── Shop decorations: lanterns, shelf, potions, props (mirrors Hub) ───────
  private _drawDecorations(W: number, H: number) {
    const dec = this.add.graphics().setDepth(1);

    // Hanging lanterns at same positions as Hub
    ([[ W * 0.22, 72 ], [ W * 0.78, 76 ]] as [number, number][]).forEach(([lx, ly]) => {
      dec.lineStyle(1.5, 0x5A3810, 0.7);
      dec.beginPath(); dec.moveTo(lx, 0); dec.lineTo(lx, ly - 10); dec.strokePath();
      dec.fillStyle(0x3A2208, 0.95); dec.fillRoundedRect(lx - 9, ly - 10, 18, 28, 3);
      dec.fillStyle(0xFFDD66, 0.75); dec.fillRoundedRect(lx - 6, ly - 6, 12, 18, 2);
      dec.fillStyle(0xFFFF99, 0.25); dec.fillCircle(lx, ly + 2, 18);
      dec.fillStyle(0x2A1608, 1);    dec.fillTriangle(lx - 10, ly - 10, lx + 10, ly - 10, lx, ly - 20);
      dec.fillStyle(0x6A4818, 1);    dec.fillRect(lx - 10, ly + 18, 20, 4);
    });

    // ── Shelf at H*0.64 (same as Hub) ────────────────────────────────────
    const shelfY = H * 0.64;
    dec.fillStyle(0x5A3010, 1); dec.fillRect(8, shelfY + 3, W - 16, 20);
    dec.fillStyle(0x8B5020, 1); dec.fillRect(8, shelfY, W - 16, 18);
    dec.lineStyle(1, 0xAA7030, 0.55);
    dec.beginPath(); dec.moveTo(8, shelfY + 2); dec.lineTo(W - 8, shelfY + 2); dec.strokePath();
    dec.lineStyle(1.5, 0x3A1808, 0.7);
    dec.beginPath(); dec.moveTo(8, shelfY + 18); dec.lineTo(W - 8, shelfY + 18); dec.strokePath();
    [60, W - 60, W / 2].forEach(bx => {
      dec.fillStyle(0x4A2008, 1); dec.fillRect(bx - 6, shelfY + 18, 12, 22);
      dec.fillStyle(0x6A3818, 1); dec.fillRect(bx - 5, shelfY + 18, 10, 20);
    });

    // Potion bottles on shelf (same as Hub)
    const bottleData: [number, number, number][] = [
      [85,  shelfY - 4,  0xFF4444],
      [130, shelfY - 2,  0x44AAFF],
      [172, shelfY - 6,  0x88EE44],
      [W - 88,  shelfY - 3,  0xFFAA22],
      [W - 132, shelfY - 7,  0xCC44FF],
      [W - 176, shelfY - 2,  0x44FFCC],
    ];
    bottleData.forEach(([bx, by, col]) => {
      dec.fillStyle(0x2A1808, 0.55); dec.fillRoundedRect(bx - 8 + 2, by - 14 + 3, 16, 20, 5);
      dec.fillStyle(col, 0.85);     dec.fillRoundedRect(bx - 8, by - 14, 16, 20, 5);
      dec.fillStyle(col, 0.40);     dec.fillRoundedRect(bx - 5, by - 12, 6, 9, 3);
      dec.fillStyle(0x3A2010, 1);   dec.fillRoundedRect(bx - 3, by - 18, 6, 6, 2);
      dec.fillStyle(col, 0.15);     dec.fillCircle(bx, by - 4, 14);
    });

    // Treasure chest on shelf right (same as Hub)
    const chX = W * 0.72, chY = shelfY - 20;
    dec.fillStyle(0x5D3A1A, 1); dec.fillRoundedRect(chX - 16, chY, 32, 22, 3);
    dec.fillStyle(0x7A4F25, 1); dec.fillRoundedRect(chX - 16, chY - 8, 32, 12, 3);
    dec.fillStyle(0xFFD700, 0.95); dec.fillRect(chX - 5, chY + 6, 10, 7); dec.fillCircle(chX, chY + 9, 4);
    dec.lineStyle(1.5, 0xFFB700, 0.7); dec.strokeRoundedRect(chX - 16, chY, 32, 22, 3);

    // Potted plant on shelf left (same as Hub)
    const pX = W * 0.28, pY = shelfY - 18;
    dec.fillStyle(0x8B4513, 1); dec.fillRect(pX - 11, pY, 22, 18);
    dec.fillStyle(0xA0522D, 1); dec.fillRoundedRect(pX - 13, pY, 26, 6, 2);
    dec.fillStyle(0x2E7D32, 1);
    dec.fillCircle(pX, pY - 16, 13); dec.fillCircle(pX - 10, pY - 10, 9); dec.fillCircle(pX + 10, pY - 10, 9);
    dec.fillStyle(0x4CAF50, 0.5);
    dec.fillCircle(pX - 3, pY - 20, 6); dec.fillCircle(pX + 4, pY - 14, 5);

    // ── Wall sign at H*0.68 (same layout as Hub's _buildShopSign) ────────
    const signX = W / 2, signY = H * 0.68;
    dec.fillStyle(0x3A1808, 0.5);  dec.fillRoundedRect(signX - 97, signY - 27, 194, 50, 6);
    dec.fillStyle(0xC87820, 1);    dec.fillRoundedRect(signX - 95, signY - 26, 190, 48, 5);
    dec.lineStyle(2, 0xFFD070, 0.70); dec.strokeRoundedRect(signX - 95, signY - 26, 190, 48, 5);
    dec.lineStyle(1, 0xFFE0A0, 0.35); dec.strokeRoundedRect(signX - 90, signY - 21, 180, 38, 4);
    ([[ signX - 84, signY - 19 ], [ signX + 84, signY - 19 ],
      [ signX - 84, signY + 17 ], [ signX + 84, signY + 17 ]] as [number, number][]).forEach(([nx, ny]) => {
      dec.fillStyle(0xC0A050, 1); dec.fillCircle(nx, ny, 4);
      dec.fillStyle(0xFFD890, 0.6); dec.fillCircle(nx - 1, ny - 1, 2);
    });
    this.add.text(signX, signY - 8, '🏪  ยินดีต้อนรับสู่ร้าน', {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold',
      color: '#FFFFFF', stroke: '#5A2A00', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(2);
    this.add.text(signX, signY + 10, 'Monster Pet Shop', {
      fontFamily: FONT, fontSize: '11px',
      color: '#FFE8BB', stroke: '#5A2A00', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(2);

    // ── Small trophies on side walls between button and shelf ─────────────
    this._drawTrophy(dec, 48, BTN_Y + 156);
    this._drawTrophy(dec, W - 48, BTN_Y + 156);
  }

  private _drawTrophy(g: Phaser.GameObjects.Graphics, cx: number, cy: number) {
    // Base plaque
    g.fillStyle(0x6A3A10, 1); g.fillRoundedRect(cx - 22, cy + 14, 44, 10, 3);
    g.fillStyle(0x8B5020, 1); g.fillRoundedRect(cx - 20, cy + 12, 40, 8, 3);
    g.lineStyle(1, 0xFFD070, 0.5); g.strokeRoundedRect(cx - 20, cy + 12, 40, 8, 3);
    // Stem
    g.fillStyle(0xFFD700, 1); g.fillRect(cx - 5, cy + 6, 10, 8);
    // Cup body
    g.fillStyle(0xFFD700, 0.95); g.fillCircle(cx, cy - 8, 17);
    g.fillStyle(0xFFCC00, 1);
    g.fillTriangle(cx - 15, cy + 1, cx + 15, cy + 1, cx, cy + 8);
    // Cup top rim
    g.fillStyle(0xFFE040, 1); g.fillRoundedRect(cx - 17, cy - 18, 34, 8, 4);
    // Handles
    g.lineStyle(3, 0xFFD700, 1);
    g.beginPath(); g.arc(cx - 17, cy - 8, 6, Phaser.Math.DegToRad(90), Phaser.Math.DegToRad(270)); g.strokePath();
    g.beginPath(); g.arc(cx + 17, cy - 8, 6, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(90)); g.strokePath();
    // Shine
    g.fillStyle(0xFFFFCC, 0.55); g.fillCircle(cx - 5, cy - 13, 5);
    // Star
    g.fillStyle(0xFFF176, 1); g.fillCircle(cx, cy - 8, 5);
  }

  // ── Large hanging wooden board with the shop title ────────────────────────
  private _drawTitleBoard(W: number, H: number) {
    const BOARD_TOP = 100;
    const BOARD_H   = 212;
    const BOARD_W   = 464;

    const board = this.add.graphics().setDepth(4);

    // Hanging ropes
    board.lineStyle(4, 0x5A3010, 0.88);
    board.beginPath(); board.moveTo(W/2 - 152, BOARD_TOP); board.lineTo(W/2 - 152, BOARD_TOP - 28); board.strokePath();
    board.beginPath(); board.moveTo(W/2 + 152, BOARD_TOP); board.lineTo(W/2 + 152, BOARD_TOP - 28); board.strokePath();
    board.fillStyle(0x4A2808, 1); board.fillCircle(W/2 - 152, BOARD_TOP - 28, 5);
    board.fillStyle(0x4A2808, 1); board.fillCircle(W/2 + 152, BOARD_TOP - 28, 5);

    // Board drop shadow
    board.fillStyle(0x1A0800, 0.50);
    board.fillRoundedRect(W/2 - BOARD_W/2 + 5, BOARD_TOP + 5, BOARD_W, BOARD_H, 14);

    // Board wood body (richer, darker than wall)
    board.fillGradientStyle(0x8A5020, 0x8A5020, 0xB07030, 0xB07030, 1);
    board.fillRoundedRect(W/2 - BOARD_W/2, BOARD_TOP, BOARD_W, BOARD_H, 14);

    // Wood grain on board
    board.lineStyle(1, 0x9A6030, 0.25);
    for (let gy = BOARD_TOP + 22; gy < BOARD_TOP + BOARD_H - 10; gy += 20) {
      board.beginPath();
      board.moveTo(W/2 - BOARD_W/2 + 12, gy);
      board.lineTo(W/2 + BOARD_W/2 - 12, gy);
      board.strokePath();
    }

    // Dark wood outer border
    board.lineStyle(4, 0x5A2C0A, 0.85);
    board.strokeRoundedRect(W/2 - BOARD_W/2, BOARD_TOP, BOARD_W, BOARD_H, 14);

    // Inner gold inset frame
    board.lineStyle(2, 0xFFCC66, 0.38);
    board.strokeRoundedRect(W/2 - BOARD_W/2 + 9, BOARD_TOP + 9, BOARD_W - 18, BOARD_H - 18, 10);

    // Corner nails
    ([[W/2 - BOARD_W/2 + 16, BOARD_TOP + 15], [W/2 + BOARD_W/2 - 16, BOARD_TOP + 15],
      [W/2 - BOARD_W/2 + 16, BOARD_TOP + BOARD_H - 15], [W/2 + BOARD_W/2 - 16, BOARD_TOP + BOARD_H - 15]] as [number, number][])
      .forEach(([cx, cy]) => {
        board.fillStyle(0xC0A050, 1); board.fillCircle(cx, cy, 7);
        board.fillStyle(0xFFD890, 0.70); board.fillCircle(cx - 1.5, cy - 1.5, 3.5);
        board.lineStyle(1, 0x8A6020, 0.55); board.strokeCircle(cx, cy, 7);
      });

    // ── Title text on board ──────────────────────────────────────────────
    const titleCY = BOARD_TOP + 96;

    // Shadow
    this.add.text(W/2 + 3, titleCY + 3, 'Monster\nPet Shop', {
      fontFamily: '"Arial Black", "Impact", sans-serif',
      fontSize: '66px', fontStyle: 'bold', color: '#2A0800', align: 'center',
    }).setOrigin(0.5).setAlpha(0.40).setDepth(5);

    // Title
    const titleTxt = this.add.text(W/2, titleCY, 'Monster\nPet Shop', {
      fontFamily: '"Arial Black", "Impact", sans-serif',
      fontSize: '66px', fontStyle: 'bold', color: '#FFD700',
      stroke: '#6B2200', strokeThickness: 10, align: 'center',
      shadow: { offsetX: 0, offsetY: 4, color: '#FF6600', blur: 0, stroke: false, fill: true },
    }).setOrigin(0.5).setDepth(6);
    this.tweens.add({ targets: titleTxt, y: titleCY + 5, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // Flanking ✦ stars
    for (let side = -1; side <= 1; side += 2) {
      for (let si = 0; si < 2; si++) {
        const sz  = 14 + si * 7;
        const sxt = W/2 + side * (155 + si * 22);
        const syt = BOARD_TOP + 80 + si * 14;
        const sg  = this.add.text(sxt, syt, '✦', {
          fontFamily: FONT, fontSize: sz + 'px',
          color: side > 0 ? '#FFDD44' : '#FF88CC',
        }).setOrigin(0.5).setDepth(6).setAlpha(0.80);
        this.tweens.add({
          targets: sg, alpha: { from: 0.3, to: 1 },
          duration: 900 + si * 200, yoyo: true, repeat: -1, ease: 'Sine.InOut',
          delay: si * 280 + (side > 0 ? 0 : 150),
        });
      }
    }

    // Subtitle on board
    this.add.text(W/2, BOARD_TOP + BOARD_H - 24, '✨ เลี้ยง • ขาย • สะสมมอนสเตอร์น่ารัก ✨', {
      fontFamily: FONT, fontSize: '13px', color: '#FFE8AA',
      stroke: '#441800', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(6);
  }

  // ── Start button ──────────────────────────────────────────────────────────
  private _drawButton(W: number, H: number) {
    const btnG = this.add.graphics().setDepth(8);

    // Outer glow
    btnG.fillStyle(0xFF8800, 0.14); btnG.fillRoundedRect(W/2 - 165, BTN_Y - 14, 330, 80, 40);
    // Shadow
    btnG.fillStyle(0x661800, 1);    btnG.fillRoundedRect(W/2 - 150, BTN_Y + 6, 300, 54, 27);
    // Base
    btnG.fillStyle(0xCC5500, 1);    btnG.fillRoundedRect(W/2 - 150, BTN_Y, 300, 54, 27);
    // Face
    btnG.fillStyle(0xFF7700, 1);    btnG.fillRoundedRect(W/2 - 150, BTN_Y - 4, 300, 52, 26);
    // Top shine
    btnG.fillStyle(0xFFCC44, 0.45); btnG.fillRoundedRect(W/2 - 146, BTN_Y - 2, 292, 22, { tl: 24, tr: 24, bl: 0, br: 0 });
    // Border
    btnG.lineStyle(2.5, 0xFFEE44, 0.88); btnG.strokeRoundedRect(W/2 - 150, BTN_Y - 4, 300, 52, 26);

    this.add.text(W/2, BTN_Y + 22, '▶  เริ่มเล่น !', {
      fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#FFFFFF',
      stroke: '#882200', strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 3, color: '#CC4400', blur: 0, stroke: false, fill: true },
    }).setOrigin(0.5).setDepth(9);

    // Animated glow ring
    const glowRing = this.add.graphics().setDepth(7);
    glowRing.lineStyle(3, 0xFFEE88, 1);
    glowRing.strokeRoundedRect(W/2 - 152, BTN_Y - 6, 304, 56, 28);
    this.tweens.add({ targets: glowRing, alpha: { from: 0.2, to: 0.75 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.add.text(W/2, BTN_Y + 52, 'แตะที่ไหนก็ได้เพื่อเริ่ม', {
      fontFamily: FONT, fontSize: '13px', color: '#FFEEAA',
      stroke: '#332200', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(9).setAlpha(0.82);
  }

  // ── Ambient: lantern glow pulse + warm dust motes (mirrors Hub) ───────────
  private _startAmbient(W: number, H: number) {
    ([[ W * 0.22, 86 ], [ W * 0.78, 90 ]] as [number, number][]).forEach(([lx, ly]) => {
      const lg = this.add.graphics().setDepth(3);
      lg.fillStyle(0xFFDD66, 0.24); lg.fillCircle(lx, ly, 28);
      lg.fillStyle(0xFFFF99, 0.12); lg.fillCircle(lx, ly, 44);
      this.tweens.add({
        targets: lg, alpha: { from: 0.50, to: 0.10 },
        duration: 1400 + Math.random() * 700, yoyo: true, repeat: -1, ease: 'Sine.InOut',
      });
    });

    const spawnDust = () => {
      if (!this.scene?.isActive('TitleScreen')) return;
      const dx = 18 + Math.random() * (W - 36);
      const dy = H * 0.10 + Math.random() * H * 0.72;
      const dc = [0xFFDD88, 0xFFBB44, 0xFFEEBB, 0xFFCC66][Math.floor(Math.random() * 4)];
      const dg = this.add.graphics().setDepth(3);
      dg.fillStyle(dc, 0.28 + Math.random() * 0.18);
      dg.fillCircle(0, 0, 0.8 + Math.random() * 1.4);
      dg.setPosition(dx, dy);
      this.tweens.add({
        targets: dg,
        y: dy - 24 - Math.random() * 20,
        x: dx + (Math.random() - 0.5) * 32,
        alpha: 0,
        duration: 2000 + Math.random() * 1400, ease: 'Sine.Out',
        onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
      });
    };
    this.time.addEvent({ delay: 380, loop: true, callback: spawnDust });
    for (let i = 0; i < 14; i++) this.time.delayedCall(i * 220, spawnDust);
  }

  // ── Scrolling monster strip at the bottom (on the wooden floor) ───────────
  private _buildMonsterStrip() {
    const W       = this.scale.width;
    const STRIP_Y = 878;
    const CELL_W  = 76;
    const ICON_SZ = 58;

    const bar = this.add.graphics().setDepth(9);
    // Dark wood base (warmer than the old near-black)
    bar.fillGradientStyle(0x3A1808, 0x3A1808, 0x5A2A10, 0x5A2A10, 1);
    bar.fillRect(0, STRIP_Y - 38, W, 76);
    // Gold border lines
    bar.lineStyle(2.5, 0xFFAA22, 0.70); bar.lineBetween(0, STRIP_Y - 38, W, STRIP_Y - 38);
    bar.lineStyle(2.5, 0xFFAA22, 0.70); bar.lineBetween(0, STRIP_Y + 38, W, STRIP_Y + 38);
    bar.fillStyle(0xFFCC44, 0.05); bar.fillRect(0, STRIP_Y - 36, W, 74);

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
      })
      .catch(() => { /* SVG load failed — strip stays empty */ });
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
