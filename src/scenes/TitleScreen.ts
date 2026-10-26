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

  // ── Background: warm wood wall ────────────────────────────────────────────
  private _drawBackground(W: number, H: number) {
    const bg = this.add.graphics().setDepth(0);

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

    // Header ledge strip
    bg.fillStyle(0xD4A050, 0.7); bg.fillRect(0, 68, W, 6);
    bg.fillStyle(0x8A5018, 0.3); bg.fillRect(0, 74, W, 2);

    // Wooden floor at bottom
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

  // ── Shop decorations: lanterns, shelf, potions, bonsai, trophies ─────────
  private _drawDecorations(W: number, H: number) {
    const dec = this.add.graphics().setDepth(1);

    // Hanging lanterns
    ([[ W * 0.22, 72 ], [ W * 0.78, 76 ]] as [number, number][]).forEach(([lx, ly]) => {
      dec.lineStyle(2, 0x5A3810, 0.75);
      dec.beginPath(); dec.moveTo(lx, 0); dec.lineTo(lx, ly - 12); dec.strokePath();
      // Lantern cap
      dec.fillStyle(0x2A1608, 1); dec.fillTriangle(lx - 12, ly - 12, lx + 12, ly - 12, lx, ly - 24);
      // Lantern body
      dec.fillStyle(0x3A2208, 0.95); dec.fillRoundedRect(lx - 10, ly - 12, 20, 32, 4);
      // Glass glow
      dec.fillStyle(0xFFDD66, 0.80); dec.fillRoundedRect(lx - 7, ly - 8, 14, 22, 3);
      // Inner bright spot
      dec.fillStyle(0xFFFF99, 0.55); dec.fillRoundedRect(lx - 4, ly - 6, 8, 14, 2);
      // Base strip
      dec.fillStyle(0x6A4818, 1); dec.fillRect(lx - 11, ly + 20, 22, 5);
      // Outer glow pulse area (handled in ambient)
    });

    // ── Shelf ─────────────────────────────────────────────────────────────
    const shelfY = H * 0.64;
    // Shelf face (light top)
    dec.fillStyle(0x8B5020, 1); dec.fillRect(8, shelfY, W - 16, 18);
    // Shelf under-shadow
    dec.fillStyle(0x5A3010, 1); dec.fillRect(8, shelfY + 14, W - 16, 8);
    // Shelf highlight line
    dec.lineStyle(1, 0xAA7030, 0.55);
    dec.beginPath(); dec.moveTo(8, shelfY + 2); dec.lineTo(W - 8, shelfY + 2); dec.strokePath();
    // Shelf bottom line
    dec.lineStyle(2, 0x3A1808, 0.7);
    dec.beginPath(); dec.moveTo(8, shelfY + 20); dec.lineTo(W - 8, shelfY + 20); dec.strokePath();
    // Shelf brackets (support legs)
    [W * 0.18, W / 2, W * 0.82].forEach(bx => {
      dec.fillStyle(0x4A2008, 1); dec.fillRect(bx - 7, shelfY + 20, 14, 22);
      dec.fillStyle(0x6A3818, 1); dec.fillRect(bx - 6, shelfY + 20, 12, 20);
    });

    // ── Trophy on tall pedestal — LEFT of shelf ───────────────────────────
    this._drawTrophyPedestal(dec, 52, shelfY);
    // ── Trophy on tall pedestal — RIGHT of shelf ──────────────────────────
    this._drawTrophyPedestal(dec, W - 52, shelfY);

    // ── Large gnarled bonsai — left-center of shelf ───────────────────────
    this._drawBonsai(dec, W * 0.26, shelfY);

    // ── 3 large round globe potions — center-left ─────────────────────────
    const potX = W * 0.44;
    this._drawGlobePotion(dec, potX,       shelfY, 0xFF4444);  // Red
    this._drawGlobePotion(dec, potX + 48,  shelfY, 0x44AAFF);  // Blue
    this._drawGlobePotion(dec, potX + 96,  shelfY, 0x44DD44);  // Green

    // ── Welcome sign ──────────────────────────────────────────────────────
    const signX = W / 2, signY = H * 0.68;
    dec.fillStyle(0x3A1808, 0.5);  dec.fillRoundedRect(signX - 99, signY - 28, 198, 52, 7);
    dec.fillStyle(0xC87820, 1);    dec.fillRoundedRect(signX - 97, signY - 27, 194, 50, 6);
    dec.lineStyle(2.5, 0xFFD070, 0.75); dec.strokeRoundedRect(signX - 97, signY - 27, 194, 50, 6);
    dec.lineStyle(1, 0xFFE0A0, 0.40); dec.strokeRoundedRect(signX - 91, signY - 21, 182, 38, 4);
    // Corner rivets
    ([[signX - 86, signY - 18], [signX + 86, signY - 18],
      [signX - 86, signY + 18], [signX + 86, signY + 18]] as [number, number][]).forEach(([nx, ny]) => {
      dec.fillStyle(0xC0A050, 1); dec.fillCircle(nx, ny, 5);
      dec.fillStyle(0xFFD890, 0.65); dec.fillCircle(nx - 1.5, ny - 1.5, 2.5);
      dec.lineStyle(1, 0x8A6020, 0.5); dec.strokeCircle(nx, ny, 5);
    });
    this.add.text(signX, signY - 8, '🏪  ยินดีต้อนรับสู่ร้าน', {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold',
      color: '#FFFFFF', stroke: '#5A2A00', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(2);
    this.add.text(signX, signY + 10, 'Monster Pet Shop', {
      fontFamily: FONT, fontSize: '11px',
      color: '#FFE8BB', stroke: '#5A2A00', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(2);
  }

  private _drawTrophyPedestal(g: Phaser.GameObjects.Graphics, cx: number, shelfY: number) {
    const colH = 48, colW = 28;
    // Column base (at shelf surface)
    g.fillStyle(0x4A2408, 1); g.fillRoundedRect(cx - colW/2 - 2, shelfY - 8, colW + 4, 10, 2);
    g.fillStyle(0x7A4A20, 1); g.fillRoundedRect(cx - colW/2 - 2, shelfY - 8, colW + 4, 8, 2);
    g.lineStyle(1, 0xFFD070, 0.45); g.strokeRoundedRect(cx - colW/2 - 2, shelfY - 8, colW + 4, 8, 2);

    // Column shaft
    g.fillStyle(0x5A3010, 1); g.fillRect(cx - colW/2, shelfY - 8 - colH, colW, colH);
    g.fillStyle(0x7A4820, 1); g.fillRect(cx - colW/2 + 2, shelfY - 8 - colH + 2, colW - 4, colH - 4);
    // Column wood grain
    g.lineStyle(1, 0xAA7030, 0.22);
    for (let gy = shelfY - 8 - colH + 8; gy < shelfY - 10; gy += 9) {
      g.beginPath(); g.moveTo(cx - colW/2 + 3, gy); g.lineTo(cx + colW/2 - 3, gy); g.strokePath();
    }
    // Ring bands on column
    [shelfY - 8 - colH * 0.25, shelfY - 8 - colH * 0.65].forEach(ry => {
      g.fillStyle(0x4A2008, 1); g.fillRect(cx - colW/2 - 1, ry, colW + 2, 5);
      g.fillStyle(0xAA7030, 0.5); g.fillRect(cx - colW/2 - 1, ry, colW + 2, 2);
    });

    // Column top cap
    g.fillStyle(0x4A2008, 1); g.fillRoundedRect(cx - colW/2 - 3, shelfY - 8 - colH - 5, colW + 6, 8, 2);
    g.fillStyle(0x8A5020, 1); g.fillRoundedRect(cx - colW/2 - 3, shelfY - 8 - colH - 5, colW + 6, 6, 2);
    g.lineStyle(1, 0xFFD070, 0.5); g.strokeRoundedRect(cx - colW/2 - 3, shelfY - 8 - colH - 5, colW + 6, 8, 2);

    // Trophy on top of column
    this._drawTrophy(g, cx, shelfY - 8 - colH - 5);
  }

  private _drawTrophy(g: Phaser.GameObjects.Graphics, cx: number, topY: number) {
    const cy = topY - 32;
    // Drop shadow
    g.fillStyle(0x1A0800, 0.30); g.fillEllipse(cx + 3, topY + 2, 44, 10);
    // Base plaque
    g.fillStyle(0x6A3A10, 1); g.fillRoundedRect(cx - 23, topY - 8, 46, 10, 3);
    g.fillStyle(0x8B5020, 1); g.fillRoundedRect(cx - 21, topY - 9, 42, 8, 3);
    g.lineStyle(1, 0xFFD070, 0.5); g.strokeRoundedRect(cx - 21, topY - 9, 42, 8, 3);
    // Stem
    g.fillStyle(0xEEC000, 1); g.fillRoundedRect(cx - 5, topY - 20, 10, 13, 2);
    g.fillStyle(0xFFD700, 1); g.fillRoundedRect(cx - 4, topY - 20, 6, 11, 2);
    // Cup body
    g.fillStyle(0xD4A800, 1); g.fillCircle(cx + 1, cy, 20);
    g.fillStyle(0xFFD700, 1); g.fillCircle(cx, cy, 19);
    g.fillStyle(0xEEC000, 1); g.fillTriangle(cx - 14, cy + 10, cx + 14, cy + 10, cx, cy + 20);
    // Cup rim
    g.fillStyle(0xFFE840, 1); g.fillRoundedRect(cx - 18, cy - 20, 36, 8, 4);
    g.fillStyle(0xFFF060, 0.7); g.fillRoundedRect(cx - 16, cy - 20, 22, 5, 3);
    // Handles
    g.lineStyle(4, 0xEEC000, 1);
    g.beginPath(); g.arc(cx - 18, cy - 4, 7, Phaser.Math.DegToRad(90), Phaser.Math.DegToRad(270)); g.strokePath();
    g.beginPath(); g.arc(cx + 18, cy - 4, 7, Phaser.Math.DegToRad(-90), Phaser.Math.DegToRad(90)); g.strokePath();
    g.lineStyle(2, 0xFFE040, 0.7);
    g.beginPath(); g.arc(cx - 18, cy - 4, 7, Phaser.Math.DegToRad(130), Phaser.Math.DegToRad(230)); g.strokePath();
    g.beginPath(); g.arc(cx + 18, cy - 4, 7, Phaser.Math.DegToRad(-50), Phaser.Math.DegToRad(50)); g.strokePath();
    // Shine on cup
    g.fillStyle(0xFFFDD0, 0.60); g.fillCircle(cx - 6, cy - 10, 6);
    g.fillStyle(0xFFFDD0, 0.30); g.fillCircle(cx - 3, cy - 5, 10);
    // Star center
    g.fillStyle(0xFFF176, 1); g.fillCircle(cx, cy - 3, 5);
    g.fillStyle(0xFFFFDD, 0.8); g.fillCircle(cx - 1, cy - 4, 2.5);
  }

  private _drawBonsai(g: Phaser.GameObjects.Graphics, cx: number, shelfY: number) {
    const by = shelfY - 2;

    // Pot (shallow oval clay pot)
    g.fillStyle(0x7A3510, 1); g.fillRoundedRect(cx - 22, by - 16, 44, 22, { tl: 4, tr: 4, bl: 10, br: 10 });
    g.fillStyle(0x9B4A20, 1); g.fillRoundedRect(cx - 20, by - 14, 40, 18, { tl: 3, tr: 3, bl: 8, br: 8 });
    // Pot lip
    g.fillStyle(0x6A2E10, 1); g.fillRoundedRect(cx - 24, by - 18, 48, 7, 3);
    g.fillStyle(0xBE6830, 0.45); g.fillRoundedRect(cx - 22, by - 17, 38, 4, 2);
    // Soil
    g.fillStyle(0x3A200A, 0.85); g.fillEllipse(cx, by - 12, 36, 10);
    g.fillStyle(0x5A3218, 0.5); g.fillEllipse(cx - 3, by - 13, 24, 6);

    // Gnarled trunk — main trunk curves slightly left then right
    g.fillStyle(0x4A2808, 1);
    // Main trunk
    g.fillRoundedRect(cx - 5, by - 56, 11, 42, 4);
    // Right lean upper
    g.fillRoundedRect(cx + 2, by - 72, 9, 22, 3);
    // Left branch
    g.fillRoundedRect(cx - 22, by - 52, 22, 8, 4);
    // Right branch
    g.fillRoundedRect(cx + 4, by - 46, 20, 7, 3);
    // Small twig up-left
    g.fillRoundedRect(cx - 16, by - 65, 6, 18, 3);

    // Trunk highlight
    g.fillStyle(0x7A4820, 0.55);
    g.fillRoundedRect(cx - 2, by - 55, 5, 40, 3);
    g.fillRoundedRect(cx + 4, by - 70, 4, 20, 2);

    // Canopy — overlapping foliage clusters
    const foliage: [number, number, number][] = [
      [cx + 2, by - 88, 22],    // top center
      [cx - 20, by - 74, 18],   // upper left
      [cx + 22, by - 76, 17],   // upper right
      [cx - 8,  by - 72, 15],   // upper mid-left
      [cx + 10, by - 86, 14],   // upper mid-right
      [cx - 26, by - 60, 15],   // left drop
      [cx + 26, by - 62, 14],   // right drop
      [cx - 4,  by - 60, 12],   // lower center
    ];
    foliage.forEach(([fx, fy, fr]) => {
      g.fillStyle(0x1B5E20, 1); g.fillCircle(fx + 1, fy + 1, fr);
      g.fillStyle(0x2E7D32, 1); g.fillCircle(fx, fy, fr);
    });
    foliage.forEach(([fx, fy, fr]) => {
      g.fillStyle(0x4CAF50, 0.50); g.fillCircle(fx - fr*0.28, fy - fr*0.28, fr * 0.48);
    });
    // Tiny flowers
    ([[cx - 10, by - 92], [cx + 16, by - 80], [cx - 24, by - 65], [cx + 5, by - 68]] as [number, number][]).forEach(([fx, fy]) => {
      g.fillStyle(0xFF9999, 0.75); g.fillCircle(fx, fy, 3.5);
      g.fillStyle(0xFFFFFF, 0.85); g.fillCircle(fx, fy, 1.8);
    });
  }

  private _drawGlobePotion(g: Phaser.GameObjects.Graphics, cx: number, shelfY: number, col: number) {
    const by = shelfY - 2;
    const r = 18;
    const gy = by - r - 8; // globe center y
    const neckTop = gy - r - 8;

    // Drop shadow under globe
    g.fillStyle(0x1A0800, 0.35); g.fillEllipse(cx + 2, by + 2, r * 1.8, r * 0.5);

    // Globe body
    g.fillStyle(0x1A0800, 0.25); g.fillCircle(cx + 2, gy + 2, r);
    g.fillStyle(col, 0.95);       g.fillCircle(cx, gy, r);
    // Inner glow swirl
    g.fillStyle(col, 0.35);       g.fillCircle(cx, gy, r - 5);
    g.fillStyle(0xFFFFFF, 0.18);  g.fillCircle(cx + 2, gy + 3, r - 8);
    // Shiny highlights
    g.fillStyle(0xFFFFFF, 0.55);  g.fillCircle(cx - r * 0.36, gy - r * 0.36, r * 0.24);
    g.fillStyle(0xFFFFFF, 0.25);  g.fillCircle(cx - r * 0.18, gy - r * 0.14, r * 0.38);
    // Globe outline
    g.lineStyle(1.5, 0x1A0800, 0.25); g.strokeCircle(cx, gy, r);

    // Neck
    g.fillStyle(0x4A2008, 0.9); g.fillRoundedRect(cx - 5, neckTop, 10, r, 3);
    g.fillStyle(0x7A4820, 0.5); g.fillRoundedRect(cx - 3, neckTop + 1, 5, r - 2, 2);

    // Cork
    g.fillStyle(0x7A4A20, 1); g.fillRoundedRect(cx - 6, neckTop - 11, 12, 13, 4);
    g.fillStyle(0x9B6030, 0.7); g.fillRoundedRect(cx - 4, neckTop - 10, 6, 10, 3);
    g.fillStyle(0x5A3010, 1); g.fillRoundedRect(cx - 7, neckTop - 13, 14, 5, 2);
    g.lineStyle(1, 0xAA7030, 0.5); g.strokeRoundedRect(cx - 7, neckTop - 13, 14, 5, 2);

    // Label tag (paper hanging off neck)
    const tagY = gy - 9;
    g.fillStyle(0xF5E4B0, 0.88); g.fillRoundedRect(cx - 9, tagY, 18, 13, 3);
    g.lineStyle(1, 0xAA7030, 0.55); g.strokeRoundedRect(cx - 9, tagY, 18, 13, 3);
    // String from cork to tag
    g.lineStyle(1, 0x7A4820, 0.65);
    g.beginPath(); g.moveTo(cx, neckTop + 2); g.lineTo(cx, tagY); g.strokePath();
    // Two stripes on label
    g.lineStyle(1.5, col, 0.60);
    g.beginPath(); g.moveTo(cx - 6, tagY + 4); g.lineTo(cx + 6, tagY + 4); g.strokePath();
    g.beginPath(); g.moveTo(cx - 5, tagY + 8); g.lineTo(cx + 5, tagY + 8); g.strokePath();
  }

  // ── Large hanging wooden board with decorative scrollwork ─────────────────
  private _drawTitleBoard(W: number, H: number) {
    const BOARD_TOP = 100;
    const BOARD_H   = 212;
    const BOARD_W   = 464;
    const BX = W/2 - BOARD_W/2;
    const BY = BOARD_TOP;

    const board = this.add.graphics().setDepth(4);

    // Hanging ropes
    board.lineStyle(4.5, 0x5A3010, 0.90);
    board.beginPath(); board.moveTo(W/2 - 150, BY); board.lineTo(W/2 - 150, BY - 30); board.strokePath();
    board.beginPath(); board.moveTo(W/2 + 150, BY); board.lineTo(W/2 + 150, BY + 0); board.strokePath();
    board.lineStyle(4.5, 0x5A3010, 0.90);
    board.beginPath(); board.moveTo(W/2 + 150, BY); board.lineTo(W/2 + 150, BY - 30); board.strokePath();
    board.fillStyle(0x3A1C08, 1);
    board.fillCircle(W/2 - 150, BY - 30, 5.5);
    board.fillCircle(W/2 + 150, BY - 30, 5.5);

    // Board drop shadow
    board.fillStyle(0x1A0800, 0.48);
    board.fillRoundedRect(BX + 6, BY + 6, BOARD_W, BOARD_H, 14);

    // Board wood body — richer dark warm wood
    board.fillGradientStyle(0x7A4418, 0x7A4418, 0xA06030, 0xA06030, 1);
    board.fillRoundedRect(BX, BY, BOARD_W, BOARD_H, 14);

    // Wood grain on board
    board.lineStyle(1, 0x8A5020, 0.22);
    for (let gy = BY + 24; gy < BY + BOARD_H - 12; gy += 18) {
      board.beginPath();
      board.moveTo(BX + 14, gy);
      board.lineTo(BX + BOARD_W - 14, gy);
      board.strokePath();
    }

    // Dark outer border
    board.lineStyle(5, 0x4A2006, 0.90);
    board.strokeRoundedRect(BX, BY, BOARD_W, BOARD_H, 14);

    // Inner gold inset frame
    board.lineStyle(2.5, 0xFFCC66, 0.42);
    board.strokeRoundedRect(BX + 10, BY + 10, BOARD_W - 20, BOARD_H - 20, 10);

    // Corner nail medallions
    ([[BX + 18, BY + 17], [BX + BOARD_W - 18, BY + 17],
      [BX + 18, BY + BOARD_H - 17], [BX + BOARD_W - 18, BY + BOARD_H - 17]] as [number, number][])
      .forEach(([cx, cy]) => {
        board.fillStyle(0xB09040, 1); board.fillCircle(cx, cy, 8.5);
        board.fillStyle(0xFFD890, 0.65); board.fillCircle(cx - 2, cy - 2, 4.5);
        board.lineStyle(1.5, 0x7A6018, 0.6); board.strokeCircle(cx, cy, 8.5);
      });

    // ── Decorative scroll ornaments on left and right sides ──────────────
    const scrollG = this.add.graphics().setDepth(5);
    this._drawScrollOrnament(scrollG, BX + 18, BY + BOARD_H / 2, false);
    this._drawScrollOrnament(scrollG, BX + BOARD_W - 18, BY + BOARD_H / 2, true);

    // ── Title text on board ──────────────────────────────────────────────
    const titleCY = BOARD_TOP + 100;

    // Shadow
    this.add.text(W/2 + 3, titleCY + 4, 'Monster\nPet Shop', {
      fontFamily: '"Arial Black", "Impact", sans-serif',
      fontSize: '68px', fontStyle: 'bold', color: '#2A0800', align: 'center',
    }).setOrigin(0.5).setAlpha(0.38).setDepth(5);

    // Title text
    const titleTxt = this.add.text(W/2, titleCY, 'Monster\nPet Shop', {
      fontFamily: '"Arial Black", "Impact", sans-serif',
      fontSize: '68px', fontStyle: 'bold', color: '#FFD700',
      stroke: '#6B2200', strokeThickness: 11, align: 'center',
      shadow: { offsetX: 0, offsetY: 4, color: '#FF6600', blur: 0, stroke: false, fill: true },
    }).setOrigin(0.5).setDepth(6);
    this.tweens.add({ targets: titleTxt, y: titleCY + 5, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // Sparkle stars on title board
    const sparkData: [number, number, number, string][] = [
      [W/2 - 176, BY + 72,  16, '#FFDD44'],
      [W/2 - 196, BY + 98,  10, '#FFDD44'],
      [W/2 + 176, BY + 68,  14, '#FF88CC'],
      [W/2 + 200, BY + 96,  10, '#FF88CC'],
      [W/2 + 158, BY + 130, 12, '#FFDD44'],
      [W/2 - 158, BY + 126, 9,  '#FF88CC'],
    ];
    sparkData.forEach(([sx, sy, sz, sc], i) => {
      const sg = this.add.text(sx, sy, '✦', {
        fontFamily: FONT, fontSize: sz + 'px', color: sc,
      }).setOrigin(0.5).setDepth(6).setAlpha(0.85);
      this.tweens.add({
        targets: sg, alpha: { from: 0.20, to: 1.0 }, scale: { from: 0.75, to: 1.15 },
        duration: 800 + i * 130, yoyo: true, repeat: -1, ease: 'Sine.InOut',
        delay: i * 200,
      });
    });

    // Subtitle on board
    this.add.text(W/2, BY + BOARD_H - 22, '✨ เลี้ยง • ขาย • สะสมมอนสเตอร์น่ารัก ✨', {
      fontFamily: FONT, fontSize: '13px', color: '#FFE8AA',
      stroke: '#441800', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(6);
  }

  // S-scroll carved wood ornament on board sides
  private _drawScrollOrnament(g: Phaser.GameObjects.Graphics, cx: number, cy: number, flip: boolean) {
    const f = flip ? -1 : 1;
    const darkCol  = 0x3A1600;
    const hlCol    = 0x9A5020;

    // Large lower curl (C-curve opening toward board center)
    g.lineStyle(6, darkCol, 0.95);
    g.beginPath();
    g.arc(cx + f * 10, cy + 22, 20,
      Phaser.Math.DegToRad(flip ? -10 : 190),
      Phaser.Math.DegToRad(flip ? -270 : -90),
      flip);
    g.strokePath();

    // Connecting stem
    g.lineStyle(5.5, darkCol, 0.90);
    g.beginPath(); g.moveTo(cx + f * 10, cy + 2); g.lineTo(cx + f * 10, cy + 22); g.strokePath();

    // Small upper curl (opposite opening)
    g.lineStyle(4.5, darkCol, 0.88);
    g.beginPath();
    g.arc(cx + f * 5, cy - 14, 13,
      Phaser.Math.DegToRad(flip ? 0 : 180),
      Phaser.Math.DegToRad(flip ? 90 : 90),
      !flip);
    g.strokePath();

    // Highlight on lower curl edge (3D carved look)
    g.lineStyle(2, hlCol, 0.60);
    g.beginPath();
    g.arc(cx + f * 10, cy + 22, 20,
      Phaser.Math.DegToRad(flip ? -30 : 210),
      Phaser.Math.DegToRad(flip ? -150 : 30),
      flip);
    g.strokePath();

    // Highlight on upper curl
    g.lineStyle(1.5, hlCol, 0.50);
    g.beginPath();
    g.arc(cx + f * 5, cy - 14, 13,
      Phaser.Math.DegToRad(flip ? 20 : 160),
      Phaser.Math.DegToRad(flip ? 70 : 110),
      !flip);
    g.strokePath();

    // Small decorative knob at junction
    g.fillStyle(darkCol, 0.90); g.fillCircle(cx + f * 10, cy + 2, 5);
    g.fillStyle(hlCol, 0.60);   g.fillCircle(cx + f * 9.5, cy + 1, 2.5);
  }

  // ── Start button ──────────────────────────────────────────────────────────
  private _drawButton(W: number, H: number) {
    const btnG = this.add.graphics().setDepth(8);

    // Outer glow
    btnG.fillStyle(0xFF8800, 0.13); btnG.fillRoundedRect(W/2 - 168, BTN_Y - 16, 336, 84, 42);
    // Shadow
    btnG.fillStyle(0x661800, 1);    btnG.fillRoundedRect(W/2 - 152, BTN_Y + 7, 304, 56, 28);
    // Base
    btnG.fillStyle(0xCC5500, 1);    btnG.fillRoundedRect(W/2 - 152, BTN_Y, 304, 56, 28);
    // Face
    btnG.fillStyle(0xFF7700, 1);    btnG.fillRoundedRect(W/2 - 152, BTN_Y - 5, 304, 54, 27);
    // Top shine
    btnG.fillStyle(0xFFCC44, 0.48); btnG.fillRoundedRect(W/2 - 148, BTN_Y - 3, 296, 23, { tl: 25, tr: 25, bl: 0, br: 0 });
    // Border
    btnG.lineStyle(2.5, 0xFFEE44, 0.90); btnG.strokeRoundedRect(W/2 - 152, BTN_Y - 5, 304, 54, 27);

    this.add.text(W/2, BTN_Y + 22, '▶  เริ่มเล่น !', {
      fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#FFFFFF',
      stroke: '#882200', strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 3, color: '#CC4400', blur: 0, stroke: false, fill: true },
    }).setOrigin(0.5).setDepth(9);

    // Animated glow ring
    const glowRing = this.add.graphics().setDepth(7);
    glowRing.lineStyle(3.5, 0xFFEE88, 1);
    glowRing.strokeRoundedRect(W/2 - 154, BTN_Y - 7, 308, 58, 29);
    this.tweens.add({ targets: glowRing, alpha: { from: 0.15, to: 0.80 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.add.text(W/2, BTN_Y + 54, 'แตะที่ไหนก็ได้เพื่อเริ่ม', {
      fontFamily: FONT, fontSize: '13px', color: '#FFEEAA',
      stroke: '#332200', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(9).setAlpha(0.82);
  }

  // ── Ambient: lantern glow pulse + warm dust motes ─────────────────────────
  private _startAmbient(W: number, H: number) {
    ([[ W * 0.22, 86 ], [ W * 0.78, 90 ]] as [number, number][]).forEach(([lx, ly]) => {
      const lg = this.add.graphics().setDepth(3);
      lg.fillStyle(0xFFDD66, 0.22); lg.fillCircle(lx, ly, 30);
      lg.fillStyle(0xFFFF99, 0.10); lg.fillCircle(lx, ly, 50);
      this.tweens.add({
        targets: lg, alpha: { from: 0.55, to: 0.10 },
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

  // ── Scrolling monster strip at the bottom ─────────────────────────────────
  private _buildMonsterStrip() {
    const W       = this.scale.width;
    const STRIP_Y = 878;
    const CELL_W  = 76;
    const ICON_SZ = 58;

    const bar = this.add.graphics().setDepth(9);
    bar.fillGradientStyle(0x3A1808, 0x3A1808, 0x5A2A10, 0x5A2A10, 1);
    bar.fillRect(0, STRIP_Y - 38, W, 76);
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
      .catch(() => { /* strip stays empty */ });
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
