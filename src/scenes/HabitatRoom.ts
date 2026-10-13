import Phaser from 'phaser';
import { Game, FONT, store, sfx, recordQuestProgress } from '../utils';
import { SPECIES, HABITATS, FOOD_TYPES, TOY_TYPES, CLEAN_TOOLS, XP_TABLE, getLevelName, randomBuyer, randomListingDuration } from '../data';
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
  private _hungerTimer: Phaser.Time.TimerEvent | null = null;
  private _sadTimer: Phaser.Time.TimerEvent | null = null;

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
    this._buildMonsterArea(W, H, this._sp);
    this._buildStats(W, H);
    this._buildActions(W, H);
    this._buildHUD(W, H, this._sp);
    this._startAmbient(W, H, this._sp.habitat);

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
    return Math.max(10, Math.round(sp.price * (1 + m.level * 0.2) * (m.happiness / 100) * 0.8 * golden));
  }

  // ── BACKGROUND ────────────────────────────────────────────────────────────

  private _drawBackground(W: number, H: number, habitat: HabitatType) {
    const g = this.add.graphics().setDepth(0);

    if (habitat === 'dirt') {
      // Dark stone cave background
      g.fillGradientStyle(0x1E1E2E, 0x1E1E2E, 0x141422, 0x141422, 1);
      g.fillRect(0, 0, W, H);

      // Subtle stone texture patches
      [[40,180,60,32],[140,320,50,28],[280,200,66,34],[390,350,54,30],[500,260,44,26],[80,480,58,32],[330,450,62,34]].forEach((s2, i) => {
        g.fillStyle([0x2A2A3E, 0x222234, 0x303048][i % 3], 0.45);
        g.fillEllipse(s2[0], s2[1], s2[2], s2[3]);
      });

      // Stone arch alcoves (decorative background slots)
      const totalSlots = Math.min(4, (Game.state?.tanks?.[habitat as 'dirt'] ?? 4));
      const occupiedSlots = Game.state?.monsters.filter(m => m.habitatType === habitat).length ?? 0;
      const alcovePositions: [number, number][] = [
        [72, 310], [468, 310], [72, 520], [468, 520],
      ].slice(0, totalSlots) as [number, number][];

      alcovePositions.forEach(([ax, ay], idx) => {
        const isEmpty = idx >= occupiedSlots;
        g.fillStyle(0x0A0A16, 0.80);
        g.fillEllipse(ax + 3, ay + 3, 88, 44);
        g.fillRect(ax - 41, ay, 88, 38);
        g.fillStyle(0x3A3A52, 1);
        g.fillEllipse(ax, ay, 90, 46);
        g.fillRect(ax - 44, ay, 90, 40);
        g.fillStyle(0x0E0E1C, 1);
        g.fillEllipse(ax, ay, 74, 38);
        g.fillRect(ax - 36, ay, 74, 36);
        g.lineStyle(2, 0x5A5A7A, 0.65);
        g.beginPath();
        g.arc(ax, ay, 38, Math.PI, 0, false);
        g.strokePath();
        if (isEmpty) {
          g.fillStyle(0x8844FF, 0.18);
          g.fillCircle(ax, ay + 16, 20);
          g.lineStyle(3, 0xAA66FF, 0.85);
          g.beginPath(); g.moveTo(ax, ay + 6); g.lineTo(ax, ay + 26); g.strokePath();
          g.beginPath(); g.moveTo(ax - 10, ay + 16); g.lineTo(ax + 10, ay + 16); g.strokePath();
        }
      });

      // Purple portal arch center-back
      const pax = W / 2, pay = 165;
      g.fillStyle(0x4400AA, 0.12); g.fillEllipse(pax, pay, 180, 90);
      g.fillStyle(0x6600CC, 0.08); g.fillEllipse(pax, pay, 220, 110);
      g.lineStyle(5, 0x7722EE, 0.35);
      g.beginPath(); g.arc(pax, pay, 96, Math.PI, 0, false); g.strokePath();
      g.lineStyle(3, 0xBB44FF, 0.28);
      g.beginPath(); g.arc(pax, pay, 108, Math.PI, 0, false); g.strokePath();
      g.fillStyle(0x3300AA, 0.55);
      g.fillEllipse(pax, pay, 180, 90);
      g.fillRect(pax - 90, pay, 180, 55);
      g.fillStyle(0x5500CC, 0.28);
      g.fillEllipse(pax, pay, 158, 78);
      g.lineStyle(4, 0x9933FF, 0.75);
      g.beginPath(); g.arc(pax, pay, 88, Math.PI, 0, false); g.strokePath();
      g.lineStyle(2, 0xCC88FF, 0.55);
      g.beginPath(); g.arc(pax, pay, 80, Math.PI, 0, false); g.strokePath();
      g.fillStyle(0x7722EE, 0.06); g.fillEllipse(pax, pay - 10, 140, 65);

      // Hanging crystal lantern at top center
      const lx = W / 2, ly = 55;
      g.lineStyle(2, 0x445566, 0.85);
      g.beginPath(); g.moveTo(lx, 0); g.lineTo(lx, ly - 22); g.strokePath();
      g.fillStyle(0x0A2230, 0.95);
      g.fillRect(lx - 14, ly - 22, 28, 38);
      g.fillStyle(0x00CCCC, 0.12); g.fillCircle(lx, ly, 40);
      g.fillStyle(0x00EECC, 0.22); g.fillCircle(lx, ly, 24);
      g.fillStyle(0x44FFEE, 0.85); g.fillCircle(lx, ly, 10);
      g.fillStyle(0xAAFFF0, 0.70); g.fillCircle(lx - 3, ly - 3, 4);
      g.lineStyle(1.5, 0x00CCCC, 0.60);
      g.strokeRect(lx - 14, ly - 22, 28, 38);
      g.fillStyle(0x445566, 1);
      g.fillTriangle(lx - 17, ly - 22, lx + 17, ly - 22, lx, ly - 36);
      g.fillRect(lx - 14, ly + 16, 28, 6);

      // Large tropical leaves — left side
      g.fillStyle(0x1B5E20, 0.90); g.fillEllipse(86, H*0.48, 120, 28);
      g.fillStyle(0x2E7D32, 0.65); g.fillEllipse(76, H*0.48 - 6, 80, 14);
      g.lineStyle(2, 0x1B5E20, 0.5);
      g.beginPath(); g.moveTo(8, H*0.48); g.lineTo(128, H*0.48); g.strokePath();
      g.fillStyle(0x1A6018, 0.90); g.fillEllipse(74, H*0.56, 120, 28);
      g.fillStyle(0x2A7028, 0.65); g.fillEllipse(64, H*0.56 - 6, 80, 14);
      g.lineStyle(2, 0x1A6018, 0.5);
      g.beginPath(); g.moveTo(8, H*0.56); g.lineTo(118, H*0.56); g.strokePath();
      // Large tropical leaves — right side
      g.fillStyle(0x1B5E20, 0.90); g.fillEllipse(W - 86, H*0.48, 120, 28);
      g.fillStyle(0x2E7D32, 0.65); g.fillEllipse(W - 76, H*0.48 - 6, 80, 14);
      g.lineStyle(2, 0x1B5E20, 0.5);
      g.beginPath(); g.moveTo(W - 8, H*0.48); g.lineTo(W - 128, H*0.48); g.strokePath();
      g.fillStyle(0x1A6018, 0.90); g.fillEllipse(W - 74, H*0.56, 120, 28);
      g.fillStyle(0x2A7028, 0.65); g.fillEllipse(W - 64, H*0.56 - 6, 80, 14);
      g.lineStyle(2, 0x1A6018, 0.5);
      g.beginPath(); g.moveTo(W - 8, H*0.56); g.lineTo(W - 118, H*0.56); g.strokePath();

      // Ground — cool stone earth
      g.fillStyle(0x2A1E10, 1); g.fillRect(0, H*0.695, W, H*0.305);
      g.fillStyle(0x3A2A18, 1); g.fillRect(0, H*0.695, W, H*0.075);
      g.fillStyle(0x4A3420, 1); g.fillRect(0, H*0.695, W, 14);
      g.fillStyle(0x5E4228, 1); g.fillRect(0, H*0.695, W, 6);
      g.fillStyle(0x7A5830, 0.45); g.fillRect(0, H*0.695, W, 2.5);

      // Ground rocks
      [[50,H*0.755,52,30],[170,H*0.74,40,24],[318,H*0.77,58,32],[440,H*0.75,44,26],[498,H*0.78,36,22]].forEach((r, i) => {
        const rc = [0x3A2A14, 0x2E2010, 0x4A3418][i % 3];
        g.fillStyle(darken(rc, 12), 0.70); g.fillEllipse(r[0]+2, r[1]+3, r[2] as number, r[3] as number);
        g.fillStyle(rc, 1); g.fillEllipse(r[0], r[1], r[2] as number, r[3] as number);
        g.fillStyle(lighten(rc, 22), 0.35); g.fillEllipse(r[0]-r[2]*0.14, r[1]-r[3]*0.27, r[2]*0.50, r[3]*0.42);
      });

      // Blue/purple crystal formations
      ([[35,H*0.70,0x6644DD],[105,H*0.71,0x4488FF],[195,H*0.705,0x8844FF],[365,H*0.70,0x4466EE],[450,H*0.715,0x6644DD],[508,H*0.705,0x5566FF]] as [number,number,number][]).forEach(([cx2,cy2,cc]) => {
        g.fillStyle(cc, 0.10); g.fillCircle(cx2, cy2, 22);
        g.fillStyle(cc, 0.25); g.fillCircle(cx2, cy2, 13);
        g.fillStyle(cc, 0.92); g.fillCircle(cx2, cy2, 6);
        g.fillStyle(0xffffff, 0.60); g.fillCircle(cx2 - 1.5, cy2 - 1.5, 2);
        g.fillStyle(cc, 0.70);
        g.fillTriangle(cx2 - 5, cy2, cx2 + 5, cy2, cx2, cy2 - 16);
        g.fillTriangle(cx2 - 10, cy2 + 2, cx2 - 2, cy2 + 2, cx2 - 6, cy2 - 12);
        g.fillTriangle(cx2 + 2, cy2 + 2, cx2 + 10, cy2 + 2, cx2 + 6, cy2 - 12);
      });

      // Ceramic vase decoration
      const vx = W * 0.76, vy = H * 0.712;
      g.fillStyle(0x6A3820, 1); g.fillEllipse(vx, vy, 36, 10);
      g.fillStyle(0x8B4A28, 1);
      g.fillRect(vx - 14, vy - 44, 28, 44);
      g.fillEllipse(vx, vy - 44, 36, 14);
      g.fillEllipse(vx, vy - 44, 30, 10);
      g.fillStyle(0xAA6035, 0.45); g.fillEllipse(vx - 5, vy - 56, 14, 22);
      g.lineStyle(1.5, 0x5A2C14, 0.60);
      g.strokeRect(vx - 14, vy - 44, 28, 44);
      g.lineStyle(1, 0xCC7040, 0.30);
      [[vy - 36, 24], [vy - 24, 26], [vy - 12, 24]].forEach(([y2, w2]) => {
        g.beginPath(); g.moveTo(vx - w2/2, y2); g.lineTo(vx + w2/2, y2); g.strokePath();
      });

    } else if (habitat === 'grass') {
      // Bright sunlit forest
      g.fillGradientStyle(0x2A9820, 0x2A9820, 0x48CC30, 0x48CC30, 1);
      g.fillRect(0, 0, W, H * 0.5);
      g.fillGradientStyle(0x48CC30, 0x48CC30, 0x3AAA28, 0x3AAA28, 1);
      g.fillRect(0, H * 0.5, W, H * 0.5);
      const farTrees = [[38,H*0.54,58],[155,H*0.50,68],[318,H*0.52,63],[435,H*0.53,55],[515,H*0.55,48]];
      farTrees.forEach(t => {
        g.fillStyle(0x1A6018, 1);
        g.fillRect(t[0] - 5, t[1] + 10, 10, H - t[1]);
        g.fillStyle(0x1E7020, 0.85);
        g.fillCircle(t[0], t[1], t[2] * 0.48);
        g.fillCircle(t[0] - t[2]*0.26, t[1] + t[2]*0.26, t[2]*0.38);
        g.fillCircle(t[0] + t[2]*0.22, t[1] + t[2]*0.18, t[2]*0.36);
      });
      g.fillStyle(0x40B830, 1); g.fillRect(0, H * 0.70, W, H * 0.30);
      g.fillStyle(0x5ACC40, 1); g.fillRect(0, H * 0.70, W, 8);
      g.fillStyle(0x80E060, 0.4); g.fillRect(0, H * 0.703, W, 4);
      for (let gi = 0; gi < 9; gi++) {
        const gx = 28 + gi * 58, gy = H * 0.702;
        g.fillStyle(0x4CAF50, 1);
        g.fillTriangle(gx, gy, gx - 6, gy + 16, gx + 6, gy + 16);
        g.fillTriangle(gx + 10, gy + 3, gx + 4, gy + 17, gx + 16, gy + 17);
        g.fillStyle(0x66BB6A, 0.7);
        g.fillTriangle(gx + 2, gy - 3, gx - 2, gy + 10, gx + 6, gy + 10);
      }
      const flowers = [[75,H*0.755,0xFF9800],[195,H*0.745,0xFFEB3B],[325,H*0.760,0xFF5722],[448,H*0.750,0xE91E63]];
      flowers.forEach(fl => {
        g.fillStyle(fl[2], 1);
        for (let pi = 0; pi < 5; pi++) {
          const pa = (pi / 5) * Math.PI * 2;
          g.fillCircle(fl[0] + Math.cos(pa) * 5, fl[1] + Math.sin(pa) * 5, 4);
        }
        g.fillStyle(0xFFFDE7, 1); g.fillCircle(fl[0], fl[1], 3.5);
      });

    } else if (habitat === 'aquatic') {
      // Bright tropical ocean
      g.fillGradientStyle(0x0898D8, 0x0898D8, 0x0568B0, 0x0568B0, 1);
      g.fillRect(0, 0, W, H);
      for (let ri = 0; ri < 7; ri++) {
        const rx = 20 + ri * 78;
        g.fillStyle(0x4FC3F7, 0.035); g.fillTriangle(rx, 0, rx + 18, 0, rx + 55, H * 0.62);
        g.fillStyle(0x81D4FA, 0.025); g.fillTriangle(rx + 8, 0, rx + 24, 0, rx + 20, H * 0.48);
      }
      g.fillStyle(0xC2A05C, 1); g.fillRect(0, H * 0.72, W, H * 0.28);
      g.fillStyle(0xD4B483, 1); g.fillRect(0, H * 0.72, W, 9);
      g.fillStyle(0xE0C898, 0.35); g.fillRect(0, H * 0.724, W, 4);
      const pebbles = [[48,H*0.74],[118,H*0.72],[202,H*0.745],[298,H*0.73],[385,H*0.74],[458,H*0.72],[505,H*0.745]];
      pebbles.forEach((pb, i) => {
        const pc = [0xA08060, 0x8B7355, 0xC4A882][i % 3];
        g.fillStyle(pc, 1); g.fillEllipse(pb[0], pb[1], 18, 11);
        g.fillStyle(lighten(pc, 20), 0.35); g.fillEllipse(pb[0] - 3, pb[1] - 2, 8, 5);
      });
      const corals = [[88,H*0.695,0xFF5252],[245,H*0.705,0xFF9800],[375,H*0.690,0xE91E63],[490,H*0.700,0x7C4DFF]];
      corals.forEach(cr => {
        g.fillStyle(cr[2], 1);
        g.fillRect(cr[0] - 4, cr[1], 8, 44);
        g.fillCircle(cr[0], cr[1], 15); g.fillCircle(cr[0] - 11, cr[1] + 9, 11); g.fillCircle(cr[0] + 11, cr[1] + 11, 12);
        g.fillStyle(lighten(cr[2], 35), 0.45); g.fillCircle(cr[0] - 4, cr[1] - 5, 6);
      });
      for (let swi = 0; swi < 5; swi++) {
        const swx = 28 + swi * 108, swBase = H * 0.72;
        g.lineStyle(4, 0x1B5E20, 0.8);
        g.beginPath(); g.moveTo(swx, swBase); g.lineTo(swx + 13, swBase - 52);
        g.lineTo(swx - 7, swBase - 105); g.lineTo(swx + 11, swBase - 155); g.strokePath();
        g.lineStyle(3, 0x388E3C, 0.55);
        g.beginPath(); g.moveTo(swx + 18, swBase - 8); g.lineTo(swx + 7, swBase - 65);
        g.lineTo(swx + 20, swBase - 115); g.strokePath();
      }
    }

    this._drawDecorations(g, W, H, habitat);
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
        const px = W * 0.15, py = H * 0.74;
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
        const chx = W * 0.8, chy = H * 0.72;
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

  // ── MONSTER AREA ──────────────────────────────────────────────────────────

  private _buildMonsterArea(W: number, H: number, sp: Species) {
    const groundY = H * 0.70, monY = groundY - 78;
    const leftX = 112, rightX = W - 112;

    const shadowG = this.add.graphics().setDepth(4);
    shadowG.fillStyle(0x000000, 0.22);
    shadowG.fillEllipse(W / 2, groundY - 2, 115, 22);

    const texKey = makeMonsterTexture(this, this._monster);
    this._monImg = this.add.image(leftX, monY, texKey).setDisplaySize(152, 152).setDepth(5);
    this._dirtyOverlay = this.add.graphics().setDepth(6);

    this._walkTween = this.tweens.add({
      targets: this._monImg, x: rightX, duration: 3200, ease: 'Sine.InOut',
      yoyo: true, repeat: -1,
      onYoyo: () => { this._monImg.setFlipX(true); },
      onRepeat: () => { this._monImg.setFlipX(false); },
      onUpdate: () => { this._updateDirtyOverlay(); },
    });

    this._bobTween = this.tweens.add({
      targets: this._monImg, y: monY - 9, duration: 950,
      ease: 'Sine.InOut', yoyo: true, repeat: -1,
      onUpdate: () => { this._updateDirtyOverlay(); },
    });

    this._monY = monY;
  }

  // ── STATS BARS ────────────────────────────────────────────────────────────

  private _buildStats(W: number, H: number) {
    const statsY = H * 0.72 + 16;
    const defs = [
      { key: 'hunger',      label: '🍖', col: 0xF57C00 },
      { key: 'happiness',   label: '💛', col: 0xFDD835 },
      { key: 'cleanliness', label: '✨', col: 0x42A5F5 },
    ];
    const barW = W - 90;
    this._bars = {};

    defs.forEach((d, i) => {
      const by = statsY + i * 44;
      this.add.text(24, by, d.label, { fontFamily: FONT, fontSize: '22px' }).setOrigin(0, 0.5).setDepth(10);
      const bg = this.add.graphics().setDepth(10);
      bg.fillStyle(0x00000055, 1);
      bg.fillRoundedRect(54, by - 11, barW, 22, 11);
      const fill = this.add.graphics().setDepth(11);
      const val = this.add.text(W - 18, by, '0%', {
        fontFamily: FONT, fontSize: '13px', color: '#eeeeee',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 0.5).setDepth(12);
      this._bars[d.key] = { fill, col: d.col, bx: 54, by: by - 11, bw: barW, val };
    });

    this._refreshStats();
  }

  private _refreshStats() {
    const m = this._monster as any;
    (['hunger', 'happiness', 'cleanliness'] as const).forEach(k => {
      const e = this._bars[k];
      if (!e) return;
      const pct = Math.max(0, Math.min(1, m[k] / 100));
      e.fill.clear();
      e.fill.fillStyle(e.col, 1);
      e.fill.fillRoundedRect(e.bx, e.by, Math.max(16, e.bw * pct), 20, 10);
      e.val.setText(Math.round(m[k]) + '%');
    });
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
    } else {
      if (this._sadTimer) { this._sadTimer.destroy(); this._sadTimer = null; }
      if (this._walkTween) this._walkTween.timeScale = 1.0;
      if (this._bobTween) this._bobTween.timeScale = 1.0;
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

  // ── ACTION BUTTONS ────────────────────────────────────────────────────────

  private _buildActions(W: number, H: number) {
    const btnY = H - 72;
    const positions = [W/2 - 148, W/2, W/2 + 148];
    const icons = ['🍽', '🎾', '🧹'];
    const labels = ['Feed', 'Play', 'Clean'];
    const colors = [0xC83800, 0x9030C8, 0x2080C0];
    const callbacks = [
      () => this._showFoodPicker(),
      () => this._showToyPicker(),
      () => this._showToolPicker(),
    ];
    positions.forEach((bx, i) => {
      const btn = this.add.container(bx, btnY).setDepth(10).setSize(90, 80);
      const bg = this.add.graphics();
      bg.fillStyle(darken(colors[i], 20), 1);
      bg.fillEllipse(0, -4, 78, 74);
      bg.fillStyle(colors[i], 1);
      bg.fillEllipse(0, -8, 78, 74);
      bg.lineStyle(2, lighten(colors[i], 40), 0.70);
      bg.strokeEllipse(0, -8, 78, 74);
      const ico = this.add.text(0, -14, icons[i], { fontFamily: FONT, fontSize: '28px' }).setOrigin(0.5);
      const lbl = this.add.text(0, 18, labels[i], {
        fontFamily: FONT, fontSize: '12px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
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
    makeButton(this, 56, 34, 92, 44, '← Back', 0x4A2010, () => { this.scene.start('Hub'); }, 15).setDepth(20);

    const displayName = this._monster.nickname ?? sp.name;
    this._nameTxt = this.add.text(W / 2, 19, displayName + (mods.isGolden ? ' ★' : ''), {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold',
      color: mods.isGolden ? '#FFD700' : '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);

    const speciesHint = this.add.text(W / 2, 40, sp.name + ' ✏️', {
      fontFamily: FONT, fontSize: '12px', color: '#7766aa',
    }).setOrigin(0.5).setDepth(20).setInteractive({ useHandCursor: true });
    speciesHint.on('pointerdown', () => this._renameMonster());

    this.add.text(W / 2, 56, getLevelName(this._monster.level) + '  ·  ' +
      sp.habitat.charAt(0).toUpperCase() + sp.habitat.slice(1), {
      fontFamily: FONT, fontSize: '12px', color: '#CCDDFF',
    }).setOrigin(0.5).setDepth(20);

    this._sellBtn = makeButton(this, W - 72, 34, 116, 44,
      'Sell  ' + this._sellPrice + '🪙', 0x8B6000, () => this._handleListBtn(), 13);
    this._sellBtn.setDepth(20);

    const isGoldenMon = getVariantModifiers(this._monster.variantIndex).isGolden;
    const goldenMult = isGoldenMon ? 1.5 : 1;
    const maxPrice = Math.max(10, Math.round(sp.price * (1 + 10 * 0.2) * 0.8 * goldenMult));
    const hintLabel = isGoldenMon
      ? '✨ Golden +50%  ·  max: ' + maxPrice + '🪙'
      : 'Lv10 max: ' + maxPrice + '🪙  ·  ❤️';
    this.add.text(W - 72, 62, hintLabel, {
      fontFamily: FONT, fontSize: '10px', color: isGoldenMon ? '#FFD700' : '#BBAACC',
    }).setOrigin(0.5).setDepth(20);

    this._coinTxt = this.add.text(W / 2, H * 0.72 + 5, '🪙 ' + Game.state!.coins, {
      fontFamily: FONT, fontSize: '15px', color: '#FFD700',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(20);

    this.events.once('shutdown', () => {
      if (this._renameInput) {
        try { document.body.removeChild(this._renameInput); } catch { /* ignore */ }
        this._renameInput = null;
      }
      if (this._hungerTimer) { this._hungerTimer.destroy(); this._hungerTimer = null; }
      if (this._sadTimer) { this._sadTimer.destroy(); this._sadTimer = null; }
    });
  }

  private _renameMonster() {
    if (this._renameInput) return;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = this._monster.nickname ?? this._sp.name;
    inp.maxLength = 20;
    inp.placeholder = 'Enter a name...';
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

    this._pickerItems.push(this.add.text(fpX + fpW/2, fpY + 14, '🍽 Choose food', {
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
      const lbl = food.name + ' ' + stars + '\n+' + food.hungerGain + '🍖 +' + food.happinessGain + '💛\n' + food.cost + '🪙';
      const tierColors = [0x2A4A18, 0x2A4A28, 0x3A3010];
      const fbtn = makeButton(this, bx, by, btnW - 2, btnH, lbl,
        canAfford ? tierColors[food.tier - 1] : 0x1A1A2A, () => {
          if (Game.state!.coins < food.cost) { showToast(this, 'Not enough coins!', '#ff9999'); return; }
          Game.state!.coins -= food.cost;
          this._monster.hunger    = Math.min(100, this._monster.hunger    + food.hungerGain);
          this._monster.happiness = Math.min(100, this._monster.happiness + food.happinessGain);
          this._monster.lastCaredAt = Date.now();
          this._gainXP(10 + food.tier * 3);
          recordQuestProgress('feed');
          store.setJSON('mps_state', Game.state);
          sfx.feed();
          this._playFeedAnim(food.id, food.tier);
          showFloat(this, this._monImg.x, this._monImg.y - 85,
            '+' + food.hungerGain + '🍖 +' + food.happinessGain + '💛', '#ffcc44');
          this._refreshStats();
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
      this._pickerItems.push(this.add.text(fpX + fpW/2, fpY + 13, '🎾 ' + ownedToy.name, {
        fontFamily: FONT, fontSize: '12px', color: '#aa88cc',
      }).setOrigin(0.5).setDepth(28));
      const fbtn = makeButton(this, fpX + fpW/2, fpY + 60, fpW - 30, 54,
        'Play! FREE  +' + ownedToy.happinessGain + '💛', 0x6030A0, () => {
          this._monster.happiness = Math.min(100, this._monster.happiness + ownedToy.happinessGain);
          this._monster.lastCaredAt = Date.now();
          this._gainXP(8 + ownedToy.tier * 3);
          recordQuestProgress('play');
          store.setJSON('mps_state', Game.state);
          sfx.pet();
          this._playPetAnim(ownedToy.id);
          showFloat(this, this._monImg.x, this._monImg.y - 85, '+' + ownedToy.happinessGain + '💛', '#ffdd55');
          this._refreshStats();
          this._clearPicker();
        }, 14);
      fbtn.setDepth(29);
      this._pickerItems.push(fbtn);
      if (hasUpgrade && nextToy) {
        const canAfford = Game.state!.coins >= nextToy.cost;
        const upgradeBtn = makeButton(this, fpX + fpW/2, fpY + 120, fpW - 30, 30,
          'Upgrade → ' + nextToy.name + '  ' + nextToy.cost + '🪙',
          canAfford ? 0x7040B0 : 0x2A1A40, () => {
            if (Game.state!.coins < nextToy.cost) { showToast(this, 'Not enough coins!', '#ff9999'); return; }
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
      this._pickerItems.push(this.add.text(fpX + fpW/2, fpY + 13, '🎾 Buy a toy (kept forever)', {
        fontFamily: FONT, fontSize: '12px', color: '#aa88cc',
      }).setOrigin(0.5).setDepth(28));
      const btnW = Math.floor((fpW - 24) / 3);
      const btnH = 82;
      TOY_TYPES.forEach((toy, i) => {
        const bx = fpX + 12 + i * (btnW + 4) + btnW / 2;
        const by = fpY + 27 + btnH / 2;
        const canAfford = Game.state!.coins >= toy.cost;
        const lbl = toy.name + ' ' + '★'.repeat(toy.tier) + '\n+' + toy.happinessGain + '💛\n' + toy.cost + '🪙';
        const fbtn = makeButton(this, bx, by, btnW - 2, btnH, lbl,
          canAfford ? 0x6030A0 : 0x2A1A40, () => {
            if (Game.state!.coins < toy.cost) { showToast(this, 'Not enough coins!', '#ff9999'); return; }
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
      this._pickerItems.push(this.add.text(fpX + fpW/2, fpY + 13, '🧹 ' + ownedTool.name, {
        fontFamily: FONT, fontSize: '12px', color: '#88aacc',
      }).setOrigin(0.5).setDepth(28));

      const cleanBtn = makeButton(this, fpX + fpW/2, fpY + 60, fpW - 30, 54,
        'Clean FREE  +' + ownedTool.cleanGain + '✨', 0x1060A0, () => {
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
          'Upgrade → ' + nextTool.name + '  ' + nextTool.cost + '🪙',
          canAfford ? 0x1070C0 : 0x0A2840, () => {
            if (Game.state!.coins < nextTool.cost) { showToast(this, 'Not enough coins!', '#ff9999'); return; }
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
      this._pickerItems.push(this.add.text(fpX + fpW/2, fpY + 13, '🧹 Buy cleaning tool (kept forever)', {
        fontFamily: FONT, fontSize: '12px', color: '#88aacc',
      }).setOrigin(0.5).setDepth(28));
      const btnW = Math.floor((fpW - 24) / 3);
      const btnH = 82;
      CLEAN_TOOLS.forEach((tool, i) => {
        const bx = fpX + 12 + i * (btnW + 4) + btnW / 2;
        const by = fpY + 27 + btnH / 2;
        const canAfford = Game.state!.coins >= tool.cost;
        const lbl = tool.name + ' ' + '★'.repeat(tool.tier) + '\n+' + tool.cleanGain + '✨\n' + tool.cost + '🪙';
        const fbtn = makeButton(this, bx, by, btnW - 2, btnH, lbl,
          canAfford ? 0x1060A0 : 0x0A2840, () => {
            if (Game.state!.coins < tool.cost) { showToast(this, 'Not enough coins!', '#ff9999'); return; }
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
    const groundY = H * 0.70;

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
        showToast(this, (this._monster.nickname ?? this._sp.name) +
          ' needs to be ' + needed + ' (Lv 5) to sell!', '#ffaaaa');
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
    showToast(this, buyer.name + ' is interested! (~' + waitStr + ')', '#aaffaa');
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

    popup.add(this.add.text(W/2, H/2 - 120, 'A Buyer Arrived!', {
      fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: '#66FF99',
    }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 88, buyerName + ', ' + buyerJob, {
      fontFamily: FONT, fontSize: '15px', fontStyle: 'italic', color: '#88CCFF',
    }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 64, 'wants to buy your ' +
      (this._monster.nickname ?? this._sp.name) + '!', {
      fontFamily: FONT, fontSize: '13px', color: '#aaccaa',
    }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 40, 'Offered: ' + basePrice + ' 🪙', {
      fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#FFD700',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 16, 'Watch an ad to double the offer!', {
      fontFamily: FONT, fontSize: '11px', color: '#FFD700',
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
      showFloat(this, W/2, H/2 - 120, '+' + price + ' 🪙', '#ffd700');
      this.time.delayedCall(950, () => this.scene.start('Hub'));
    };

    popup.add(makeButton(this, W/2, H/2 + 30, 210, 50, 'Collect ' + basePrice + '🪙', 0x2A8840, () => {
      finalize(basePrice);
    }, 15));
    popup.add(makeButton(this, W/2, H/2 + 92, 270, 50, 'Ad x2 → ' + (basePrice * 2) + '🪙', 0x7A4A00, () => {
      Ads.showRewarded(res => { finalize(res.rewarded ? basePrice * 2 : basePrice); });
    }, 14));
    popup.add(makeButton(this, W/2, H/2 + 148, 120, 38, 'Cancel', 0x4A2890, () => {
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

    popup.add(this.add.text(W/2, H/2 - 68, 'Sell price: ' + listing.price + '🪙', {
      fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 40, 'Ready in ~' + mins + ' min', {
      fontFamily: FONT, fontSize: '14px', color: '#BBCCFF',
    }).setOrigin(0.5));

    popup.add(makeButton(this, W/2, H/2 + 10, 210, 48, 'Cancel Listing', 0x6A1010, () => {
      Game.state!.listings = Game.state!.listings.filter(l => l.id !== listing.id);
      store.setJSON('mps_state', Game.state);
      if (this._listTimer) { this._listTimer.remove(); this._listTimer = null; }
      popup.destroy();
      this._updateListBtnState();
      this.tweens.add({
        targets: this._sellBtn, scaleX: 1.04, scaleY: 1.04,
        duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut',
      });
      showToast(this, 'Listing cancelled', '#ffaaaa');
    }, 14));
    popup.add(makeButton(this, W/2, H/2 + 70, 140, 38, 'Keep Listed', 0x4A2890, () => {
      popup.destroy();
    }, 14));
  }

  private _updateListBtnState() {
    const listing = Game.state!.listings.find(l => l.monsterId === this._monster.id);
    if (!listing) {
      setButtonLabel(this._sellBtn, 'Sell  ' + this._sellPrice + '🪙');
      setButtonColor(this._sellBtn, 0x8B6000);
      return;
    }
    const remaining = listing.readyAt - Date.now();
    if (remaining <= 0) {
      setButtonLabel(this._sellBtn, 'Collect ' + listing.price + '🪙');
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
      setButtonLabel(this._sellBtn, 'Buyer in ' + timeStr);
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
        showToast(this, SPECIES[m.speciesId].name + ' leveled up! Lv ' + m.level + ' 🎉', '#FFD700');
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
    if (habitat !== 'aquatic') return;
    const spawnBubble = () => {
      if (!this.scene?.isActive('HabitatRoom')) return;
      const bx = 18 + Math.random() * (W - 36);
      const br = 2 + Math.random() * 5;
      const bg = this.add.graphics().setDepth(3);
      bg.lineStyle(1.5, 0x4FC3F7, 0.65);
      bg.strokeCircle(0, 0, br);
      bg.x = bx; bg.y = H * 0.70;
      this.tweens.add({
        targets: bg,
        y: bg.y - (180 + Math.random() * 260),
        alpha: 0,
        duration: 1800 + Math.random() * 2000,
        ease: 'Linear',
        onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* ignore */ } },
      });
    };
    this.time.addEvent({ delay: 420, loop: true, callback: spawnBubble });
    for (let i = 0; i < 5; i++) spawnBubble();
  }

  // ── UTILS ─────────────────────────────────────────────────────────────────

  private _updateCoinDisplay() {
    if (this._coinTxt) this._coinTxt.setText('🪙 ' + Game.state!.coins);
  }
}
