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
  private _hungerTimer: Phaser.Time.TimerEvent | null = null;
  private _sadTimer: Phaser.Time.TimerEvent | null = null;
  private _moodTimer: Phaser.Time.TimerEvent | null = null;
  private _happyGlow: Phaser.GameObjects.Graphics | null = null;
  private _platformG: Phaser.GameObjects.Graphics | null = null;
  private _bowlGfx: Phaser.GameObjects.Graphics | null = null;
  private _bowlLabelTxt: Phaser.GameObjects.Text | null = null;
  private _bowlSteamTimer: Phaser.Time.TimerEvent | null = null;
  private _eatTimer: Phaser.Time.TimerEvent | null = null;
  private _bowlX: number = 0;
  private _bowlY: number = 0;

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

    if (habitat === 'dirt') {
      // ── Warm Amber Crystal Cave ───────────────────────────────────────────
      // Magical cave: deep violet at top → warm amber depths
      g.fillGradientStyle(0x12062A, 0x12062A, 0x3A1808, 0x3A1808, 1);
      g.fillRect(0, 0, W, H * 0.30);
      g.fillGradientStyle(0x3A1808, 0x3A1808, 0x7A3818, 0x7A3818, 1);
      g.fillRect(0, H * 0.30, W, H * 0.30);
      g.fillGradientStyle(0x7A3818, 0x7A3818, 0x9A5028, 0x9A5028, 1);
      g.fillRect(0, H * 0.60, W, H * 0.40);
      // Magical purple glow from arch portal area
      g.fillStyle(0x6A22BB, 0.06); g.fillEllipse(W / 2, H * 0.19, 380, 240);
      g.fillStyle(0x9944FF, 0.04); g.fillEllipse(W / 2, H * 0.12, 260, 170);

      // Warm stone block wall texture (sandstone tone)
      const bW = 72, bH = 36;
      g.lineStyle(1.2, 0x2A0E04, 0.45);
      for (let brow = 0; brow < Math.ceil(H * 0.72 / bH) + 1; brow++) {
        const wy = brow * bH;
        const bOff = (brow % 2 === 0) ? 0 : bW / 2;
        for (let wx = -bW / 2 + bOff; wx < W + bW; wx += bW) {
          g.strokeRect(wx, wy, bW - 1, bH - 1);
        }
      }
      // Warm mortar highlights on stones
      g.lineStyle(0.8, 0xC07040, 0.12);
      for (let brow = 0; brow < Math.ceil(H * 0.72 / bH) + 1; brow++) {
        const wy = brow * bH;
        const bOff = (brow % 2 === 0) ? 0 : bW / 2;
        for (let wx = -bW / 2 + bOff; wx < W + bW; wx += bW) {
          g.strokeRect(wx + 2, wy + 2, bW - 5, bH - 5);
        }
      }

      // Ceiling stalactites
      ([[50,0,18,58],[120,0,12,40],[210,0,22,72],[310,0,14,48],[395,0,20,65],[470,0,10,35],[530,0,16,52]] as [number,number,number,number][]).forEach(([sx,_sy,sw,sh]) => {
        g.fillStyle(0x5A2A10, 1);
        g.fillTriangle(sx - sw, 0, sx + sw, 0, sx, sh);
        g.fillStyle(0x7A3A18, 0.6);
        g.fillTriangle(sx - sw * 0.5, 0, sx + sw * 0.3, 0, sx + sw * 0.1, sh * 0.55);
        g.fillStyle(0xFFCC66, 0.18); g.fillCircle(sx, sh - 4, 5);
      });

      // Central ornate arch gateway (warm amber/gold)
      const pax = W / 2, pay = 170;
      // Outer glow
      g.fillStyle(0xFF8C00, 0.06); g.fillEllipse(pax, pay, 240, 120);
      g.fillStyle(0xFFAA22, 0.10); g.fillEllipse(pax, pay, 190, 94);
      // Arch base fill (warm dark amber)
      g.fillStyle(0x4A1E06, 1);
      g.fillEllipse(pax, pay, 178, 90); g.fillRect(pax - 89, pay, 178, 60);
      // Arch glow interior
      g.fillStyle(0xFF6600, 0.22); g.fillEllipse(pax, pay, 158, 78);
      g.fillStyle(0xFF8800, 0.14); g.fillEllipse(pax, pay, 130, 65);
      g.fillStyle(0xFFAA44, 0.08); g.fillEllipse(pax, pay, 100, 50);
      // Arch border rings
      g.lineStyle(5, 0xCC6600, 0.90);
      g.beginPath(); g.arc(pax, pay, 90, Math.PI, 0, false); g.strokePath();
      g.lineStyle(3, 0xFFAA33, 0.80);
      g.beginPath(); g.arc(pax, pay, 82, Math.PI, 0, false); g.strokePath();
      g.lineStyle(1.5, 0xFFDD88, 0.55);
      g.beginPath(); g.arc(pax, pay, 74, Math.PI, 0, false); g.strokePath();
      // Arch pillars
      [[pax - 90, pay], [pax + 90, pay]].forEach(([px, py]) => {
        g.fillStyle(0x5A2A0A, 1); g.fillRect(px - 8, py, 16, 52);
        g.fillStyle(0x8B4A18, 0.7); g.fillRect(px - 5, py, 5, 52);
        g.fillStyle(0xCC7722, 0.40); g.fillRect(px - 6, py + 4, 3, 44);
      });

      // Wall-mounted amber gem sconces with torch glow
      ([[55, H*0.30], [55, H*0.50], [W-55, H*0.30], [W-55, H*0.50]] as [number,number][]).forEach(([tx, ty]) => {
        // Glow radius
        g.fillStyle(0xFF8800, 0.10); g.fillCircle(tx, ty - 12, 55);
        g.fillStyle(0xFFAA22, 0.16); g.fillCircle(tx, ty - 12, 35);
        g.fillStyle(0xFFCC44, 0.25); g.fillCircle(tx, ty - 12, 20);
        // Torch bracket
        g.fillStyle(0x4A2A0A, 1); g.fillRect(tx - 4, ty - 8, 8, 22);
        g.fillStyle(0x7A4A18, 1); g.fillRect(tx - 3, ty - 7, 6, 20);
        // Flame
        g.fillStyle(0xFF4400, 0.85); g.fillEllipse(tx, ty - 14, 10, 18);
        g.fillStyle(0xFF8800, 0.90); g.fillEllipse(tx, ty - 18, 8, 14);
        g.fillStyle(0xFFCC00, 0.95); g.fillEllipse(tx, ty - 22, 5, 10);
        g.fillStyle(0xFFFFAA, 1);   g.fillEllipse(tx, ty - 24, 3, 6);
      });

      // Large amber gem clusters embedded in side walls
      ([[28, H*0.42, 0xFFB300], [28, H*0.60, 0xFF6600], [W-28, H*0.38, 0xFFCC00], [W-28, H*0.55, 0xFF8800]] as [number,number,number][]).forEach(([gx, gy, gc]) => {
        g.fillStyle(gc, 0.15); g.fillCircle(gx, gy, 28);
        g.fillStyle(gc, 0.28); g.fillCircle(gx, gy, 16);
        g.fillStyle(gc, 0.90); g.fillCircle(gx, gy, 8);
        g.fillStyle(0xFFFFDD, 0.70); g.fillCircle(gx - 2, gy - 2, 3);
        // Crystal facets
        g.fillStyle(gc, 0.85);
        g.fillTriangle(gx - 6, gy, gx + 6, gy, gx, gy - 18);
        g.fillTriangle(gx - 10, gy + 2, gx - 1, gy + 2, gx - 5.5, gy - 12);
        g.fillTriangle(gx + 1,  gy + 2, gx + 10, gy + 2, gx + 5.5, gy - 12);
        g.lineStyle(1, 0xFFFFAA, 0.45);
        g.beginPath(); g.moveTo(gx - 6, gy); g.lineTo(gx, gy - 18); g.lineTo(gx + 6, gy); g.strokePath();
      });

      // 3D perspective amber stone floor
      this._drawPerspectiveFloor(g, W, H, H * 0.695, 6, 9, 0x7A4520, 0x6A3818, 0x2E1408, 0.50);

      // Glowing mushroom clusters at floor edges
      ([[30, H*0.715, 0xFF6622], [65, H*0.700, 0xFFAA00], [480, H*0.718, 0xFF4400], [510, H*0.705, 0xFF8800]] as [number,number,number][]).forEach(([mx, my, mc]) => {
        // Stem
        g.fillStyle(0xDDCC88, 1); g.fillRect(mx - 3, my - 16, 6, 18);
        // Cap glow
        g.fillStyle(mc, 0.20); g.fillCircle(mx, my - 20, 20);
        g.fillStyle(mc, 0.40); g.fillCircle(mx, my - 20, 13);
        // Cap
        g.fillStyle(mc, 1);
        g.fillEllipse(mx, my - 22, 22, 16);
        g.fillStyle(lighten(mc, 50), 0.55); g.fillEllipse(mx - 3, my - 26, 10, 7);
        // Spots
        g.fillStyle(0xFFEECC, 0.80); g.fillCircle(mx - 4, my - 22, 2); g.fillCircle(mx + 3, my - 25, 1.5);
        // Gills
        g.fillStyle(darken(mc, 20), 0.65); g.fillEllipse(mx, my - 14, 18, 6);
      });

      // Warm amber crystal formations at floor
      ([[38,H*0.700,0xFFAA00],[108,H*0.710,0xFF8800],[200,H*0.695,0xFFCC22],[345,H*0.700,0xFF9900],[438,H*0.710,0xFFAA00],[506,H*0.698,0xFF7700]] as [number,number,number][]).forEach(([cx2,cy2,cc]) => {
        g.fillStyle(cc, 0.18); g.fillCircle(cx2, cy2, 20);
        g.fillStyle(cc, 0.35); g.fillCircle(cx2, cy2, 11);
        g.fillStyle(cc, 1); g.fillCircle(cx2, cy2, 5);
        g.fillStyle(0xFFFFCC, 0.75); g.fillCircle(cx2 - 1, cy2 - 1, 2);
        g.fillStyle(cc, 0.85);
        g.fillTriangle(cx2-4, cy2, cx2+4, cy2, cx2, cy2-14);
        g.fillTriangle(cx2-8, cy2+2, cx2-1, cy2+2, cx2-4.5, cy2-10);
        g.fillTriangle(cx2+1, cy2+2, cx2+8, cy2+2, cx2+4.5, cy2-10);
        g.lineStyle(1, 0xFFFFAA, 0.50);
        g.beginPath(); g.moveTo(cx2-4,cy2); g.lineTo(cx2,cy2-14); g.lineTo(cx2+4,cy2); g.strokePath();
      });

    } else if (habitat === 'grass') {
      // ── Enchanted Sunlit Garden ───────────────────────────────────────────
      // Sky: vivid azure to warm golden horizon
      g.fillGradientStyle(0x1A8BC4, 0x1A8BC4, 0x4FC8F0, 0x4FC8F0, 1);
      g.fillRect(0, 0, W, H * 0.28);
      g.fillGradientStyle(0x4FC8F0, 0x4FC8F0, 0xA8E4F8, 0xA8E4F8, 1);
      g.fillRect(0, H * 0.28, W, H * 0.12);
      // Warm horizon glow
      g.fillGradientStyle(0xA8E4F8, 0xA8E4F8, 0xFFF0C8, 0xFFF0C8, 1);
      g.fillRect(0, H * 0.40, W, H * 0.08);

      // Sun with multi-layer glow
      const sx = W * 0.82, sy = H * 0.10;
      g.fillStyle(0xFFFF88, 0.08); g.fillCircle(sx, sy, 70);
      g.fillStyle(0xFFEE44, 0.14); g.fillCircle(sx, sy, 50);
      g.fillStyle(0xFFDD22, 0.28); g.fillCircle(sx, sy, 35);
      g.fillStyle(0xFFCC00, 0.65); g.fillCircle(sx, sy, 24);
      g.fillStyle(0xFFEE88, 1);    g.fillCircle(sx, sy, 16);
      g.fillStyle(0xFFFFCC, 1);    g.fillCircle(sx, sy, 9);

      // Sunbeam rays (light shafts)
      for (let ri = 0; ri < 6; ri++) {
        const angle = (ri / 6) * Math.PI * 2 + 0.3;
        const rlen = 180 + (ri % 3) * 50;
        const rw = 18 + (ri % 2) * 10;
        g.fillStyle(0xFFEE44, 0.04 + (ri % 2) * 0.02);
        g.fillTriangle(
          sx + Math.cos(angle - 0.08) * 28, sy + Math.sin(angle - 0.08) * 28,
          sx + Math.cos(angle + 0.08) * 28, sy + Math.sin(angle + 0.08) * 28,
          sx + Math.cos(angle) * rlen + Math.sin(angle) * rw, sy + Math.sin(angle) * rlen - Math.cos(angle) * rw,
        );
      }

      // Rainbow arc (drawn before clouds so clouds overlap it)
      const rainColors = [0xFF4444, 0xFF8844, 0xFFEE44, 0x44EE44, 0x4488FF, 0x8844FF];
      rainColors.forEach((rc, ri) => {
        g.lineStyle(5, rc, 0.16 - ri * 0.01);
        g.beginPath();
        g.arc(W * 0.40, H * 0.44, 140 + ri * 9, Math.PI, 0, false);
        g.strokePath();
      });

      // Fluffy clouds
      ([[80, H*0.09, 90, 34], [260, H*0.06, 72, 27], [420, H*0.11, 100, 38]] as [number,number,number,number][]).forEach(([cx, cy, cw, ch]) => {
        // Shadow
        g.fillStyle(0xCCE8F0, 0.45); g.fillEllipse(cx + 4, cy + 4, cw, ch * 0.7);
        // Main puffs
        g.fillStyle(0xFFFFFF, 0.95); g.fillEllipse(cx, cy, cw, ch);
        g.fillStyle(0xFFFFFF, 0.90); g.fillEllipse(cx - cw*0.28, cy + ch*0.10, cw*0.68, ch*0.76);
        g.fillStyle(0xFFFFFF, 0.90); g.fillEllipse(cx + cw*0.28, cy + ch*0.08, cw*0.62, ch*0.72);
        g.fillStyle(0xFFFFFF, 0.80); g.fillEllipse(cx - cw*0.12, cy - ch*0.20, cw*0.50, ch*0.65);
        g.fillStyle(0xFFFFFF, 0.80); g.fillEllipse(cx + cw*0.15, cy - ch*0.15, cw*0.45, ch*0.60);
        // Highlight
        g.fillStyle(0xFFFFFF, 0.50); g.fillEllipse(cx - cw*0.08, cy - ch*0.15, cw*0.30, ch*0.35);
      });

      // Far forest silhouette (dark layer)
      g.fillGradientStyle(0x1A5C14, 0x1A5C14, 0x2A7A20, 0x2A7A20, 1);
      g.fillRect(0, H * 0.48, W, H * 0.08);
      ([[0,H*0.54,48],[70,H*0.50,62],[160,H*0.52,55],[260,H*0.49,68],[360,H*0.52,58],[460,H*0.50,65],[530,H*0.55,44]] as [number,number,number][]).forEach(([tx, ty, tr]) => {
        g.fillStyle(0x194A12, 1); g.fillRect(tx - 5, ty + 12, 10, H);
        g.fillStyle(0x1E5A18, 0.95); g.fillCircle(tx, ty, tr * 0.46);
        g.fillStyle(0x245E1C, 0.85); g.fillCircle(tx - tr*0.22, ty + tr*0.22, tr*0.36);
        g.fillStyle(0x1E5A18, 0.85); g.fillCircle(tx + tr*0.20, ty + tr*0.18, tr*0.34);
      });

      // Bright mid-ground trees
      ([[40,H*0.58,54],[145,H*0.55,64],[300,H*0.57,60],[420,H*0.56,58],[510,H*0.60,46]] as [number,number,number][]).forEach(([tx, ty, tr]) => {
        g.fillStyle(0x2A6E18, 1); g.fillRect(tx - 6, ty + 14, 12, H);
        g.fillStyle(0x388E2A, 1); g.fillCircle(tx, ty, tr * 0.50);
        g.fillStyle(0x44AA30, 0.80); g.fillCircle(tx - tr*0.24, ty + tr*0.20, tr*0.40);
        g.fillStyle(0x44AA30, 0.80); g.fillCircle(tx + tr*0.22, ty + tr*0.16, tr*0.38);
        g.fillStyle(0x66CC40, 0.45); g.fillCircle(tx - tr*0.08, ty - tr*0.20, tr*0.30);
        // Light highlight on top
        g.fillStyle(0x88EE55, 0.25); g.fillEllipse(tx, ty - tr*0.25, tr*0.55, tr*0.40);
      });

      // Rolling green hill band
      g.fillGradientStyle(0x4CAF35, 0x4CAF35, 0x66CC44, 0x66CC44, 1);
      g.fillRect(0, H * 0.65, W, H * 0.07);
      g.fillStyle(0x55BB3A, 1);
      for (let hi = 0; hi <= 6; hi++) {
        g.fillEllipse(hi * 95 - 20, H * 0.66, 130, 40);
      }

      // 3D perspective grass floor (rich green wood)
      this._drawPerspectiveFloor(g, W, H, H * 0.70, 6, 8, 0x558832, 0x447228, 0x1A3A0A, 0.35);
      // Bright grass edge strip
      g.fillStyle(0x66CC40, 1); g.fillRect(0, H * 0.700, W, 10);
      g.fillStyle(0x88EE55, 0.50); g.fillRect(0, H * 0.700, W, 4);
      // Grass blade tufts
      for (let gi = 0; gi < 12; gi++) {
        const gx = 14 + gi * 44, gy = H * 0.702;
        g.fillStyle(0x44BB22, 1);
        g.fillTriangle(gx, gy, gx-5, gy+14, gx+5, gy+14);
        g.fillTriangle(gx+8, gy+2, gx+3, gy+16, gx+13, gy+16);
        g.fillStyle(0x66DD33, 0.80);
        g.fillTriangle(gx+2, gy-2, gx-1, gy+9, gx+5, gy+9);
      }

      // Colourful flower bed at floor level
      ([[55,H*0.752,0xFF3A8A,6],[115,H*0.742,0xFFCC00,5],[175,H*0.756,0xFF6600,6],[240,H*0.748,0xCC44FF,5],[315,H*0.754,0xFF1A6A,6],[385,H*0.744,0xFFDD00,5],[448,H*0.750,0xFF5500,6],[510,H*0.746,0x8844FF,5]] as [number,number,number,number][]).forEach(([fx,fy,fc,fr]) => {
        for (let pi = 0; pi < 6; pi++) {
          const pa = (pi / 6) * Math.PI * 2;
          g.fillStyle(fc, 1); g.fillCircle(fx + Math.cos(pa) * fr, fy + Math.sin(pa) * fr, fr * 0.85);
        }
        g.fillStyle(0xFFFF88, 1); g.fillCircle(fx, fy, fr * 0.60);
        g.fillStyle(0xFFFFCC, 0.70); g.fillCircle(fx - fr*0.20, fy - fr*0.20, fr * 0.30);
        // Stem
        g.fillStyle(0x3A8822, 1); g.fillRect(fx - 1, fy + fr, 2, 10);
      });

      // Butterfly silhouettes in mid-air
      ([[160, H*0.42, 0xFF88DD], [380, H*0.38, 0xFFAA44], [470, H*0.45, 0x88DDFF]] as [number,number,number][]).forEach(([bx, by, bc]) => {
        g.fillStyle(bc, 0.70);
        g.fillEllipse(bx - 7, by - 3, 14, 9);
        g.fillEllipse(bx + 7, by - 3, 14, 9);
        g.fillEllipse(bx - 5, by + 4, 10, 7);
        g.fillEllipse(bx + 5, by + 4, 10, 7);
        g.fillStyle(0x442200, 0.70); g.fillRect(bx - 1, by - 7, 2, 14);
        g.fillStyle(0xFFFFFF, 0.45); g.fillEllipse(bx - 6, by - 4, 5, 4);
      });

    } else if (habitat === 'aquatic') {
      // ── Vibrant Coral Kingdom ────────────────────────────────────────────
      // Deep layered ocean gradient
      g.fillGradientStyle(0x0BBDDE, 0x0BBDDE, 0x0688B8, 0x0688B8, 1);
      g.fillRect(0, 0, W, H * 0.25);
      g.fillGradientStyle(0x0688B8, 0x0688B8, 0x045090, 0x045090, 1);
      g.fillRect(0, H * 0.25, W, H * 0.25);
      g.fillGradientStyle(0x045090, 0x045090, 0x022860, 0x022860, 1);
      g.fillRect(0, H * 0.50, W, H * 0.22);

      // Ocean surface shimmer at very top
      g.fillStyle(0x88EEFF, 0.25); g.fillRect(0, 0, W, 12);
      g.fillStyle(0xAAFFFF, 0.18); g.fillRect(0, 0, W, 6);
      for (let si = 0; si < 16; si++) {
        const sx2 = si * 36 + (si % 3) * 8;
        g.fillStyle(0xCCFFFF, 0.30);
        g.fillEllipse(sx2, 5, 26 + (si % 3) * 10, 4);
      }

      // Light shafts from surface (bright caustic columns)
      for (let ci = 0; ci < 9; ci++) {
        const cx3 = 28 + ci * 58;
        const cAlpha = 0.06 + (ci % 3) * 0.03;
        g.fillStyle(0x88EEFF, cAlpha);
        g.fillTriangle(cx3 - 8, 0, cx3 + 8, 0, cx3 + 38, H * 0.68);
        g.fillStyle(0xAAFFFF, cAlpha * 0.5);
        g.fillTriangle(cx3 + 2, 0, cx3 + 14, 0, cx3 + 22, H * 0.50);
      }

      // Fish silhouettes in background
      ([[80, H*0.32, 1.0], [200, H*0.22, 0.8], [360, H*0.28, 1.2], [450, H*0.18, 0.7], [520, H*0.35, 0.9]] as [number,number,number][]).forEach(([fx, fy, fs]) => {
        g.fillStyle(0x0055AA, 0.30);
        g.fillEllipse(fx, fy, 28*fs, 14*fs);
        g.fillTriangle(fx - 14*fs, fy, fx - 22*fs, fy - 7*fs, fx - 22*fs, fy + 7*fs);
        g.fillStyle(0x2288CC, 0.20); g.fillEllipse(fx + 4*fs, fy - 2*fs, 10*fs, 7*fs);
      });

      // Background kelp forest silhouettes
      for (let ki = 0; ki < 6; ki++) {
        const kx = 22 + ki * 92, kBase = H * 0.72;
        g.lineStyle(5, 0x1A6B20, 0.60);
        g.beginPath(); g.moveTo(kx, kBase);
        g.lineTo(kx+16, kBase-65); g.lineTo(kx-10, kBase-130); g.lineTo(kx+14, kBase-195);
        g.strokePath();
        g.lineStyle(4, 0x2A8A28, 0.40);
        g.beginPath(); g.moveTo(kx+20, kBase-12);
        g.lineTo(kx+8, kBase-78); g.lineTo(kx+24, kBase-145);
        g.strokePath();
        // Kelp leaf tips
        g.fillStyle(0x44BB30, 0.55);
        [[kx, kBase-195],[kx-10, kBase-130],[kx+16, kBase-65]].forEach(([lx, ly]) => {
          g.fillEllipse(lx, ly, 22, 10);
        });
      }

      // 3D perspective sandy sea floor (golden sand)
      this._drawPerspectiveFloor(g, W, H, H * 0.72, 6, 8, 0xE8C878, 0xD4B060, 0xA07838, 0.32);

      // Sand ripple marks
      g.lineStyle(1.2, 0xF0D890, 0.35);
      for (let rr = 0; rr < 10; rr++) {
        const ry4 = H * 0.726 + rr * 14;
        g.beginPath();
        for (let rx4 = 0; rx4 <= W; rx4 += 3) {
          const sy4 = ry4 + Math.sin(rx4 * 0.065 + rr * 1.3) * 3;
          if (rx4 === 0) g.moveTo(rx4, sy4); else g.lineTo(rx4, sy4);
        }
        g.strokePath();
      }

      // Large branching coral formations
      ([[48, H*0.700, 0xFF5252], [180, H*0.690, 0xFF9800], [290, H*0.705, 0xFF3D8A], [420, H*0.695, 0x7C4DFF], [510, H*0.700, 0xFF5722]] as [number,number,number][]).forEach(([crx, cry, crc]) => {
        // Main trunk
        g.fillStyle(crc, 1);
        g.fillRect(crx - 5, cry, 10, 50);
        // Branches
        [[crx - 18, cry + 12, crx, cry + 6], [crx + 18, cry + 18, crx, cry + 10]].forEach(([bx2, by2, sx3, sy5]) => {
          g.fillRect(Math.min(bx2,sx3)-3, Math.min(by2,sy5), Math.abs(bx2-sx3)+6, Math.abs(by2-sy5)+5);
        });
        // Flower head clusters
        [[crx, cry], [crx-18, cry+12], [crx+18, cry+18]].forEach(([hx, hy]) => {
          g.fillStyle(crc, 1); g.fillCircle(hx, hy, 14);
          g.fillCircle(hx - 10, hy + 7, 10); g.fillCircle(hx + 10, hy + 9, 11);
          g.fillCircle(hx - 5, hy - 10, 8);
          g.fillStyle(lighten(crc, 45), 0.55); g.fillCircle(hx - 4, hy - 4, 6);
          // Polyp dots
          g.fillStyle(lighten(crc, 60), 0.80);
          for (let di = 0; di < 5; di++) {
            const da = (di / 5) * Math.PI * 2;
            g.fillCircle(hx + Math.cos(da)*8, hy + Math.sin(da)*8, 2.5);
          }
        });
      });

      // Sea anemones with tentacles
      ([[110, H*0.715, 0xFF6B9D], [350, H*0.718, 0xFFAA44], [490, H*0.712, 0x88CCFF]] as [number,number,number][]).forEach(([anx, any, anc]) => {
        g.fillStyle(anc, 0.25); g.fillCircle(anx, any + 5, 18);
        g.fillStyle(anc, 0.90); g.fillEllipse(anx, any + 8, 24, 14);
        g.fillStyle(lighten(anc, 30), 0.60); g.fillEllipse(anx - 4, any + 4, 10, 8);
        // Tentacles
        g.lineStyle(3, anc, 0.85);
        [[-14,-28],[-7,-32],[0,-34],[7,-32],[14,-28],[-10,-20],[10,-20]].forEach(([dx, dy]) => {
          g.beginPath(); g.moveTo(anx, any + 8); g.lineTo(anx + dx, any + 8 + dy); g.strokePath();
          g.fillStyle(lighten(anc, 50), 0.90); g.fillCircle(anx + dx, any + 8 + dy, 3);
        });
      });

      // Starfish on sea floor
      ([[88, H*0.748, 0xFF8800], [258, H*0.742, 0xFF5252], [465, H*0.750, 0xFFAA22]] as [number,number,number][]).forEach(([sfx, sfy, sfc]) => {
        g.fillStyle(sfc, 1);
        for (let arm = 0; arm < 5; arm++) {
          const a = (arm / 5) * Math.PI * 2 - Math.PI / 2;
          const a2 = ((arm + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
          g.fillTriangle(sfx + Math.cos(a)*14, sfy + Math.sin(a)*14, sfx + Math.cos(a2)*6, sfy + Math.sin(a2)*6, sfx + Math.cos(a2+0.63)*6, sfy + Math.sin(a2+0.63)*6);
        }
        g.fillStyle(lighten(sfc, 40), 0.60); g.fillCircle(sfx, sfy, 5);
        g.fillStyle(0xFFFFDD, 0.55); g.fillCircle(sfx - 1, sfy - 1, 3);
      });

      // Sunken ruin column
      const rcx = W * 0.78, rcy = H * 0.60;
      g.fillStyle(0x4A6080, 0.80); g.fillRect(rcx - 10, rcy, 20, H * 0.12);
      g.fillStyle(0x607090, 0.90); g.fillRect(rcx - 13, rcy - 8, 26, 12);
      g.fillStyle(0x708AA0, 0.60); g.fillRect(rcx - 13, rcy + H*0.12 - 2, 26, 10);
      g.lineStyle(1, 0x88AACC, 0.35);
      for (let cr2 = 0; cr2 < 5; cr2++) g.strokeRect(rcx - 10, rcy + cr2*16, 20, 16);
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

  // ── FOREGROUND FRAME ──────────────────────────────────────────────────────

  private _drawForeground(W: number, H: number, habitat: HabitatType) {
    const fg = this.add.graphics().setDepth(2);
    const gH = H * 0.72;

    if (habitat === 'dirt') {
      // Stalactite curtains at top corners
      ([[0,18,85],[18,14,62],[38,20,105],[60,15,74],[86,12,52]] as [number,number,number][]).forEach(([sx, sw, sh]) => {
        fg.fillStyle(0x160610, 1);
        fg.fillTriangle(sx - sw, 0, sx + sw, 0, sx, sh);
        fg.fillStyle(0x2E1208, 0.65);
        fg.fillTriangle(sx - sw*0.4, 0, sx + sw*0.3, 0, sx + sw*0.1, sh * 0.55);
        fg.fillStyle(0xFF9900, 0.22); fg.fillCircle(sx, sh - 8, 7);
        fg.fillStyle(0xFFBB44, 0.12); fg.fillCircle(sx, sh - 8, 15);
      });
      ([[W,18,80],[W-20,14,65],[W-40,20,100],[W-62,15,78],[W-88,12,56]] as [number,number,number][]).forEach(([sx, sw, sh]) => {
        fg.fillStyle(0x160610, 1);
        fg.fillTriangle(sx - sw, 0, sx + sw, 0, sx, sh);
        fg.fillStyle(0xFF9900, 0.20); fg.fillCircle(sx, sh - 8, 7);
      });
      // Crystal formations at left/right edges
      ([[16, gH*0.32, 0xFFAA00], [28, gH*0.52, 0xFF8800], [12, gH*0.69, 0xFFCC22]] as [number,number,number][]).forEach(([cx, cy, cc]) => {
        fg.fillStyle(cc, 0.12); fg.fillCircle(cx, cy, 24);
        fg.fillStyle(cc, 0.26); fg.fillCircle(cx, cy, 14);
        fg.fillStyle(cc, 0.95); fg.fillCircle(cx, cy, 7);
        fg.fillStyle(cc, 0.90);
        fg.fillTriangle(cx - 5, cy, cx + 5, cy, cx, cy - 22);
        fg.fillTriangle(cx - 9, cy + 3, cx - 1, cy + 3, cx - 5, cy - 14);
        fg.fillStyle(0xFFFFCC, 0.80); fg.fillCircle(cx - 1, cy - 2, 2.5);
      });
      ([[W - 16, gH*0.34, 0xFFCC00], [W - 26, gH*0.54, 0xFF9900], [W - 14, gH*0.69, 0xFFAA00]] as [number,number,number][]).forEach(([cx, cy, cc]) => {
        fg.fillStyle(cc, 0.12); fg.fillCircle(cx, cy, 24);
        fg.fillStyle(cc, 0.26); fg.fillCircle(cx, cy, 14);
        fg.fillStyle(cc, 0.95); fg.fillCircle(cx, cy, 7);
        fg.fillStyle(cc, 0.90);
        fg.fillTriangle(cx - 5, cy, cx + 5, cy, cx, cy - 22);
        fg.fillStyle(0xFFFFCC, 0.80); fg.fillCircle(cx + 1, cy - 2, 2.5);
      });
      // Amber edge glow
      fg.fillGradientStyle(0xFF8800, 0xFF8800, 0xFF8800, 0xFF8800, 0.09, 0, 0, 0.09);
      fg.fillRect(0, 0, 65, gH);
      fg.fillGradientStyle(0xFF8800, 0xFF8800, 0xFF8800, 0xFF8800, 0, 0.09, 0.09, 0);
      fg.fillRect(W - 65, 0, 65, gH);

    } else if (habitat === 'grass') {
      // Hanging flower garland from top
      const garlandCols = [0xFF5252, 0xFF9800, 0xE91E63, 0xFFEB3B, 0x9C27B0, 0x4CAF50, 0x03A9F4, 0xFF6EC7];
      for (let gx = 0; gx <= W; gx += 42) {
        const glen = 28 + Math.sin(gx * 0.048) * 20;
        fg.lineStyle(2, 0x2D6A1A, 0.62);
        fg.beginPath(); fg.moveTo(gx, 0); fg.lineTo(gx + Math.sin(gx * 0.10) * 7, glen); fg.strokePath();
        const gc = garlandCols[Math.floor(gx / 42) % garlandCols.length];
        fg.fillStyle(gc, 0.88); fg.fillCircle(gx + Math.sin(gx * 0.10) * 7, glen, 5 + Math.abs(Math.sin(gx * 0.14)) * 3);
        fg.fillStyle(0xFFF9C4, 0.90); fg.fillCircle(gx + Math.sin(gx * 0.10) * 7, glen, 2);
      }
      // Left side vine column with flowers
      for (let vy = 18; vy < gH; vy += 28) {
        const vx = Math.sin(vy * 0.07) * 14 + 16;
        fg.fillStyle(0x2D7A1A, 0.78); fg.fillEllipse(vx, vy, 20, 13);
        fg.fillStyle(0x44AA2A, 0.48); fg.fillEllipse(vx + 6, vy + 8, 15, 9);
      }
      ([[20, gH*0.24, 0xFF5252], [14, gH*0.40, 0xFF9800], [26, gH*0.55, 0xE91E63], [16, gH*0.68, 0xFFEB3B]] as [number,number,number][]).forEach(([fx, fy, fc]) => {
        fg.fillStyle(fc, 0.17); fg.fillCircle(fx, fy, 20);
        for (let pi = 0; pi < 5; pi++) { const pa = (pi/5)*Math.PI*2; fg.fillStyle(fc, 1); fg.fillCircle(fx+Math.cos(pa)*7, fy+Math.sin(pa)*7, 5.5); }
        fg.fillStyle(0xFFF9C4, 1); fg.fillCircle(fx, fy, 3);
      });
      // Right side vine column with flowers
      for (let vy = 18; vy < gH; vy += 28) {
        const vx = W - Math.sin(vy * 0.07 + 1) * 14 - 16;
        fg.fillStyle(0x2D7A1A, 0.78); fg.fillEllipse(vx, vy, 20, 13);
        fg.fillStyle(0x44AA2A, 0.48); fg.fillEllipse(vx - 6, vy + 8, 15, 9);
      }
      ([[W-20, gH*0.26, 0x9C27B0], [W-14, gH*0.42, 0x03A9F4], [W-26, gH*0.57, 0xAED581], [W-16, gH*0.68, 0xFF6EC7]] as [number,number,number][]).forEach(([fx, fy, fc]) => {
        fg.fillStyle(fc, 0.17); fg.fillCircle(fx, fy, 20);
        for (let pi = 0; pi < 5; pi++) { const pa = (pi/5)*Math.PI*2; fg.fillStyle(fc, 1); fg.fillCircle(fx+Math.cos(pa)*7, fy+Math.sin(pa)*7, 5.5); }
        fg.fillStyle(0xFFF9C4, 1); fg.fillCircle(fx, fy, 3);
      });

    } else { // aquatic
      // Left coral column
      ([[10, gH*0.32, 0xFF5252, 18], [26, gH*0.50, 0xFF9800, 14], [8, gH*0.64, 0x7C4DFF, 20], [24, gH*0.70, 0xFF3D8A, 12]] as [number,number,number,number][]).forEach(([cx, cy, cc, cr]) => {
        fg.fillStyle(cc, 0.13); fg.fillCircle(cx, cy, cr + 14);
        fg.fillStyle(cc, 0.34); fg.fillCircle(cx, cy, cr + 5);
        fg.fillStyle(cc, 1); fg.fillCircle(cx, cy, cr);
        fg.fillStyle(lighten(cc, 45), 0.55); fg.fillCircle(cx - 4, cy - 4, cr * 0.40);
        fg.fillStyle(cc, 0.65); fg.fillRect(cx - 4, cy, 8, 32);
      });
      for (let si = 0; si < 4; si++) {
        const sx = si * 13 + 4, sBase = gH;
        fg.lineStyle(5 - si, 0x1A6B20, 0.70);
        fg.beginPath(); fg.moveTo(sx, sBase); fg.lineTo(sx + 12, sBase - 54); fg.lineTo(sx - 8, sBase - 112); fg.lineTo(sx + 10, sBase - 168); fg.strokePath();
        fg.fillStyle(0x44BB30, 0.65); fg.fillEllipse(sx + 10, sBase - 168, 18, 8); fg.fillEllipse(sx - 8, sBase - 112, 16, 7);
      }
      // Right coral column
      ([[W-10, gH*0.34, 0xFF6B9D, 18], [W-24, gH*0.52, 0xFFAA44, 14], [W-8, gH*0.62, 0x88CCFF, 20], [W-22, gH*0.70, 0xFF5252, 12]] as [number,number,number,number][]).forEach(([cx, cy, cc, cr]) => {
        fg.fillStyle(cc, 0.13); fg.fillCircle(cx, cy, cr + 14);
        fg.fillStyle(cc, 0.34); fg.fillCircle(cx, cy, cr + 5);
        fg.fillStyle(cc, 1); fg.fillCircle(cx, cy, cr);
        fg.fillStyle(lighten(cc, 45), 0.55); fg.fillCircle(cx + 4, cy - 4, cr * 0.40);
        fg.fillStyle(cc, 0.65); fg.fillRect(cx - 4, cy, 8, 32);
      });
      for (let si = 0; si < 4; si++) {
        const sx = W - (si * 13 + 4), sBase = gH;
        fg.lineStyle(5 - si, 0x1A6B20, 0.70);
        fg.beginPath(); fg.moveTo(sx, sBase); fg.lineTo(sx - 12, sBase - 54); fg.lineTo(sx + 8, sBase - 112); fg.lineTo(sx - 10, sBase - 168); fg.strokePath();
        fg.fillStyle(0x44BB30, 0.65); fg.fillEllipse(sx - 10, sBase - 168, 18, 8);
      }
      // Water surface shimmer band at top
      fg.fillGradientStyle(0x44EEFF, 0x44EEFF, 0x44EEFF, 0x44EEFF, 0.22, 0.22, 0, 0);
      fg.fillRect(0, 0, W, 9);
      fg.fillStyle(0x88FFFF, 0.18); fg.fillRect(0, 0, W, 4);
    }
  }

  // ── MONSTER AREA ──────────────────────────────────────────────────────────

  private _buildMonsterArea(W: number, H: number, sp: Species) {
    const groundY = H * 0.70, monY = groundY - 78;
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

    this._bobTween = this.tweens.add({
      targets: this._monImg, y: monY - 9, duration: 950,
      ease: 'Sine.InOut', yoyo: true, repeat: -1,
      onUpdate: () => { this._updateDirtyOverlay(); this._updateHappyGlow(); if (this._platformG) this._platformG.x = this._monImg.x; },
      onRepeat: () => {
        const sx = this._monImg.scaleX, sy = this._monImg.scaleY;
        this.tweens.add({
          targets: this._monImg,
          scaleX: sx * 1.06, scaleY: sy * 0.94,
          duration: 70, ease: 'Quad.Out', yoyo: true,
        });
      },
    });

    const bs = this._monImg.scaleX;
    this.tweens.add({
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
    this._bowlY = H * 0.704;
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
    const statsY = H * 0.72 + 18;
    const defs = [
      { key: 'hunger',      label: '🍖', col: 0xF57C00 },
      { key: 'happiness',   label: '❤️', col: 0xFDD835 },
      { key: 'cleanliness', label: '💧', col: 0x42A5F5 },
    ];
    const barW = W - 92;
    this._bars = {};

    defs.forEach((d, i) => {
      const by = statsY + i * 44;

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

    this._refreshStats();
  }

  private _refreshStats() {
    const m = this._monster as any;
    (['hunger', 'happiness', 'cleanliness'] as const).forEach(k => {
      const e = this._bars[k];
      if (!e) return;
      const pct = Math.max(0, Math.min(1, m[k] / 100));
      const fillW = Math.max(16, e.bw * pct);
      e.fill.clear();
      // Main fill
      e.fill.fillStyle(e.col, 1);
      e.fill.fillRoundedRect(e.bx, e.by, fillW, 20, 10);
      // Shine highlight strip on top half of bar
      e.fill.fillStyle(0xffffff, 0.22);
      e.fill.fillRoundedRect(e.bx + 2, e.by + 1, Math.max(10, fillW - 4), 8, { tl: 8, tr: 8, bl: 0, br: 0 });
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

  private _updateHappyGlow() {
    if (this._monster.happiness > 70) {
      if (!this._happyGlow) {
        this._happyGlow = this.add.graphics().setDepth(4);
        this.tweens.add({
          targets: this._happyGlow,
          alpha: { from: 0.50, to: 0.10 },
          duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut',
        });
      }
      const col = [0xFF66AA, 0xFFCC22, 0x44CCFF, 0xCC66FF, 0xFF8833][this._monster.speciesId % 5];
      this._happyGlow.clear();
      this._happyGlow.lineStyle(7, col, 1.0);
      this._happyGlow.strokeCircle(this._monImg.x, this._monImg.y - 10, 64);
      this._happyGlow.lineStyle(3, col, 0.50);
      this._happyGlow.strokeCircle(this._monImg.x, this._monImg.y - 10, 80);
    } else if (this._happyGlow) {
      this._happyGlow.destroy();
      this._happyGlow = null;
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

    this._coinTxt = this.add.text(W / 2, H * 0.72 + 5, '💰 ' + Game.state!.coins, {
      fontFamily: FONT, fontSize: '17px', color: '#FFD700',
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
        sg.setPosition(cx + (Math.random() - 0.5) * 14, H * 0.70 - 18 + (Math.random() - 0.5) * 12);
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
      bg.x = bx; bg.y = H * 0.70;
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
