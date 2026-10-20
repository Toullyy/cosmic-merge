import Phaser from 'phaser';
import { Game, FONT, store, sfx, getNewAchievements } from '../utils';
import { SPECIES, HABITATS, TANK_COST, TANK_CAPACITY, MAX_TANKS, getLevelName, AD_COINS_REWARD, AD_COOLDOWN_MS, checkAndUpdateVisitor, VISITOR_DURATION_MS, TRAITS, ACHIEVEMENTS } from '../data';
import { t, currentLang, setLang } from '../i18n';
import type { Achievement } from '../data';
import { makeMonsterTexture, getVariantModifiers, shiftHue, darken, lighten } from '../MonsterRenderer';
import { makeButton, setButtonLabel, setButtonColor } from '../ui/Button';
import { showToast } from '../ui/Toast';
import { Ads } from '../ads';
import type { Monster, Egg, HabitatType } from '../types';

const HAB_PLATE: Record<string, [number, string]> = {
  dirt:    [0x4A2808, '#FFD8A8'],
  grass:   [0x0D3008, '#AAFFAA'],
  aquatic: [0x062030, '#88EEFF'],
};

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
  private _questBtn!: Phaser.GameObjects.Container;
  private _questDot!: Phaser.GameObjects.Graphics;
  private _visitorBanner: Phaser.GameObjects.Container | null = null;
  private _visitorTimer: Phaser.Time.TimerEvent | null = null;

  constructor() { super({ key: 'Hub' }); }

  create() {
    sfx.unlock();
    const W = this.scale.width, H = this.scale.height;
    this._displayGroup = this.add.group();

    this._buildBackground(W, H);
    this._buildVignette(W, H);
    this._buildShopSign(W, H);
    this._buildHUD(W);
    this._buildTabs(W);
    this._buildBottomNav(W, H);
    this._bgGraphics = this.add.graphics().setDepth(1);
    this._buildHabitatBg(W, H);
    this._buildVisitorBanner(W, H);
    this.refreshAll();
    this._startEggTimer();
    this._startVisitorTimer();

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

    // ── Shop decorations in lower area ───────────────────────────────────────
    const shelfY = H * 0.64;

    // Decorative wooden shelf
    bg.fillStyle(0x5A3010, 1); bg.fillRect(8, shelfY + 3, W - 16, 20);
    bg.fillStyle(0x8B5020, 1); bg.fillRect(8, shelfY, W - 16, 18);
    bg.lineStyle(1, 0xAA7030, 0.55);
    bg.beginPath(); bg.moveTo(8, shelfY + 2); bg.lineTo(W - 8, shelfY + 2); bg.strokePath();
    bg.lineStyle(1.5, 0x3A1808, 0.7);
    bg.beginPath(); bg.moveTo(8, shelfY + 18); bg.lineTo(W - 8, shelfY + 18); bg.strokePath();
    // Shelf brackets
    [60, W - 60, W / 2].forEach(bx => {
      bg.fillStyle(0x4A2008, 1);
      bg.fillRect(bx - 6, shelfY + 18, 12, 22);
      bg.fillStyle(0x6A3818, 1);
      bg.fillRect(bx - 5, shelfY + 18, 10, 20);
    });

    // Potion bottles on shelf
    const bottleData: [number, number, number][] = [
      [85,  shelfY - 4,  0xFF4444],
      [130, shelfY - 2,  0x44AAFF],
      [172, shelfY - 6,  0x88EE44],
      [W - 88,  shelfY - 3,  0xFFAA22],
      [W - 132, shelfY - 7,  0xCC44FF],
      [W - 176, shelfY - 2,  0x44FFCC],
    ];
    bottleData.forEach(([bx, by, col]) => {
      // bottle body
      bg.fillStyle(0x2A1808, 0.55); bg.fillRoundedRect(bx - 8 + 2, by - 14 + 3, 16, 20, 5);
      bg.fillStyle(col, 0.85); bg.fillRoundedRect(bx - 8, by - 14, 16, 20, 5);
      bg.fillStyle(col, 0.40); bg.fillRoundedRect(bx - 5, by - 12, 6, 9, 3);
      // stopper
      bg.fillStyle(0x3A2010, 1); bg.fillRoundedRect(bx - 3, by - 18, 6, 6, 2);
      // glow
      bg.fillStyle(col, 0.15); bg.fillCircle(bx, by - 4, 14);
    });

    // Decorative sign on back wall center
    const signX = W / 2, signY = H * 0.68;
    bg.fillStyle(0x3A1808, 0.5); bg.fillRoundedRect(signX - 97, signY - 27, 194, 50, 6);
    bg.fillStyle(0xC87820, 1); bg.fillRoundedRect(signX - 95, signY - 26, 190, 48, 5);
    bg.lineStyle(2, 0xFFD070, 0.70); bg.strokeRoundedRect(signX - 95, signY - 26, 190, 48, 5);
    bg.lineStyle(1, 0xFFE0A0, 0.35); bg.strokeRoundedRect(signX - 90, signY - 21, 180, 38, 4);
    // Sign nails
    [[signX - 84, signY - 19], [signX + 84, signY - 19], [signX - 84, signY + 17], [signX + 84, signY + 17]].forEach(([nx, ny]) => {
      bg.fillStyle(0xC0A050, 1); bg.fillCircle(nx, ny, 4);
      bg.fillStyle(0xFFD890, 0.6); bg.fillCircle(nx - 1, ny - 1, 2);
    });

    // Small treasure chest on shelf right
    const chX = W * 0.72, chY = shelfY - 20;
    bg.fillStyle(0x5D3A1A, 1); bg.fillRoundedRect(chX - 16, chY, 32, 22, 3);
    bg.fillStyle(0x7A4F25, 1); bg.fillRoundedRect(chX - 16, chY - 8, 32, 12, 3);
    bg.fillStyle(0xFFD700, 0.95); bg.fillRect(chX - 5, chY + 6, 10, 7); bg.fillCircle(chX, chY + 9, 4);
    bg.lineStyle(1.5, 0xFFB700, 0.7); bg.strokeRoundedRect(chX - 16, chY, 32, 22, 3);

    // Potted plant on left
    const pX = W * 0.28, pY = shelfY - 18;
    bg.fillStyle(0x8B4513, 1); bg.fillRect(pX - 11, pY, 22, 18);
    bg.fillStyle(0xA0522D, 1); bg.fillRoundedRect(pX - 13, pY, 26, 6, 2);
    bg.fillStyle(0x2E7D32, 1);
    bg.fillCircle(pX, pY - 16, 13); bg.fillCircle(pX - 10, pY - 10, 9); bg.fillCircle(pX + 10, pY - 10, 9);
    bg.fillStyle(0x4CAF50, 0.5);
    bg.fillCircle(pX - 3, pY - 20, 6); bg.fillCircle(pX + 4, pY - 14, 5);

    // Hanging lanterns from top
    [[W * 0.22, 72], [W * 0.78, 76]].forEach(([lx, ly]) => {
      bg.lineStyle(1.5, 0x5A3810, 0.7);
      bg.beginPath(); bg.moveTo(lx, 0); bg.lineTo(lx, ly - 10); bg.strokePath();
      bg.fillStyle(0x3A2208, 0.95); bg.fillRoundedRect(lx - 9, ly - 10, 18, 28, 3);
      bg.fillStyle(0xFFDD66, 0.75); bg.fillRoundedRect(lx - 6, ly - 6, 12, 18, 2);
      bg.fillStyle(0xFFFF99, 0.25); bg.fillCircle(lx, ly + 2, 18);
      bg.fillStyle(0x2A1608, 1); bg.fillTriangle(lx - 10, ly - 10, lx + 10, ly - 10, lx, ly - 20);
      bg.fillStyle(0x6A4818, 1); bg.fillRect(lx - 10, ly + 18, 20, 4);
    });

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

  private _buildShopSign(W: number, H: number) {
    const signY = H * 0.68;
    this.add.text(W / 2, signY - 8, t('hub.sign'), {
      fontFamily: FONT, fontSize: '15px', fontStyle: 'bold',
      color: '#FFFFFF', stroke: '#5A2A00', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(1);
    this.add.text(W / 2, signY + 10, t('hub.tagline'), {
      fontFamily: FONT, fontSize: '12px',
      color: '#FFFFFF', stroke: '#5A2A00', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(1);
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

    // Coin box — vivid amber
    hud.fillStyle(0x000000, 0.30);
    hud.fillRoundedRect(10, 11, 168, 52, 14);
    hud.fillStyle(0xB86000, 1);
    hud.fillRoundedRect(8, 8, 168, 52, 14);
    hud.lineStyle(3, 0xFFE050, 1);
    hud.strokeRoundedRect(8, 8, 168, 52, 14);
    hud.fillStyle(0xffffff, 0.22);
    hud.fillRoundedRect(9, 9, 166, 22, { tl: 13, tr: 13, bl: 0, br: 0 });

    // Diamond box — vivid cyan
    hud.fillStyle(0x000000, 0.30);
    hud.fillRoundedRect(184, 11, 120, 52, 14);
    hud.fillStyle(0x0468A8, 1);
    hud.fillRoundedRect(182, 8, 120, 52, 14);
    hud.lineStyle(3, 0x55EEFF, 1);
    hud.strokeRoundedRect(182, 8, 120, 52, 14);
    hud.fillStyle(0xffffff, 0.22);
    hud.fillRoundedRect(183, 9, 118, 22, { tl: 13, tr: 13, bl: 0, br: 0 });

    this.add.text(26, 34, '💰', {
      fontFamily: FONT, fontSize: '26px', color: '#FFD700',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(11);

    this._coinTxt = this.add.text(62, 34, String(Game.state!.coins), {
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
    this._adBtn = makeButton(this, 370, 34, 108, 40, this._adBtnLabel(), 0x1EA040, () => {
      this._handleAdCoins();
    }, 12).setDepth(11);
    this.time.addEvent({
      delay: 1000, loop: true,
      callback: () => { if (this._adBtn) setButtonLabel(this._adBtn, this._adBtnLabel()); },
    });

    const langTxt = this.add.text(W - 100, 34, currentLang() === 'th' ? 'TH' : 'EN', {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold',
      color: '#FFD700', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0.5).setDepth(11).setInteractive({ useHandCursor: true });
    const langBg = this.add.graphics().setDepth(11);
    langBg.lineStyle(1.5, 0xFFD700, 0.70);
    langBg.strokeRoundedRect(W - 114, 24, 28, 20, 6);
    langTxt.on('pointerdown', () => {
      const next = currentLang() === 'th' ? 'en' : 'th';
      setLang(next);
      this.scene.restart();
    });

    const sndTxt = this.add.text(W - 60, 34, sfx.muted ? '🔇' : '🔊', {
      fontFamily: FONT, fontSize: '22px', color: '#cccccc',
    }).setOrigin(0.5, 0.5).setDepth(11).setInteractive({ useHandCursor: true });
    sndTxt.on('pointerdown', () => { sfx.toggle(); sndTxt.setText(sfx.muted ? '🔇' : '🔊'); });

    this.add.text(W - 22, 34, '?', {
      fontFamily: FONT, fontSize: '22px', color: '#9060e0', fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(11).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.scene.launch('HowToPlay'); });
  }

  private _adCooldownRemaining(): number {
    return Math.max(0, (Game.state!.adCooldownAt ?? 0) - Date.now());
  }

  private _adBtnLabel(): string {
    const r = this._adCooldownRemaining();
    if (r <= 0) return t('hub.adReady', { n: AD_COINS_REWARD });
    const mins = Math.ceil(r / 60000);
    return mins >= 60
      ? t('hub.adCoolH', { h: Math.floor(mins / 60) })
      : t('hub.adCoolM', { m: mins });
  }

  private _handleAdCoins() {
    const r = this._adCooldownRemaining();
    if (r > 0) {
      showToast(this, t('toast.adCool', { mins: Math.ceil(r / 60000) }), '#ffaaaa');
      return;
    }
    Ads.showRewarded((res: { rewarded: boolean }) => {
      if (res.rewarded) {
        Game.state!.coins += AD_COINS_REWARD;
        Game.state!.adCooldownAt = Date.now() + AD_COOLDOWN_MS;
        store.setJSON('mps_state', Game.state);
        this._updateCoinDisplay();
        sfx.buy();
        showToast(this, t('toast.adGot', { n: AD_COINS_REWARD }), '#aaffaa');
      }
    });
  }

  private _buildTabs(W: number) {
    const types: HabitatType[] = ['dirt', 'grass', 'aquatic'];
    const labels: Record<string, string> = { dirt: t('tab.dirt'), grass: t('tab.grass'), aquatic: t('tab.aquatic') };
    const tabW = (W - 20) / 3;
    types.forEach((type, i) => {
      const x = 10 + tabW * i;
      const unlocked = Game.state!.habitats[type].unlocked;
      const isActive = type === this._currentHabitat;
      const tabBg = this.add.graphics().setDepth(5);
      this._drawTab(tabBg, x, 76, tabW, 50, isActive, unlocked, type);
      const lbl = unlocked ? labels[type] : (labels[type] + ' 🔒');
      const tabTxt = this.add.text(x + tabW/2, 101, lbl, {
        fontFamily: FONT, fontSize: '15px', fontStyle: isActive ? 'bold' : 'normal',
        color: isActive ? '#FFFFFF' : (unlocked ? '#E8D8C8' : '#BBAA99'),
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
    const labels: Record<string, string> = { dirt: t('tab.dirt'), grass: t('tab.grass'), aquatic: t('tab.aquatic') };
    const W = this.scale.width, tabW = (W - 20) / 3;
    types.forEach((type, i) => {
      const x = 10 + tabW * i;
      const btn = this._tabBtns[type];
      const isActive = type === this._currentHabitat;
      const unlocked = Game.state!.habitats[type].unlocked;
      this._drawTab(btn.bg, x, 76, tabW, 50, isActive, unlocked, type);
      btn.txt.setStyle({
        color: isActive ? '#FFFFFF' : (unlocked ? '#E8D8C8' : '#BBAA99'),
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
    const btnY = H - 54, bw = 118, bh = 52;
    const xs = [W/8, W*3/8, W*5/8, W*7/8];

    // Vibrant nav backing strip
    const navBg = this.add.graphics().setDepth(9);
    navBg.fillStyle(0x1A0848, 1);
    navBg.fillRoundedRect(0, H - 110, W, 112, { tl: 20, tr: 20, bl: 0, br: 0 });
    navBg.fillStyle(0x5020C8, 0.28);
    navBg.fillRoundedRect(0, H - 110, W, 38, { tl: 20, tr: 20, bl: 0, br: 0 });
    navBg.lineStyle(2, 0x8855FF, 0.60);
    navBg.strokeRoundedRect(0, H - 110, W, 112, { tl: 20, tr: 20, bl: 0, br: 0 });

    makeButton(this, xs[0], btnY, bw, bh, t('nav.shop'), 0x8030CC, () => {
      Ads.maybeInterstitial(() => { this.scene.start('Merchant'); });
    }, 15).setDepth(10);

    const unclaimedCount = (Game.state!.quests ?? []).filter(q => q.completed && !q.claimed).length;
    const questLabel = unclaimedCount > 0 ? t('nav.questsDone') : t('nav.quests');
    this._questBtn = makeButton(this, xs[1], btnY, bw, bh, questLabel, 0xCC8800, () => {
      this._showQuestsPanel();
    }, 13).setDepth(10);
    this._questDot = this.add.graphics().setDepth(12);
    this._updateQuestDot(xs[1], bw, btnY, bh, unclaimedCount > 0);

    const disc = Game.state!.stats.discovered.length;
    const hasNew = (Game.state!.newDiscoveries?.length ?? 0) > 0;
    this._dexBtn = makeButton(this, xs[2], btnY, bw, bh, t('nav.dex', { n: disc }), 0x0898CC, () => {
      this.scene.start('PokedexScene');
    }, 14).setDepth(10);
    this._dexDot = this.add.graphics().setDepth(12);
    this._dexDotTxt = this.add.text(xs[2] + bw / 2 - 6, btnY - bh / 2 + 2, '!', {
      fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(13);
    this._updateDexDot(xs[2], bw, btnY, bh, hasNew);

    makeButton(this, xs[3], btnY, bw, bh, t('nav.breed'), 0xC82870, () => {
      const eligible = Game.state!.monsters.filter(m => m.level >= 4);
      if (eligible.length < 2) {
        showToast(this, t('toast.need2monsters'), '#ff9999');
      } else {
        Ads.maybeInterstitial(() => { this.scene.start('BreedingLab'); });
      }
    }, 15).setDepth(10);
  }

  private _updateDexDot(x: number, bw: number, btnY: number, bh: number, hasNew: boolean) {
    this._dexDot.clear();
    if (hasNew) {
      this._dexDot.fillStyle(0xFF3333, 1);
      this._dexDot.fillCircle(x + bw / 2 - 6, btnY - bh / 2 + 8, 9);
    }
    if (this._dexDotTxt) this._dexDotTxt.setVisible(hasNew);
  }

  private _updateQuestDot(x: number, bw: number, btnY: number, bh: number, hasClaim: boolean) {
    this._questDot.clear();
    if (hasClaim) {
      this._questDot.fillStyle(0xFFCC00, 1);
      this._questDot.fillCircle(x + bw / 2 - 6, btnY - bh / 2 + 8, 9);
    }
  }

  private _tryUnlockHabitat(type: HabitatType) {
    const cost = HABITATS[type].unlockCost;
    const hName = t('habitat.' + type);
    if (Game.state!.coins < cost) {
      showToast(this, t('toast.needCoinsUnlock', { cost, name: hName }), '#ff9999');
      return;
    }
    Game.state!.coins -= cost;
    Game.state!.habitats[type].unlocked = true;
    if (!Game.state!.tanks) Game.state!.tanks = { dirt: 4, grass: 0, aquatic: 0 };
    Game.state!.tanks[type] = 4;
    store.setJSON('mps_state', Game.state);
    this._updateCoinDisplay();
    this._updateTabs();
    showToast(this, t('toast.unlocked', { name: hName }), '#aaffaa');
  }

  private _buildVisitorBanner(W: number, H: number) {
    this._visitorBanner = this.add.container(0, H - 90).setDepth(14);
    this._updateVisitorBanner();
  }

  private _updateVisitorBanner() {
    if (!this._visitorBanner) return;
    this._visitorBanner.removeAll(true);
    const state = Game.state!;
    const W = this.scale.width;
    const now = Date.now();
    if (!state.visitorSpeciesId || !state.visitorExpiresAt || now >= state.visitorExpiresAt) return;

    const sp = SPECIES[state.visitorSpeciesId];
    const remaining = Math.max(0, state.visitorExpiresAt - now);
    const mins = Math.ceil(remaining / 60000);
    const hasMon = state.monsters.some(m => m.speciesId === state.visitorSpeciesId);

    const bg = this.add.graphics();
    bg.fillStyle(0x5A3800, 0.95);
    bg.fillRoundedRect(8, 0, W - 16, 32, 10);
    bg.lineStyle(2, 0xFFCC00, 0.9);
    bg.strokeRoundedRect(8, 0, W - 16, 32, 10);
    this._visitorBanner.add(bg);

    const bannerMsg = t('visitor.banner', { name: sp.name, mult: state.visitorPriceMult ?? 2, mins })
      + (hasMon ? '' : ' ' + t('visitor.bannerNone'));
    this._visitorBanner.add(this.add.text(W / 2, 16, bannerMsg, {
      fontFamily: FONT, fontSize: '12px', color: hasMon ? '#FFE066' : '#BB9944', fontStyle: 'bold',
    }).setOrigin(0.5));

    const zone = this.add.zone(W / 2, 16, W - 16, 32).setInteractive();
    zone.on('pointerdown', () => this._showVisitorPopup());
    this._visitorBanner.add(zone);
  }

  private _startVisitorTimer() {
    if (this._visitorTimer) this._visitorTimer.remove();
    this._visitorTimer = this.time.addEvent({
      delay: 10000, loop: true, callback: () => {
        checkAndUpdateVisitor(Game.state!);
        this._updateVisitorBanner();
        store.setJSON('mps_state', Game.state);
      },
    });
  }

  private _showVisitorPopup() {
    const state = Game.state!;
    if (!state.visitorSpeciesId || !state.visitorExpiresAt) return;
    const W = this.scale.width, H = this.scale.height;
    const sp = SPECIES[state.visitorSpeciesId];
    const mult = state.visitorPriceMult ?? 2;
    const offerPrice = Math.floor(sp.price * mult);
    const candidates = state.monsters.filter(m => m.speciesId === state.visitorSpeciesId);
    const remaining = Math.max(0, state.visitorExpiresAt - Date.now());
    const mins = Math.ceil(remaining / 60000);

    const popup = this.add.container(0, 0).setDepth(50);
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.65); overlay.fillRect(0, 0, W, H);
    popup.add(overlay);
    const panel = this.add.graphics();
    panel.fillStyle(0x1A0C08, 1);
    panel.fillRoundedRect(W/2 - 160, H/2 - 130, 320, 260, 16);
    panel.lineStyle(2, 0xFFCC00, 0.9);
    panel.strokeRoundedRect(W/2 - 160, H/2 - 130, 320, 260, 16);
    popup.add(panel);

    popup.add(this.add.text(W/2, H/2 - 108, t('visitor.title'), { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#FFE066' }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 78, t('visitor.wants', { name: sp.name }), { fontFamily: FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 52, t('visitor.offer', { price: offerPrice, mult }), { fontFamily: FONT, fontSize: '15px', color: '#FFD700' }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 26, t('visitor.expires', { mins }), { fontFamily: FONT, fontSize: '13px', color: '#BBBBCC' }).setOrigin(0.5));

    const close = () => popup.destroy();

    if (candidates.length > 0) {
      popup.add(makeButton(this, W/2, H/2 + 20, 260, 48, t('visitor.sell', { name: sp.name, price: offerPrice }), 0x2A7A18, () => {
        const mon = candidates[0];
        state.monsters = state.monsters.filter(m => m.id !== mon.id);
        state.listings = state.listings.filter(l => l.monsterId !== mon.id);
        state.coins += offerPrice;
        state.stats.sold++;
        state.stats.totalEarned += offerPrice;
        state.stats.visitorSales = (state.stats.visitorSales ?? 0) + 1;
        state.visitorSpeciesId = undefined;
        state.visitorExpiresAt = undefined;
        store.setJSON('mps_state', state);
        sfx.sell();
        showToast(this, t('toast.soldFor', { price: offerPrice }), '#aaffaa');
        close();
        this._updateCoinDisplay();
        this._updateVisitorBanner();
        this.refreshAll();
      }, 13));
    } else {
      popup.add(this.add.text(W/2, H/2 + 20, t('visitor.noMonster', { name: sp.name }), { fontFamily: FONT, fontSize: '14px', color: '#BB9944' }).setOrigin(0.5));
    }

    popup.add(makeButton(this, W/2, H/2 + 82, 120, 38, t('btn.close'), 0x2a1560, close, 13));
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    overlay.on('pointerdown', close);
  }

  private _showQuestsPanel() {
    const state = Game.state!;
    const quests = state.quests ?? [];
    const W = this.scale.width, H = this.scale.height;

    const popup = this.add.container(0, 0).setDepth(50);
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.65); overlay.fillRect(0, 0, W, H);
    popup.add(overlay);

    const panH = 50 + quests.length * 90 + 60;
    const panY = H / 2 - panH / 2;
    const panel = this.add.graphics();
    panel.fillStyle(0x1C1408, 1);
    panel.fillRoundedRect(W/2 - 170, panY, 340, panH, 16);
    panel.lineStyle(2, 0xCC9900, 0.8);
    panel.strokeRoundedRect(W/2 - 170, panY, 340, panH, 16);
    popup.add(panel);

    popup.add(this.add.text(W/2, panY + 24, t('quests.title'), { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#FFD700' }).setOrigin(0.5));

    const resetAt = state.questResetAt ?? 0;
    const minsLeft = Math.max(0, Math.floor((resetAt - Date.now()) / 60000));
    const hLeft = Math.floor(minsLeft / 60), mLeft = minsLeft % 60;
    popup.add(this.add.text(W/2, panY + 42, t('quests.resets', { h: hLeft, m: mLeft }), { fontFamily: FONT, fontSize: '13px', color: '#AA9944' }).setOrigin(0.5));

    quests.forEach((q, qi) => {
      const qy = panY + 58 + qi * 90;
      const done = q.completed;
      const clmd = q.claimed;
      const qBg = this.add.graphics();
      qBg.fillStyle(done ? (clmd ? 0x1A2A1A : 0x2A3A10) : 0x221A08, 1);
      qBg.fillRoundedRect(W/2 - 155, qy, 310, 78, 10);
      qBg.lineStyle(1.5, done ? 0x66CC44 : 0x6A5010, 0.7);
      qBg.strokeRoundedRect(W/2 - 155, qy, 310, 78, 10);
      popup.add(qBg);

      popup.add(this.add.text(W/2 - 145, qy + 14, q.label, { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: done ? '#AAFFAA' : '#FFEEAA' }).setOrigin(0, 0.5));
      popup.add(this.add.text(W/2 - 145, qy + 36, t('quests.reward', { amount: q.coinReward }), { fontFamily: FONT, fontSize: '12px', color: '#FFD700' }).setOrigin(0, 0.5));

      const barW = 160, barH = 10;
      const barBg = this.add.graphics();
      barBg.fillStyle(0x000000, 0.5); barBg.fillRoundedRect(W/2 - 145, qy + 54, barW, barH, 4);
      const fill = Math.min(1, q.progress / q.target);
      if (fill > 0) {
        barBg.fillStyle(done ? 0x44DD44 : 0xDD9922, 1);
        barBg.fillRoundedRect(W/2 - 145, qy + 54, barW * fill, barH, 4);
      }
      popup.add(barBg);
      popup.add(this.add.text(W/2 + 20, qy + 59, q.progress + '/' + q.target, { fontFamily: FONT, fontSize: '12px', color: '#CCCCCC' }).setOrigin(0, 0.5));

      if (done && !clmd) {
        const claimBtn = makeButton(this, W/2 + 105, qy + 40, 90, 36, t('quests.claim'), 0x2A7A10, () => {
          q.claimed = true;
          state.coins += q.coinReward;
          state.stats.questsCompleted = (state.stats.questsCompleted ?? 0) + 1;
          store.setJSON('mps_state', state);
          sfx.buy();
          showToast(this, t('quests.toast', { amount: q.coinReward }), '#aaffaa');
          this._updateCoinDisplay();
          this._updateQuestBtn();
          const newAch = getNewAchievements(state);
          newAch.forEach(a => this._showAchievementPopup(a));
          close();
          this._showQuestsPanel();
        }, 12);
        popup.add(claimBtn);
      } else if (clmd) {
        popup.add(this.add.text(W/2 + 105, qy + 40, t('quests.claimed'), { fontFamily: FONT, fontSize: '12px', color: '#66AA66' }).setOrigin(0.5));
      }
    });

    const close = () => popup.destroy();
    popup.add(makeButton(this, W/2 - 70, panY + panH - 28, 120, 40, t('btn.close'), 0x2a1560, close, 13));
    popup.add(makeButton(this, W/2 + 70, panY + panH - 28, 130, 40, t('ach.title'), 0x1A3A6A, () => {
      close(); this._showAchievementsPanel();
    }, 11));
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    overlay.on('pointerdown', close);
  }

  private _showAchievementsPanel() {
    const state = Game.state!;
    const earned = new Set(state.achievements ?? []);
    const W = this.scale.width, H = this.scale.height;

    const popup = this.add.container(0, 0).setDepth(50);
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.70); overlay.fillRect(0, 0, W, H);
    popup.add(overlay);

    const cols = 2, cardW = 150, cardH = 66, gapX = 12, gapY = 10;
    const rows = Math.ceil(ACHIEVEMENTS.length / cols);
    const panW = cols * cardW + (cols + 1) * gapX;
    const panH = 56 + rows * (cardH + gapY) + gapY + 50;
    const panX = W / 2 - panW / 2, panY = Math.max(20, H / 2 - panH / 2);

    const panel = this.add.graphics();
    panel.fillStyle(0x0E1830, 1);
    panel.fillRoundedRect(panX, panY, panW, panH, 16);
    panel.lineStyle(2, 0x55EEFF, 0.75);
    panel.strokeRoundedRect(panX, panY, panW, panH, 16);
    popup.add(panel);

    popup.add(this.add.text(W / 2, panY + 26, t('ach.title'), {
      fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#88EEFF',
    }).setOrigin(0.5));
    popup.add(this.add.text(W / 2, panY + 44, t('ach.earned', { earned: earned.size, total: ACHIEVEMENTS.length }), {
      fontFamily: FONT, fontSize: '13px', color: '#5588AA',
    }).setOrigin(0.5));

    ACHIEVEMENTS.forEach((a, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = panX + gapX + col * (cardW + gapX);
      const cy = panY + 56 + row * (cardH + gapY);
      const done = earned.has(a.id);

      const cg = this.add.graphics();
      cg.fillStyle(done ? 0x112244 : 0x0A0A1A, 1);
      cg.fillRoundedRect(cx, cy, cardW, cardH, 8);
      cg.lineStyle(1.5, done ? 0x55EEFF : 0x223344, done ? 0.75 : 0.35);
      cg.strokeRoundedRect(cx, cy, cardW, cardH, 8);
      popup.add(cg);

      popup.add(this.add.text(cx + 12, cy + 18, a.emoji + ' ' + a.name, {
        fontFamily: FONT, fontSize: '12px', fontStyle: 'bold',
        color: done ? '#FFFFFF' : '#445566',
      }).setOrigin(0, 0.5));
      popup.add(this.add.text(cx + 12, cy + 36, done ? a.desc : '???', {
        fontFamily: FONT, fontSize: '12px',
        color: done ? '#88AABB' : '#334455',
      }).setOrigin(0, 0.5));
      popup.add(this.add.text(cx + cardW - 8, cy + 18, done ? ('+' + a.diamonds + '💎') : '💎', {
        fontFamily: FONT, fontSize: '13px',
        color: done ? '#88EEFF' : '#334455',
      }).setOrigin(1, 0.5));
    });

    const close = () => popup.destroy();
    popup.add(makeButton(this, W / 2, panY + panH - 28, 120, 40, t('btn.close'), 0x2a1560, close, 13));
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    overlay.on('pointerdown', close);
  }

  private _showAchievementPopup(a: Achievement) {
    const W = this.scale.width, H = this.scale.height;
    const popup = this.add.container(W / 2, H * 0.30).setDepth(60);

    const bg = this.add.graphics();
    bg.fillStyle(0x0A1830, 0.95);
    bg.fillRoundedRect(-130, -40, 260, 80, 14);
    bg.lineStyle(2, 0x55EEFF, 0.9);
    bg.strokeRoundedRect(-130, -40, 260, 80, 14);
    popup.add(bg);

    popup.add(this.add.text(0, -12, a.emoji + ' ' + t('ach.unlocked'), {
      fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#88EEFF',
    }).setOrigin(0.5));
    popup.add(this.add.text(0, 12, a.name + '  +' + a.diamonds + '💎', {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#FFFFFF',
    }).setOrigin(0.5));

    popup.setScale(0);
    this.tweens.add({ targets: popup, scaleX: 1, scaleY: 1, duration: 280, ease: 'Back.Out' });
    this.time.delayedCall(2800, () => {
      this.tweens.add({
        targets: popup, scaleX: 0, scaleY: 0, alpha: 0, duration: 220, ease: 'Back.In',
        onComplete: () => { try { popup.destroy(); } catch { /* ignore */ } },
      });
    });
    this._updateCoinDisplay();
  }

  private _updateQuestBtn() {
    if (!this._questBtn) return;
    const H = this.scale.height, W = this.scale.width;
    const bw = 118, bh = 52, btnY = H - 54;
    const x = W * 3 / 8;
    const unclaimedCount = (Game.state!.quests ?? []).filter(q => q.completed && !q.claimed).length;
    setButtonLabel(this._questBtn, unclaimedCount > 0 ? t('nav.questsDone') : t('nav.quests'));
    setButtonColor(this._questBtn, unclaimedCount > 0 ? 0x4A7A10 : 0x7A6010);
    this._updateQuestDot(x, bw, btnY, bh, unclaimedCount > 0);
  }

  refreshAll() {
    this._bobTweens.forEach(t => { try { t.stop(); } catch { /* ignore */ } });
    this._bobTweens = [];
    this._displayGroup.clear(true, true);

    const newAch = getNewAchievements(Game.state!);
    newAch.forEach(a => this._showAchievementPopup(a));

    const W = this.scale.width;
    const monsters = Game.state!.monsters.filter(m => m.habitatType === this._currentHabitat);
    const eggs     = Game.state!.eggs.filter(e => e.habitatType === this._currentHabitat);
    const capacity = (Game.state!.tanks?.[this._currentHabitat] ?? 1) * TANK_CAPACITY;

    // update dex button label + dot
    const disc = Game.state!.stats.discovered.length;
    const hasNew = (Game.state!.newDiscoveries?.length ?? 0) > 0;
    const H = this.scale.height;
    const bw = 118, bh = 52, btnY = H - 54;
    if (this._dexBtn) {
      setButtonLabel(this._dexBtn, t('nav.dex', { n: disc }));
    }
    if (this._dexDot) this._updateDexDot(W * 5 / 8, bw, btnY, bh, hasNew);
    this._updateQuestBtn();
    this._updateVisitorBanner();

    if (monsters.length === 0 && eggs.length === 0) {
      const emptyTxt = this.add.text(W/2, 460, t('hub.empty'), {
        fontFamily: FONT, fontSize: '18px', color: '#9080C8', align: 'center',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(20);
      this._displayGroup.add(emptyTxt);
      const shopBtn = makeButton(this, W/2, 520, 200, 50, t('hub.goShop'), 0x2a1560, () => {
        Ads.maybeInterstitial(() => { this.scene.start('Merchant'); });
      }, 16).setDepth(20);
      this._displayGroup.add(shopBtn);
    }

    const slots = this._getSlotPositions(W);
    let idx = 0;
    eggs.forEach(egg => { if (idx < slots.length) { this._drawEggTerrarium(slots[idx].x, slots[idx].y, egg); idx++; } });
    monsters.forEach(mon => { if (idx < slots.length) { this._drawTerrarium(slots[idx].x, slots[idx].y, mon); idx++; } });

    const usage = monsters.length + eggs.length;
    if (capacity < MAX_TANKS * TANK_CAPACITY && idx < slots.length) {
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
    const [tankPlateColor, tankNameColor] = HAB_PLATE[this._currentHabitat] ?? [0x4A2808, '#FFD8A8'];
    const plateG = this.add.graphics().setDepth(22);
    plateG.fillStyle(tankPlateColor, 1); plateG.fillRoundedRect(vpX, plateY, vpW, plateH, 4);
    plateG.lineStyle(1.5, 0x000000, 0.50); plateG.strokeRoundedRect(vpX, plateY, vpW, plateH, 4);
    plateG.lineStyle(1, 0xffffff, 0.10); plateG.strokeRoundedRect(vpX + 1, plateY + 1, vpW - 2, plateH - 2, 3);
    this._displayGroup.add(plateG);
    const screwG = this.add.graphics().setDepth(23);
    this._drawScrew(screwG, vpX + 10, plateY + plateH/2); this._drawScrew(screwG, vpX + vpW - 10, plateY + plateH/2);
    this._displayGroup.add(screwG);
    this._displayGroup.add(this.add.text(cx, plateY + plateH/2, t('hub.buyTank'), {
      fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: tankNameColor,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(23));

    const vpCY = vpY + vpH/2;
    this._displayGroup.add(this.add.text(cx, vpCY - 18, '+', {
      fontFamily: FONT, fontSize: '52px', color: '#CCAA60', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(22));
    this._displayGroup.add(this.add.text(cx, vpCY + 28, TANK_COST + ' 💰', {
      fontFamily: FONT, fontSize: '16px', color: '#FFD700',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(22));

    const zone = this.add.zone(cx, cy, CW, CH).setInteractive().setDepth(25);
    zone.on('pointerdown', () => {
      sfx.unlock();
      if (Game.state!.coins < TANK_COST) {
        showToast(this, t('toast.needTankCoins', { amount: TANK_COST }), '#ff9999');
        return;
      }
      Game.state!.coins -= TANK_COST;
      if (!Game.state!.tanks) Game.state!.tanks = { dirt: 1, grass: 1, aquatic: 1 };
      Game.state!.tanks[this._currentHabitat] = Math.min(MAX_TANKS, (Game.state!.tanks[this._currentHabitat] ?? 1) + 1);
      store.setJSON('mps_state', Game.state);
      this._updateCoinDisplay();
      sfx.buy();
      showToast(this, t('toast.tankBought'), '#aaffaa');
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
    const [plateColor, nameColor] = HAB_PLATE[sp.habitat] ?? [0x4A2808, '#FFD8A8'];
    const plateG = this.add.graphics().setDepth(22);
    plateG.fillStyle(plateColor, 1); plateG.fillRoundedRect(vpX, plateY, vpW, plateH, 4);
    plateG.lineStyle(1.5, 0x000000, 0.50); plateG.strokeRoundedRect(vpX, plateY, vpW, plateH, 4);
    plateG.lineStyle(1, 0xffffff, 0.10); plateG.strokeRoundedRect(vpX + 1, plateY + 1, vpW - 2, plateH - 2, 3);
    this._displayGroup.add(plateG);

    const screwG = this.add.graphics().setDepth(23);
    const plateCY = plateY + plateH/2;
    this._drawScrew(screwG, vpX + 10, plateCY); this._drawScrew(screwG, vpX + vpW - 10, plateCY);
    this._displayGroup.add(screwG);

    const displayName = (mon.nickname ?? sp.name).toUpperCase();
    this._displayGroup.add(this.add.text(cx, plateCY, displayName, {
      fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: nameColor,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(23));

    // Level badge top-left
    const lvlLabel = getLevelName(mon.level);
    const lvlBg = this.add.graphics().setDepth(23);
    lvlBg.fillStyle(0x000000, 0.72); lvlBg.fillRoundedRect(vpX + 3, vpY + 3, lvlLabel.length*7.5 + 12, 20, 5);
    this._displayGroup.add(lvlBg);
    this._displayGroup.add(this.add.text(vpX + 7, vpY + 12, lvlLabel, {
      fontFamily: FONT, fontSize: '12px', color: '#FFE066', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(24));

    const monTrait = TRAITS.find(t => t.id === mon.trait);
    if (monTrait) {
      this._displayGroup.add(this.add.text(vpX + vpW - 5, vpY + vpH - 5, monTrait.emoji, {
        fontFamily: FONT, fontSize: '13px',
      }).setOrigin(1, 1).setDepth(24));
    }

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
      banner.fillStyle(ready ? 0x1A7040 : 0x884400, 0.93);
      banner.fillRoundedRect(vpX, vpY, vpW, 22, { tl: 2, tr: 2, bl: 0, br: 0 });
      banner.lineStyle(1, ready ? 0x55EE88 : 0xFFCC44, 0.55);
      banner.strokeRoundedRect(vpX, vpY, vpW, 22, { tl: 2, tr: 2, bl: 0, br: 0 });
      this._displayGroup.add(banner);
      this._displayGroup.add(this.add.text(cx, vpY + 11, ready ? '✓ READY - Tap to collect' : '🏷 For Sale', {
        fontFamily: FONT, fontSize: '12px', color: '#ffffff', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 1,
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
    const [ePlateColor, eNameColor] = HAB_PLATE[sp.habitat] ?? [0x4A2808, '#FFD8A8'];
    const plateG = this.add.graphics().setDepth(22);
    plateG.fillStyle(isReady ? 0x2A5A18 : ePlateColor, 1); plateG.fillRoundedRect(vpX, plateY, vpW, plateH, 4);
    plateG.lineStyle(1.5, 0x000000, 0.50); plateG.strokeRoundedRect(vpX, plateY, vpW, plateH, 4);
    plateG.lineStyle(1, 0xffffff, 0.10); plateG.strokeRoundedRect(vpX + 1, plateY + 1, vpW - 2, plateH - 2, 3);
    this._displayGroup.add(plateG);

    const plateCY = plateY + plateH/2;
    const screwG = this.add.graphics().setDepth(23);
    this._drawScrew(screwG, vpX + 10, plateCY); this._drawScrew(screwG, vpX + vpW - 10, plateCY);
    this._displayGroup.add(screwG);

    this._displayGroup.add(this.add.text(cx, plateCY, isReady ? '🥚 READY!' : sp.name.toUpperCase() + ' EGG', {
      fontFamily: FONT, fontSize: '12px', fontStyle: 'bold',
      color: isReady ? '#CCFFAA' : eNameColor, stroke: '#000000', strokeThickness: 2,
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
        fontFamily: FONT, fontSize: '12px', color: '#CCBBAA',
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
    // hatch quest progress
    (Game.state!.quests ?? []).filter(q => q.type === 'hatch' && !q.completed).forEach(q => {
      q.progress = Math.min(q.target, q.progress + 1);
      if (q.progress >= q.target) q.completed = true;
    });
    store.setJSON('mps_state', Game.state);
    this._updateCoinDisplay();
    this.refreshAll();
  }
}
