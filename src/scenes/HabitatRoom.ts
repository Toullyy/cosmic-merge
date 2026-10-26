import Phaser from 'phaser';
import { Game, FONT, store, sfx, recordQuestProgress } from '../utils';
import { t } from '../i18n';
import { SPECIES, HABITATS, FOOD_TYPES, TOY_TYPES, CLEAN_TOOLS, XP_TABLE, getLevelName, randomBuyer, randomListingDuration, TRAITS, BOWL_EAT_RATE } from '../data';
import { makeMonsterTexture, getVariantModifiers, lighten, darken } from '../MonsterRenderer';
import { makeButton, setButtonLabel, setButtonColor } from '../ui/Button';
import { showToast, showFloat } from '../ui/Toast';
import { Ads } from '../ads';
import type { Monster, Species, HabitatType, Listing } from '../types';

interface BarEntry {
  fill: Phaser.GameObjects.Graphics;
  col: number;
  bx: number; by: number; bw: number;
  val: Phaser.GameObjects.Text;
}

const FOOD_COLORS: Record<string, number> = {
  pellet: 0xFFB300, berry: 0xE91E63,
  pasta: 0xFF7043, gummy: 0xE040FB,
  feast: 0xE53935, cake: 0xFFD740,
};

export class HabitatRoom extends Phaser.Scene {
  private _monsterId: string = '';
  private _monster!: Monster;
  private _monImg!: Phaser.GameObjects.Image;
  private _walkTween!: Phaser.Tweens.Tween;
  private _bars: Record<string, BarEntry> = {};
  private _pickerItems: Phaser.GameObjects.GameObject[] = [];
  private _sellPrice: number = 0;
  private _sp!: Species;
  private _coinTxt!: Phaser.GameObjects.Text;
  private _sellBtn!: Phaser.GameObjects.Container;
  private _listTimer: Phaser.Time.TimerEvent | null = null;
  private _W: number = 540;
  private _H: number = 960;
  private _monY: number = 0;
  private _nameTxt!: Phaser.GameObjects.Text;
  private _renameInput: HTMLInputElement | null = null;
  private _dirtyOverlay!: Phaser.GameObjects.Graphics;
  private _bobTween!: Phaser.Tweens.Tween;
  private _breatheTween!: Phaser.Tweens.Tween;
  private _hungerTimer: Phaser.Time.TimerEvent | null = null;
  private _sadTimer: Phaser.Time.TimerEvent | null = null;
  private _moodTimer: Phaser.Time.TimerEvent | null = null;
  private _happyGlow: Phaser.GameObjects.Graphics | null = null;
  private _happyTimer: Phaser.Time.TimerEvent | null = null;
  private _stinkTimer: Phaser.Time.TimerEvent | null = null;
  private _monBaseScale: number = 1;
  private _platformG: Phaser.GameObjects.Graphics | null = null;
  private _bowlGfx: Phaser.GameObjects.Graphics | null = null;
  private _bowlLabelTxt: Phaser.GameObjects.Text | null = null;
  private _bowlSteamTimer: Phaser.Time.TimerEvent | null = null;
  private _eatTimer: Phaser.Time.TimerEvent | null = null;
  private _bowlX: number = 0;
  private _bowlY: number = 0;
  private _xpBar: Phaser.GameObjects.Graphics | null = null;
  private _xpLevelTxt: Phaser.GameObjects.Text | null = null;
  private _statsY: number = 0;

  constructor() { super({ key: 'HabitatRoom' }); }

  init(data: { monsterId: string }) { this._monsterId = data.monsterId; }

  create() {
    sfx.unlock();
    const W = this.scale.width, H = this.scale.height;
    this._W = W; this._H = H;

    const monster = Game.state!.monsters.find(m => m.id === this._monsterId);
    if (!monster) { this.scene.start('Hub'); return; }
    this._monster = monster;
    this._sp = SPECIES[this._monster.speciesId];
    this._sellPrice = this._calcSell(this._sp);

    this._drawBackground(W, H, this._sp.habitat);
    this._drawVignette(W, H);
    this._drawForeground(W, H, this._sp.habitat);
    this._buildMonsterArea(W, H, this._sp);
    this._buildBowl(W, H);
    this._buildStats(W, H);
    this._buildActions(W, H);
    this._buildHUD(W, H, this._sp);
    this._startAmbient(W, H, this._sp.habitat);
    this._drawTerrariumFrame(W, H);

    // initialise list button state
    const existing = Game.state!.listings.find(l => l.monsterId === this._monster.id);
    if (existing) {
      this._updateListBtnState();
      this._startListTimer();
    } else {
      this.tweens.add({
        targets: this._sellBtn, scaleX: 1.04, scaleY: 1.04,
        duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut',
      });
    }
  }

  private _calcSell(sp: Species): number {
    const m = this._monster;
    const golden = getVariantModifiers(m.variantIndex).isGolden ? 1.5 : 1;
    const traitMod = TRAITS.find(t => t.id === m.trait)?.sellMod ?? 1;
    return Math.max(10, Math.round(sp.price * (1 + m.level * 0.2) * (m.happiness / 100) * 0.8 * golden * traitMod));
  }

  // ── BACKGROUND ────────────────────────────────────────────────────────────

  private _drawBackground(W: number, H: number, habitat: HabitatType) {
    const g = this.add.graphics().setDepth(0);

    // Warm cozy room wall behind tank — clean gradient, no busy grain lines
    g.fillGradientStyle(0xF2E4C8, 0xF2E4C8, 0xE0CC9E, 0xE0CC9E, 1);
    g.fillRect(0, 0, W, 700);
    // Subtle wall texture — vertical grain only in narrow side margins
    g.lineStyle(1, 0xC0965A, 0.12);
    for (let wy = 40; wy < 700; wy += 48) {
      g.beginPath(); g.moveTo(0, wy); g.lineTo(18, wy); g.strokePath();
      g.beginPath(); g.moveTo(W - 18, wy); g.lineTo(W, wy); g.strokePath();
    }
    // Dark shadow behind stats area for readability — starts at panelY (696) so no colour seam
    g.fillGradientStyle(0x1A0E06, 0x1A0E06, 0x2A1808, 0x2A1808, 1);
    g.fillRect(0, 696, W, H - 696);
    // Shelf edge highlight
    g.fillStyle(0xAA7A3A, 0.55); g.fillRect(0, 696, W, 6);
    // Vertical plank dividers on shelf
    g.lineStyle(1, 0x0A0604, 0.25);
    for (let wx = 68; wx < W; wx += 68) {
      g.beginPath(); g.moveTo(wx, 706); g.lineTo(wx, H); g.strokePath();
    }

    // Habitat interior fill inside tank (y=88-672, x=20-520)
    if (habitat === 'dirt') {
      g.fillGradientStyle(0x8B6040, 0x8B6040, 0xC4944A, 0xC4944A, 1);
      g.fillRect(20, 88, 500, 584);
      g.fillStyle(0x6B4A30, 0.25);
      for (let i = 0; i < 120; i++) {
        const dx = 25 + Math.random() * 490, dy = 92 + Math.random() * 576;
        g.fillCircle(dx, dy, 1.5 + Math.random() * 3);
      }
      g.fillStyle(0x7A5030, 1); g.fillRect(20, 610, 500, 62);
      g.fillStyle(0x9B7050, 0.60); g.fillRect(20, 610, 500, 8);
      ;([[80,618,14,8],[160,622,18,10],[280,615,12,7],[380,620,16,9],[460,616,11,6]] as [number,number,number,number][]).forEach(([px,py,pw,ph]) => {
        g.fillStyle(0xAA8860, 1); g.fillEllipse(px,py,pw,ph);
        g.fillStyle(0xCC9A70, 0.5); g.fillEllipse(px-2,py-2,pw*0.5,ph*0.4);
      });
    } else if (habitat === 'grass') {
      g.fillGradientStyle(0x7ED848, 0x7ED848, 0x4AAF28, 0x4AAF28, 1);
      g.fillRect(20, 88, 500, 584);
      g.fillStyle(0xB8F0FF, 0.35); g.fillRect(20, 88, 500, 220);
      g.fillStyle(0x3A9820, 1); g.fillRect(20, 600, 500, 72);
      g.fillStyle(0x5AC832, 0.55); g.fillRect(20, 596, 500, 14);
      for (let gx = 25; gx < 515; gx += 22) {
        const gh = 10 + Math.random() * 14;
        g.fillStyle(0x44CC28, 0.80);
        g.fillTriangle(gx-4, 596, gx+4, 596, gx, 596-gh);
        g.fillStyle(0x66EE40, 0.50);
        g.fillTriangle(gx-2, 596, gx+3, 596, gx+1, 596-gh*0.7);
      }
    } else if (habitat === 'aquatic') {
      g.fillGradientStyle(0x0088CC, 0x0088CC, 0x00446A, 0x00446A, 1);
      g.fillRect(20, 88, 500, 584);
      for (let ri = 0; ri < 7; ri++) {
        const rx = 80 + ri * 60, rw = 20 + ri % 3 * 8;
        g.fillStyle(0x44CCFF, 0.06);
        const rayPts = [{x:rx,y:88},{x:rx+rw,y:88},{x:rx+rw*1.8,y:400},{x:rx-rw*0.6,y:400}];
        g.fillPoints(rayPts, true);
      }
      g.fillStyle(0xD4A84A, 1); g.fillRect(20, 610, 500, 62);
      g.fillStyle(0xE8C870, 0.45); g.fillRect(20, 610, 500, 8);
      g.lineStyle(1, 0xC49830, 0.40);
      for (let sx = 30; sx < 510; sx += 28) {
        g.beginPath(); g.moveTo(sx, 624); g.lineTo(sx+14, 620); g.lineTo(sx+28, 624); g.strokePath();
      }
      g.fillStyle(0x66EEFF, 0.20); g.fillRect(20, 88, 500, 10);
      g.fillStyle(0xAAFFFF, 0.12); g.fillRect(20, 88, 500, 4);
    }

    this._drawDecorations(g, W, H, habitat);
  }

  private _drawPerspectiveFloor(
    g: Phaser.GameObjects.Graphics,
    W: number, H: number, groundY: number,
    numCols: number, numRows: number,
    tileColA: number, tileColB: number,
    gridCol: number, gridAlpha: number
  ): void {
    const vpX = W / 2;
    for (let row = 0; row < numRows; row++) {
      const t0 = Math.pow(row / numRows, 1.6);
      const t1 = Math.pow((row + 1) / numRows, 1.6);
      const y0 = groundY + (H - groundY) * t0;
      const y1 = groundY + (H - groundY) * t1;
      const fade = 0.55 + t0 * 0.45;
      for (let col = 0; col < numCols; col++) {
        const bc = (row + col) % 2 === 0 ? tileColA : tileColB;
        const tr = Math.round(((bc >> 16) & 0xFF) * fade);
        const tg = Math.round(((bc >> 8)  & 0xFF) * fade);
        const tb = Math.round((bc & 0xFF) * fade);
        g.fillStyle((tr << 16) | (tg << 8) | tb, 1);
        const x0L = vpX + (col / numCols - 0.5) * W * t0;
        const x0R = vpX + ((col + 1) / numCols - 0.5) * W * t0;
        const x1L = vpX + (col / numCols - 0.5) * W * t1;
        const x1R = vpX + ((col + 1) / numCols - 0.5) * W * t1;
        g.fillTriangle(x0L, y0, x0R, y0, x1R, y1);
        g.fillTriangle(x0L, y0, x1R, y1, x1L, y1);
      }
    }
    g.lineStyle(1.2, gridCol, gridAlpha);
    for (let col = 0; col <= numCols; col++) {
      g.beginPath(); g.moveTo(vpX, groundY); g.lineTo((col / numCols) * W, H); g.strokePath();
    }
    for (let row = 1; row <= numRows; row++) {
      const t = Math.pow(row / numRows, 1.6);
      const y = groundY + (H - groundY) * t;
      g.beginPath(); g.moveTo(vpX * (1 - t), y); g.lineTo(vpX + (W - vpX) * t, y); g.strokePath();
    }
    // Depth-shadow at wall/floor junction
    g.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.50, 0.50, 0, 0);
    g.fillRect(0, groundY, W, 26);
  }

  private _drawDecorations(g: Phaser.GameObjects.Graphics, W: number, H: number, habitat: HabitatType) {
    const owned = Game.state?.habitats[habitat].decorations ?? [];
    if (owned.length === 0) return;

    if (habitat === 'dirt') {
      if (owned.includes('dirt_torch')) {
        [[45, H*0.64], [W-45, H*0.64], [85, H*0.52], [W-85, H*0.52]].forEach(([tx, ty]) => {
          g.fillStyle(0x3A2A10, 1); g.fillRect(tx - 4, ty - 18, 8, 22);
          g.fillStyle(0xFF8800, 0.45); g.fillCircle(tx, ty - 22, 14);
          g.fillStyle(0xFFCC44, 0.75); g.fillCircle(tx, ty - 22, 8);
          g.fillStyle(0xFFEE88, 1);    g.fillCircle(tx, ty - 22, 4);
        });
      }
      if (owned.includes('dirt_shrine')) {
        const sx = W * 0.18, sy = H * 0.685;
        g.fillStyle(0x8844CC, 0.22); g.fillCircle(sx, sy - 20, 30);
        g.fillStyle(0x6644AA, 1); g.fillRect(sx - 12, sy - 34, 24, 38);
        g.fillStyle(0x9966CC, 1); g.fillTriangle(sx - 16, sy - 34, sx + 16, sy - 34, sx, sy - 56);
        g.fillStyle(0xFFDD66, 1); g.fillCircle(sx, sy - 34, 5);
        g.lineStyle(2, 0xBB88EE, 0.6); g.strokeRect(sx - 12, sy - 34, 24, 38);
      }
      if (owned.includes('dirt_garden')) {
        const gx = W * 0.82, gy = H * 0.685;
        g.fillStyle(0x1A4A18, 1); g.fillEllipse(gx, gy - 10, 52, 22);
        [[gx - 12, gy - 20, 0xFF5252], [gx, gy - 26, 0xFF9800], [gx + 12, gy - 20, 0xE91E63]].forEach(([fx, fy, fc]) => {
          for (let pi = 0; pi < 5; pi++) { const pa = (pi/5)*Math.PI*2; g.fillStyle(fc as number, 1); g.fillCircle((fx as number) + Math.cos(pa)*4, (fy as number) + Math.sin(pa)*4, 3); }
          g.fillStyle(0xFFFDE7, 1); g.fillCircle(fx as number, fy as number, 2.5);
        });
      }
    } else if (habitat === 'grass') {
      if (owned.includes('grass_flower')) {
        [[90, H*0.742], [225, H*0.755], [360, H*0.748], [480, H*0.742]].forEach(([fx, fy]) => {
          const fc = [0xFF5252, 0xFF9800, 0xE91E63, 0xFFEB3B][Math.floor(Math.random()*4)];
          for (let pi = 0; pi < 6; pi++) { const pa = (pi/6)*Math.PI*2; g.fillStyle(fc, 1); g.fillCircle((fx as number) + Math.cos(pa)*5, (fy as number) + Math.sin(pa)*5, 4); }
          g.fillStyle(0xFFFDE7, 1); g.fillCircle(fx as number, fy as number, 3);
        });
      }
      if (owned.includes('grass_pond')) {
        const px = W * 0.15, py = H * 0.66;
        g.fillStyle(0x1565C0, 0.75); g.fillEllipse(px, py, 64, 26);
        g.fillStyle(0x42A5F5, 0.45); g.fillEllipse(px - 8, py - 5, 28, 10);
        g.lineStyle(1.5, 0x90CAF9, 0.6); g.strokeEllipse(px, py, 64, 26);
      }
      if (owned.includes('grass_lantern')) {
        [[W*0.28, H*0.20], [W*0.72, H*0.22]].forEach(([lx, ly]) => {
          g.lineStyle(2, 0x558855, 0.7); g.beginPath(); g.moveTo(lx as number, 0); g.lineTo(lx as number, ly as number - 14); g.strokePath();
          g.fillStyle(0x225522, 1); g.fillRoundedRect((lx as number) - 10, (ly as number) - 14, 20, 28, 4);
          g.fillStyle(0xFFEE66, 0.88); g.fillRoundedRect((lx as number) - 7, (ly as number) - 10, 14, 20, 3);
          g.fillStyle(0xFFFF88, 0.25); g.fillCircle(lx as number, ly as number, 28);
        });
      }
    } else if (habitat === 'aquatic') {
      if (owned.includes('aqua_coral')) {
        [[140, H*0.69, 0xFF5252], [290, H*0.695, 0xE91E63], [430, H*0.685, 0x7C4DFF]].forEach(([cx, cy, cc]) => {
          g.fillStyle(cc as number, 1);
          g.fillRect((cx as number) - 4, cy as number, 8, 36); g.fillCircle(cx as number, cy as number, 13);
          g.fillCircle((cx as number) - 9, (cy as number) + 8, 9); g.fillCircle((cx as number) + 9, (cy as number) + 10, 10);
          g.fillStyle(lighten(cc as number, 40), 0.5); g.fillCircle((cx as number) - 3, (cy as number) - 4, 5);
        });
      }
      if (owned.includes('aqua_chest')) {
        const chx = W * 0.8, chy = H * 0.64;
        g.fillStyle(0x5D3A1A, 1); g.fillRect(chx - 18, chy - 16, 36, 28);
        g.fillStyle(0x8B5E3C, 1); g.fillRoundedRect(chx - 18, chy - 20, 36, 12, 4);
        g.fillStyle(0xFFD700, 1); g.fillRect(chx - 5, chy - 6, 10, 8); g.fillCircle(chx, chy - 2, 4);
        g.lineStyle(2, 0xFFD700, 0.8); g.strokeRect(chx - 18, chy - 16, 36, 28);
      }
      if (owned.includes('aqua_ruins')) {
        const rx = W * 0.14, ry = H * 0.60;
        g.fillStyle(0x5A6A7A, 0.85); g.fillRect(rx - 8, ry, 16, H * 0.12); g.fillRect(rx + 28, ry - 10, 16, H * 0.13);
        g.fillStyle(0x4A5A6A, 1); g.fillRect(rx - 12, ry - 12, 72, 14);
        g.fillStyle(0x6A7A8A, 0.4); g.fillRect(rx - 6, ry + 4, 10, H * 0.10); g.fillRect(rx + 30, ry + 2, 10, H * 0.11);
        g.lineStyle(1.5, 0x88AABB, 0.3); g.strokeRect(rx - 8, ry, 16, H * 0.12);
      }
    }
  }

  private _drawVignette(W: number, H: number) {
    const v = this.add.graphics().setDepth(1);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.20, 0.20, 0, 0);
    v.fillRect(0, 0, W, H * 0.22);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.12, 0, 0, 0.12);
    v.fillRect(0, 0, W * 0.18, H * 0.72);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.12, 0.12, 0);
    v.fillRect(W * 0.82, 0, W * 0.18, H * 0.72);
  }

  // ── FOREGROUND FRAME ──────────────────────────────────────────────────────

  private _drawForeground(W: number, H: number, habitat: HabitatType) {
    const fg = this.add.graphics().setDepth(2);
    const floorY = H * 0.62 + 28;

    if (habitat === 'dirt') {
      // Cave burrow den (right side)
      const caveX = 390, caveY = floorY - 20;
      fg.fillStyle(0x5A3818, 1); fg.fillEllipse(caveX, floorY - 44, 200, 120);
      fg.fillStyle(0x7A5030, 0.7); fg.fillEllipse(caveX - 10, floorY - 60, 160, 90);
      fg.fillStyle(0x2A1208, 1);
      fg.fillEllipse(caveX, caveY - 28, 84, 90);
      fg.fillRect(caveX - 42, caveY - 28, 84, 48);
      fg.lineStyle(4, 0x8B5A30, 1);
      fg.beginPath(); fg.arc(caveX, caveY - 28, 44, Math.PI, 0, false); fg.strokePath();
      fg.lineStyle(2.5, 0xAA7A48, 0.70);
      fg.beginPath(); fg.arc(caveX, caveY - 28, 38, Math.PI, 0, false); fg.strokePath();
      fg.fillStyle(0xFF9900, 0.10); fg.fillEllipse(caveX, caveY, 70, 60);
      fg.fillStyle(0x6688CC, 0.80); fg.fillRoundedRect(caveX - 28, caveY - 8, 56, 16, 4);
      fg.lineStyle(1, 0x4466AA, 0.7); fg.strokeRoundedRect(caveX - 28, caveY - 8, 56, 16, 4);
      fg.fillStyle(0x8899DD, 0.6);
      fg.fillRect(caveX - 26, caveY - 6, 22, 6);
      fg.fillRect(caveX + 4, caveY - 6, 22, 6);
      // Wooden ladder
      const lx = caveX - 58, ly = floorY - 56;
      fg.lineStyle(4, 0x8B5A2A, 1);
      fg.beginPath(); fg.moveTo(lx, ly); fg.lineTo(lx, floorY); fg.strokePath();
      fg.beginPath(); fg.moveTo(lx + 20, ly); fg.lineTo(lx + 20, floorY); fg.strokePath();
      [0.2, 0.45, 0.70, 0.90].forEach(tt => {
        const ry = ly + (floorY - ly) * tt;
        fg.lineStyle(3, 0xAA7A3A, 1);
        fg.beginPath(); fg.moveTo(lx, ry); fg.lineTo(lx + 20, ry); fg.strokePath();
      });
      // Stone water pool (left)
      const poolX = 130, poolY = floorY + 4;
      fg.fillStyle(0x557788, 1); fg.fillEllipse(poolX, poolY, 90, 36);
      fg.fillStyle(0x2244AA, 0.70); fg.fillEllipse(poolX, poolY - 2, 74, 26);
      fg.fillStyle(0x44AACC, 0.55); fg.fillEllipse(poolX - 8, poolY - 8, 30, 10);
      ;([[poolX-44,poolY+4,18,10],[poolX-26,poolY+10,14,8],[poolX+8,poolY+10,16,8],[poolX+30,poolY+6,20,10],[poolX+44,poolY,14,8]] as [number,number,number,number][]).forEach(([sx,sy,sw,sh]) => {
        fg.fillStyle(0x8899AA, 1); fg.fillEllipse(sx,sy,sw,sh);
        fg.fillStyle(0xAABBCC, 0.5); fg.fillEllipse(sx-2,sy-2,sw*0.5,sh*0.5);
      });
      // Mushrooms
      ;([[220, floorY - 2, 0xFF2222, 16, 20], [250, floorY - 2, 0xFF4444, 10, 13], [170, floorY - 2, 0xFF6600, 13, 16]] as [number,number,number,number,number][]).forEach(([mx2, my2, mc, mr, mh]) => {
        fg.fillStyle(0xDDCC88, 1); fg.fillRect(mx2 - 4, my2 - mh * 0.6, 8, mh * 0.6);
        fg.fillStyle(mc, 1); fg.fillEllipse(mx2, my2 - mh * 0.8, mr * 2, mh);
        fg.lineStyle(1.5, 0x881100, 0.6); fg.strokeEllipse(mx2, my2 - mh * 0.8, mr * 2, mh);
        fg.fillStyle(0xFFFFFF, 0.85);
        fg.fillCircle(mx2 - 4, my2 - mh * 0.9, 3); fg.fillCircle(mx2 + 3, my2 - mh, 2); fg.fillCircle(mx2, my2 - mh * 0.75, 2.5);
      });
      // Plants
      ;([[70, floorY - 5], [310, floorY - 5], [460, floorY - 4]] as [number,number][]).forEach(([px, py]) => {
        for (let li = 0; li < 4; li++) {
          const la = -Math.PI * 0.8 + li * 0.52, ll = 22 + li * 5;
          fg.lineStyle(2.5, 0x3A7A10, 0.90);
          fg.beginPath(); fg.moveTo(px, py); fg.lineTo(px + Math.cos(la) * ll, py + Math.sin(la) * ll); fg.strokePath();
          fg.fillStyle(0x4AAF18, 0.88); fg.fillEllipse(px + Math.cos(la) * ll, py + Math.sin(la) * ll, 20, 10);
        }
      });
      ;([[270,floorY+2,8,5],[288,floorY,10,6],[305,floorY+3,7,5]] as [number,number,number,number][]).forEach(([px,py,pw,ph]) => {
        fg.fillStyle(0xAA8860, 1); fg.fillEllipse(px,py,pw,ph);
        fg.fillStyle(0xCC9A70, 0.45); fg.fillEllipse(px-1,py-1,pw*0.5,ph*0.4);
      });

    } else if (habitat === 'grass') {
      // Wooden fence (right)
      const fenceX = 340;
      [0,1,2].forEach(fi => {
        const fy2 = floorY - 52 + fi * 22;
        fg.fillStyle(0xAA7A3A, 1); fg.fillRect(fenceX, fy2, 130, 6);
        fg.fillStyle(0xCC9A55, 0.5); fg.fillRect(fenceX, fy2, 130, 2);
        fg.lineStyle(1, 0x7A4A18, 0.5); fg.strokeRect(fenceX, fy2, 130, 6);
      });
      [fenceX, fenceX+40, fenceX+80, fenceX+120, 470].forEach(fx2 => {
        fg.fillStyle(0x8B5A20, 1); fg.fillRect(fx2 - 5, floorY - 60, 10, 68);
        fg.fillStyle(0xAA7A35, 0.55); fg.fillRect(fx2 - 3, floorY - 60, 4, 68);
      });
      // Tree stump
      fg.fillStyle(0x6B3A18, 1); fg.fillEllipse(160, floorY + 6, 60, 24);
      fg.fillStyle(0x8B5A28, 1); fg.fillRect(132, floorY - 52, 56, 60);
      fg.fillStyle(0xAA7A40, 0.5); fg.fillRect(134, floorY - 50, 18, 58);
      fg.fillStyle(0x7A4A22, 1); fg.fillEllipse(160, floorY - 50, 60, 22);
      fg.lineStyle(1.5, 0x5A3212, 0.60); fg.strokeEllipse(160, floorY - 50, 52, 18);
      fg.lineStyle(1, 0x5A3212, 0.40); fg.strokeEllipse(160, floorY - 50, 40, 14);
      fg.lineStyle(0.8, 0x5A3212, 0.25); fg.strokeEllipse(160, floorY - 50, 28, 10);
      fg.fillStyle(0xDDCC88, 1); fg.fillRect(154, floorY - 70, 7, 18);
      fg.fillStyle(0xFF3322, 1); fg.fillEllipse(157, floorY - 76, 24, 16);
      fg.fillStyle(0xFFFFFF, 0.85); fg.fillCircle(151, floorY - 82, 3); fg.fillCircle(159, floorY - 80, 2);
      // Flower patch
      ;([[80, floorY-4, 0xFF3388], [108, floorY-2, 0xFFAA00], [68, floorY-6, 0xFF88CC], [95, floorY-8, 0xFF5500], [120, floorY-4, 0xAA44FF]] as [number,number,number][]).forEach(([fx2, fy2, fc]) => {
        fg.lineStyle(2, 0x2A7A10, 1); fg.beginPath(); fg.moveTo(fx2, fy2); fg.lineTo(fx2, fy2-20); fg.strokePath();
        for (let pi=0;pi<5;pi++) { const pa=(pi/5)*Math.PI*2; fg.fillStyle(fc,1); fg.fillCircle(fx2+Math.cos(pa)*8,fy2-20+Math.sin(pa)*8,6); }
        fg.fillStyle(0xFFFF88,1); fg.fillCircle(fx2,fy2-20,4);
      });
      // Small pond
      const pondX = 430, pondY = floorY + 6;
      fg.fillStyle(0x2266AA, 0.80); fg.fillEllipse(pondX, pondY, 80, 28);
      fg.fillStyle(0x44AADD, 0.55); fg.fillEllipse(pondX - 6, pondY - 4, 40, 14);
      fg.lineStyle(2, 0x1A4488, 0.60); fg.strokeEllipse(pondX, pondY, 80, 28);
      fg.fillStyle(0x2A8A18, 0.85); fg.fillCircle(pondX + 14, pondY - 2, 12);
      fg.fillStyle(0x3AAA22, 0.55); fg.fillCircle(pondX + 10, pondY - 4, 7);

    } else {
      // Aquatic
      ;([[60, floorY - 30, 0xFF5252, 28], [42, floorY - 55, 0xFF8888, 18], [78, floorY - 42, 0xFF3366, 22]] as [number,number,number,number][]).forEach(([cx, cy, cc, cr]) => {
        fg.fillStyle(cc, 1); fg.fillEllipse(cx, cy, cr*2, cr*2.5);
        fg.fillStyle(cc, 0.65); fg.fillRect(cx - cr*0.4, cy, cr*0.8, floorY - cy);
        fg.fillStyle(lighten(cc, 55), 0.5); fg.fillCircle(cx - cr*0.3, cy - cr*0.3, cr*0.4);
        fg.lineStyle(1.5, darken(cc, 30), 0.60); fg.strokeEllipse(cx, cy, cr*2, cr*2.5);
      });
      for (let si=0;si<5;si++) {
        const sx2=30+si*14, swH=90+si*12;
        fg.lineStyle(5-si%2, 0x1A8A28, 0.75);
        fg.beginPath(); fg.moveTo(sx2, floorY); fg.lineTo(sx2+12, floorY-swH*0.4); fg.lineTo(sx2-6, floorY-swH*0.7); fg.lineTo(sx2+8, floorY-swH); fg.strokePath();
        fg.fillStyle(0x2AAA30, 0.65); fg.fillEllipse(sx2+8, floorY-swH, 18, 8);
      }
      // Rock arch center
      fg.fillStyle(0x557799, 1); fg.fillEllipse(270, floorY - 60, 180, 140);
      fg.fillStyle(0x2244AA, 1); fg.fillEllipse(270, floorY - 30, 110, 90);
      fg.fillStyle(0x445566, 0.65); fg.fillRect(195, floorY - 60, 80, 68); fg.fillRect(290, floorY - 60, 80, 68);
      // Treasure chest
      fg.fillStyle(0x8B5A20, 1); fg.fillRoundedRect(218, floorY - 22, 44, 28, 4);
      fg.fillStyle(0xCC8830, 1); fg.fillRoundedRect(220, floorY - 24, 44, 12, 3);
      fg.fillStyle(0xFFCC44, 1); fg.fillRoundedRect(236, floorY - 20, 14, 10, 2);
      fg.fillStyle(0xFFEE88, 0.8); fg.fillCircle(243, floorY - 15, 3);
      // Right coral
      ;([[460, floorY - 28, 0xFFAA44, 26], [480, floorY - 48, 0xFF6B9D, 18], [444, floorY - 40, 0x88CCFF, 20]] as [number,number,number,number][]).forEach(([cx, cy, cc, cr]) => {
        fg.fillStyle(cc, 1); fg.fillEllipse(cx, cy, cr*2, cr*2.5);
        fg.fillStyle(cc, 0.65); fg.fillRect(cx - cr*0.4, cy, cr*0.8, floorY - cy);
        fg.fillStyle(lighten(cc, 55), 0.5); fg.fillCircle(cx + cr*0.3, cy - cr*0.3, cr*0.4);
      });
      // Right seaweed
      for (let si=0;si<4;si++) {
        const sx2=W-30-si*14, swH=80+si*14;
        fg.lineStyle(4-si%2, 0x1A8A28, 0.70);
        fg.beginPath(); fg.moveTo(sx2, floorY); fg.lineTo(sx2-10, floorY-swH*0.4); fg.lineTo(sx2+8, floorY-swH*0.7); fg.lineTo(sx2-6, floorY-swH); fg.strokePath();
      }
      // Bubbles
      [[80,380,10],[130,320,8],[390,360,13],[450,290,9],[270,260,11]].forEach(([bx,by,br]) => {
        fg.lineStyle(1.5, 0xAAEEFF, 0.55); fg.strokeCircle(bx, by, br);
        fg.fillStyle(0xFFFFFF, 0.15); fg.fillCircle(bx - 3, by - 3, 4);
      });
    }
  }

  private _drawTerrariumFrame(W: number, H: number) {
    const tankL = 20, tankR = 520, tankT = 88, tankB = 672;
    const frameThick = 28;
    const woodDark = 0x5C3A1A, woodMid = 0x8B5A2A, woodLight = 0xAA7A40;
    const fr = this.add.graphics().setDepth(14);

    // Wooden top frame
    fr.fillStyle(woodDark, 1); fr.fillRoundedRect(tankL - 8, tankT - frameThick, tankR - tankL + 16, frameThick + 4, { tl: 12, tr: 12, bl: 0, br: 0 });
    fr.fillStyle(woodMid, 1);  fr.fillRoundedRect(tankL - 6, tankT - frameThick + 2, tankR - tankL + 12, frameThick - 2, { tl: 10, tr: 10, bl: 0, br: 0 });
    fr.fillStyle(woodLight, 0.40); fr.fillRoundedRect(tankL - 4, tankT - frameThick + 3, tankR - tankL + 8, 8, { tl: 8, tr: 8, bl: 0, br: 0 });
    fr.lineStyle(1, woodDark, 0.30);
    for (let wx = tankL + 20; wx < tankR - 20; wx += 35) {
      fr.beginPath(); fr.moveTo(wx, tankT - frameThick + 2); fr.lineTo(wx + 12, tankT); fr.strokePath();
    }
    // Wooden bottom frame
    fr.fillStyle(woodDark, 1); fr.fillRoundedRect(tankL - 8, tankB - 4, tankR - tankL + 16, frameThick + 4, { tl: 0, tr: 0, bl: 12, br: 12 });
    fr.fillStyle(woodMid, 1);  fr.fillRoundedRect(tankL - 6, tankB, tankR - tankL + 12, frameThick - 2, { tl: 0, tr: 0, bl: 10, br: 10 });
    fr.fillStyle(woodLight, 0.35); fr.fillRect(tankL - 4, tankB + 1, tankR - tankL + 8, 5);
    // Side strips
    fr.fillStyle(woodDark, 1); fr.fillRect(tankL - 8, tankT - frameThick, 10, tankB - tankT + frameThick + 4);
    fr.fillStyle(woodDark, 1); fr.fillRect(tankR - 2, tankT - frameThick, 10, tankB - tankT + frameThick + 4);
    fr.fillStyle(woodMid, 0.55); fr.fillRect(tankL - 6, tankT, 4, tankB - tankT);
    fr.fillStyle(woodMid, 0.55); fr.fillRect(tankR, tankT, 4, tankB - tankT);
    // Corner brackets
    ;([[tankL - 8, tankT - frameThick], [tankR - 2, tankT - frameThick], [tankL - 8, tankB], [tankR - 2, tankB]] as [number, number][]).forEach(([cx, cy]) => {
      fr.fillStyle(0x3A2208, 1); fr.fillRoundedRect(cx - 2, cy - 2, 16, 16, 4);
      fr.fillStyle(0x6A4A20, 0.7); fr.fillRoundedRect(cx, cy, 10, 10, 3);
    });
    // Glass reflections
    fr.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0.18, 0, 0, 0.18);
    fr.fillRect(tankL + 2, tankT, 18, tankB - tankT);
    fr.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0, 0.14, 0.14, 0);
    fr.fillRect(tankR - 20, tankT, 18, tankB - tankT);
    fr.fillStyle(0xFFFFFF, 0.22); fr.fillTriangle(tankL + 2, tankT, tankL + 60, tankT, tankL + 2, tankT + 80);
    fr.fillStyle(0xFFFFFF, 0.10); fr.fillTriangle(tankL + 2, tankT, tankL + 100, tankT, tankL + 2, tankT + 130);
    fr.fillStyle(0xFFFFFF, 0.12); fr.fillRect(tankL + 2, tankT, tankR - tankL - 4, 3);
    // Overhead lamp
    fr.lineStyle(2, 0x3A2208, 1);
    fr.beginPath(); fr.moveTo(W / 2, tankT - frameThick); fr.lineTo(W / 2, tankT - frameThick + 18); fr.strokePath();
    fr.fillStyle(0xCC9940, 1);
    fr.fillTriangle(W / 2 - 26, tankT - frameThick + 18, W / 2 + 26, tankT - frameThick + 18, W / 2, tankT - frameThick + 7);
    fr.fillStyle(0xEEBB55, 0.7);
    fr.fillTriangle(W / 2 - 18, tankT - frameThick + 18, W / 2 + 18, tankT - frameThick + 18, W / 2, tankT - frameThick + 10);
    fr.fillStyle(0xFFEE88, 1); fr.fillCircle(W / 2, tankT - frameThick + 20, 6);
    fr.fillStyle(0xFFFFCC, 0.6); fr.fillCircle(W / 2, tankT - frameThick + 20, 3);
    fr.fillStyle(0xFFEE88, 0.06);
    fr.fillPoints([{ x: W/2-120, y: tankT }, { x: W/2+120, y: tankT }, { x: W/2+180, y: tankT+200 }, { x: W/2-180, y: tankT+200 }], true);
    fr.fillStyle(0xFFFF99, 0.04);
    fr.fillPoints([{ x: W/2-60, y: tankT }, { x: W/2+60, y: tankT }, { x: W/2+90, y: tankT+120 }, { x: W/2-90, y: tankT+120 }], true);
    // Hanging sign
    const signW = 160, signH = 44, signX = W / 2 + 100, signY = 88 + 36;
    fr.lineStyle(2.5, 0x6B3A10, 1);
    fr.beginPath(); fr.moveTo(signX - signW/2 + 16, 88); fr.lineTo(signX - signW/2 + 16, signY - signH/2); fr.strokePath();
    fr.beginPath(); fr.moveTo(signX + signW/2 - 16, 88); fr.lineTo(signX + signW/2 - 16, signY - signH/2); fr.strokePath();
    fr.fillStyle(0x4A2208, 1);
    fr.fillCircle(signX - signW/2 + 16, signY - signH/2, 4);
    fr.fillCircle(signX + signW/2 - 16, signY - signH/2, 4);
    fr.fillStyle(0xC8A060, 1); fr.fillRoundedRect(signX - signW/2, signY - signH/2, signW, signH, 8);
    fr.fillStyle(0xDDBB78, 0.55); fr.fillRoundedRect(signX - signW/2 + 3, signY - signH/2 + 3, signW - 6, signH * 0.45, { tl: 6, tr: 6, bl: 0, br: 0 });
    fr.lineStyle(2, 0x8B5A20, 0.70); fr.strokeRoundedRect(signX - signW/2, signY - signH/2, signW, signH, 8);
    fr.lineStyle(1, 0xAA7A40, 0.35); fr.strokeRoundedRect(signX - signW/2 + 3, signY - signH/2 + 3, signW - 6, signH - 6, 5);
    const habitatLabels: Record<string, string> = { dirt: '🪨 บ้านดินน้อย', grass: '🌿 บ้านป่าน้อย', aquatic: '🌊 บ้านใต้น้ำ' };
    this.add.text(signX, signY, habitatLabels[this._sp.habitat] ?? '🏠 บ้าน', {
      fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#5C3A10',
    }).setOrigin(0.5).setDepth(15);
  }

  // ── MONSTER AREA ──────────────────────────────────────────────────────────

  private _buildMonsterArea(W: number, H: number, sp: Species) {
    const groundY = H * 0.62, monY = groundY - 78;
    const leftX = 112, rightX = W - 112;

    // Habitat-specific decorative stage platform — draws at origin (0,y) so x can follow monster
    const platformG = this.add.graphics().setDepth(3);
    this._platformG = platformG;
    if (sp.habitat === 'dirt') {
      platformG.fillStyle(0xFF8800, 0.07); platformG.fillCircle(0, groundY, 140);
      platformG.fillStyle(0xFF7700, 0.11); platformG.fillCircle(0, groundY, 110);
      platformG.fillStyle(0xFF6600, 0.16); platformG.fillCircle(0, groundY, 82);
      platformG.fillStyle(0x5A2A0A, 1); platformG.fillEllipse(0, groundY, 168, 44);
      platformG.fillStyle(0x7A3A18, 0.80); platformG.fillEllipse(0, groundY - 5, 152, 34);
      platformG.fillStyle(0xCC7722, 0.30); platformG.fillEllipse(0, groundY - 8, 128, 24);
      platformG.lineStyle(1.5, 0xFFAA22, 0.55); platformG.strokeEllipse(0, groundY, 168, 44);
      platformG.lineStyle(1, 0xFFCC44, 0.35); platformG.strokeEllipse(0, groundY, 150, 34);
      for (let ri = 0; ri < 6; ri++) {
        const ra = (ri / 6) * Math.PI * 2;
        const rx = Math.cos(ra) * 71, ry = groundY + Math.sin(ra) * 71 * 0.32;
        platformG.fillStyle(0xFFCC44, 0.65); platformG.fillCircle(rx, ry, 3.5);
      }
    } else if (sp.habitat === 'grass') {
      platformG.fillStyle(0x88FF44, 0.06); platformG.fillCircle(0, groundY, 140);
      platformG.fillStyle(0x44DD22, 0.10); platformG.fillCircle(0, groundY, 108);
      platformG.fillStyle(0x22AA10, 0.14); platformG.fillCircle(0, groundY, 80);
      platformG.fillStyle(0x3A7222, 0.90); platformG.fillEllipse(0, groundY, 168, 44);
      platformG.fillStyle(0x5A9A32, 0.72); platformG.fillEllipse(0, groundY - 5, 152, 34);
      platformG.fillStyle(0x88BB55, 0.38); platformG.fillEllipse(0, groundY - 8, 128, 24);
      platformG.lineStyle(1.5, 0x88FF44, 0.45); platformG.strokeEllipse(0, groundY, 168, 44);
      const fColors = [0xFF5252, 0xFF9800, 0xE91E63, 0xFFEB3B, 0x9C27B0, 0x4CAF50, 0x03A9F4, 0xFF6EC7];
      for (let fi = 0; fi < 8; fi++) {
        const fa = (fi / 8) * Math.PI * 2;
        const fx = Math.cos(fa) * 75, fy = groundY + Math.sin(fa) * 75 * 0.30;
        platformG.fillStyle(fColors[fi], 0.95); platformG.fillCircle(fx, fy, 5.5);
        platformG.fillStyle(0xFFF9C4, 1); platformG.fillCircle(fx, fy, 2.5);
      }
    } else {
      platformG.fillStyle(0x44EEFF, 0.07); platformG.fillCircle(0, groundY, 140);
      platformG.fillStyle(0x22CCEE, 0.11); platformG.fillCircle(0, groundY, 108);
      platformG.fillStyle(0x00AADD, 0.15); platformG.fillCircle(0, groundY, 80);
      platformG.fillStyle(0xCCF4FF, 1); platformG.fillEllipse(0, groundY, 168, 44);
      platformG.fillStyle(0xAAEEFF, 0.85); platformG.fillEllipse(0, groundY - 5, 152, 34);
      platformG.fillStyle(0xFFFFFF, 0.52); platformG.fillEllipse(0, groundY - 8, 128, 24);
      platformG.lineStyle(2, 0x44EEFF, 0.45); platformG.strokeEllipse(0, groundY, 172, 46);
      platformG.lineStyle(1, 0x88FFFF, 0.28); platformG.strokeEllipse(0, groundY, 194, 52);
      for (let si = 0; si < 6; si++) {
        const sa = (si / 6) * Math.PI * 2;
        const sx = Math.cos(sa) * 71, sy = groundY + Math.sin(sa) * 71 * 0.30;
        platformG.fillStyle(0xF0F8FF, 0.90); platformG.fillCircle(sx, sy, 5.5);
        platformG.fillStyle(0xFFFFFF, 0.70); platformG.fillCircle(sx - 1, sy - 1, 2.5);
      }
    }
    platformG.x = W / 2;

    const shadowG = this.add.graphics().setDepth(4);
    shadowG.fillStyle(0x000000, 0.08); shadowG.fillEllipse(W / 2, groundY, 190, 32);
    shadowG.fillStyle(0x000000, 0.16); shadowG.fillEllipse(W / 2, groundY - 3, 130, 20);
    shadowG.fillStyle(0x000000, 0.22); shadowG.fillEllipse(W / 2, groundY - 6, 85, 13);

    const texKey = makeMonsterTexture(this, this._monster);
    this._monImg = this.add.image(leftX, monY, texKey).setDisplaySize(182, 182).setDepth(5);
    this._dirtyOverlay = this.add.graphics().setDepth(6);

    this._walkTween = this.tweens.add({
      targets: this._monImg, x: rightX, duration: 3200, ease: 'Sine.InOut',
      yoyo: true, repeat: -1,
      onYoyo: () => { this._monImg.setFlipX(true); },
      onRepeat: () => { this._monImg.setFlipX(false); },
      onUpdate: () => { this._updateDirtyOverlay(); this._updateHappyGlow(); if (this._platformG) this._platformG.x = this._monImg.x; },
    });

    this._monBaseScale = this._monImg.scaleX;
    this._bobTween = this.tweens.add({
      targets: this._monImg, y: monY - 9, duration: 950,
      ease: 'Sine.InOut', yoyo: true, repeat: -1,
      onUpdate: () => { this._updateDirtyOverlay(); this._updateHappyGlow(); if (this._platformG) this._platformG.x = this._monImg.x; },
      onRepeat: () => {
        const bs = this._monBaseScale;
        this.tweens.add({
          targets: this._monImg,
          scaleX: bs * 1.06, scaleY: bs * 0.94,
          duration: 70, ease: 'Quad.Out', yoyo: true,
        });
      },
    });

    const bs = this._monBaseScale;
    this._breatheTween = this.tweens.add({
      targets: this._monImg,
      scaleX: bs * 1.035,
      scaleY: bs * 1.035,
      duration: 2200,
      ease: 'Sine.InOut',
      yoyo: true, repeat: -1,
    });

    this._monY = monY;
    this._startMoodBubble();
  }

  // ── FOOD BOWL ─────────────────────────────────────────────────────────────

  private _buildBowl(W: number, H: number) {
    this._bowlX = W * 0.72;
    this._bowlY = H * 0.624;
    this._bowlGfx = this.add.graphics().setDepth(4);
    this._bowlLabelTxt = this.add.text(this._bowlX, this._bowlY + 20, '', {
      fontFamily: FONT, fontSize: '13px', color: '#DDBB88',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(5);
    this._drawBowl();

    // Steam particles when bowl has food
    this._bowlSteamTimer = this.time.addEvent({
      delay: 900, loop: true,
      callback: () => {
        if (!this._monster.bowl || this._monster.bowl.remaining <= 0) return;
        if (!this.scene?.isActive('HabitatRoom')) return;
        const sg = this.add.graphics().setDepth(6);
        sg.fillStyle(0xFFFFFF, 0.42);
        sg.fillEllipse(0, 0, 5 + Math.random() * 4, 7 + Math.random() * 5);
        sg.setPosition(this._bowlX + (Math.random() - 0.5) * 24, this._bowlY - 16);
        this.tweens.add({
          targets: sg,
          y: this._bowlY - 50 - Math.random() * 20,
          x: sg.x + (Math.random() - 0.5) * 18,
          alpha: 0, scaleX: 1.6, scaleY: 1.6,
          duration: 800 + Math.random() * 400, ease: 'Sine.Out',
          onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
        });
      },
    });

    // Eating beat every 20 seconds — visible nom animation + real numeric update
    this._eatTimer = this.time.addEvent({
      delay: 20000, loop: true,
      callback: () => {
        if (!this._monster.bowl || this._monster.bowl.remaining <= 0) return;
        if (!this.scene?.isActive('HabitatRoom')) return;
        const deltaHours = 20 / 3600;
        const ate = Math.min(this._monster.bowl.remaining, BOWL_EAT_RATE * deltaHours);
        this._monster.bowl.remaining -= ate;
        if (this._monster.bowl.remaining < 0.01) this._monster.bowl = null;
        store.setJSON('mps_state', Game.state);
        this._drawBowl();
        this._refreshStats();
        showFloat(this, this._bowlX, this._bowlY - 30, 'nom~', '#FFAA44');
        this._spawnParticles(this._bowlX, this._bowlY - 8, this._monster.bowl?.color ?? 0xFFB300, 5);
      },
    });
  }

  private _drawBowl() {
    const bx = this._bowlX, by = this._bowlY;
    const g = this._bowlGfx;
    if (!g) return;
    g.clear();

    const bowl = this._monster.bowl;
    const hasFood = !!(bowl && bowl.remaining > 0);

    // Drop shadow
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(bx + 3, by + 12, 76, 18);

    // Bowl body (ceramic cream)
    g.fillStyle(0xEEE8D8, 1);
    g.fillEllipse(bx, by + 4, 72, 16);   // bottom rounded
    g.fillRect(bx - 34, by - 12, 68, 16); // sides
    g.fillEllipse(bx, by - 12, 72, 16);   // top opening

    // Food fill inside
    if (hasFood) {
      const pct = Math.min(1, bowl!.remaining / bowl!.maxAmount);
      const fw = 56 * pct + 8;
      const fh = 11 * pct + 3;
      g.fillStyle(bowl!.color, 1);
      g.fillEllipse(bx, by - 12, fw, fh);
      g.fillStyle(0xFFFFFF, 0.38);
      g.fillEllipse(bx - 8, by - 15, fw * 0.36, fh * 0.55);
      if (pct > 0.45) {
        g.lineStyle(2, bowl!.color, 0.30);
        g.strokeEllipse(bx, by - 12, fw + 20, fh + 14);
      }
    }

    // Bowl inner shadow
    g.fillStyle(0x000000, 0.10);
    g.fillEllipse(bx, by - 12, 54, 10);

    // Rim stroke
    g.lineStyle(2.5, 0xC8BEA8, 1);
    g.strokeEllipse(bx, by - 12, 72, 16);
    g.lineStyle(1.5, 0xC8BEA8, 0.55);
    g.strokeEllipse(bx, by + 4, 72, 16);

    // Highlight arc
    g.lineStyle(1.5, 0xFFFFFF, 0.50);
    g.beginPath();
    g.arc(bx - 10, by - 12, 35, Math.PI + 0.38, Math.PI * 2 - 0.38, false);
    g.strokePath();

    // Label
    if (this._bowlLabelTxt) {
      if (hasFood) {
        this._bowlLabelTxt.setText(Math.round(bowl!.remaining) + '/' + bowl!.maxAmount);
        this._bowlLabelTxt.setColor('#DDBB88');
      } else {
        this._bowlLabelTxt.setText(t('bowl.empty'));
        this._bowlLabelTxt.setColor('#887766');
      }
    }
  }

  // ── STATS BARS ────────────────────────────────────────────────────────────

  private _buildStats(W: number, H: number) {
    const statsY = 716;        // below terrarium bottom frame (y=700)
    this._statsY = statsY;
    const barW = W - 92;

    // Frosted glass backing panel behind all bars + xp row
    const habCol = this._sp.habitat === 'dirt' ? 0xFF8800 : this._sp.habitat === 'grass' ? 0x44AA22 : 0x22AAEE;
    const panelY = statsY - 20;
    const panelH = 36 * 3 + 38;
    const panel = this.add.graphics().setDepth(9);
    panel.fillStyle(0x000000, 0.42);
    panel.fillRoundedRect(8, panelY, W - 16, panelH, 14);
    panel.fillStyle(habCol, 0.07);
    panel.fillRoundedRect(8, panelY, W - 16, panelH, 14);
    panel.lineStyle(1.5, habCol, 0.28);
    panel.strokeRoundedRect(8, panelY, W - 16, panelH, 14);
    panel.fillStyle(0xFFFFFF, 0.04);
    panel.fillRoundedRect(10, panelY + 2, W - 20, panelH * 0.38, { tl: 12, tr: 12, bl: 0, br: 0 });

    const defs = [
      { key: 'hunger',      label: '🍖', col: 0xF57C00 },
      { key: 'happiness',   label: '❤️', col: 0xFDD835 },
      { key: 'cleanliness', label: '💧', col: 0x42A5F5 },
    ];
    this._bars = {};

    defs.forEach((d, i) => {
      const by = statsY + i * 36;

      // Icon with drop shadow for depth
      this.add.text(26, by + 2, d.label, { fontFamily: FONT, fontSize: '20px', color: '#000000' })
        .setOrigin(0, 0.5).setDepth(10).setAlpha(0.5);
      this.add.text(24, by, d.label, { fontFamily: FONT, fontSize: '20px' }).setOrigin(0, 0.5).setDepth(10);

      // Bar track: dark outer border + inset dark fill
      const bg = this.add.graphics().setDepth(10);
      bg.fillStyle(0x000000, 0.50);
      bg.fillRoundedRect(52, by - 12, barW + 2, 24, 12);
      bg.fillStyle(0x111122, 0.85);
      bg.fillRoundedRect(54, by - 11, barW, 22, 11);

      const fill = this.add.graphics().setDepth(11);
      const val = this.add.text(W - 16, by, '0%', {
        fontFamily: FONT, fontSize: '14px', color: '#ffffff',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 0.5).setDepth(13);

      this._bars[d.key] = { fill, col: d.col, bx: 54, by: by - 11, bw: barW, val };
    });

    // XP progress bar at the bottom of the stats panel
    const xpRowY = statsY + 3 * 36 + 8;
    this.add.text(26, xpRowY + 1, '⭐', { fontFamily: FONT, fontSize: '15px' })
      .setOrigin(0, 0.5).setDepth(10);
    const xpBg = this.add.graphics().setDepth(10);
    xpBg.fillStyle(0x000000, 0.40);
    xpBg.fillRoundedRect(52, xpRowY - 8, barW + 2, 18, 9);
    xpBg.fillStyle(0x080820, 0.90);
    xpBg.fillRoundedRect(54, xpRowY - 7, barW, 16, 8);
    this._xpBar = this.add.graphics().setDepth(11);
    this._xpLevelTxt = this.add.text(W - 16, xpRowY + 1, '', {
      fontFamily: FONT, fontSize: '12px', color: '#CC88FF',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0.5).setDepth(13);

    this._refreshStats();
  }

  private _refreshStats() {
    const m = this._monster as any;
    const dynamicCol = (key: string, pct: number): number => {
      if (key === 'hunger')      return pct > 0.65 ? 0xF57C00 : pct > 0.30 ? 0xFFB822 : 0xFF3333;
      if (key === 'happiness')   return pct > 0.65 ? 0xFDD835 : pct > 0.30 ? 0xFFCC44 : 0x5599FF;
      if (key === 'cleanliness') return pct > 0.65 ? 0x42A5F5 : pct > 0.30 ? 0x66CCFF : 0x88DD44;
      return 0xFFFFFF;
    };
    (['hunger', 'happiness', 'cleanliness'] as const).forEach(k => {
      const e = this._bars[k];
      if (!e) return;
      const pct = Math.max(0, Math.min(1, m[k] / 100));
      const fillW = Math.max(16, e.bw * pct);
      const col = dynamicCol(k, pct);
      e.fill.clear();
      e.fill.fillStyle(col, 1);
      e.fill.fillRoundedRect(e.bx, e.by, fillW, 20, 10);
      e.fill.fillStyle(0xffffff, 0.22);
      e.fill.fillRoundedRect(e.bx + 2, e.by + 1, Math.max(10, fillW - 4), 8, { tl: 8, tr: 8, bl: 0, br: 0 });
      if (pct < 0.30) {
        e.fill.fillStyle(0xFF0000, 0.18);
        e.fill.fillRoundedRect(e.bx, e.by, e.bw, 20, 10);
      }
      e.val.setText(Math.round(m[k]) + '%');
    });

    // XP bar
    if (this._xpBar && this._xpLevelTxt) {
      const xpNeeded = XP_TABLE[this._monster.level] ?? 999;
      const xpPct = Math.min(1, this._monster.xp / xpNeeded);
      const xpBx = 54, xpBw = this._W - 92;
      const xpRowY = this._statsY + 3 * 36 + 8;
      const xpFillW = Math.max(10, xpBw * xpPct);
      this._xpBar.clear();
      this._xpBar.fillStyle(0xAA44FF, 1);
      this._xpBar.fillRoundedRect(xpBx, xpRowY - 7, xpFillW, 16, 8);
      this._xpBar.fillStyle(0xFFFFFF, 0.20);
      this._xpBar.fillRoundedRect(xpBx + 2, xpRowY - 6, Math.max(6, xpFillW - 4), 5, { tl: 6, tr: 6, bl: 0, br: 0 });
      this._xpLevelTxt.setText('Lv' + this._monster.level);
    }
    if (this._dirtyOverlay) this._updateDirtyOverlay();
    if (this._monster.hunger < 30) {
      this._startHungerEffect();
    } else if (this._hungerTimer) {
      this._hungerTimer.destroy(); this._hungerTimer = null;
    }
    if (this._monster.happiness < 30) {
      this._startSadEffect();
      if (this._walkTween) this._walkTween.timeScale = 0.45;
      if (this._bobTween) this._bobTween.timeScale = 0.45;
      if (this._breatheTween) this._breatheTween.timeScale = 0.45;
    } else {
      if (this._sadTimer) { this._sadTimer.destroy(); this._sadTimer = null; }
      if (this._walkTween) this._walkTween.timeScale = 1.0;
      if (this._bobTween) this._bobTween.timeScale = 1.0;
      if (this._breatheTween) this._breatheTween.timeScale = 1.0;
    }
  }

  private _updateHappyGlow() {
    const hab = this._sp.habitat;
    const col = hab === 'dirt' ? 0xFFAA44 : hab === 'grass' ? 0x88FF44 : 0x44EEFF;
    if (this._monster.happiness > 70) {
      if (!this._happyGlow) {
        this._happyGlow = this.add.graphics().setDepth(4);
        this.tweens.add({
          targets: this._happyGlow,
          alpha: { from: 0.55, to: 0.12 },
          duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut',
        });
      }
      const gx = this._monImg.x, gy = this._monImg.y - 10;
      this._happyGlow.clear();
      this._happyGlow.fillStyle(col, 0.06); this._happyGlow.fillCircle(gx, gy, 90);
      this._happyGlow.lineStyle(8, col, 1.0); this._happyGlow.strokeCircle(gx, gy, 66);
      this._happyGlow.lineStyle(3, col, 0.55); this._happyGlow.strokeCircle(gx, gy, 84);
      if (this._monster.happiness > 85) {
        this._happyGlow.lineStyle(2, 0xFFFFFF, 0.22); this._happyGlow.strokeCircle(gx, gy, 100);
      }
      if (!this._happyTimer && this._monster.happiness > 85) {
        this._happyTimer = this.time.addEvent({
          delay: 420, loop: true,
          callback: () => {
            if (this._monster.happiness <= 85 || !this.scene?.isActive('HabitatRoom')) {
              this._happyTimer?.destroy(); this._happyTimer = null; return;
            }
            const ang = Math.random() * Math.PI * 2;
            const r = 48 + Math.random() * 36;
            const px = this._monImg.x + Math.cos(ang) * r;
            const py = (this._monImg.y - 10) + Math.sin(ang) * r * 0.55;
            const icons = ['💛', '✨', '💖', '⭐', '🌟'];
            const icon = icons[Math.floor(Math.random() * icons.length)];
            const pt = this.add.text(px, py, icon, {
              fontFamily: FONT, fontSize: (12 + Math.random() * 10) + 'px',
            }).setOrigin(0.5).setDepth(7).setAlpha(0);
            this.tweens.add({
              targets: pt, y: py - 32 - Math.random() * 24, alpha: { from: 1, to: 0 },
              duration: 900 + Math.random() * 500, ease: 'Sine.Out',
              onComplete: () => { try { pt.destroy(); } catch { /**/ } },
            });
          },
        });
      }
    } else {
      if (this._happyGlow) { this._happyGlow.destroy(); this._happyGlow = null; }
      if (this._happyTimer) { this._happyTimer.destroy(); this._happyTimer = null; }
    }
  }

  private _updateDirtyOverlay() {
    this._dirtyOverlay.clear();
    const cl = this._monster.cleanliness;
    if (cl >= 50) return;
    const mx = this._monImg.x, my = this._monImg.y;
    const strength = (50 - cl) / 50;
    const splats: [number, number, number][] = [
      [-22, -28, 7], [24, -18, 6], [-14, 12, 8],
      [28, 8, 5], [-8, 28, 7], [18, -38, 5], [-30, 2, 6],
    ];
    splats.forEach(([dx, dy, r]) => {
      this._dirtyOverlay.fillStyle(0x5C3A1A, strength * 0.75);
      this._dirtyOverlay.fillCircle(mx + dx, my + dy, r);
    });
    if (cl < 30 && !this._stinkTimer) {
      this._stinkTimer = this.time.addEvent({
        delay: 1100, loop: true,
        callback: () => {
          if (this._monster.cleanliness >= 30 || !this.scene?.isActive('HabitatRoom')) {
            this._stinkTimer?.destroy(); this._stinkTimer = null; return;
          }
          const side = Math.random() > 0.5 ? 1 : -1;
          const sx = this._monImg.x + side * (24 + Math.random() * 18);
          const sg = this.add.graphics().setDepth(7);
          sg.lineStyle(2.5, 0x88CC44, 0.72);
          sg.beginPath(); sg.moveTo(0, 0); sg.lineTo(side * 6, -10); sg.lineTo(side * -2, -20); sg.strokePath();
          sg.setPosition(sx, this._monImg.y + 10);
          this.tweens.add({
            targets: sg, y: sg.y - 30, alpha: 0,
            duration: 1000 + Math.random() * 400, ease: 'Sine.Out',
            onComplete: () => { try { sg.destroy(); } catch { /**/ } },
          });
        },
      });
    } else if (cl >= 30 && this._stinkTimer) {
      this._stinkTimer.destroy(); this._stinkTimer = null;
    }
  }

  private _startHungerEffect() {
    if (this._hungerTimer) return;
    this._hungerTimer = this.time.addEvent({
      delay: 1800, loop: true,
      callback: () => {
        if (this._monster.hunger >= 30 || !this.scene?.isActive('HabitatRoom')) {
          this._hungerTimer?.destroy(); this._hungerTimer = null; return;
        }
        const drop = this.add.graphics().setDepth(7);
        drop.fillStyle(0x88CCFF, 0.85);
        drop.fillEllipse(0, 0, 7, 10);
        drop.setPosition(this._monImg.x + 8, this._monImg.y + 20);
        this.tweens.add({
          targets: drop, y: drop.y + 28, alpha: 0, duration: 600, ease: 'Quad.In',
          onComplete: () => { try { drop.destroy(); } catch { /**/ } },
        });
        const txt = this.add.text(this._monImg.x, this._monImg.y - 60, '~rumble~', {
          fontFamily: FONT, fontSize: '13px', color: '#FFB347',
        }).setOrigin(0.5).setDepth(7);
        this.tweens.add({
          targets: txt, y: txt.y - 22, alpha: 0, duration: 800,
          onComplete: () => { try { txt.destroy(); } catch { /**/ } },
        });
      },
    });
  }

  private _startSadEffect() {
    if (this._sadTimer) return;
    this._sadTimer = this.time.addEvent({
      delay: 2200, loop: true,
      callback: () => {
        if (this._monster.happiness >= 30 || !this.scene?.isActive('HabitatRoom')) {
          this._sadTimer?.destroy(); this._sadTimer = null; return;
        }
        const tear = this.add.graphics().setDepth(7);
        tear.fillStyle(0x88AAFF, 0.9);
        tear.fillEllipse(0, 0, 6, 9);
        const side = Math.random() > 0.5 ? 1 : -1;
        tear.setPosition(this._monImg.x + side * 18, this._monImg.y - 28);
        this.tweens.add({
          targets: tear, y: tear.y + 32, alpha: 0, duration: 700, ease: 'Quad.In',
          onComplete: () => { try { tear.destroy(); } catch { /**/ } },
        });
        const txt = this.add.text(this._monImg.x, this._monImg.y - 70, '...', {
          fontFamily: FONT, fontSize: '18px', color: '#AABBFF',
        }).setOrigin(0.5).setDepth(7);
        this.tweens.add({
          targets: txt, y: txt.y - 18, alpha: 0, duration: 1000,
          onComplete: () => { try { txt.destroy(); } catch { /**/ } },
        });
      },
    });
  }

  private _startMoodBubble() {
    const showBubble = () => {
      if (!this.scene?.isActive('HabitatRoom')) return;
      const m = this._monster;
      let emoji: string;
      if      (m.hunger < 30)        emoji = Math.random() > 0.5 ? '🍖' : '😋';
      else if (m.happiness < 30)     emoji = Math.random() > 0.5 ? '😢' : '💔';
      else if (m.cleanliness < 30)   emoji = Math.random() > 0.5 ? '💨' : '🛁';
      else if (m.happiness > 70)     emoji = ['💛','✨','😊','🌟'][Math.floor(Math.random() * 4)];
      else                           emoji = ['💭','z z z','...'][Math.floor(Math.random() * 3)];

      const bx = this._monImg.x + 54, by = this._monImg.y - 74;
      const bubG = this.add.graphics().setDepth(8);
      bubG.fillStyle(0xFFFFFF, 0.92);
      bubG.fillRoundedRect(-30, -24, 60, 44, 10);
      bubG.lineStyle(2, 0xCCCCCC, 0.70);
      bubG.strokeRoundedRect(-30, -24, 60, 44, 10);
      bubG.fillStyle(0xFFFFFF, 0.92);
      bubG.fillTriangle(-8, 18, -20, 30, 6, 18);
      bubG.setPosition(bx, by);
      const et = this.add.text(bx, by, emoji, { fontFamily: FONT, fontSize: '22px' })
        .setOrigin(0.5).setDepth(9);

      bubG.setAlpha(0); et.setAlpha(0);
      this.tweens.add({ targets: [bubG, et], alpha: 1, duration: 220, ease: 'Back.Out' });

      this.time.delayedCall(1900, () => {
        if (!this.scene?.isActive('HabitatRoom')) {
          try { bubG.destroy(); et.destroy(); } catch { /* */ }
          return;
        }
        this.tweens.add({
          targets: [bubG, et], y: '-=22', alpha: 0,
          duration: 500, ease: 'Quad.In',
          onComplete: () => {
            try { bubG.destroy(); et.destroy(); } catch { /* */ }
            this._moodTimer = this.time.delayedCall(7000 + Math.random() * 5000, showBubble);
          },
        });
      });
    };
    this._moodTimer = this.time.delayedCall(4000 + Math.random() * 3000, showBubble);
  }

  // ── ACTION BUTTONS ────────────────────────────────────────────────────────

  private _buildActions(W: number, H: number) {
    const btnY = H - 72;
    const positions = [W/2 - 148, W/2, W/2 + 148];
    const icons = ['🍽', '⚽', '🚿'];
    const labels = [t('btn.feed'), t('btn.play'), t('btn.clean')];
    const colors = [0xC83800, 0x9030C8, 0x2080C0];
    const callbacks = [
      () => this._showFoodPicker(),
      () => this._showToyPicker(),
      () => this._showToolPicker(),
    ];
    positions.forEach((bx, i) => {
      const btn = this.add.container(bx, btnY).setDepth(10).setSize(90, 80);
      const bg = this.add.graphics();
      bg.fillStyle(0x000000, 0.30);
      bg.fillEllipse(0, -4, 78, 74);
      bg.fillStyle(colors[i], 1);
      bg.fillEllipse(0, -8, 78, 74);
      bg.fillStyle(0xffffff, 0.25);
      bg.fillEllipse(0, -12, 66, 30);
      bg.lineStyle(3, 0xffffff, 0.80);
      bg.strokeEllipse(0, -8, 78, 74);
      const ico = this.add.text(0, -14, icons[i], { fontFamily: FONT, fontSize: '28px' }).setOrigin(0.5);
      const lbl = this.add.text(0, 18, labels[i], {
        fontFamily: FONT, fontSize: '14px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5);
      btn.add([bg, ico, lbl]);
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerdown', callbacks[i]);
      btn.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(darken(colors[i], 10), 1); bg.fillEllipse(0, -4, 78, 74);
        bg.fillStyle(lighten(colors[i], 15), 1); bg.fillEllipse(0, -8, 78, 74);
        bg.lineStyle(2, lighten(colors[i], 50), 0.85); bg.strokeEllipse(0, -8, 78, 74);
      });
      btn.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(darken(colors[i], 20), 1); bg.fillEllipse(0, -4, 78, 74);
        bg.fillStyle(colors[i], 1); bg.fillEllipse(0, -8, 78, 74);
        bg.lineStyle(2, lighten(colors[i], 40), 0.70); bg.strokeEllipse(0, -8, 78, 74);
      });
    });
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  private _buildHUD(W: number, H: number, sp: Species) {
    const mods = getVariantModifiers(this._monster.variantIndex);
    const trait = TRAITS.find(t => t.id === this._monster.trait);
    makeButton(this, 56, 34, 92, 44, t('btn.back'), 0x7A4020, () => { this.scene.start('Hub'); }, 15).setDepth(20);

    const displayName = this._monster.nickname ?? sp.name;
    this._nameTxt = this.add.text(W / 2, 19, displayName + (mods.isGolden ? ' ★' : ''), {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold',
      color: mods.isGolden ? '#FFD700' : '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);

    const speciesHint = this.add.text(W / 2, 40, sp.name + ' ✏️', {
      fontFamily: FONT, fontSize: '13px', color: '#BBAAFF',
    }).setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true });
    speciesHint.on('pointerdown', () => this._renameMonster());

    const traitLabel = trait ? '  ·  ' + trait.emoji + ' ' + trait.name : '';
    this.add.text(W / 2, 57, getLevelName(this._monster.level) + '  ·  ' +
      sp.habitat.charAt(0).toUpperCase() + sp.habitat.slice(1) + traitLabel, {
      fontFamily: FONT, fontSize: '13px', color: '#CCDDFF',
    }).setOrigin(0.5).setDepth(20);

    this._sellBtn = makeButton(this, W - 72, 34, 116, 44,
      t('btn.sell', { price: this._sellPrice }), 0xCC8800, () => this._handleListBtn(), 14);
    this._sellBtn.setDepth(20);

    const isGoldenMon = mods.isGolden;
    const goldenMult = isGoldenMon ? 1.5 : 1;
    const traitSellMod = trait?.sellMod ?? 1;
    const maxPrice = Math.max(10, Math.round(sp.price * (1 + 10 * 0.2) * 0.8 * goldenMult * traitSellMod));
    const hintLabel = isGoldenMon
      ? t('hint.golden', { max: maxPrice })
      : t('hint.normal', { max: maxPrice });
    this.add.text(W - 72, 76, hintLabel, {
      fontFamily: FONT, fontSize: '13px', color: isGoldenMon ? '#FFD700' : '#DDCCFF',
    }).setOrigin(0.5).setDepth(20);

    this._coinTxt = this.add.text(56, 70, '💰 ' + Game.state!.coins, {
      fontFamily: FONT, fontSize: '13px', color: '#FFD700',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(20);

    this.events.once('shutdown', () => {
      if (this._renameInput) {
        try { document.body.removeChild(this._renameInput); } catch { /* ignore */ }
        this._renameInput = null;
      }
      if (this._hungerTimer)    { this._hungerTimer.destroy();    this._hungerTimer    = null; }
      if (this._sadTimer)       { this._sadTimer.destroy();       this._sadTimer       = null; }
      if (this._moodTimer)      { this._moodTimer.destroy();      this._moodTimer      = null; }
      if (this._happyTimer)     { this._happyTimer.destroy();     this._happyTimer     = null; }
      if (this._stinkTimer)     { this._stinkTimer.destroy();     this._stinkTimer     = null; }
      if (this._happyGlow)      { try { this._happyGlow.destroy(); } catch { /* */ } this._happyGlow = null; }
      if (this._platformG)     { try { this._platformG.destroy(); } catch { /* */ } this._platformG = null; }
      if (this._bowlSteamTimer) { this._bowlSteamTimer.destroy(); this._bowlSteamTimer = null; }
      if (this._eatTimer)       { this._eatTimer.destroy();       this._eatTimer       = null; }
    });
  }

  private _renameMonster() {
    if (this._renameInput) return;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = this._monster.nickname ?? this._sp.name;
    inp.maxLength = 20;
    inp.placeholder = t('rename.placeholder');
    inp.style.cssText = [
      'position:fixed', 'top:50%', 'left:50%',
      'transform:translate(-50%,-50%)',
      'font-size:18px', 'padding:12px 16px',
      'border-radius:12px', 'border:2px solid #9060ff',
      'background:#1a0a3e', 'color:#fff',
      'width:260px', 'text-align:center',
      'z-index:9999', 'outline:none',
    ].join(';');
    document.body.appendChild(inp);
    this._renameInput = inp;
    inp.focus();
    inp.select();
    const save = () => {
      const v = inp.value.trim();
      if (v && v !== this._sp.name) {
        this._monster.nickname = v;
      } else if (!v) {
        this._monster.nickname = undefined;
      }
      this._nameTxt.setText((this._monster.nickname ?? this._sp.name) +
        (getVariantModifiers(this._monster.variantIndex).isGolden ? ' ★' : ''));
      store.setJSON('mps_state', Game.state);
      try { document.body.removeChild(inp); } catch { /* ignore */ }
      this._renameInput = null;
    };
    inp.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') save();
      if (e.key === 'Escape') {
        try { document.body.removeChild(inp); } catch { /* ignore */ }
        this._renameInput = null;
      }
    });
    inp.addEventListener('blur', save);
  }

  // ── FOOD PICKER (6 items, 2 rows) ─────────────────────────────────────────

  private _showFoodPicker() {
    if (this._pickerItems.length > 0) { this._clearPicker(); return; }
    const W = this._W, H = this._H;
    const fpW = W - 30, fpH = 210, fpX = 15;
    const fpY = H - 310; // bottom = H-100, buttons top ≈ H-84 → 16px gap

    const fpBg = this.add.graphics().setDepth(28);
    fpBg.fillStyle(0x0a0416, 0.96);
    fpBg.fillRoundedRect(fpX, fpY, fpW, fpH, 14);
    fpBg.lineStyle(1, 0x5040b0, 0.9);
    fpBg.strokeRoundedRect(fpX, fpY, fpW, fpH, 14);
    this._pickerItems.push(fpBg);

    this._pickerItems.push(this.add.text(fpX + fpW/2, fpY + 14, t('food.title'), {
      fontFamily: FONT, fontSize: '12px', color: '#BBAAFF',
    }).setOrigin(0.5).setDepth(28));

    const btnW = Math.floor((fpW - 24) / 3);
    const btnH = 80;
    const COLS = 3;

    FOOD_TYPES.forEach((food, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const bx = fpX + 12 + col * (btnW + 4) + btnW / 2;
      const by = fpY + 28 + row * (btnH + 10) + btnH / 2;
      const canAfford = Game.state!.coins >= food.cost;
      const stars = '★'.repeat(food.tier);
      const lbl = food.name + ' ' + stars + '\n' + food.hungerGain + ' bowl +' + food.happinessGain + '💛\n' + food.cost + '💰';
      const tierColors = [0x2A4A18, 0x2A4A28, 0x3A3010];
      const fbtn = makeButton(this, bx, by, btnW - 2, btnH, lbl,
        canAfford ? tierColors[food.tier - 1] : 0x1A1A2A, () => {
          if (Game.state!.coins < food.cost) { showToast(this, t('toast.notEnoughCoins'), '#ff9999'); return; }
          Game.state!.coins -= food.cost;
          // Food goes into bowl; happiness gained immediately (seeing food makes them happy)
          const bowlColor = FOOD_COLORS[food.id] ?? 0xFFB300;
          if (this._monster.bowl && this._monster.bowl.remaining > 0) {
            const space = 100 - this._monster.bowl.remaining;
            const added = Math.min(food.hungerGain, Math.max(0, space));
            this._monster.bowl.remaining += added;
            this._monster.bowl.maxAmount = this._monster.bowl.remaining;
            this._monster.bowl.color = bowlColor;
            this._monster.hunger = Math.min(100, this._monster.hunger + added);
            if (added < food.hungerGain) showToast(this, t('toast.bowlTopped'), '#ffcc88');
          } else {
            this._monster.bowl = { foodId: food.id, remaining: food.hungerGain, maxAmount: food.hungerGain, color: bowlColor };
            this._monster.hunger = Math.min(100, this._monster.hunger + food.hungerGain);
          }
          this._monster.happiness = Math.min(100, this._monster.happiness + food.happinessGain);
          this._monster.lastCaredAt = Date.now();
          const feedXpBonus = TRAITS.find(t => t.id === this._monster.trait)?.xpMod ?? 0;
          this._gainXP(10 + food.tier * 3 + feedXpBonus);
          recordQuestProgress('feed');
          store.setJSON('mps_state', Game.state);
          sfx.feed();
          this._playBowlFeedAnim(food.id, food.tier);
          showFloat(this, this._bowlX, this._bowlY - 42, '+' + food.hungerGain + '🍖 +' + food.happinessGain + '💛', '#ffcc44');
          this._refreshStats();
          this._drawBowl();
          this._updateCoinDisplay();
          this._clearPicker();
        }, 10);
      fbtn.setDepth(29);
      if (!canAfford) fbtn.setAlpha(0.5);
      this._pickerItems.push(fbtn);
    });
  }

  // ── TOY PICKER ────────────────────────────────────────────────────────────

  private _showToyPicker() {
    if (this._pickerItems.length > 0) { this._clearPicker(); return; }
    const W = this._W, H = this._H;
    const fpX = 15, fpW = W - 30;
    const ownedToy = TOY_TYPES.find(t => t.id === this._monster.ownedToy);

    if (ownedToy) {
      const nextToy = TOY_TYPES.find(t => t.tier === ownedToy.tier + 1);
      const hasUpgrade = !!nextToy;
      const fpH = hasUpgrade ? 158 : 100;
      const fpY = H - 90 - fpH;
      const fpBg = this.add.graphics().setDepth(28);
      fpBg.fillStyle(0x0a0416, 0.96);
      fpBg.fillRoundedRect(fpX, fpY, fpW, fpH, 14);
      fpBg.lineStyle(1, 0x7030b0, 0.9);
      fpBg.strokeRoundedRect(fpX, fpY, fpW, fpH, 14);
      this._pickerItems.push(fpBg);
      this._pickerItems.push(this.add.text(fpX + fpW/2, fpY + 13, t('toy.titleOwned', { name: ownedToy.name }), {
        fontFamily: FONT, fontSize: '12px', color: '#CC99EE',
      }).setOrigin(0.5).setDepth(28));
      const playHapGain = Math.round(ownedToy.happinessGain * (TRAITS.find(t => t.id === this._monster.trait)?.hapGainMod ?? 1));
      const fbtn = makeButton(this, fpX + fpW/2, fpY + 60, fpW - 30, 54,
        t('toy.playFree', { n: playHapGain }), 0x6030A0, () => {
          this._monster.happiness = Math.min(100, this._monster.happiness + playHapGain);
          this._monster.lastCaredAt = Date.now();
          this._gainXP(8 + ownedToy.tier * 3);
          recordQuestProgress('play');
          store.setJSON('mps_state', Game.state);
          sfx.pet();
          this._playPetAnim(ownedToy.id);
          showFloat(this, this._monImg.x, this._monImg.y - 85, '+' + playHapGain + '💛', '#ffdd55');
          this._refreshStats();
          this._clearPicker();
        }, 14);
      fbtn.setDepth(29);
      this._pickerItems.push(fbtn);
      if (hasUpgrade && nextToy) {
        const canAfford = Game.state!.coins >= nextToy.cost;
        const upgradeBtn = makeButton(this, fpX + fpW/2, fpY + 120, fpW - 30, 30,
          t('toy.upgrade', { name: nextToy.name, cost: nextToy.cost }),
          canAfford ? 0x7040B0 : 0x2A1A40, () => {
            if (Game.state!.coins < nextToy.cost) { showToast(this, t('toast.notEnoughCoins'), '#ff9999'); return; }
            Game.state!.coins -= nextToy.cost;
            this._monster.ownedToy = nextToy.id;
            store.setJSON('mps_state', Game.state);
            this._updateCoinDisplay();
            this._clearPicker();
            this._showToyPicker();
          }, 11);
        upgradeBtn.setDepth(29);
        if (!canAfford) upgradeBtn.setAlpha(0.6);
        this._pickerItems.push(upgradeBtn);
      }
    } else {
      const fpH = 120, fpY = H - 90 - fpH;
      const fpBg = this.add.graphics().setDepth(28);
      fpBg.fillStyle(0x0a0416, 0.96);
      fpBg.fillRoundedRect(fpX, fpY, fpW, fpH, 14);
      fpBg.lineStyle(1, 0x7030b0, 0.9);
      fpBg.strokeRoundedRect(fpX, fpY, fpW, fpH, 14);
      this._pickerItems.push(fpBg);
      this._pickerItems.push(this.add.text(fpX + fpW/2, fpY + 13, t('toy.titleBuy'), {
        fontFamily: FONT, fontSize: '12px', color: '#CC99EE',
      }).setOrigin(0.5).setDepth(28));
      const btnW = Math.floor((fpW - 24) / 3);
      const btnH = 82;
      TOY_TYPES.forEach((toy, i) => {
        const bx = fpX + 12 + i * (btnW + 4) + btnW / 2;
        const by = fpY + 27 + btnH / 2;
        const canAfford = Game.state!.coins >= toy.cost;
        const lbl = toy.name + ' ' + '★'.repeat(toy.tier) + '\n+' + toy.happinessGain + '💛\n' + toy.cost + '💰';
        const fbtn = makeButton(this, bx, by, btnW - 2, btnH, lbl,
          canAfford ? 0x6030A0 : 0x2A1A40, () => {
            if (Game.state!.coins < toy.cost) { showToast(this, t('toast.notEnoughCoins'), '#ff9999'); return; }
            Game.state!.coins -= toy.cost;
            this._monster.ownedToy = toy.id;
            this._monster.happiness = Math.min(100, this._monster.happiness + toy.happinessGain);
            this._monster.lastCaredAt = Date.now();
            this._gainXP(8 + toy.tier * 3);
            store.setJSON('mps_state', Game.state);
            sfx.pet();
            this._playPetAnim(toy.id);
            showFloat(this, this._monImg.x, this._monImg.y - 85, '+' + toy.happinessGain + '💛', '#ffdd55');
            this._refreshStats();
            this._updateCoinDisplay();
            this._clearPicker();
          }, 10);
        fbtn.setDepth(29);
        if (!canAfford) fbtn.setAlpha(0.5);
        this._pickerItems.push(fbtn);
      });
    }
  }

  // ── TOOL PICKER ───────────────────────────────────────────────────────────

  private _showToolPicker() {
    if (this._pickerItems.length > 0) { this._clearPicker(); return; }
    const W = this._W, H = this._H;
    const fpX = 15, fpW = W - 30;
    const ownedTool = CLEAN_TOOLS.find(t => t.id === this._monster.ownedTool);

    if (ownedTool) {
      const nextTool = CLEAN_TOOLS.find(t => t.tier === ownedTool.tier + 1);
      const hasUpgrade = !!nextTool;
      const fpH = hasUpgrade ? 158 : 100;
      const fpY = H - 90 - fpH;

      const fpBg = this.add.graphics().setDepth(28);
      fpBg.fillStyle(0x0a0416, 0.96);
      fpBg.fillRoundedRect(fpX, fpY, fpW, fpH, 14);
      fpBg.lineStyle(1, 0x1060b0, 0.9);
      fpBg.strokeRoundedRect(fpX, fpY, fpW, fpH, 14);
      this._pickerItems.push(fpBg);
      this._pickerItems.push(this.add.text(fpX + fpW/2, fpY + 13, t('tool.titleOwned', { name: ownedTool.name }), {
        fontFamily: FONT, fontSize: '12px', color: '#AACCEE',
      }).setOrigin(0.5).setDepth(28));

      const cleanBtn = makeButton(this, fpX + fpW/2, fpY + 60, fpW - 30, 54,
        t('tool.cleanFree', { n: ownedTool.cleanGain }), 0x1060A0, () => {
          this._monster.cleanliness = Math.min(100, this._monster.cleanliness + ownedTool.cleanGain);
          this._monster.lastCaredAt = Date.now();
          this._gainXP(8 + ownedTool.tier * 3);
          recordQuestProgress('clean');
          store.setJSON('mps_state', Game.state);
          sfx.clean();
          this._playCleanAnim(ownedTool.id);
          showFloat(this, this._monImg.x, this._monImg.y - 85, '+' + ownedTool.cleanGain + '✨', '#88ccff');
          this._refreshStats();
          this._clearPicker();
        }, 14);
      cleanBtn.setDepth(29);
      this._pickerItems.push(cleanBtn);

      if (hasUpgrade && nextTool) {
        const canAfford = Game.state!.coins >= nextTool.cost;
        const upgradeBtn = makeButton(this, fpX + fpW/2, fpY + 120, fpW - 30, 30,
          t('toy.upgrade', { name: nextTool.name, cost: nextTool.cost }),
          canAfford ? 0x1070C0 : 0x0A2840, () => {
            if (Game.state!.coins < nextTool.cost) { showToast(this, t('toast.notEnoughCoins'), '#ff9999'); return; }
            Game.state!.coins -= nextTool.cost;
            this._monster.ownedTool = nextTool.id;
            store.setJSON('mps_state', Game.state);
            this._updateCoinDisplay();
            this._clearPicker();
            this._showToolPicker();
          }, 11);
        upgradeBtn.setDepth(29);
        if (!canAfford) upgradeBtn.setAlpha(0.6);
        this._pickerItems.push(upgradeBtn);
      }
    } else {
      const fpH = 120, fpY = H - 90 - fpH;
      const fpBg = this.add.graphics().setDepth(28);
      fpBg.fillStyle(0x0a0416, 0.96);
      fpBg.fillRoundedRect(fpX, fpY, fpW, fpH, 14);
      fpBg.lineStyle(1, 0x1060b0, 0.9);
      fpBg.strokeRoundedRect(fpX, fpY, fpW, fpH, 14);
      this._pickerItems.push(fpBg);
      this._pickerItems.push(this.add.text(fpX + fpW/2, fpY + 13, t('tool.titleBuy'), {
        fontFamily: FONT, fontSize: '12px', color: '#AACCEE',
      }).setOrigin(0.5).setDepth(28));
      const btnW = Math.floor((fpW - 24) / 3);
      const btnH = 82;
      CLEAN_TOOLS.forEach((tool, i) => {
        const bx = fpX + 12 + i * (btnW + 4) + btnW / 2;
        const by = fpY + 27 + btnH / 2;
        const canAfford = Game.state!.coins >= tool.cost;
        const lbl = tool.name + ' ' + '★'.repeat(tool.tier) + '\n+' + tool.cleanGain + '✨\n' + tool.cost + '💰';
        const fbtn = makeButton(this, bx, by, btnW - 2, btnH, lbl,
          canAfford ? 0x1060A0 : 0x0A2840, () => {
            if (Game.state!.coins < tool.cost) { showToast(this, t('toast.notEnoughCoins'), '#ff9999'); return; }
            Game.state!.coins -= tool.cost;
            this._monster.ownedTool = tool.id;
            this._monster.cleanliness = Math.min(100, this._monster.cleanliness + tool.cleanGain);
            this._monster.lastCaredAt = Date.now();
            this._gainXP(8 + tool.tier * 3);
            store.setJSON('mps_state', Game.state);
            sfx.clean();
            this._playCleanAnim(tool.id);
            showFloat(this, this._monImg.x, this._monImg.y - 85, '+' + tool.cleanGain + '✨', '#88ccff');
            this._refreshStats();
            this._updateCoinDisplay();
            this._clearPicker();
          }, 10);
        fbtn.setDepth(29);
        if (!canAfford) fbtn.setAlpha(0.5);
        this._pickerItems.push(fbtn);
      });
    }
  }

  private _clearPicker() {
    this._pickerItems.forEach(o => { try { (o as any).destroy(); } catch { /* ignore */ } });
    this._pickerItems = [];
  }

  // ── ANIMATIONS ────────────────────────────────────────────────────────────

  private _playFeedAnim(foodId: string, tier: number) {
    const mx = this._monImg.x, my = this._monImg.y;
    const color = FOOD_COLORS[foodId] ?? 0xFFB300;
    const r = 12 + tier * 4;

    // Draw food item
    const foodG = this.add.graphics().setDepth(30);
    foodG.fillStyle(color, 1);
    foodG.fillCircle(0, 0, r);
    foodG.fillStyle(0xffffff, 0.55);
    foodG.fillCircle(-r * 0.35, -r * 0.38, r * 0.42);
    if (tier >= 2) {
      foodG.lineStyle(3, 0xffffff, 0.5);
      foodG.strokeCircle(0, 0, r + 5);
    }
    foodG.setPosition(mx, my - 110).setScale(0);

    // Phase 1: pop in
    this.tweens.add({
      targets: foodG, scaleX: 1, scaleY: 1,
      duration: 220, ease: 'Back.Out',
      onComplete: () => {
        // Phase 2: wobble
        this.tweens.add({
          targets: foodG, angle: { from: -18, to: 18 },
          duration: 100, yoyo: true, repeat: 1, ease: 'Sine.InOut',
          onComplete: () => {
            // Monster jumps up slightly to catch food
            this.tweens.add({
              targets: this._monImg, y: my - 14,
              duration: 130, ease: 'Sine.Out', yoyo: true,
            });
            // Phase 3: arc fall
            this.tweens.add({
              targets: foodG,
              x: mx + (Math.random() > 0.5 ? 8 : -8),
              y: my - 18,
              scaleX: 0.5, scaleY: 0.5, angle: 200,
              duration: 260, ease: 'Quad.In',
              onComplete: () => {
                foodG.destroy();
                // Burst of colored particles
                this._spawnParticles(mx, my - 18, color, 8 + tier * 4);
                // Ring flash
                const flash = this.add.graphics().setDepth(30);
                flash.lineStyle(4, color, 0.9);
                flash.strokeCircle(mx, my - 18, 8);
                this.tweens.add({
                  targets: flash, scaleX: 3.5, scaleY: 3.5, alpha: 0,
                  duration: 380, ease: 'Quad.Out',
                  onComplete: () => { try { flash.destroy(); } catch { /**/ } },
                });
                // Monster happy squish chain
                const mon = this._monImg;
                this.tweens.add({
                  targets: mon, scaleX: 1.35, scaleY: 0.72,
                  duration: 55, ease: 'Quad.Out',
                  onComplete: () => this.tweens.add({
                    targets: mon, scaleX: 0.82, scaleY: 1.3,
                    duration: 80, ease: 'Quad.Out',
                    onComplete: () => this.tweens.add({
                      targets: mon, scaleX: 1.12, scaleY: 0.92,
                      duration: 70, ease: 'Sine.Out',
                      onComplete: () => this.tweens.add({
                        targets: mon, scaleX: 1, scaleY: 1,
                        duration: 120, ease: 'Back.Out',
                      }),
                    }),
                  }),
                });
                // Floating hearts/stars
                const emojis = tier === 3 ? ['💛','✨','❤️','⭐'] : tier === 2 ? ['💛','✨','💛'] : ['💛','✨'];
                emojis.forEach((e, idx) => {
                  this.time.delayedCall(idx * 90, () => {
                    if (!this.scene?.isActive('HabitatRoom')) return;
                    const ex = mx + (Math.random() - 0.5) * 80;
                    const ht = this.add.text(ex, my - 30, e, {
                      fontFamily: FONT, fontSize: (16 + tier * 2) + 'px',
                    }).setOrigin(0.5).setDepth(31);
                    this.tweens.add({
                      targets: ht,
                      y: ht.y - 80 - Math.random() * 40,
                      alpha: 0, angle: (Math.random() - 0.5) * 50,
                      duration: 900 + Math.random() * 200, ease: 'Sine.Out',
                      onComplete: () => { try { ht.destroy(); } catch { /**/ } },
                    });
                  });
                });
              },
            });
          },
        });
      },
    });
  }

  private _playBowlFeedAnim(foodId: string, tier: number) {
    const color = FOOD_COLORS[foodId] ?? 0xFFB300;
    const r = 10 + tier * 3;
    const mx = this._monImg.x;

    const foodG = this.add.graphics().setDepth(30);
    foodG.fillStyle(color, 1);
    foodG.fillCircle(0, 0, r);
    foodG.fillStyle(0xFFFFFF, 0.50);
    foodG.fillCircle(-r * 0.35, -r * 0.40, r * 0.38);
    foodG.setPosition(mx, this._monImg.y - 70).setScale(0);

    this.tweens.add({
      targets: foodG, scaleX: 1, scaleY: 1,
      duration: 200, ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: foodG,
          x: this._bowlX, y: this._bowlY - 14,
          scaleX: 0.55, scaleY: 0.55, angle: 180,
          duration: 380, ease: 'Quad.In',
          onComplete: () => {
            foodG.destroy();
            this._spawnParticles(this._bowlX, this._bowlY - 10, color, 7 + tier * 3);
            // Bowl pop
            if (this._bowlGfx) {
              this.tweens.add({
                targets: this._bowlGfx, scaleX: 1.08, scaleY: 1.08,
                duration: 90, ease: 'Quad.Out', yoyo: true,
              });
            }
          },
        });
      },
    });
  }

  private _playPetAnim(toyId: string) {
    const mx = this._monImg.x, my = this._monImg.y;
    const toy = this.add.graphics().setDepth(30);

    if (toyId === 'yarn') {
      toy.fillStyle(0xFF9800, 1);
      toy.fillCircle(0, 0, 12);
      toy.fillStyle(0xFFE082, 0.65);
      toy.fillCircle(-4, -4, 5);
      toy.fillStyle(0xffffff, 0.35);
      toy.fillCircle(-5, -5, 2);
      toy.x = mx + 58; toy.y = my - 12;
      this.tweens.add({
        targets: toy, y: toy.y - 32, duration: 210,
        yoyo: true, repeat: 3, ease: 'Sine.InOut',
        onComplete: () => { try { toy.destroy(); } catch { /* */ } },
      });

    } else if (toyId === 'stick') {
      toy.fillStyle(0x8D6E63, 1);
      toy.fillRect(-22, -4, 44, 8);
      toy.fillStyle(0xFFEB3B, 1);
      toy.fillCircle(22, 0, 6);
      toy.x = mx + 58; toy.y = my - 8;
      this.tweens.add({
        targets: toy, angle: 35, duration: 140,
        yoyo: true, repeat: 4, ease: 'Sine.InOut',
        onComplete: () => { try { toy.destroy(); } catch { /* */ } },
      });

    } else { // gem
      toy.fillStyle(0x7C4DFF, 1);
      toy.fillTriangle(0, -16, -11, 0, 11, 0);
      toy.fillTriangle(-11, 0, 11, 0, 0, 13);
      toy.fillStyle(0xB39DDB, 0.55);
      toy.fillTriangle(0, -16, -5, -5, 5, -5);
      toy.x = mx + 55; toy.y = my - 22;
      this.tweens.add({
        targets: toy, angle: 360, duration: 700,
        repeat: 1, ease: 'Linear',
        onComplete: () => { try { toy.destroy(); } catch { /* */ } },
      });
    }

    // monster jiggles for all toys
    this.tweens.add({
      targets: this._monImg, angle: 10, duration: 85,
      yoyo: true, repeat: 4, ease: 'Sine.InOut',
      onComplete: () => this._monImg.setAngle(0),
    });
  }

  private _playCleanAnim(toolId: string) {
    const W = this._W, H = this._H;
    const groundY = H * 0.62;

    if (toolId === 'bath') {
      // Bath kit: burst of soap bubbles around monster
      for (let i = 0; i < 14; i++) {
        this.time.delayedCall(i * 70, () => {
          if (!this.scene?.isActive('HabitatRoom')) return;
          const bx = this._monImg.x + (Math.random() - 0.5) * 160;
          const by = this._monImg.y - 20 + (Math.random() - 0.5) * 80;
          const bg = this.add.graphics().setDepth(30);
          bg.lineStyle(2, 0x4FC3F7, 0.85);
          bg.strokeCircle(0, 0, 6 + Math.random() * 8);
          bg.x = bx; bg.y = by;
          this.tweens.add({
            targets: bg, y: by - 55, alpha: 0, duration: 700,
            ease: 'Sine.Out',
            onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
          });
        });
      }
      this.tweens.add({
        targets: this._monImg, scaleX: 1.08, scaleY: 1.08,
        duration: 180, yoyo: true, repeat: 2, ease: 'Sine.InOut',
      });
      return;
    }

    // Cloth / brush: sweep across ground
    const broom = this.add.graphics().setDepth(30);
    const baseCol = toolId === 'cloth' ? 0xB0BEC5 : 0x8D6E63;
    // handle
    broom.fillStyle(0x795548, 1);
    broom.fillRect(-3, -46, 6, 46);
    // head base
    broom.fillStyle(baseCol, 1);
    broom.fillRoundedRect(-22, 0, 44, 14, 4);
    // bristles
    broom.fillStyle(toolId === 'cloth' ? 0x78909C : 0x5D4037, 1);
    for (let bi = 0; bi < 5; bi++) {
      broom.fillRect(-20 + bi * 10, 14, 7, 11);
    }
    broom.x = -30;
    broom.y = groundY - 2;
    broom.setAngle(-18);

    this.tweens.add({
      targets: broom, x: W + 30, angle: 18,
      duration: toolId === 'brush' ? 550 : 680, ease: 'Sine.InOut',
      onComplete: () => { try { broom.destroy(); } catch { /* */ } },
    });

    // dust trail
    const dustCol = toolId === 'cloth' ? 0xC0C0C0 : 0xBBAA88;
    for (let di = 0; di < 7; di++) {
      this.time.delayedCall(di * 70, () => {
        if (!this.scene?.isActive('HabitatRoom')) return;
        const px = 20 + di * ((W - 40) / 7);
        this._spawnParticles(px, groundY - 6, dustCol, 3);
      });
    }
  }

  // ── LISTING SYSTEM ────────────────────────────────────────────────────────

  private _handleListBtn() {
    const listing = Game.state!.listings.find(l => l.monsterId === this._monster.id);
    if (!listing) {
      if (this._monster.level < 5) {
        const needed = getLevelName(5);
        showToast(this, t('sell.needLevel', { name: this._monster.nickname ?? this._sp.name, level: needed }), '#ffaaaa');
        return;
      }
      this._doList();
      return;
    }
    if (Date.now() >= listing.readyAt) {
      this._doCollect(listing);
    } else {
      this._showCancelListing(listing);
    }
  }

  private _doList() {
    const buyer = randomBuyer();
    const duration = randomListingDuration();
    const listing: Listing = {
      id: 'lst_' + Date.now(),
      monsterId: this._monster.id,
      price: this._sellPrice,
      listedAt: Date.now(),
      readyAt: Date.now() + duration,
      buyerName: buyer.name,
      buyerJob: buyer.job,
    };
    Game.state!.listings.push(listing);
    store.setJSON('mps_state', Game.state);
    this.tweens.killTweensOf(this._sellBtn);
    this._sellBtn.setScale(1);
    this._updateListBtnState();
    this._startListTimer();
    const mins = Math.round(duration / 60000);
    const waitStr = mins >= 60 ? Math.round(mins / 60) + 'h' : mins + 'm';
    showToast(this, t('sell.interested', { buyer: buyer.name, time: waitStr }), '#aaffaa');
  }

  private _doCollect(listing: Listing) {
    const basePrice = listing.price;
    const W = this._W, H = this._H;
    const buyerName = listing.buyerName ?? 'A Collector';
    const buyerJob  = listing.buyerJob  ?? 'Enthusiast';

    const popup = this.add.container(0, 0).setDepth(50);
    const popBg = this.add.graphics();
    popBg.fillStyle(0, 0.72); popBg.fillRect(0, 0, W, H);
    popup.add(popBg);

    const panel = this.add.graphics();
    panel.fillStyle(0x061A10, 1);
    panel.fillRoundedRect(W/2 - 160, H/2 - 155, 320, 315, 18);
    panel.lineStyle(2, 0x40B070, 0.85);
    panel.strokeRoundedRect(W/2 - 160, H/2 - 155, 320, 315, 18);
    popup.add(panel);

    popup.add(this.add.text(W/2, H/2 - 120, t('sell.buyerArrived'), {
      fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: '#66FF99',
    }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 88, buyerName + ', ' + buyerJob, {
      fontFamily: FONT, fontSize: '15px', fontStyle: 'italic', color: '#88CCFF',
    }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 64, t('sell.buyerWants', { name: this._monster.nickname ?? this._sp.name }), {
      fontFamily: FONT, fontSize: '13px', color: '#aaccaa',
    }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 40, t('sell.offered', { price: basePrice }), {
      fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#FFD700',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 16, t('sell.watchAd'), {
      fontFamily: FONT, fontSize: '13px', color: '#FFD700',
    }).setOrigin(0.5));

    const finalize = (price: number) => {
      popup.destroy();
      Game.state!.coins += price;
      Game.state!.monsters = Game.state!.monsters.filter(m => m.id !== this._monster.id);
      Game.state!.listings = Game.state!.listings.filter(l => l.id !== listing.id);
      Game.state!.stats.sold++;
      Game.state!.stats.totalEarned += price;
      recordQuestProgress('sell');
      store.setJSON('mps_state', Game.state);
      sfx.sell();
      this._spawnParticles(W/2, H/2 - 80, 0xFFD700, 26);
      showFloat(this, W/2, H/2 - 120, '+' + price + ' 💰', '#ffd700');
      this.time.delayedCall(950, () => this.scene.start('Hub'));
    };

    popup.add(makeButton(this, W/2, H/2 + 30, 210, 50, t('btn.collect', { price: basePrice }), 0x2A8840, () => {
      finalize(basePrice);
    }, 15));
    popup.add(makeButton(this, W/2, H/2 + 92, 270, 50, t('btn.adDouble', { price: basePrice * 2 }), 0x7A4A00, () => {
      Ads.showRewarded(res => { finalize(res.rewarded ? basePrice * 2 : basePrice); });
    }, 14));
    popup.add(makeButton(this, W/2, H/2 + 148, 120, 38, t('btn.cancel'), 0x4A2890, () => {
      popup.destroy();
    }, 13));
  }

  private _showCancelListing(listing: Listing) {
    const W = this._W, H = this._H;
    const popup = this.add.container(0, 0).setDepth(50);

    const remaining = Math.max(0, listing.readyAt - Date.now());
    const mins = Math.ceil(remaining / 60000);

    const popBg = this.add.graphics();
    popBg.fillStyle(0, 0.7); popBg.fillRect(0, 0, W, H);
    popup.add(popBg);

    const panel = this.add.graphics();
    panel.fillStyle(0x100828, 1);
    panel.fillRoundedRect(W/2 - 135, H/2 - 100, 270, 200, 16);
    panel.lineStyle(2, 0x5040b0, 0.8);
    panel.strokeRoundedRect(W/2 - 135, H/2 - 100, 270, 200, 16);
    popup.add(panel);

    popup.add(this.add.text(W/2, H/2 - 68, t('sell.price', { price: listing.price }), {
      fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 40, t('sell.readyIn', { mins }), {
      fontFamily: FONT, fontSize: '14px', color: '#BBCCFF',
    }).setOrigin(0.5));

    popup.add(makeButton(this, W/2, H/2 + 10, 210, 48, t('btn.cancelListing'), 0x6A1010, () => {
      Game.state!.listings = Game.state!.listings.filter(l => l.id !== listing.id);
      store.setJSON('mps_state', Game.state);
      if (this._listTimer) { this._listTimer.remove(); this._listTimer = null; }
      popup.destroy();
      this._updateListBtnState();
      this.tweens.add({
        targets: this._sellBtn, scaleX: 1.04, scaleY: 1.04,
        duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut',
      });
      showToast(this, t('toast.listingCancelled'), '#ffaaaa');
    }, 14));
    popup.add(makeButton(this, W/2, H/2 + 70, 140, 38, t('btn.keepListed'), 0x4A2890, () => {
      popup.destroy();
    }, 14));
  }

  private _updateListBtnState() {
    const listing = Game.state!.listings.find(l => l.monsterId === this._monster.id);
    if (!listing) {
      setButtonLabel(this._sellBtn, t('btn.sell', { price: this._sellPrice }));
      setButtonColor(this._sellBtn, 0x8B6000);
      return;
    }
    const remaining = listing.readyAt - Date.now();
    if (remaining <= 0) {
      setButtonLabel(this._sellBtn, t('btn.collect', { price: listing.price }));
      setButtonColor(this._sellBtn, 0x1A7040);
      if (!this.tweens.isTweening(this._sellBtn)) {
        this.tweens.add({
          targets: this._sellBtn, scaleX: 1.07, scaleY: 1.07,
          duration: 550, yoyo: true, repeat: -1,
        });
      }
    } else {
      const mins = Math.ceil(remaining / 60000);
      const timeStr = mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + 'm';
      setButtonLabel(this._sellBtn, t('sell.buyerIn', { time: timeStr }));
      setButtonColor(this._sellBtn, 0x334466);
    }
  }

  private _startListTimer() {
    if (this._listTimer) this._listTimer.remove();
    this._listTimer = this.time.addEvent({
      delay: 1000, loop: true, callback: () => this._updateListBtnState(),
    });
  }

  // ── XP + LEVEL UP ─────────────────────────────────────────────────────────

  private _gainXP(amount: number) {
    const m = this._monster;
    m.xp = (m.xp ?? 0) + amount;
    if (m.level < 10) {
      const needed = XP_TABLE[m.level] ?? 9999;
      if (m.xp >= needed) {
        m.xp -= needed;
        m.level = Math.min(10, m.level + 1);
        sfx.levelup();
        this._spawnParticles(this._monImg.x, this._monImg.y, 0xFFD700, 24);
        this._spawnParticles(this._monImg.x, this._monImg.y, 0xFFFFFF, 12);
        showToast(this, t('toast.levelUp', { name: m.nickname ?? SPECIES[m.speciesId].name, n: m.level }), '#FFD700');
        this._sellPrice = this._calcSell(this._sp);
      }
    }
  }

  // ── PARTICLES ─────────────────────────────────────────────────────────────

  private _spawnParticles(x: number, y: number, color: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const speed = 45 + Math.random() * 85;
      const pg = this.add.graphics().setDepth(32);
      pg.fillStyle(color, 1);
      pg.fillCircle(0, 0, 3 + Math.random() * 4);
      pg.x = x; pg.y = y;
      this.tweens.add({
        targets: pg,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed - 22,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 400 + Math.random() * 300,
        ease: 'Cubic.Out',
        onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* ignore */ } },
      });
    }
  }

  // ── AMBIENT ───────────────────────────────────────────────────────────────

  private _startAmbient(W: number, H: number, habitat: HabitatType) {
    if (habitat === 'dirt') {
      // Warm amber crystal sparks (matches new cave)
      const crystalXs = [38, 108, 200, 345, 438, 506];
      const sparkCols = [0xFFAA00, 0xFF8800, 0xFFCC44, 0xFFDD88];
      const spawnSpark = () => {
        if (!this.scene?.isActive('HabitatRoom')) return;
        const cx = crystalXs[Math.floor(Math.random() * crystalXs.length)];
        const sg = this.add.graphics().setDepth(3);
        sg.fillStyle(sparkCols[Math.floor(Math.random() * sparkCols.length)], 0.88);
        sg.fillCircle(0, 0, 1.5 + Math.random() * 2.5);
        sg.setPosition(cx + (Math.random() - 0.5) * 14, H * 0.62 - 18 + (Math.random() - 0.5) * 12);
        this.tweens.add({
          targets: sg,
          x: sg.x + (Math.random() - 0.5) * 28,
          y: sg.y - 30 - Math.random() * 22,
          alpha: 0, duration: 700 + Math.random() * 700, ease: 'Sine.Out',
          onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
        });
      };
      this.time.addEvent({ delay: 480, loop: true, callback: spawnSpark });
      for (let i = 0; i < 4; i++) spawnSpark();

      // Torch flicker — pulsing warm glow at each torch position
      ([[55, H*0.30], [55, H*0.50], [W-55, H*0.30], [W-55, H*0.50]] as [number,number][]).forEach(([tx, ty]) => {
        const tGlow = this.add.graphics().setDepth(1);
        const flickerFn = () => {
          if (!this.scene?.isActive('HabitatRoom')) return;
          tGlow.clear();
          const r = 30 + Math.random() * 16;
          tGlow.fillStyle(0xFF8800, 0.10 + Math.random() * 0.09);
          tGlow.fillCircle(tx, ty - 12, r);
          tGlow.fillStyle(0xFFCC44, 0.08 + Math.random() * 0.07);
          tGlow.fillCircle(tx, ty - 12, r * 0.50);
        };
        this.time.addEvent({ delay: 140, loop: true, callback: flickerFn });
        flickerFn();
      });

      // Ember particles drifting up from torches
      const spawnEmber = () => {
        if (!this.scene?.isActive('HabitatRoom')) return;
        const tx = Math.random() > 0.5 ? 55 : W - 55;
        const ty = Math.random() > 0.5 ? H * 0.30 : H * 0.50;
        const eg = this.add.graphics().setDepth(3);
        eg.fillStyle(Math.random() > 0.5 ? 0xFF8800 : 0xFFCC22, 0.90);
        eg.fillCircle(0, 0, 1.5 + Math.random());
        eg.setPosition(tx + (Math.random() - 0.5) * 8, ty - 26);
        this.tweens.add({
          targets: eg,
          x: eg.x + (Math.random() - 0.5) * 42,
          y: eg.y - 55 - Math.random() * 38,
          alpha: 0, duration: 800 + Math.random() * 700, ease: 'Cubic.Out',
          onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
        });
      };
      this.time.addEvent({ delay: 700, loop: true, callback: spawnEmber });

      // Magic dust motes orbiting the arch portal
      const spawnMagicDust = () => {
        if (!this.scene?.isActive('HabitatRoom')) return;
        const ang = Math.random() * Math.PI * 2;
        const radius = 55 + Math.random() * 85;
        const dg = this.add.graphics().setDepth(2);
        dg.fillStyle(Math.random() > 0.5 ? 0xAA66FF : 0xFFCC44, 0.88);
        dg.fillCircle(0, 0, 1.5 + Math.random() * 2.0);
        dg.setPosition(W / 2 + Math.cos(ang) * radius, H * 0.17 + Math.sin(ang) * radius * 0.48);
        this.tweens.add({
          targets: dg,
          x: dg.x + (Math.random() - 0.5) * 55,
          y: dg.y - 22 - Math.random() * 38,
          alpha: 0, scaleX: 0.15, scaleY: 0.15,
          duration: 1400 + Math.random() * 1600, ease: 'Sine.Out',
          onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
        });
      };
      this.time.addEvent({ delay: 320, loop: true, callback: spawnMagicDust });
      for (let i = 0; i < 6; i++) this.time.delayedCall(i * 260, spawnMagicDust);
      return;
    }

    if (habitat === 'grass') {
      // Colorful petals and leaves falling
      const petalCols = [0xFF88CC, 0xFFCC44, 0xFF6699, 0xFFEE88, 0xEE88FF, 0xFF9944, 0xAAEE55];
      const spawnPetal = () => {
        if (!this.scene?.isActive('HabitatRoom')) return;
        const col = petalCols[Math.floor(Math.random() * petalCols.length)];
        const pg = this.add.graphics().setDepth(2);
        pg.fillStyle(col, 0.78);
        pg.fillEllipse(0, 0, 10, 6);
        pg.setPosition(Math.random() * W, -10);
        this.tweens.add({
          targets: pg,
          x: pg.x + (Math.random() - 0.5) * 130,
          y: H * 0.65, alpha: 0,
          angle: (Math.random() - 0.5) * 400,
          duration: 2500 + Math.random() * 2500, ease: 'Linear',
          onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
        });
      };
      this.time.addEvent({ delay: 700, loop: true, callback: spawnPetal });
      for (let i = 0; i < 5; i++) spawnPetal();

      // Sun sparkles radiating from the sun
      const sunX = W * 0.82, sunY = H * 0.10;
      const spawnSunSparkle = () => {
        if (!this.scene?.isActive('HabitatRoom')) return;
        const ang = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 36;
        const ss = this.add.graphics().setDepth(2);
        ss.fillStyle(0xFFEE44, 0.90);
        ss.fillCircle(0, 0, 2 + Math.random() * 1.5);
        ss.setPosition(sunX + Math.cos(ang) * dist, sunY + Math.sin(ang) * dist);
        this.tweens.add({
          targets: ss,
          x: ss.x + Math.cos(ang) * 30,
          y: ss.y + Math.sin(ang) * 30,
          alpha: 0, scaleX: 0.1, scaleY: 0.1,
          duration: 500 + Math.random() * 400, ease: 'Quad.Out',
          onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
        });
      };
      this.time.addEvent({ delay: 270, loop: true, callback: spawnSunSparkle });

      // Fireflies — blinking soft yellow-green dots
      const spawnFirefly = () => {
        if (!this.scene?.isActive('HabitatRoom')) return;
        const fx2 = 70 + Math.random() * (W - 140);
        const fy2 = H * 0.40 + Math.random() * H * 0.26;
        const ff = this.add.graphics().setDepth(2);
        ff.fillStyle(0xEEFF88, 0.50); ff.fillCircle(0, 0, 5);
        ff.fillStyle(0xCCFF44, 0.90); ff.fillCircle(0, 0, 2.5);
        ff.setPosition(fx2, fy2).setAlpha(0);
        this.tweens.add({
          targets: ff, alpha: 0.92,
          duration: 380 + Math.random() * 240, ease: 'Sine.InOut', yoyo: true,
          onYoyo: () => { ff.setPosition(ff.x + (Math.random() - 0.5) * 20, ff.y + (Math.random() - 0.5) * 10); },
          onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
        });
      };
      this.time.addEvent({ delay: 280, loop: true, callback: spawnFirefly });
      for (let i = 0; i < 10; i++) this.time.delayedCall(i * 220, spawnFirefly);
      return;
    }

    // Aquatic — improved bubbles with shimmer + swimming fish
    const spawnBubble = () => {
      if (!this.scene?.isActive('HabitatRoom')) return;
      const bx = 18 + Math.random() * (W - 36);
      const br = 2 + Math.random() * 5;
      const bg = this.add.graphics().setDepth(3);
      bg.lineStyle(1.5, 0x88EEFF, 0.65);
      bg.strokeCircle(0, 0, br);
      bg.fillStyle(0xCCFFFF, 0.10);
      bg.fillCircle(0, 0, br);
      bg.fillStyle(0xFFFFFF, 0.45);
      bg.fillCircle(-br * 0.30, -br * 0.30, br * 0.35);
      bg.x = bx; bg.y = H * 0.62;
      this.tweens.add({
        targets: bg,
        x: bx + (Math.random() - 0.5) * 55,
        y: bg.y - (190 + Math.random() * 270),
        alpha: 0, duration: 1800 + Math.random() * 2200, ease: 'Linear',
        onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
      });
    };

    // Bioluminescent jellyfish drifting upward
    const spawnJellyfish = () => {
      if (!this.scene?.isActive('HabitatRoom')) return;
      const jx = 70 + Math.random() * (W - 140);
      const jy = H * 0.58 + Math.random() * H * 0.12;
      const jc = [0xFF88CC, 0xBB88FF, 0x88EEFF, 0xFFCC88][Math.floor(Math.random() * 4)];
      const jr = 9 + Math.random() * 7;
      const jg = this.add.graphics().setDepth(2);
      jg.fillStyle(jc, 0.18); jg.fillCircle(0, 0, jr + 8);
      jg.fillStyle(jc, 0.42); jg.fillEllipse(0, -jr * 0.12, jr * 2, jr * 1.15);
      jg.fillStyle(lighten(jc, 40), 0.32); jg.fillEllipse(-jr * 0.28, -jr * 0.32, jr * 0.65, jr * 0.45);
      jg.lineStyle(1, jc, 0.42);
      for (let ti = 0; ti < 5; ti++) {
        const tx2 = (ti / 5 - 0.5) * jr * 1.7;
        jg.beginPath(); jg.moveTo(tx2, jr * 0.48); jg.lineTo(tx2 + Math.sin(ti * 1.1) * 5, jr * 0.48 + 12 + Math.random() * 7); jg.strokePath();
      }
      jg.setPosition(jx, jy);
      this.tweens.add({
        targets: jg,
        y: jy - 220 - Math.random() * 180,
        x: jx + (Math.random() - 0.5) * 50,
        alpha: 0, duration: 5000 + Math.random() * 3500, ease: 'Sine.InOut',
        onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
      });
      this.tweens.add({ targets: jg, scaleX: 1.14, scaleY: 1.14, duration: 550 + Math.random() * 350, ease: 'Sine.InOut', yoyo: true, repeat: 6 });
    };
    this.time.addEvent({ delay: 2000, loop: true, callback: spawnJellyfish });
    spawnJellyfish();
    this.time.delayedCall(1000, spawnJellyfish);

    const spawnFish = () => {
      if (!this.scene?.isActive('HabitatRoom')) return;
      const fy = H * 0.12 + Math.random() * H * 0.38;
      const goRight = Math.random() > 0.5;
      const fs = 0.65 + Math.random() * 0.80;
      const fc = [0x44AADD, 0xFF9966, 0xFFDD66, 0x88DDAA, 0xCC88FF][Math.floor(Math.random() * 5)];
      const fish = this.add.graphics().setDepth(3);
      fish.fillStyle(fc, 0.50);
      fish.fillEllipse(0, 0, 30 * fs, 14 * fs);
      fish.fillTriangle(-15*fs, 0, -23*fs, -7*fs, -23*fs, 7*fs);
      fish.fillStyle(0xFFFFFF, 0.22);
      fish.fillEllipse(5*fs, -2*fs, 10*fs, 7*fs);
      fish.setScale(goRight ? 1 : -1, 1);
      fish.x = goRight ? -40 : W + 40;
      fish.y = fy;
      this.tweens.add({
        targets: fish,
        x: goRight ? W + 40 : -40,
        y: fy + (Math.random() - 0.5) * 28,
        duration: 5500 + Math.random() * 4000, ease: 'Linear',
        onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
      });
    };

    this.time.addEvent({ delay: 420, loop: true, callback: spawnBubble });
    this.time.addEvent({ delay: 5500, loop: true, callback: spawnFish });
    for (let i = 0; i < 5; i++) this.time.delayedCall(i * 360, spawnBubble);
    spawnFish();
  }

  // ── UTILS ─────────────────────────────────────────────────────────────────

  private _updateCoinDisplay() {
    if (this._coinTxt) this._coinTxt.setText('💰 ' + Game.state!.coins);
  }
}
