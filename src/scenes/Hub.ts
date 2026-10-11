import Phaser from 'phaser';
import { Game, FONT, store, sfx } from '../utils';
import { SPECIES, HABITATS, TANK_COST, TANK_CAPACITY, MAX_TANKS, getLevelName, AD_COINS_REWARD, AD_COOLDOWN_MS } from '../data';
import { makeMonsterTexture, getVariantModifiers, shiftHue, darken, lighten } from '../MonsterRenderer';
import { makeButton, setButtonLabel } from '../ui/Button';
import { showToast } from '../ui/Toast';
import { Ads } from '../ads';
import type { Monster, Egg, HabitatType } from '../types';

export class Hub extends Phaser.Scene {
  private _currentHabitat: HabitatType = 'dirt';
  private _eggTimer: Phaser.Time.TimerEvent | null = null;
  private _displayGroup!: Phaser.GameObjects.Group;
  private _tabBtns: Record<string, { bg: Phaser.GameObjects.Graphics; txt: Phaser.GameObjects.Text }> = {};
  private _coinTxt!: Phaser.GameObjects.Text;
  private _bgGraphics!: Phaser.GameObjects.Graphics;
  private _bobTweens: Phaser.Tweens.Tween[] = [];
  private _dexBtn!: Phaser.GameObjects.Container;
  private _dexDot!: Phaser.GameObjects.Graphics;
  private _dexDotTxt!: Phaser.GameObjects.Text;
  private _diamondTxt!: Phaser.GameObjects.Text;
  private _adBtn!: Phaser.GameObjects.Container;

  constructor() { super({ key: 'Hub' }); }

  create() {
    sfx.unlock();
    const W = this.scale.width, H = this.scale.height;
    this._displayGroup = this.add.group();

    this._buildBackground(W, H);
    this._buildVignette(W, H);
    this._buildHUD(W);
    this._buildTabs(W);
    this._buildBottomNav(W, H);
    this._bgGraphics = this.add.graphics().setDepth(1);
    this._buildHabitatBg(W, H);
    this.refreshAll();
    this._startEggTimer();

    const boot = document.getElementById('boot');
    if (boot) boot.style.display = 'none';
  }

  private _buildBackground(W: number, H: number) {
    const bg = this.add.graphics().setDepth(0);
    // Warm wood-panel shop wall — bright honey tones
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
    // Wooden floor at bottom
    bg.fillStyle(0xA06828, 1);
    bg.fillRect(0, H * 0.84, W, H * 0.16);
    bg.lineStyle(2, 0x7A4E18, 0.55);
    for (let fx = 20; fx < W; fx += 76) {
      bg.beginPath(); bg.moveTo(fx, H * 0.84); bg.lineTo(fx, H); bg.strokePath();
    }
    bg.lineStyle(2, 0x7A4E18, 0.45);
    bg.beginPath(); bg.moveTo(0, H * 0.84); bg.lineTo(W, H * 0.84); bg.strokePath();
    // Shelf ledge under HUD
    bg.fillStyle(0xD4A050, 0.7);
    bg.fillRect(0, 68, W, 6);
    bg.fillStyle(0x8A5018, 0.3);
    bg.fillRect(0, 74, W, 2);
  }

  private _buildVignette(W: number, H: number) {
    const v = this.add.graphics().setDepth(2);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.12, 0.12, 0, 0);
    v.fillRect(0, 0, W, H * 0.14);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.08, 0, 0, 0.08);
    v.fillRect(0, 0, W * 0.10, H);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.08, 0.08, 0);
    v.fillRect(W * 0.90, 0, W * 0.10, H);
  }

  private _buildHabitatBg(W: number, H: number) {
    const g = this._bgGraphics;
    g.clear();
    g.fillStyle(0x1E0C04, 0.20);
    g.fillRoundedRect(6, 128, W - 12, H - 230, 12);
    g.lineStyle(1.5, 0x6B4A2A, 0.30);
    g.strokeRoundedRect(6, 128, W - 12, H - 230, 12);
  }

  private _buildHUD(W: number) {
    const hud = this.add.graphics().setDepth(10);

    // Coin box
    hud.fillStyle(0x000000, 0.93);
    hud.fillRoundedRect(8, 8, 168, 52, 14);
    hud.lineStyle(2, 0xFFD700, 0.72);
    hud.strokeRoundedRect(8, 8, 168, 52, 14);
    hud.lineStyle(4, 0xFFD700, 0.10);
    hud.strokeRoundedRect(5, 5, 174, 58, 17);

    // Diamond box
    hud.fillStyle(0x000000, 0.93);
    hud.fillRoundedRect(182, 8, 120, 52, 14);
    hud.lineStyle(2, 0x55EEFF, 0.72);
    hud.strokeRoundedRect(182, 8, 120, 52, 14);
    hud.lineStyle(4, 0x55EEFF, 0.10);
    hud.strokeRoundedRect(179, 5, 126, 58, 17);

    this.add.text(26, 34, '⬡', {
      fontFamily: FONT, fontSize: '26px', color: '#FFD700',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(11);

    this._coinTxt = this.add.text(52, 34, String(Game.state!.coins), {
      fontFamily: FONT, fontSize: '21px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(11);

    this.add.text(192, 34, '💎', {
      fontFamily: FONT, fontSize: '20px',
    }).setOrigin(0, 0.5).setDepth(11);

    this._diamondTxt = this.add.text(218, 34, String(Game.state!.diamonds ?? 0), {
      fontFamily: FONT, fontSize: '21px', color: '#88EEFF', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(11);

    // Free-coins ad button (sits between diamond box and sound icon)
    this._adBtn = makeButton(this, 370, 34, 108, 40, this._adBtnLabel(), 0x1A3A10, () => {
      this._handleAdCoins();
    }, 12).setDepth(11);
    this.time.addEvent({
      delay: 1000, loop: true,
      callback: () => { if (this._adBtn) setButtonLabel(this._adBtn, this._adBtnLabel()); },
    });

    const sndTxt = this.add.text(W - 50, 34, sfx.muted ? '🔇' : '🔊', {
      fontFamily: FONT, fontSize: '22px', color: '#cccccc',
    }).setOrigin(0.5, 0.5).setDepth(11).setInteractive({ useHandCursor: true });
    sndTxt.on('pointerdown', () => { sfx.toggle(); sndTxt.setText(sfx.muted ? '🔇' : '🔊'); });

    this.add.text(W - 16, 34, '?', {
      fontFamily: FONT, fontSize: '22px', color: '#9060e0', fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(11).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.scene.launch('HowToPlay'); });
  }

  private _adCooldownRemaining(): number {
    return Math.max(0, (Game.state!.adCooldownAt ?? 0) - Date.now());
  }

  private _adBtnLabel(): string {
    const r = this._adCooldownRemaining();
    if (r <= 0) return '📺 +' + AD_COINS_REWARD + '⬡';
    const mins = Math.ceil(r / 60000);
    return '📺 ' + (mins >= 60 ? Math.floor(mins / 60) + 'h' : mins + 'm');
  }

  private _handleAdCoins() {
    const r = this._adCooldownRemaining();
    if (r > 0) {
      const mins = Math.ceil(r / 60000);
      showToast(this, 'Next free coins in ' + mins + ' min', '#ffaaaa');
      return;
    }
    Ads.showRewarded((res: { rewarded: boolean }) => {
      if (res.rewarded) {
        Game.state!.coins += AD_COINS_REWARD;
        Game.state!.adCooldownAt = Date.now() + AD_COOLDOWN_MS;
        store.setJSON('mps_state', Game.state);
        this._updateCoinDisplay();
        sfx.buy();
        showToast(this, '+' + AD_COINS_REWARD + ' ⬡ free coins!', '#aaffaa');
      }
    });
  }

  private _buildTabs(W: number) {
    const types: HabitatType[] = ['dirt', 'grass', 'aquatic'];
    const labels: Record<string, string> = { dirt:'⛰ Dirt', grass:'🌿 Grass', aquatic:'🌊 Aqua' };
    const tabW = (W - 20) / 3;
    types.forEach((type, i) => {
      const x = 10 + tabW * i;
      const unlocked = Game.state!.habitats[type].unlocked;
      const isActive = type === this._currentHabitat;
      const tabBg = this.add.graphics().setDepth(5);
      this._drawTab(tabBg, x, 76, tabW, 50, isActive, unlocked, type);
      const lbl = unlocked ? labels[type] : (labels[type] + ' 🔒');
      const textColors: Record<string, string> = { dirt:'#FFD8A8', grass:'#C8FF88', aquatic:'#88EEFF' };
      const tabTxt = this.add.text(x + tabW/2, 101, lbl, {
        fontFamily: FONT, fontSize: '15px', fontStyle: isActive ? 'bold' : 'normal',
        color: isActive ? textColors[type] : (unlocked ? '#CCBBAA' : '#887766'),
      }).setOrigin(0.5).setDepth(6);
      this._tabBtns[type] = { bg: tabBg, txt: tabTxt };
      const zone = this.add.zone(x + tabW/2, 101, tabW - 4, 46).setInteractive().setDepth(7);
      zone.on('pointerdown', () => {
        if (!Game.state!.habitats[type].unlocked) { this._tryUnlockHabitat(type); return; }
        this._currentHabitat = type;
        this._buildHabitatBg(this.scale.width, this.scale.height);
        this._updateTabs();
        this.refreshAll();
      });
    });
  }

  private _drawTab(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, active: boolean, unlocked: boolean, habitat?: HabitatType) {
    g.clear();
    const baseColors: Record<string, [number, number, number]> = {
      dirt:    [0xC8682A, 0x8B4820, 0xFFBB80],
      grass:   [0x38A020, 0x246414, 0x88EE44],
      aquatic: [0x0878B8, 0x045688, 0x44CCFF],
    };
    const [activeCol, inactiveCol, borderCol] = baseColors[habitat ?? 'dirt'];
    const fillCol = active ? activeCol : (unlocked ? inactiveCol : 0x5A3A20);
    g.fillStyle(fillCol, active ? 1 : (unlocked ? 0.85 : 0.5));
    g.fillRoundedRect(x + 2, y, w - 4, h, { tl: 10, tr: 10, bl: 0, br: 0 });
    if (active) {
      g.lineStyle(2.5, borderCol, 1);
      g.strokeRoundedRect(x + 2, y, w - 4, h, { tl: 10, tr: 10, bl: 0, br: 0 });
      // glow strip at top
      g.fillStyle(borderCol, 0.55);
      g.fillRoundedRect(x + 6, y + 2, w - 12, 4, 2);
    } else {
      g.lineStyle(1.5, unlocked ? borderCol : 0x6A4820, unlocked ? 0.45 : 0.35);
      g.strokeRoundedRect(x + 2, y, w - 4, h, { tl: 10, tr: 10, bl: 0, br: 0 });
    }
  }

  private _updateTabs() {
    const types: HabitatType[] = ['dirt', 'grass', 'aquatic'];
    const labels: Record<string, string> = { dirt:'⛰ Dirt', grass:'🌿 Grass', aquatic:'🌊 Aqua' };
    const W = this.scale.width, tabW = (W - 20) / 3;
    const textColors: Record<string, string> = { dirt:'#FFD8A8', grass:'#C8FF88', aquatic:'#88EEFF' };
    types.forEach((type, i) => {
      const x = 10 + tabW * i;
      const btn = this._tabBtns[type];
      const isActive = type === this._currentHabitat;
      const unlocked = Game.state!.habitats[type].unlocked;
      this._drawTab(btn.bg, x, 76, tabW, 50, isActive, unlocked, type);
      btn.txt.setStyle({
        color: isActive ? textColors[type] : (unlocked ? '#CCBBAA' : '#887766'),
        fontStyle: isActive ? 'bold' : 'normal',
      });
      btn.txt.setText(unlocked ? labels[type] : (labels[type] + ' 🔒'));
    });
  }

  // ── WOODEN CABINET HELPERS ────────────────────────────────────────────────

  private _drawWoodFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
    const woodMain = 0x8B5E3C, woodDark = 0x4A2E14, woodLight = 0xA87050;
    g.fillStyle(0x000000, 0.28); g.fillRoundedRect(x + 4, y + 5, w, h, 8);
    g.fillStyle(woodMain, 1);    g.fillRoundedRect(x, y, w, h, 8);
    g.lineStyle(1, woodLight, 0.22);
    for (let gy = 5; gy < h - 2; gy += 9) {
      g.beginPath(); g.moveTo(x + 4, y + gy); g.lineTo(x + w - 4, y + gy); g.strokePath();
    }
    g.lineStyle(2.5, woodDark, 0.90); g.strokeRoundedRect(x, y, w, h, 8);
    g.lineStyle(1.2, woodLight, 0.42); g.strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 6);
  }

  private _drawHinge(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x5A5A6A, 1); g.fillRoundedRect(x - 5, y - 9, 10, 18, 2);
    g.fillStyle(0x7A7A8A, 0.55); g.fillRoundedRect(x - 4, y - 8, 8, 8, 1);
    g.fillStyle(0x3A3A4A, 1); g.fillCircle(x, y - 5.5, 2.2); g.fillCircle(x, y + 5.5, 2.2);
    g.fillStyle(0xBBBBCC, 0.45); g.fillCircle(x - 1.5, y - 6.5, 1.2);
  }

  private _drawScrew(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.fillStyle(0x888899, 1); g.fillCircle(x, y, 4);
    g.fillStyle(0xBBBBCC, 0.55); g.fillCircle(x - 1, y - 1, 2);
    g.lineStyle(1, 0x3A3A4A, 0.85);
    g.beginPath(); g.moveTo(x - 2.8, y); g.lineTo(x + 2.8, y); g.strokePath();
  }

  private _drawMiniHabitatBg(g: Phaser.GameObjects.Graphics, habitat: HabitatType, x: number, y: number, w: number, h: number) {
    if (habitat === 'dirt') {
      // Warm terracotta cave
      g.fillGradientStyle(0x9B4520, 0x9B4520, 0x6B2E10, 0x6B2E10, 1); g.fillRect(x, y, w, h);
      g.fillStyle(0x7A3A14, 1); g.fillRect(x, y + h * 0.70, w, h * 0.30);
      g.fillStyle(0xAA5828, 1); g.fillRect(x, y + h * 0.70, w, 5);
      // Stalactites
      [[0.28, 0.22], [0.65, 0.17], [0.48, 0.25]].forEach(s => {
        g.fillStyle(0x8A4820, 1);
        const bw = w * 0.10;
        g.fillTriangle(x + w*s[0] - bw, y, x + w*s[0] + bw, y, x + w*s[0], y + h*s[1]);
      });
      // Crystals
      [[0.10, 0.73, 0xFFAA00], [0.85, 0.75, 0xFF8800], [0.52, 0.71, 0xFFD700]].forEach(c => {
        g.fillStyle(c[2] as number, 0.28); g.fillCircle(x + w*(c[0] as number), y + h*(c[1] as number), 9);
        g.fillStyle(c[2] as number, 0.90); g.fillCircle(x + w*(c[0] as number), y + h*(c[1] as number), 4);
      });
    } else if (habitat === 'grass') {
      // Bright vibrant forest
      g.fillGradientStyle(0x2E8818, 0x2E8818, 0x48C030, 0x48C030, 1); g.fillRect(x, y, w, h);
      g.fillStyle(0x3AA828, 1); g.fillRect(x, y + h * 0.72, w, h * 0.28);
      g.fillStyle(0x66CC44, 1); g.fillRect(x, y + h * 0.72, w, 4);
      [[0.12, 0.50], [0.84, 0.46]].forEach(t => {
        const tx = x + w*t[0], ty = y + h*t[1];
        g.fillStyle(0x2A7018, 1);
        g.fillRect(tx - 3, ty + 10, 6, h*0.28);
        g.fillCircle(tx, ty, 18); g.fillCircle(tx - 10, ty + 10, 13); g.fillCircle(tx + 10, ty + 8, 12);
      });
      [[0.32, 0.80, 0xFFEB3B], [0.62, 0.82, 0xFF5722]].forEach(fl => {
        g.fillStyle(fl[2] as number, 1);
        for (let pi = 0; pi < 5; pi++) { const pa = (pi/5)*Math.PI*2; g.fillCircle(x + w*(fl[0] as number) + Math.cos(pa)*4, y + h*(fl[1] as number) + Math.sin(pa)*4, 3); }
        g.fillStyle(0xFFFDE7, 1); g.fillCircle(x + w*(fl[0] as number), y + h*(fl[1] as number), 2.5);
      });
    } else {
      // Bright tropical ocean
      g.fillGradientStyle(0x0898D8, 0x0898D8, 0x0468A8, 0x0468A8, 1); g.fillRect(x, y, w, h);
      g.fillStyle(0x7AD4F8, 0.10); g.fillTriangle(x + w*0.2, y, x + w*0.32, y, x + w*0.55, y + h); g.fillTriangle(x + w*0.6, y, x + w*0.72, y, x + w*0.30, y + h);
      g.fillStyle(0xD4B483, 1); g.fillRect(x, y + h*0.74, w, h*0.26);
      g.fillStyle(0xE8C89A, 1); g.fillRect(x, y + h*0.74, w, 4);
      [[0.15, 0.74], [0.72, 0.74]].forEach(sw => {
        g.lineStyle(3, 0x3EA040, 0.88);
        g.beginPath(); g.moveTo(x + w*sw[0], y + h*sw[1]); g.lineTo(x + w*sw[0] + 7, y + h*sw[1] - h*0.30); g.lineTo(x + w*sw[0] - 4, y + h*sw[1] - h*0.58); g.strokePath();
      });
      g.fillStyle(0xBBEEFF, 0.40);
      g.fillCircle(x + w*0.36, y + h*0.32, 5); g.fillCircle(x + w*0.64, y + h*0.52, 4); g.fillCircle(x + w*0.52, y + h*0.18, 3);
    }
  }

  private _buildBottomNav(W: number, H: number) {
    const btnY = H - 54;
    const bw = 165, bh = 52;
    makeButton(this, W / 6, btnY, bw, bh, 'Shop', 0x2a1560, () => {
      Ads.maybeInterstitial(() => { this.scene.start('Merchant'); });
    }, 16).setDepth(10);

    const disc = Game.state!.stats.discovered.length;
    const hasNew = (Game.state!.newDiscoveries?.length ?? 0) > 0;
    this._dexBtn = makeButton(this, W / 2, btnY, bw, bh, 'Dex ' + disc + '/25', 0x1a2050, () => {
      this.scene.start('PokedexScene');
    }, 16);
    this._dexBtn.setDepth(10);

    this._dexDot = this.add.graphics().setDepth(12);
    this._dexDotTxt = this.add.text(W / 2 + bw / 2 - 6, btnY - bh / 2 + 2, '!', {
      fontFamily: FONT, fontSize: '10px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(13);
    this._updateDexDot(W, bw, btnY, bh, hasNew);

    makeButton(this, W * 5 / 6, btnY, bw, bh, 'Breed', 0x1a3060, () => {
      const eligible = Game.state!.monsters.filter(m => m.level >= 4);
      if (eligible.length < 2) {
        showToast(this, 'Need 2 monsters at Level 4+', '#ff9999');
      } else {
        Ads.maybeInterstitial(() => { this.scene.start('BreedingLab'); });
      }
    }, 16).setDepth(10);
  }

  private _updateDexDot(W: number, bw: number, btnY: number, bh: number, hasNew: boolean) {
    this._dexDot.clear();
    if (hasNew) {
      this._dexDot.fillStyle(0xFF3333, 1);
      this._dexDot.fillCircle(W / 2 + bw / 2 - 6, btnY - bh / 2 + 8, 9);
    }
    this._dexDotTxt.setVisible(hasNew);
  }

  private _tryUnlockHabitat(type: HabitatType) {
    const cost = HABITATS[type].unlockCost;
    if (Game.state!.coins < cost) {
      showToast(this, 'Need ' + cost + '⬡ to unlock ' + HABITATS[type].label, '#ff9999');
      return;
    }
    Game.state!.coins -= cost;
    Game.state!.habitats[type].unlocked = true;
    store.setJSON('mps_state', Game.state);
    this._updateCoinDisplay();
    this._updateTabs();
    showToast(this, HABITATS[type].label + ' unlocked!', '#aaffaa');
  }

  refreshAll() {
    this._bobTweens.forEach(t => { try { t.stop(); } catch { /* ignore */ } });
    this._bobTweens = [];
    this._displayGroup.clear(true, true);
    const W = this.scale.width;
    const monsters = Game.state!.monsters.filter(m => m.habitatType === this._currentHabitat);
    const eggs     = Game.state!.eggs.filter(e => e.habitatType === this._currentHabitat);
    const capacity = (Game.state!.tanks?.[this._currentHabitat] ?? 1) * TANK_CAPACITY;

    // update dex button label + dot
    const disc = Game.state!.stats.discovered.length;
    const hasNew = (Game.state!.newDiscoveries?.length ?? 0) > 0;
    const H = this.scale.height;
    const bw = 165, bh = 52, btnY = H - 54;
    if (this._dexBtn) {
      setButtonLabel(this._dexBtn, 'Dex ' + disc + '/25');
    }
    if (this._dexDot) this._updateDexDot(W, bw, btnY, bh, hasNew);

    if (monsters.length === 0 && eggs.length === 0) {
      const emptyTxt = this.add.text(W/2, 460, 'No monsters here yet!', {
        fontFamily: FONT, fontSize: '18px', color: '#7060a0', align: 'center',
      }).setOrigin(0.5).setDepth(20);
      this._displayGroup.add(emptyTxt);
      const shopBtn = makeButton(this, W/2, 520, 200, 50, '🛒 Go to Shop', 0x2a1560, () => {
        Ads.maybeInterstitial(() => { this.scene.start('Merchant'); });
      }, 16).setDepth(20);
      this._displayGroup.add(shopBtn);
    }

    const slots = this._getSlotPositions(W);
    let idx = 0;
    eggs.forEach(egg => { if (idx < slots.length) { this._drawEggTerrarium(slots[idx].x, slots[idx].y, egg); idx++; } });
    monsters.forEach(mon => { if (idx < slots.length) { this._drawTerrarium(slots[idx].x, slots[idx].y, mon); idx++; } });

    const usage = monsters.length + eggs.length;
    if (usage >= capacity && capacity < MAX_TANKS * TANK_CAPACITY && idx < slots.length) {
      this._drawBuyTankCard(slots[idx].x, slots[idx].y);
    }
  }

  private _drawBuyTankCard(cx: number, cy: number) {
    const CW = 234, CH = 200;
    const vpPad = 7, nameH = 40;
    const vpX = cx - CW/2 + vpPad, vpY = cy - CH/2 + vpPad;
    const vpW = CW - vpPad*2, vpH = CH - nameH - vpPad*2;

    const frame = this.add.graphics().setDepth(20);
    this._drawWoodFrame(frame, cx - CW/2, cy - CH/2, CW, CH);
    this._displayGroup.add(frame);

    const interior = this.add.graphics().setDepth(21);
    interior.fillStyle(0x1A0E06, 0.88); interior.fillRect(vpX, vpY, vpW, vpH);
    interior.lineStyle(2, 0x3A2010, 0.65); interior.strokeRect(vpX, vpY, vpW, vpH);
    this._displayGroup.add(interior);

    const hingeG = this.add.graphics().setDepth(26);
    this._drawHinge(hingeG, cx - CW/2 + 6, cy - CH/2 + 22);
    this._drawHinge(hingeG, cx - CW/2 + 6, cy + CH/2 - 22);
    this._drawHinge(hingeG, cx + CW/2 - 6, cy - CH/2 + 22);
    this._drawHinge(hingeG, cx + CW/2 - 6, cy + CH/2 - 22);
    this._displayGroup.add(hingeG);

    const plateY = cy - CH/2 + vpPad + vpH + 2;
    const plateH = nameH - 4;
    const plateG = this.add.graphics().setDepth(22);
    plateG.fillStyle(0x5C3418, 1); plateG.fillRoundedRect(vpX, plateY, vpW, plateH, 4);
    plateG.lineStyle(1.5, 0x3A2010, 0.85); plateG.strokeRoundedRect(vpX, plateY, vpW, plateH, 4);
    this._displayGroup.add(plateG);
    const screwG = this.add.graphics().setDepth(23);
    this._drawScrew(screwG, vpX + 10, plateY + plateH/2); this._drawScrew(screwG, vpX + vpW - 10, plateY + plateH/2);
    this._displayGroup.add(screwG);
    this._displayGroup.add(this.add.text(cx, plateY + plateH/2, 'BUY TANK', {
      fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#E8C896',
      stroke: '#2A1008', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(23));

    const vpCY = vpY + vpH/2;
    this._displayGroup.add(this.add.text(cx, vpCY - 18, '+', {
      fontFamily: FONT, fontSize: '52px', color: '#8B6040', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(22));
    this._displayGroup.add(this.add.text(cx, vpCY + 28, TANK_COST + ' ⬡', {
      fontFamily: FONT, fontSize: '16px', color: '#FFD700',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(22));

    const zone = this.add.zone(cx, cy, CW, CH).setInteractive().setDepth(25);
    zone.on('pointerdown', () => {
      sfx.unlock();
      if (Game.state!.coins < TANK_COST) {
        showToast(this, 'Need ' + TANK_COST + ' ⬡ to buy a tank!', '#ff9999');
        return;
      }
      Game.state!.coins -= TANK_COST;
      if (!Game.state!.tanks) Game.state!.tanks = { dirt: 1, grass: 1, aquatic: 1 };
      Game.state!.tanks[this._currentHabitat] = Math.min(MAX_TANKS, (Game.state!.tanks[this._currentHabitat] ?? 1) + 1);
      store.setJSON('mps_state', Game.state);
      this._updateCoinDisplay();
      sfx.buy();
      showToast(this, 'New tank purchased! +2 slots', '#aaffaa');
      this.refreshAll();
    });
    this._displayGroup.add(zone);
  }

  private _getSlotPositions(W: number) {
    const H = this.scale.height;
    const col1 = W / 4, col2 = W * 3 / 4;
    const startY = 232;
    // Keep row-3 card bottom above the nav bar (center H-54, height 52 → top H-80)
    const maxCY3 = H - 80 - 98 - 8;
    const spacing = Math.min(210, Math.floor((maxCY3 - startY) / 2));
    return [
      { x: col1, y: startY },           { x: col2, y: startY },
      { x: col1, y: startY + spacing }, { x: col2, y: startY + spacing },
      { x: col1, y: startY + spacing * 2 }, { x: col2, y: startY + spacing * 2 },
    ];
  }

  private _drawTerrarium(cx: number, cy: number, mon: Monster) {
    const CW = 234, CH = 200;
    const sp = SPECIES[mon.speciesId];
    const mods = getVariantModifiers(mon.variantIndex);
    const vpPad = 7, nameH = 40;
    const vpX = cx - CW/2 + vpPad, vpY = cy - CH/2 + vpPad;
    const vpW = CW - vpPad*2, vpH = CH - nameH - vpPad*2;

    const frame = this.add.graphics().setDepth(20);
    this._drawWoodFrame(frame, cx - CW/2, cy - CH/2, CW, CH);
    this._displayGroup.add(frame);

    const innerBg = this.add.graphics().setDepth(21);
    this._drawMiniHabitatBg(innerBg, sp.habitat, vpX, vpY, vpW, vpH);
    this._displayGroup.add(innerBg);

    const viewBorder = this.add.graphics().setDepth(22);
    viewBorder.lineStyle(2, 0x3A2010, 0.65); viewBorder.strokeRect(vpX, vpY, vpW, vpH);
    viewBorder.lineStyle(1, 0xA87050, 0.28); viewBorder.strokeRect(vpX + 1, vpY + 1, vpW - 2, vpH - 2);
    this._displayGroup.add(viewBorder);

    const hingeG = this.add.graphics().setDepth(26);
    this._drawHinge(hingeG, cx - CW/2 + 6, cy - CH/2 + 22);
    this._drawHinge(hingeG, cx - CW/2 + 6, cy + CH/2 - 22);
    this._drawHinge(hingeG, cx + CW/2 - 6, cy - CH/2 + 22);
    this._drawHinge(hingeG, cx + CW/2 - 6, cy + CH/2 - 22);
    this._displayGroup.add(hingeG);

    const plateY = cy - CH/2 + vpPad + vpH + 2;
    const plateH = nameH - 4;
    const plateG = this.add.graphics().setDepth(22);
    plateG.fillStyle(0x5C3418, 1); plateG.fillRoundedRect(vpX, plateY, vpW, plateH, 4);
    plateG.lineStyle(1.5, 0x3A2010, 0.85); plateG.strokeRoundedRect(vpX, plateY, vpW, plateH, 4);
    plateG.lineStyle(1, 0x8B5E3C, 0.38); plateG.strokeRoundedRect(vpX + 2, plateY + 2, vpW - 4, plateH - 4, 3);
    this._displayGroup.add(plateG);

    const screwG = this.add.graphics().setDepth(23);
    const plateCY = plateY + plateH/2;
    this._drawScrew(screwG, vpX + 10, plateCY); this._drawScrew(screwG, vpX + vpW - 10, plateCY);
    this._displayGroup.add(screwG);

    const displayName = (mon.nickname ?? sp.name).toUpperCase();
    this._displayGroup.add(this.add.text(cx, plateCY, displayName, {
      fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#E8C896',
      stroke: '#2A1008', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(23));

    // Level badge top-left
    const lvlLabel = getLevelName(mon.level);
    const lvlBg = this.add.graphics().setDepth(23);
    lvlBg.fillStyle(0x000000, 0.72); lvlBg.fillRoundedRect(vpX + 3, vpY + 3, lvlLabel.length*6.5 + 12, 18, 5);
    this._displayGroup.add(lvlBg);
    this._displayGroup.add(this.add.text(vpX + 7, vpY + 12, lvlLabel, {
      fontFamily: FONT, fontSize: '10px', color: '#FFE066', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(24));

    if (mods.isGolden) {
      this._displayGroup.add(this.add.text(vpX + vpW - 5, vpY + 5, '★', {
        fontFamily: FONT, fontSize: '13px', color: '#FFD700',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 0).setDepth(24));
    }

    const vpCY = vpY + vpH/2 + 2;
    const texKey = makeMonsterTexture(this, mon);
    const img = this.add.image(cx, vpCY, texKey).setDisplaySize(96, 96).setDepth(22);
    this._displayGroup.add(img);
    this._bobTweens.push(this.tweens.add({
      targets: img, y: img.y - 5, duration: 1100 + Math.random()*400, ease: 'Sine.InOut', yoyo: true, repeat: -1,
    }));

    const listing = Game.state!.listings.find(l => l.monsterId === mon.id);
    if (listing) {
      const ready = Date.now() >= listing.readyAt;
      const banner = this.add.graphics().setDepth(25);
      banner.fillStyle(ready ? 0x1A7040 : 0x884400, 0.92);
      banner.fillRect(vpX, vpY, vpW, 22);
      this._displayGroup.add(banner);
      this._displayGroup.add(this.add.text(cx, vpY + 11, ready ? '✓ READY - Tap to collect' : '🏷 For Sale', {
        fontFamily: FONT, fontSize: '10px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(26));
    }

    const zone = this.add.zone(cx, cy, CW, CH).setInteractive().setDepth(27);
    zone.on('pointerdown', () => {
      sfx.unlock();
      const freshMon = Game.state!.monsters.find(m => m.id === mon.id);
      if (freshMon) this.scene.start('HabitatRoom', { monsterId: freshMon.id });
    });
    this._displayGroup.add(zone);
  }

  private _drawEggTerrarium(cx: number, cy: number, egg: Egg) {
    const CW = 234, CH = 200;
    const sp = SPECIES[egg.speciesId];
    const mods = getVariantModifiers(egg.variantIndex);
    const now = Date.now();
    const isReady = now >= egg.hatchEndAt;
    const eggColor = shiftHue(sp.baseColor, mods.hueShift);
    const vpPad = 7, nameH = 40;
    const vpX = cx - CW/2 + vpPad, vpY = cy - CH/2 + vpPad;
    const vpW = CW - vpPad*2, vpH = CH - nameH - vpPad*2;

    const frame = this.add.graphics().setDepth(20);
    if (isReady) {
      // Golden glow frame when ready
      frame.fillStyle(0x000000, 0.28); frame.fillRoundedRect(cx - CW/2 + 4, cy - CH/2 + 5, CW, CH, 8);
      frame.fillStyle(0x8B5E3C, 1);    frame.fillRoundedRect(cx - CW/2, cy - CH/2, CW, CH, 8);
      frame.lineStyle(1, 0xA87050, 0.22);
      for (let gy = 5; gy < CH - 2; gy += 9) { frame.beginPath(); frame.moveTo(cx - CW/2 + 4, cy - CH/2 + gy); frame.lineTo(cx + CW/2 - 4, cy - CH/2 + gy); frame.strokePath(); }
      frame.lineStyle(3, 0xFFD700, 1); frame.strokeRoundedRect(cx - CW/2, cy - CH/2, CW, CH, 8);
      frame.lineStyle(1.5, 0xFFE880, 0.55); frame.strokeRoundedRect(cx - CW/2 + 2, cy - CH/2 + 2, CW - 4, CH - 4, 6);
    } else {
      this._drawWoodFrame(frame, cx - CW/2, cy - CH/2, CW, CH);
    }
    this._displayGroup.add(frame);

    const innerBg = this.add.graphics().setDepth(21);
    this._drawMiniHabitatBg(innerBg, sp.habitat, vpX, vpY, vpW, vpH);
    this._displayGroup.add(innerBg);

    const hingeG = this.add.graphics().setDepth(26);
    this._drawHinge(hingeG, cx - CW/2 + 6, cy - CH/2 + 22);
    this._drawHinge(hingeG, cx - CW/2 + 6, cy + CH/2 - 22);
    this._drawHinge(hingeG, cx + CW/2 - 6, cy - CH/2 + 22);
    this._drawHinge(hingeG, cx + CW/2 - 6, cy + CH/2 - 22);
    this._displayGroup.add(hingeG);

    const plateY = cy - CH/2 + vpPad + vpH + 2;
    const plateH = nameH - 4;
    const plateG = this.add.graphics().setDepth(22);
    plateG.fillStyle(0x5C3418, 1); plateG.fillRoundedRect(vpX, plateY, vpW, plateH, 4);
    plateG.lineStyle(1.5, 0x3A2010, 0.85); plateG.strokeRoundedRect(vpX, plateY, vpW, plateH, 4);
    this._displayGroup.add(plateG);

    const plateCY = plateY + plateH/2;
    const screwG = this.add.graphics().setDepth(23);
    this._drawScrew(screwG, vpX + 10, plateCY); this._drawScrew(screwG, vpX + vpW - 10, plateCY);
    this._displayGroup.add(screwG);

    this._displayGroup.add(this.add.text(cx, plateCY, isReady ? '🥚 READY!' : sp.name.toUpperCase() + ' EGG', {
      fontFamily: FONT, fontSize: '12px', fontStyle: 'bold',
      color: isReady ? '#FFE066' : '#E8C896', stroke: '#2A1008', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(23));

    const vpCY = vpY + vpH / 2;
    const eggG = this.add.graphics().setDepth(22);
    eggG.fillStyle(darken(eggColor, 22), 1); eggG.fillEllipse(cx + 2, vpCY + 3, 54, 68);
    eggG.fillStyle(eggColor, 1);              eggG.fillEllipse(cx, vpCY, 54, 68);
    eggG.fillStyle(lighten(eggColor, 50), 0.38); eggG.fillEllipse(cx - 10, vpCY - 15, 18, 26);
    if (isReady) {
      eggG.lineStyle(2.5, darken(eggColor, 70), 1);
      eggG.beginPath(); eggG.moveTo(cx - 5, vpCY - 22); eggG.lineTo(cx + 6, vpCY - 6); eggG.lineTo(cx - 3, vpCY + 8); eggG.strokePath();
      eggG.beginPath(); eggG.moveTo(cx + 8, vpCY - 18); eggG.lineTo(cx - 2, vpCY - 9); eggG.strokePath();
      eggG.lineStyle(3, 0xFFD700, 0.7); eggG.strokeEllipse(cx, vpCY, 62, 76);
    }
    this._displayGroup.add(eggG);
    this._bobTweens.push(this.tweens.add({
      targets: eggG, y: isReady ? -5 : -3,
      duration: isReady ? 520 : 1400, ease: 'Sine.InOut', yoyo: true, repeat: -1,
    }));

    if (!isReady) {
      this._displayGroup.add(this.add.text(vpX + 7, vpY + 7, sp.habitat.charAt(0).toUpperCase() + sp.habitat.slice(1), {
        fontFamily: FONT, fontSize: '10px', color: '#CCBBAA',
      }).setOrigin(0, 0).setDepth(24));
    }

    const remaining = Math.max(0, egg.hatchEndAt - now);
    const timerTxt = this.add.text(cx, vpY + vpH - 14, isReady ? '✨ Tap to hatch!' : this._formatMs(remaining), {
      fontFamily: FONT, fontSize: '12px',
      color: isReady ? '#FFD700' : '#DDDDCC', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(24);
    (timerTxt as any)._eggId = egg.id;
    this._displayGroup.add(timerTxt);

    const zone = this.add.zone(cx, cy, CW, CH).setInteractive().setDepth(27);
    zone.on('pointerdown', () => {
      const refreshedEgg = Game.state!.eggs.find(e => e.id === egg.id);
      if (!refreshedEgg) return;
      if (Date.now() >= refreshedEgg.hatchEndAt) {
        const cap = (Game.state!.tanks?.[egg.habitatType] ?? 1) * TANK_CAPACITY;
        const monCount = Game.state!.monsters.filter(m => m.habitatType === egg.habitatType).length;
        if (monCount >= cap) { showToast(this, 'Habitat full! Buy more tanks to hatch.', '#ff9999'); return; }
        this.scene.launch('HatchScene', { eggId: refreshedEgg.id });
      } else {
        const remaining = Math.max(0, refreshedEgg.hatchEndAt - Date.now());
        const mins = Math.ceil(remaining / 60000);
        this._showInstantHatchOffer(refreshedEgg.id, sp.name, mins);
      }
    });
    this._displayGroup.add(zone);
  }

  private _showInstantHatchOffer(eggId: string, name: string, minsLeft: number) {
    const W = this.scale.width, H = this.scale.height;

    const popup = this.add.container(0, 0).setDepth(40);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, 0, W, H);
    popup.add(overlay);

    const panel = this.add.graphics();
    panel.fillStyle(0x100828, 1);
    panel.fillRoundedRect(W/2 - 150, H/2 - 100, 300, 200, 16);
    panel.lineStyle(2, 0x5040b0, 0.8);
    panel.strokeRoundedRect(W/2 - 150, H/2 - 100, 300, 200, 16);
    popup.add(panel);

    popup.add(this.add.text(W/2, H/2 - 68, name + ' is hatching…', {
      fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 40, minsLeft + ' min remaining', {
      fontFamily: FONT, fontSize: '14px', color: '#BBCCFF',
    }).setOrigin(0.5));

    const close = () => { popup.destroy(); };

    popup.add(makeButton(this, W/2, H/2 + 10, 240, 46, 'Watch ad -> Hatch now!', 0x7A4A00, () => {
      Ads.showRewarded(res => {
        close();
        if (res.rewarded) {
          const egg = Game.state!.eggs.find(e => e.id === eggId);
          if (egg) { egg.hatchEndAt = Date.now() - 1; }
          this.refreshAll();
          showToast(this, 'Egg hatched instantly! Tap to open', '#aaffaa');
        }
      });
    }, 14));
    popup.add(makeButton(this, W/2, H/2 + 68, 120, 38, 'Wait', 0x2a1560, close, 13));
  }

  private _startEggTimer() {
    if (this._eggTimer) this._eggTimer.remove();
    this._eggTimer = this.time.addEvent({
      delay: 1000, loop: true, callback: () => { this._updateEggTimers(); },
    });
  }

  private _updateEggTimers() {
    const now = Date.now();
    this._displayGroup.getChildren().forEach(child => {
      const eggId = (child as any)._eggId;
      if (!eggId) return;
      const egg = Game.state!.eggs.find(e => e.id === eggId);
      if (!egg) return;
      const remaining = Math.max(0, egg.hatchEndAt - now);
      (child as Phaser.GameObjects.Text).setText(remaining <= 0 ? '✨ Ready!' : this._formatMs(remaining));
      (child as Phaser.GameObjects.Text).setStyle({ color: remaining <= 0 ? '#aaffaa' : '#BBCCFF' });
    });
  }

  private _formatMs(ms: number): string {
    if (ms <= 0) return '✨ Ready!';
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + sec + 's';
    return sec + 's';
  }

  private _updateCoinDisplay() {
    if (this._coinTxt) this._coinTxt.setText(String(Game.state!.coins));
    if (this._diamondTxt) this._diamondTxt.setText(String(Game.state!.diamonds ?? 0));
  }

  updateCoins() { this._updateCoinDisplay(); }

  private _markDiscovered(speciesId: number) {
    const disc = Game.state!.stats.discovered;
    if (!disc.includes(speciesId)) {
      disc.push(speciesId);
    }
  }

  onEggHatched(eggId: string, monster: Monster) {
    Game.state!.eggs = Game.state!.eggs.filter(e => e.id !== eggId);
    Game.state!.monsters.push(monster);
    Game.state!.stats.hatched++;
    this._markDiscovered(monster.speciesId);
    store.setJSON('mps_state', Game.state);
    this._updateCoinDisplay();
    this.refreshAll();
  }
}
