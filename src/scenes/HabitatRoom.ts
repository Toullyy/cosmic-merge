import Phaser from 'phaser';
import { Game, FONT, store, sfx } from '../utils';
import { SPECIES, HABITATS, FOOD_TYPES, TOY_TYPES, CLEAN_TOOLS, XP_TABLE, LISTING_DURATION_MS } from '../data';
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
    return Math.max(10, Math.round(sp.price * (1 + m.level * 0.2) * (m.happiness / 100) * 0.8));
  }

  // ── BACKGROUND ────────────────────────────────────────────────────────────

  private _drawBackground(W: number, H: number, habitat: HabitatType) {
    const g = this.add.graphics().setDepth(0);

    if (habitat === 'dirt') {
      g.fillGradientStyle(0x3D1200, 0x3D1200, 0x180600, 0x180600, 1);
      g.fillRect(0, 0, W, H);
      const stalData = [[70,58],[160,44],[265,72],[370,52],[470,66]];
      stalData.forEach((s, i) => {
        const col = [0x5A3015, 0x4A2810, 0x6A3A1A][i % 3];
        g.fillStyle(col, 1);
        g.fillTriangle(s[0] - s[1]/2, 0, s[0] + s[1]/2, 0, s[0], s[1] * 1.6);
        g.fillStyle(lighten(col, 15), 0.3);
        g.fillTriangle(s[0] - s[1]/4, 0, s[0], s[1] * 0.5, s[0] + s[1]/4, 0);
      });
      g.fillStyle(0x2C1A0A, 1); g.fillRect(0, H * 0.70, W, H * 0.30);
      g.fillStyle(0x5D3510, 1); g.fillRect(0, H * 0.70, W, 7);
      g.fillStyle(0x3D2008, 1); g.fillRect(0, H * 0.703, W, 4);
      const rocks = [[55,H*0.76,48,28],[165,H*0.74,38,22],[310,H*0.77,56,30],[430,H*0.75,42,26],[495,H*0.79,34,20]];
      rocks.forEach((r, i) => {
        const rc = [0x4A2E10, 0x3D2408, 0x5E3C18][i % 3];
        g.fillStyle(rc, 1); g.fillEllipse(r[0], r[1], r[2], r[3]);
        g.fillStyle(lighten(rc, 18), 0.3); g.fillEllipse(r[0] - r[2]*0.12, r[1] - r[3]*0.25, r[2]*0.55, r[3]*0.45);
      });
      const crystals = [[28,240,0xFFD700],[108,390,0xFF8C00],[195,510,0xFF4500],[355,290,0xFFD700],[440,440,0xE0C060],[500,180,0xFF8C00]];
      crystals.forEach(c => {
        g.fillStyle(c[2], 0.75); g.fillCircle(c[0], c[1], 4.5);
        g.fillStyle(c[2], 0.18); g.fillCircle(c[0], c[1], 11);
        g.fillStyle(0xffffff, 0.4); g.fillCircle(c[0] - 1.5, c[1] - 1.5, 1.5);
      });

    } else if (habitat === 'grass') {
      g.fillGradientStyle(0x082800, 0x082800, 0x194D1E, 0x194D1E, 1);
      g.fillRect(0, 0, W, H * 0.5);
      g.fillGradientStyle(0x194D1E, 0x194D1E, 0x2A7030, 0x2A7030, 1);
      g.fillRect(0, H * 0.5, W, H * 0.5);
      const farTrees = [[38,H*0.54,58],[155,H*0.50,68],[318,H*0.52,63],[435,H*0.53,55],[515,H*0.55,48]];
      farTrees.forEach(t => {
        g.fillStyle(0x0C3810, 1);
        g.fillRect(t[0] - 5, t[1] + 10, 10, H - t[1]);
        g.fillStyle(0x0C3810, 0.85);
        g.fillCircle(t[0], t[1], t[2] * 0.48);
        g.fillCircle(t[0] - t[2]*0.26, t[1] + t[2]*0.26, t[2]*0.38);
        g.fillCircle(t[0] + t[2]*0.22, t[1] + t[2]*0.18, t[2]*0.36);
      });
      g.fillStyle(0x2A7030, 1); g.fillRect(0, H * 0.70, W, H * 0.30);
      g.fillStyle(0x3D9045, 1); g.fillRect(0, H * 0.70, W, 8);
      g.fillStyle(0x4CAF50, 0.4); g.fillRect(0, H * 0.703, W, 4);
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

    } else { // aquatic
      g.fillGradientStyle(0x00537A, 0x00537A, 0x001833, 0x001833, 1);
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

    this._walkTween = this.tweens.add({
      targets: this._monImg, x: rightX, duration: 3200, ease: 'Sine.InOut',
      yoyo: true, repeat: -1,
      onYoyo: () => { this._monImg.setFlipX(true); },
      onRepeat: () => { this._monImg.setFlipX(false); },
    });

    this.tweens.add({
      targets: this._monImg, y: monY - 9, duration: 950,
      ease: 'Sine.InOut', yoyo: true, repeat: -1,
    });

    this._monY = monY;
  }

  // ── STATS BARS ────────────────────────────────────────────────────────────

  private _buildStats(W: number, H: number) {
    const statsY = H * 0.72 + 18;
    const defs = [
      { key: 'hunger',      label: '🍖', col: 0xF57C00 },
      { key: 'happiness',   label: '💛', col: 0xFDD835 },
      { key: 'cleanliness', label: '✨', col: 0x42A5F5 },
    ];
    const barW = W - 100;
    this._bars = {};

    defs.forEach((d, i) => {
      const by = statsY + i * 46;
      this.add.text(28, by, d.label, { fontFamily: FONT, fontSize: '20px' }).setOrigin(0, 0.5).setDepth(10);
      const bg = this.add.graphics().setDepth(10);
      bg.fillStyle(0x00000066, 1);
      bg.fillRoundedRect(58, by - 10, barW, 20, 10);
      const fill = this.add.graphics().setDepth(11);
      const val = this.add.text(W - 26, by, '0', {
        fontFamily: FONT, fontSize: '13px', color: '#cccccc',
      }).setOrigin(1, 0.5).setDepth(12);
      this._bars[d.key] = { fill, col: d.col, bx: 58, by: by - 10, bw: barW, val };
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
      e.val.setText(String(Math.round(m[k])));
    });
  }

  // ── ACTION BUTTONS ────────────────────────────────────────────────────────

  private _buildActions(W: number, H: number) {
    const btnY = H - 58, sp = 148;
    makeButton(this, W/2 - sp, btnY, 128, 52, '🍽 Feed',  0x8B2200, () => this._showFoodPicker(), 16).setDepth(10);
    makeButton(this, W/2,      btnY, 128, 52, '🎾 Play',  0x6A2090, () => this._showToyPicker(), 16).setDepth(10);
    makeButton(this, W/2 + sp, btnY, 128, 52, '🧹 Clean', 0x1A5580, () => this._showToolPicker(), 16).setDepth(10);
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  private _buildHUD(W: number, H: number, sp: Species) {
    const mods = getVariantModifiers(this._monster.variantIndex);
    makeButton(this, 56, 34, 92, 44, '← Back', 0x1a0a2e, () => { this.scene.start('Hub'); }, 15).setDepth(20);
    this.add.text(W / 2, 24, sp.name + (mods.isGolden ? ' ★' : ''), {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold',
      color: mods.isGolden ? '#FFD700' : '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20);
    this.add.text(W / 2, 50, 'Lv ' + this._monster.level + '  ·  ' +
      sp.habitat.charAt(0).toUpperCase() + sp.habitat.slice(1), {
      fontFamily: FONT, fontSize: '13px', color: '#9999bb',
    }).setOrigin(0.5).setDepth(20);
    this._sellBtn = makeButton(this, W - 72, 34, 116, 44,
      'List ' + this._sellPrice + '⬡', 0x8B6000, () => this._handleListBtn(), 13);
    this._sellBtn.setDepth(20);
    this._coinTxt = this.add.text(W / 2, H * 0.72 + 5, '⬡ ' + Game.state!.coins, {
      fontFamily: FONT, fontSize: '15px', color: '#FFD700',
    }).setOrigin(0.5).setDepth(20);
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
      fontFamily: FONT, fontSize: '12px', color: '#8888cc',
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
      const lbl = food.name + ' ' + stars + '\n+' + food.hungerGain + '🍖 +' + food.happinessGain + '💛\n' + food.cost + '⬡';
      const tierColors = [0x2A4A18, 0x2A4A28, 0x3A3010];
      const fbtn = makeButton(this, bx, by, btnW - 2, btnH, lbl,
        canAfford ? tierColors[food.tier - 1] : 0x1A1A2A, () => {
          if (Game.state!.coins < food.cost) { showToast(this, 'Not enough coins!', '#ff9999'); return; }
          Game.state!.coins -= food.cost;
          this._monster.hunger    = Math.min(100, this._monster.hunger    + food.hungerGain);
          this._monster.happiness = Math.min(100, this._monster.happiness + food.happinessGain);
          this._monster.lastCaredAt = Date.now();
          this._gainXP(10 + food.tier * 3);
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

  // ── TOY PICKER (3 items, 1 row) ───────────────────────────────────────────

  private _showToyPicker() {
    if (this._pickerItems.length > 0) { this._clearPicker(); return; }
    const W = this._W, H = this._H;
    const fpW = W - 30, fpH = 120, fpX = 15;
    const fpY = H - 210; // bottom = H-90

    const fpBg = this.add.graphics().setDepth(28);
    fpBg.fillStyle(0x0a0416, 0.96);
    fpBg.fillRoundedRect(fpX, fpY, fpW, fpH, 14);
    fpBg.lineStyle(1, 0x7030b0, 0.9);
    fpBg.strokeRoundedRect(fpX, fpY, fpW, fpH, 14);
    this._pickerItems.push(fpBg);

    this._pickerItems.push(this.add.text(fpX + fpW/2, fpY + 13, '🎾 Choose toy', {
      fontFamily: FONT, fontSize: '12px', color: '#aa88cc',
    }).setOrigin(0.5).setDepth(28));

    const btnW = Math.floor((fpW - 24) / 3);
    const btnH = 82;

    TOY_TYPES.forEach((toy, i) => {
      const bx = fpX + 12 + i * (btnW + 4) + btnW / 2;
      const by = fpY + 27 + btnH / 2;
      const canAfford = Game.state!.coins >= toy.cost;
      const stars = '★'.repeat(toy.tier);
      const lbl = toy.name + ' ' + stars + '\n+' + toy.happinessGain + '💛\n' + toy.cost + '⬡';
      const fbtn = makeButton(this, bx, by, btnW - 2, btnH, lbl,
        canAfford ? 0x2A1560 : 0x1A1A2A, () => {
          if (Game.state!.coins < toy.cost) { showToast(this, 'Not enough coins!', '#ff9999'); return; }
          Game.state!.coins -= toy.cost;
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

  // ── TOOL PICKER (3 items, 1 row) ──────────────────────────────────────────

  private _showToolPicker() {
    if (this._pickerItems.length > 0) { this._clearPicker(); return; }
    const W = this._W, H = this._H;
    const fpW = W - 30, fpH = 120, fpX = 15;
    const fpY = H - 210;

    const fpBg = this.add.graphics().setDepth(28);
    fpBg.fillStyle(0x0a0416, 0.96);
    fpBg.fillRoundedRect(fpX, fpY, fpW, fpH, 14);
    fpBg.lineStyle(1, 0x1060b0, 0.9);
    fpBg.strokeRoundedRect(fpX, fpY, fpW, fpH, 14);
    this._pickerItems.push(fpBg);

    this._pickerItems.push(this.add.text(fpX + fpW/2, fpY + 13, '🧹 Choose tool', {
      fontFamily: FONT, fontSize: '12px', color: '#88aacc',
    }).setOrigin(0.5).setDepth(28));

    const btnW = Math.floor((fpW - 24) / 3);
    const btnH = 82;

    CLEAN_TOOLS.forEach((tool, i) => {
      const bx = fpX + 12 + i * (btnW + 4) + btnW / 2;
      const by = fpY + 27 + btnH / 2;
      const canAfford = Game.state!.coins >= tool.cost;
      const stars = '★'.repeat(tool.tier);
      const lbl = tool.name + ' ' + stars + '\n+' + tool.cleanGain + '✨\n' + tool.cost + '⬡';
      const fbtn = makeButton(this, bx, by, btnW - 2, btnH, lbl,
        canAfford ? 0x10405A : 0x1A1A2A, () => {
          if (Game.state!.coins < tool.cost) { showToast(this, 'Not enough coins!', '#ff9999'); return; }
          Game.state!.coins -= tool.cost;
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

  private _clearPicker() {
    this._pickerItems.forEach(o => { try { (o as any).destroy(); } catch { /* ignore */ } });
    this._pickerItems = [];
  }

  // ── ANIMATIONS ────────────────────────────────────────────────────────────

  private _playFeedAnim(foodId: string, tier: number) {
    const mx = this._monImg.x, my = this._monImg.y;
    const color = FOOD_COLORS[foodId] ?? 0xFFB300;
    const r = 8 + tier * 3;

    const foodG = this.add.graphics().setDepth(30);
    foodG.fillStyle(color, 1);
    foodG.fillCircle(0, 0, r);
    foodG.fillStyle(0xffffff, 0.45);
    foodG.fillCircle(-r * 0.35, -r * 0.35, r * 0.36);
    foodG.x = mx;
    foodG.y = my - 75;

    if (tier === 3) this._spawnParticles(mx, my - 75, color, 6);

    this.tweens.add({
      targets: foodG,
      y: my - 8,
      duration: 340,
      ease: 'Quad.In',
      onComplete: () => {
        foodG.destroy();
        this.tweens.add({
          targets: this._monImg,
          scaleX: 1.22, scaleY: 0.82,
          duration: 55, yoyo: true, repeat: 1,
          onComplete: () => this._monImg.setScale(1),
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
    if (!listing) { this._doList(); return; }
    if (Date.now() >= listing.readyAt) {
      this._doCollect(listing);
    } else {
      this._showCancelListing(listing);
    }
  }

  private _doList() {
    const listing: Listing = {
      id: 'lst_' + Date.now(),
      monsterId: this._monster.id,
      price: this._sellPrice,
      listedAt: Date.now(),
      readyAt: Date.now() + LISTING_DURATION_MS,
    };
    Game.state!.listings.push(listing);
    store.setJSON('mps_state', Game.state);
    this.tweens.killTweensOf(this._sellBtn);
    this._sellBtn.setScale(1);
    this._updateListBtnState();
    this._startListTimer();
    showToast(this, 'Listed! Collect in 15 min', '#aaffaa');
  }

  private _doCollect(listing: Listing) {
    const basePrice = listing.price;
    const W = this._W, H = this._H;

    const popup = this.add.container(0, 0).setDepth(50);
    const popBg = this.add.graphics();
    popBg.fillStyle(0, 0.72); popBg.fillRect(0, 0, W, H);
    popup.add(popBg);

    const panel = this.add.graphics();
    panel.fillStyle(0x061A10, 1);
    panel.fillRoundedRect(W/2 - 155, H/2 - 130, 310, 275, 18);
    panel.lineStyle(2, 0x40B070, 0.85);
    panel.strokeRoundedRect(W/2 - 155, H/2 - 130, 310, 275, 18);
    popup.add(panel);

    popup.add(this.add.text(W/2, H/2 - 96, 'Ready to Collect!', {
      fontFamily: FONT, fontSize: '21px', fontStyle: 'bold', color: '#66FF99',
    }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 62, this._sp.name + ' sold for ' + basePrice + '⬡', {
      fontFamily: FONT, fontSize: '14px', color: '#aaccaa',
    }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 40, 'Or watch an ad to double it!', {
      fontFamily: FONT, fontSize: '12px', color: '#FFD700',
    }).setOrigin(0.5));

    const finalize = (price: number) => {
      popup.destroy();
      Game.state!.coins += price;
      Game.state!.monsters = Game.state!.monsters.filter(m => m.id !== this._monster.id);
      Game.state!.listings = Game.state!.listings.filter(l => l.id !== listing.id);
      Game.state!.stats.sold++;
      Game.state!.stats.totalEarned += price;
      store.setJSON('mps_state', Game.state);
      sfx.sell();
      this._spawnParticles(W/2, H/2 - 80, 0xFFD700, 26);
      showFloat(this, W/2, H/2 - 120, '+' + price + ' ⬡', '#ffd700');
      this.time.delayedCall(950, () => this.scene.start('Hub'));
    };

    popup.add(makeButton(this, W/2, H/2 + 10, 210, 50, 'Collect ' + basePrice + '⬡', 0x1A5030, () => {
      finalize(basePrice);
    }, 15));
    popup.add(makeButton(this, W/2, H/2 + 72, 270, 50, 'Ad x2 → ' + (basePrice * 2) + '⬡', 0x7A4A00, () => {
      Ads.showRewarded(res => { finalize(res.rewarded ? basePrice * 2 : basePrice); });
    }, 14));
    popup.add(makeButton(this, W/2, H/2 + 128, 120, 38, 'Cancel', 0x2a1560, () => {
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

    popup.add(this.add.text(W/2, H/2 - 68, 'Listed for ' + listing.price + '⬡', {
      fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 40, 'Ready in ~' + mins + ' min', {
      fontFamily: FONT, fontSize: '14px', color: '#9999cc',
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
    popup.add(makeButton(this, W/2, H/2 + 70, 140, 38, 'Keep Listed', 0x2a1560, () => {
      popup.destroy();
    }, 14));
  }

  private _updateListBtnState() {
    const listing = Game.state!.listings.find(l => l.monsterId === this._monster.id);
    if (!listing) {
      setButtonLabel(this._sellBtn, 'List ' + this._sellPrice + '⬡');
      setButtonColor(this._sellBtn, 0x8B6000);
      return;
    }
    const remaining = listing.readyAt - Date.now();
    if (remaining <= 0) {
      setButtonLabel(this._sellBtn, 'Collect ' + listing.price + '⬡');
      setButtonColor(this._sellBtn, 0x1A7040);
      if (!this.tweens.isTweening(this._sellBtn)) {
        this.tweens.add({
          targets: this._sellBtn, scaleX: 1.07, scaleY: 1.07,
          duration: 550, yoyo: true, repeat: -1,
        });
      }
    } else {
      const mins = Math.ceil(remaining / 60000);
      setButtonLabel(this._sellBtn, 'Listed ' + mins + 'm');
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
    if (this._coinTxt) this._coinTxt.setText('⬡ ' + Game.state!.coins);
  }
}
