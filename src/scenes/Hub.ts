import Phaser from 'phaser';
import { Game, FONT, store, sfx, getNewAchievements, recordQuestProgress, localDateKey, checkAndApplyShopLevelUp, calcShopLevel, applySellSideEffects } from '../utils';
import { SPECIES, HABITATS, TANK_COST, TANK_CAPACITY, MAX_TANKS, getLevelName, AD_COINS_REWARD, AD_COOLDOWN_MS, checkAndUpdateVisitor, VISITOR_DURATION_MS, TRAITS, ACHIEVEMENTS, DAILY_REWARDS, ensureQuestsFresh, calcSellPrice } from '../data';
import { t, currentLang, setLang } from '../i18n';
import type { Achievement } from '../data';
import { makeMonsterTexture, getVariantModifiers, shiftHue, darken, lighten } from '../MonsterRenderer';
import { makeButton, setButtonLabel, setButtonColor } from '../ui/Button';
import { showToast, showFloat } from '../ui/Toast';
import { Ads } from '../ads';
import type { Monster, Egg, HabitatType, GameState } from '../types';

const HAB_PLATE: Record<string, [number, string]> = {
  dirt:    [0x7A4420, '#FFE8B0'],
  grass:   [0x2A6020, '#CCFFAA'],
  aquatic: [0x145070, '#AAFFFF'],
};

const HAB_GLOW: Record<string, number> = {
  dirt:    0xD4884A,
  grass:   0x44CC55,
  aquatic: 0x22AAEE,
};

export class Hub extends Phaser.Scene {
  private _currentHabitat: HabitatType = 'dirt';
  private _unlockPopupActive = false;
  private _eggTimer: Phaser.Time.TimerEvent | null = null;
  private _displayGroup!: Phaser.GameObjects.Group;
  private _tabBtns: Record<string, { bg: Phaser.GameObjects.Graphics; txt: Phaser.GameObjects.Text; milTxt: Phaser.GameObjects.Text }> = {};
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
  private _dailyAdBadge: Phaser.GameObjects.Container | null = null;
  private _eggStripContainer: Phaser.GameObjects.Container | null = null;
  private _eggStripTexts = new Map<string, Phaser.GameObjects.Text>();
  private _bloomTimers: Phaser.Time.TimerEvent[] = [];
  private _bannerTweens: Phaser.Tweens.Tween[] = [];
  private _hatchPrompted = new Set<string>();
  private _featuredAnnouncedId = -1;
  private _shopLvBg!: Phaser.GameObjects.Graphics;
  private _shopLvTxt!: Phaser.GameObjects.Text;
  private _lastShownShopLv = 0;
  private _welcomeActive = false;
  private _hatchPromptActive = false;
  private _instantOfferActive = false;

  constructor() { super({ key: 'Hub' }); }

  create() {
    sfx.unlock();
    ensureQuestsFresh(Game.state!);
    const W = this.scale.width, H = this.scale.height;
    this.cameras.main.fadeIn(180, 0, 0, 0);
    this._displayGroup = this.add.group();

    this._buildBackground(W, H);
    this._buildVignette(W, H);
    this._buildShopSign(W, H);
    this._buildHUD(W);
    this._buildEggTimerStrip(W);
    this._buildTabs(W);
    this._buildBottomNav(W, H);
    this._bgGraphics = this.add.graphics().setDepth(1);
    this._buildHabitatBg(W, H);
    this._buildVisitorBanner(W, H);
    this.refreshAll();
    this._startEggTimer();
    this._startVisitorTimer();
    this._startAmbient(W, H);

    const boot = document.getElementById('boot');
    if (boot) boot.style.display = 'none';

    this.time.delayedCall(400, () => {
      const after = () => {
        this._checkDailyLogin();
        this._restoreDailyAdBadgeIfNeeded();
        this._checkReadyBreedingEggs();
      };
      if (Game.offlineSummary) this._showWelcomeBack(after);
      else after();
    });

    // Merchant's "Quick Hatch" passes the egg id through scene data.
    const launchEggId = (this.scene.settings.data as { launchHatchEggId?: string } | undefined)?.launchHatchEggId;
    if (launchEggId && Game.state!.eggs.some(e => e.id === launchEggId)) {
      this.time.delayedCall(150, () => {
        if (this.scene.isActive()) this.scene.launch('HatchScene', { eggId: launchEggId });
      });
    }
  }

  // Called when the app returns to the foreground (see Boot visibility handler).
  onResume() {
    ensureQuestsFresh(Game.state!);
    this._checkDailyLogin();
    this._checkReadyBreedingEggs();
    this.refreshAll();
  }

  private _formatAway(ms: number): string {
    const mins = Math.max(1, Math.floor(ms / 60000));
    if (mins < 60) return t('welcome.mins', { m: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('welcome.hours', { h: hrs, m: mins % 60 });
    return t('welcome.days', { d: Math.floor(hrs / 24) });
  }

  private _showWelcomeBack(onClose: () => void) {
    const summary = Game.offlineSummary;
    Game.offlineSummary = null;
    if (!summary) { onClose(); return; }
    this._welcomeActive = true;

    const W = this.scale.width, H = this.scale.height;
    const hasEggs = summary.readyEggs > 0;
    const hasVisitor = summary.visitorWaiting;
    const lines = 1 + (hasEggs ? 1 : 0) + (hasVisitor ? 1 : 0);
    const panelH = 170 + lines * 36;
    const top = H / 2 - panelH / 2;

    const popup = this.add.container(0, 0).setDepth(56);
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.7);
    dim.fillRect(0, 0, W, H);
    dim.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    popup.add(dim);

    const panel = this.add.graphics();
    panel.fillStyle(0x0B0722, 1);
    panel.fillRoundedRect(W / 2 - 170, top, 340, panelH, 18);
    panel.lineStyle(2, 0x8A6BFF, 0.85);
    panel.strokeRoundedRect(W / 2 - 170, top, 340, panelH, 18);
    popup.add(panel);

    popup.add(this.add.text(W / 2, top + 38, t('welcome.title'), {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#FFE066',
    }).setOrigin(0.5));

    const rows: string[] = [t('welcome.away', { time: this._formatAway(summary.elapsedMs) })];
    if (hasEggs) rows.push(t('welcome.readyEggs', { n: summary.readyEggs }));
    if (hasVisitor) rows.push(t('welcome.visitor'));

    rows.forEach((row, i) => {
      popup.add(this.add.text(W / 2, top + 82 + i * 36, row, {
        fontFamily: FONT, fontSize: '15px', color: '#DDD8FF',
        align: 'center', wordWrap: { width: 300 },
      }).setOrigin(0.5));
    });

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      this._welcomeActive = false;
      popup.destroy();
      onClose();
    };
    // Tap anywhere to dismiss so this screen can never trap the player.
    dim.on('pointerdown', close);
    popup.add(makeButton(this, W / 2, top + panelH - 44, 200, 48,
      t('welcome.ok'), 0x2A1560, close, 16));

    popup.setAlpha(0);
    this.tweens.add({ targets: popup, alpha: 1, duration: 180, ease: 'Sine.Out' });
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

  private _buildShopSign(_W: number, _H: number) {
    // Sign removed — wooden board showed through the inter-card gap at row 3
  }

  private _startAmbient(W: number, H: number) {
    // Animated lantern glow (pulse on top of static background lanterns)
    const lanternPositions: [number, number][] = [[W * 0.22, 86], [W * 0.78, 90]];
    lanternPositions.forEach(([lx, ly]) => {
      const lg = this.add.graphics().setDepth(1);
      lg.fillStyle(0xFFDD66, 0.24); lg.fillCircle(lx, ly, 28);
      lg.fillStyle(0xFFFF99, 0.12); lg.fillCircle(lx, ly, 44);
      this.tweens.add({
        targets: lg, alpha: { from: 0.50, to: 0.10 },
        duration: 1400 + Math.random() * 700, yoyo: true, repeat: -1, ease: 'Sine.InOut',
      });
    });

    // Floating warm dust motes drifting through the shop
    const spawnDust = () => {
      if (!this.scene?.isActive('Hub')) return;
      const dx = 18 + Math.random() * (W - 36);
      const dy = H * 0.22 + Math.random() * H * 0.58;
      const dc = [0xFFDD88, 0xFFBB44, 0xFFEEBB, 0xFFCC66][Math.floor(Math.random() * 4)];
      const dg = this.add.graphics().setDepth(1);
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

  private _buildHabitatBg(W: number, H: number) {
    const g = this._bgGraphics;
    g.clear();
    g.fillStyle(0x1E0C04, 0.20);
    g.fillRoundedRect(6, 174, W - 12, H - 276, 12);
    g.lineStyle(1.5, 0x6B4A2A, 0.30);
    g.strokeRoundedRect(6, 174, W - 12, H - 276, 12);
  }

  private _buildHUD(W: number) {
    const hud = this.add.graphics().setDepth(10);

    // Coin box — bright pastel amber
    hud.fillStyle(0x000000, 0.18);
    hud.fillRoundedRect(10, 11, 168, 52, 16);
    hud.fillStyle(0xFF9900, 1);
    hud.fillRoundedRect(8, 8, 168, 52, 16);
    hud.lineStyle(3, 0xFFEE44, 1);
    hud.strokeRoundedRect(8, 8, 168, 52, 16);
    hud.fillStyle(0xffffff, 0.30);
    hud.fillRoundedRect(9, 9, 166, 22, { tl: 15, tr: 15, bl: 0, br: 0 });

    // Diamond box — bright pastel cyan
    hud.fillStyle(0x000000, 0.18);
    hud.fillRoundedRect(184, 11, 120, 52, 16);
    hud.fillStyle(0x00AAEE, 1);
    hud.fillRoundedRect(182, 8, 120, 52, 16);
    hud.lineStyle(3, 0x88FFFF, 1);
    hud.strokeRoundedRect(182, 8, 120, 52, 16);
    hud.fillStyle(0xffffff, 0.30);
    hud.fillRoundedRect(183, 9, 118, 22, { tl: 15, tr: 15, bl: 0, br: 0 });

    this._coinTxt = this.add.text(92, 34, '💰 ' + String(Game.state!.coins), {
      fontFamily: FONT, fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(11);

    this._diamondTxt = this.add.text(242, 34, '💎 ' + String(Game.state!.diamonds ?? 0), {
      fontFamily: FONT, fontSize: '22px', color: '#88EEFF', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0.5).setDepth(11);

    // Tap diamond box → open Merchant gems tab
    this.add.zone(242, 34, 120, 52).setDepth(14).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        Ads.maybeInterstitial(() => this.scene.start('Merchant', { openTab: 'gems' }));
      });

    // Free-coins ad button (sits between diamond box and sound icon)
    this._adBtn = makeButton(this, 362, 34, 96, 40, this._adBtnLabel(), 0x1EA040, () => {
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

    const helpBg = this.add.graphics().setDepth(11);
    helpBg.fillStyle(0x7733DD, 1);
    helpBg.fillCircle(W - 22, 34, 16);
    helpBg.lineStyle(2, 0xCC99FF, 1);
    helpBg.strokeCircle(W - 22, 34, 16);
    this.add.text(W - 22, 34, '?', {
      fontFamily: FONT, fontSize: '20px', color: '#FFFFFF', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(11).setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Circle(0, 0, 18), hitAreaCallback: Phaser.Geom.Circle.Contains })
      .on('pointerdown', () => { this.scene.launch('HowToPlay'); });

    // Shop Level Badge — tap to view daily check-in
    this._shopLvBg = this.add.graphics().setDepth(12);
    this.add.text(28, 30, 'Lv', { fontFamily: FONT, fontSize: '9px', color: '#FFFFFF', fontStyle: 'bold' }).setOrigin(0.5).setDepth(13);
    this._shopLvTxt = this.add.text(28, 40, '', { fontFamily: FONT, fontSize: '14px', color: '#FFFFFF', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5).setDepth(13);
    this.add.zone(28, 34, 50, 50).setInteractive({ useHandCursor: true }).setDepth(14)
      .on('pointerdown', () => this._showDailyCheckInView());
    this._updateShopBadge();
  }

  private _updateShopBadge() {
    const shopLv = calcShopLevel(Game.state!.stats.sold);
    if (shopLv === this._lastShownShopLv) return;
    this._lastShownShopLv = shopLv;
    const isMilestone = shopLv % 5 === 0;
    this._shopLvBg.clear();
    this._shopLvBg.fillStyle(isMilestone ? 0xFFAA00 : 0x5522AA, 1);
    this._shopLvBg.fillCircle(28, 34, 22);
    this._shopLvBg.lineStyle(3, isMilestone ? 0xFFEE44 : 0xCC88FF, 1);
    this._shopLvBg.strokeCircle(28, 34, 22);
    this._shopLvTxt.setText(String(shopLv));
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
        // Guard against a second ad callback before the cooldown is written.
        if (this._adCooldownRemaining() > 0) return;
        Game.state!.coins += AD_COINS_REWARD;
        Game.state!.adCooldownAt = Date.now() + AD_COOLDOWN_MS;
        store.setJSON('mps_state', Game.state);
        this._updateCoinDisplay();
        sfx.buy();
        showToast(this, t('toast.adGot', { n: AD_COINS_REWARD }), '#aaffaa');
      }
    });
  }

  private _buildEggTimerStrip(W: number) {
    // Dark bar background spanning Y=76–122, depth 7 (above HUD, below tabs)
    const bar = this.add.graphics().setDepth(7);
    bar.fillStyle(0x07040F, 0.82);
    bar.fillRect(0, 76, W, 46);
    bar.lineStyle(1.5, 0x2A1A50, 1);
    bar.beginPath(); bar.moveTo(0, 76); bar.lineTo(W, 76); bar.strokePath();
    bar.lineStyle(1, 0x3A2A60, 0.7);
    bar.beginPath(); bar.moveTo(0, 121); bar.lineTo(W, 121); bar.strokePath();

    this._eggStripContainer = this.add.container(0, 0).setDepth(8);
    this._updateEggTimerStrip();
  }

  private _updateEggTimerStrip() {
    if (!this._eggStripContainer) return;
    this._eggStripContainer.removeAll(true);
    this._eggStripTexts.clear();
    const W = this.scale.width;
    const eggs = Game.state?.eggs ?? [];
    const stripCY = 99; // vertical center of 76-122

    if (eggs.length === 0) {
      const pillW = 160, pillH = 28;
      const cx = W / 2;
      const pill = this.add.graphics();
      pill.fillStyle(0x1A0A40, 0.9);
      pill.fillRoundedRect(cx - pillW / 2, stripCY - pillH / 2, pillW, pillH, 12);
      pill.lineStyle(1.5, 0x6644CC, 0.8);
      pill.strokeRoundedRect(cx - pillW / 2, stripCY - pillH / 2, pillW, pillH, 12);
      this._eggStripContainer.add(pill);
      this._eggStripContainer.add(this.add.text(cx, stripCY, '🥚 + ' + t('egg.buy'), {
        fontFamily: FONT, fontSize: '13px', color: '#9988DD', fontStyle: 'bold',
      }).setOrigin(0.5));
      const zone = this.add.zone(cx, stripCY, pillW, pillH).setInteractive();
      zone.on('pointerdown', () => { this.scene.start('Merchant'); });
      this._eggStripContainer.add(zone);
      return;
    }

    const maxShow = Math.min(eggs.length, 4);
    const pillW = Math.min(118, Math.floor((W - 24) / maxShow) - 4);
    const gap = 4;
    const totalW = pillW * maxShow + gap * (maxShow - 1);
    const startX = (W - totalW) / 2;
    const now = Date.now();

    eggs.slice(0, maxShow).forEach((egg, i) => {
      const cx = startX + i * (pillW + gap) + pillW / 2;
      const remaining = Math.max(0, egg.hatchEndAt - now);
      const ready = remaining <= 0;

      const pill = this.add.graphics();
      pill.fillStyle(ready ? 0x0D3018 : 0x0C0828, 0.95);
      pill.fillRoundedRect(cx - pillW / 2, stripCY - 14, pillW, 28, 9);
      const borderCol = ready ? 0x44FF88 : (HAB_GLOW[egg.habitatType] ?? 0x6644CC);
      pill.lineStyle(1.5, borderCol, ready ? 1 : 0.75);
      pill.strokeRoundedRect(cx - pillW / 2, stripCY - 14, pillW, 28, 9);
      this._eggStripContainer!.add(pill);

      const label = ready ? '✨ Ready!' : ('🥚 ' + this._formatMs(remaining));
      const txt = this.add.text(cx, stripCY - 3, label, {
        fontFamily: FONT, fontSize: '11px',
        color: ready ? '#88FFAA' : '#AABBFF', fontStyle: ready ? 'bold' : 'normal',
      }).setOrigin(0.5);
      this._eggStripTexts.set(egg.id, txt);
      this._eggStripContainer!.add(txt);

      const sp = SPECIES[egg.speciesId];
      this._eggStripContainer!.add(this.add.text(cx, stripCY + 8, sp.name.slice(0, 7), {
        fontFamily: FONT, fontSize: '9px', color: '#887799',
      }).setOrigin(0.5));

      const zone = this.add.zone(cx, stripCY, pillW, 28).setInteractive();
      zone.on('pointerdown', () => { this.scene.start('Merchant'); });
      this._eggStripContainer!.add(zone);
    });

    if (eggs.length > maxShow) {
      this._eggStripContainer!.add(this.add.text(W - 8, stripCY, '+' + (eggs.length - maxShow), {
        fontFamily: FONT, fontSize: '11px', color: '#9988DD',
      }).setOrigin(1, 0.5));
    }
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
      this._drawTab(tabBg, x, 122, tabW, 60, isActive, unlocked, type);
      const lbl = unlocked ? labels[type] : (labels[type] + ' 🔒');
      const tabTxt = this.add.text(x + tabW/2, unlocked ? 141 : 148, lbl, {
        fontFamily: FONT, fontSize: '17px', fontStyle: isActive ? 'bold' : 'normal',
        color: isActive ? '#FFFFFF' : (unlocked ? '#E8D8C8' : '#BBAA99'),
      }).setOrigin(0.5).setDepth(6);
      const milTxt = this.add.text(x + tabW/2, 165, '', {
        fontFamily: FONT, fontSize: '11px', color: '#FFD700', align: 'center',
      }).setOrigin(0.5).setDepth(6);
      this._tabBtns[type] = { bg: tabBg, txt: tabTxt, milTxt };
      const zone = this.add.zone(x + tabW/2, 152, tabW - 4, 56).setInteractive().setDepth(7);
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
      dirt:    [0xE07830, 0x9B5428, 0xFFCC88],
      grass:   [0x44BB22, 0x2A7A14, 0xAAFF55],
      aquatic: [0x1199DD, 0x0668A0, 0x66EEFF],
    };
    const [activeCol, inactiveCol, borderCol] = baseColors[habitat ?? 'dirt'];
    const lockedCol: Record<string, number> = { dirt: 0x2A1208, grass: 0x0A2208, aquatic: 0x041828 };
    const fillCol = active ? activeCol : (unlocked ? inactiveCol : lockedCol[habitat ?? 'dirt']);
    g.fillStyle(fillCol, active ? 1 : (unlocked ? 0.82 : 0.65));
    g.fillRoundedRect(x + 2, y, w - 4, h, { tl: 12, tr: 12, bl: 0, br: 0 });
    if (active) {
      g.lineStyle(3, borderCol, 1);
      g.strokeRoundedRect(x + 2, y, w - 4, h, { tl: 12, tr: 12, bl: 0, br: 0 });
      g.fillStyle(borderCol, 0.60);
      g.fillRoundedRect(x + 6, y + 2, w - 12, 5, 3);
    } else if (unlocked) {
      g.lineStyle(2, borderCol, 0.40);
      g.strokeRoundedRect(x + 2, y, w - 4, h, { tl: 12, tr: 12, bl: 0, br: 0 });
    } else {
      g.lineStyle(1.5, borderCol, 0.25);
      g.strokeRoundedRect(x + 2, y, w - 4, h, { tl: 12, tr: 12, bl: 0, br: 0 });
    }

    // Habitat illustrations at the bottom of each tab
    const alpha = active ? 0.85 : (unlocked ? 0.55 : 0.30);
    const mx = x + w / 2;
    const by = y + h - 6;
    if (habitat === 'dirt') {
      g.fillStyle(0xD4A870, alpha);
      g.fillEllipse(mx, by - 4, 36, 12);
      g.fillStyle(0xB88050, alpha * 0.8);
      g.fillCircle(mx - 12, by - 9, 7);
      g.fillCircle(mx + 11, by - 8, 6);
    } else if (habitat === 'grass') {
      g.fillStyle(0x88EE33, alpha);
      g.fillEllipse(mx, by - 5, 38, 14);
      g.fillStyle(0x55CC11, alpha * 0.8);
      g.fillCircle(mx - 14, by - 10, 8);
      g.fillCircle(mx + 13, by - 9, 7);
    } else if (habitat === 'aquatic') {
      g.fillStyle(0x88EEFF, alpha * 0.85);
      g.fillEllipse(mx - 6, by - 5, 28, 10);
      g.fillStyle(0x55CCFF, alpha * 0.65);
      g.fillEllipse(mx + 10, by - 4, 22, 8);
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
      this._drawTab(btn.bg, x, 122, tabW, 60, isActive, unlocked, type);
      if (!unlocked) {
        const cost = HABITATS[type].unlockCost;
        btn.txt.setY(148);
        btn.txt.setStyle({ fontSize: '13px', color: '#A09088', fontStyle: 'normal', align: 'center' });
        btn.txt.setText(labels[type] + '\n🔒 ' + cost + ' 🪙');
        btn.milTxt.setText('');
      } else {
        const mCount = (Game.state!.habitatMilestones?.[type as 'dirt' | 'grass' | 'aquatic'] ?? 0);
        const nextThresh = mCount < 5 ? 5 : mCount < 10 ? 10 : mCount < 20 ? 20 : 0;
        btn.txt.setY(141);
        btn.txt.setStyle({
          fontSize: '17px',
          color: isActive ? '#FFFFFF' : '#E8D8C8',
          fontStyle: isActive ? 'bold' : 'normal',
        });
        btn.txt.setText(labels[type]);
        const milLabel = nextThresh > 0 ? (mCount + '/' + nextThresh + ' ⭐') : '+30% ⭐⭐';
        btn.milTxt.setText(milLabel);
        btn.milTxt.setColor(isActive ? '#FFD700' : '#CCBB88');
      }
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

  private _getHabitatCardBg(habitat?: HabitatType): number {
    switch (habitat ?? this._currentHabitat) {
      case 'dirt':    return 0x1E0C06;
      case 'grass':   return 0x081406;
      case 'aquatic': return 0x06101A;
      default:        return 0x14102A;
    }
  }

  private _drawGlassCard(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, glowColor: number, bgColor?: number) {
    const r = 14;
    const fill = bgColor ?? 0x14102A;
    g.fillStyle(0x000000, 0.42);
    g.fillRoundedRect(x + 4, y + 6, w, h, r);
    g.fillStyle(glowColor, 0.10);
    g.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, r + 2);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(x, y, w, h, r);
    g.lineStyle(2, glowColor, 0.80);
    g.strokeRoundedRect(x, y, w, h, r);
    g.fillStyle(0xffffff, 0.05);
    g.fillRoundedRect(x + 3, y + 2, w - 6, h * 0.30, { tl: r - 2, tr: r - 2, bl: 0, br: 0 });
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
    const btnY = H - 54, bw = 100, bh = 52;
    const xs = [W/10, W*3/10, W/2, W*7/10, W*9/10];

    // Unified dark nav bar
    const navBg = this.add.graphics().setDepth(9);
    navBg.fillStyle(0x0E0B1C, 1);
    navBg.fillRect(0, H - 108, W, 108);
    navBg.lineStyle(1, 0x2A2050, 1);
    navBg.beginPath(); navBg.moveTo(0, H - 108); navBg.lineTo(W, H - 108); navBg.strokePath();

    const NAV_COLOR = 0x1A1040;

    makeButton(this, xs[0], btnY, bw, bh, t('nav.shop'), NAV_COLOR, () => {
      Ads.maybeInterstitial(() => { this.scene.start('Merchant'); });
    }, 15).setDepth(10);

    const unclaimedCount = [...(Game.state!.quests ?? []), ...(Game.state!.weeklyQuests ?? [])].filter(q => q.completed && !q.claimed).length;
    const questLabel = unclaimedCount > 0 ? t('nav.questsDone') : t('nav.quests');
    this._questBtn = makeButton(this, xs[1], btnY, bw, bh, questLabel, unclaimedCount > 0 ? 0x22AA44 : NAV_COLOR, () => {
      this._showQuestsPanel();
    }, 14).setDepth(10);
    this._questDot = this.add.graphics().setDepth(12);
    this._updateQuestDot(xs[1], bw, btnY, bh, unclaimedCount > 0);

    const disc = Game.state!.stats.discovered.length;
    const hasNew = (Game.state!.newDiscoveries?.length ?? 0) > 0;
    this._dexBtn = makeButton(this, xs[2], btnY, bw, bh, t('nav.dex', { n: disc }), NAV_COLOR, () => {
      this.scene.start('PokedexScene');
    }, 13).setDepth(10);
    this._dexDot = this.add.graphics().setDepth(12);
    this._dexDotTxt = this.add.text(xs[2] + bw / 2 - 6, btnY - bh / 2 + 2, '!', {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(13);
    this._updateDexDot(xs[2], bw, btnY, bh, hasNew);

    makeButton(this, xs[3], btnY, bw, bh, t('nav.breed'), NAV_COLOR, () => {
      const eligible = Game.state!.monsters.filter(m => m.level >= 4);
      if (eligible.length < 2) {
        showToast(this, t('toast.need2monsters'), '#ff9999');
      } else {
        Ads.maybeInterstitial(() => { this.scene.start('BreedingLab'); });
      }
    }, 14).setDepth(10);

    makeButton(this, xs[4], btnY, bw, bh, t('nav.visit'), NAV_COLOR, () => {
      this.scene.start('VisitScene');
    }, 13).setDepth(10);
  }

  private _addBtnShimmer(cx: number, cy: number, w: number, h: number, startDelay: number) {
    const r = Math.min(Math.floor(h / 2), 28);

    // Geometry mask — clips sheen to the pill shape
    const maskG = this.add.graphics();
    maskG.fillStyle(0xffffff, 1);
    maskG.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, r);
    const mask = maskG.createGeometryMask();
    maskG.setVisible(false);

    // Sheen stripe drawn in world coords, initially hidden far left
    const slant = 10, sw = 28;
    const sheen = this.add.graphics().setDepth(11).setMask(mask);
    sheen.fillStyle(0xffffff, 0.26);
    sheen.fillPoints([
      { x: cx - w / 2 - slant,      y: cy - h / 2 },
      { x: cx - w / 2 - slant + sw, y: cy - h / 2 },
      { x: cx - w / 2 + slant + sw, y: cy + h / 2 },
      { x: cx - w / 2 + slant,      y: cy + h / 2 },
    ], true);
    sheen.x = -(w + sw);   // start off-screen left

    this.time.addEvent({
      delay: 2200,
      loop: true,
      startAt: startDelay % 2200,
      callback: () => {
        if (!sheen?.active) return;
        this.tweens.add({
          targets: sheen,
          x: { from: -(w + sw), to: w + sw },
          duration: 500,
          ease: 'Quad.Out',
        });
      },
    });
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
    if (this._unlockPopupActive) return;
    const cost = HABITATS[type].unlockCost;
    const hName = t('habitat.' + type);
    if (Game.state!.coins < cost) {
      showToast(this, t('toast.needCoinsUnlock', { cost, name: hName }), '#ff9999');
      return;
    }
    this._unlockPopupActive = true;
    this._showUnlockConfirm(type, hName, cost);
  }

  private _showUnlockConfirm(type: HabitatType, hName: string, cost: number) {
    const W = this.scale.width, H = this.scale.height;
    const popup = this.add.container(W / 2, H / 2).setDepth(50);

    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.55);
    dim.fillRect(-W / 2, -H / 2, W, H);
    dim.setInteractive(new Phaser.Geom.Rectangle(-W / 2, -H / 2, W, H), Phaser.Geom.Rectangle.Contains);

    const panel = this.add.graphics();
    panel.fillStyle(0x1a0a3a, 1);
    panel.fillRoundedRect(-160, -110, 320, 220, 18);
    panel.lineStyle(2, 0x8866CC, 1);
    panel.strokeRoundedRect(-160, -110, 320, 220, 18);
    panel.fillStyle(0x6644AA, 0.12);
    panel.fillRoundedRect(-158, -108, 316, 52, { tl: 16, tr: 16, bl: 0, br: 0 });

    const habColors: Record<string, string> = { dirt: '#FFCC88', grass: '#AAFFAA', aquatic: '#AAEEFF' };
    const title = this.add.text(0, -82, '🔓 ' + hName, {
      fontFamily: FONT, fontSize: '20px', fontStyle: 'bold',
      color: habColors[type] ?? '#FFFFFF',
    }).setOrigin(0.5);

    const body = this.add.text(0, -20, t('confirm.unlock', { cost }), {
      fontFamily: FONT, fontSize: '15px', color: '#CCCCEE',
      align: 'center', wordWrap: { width: 280 },
    }).setOrigin(0.5);

    const coins = this.add.text(0, 30, '💰 ' + cost, {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#FFD700',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    popup.add([dim, panel, title, body, coins]);

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      this._unlockPopupActive = false;
      popup.destroy();
    };

    const confirmBtn = makeButton(this, -75, 80, 130, 44, t('btn.confirm'), 0x226611, () => {
      if (closed) return;
      if (Game.state!.coins < cost) {
        showToast(this, t('toast.needCoinsUnlock', { cost, name: hName }), '#ff9999');
        close();
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
      close();
    }, 15);

    const cancelBtn = makeButton(this, 75, 80, 130, 44, t('btn.cancel'), 0x441122, close, 15);

    popup.add([confirmBtn, cancelBtn]);
    dim.on('pointerdown', close);
  }

  private _buildVisitorBanner(W: number, H: number) {
    this._visitorBanner = this.add.container(0, H - 160).setDepth(14);
    this._updateVisitorBanner();
  }

  private _updateVisitorBanner() {
    if (!this._visitorBanner) return;
    this._bannerTweens.forEach(t => t.stop());
    this._bannerTweens = [];
    this._visitorBanner.removeAll(true);
    const state = Game.state!;
    const W = this.scale.width;
    const H = this.scale.height;
    const now = Date.now();

    const isRushHour = !!(state.rushHourUntil && now < state.rushHourUntil);
    const hasVisitor = !!(state.visitorSpeciesId && state.visitorExpiresAt && now < state.visitorExpiresAt);
    const isBannerActive = hasVisitor || isRushHour;

    // Pre-compute quest state so we can stack them when a banner is active
    const quests = state.quests ?? [];
    const weekly = state.weeklyQuests ?? [];
    const unclaimed = [...quests, ...weekly].filter(q => q.completed && !q.claimed);
    const active = quests.find(q => !q.completed) ?? weekly.find(q => !q.completed);
    const activeIsWeekly = !quests.find(q => !q.completed) && !!weekly.find(q => !q.completed);
    const hasQuestContent = unclaimed.length > 0 || !!active;

    // When banner + quest both active: raise container to make room for mini quest row
    const stacking = isBannerActive && hasQuestContent;
    this._visitorBanner.setY(stacking ? H - 168 : H - 160);

    if (isBannerActive) {
      // ── Mini quest row (shown above visitor/rush banner when stacking) ───────
      if (stacking) {
        const mH = 28;
        if (unclaimed.length > 0) {
          const mqBg = this.add.graphics();
          mqBg.fillStyle(0x0A2808, 0.92);
          mqBg.fillRoundedRect(8, 0, W - 16, mH, 8);
          mqBg.lineStyle(1.5, 0x44CC22, 0.75);
          mqBg.strokeRoundedRect(8, 0, W - 16, mH, 8);
          this._visitorBanner.add(mqBg);
          this._visitorBanner.add(this.add.text(W / 2, mH / 2, '✅ ' + t('quest.chipClaim', { n: unclaimed.length, s: unclaimed.length > 1 ? 's' : '' }), {
            fontFamily: FONT, fontSize: '12px', color: '#88FF66', fontStyle: 'bold',
          }).setOrigin(0.5));
        } else if (active) {
          const mqBg = this.add.graphics();
          const prog = Math.min(active.progress, active.target);
          const pct = prog / active.target;
          mqBg.fillStyle(0x0A0618, 0.92);
          mqBg.fillRoundedRect(8, 0, W - 16, mH, 8);
          mqBg.lineStyle(1.5, 0x7755BB, 0.75);
          mqBg.strokeRoundedRect(8, 0, W - 16, mH, 8);
          this._visitorBanner.add(mqBg);
          const barG = this.add.graphics();
          const barX = 14, barY = mH - 7, barW = W - 100, barH = 4;
          barG.fillStyle(0x1A0D30, 1); barG.fillRoundedRect(barX, barY, barW, barH, 2);
          barG.fillStyle(0xAA88FF, 1); barG.fillRoundedRect(barX, barY, Math.max(5, barW * pct), barH, 2);
          this._visitorBanner.add(barG);
          this._visitorBanner.add(this.add.text(14, mH / 2 - 1, '🎯 ' + active.label, {
            fontFamily: FONT, fontSize: '11px', color: '#CCB8FF',
          }).setOrigin(0, 0.5));
          this._visitorBanner.add(this.add.text(W - 20, mH / 2, '+' + active.coinReward + '💰 ›', {
            fontFamily: FONT, fontSize: '11px', color: '#FFD700',
          }).setOrigin(1, 0.5));
        }
        const mqZone = this.add.zone(W / 2, mH / 2, W - 16, mH).setInteractive();
        mqZone.on('pointerdown', () => this._showQuestsPanel());
        this._visitorBanner.add(mqZone);
      }

      // ── Visitor / Rush Hour banner ─────────────────────────────────────────
      const yOff = stacking ? 32 : 0;

      if (hasVisitor) {
        const sp = SPECIES[state.visitorSpeciesId!];
        const remaining = Math.max(0, state.visitorExpiresAt! - now);
        const mins = Math.ceil(remaining / 60000);
        const hasMon = state.monsters.some(m => m.speciesId === state.visitorSpeciesId);
        const totalMult = this._effectiveVisitorMult(state);

        const bg = this.add.graphics();
        if (isRushHour) {
          bg.fillStyle(0x7A1500, 0.97);
          bg.fillRoundedRect(8, yOff, W - 16, 32, 10);
          bg.lineStyle(2, 0xFF6600, 1);
          bg.strokeRoundedRect(8, yOff, W - 16, 32, 10);
        } else {
          bg.fillStyle(0x5A3800, 0.95);
          bg.fillRoundedRect(8, yOff, W - 16, 32, 10);
          bg.lineStyle(2, 0xFFCC00, 0.9);
          bg.strokeRoundedRect(8, yOff, W - 16, 32, 10);
        }
        this._visitorBanner.add(bg);

        const prefix = isRushHour ? '⚡ Rush Hour! ' : '';
        const bannerMsg = prefix + t('visitor.banner', { name: sp.name, mult: totalMult, mins })
          + (hasMon ? '' : ' ' + t('visitor.bannerNone'));
        this._visitorBanner.add(this.add.text(W / 2, yOff + 16, bannerMsg, {
          fontFamily: FONT, fontSize: '13px', color: isRushHour ? '#FF9944' : (hasMon ? '#FFE066' : '#BB9944'), fontStyle: 'bold',
        }).setOrigin(0.5));

        if (isRushHour) {
          const pulse = this.add.graphics();
          pulse.lineStyle(2, 0xFF4400, 0.6);
          pulse.strokeRoundedRect(8, yOff, W - 16, 32, 10);
          this._visitorBanner.add(pulse);
          this._bannerTweens.push(this.tweens.add({ targets: pulse, alpha: 0.1, duration: 500, ease: 'Sine.InOut', yoyo: true, repeat: -1 }));
        }

        const zone = this.add.zone(W / 2, yOff + 16, W - 16, 32).setInteractive();
        zone.on('pointerdown', () => this._showVisitorPopup());
        this._visitorBanner.add(zone);
      } else {
        // Standalone Rush Hour (no visitor yet)
        const rushMinsLeft = Math.ceil(((state.rushHourUntil ?? 0) - now) / 60000);
        const bg = this.add.graphics();
        bg.fillStyle(0x7A1500, 0.97);
        bg.fillRoundedRect(8, yOff, W - 16, 32, 10);
        bg.lineStyle(2, 0xFF6600, 1);
        bg.strokeRoundedRect(8, yOff, W - 16, 32, 10);
        this._visitorBanner.add(bg);
        this._visitorBanner.add(this.add.text(W / 2, yOff + 16, t('visitor.rushHourBanner', { mins: rushMinsLeft }), {
          fontFamily: FONT, fontSize: '13px', color: '#FF9944', fontStyle: 'bold',
        }).setOrigin(0.5));
        const pulse = this.add.graphics();
        pulse.lineStyle(2, 0xFF4400, 0.6);
        pulse.strokeRoundedRect(8, yOff, W - 16, 32, 10);
        this._visitorBanner.add(pulse);
        this._bannerTweens.push(this.tweens.add({ targets: pulse, alpha: 0.1, duration: 500, ease: 'Sine.InOut', yoyo: true, repeat: -1 }));
        const zone = this.add.zone(W / 2, yOff + 16, W - 16, 32).setInteractive();
        zone.on('pointerdown', () => this._showVisitorPopup());
        this._visitorBanner.add(zone);
      }
      return;
    }

    // ── Quest chip (shown when no visitor/rush hour) ───────────────────────────
    if (unclaimed.length > 0) {
      const bg = this.add.graphics();
      bg.fillStyle(0x1A4010, 0.95);
      bg.fillRoundedRect(8, 0, W - 16, 32, 10);
      bg.lineStyle(2, 0x66FF44, 0.85);
      bg.strokeRoundedRect(8, 0, W - 16, 32, 10);
      this._visitorBanner.add(bg);
      this._visitorBanner.add(this.add.text(W / 2, 16, '✅ ' + t('quest.chipClaim', { n: unclaimed.length, s: unclaimed.length > 1 ? 's' : '' }), {
        fontFamily: FONT, fontSize: '13px', color: '#AAFFAA', fontStyle: 'bold',
      }).setOrigin(0.5));
      const zone = this.add.zone(W / 2, 16, W - 16, 32).setInteractive();
      zone.on('pointerdown', () => this._showQuestsPanel());
      this._visitorBanner.add(zone);
    } else if (active) {
      const chipH = 44;
      const bg = this.add.graphics();
      bg.fillStyle(activeIsWeekly ? 0x120828 : 0x0E0620, 0.94);
      bg.fillRoundedRect(8, 0, W - 16, chipH, 10);
      bg.lineStyle(1.5, activeIsWeekly ? 0xCC88FF : 0x7755BB, 0.80);
      bg.strokeRoundedRect(8, 0, W - 16, chipH, 10);
      this._visitorBanner.add(bg);

      const prog = Math.min(active.progress, active.target);
      const pct = prog / active.target;
      const barX = 14, barY = chipH - 10, barW = W - 100, barH = 5;
      const barG = this.add.graphics();
      barG.fillStyle(activeIsWeekly ? 0x3A1660 : 0x2A1650, 1); barG.fillRoundedRect(barX, barY, barW, barH, 2.5);
      barG.fillStyle(activeIsWeekly ? 0xEEAAFF : 0xBB99FF, 1); barG.fillRoundedRect(barX, barY, Math.max(6, barW * pct), barH, 2.5);
      this._visitorBanner.add(barG);

      this._visitorBanner.add(this.add.text(14, chipH / 2 - 6, (activeIsWeekly ? '📅' : '🎯') + ' ' + active.label, {
        fontFamily: FONT, fontSize: '12px', color: activeIsWeekly ? '#FFCCFF' : '#DDD0FF', fontStyle: 'bold',
      }).setOrigin(0, 0.5));
      this._visitorBanner.add(this.add.text(14, chipH / 2 + 8, prog + ' / ' + active.target, {
        fontFamily: FONT, fontSize: '11px', color: activeIsWeekly ? '#CC99EE' : '#AA99DD',
      }).setOrigin(0, 0.5));
      // Weekly quests may have diamond/crystal rewards — show them
      const rewardParts: string[] = ['+' + active.coinReward + '💰'];
      if (activeIsWeekly && (active as any).diamondReward) rewardParts.push('+' + (active as any).diamondReward + '💎');
      if (activeIsWeekly && (active as any).crystalReward) rewardParts.push('+' + (active as any).crystalReward + '🌙');
      this._visitorBanner.add(this.add.text(W - 22, chipH / 2, rewardParts.join('  ') + '  ›', {
        fontFamily: FONT, fontSize: activeIsWeekly ? '11px' : '13px', color: '#FFD700', fontStyle: 'bold',
      }).setOrigin(1, 0.5));

      const zone = this.add.zone(W / 2, chipH / 2, W - 16, chipH).setInteractive();
      zone.on('pointerdown', () => this._showQuestsPanel());
      this._visitorBanner.add(zone);
    }
  }

  private _tickRushHour(state: GameState): void {
    const now = Date.now();
    if (state.rushHourUntil && now >= state.rushHourUntil) {
      state.rushHourUntil = 0;
    }
    if (!state.rushHourUntil && state.rushHourNextAt && now >= state.rushHourNextAt) {
      state.rushHourUntil = now + 600000;
      // Advance to next 12:00 or 20:00
      const d = new Date();
      const noon = new Date(d); noon.setHours(12, 0, 0, 0);
      const eve  = new Date(d); eve.setHours(20, 0, 0, 0);
      const tmrNoon = new Date(noon); tmrNoon.setDate(tmrNoon.getDate() + 1);
      const h = d.getHours();
      if (h < 12) state.rushHourNextAt = noon.getTime();
      else if (h < 20) state.rushHourNextAt = eve.getTime();
      else state.rushHourNextAt = tmrNoon.getTime();
    }
  }

  private _startVisitorTimer() {
    if (this._visitorTimer) this._visitorTimer.remove();
    this._visitorTimer = this.time.addEvent({
      delay: 10000, loop: true, callback: () => {
        const state = Game.state!;
        checkAndUpdateVisitor(state);
        this._tickRushHour(state);
        this._updateVisitorBanner();
        store.setJSON('mps_state', state);
      },
    });
  }

  private _checkDailyLogin() {
    if (this._welcomeActive) return;
    const state = Game.state!;
    const today = localDateKey();
    if (state.lastLoginDate === today) return;

    const yesterday = localDateKey(Date.now() - 86400000);
    if (state.lastLoginDate === yesterday) {
      state.loginStreak = (state.loginStreak ?? 0) + 1;
    } else {
      state.loginStreak = 1;
    }
    if ((state.loginStreak ?? 0) > (state.longestStreak ?? 0)) {
      state.longestStreak = state.loginStreak;
    }
    state.lastLoginDate = today;

    const dayIdx = ((state.loginStreak! - 1) % DAILY_REWARDS.length);
    const reward = DAILY_REWARDS[dayIdx];
    state.coins += reward.coins;
    state.diamonds = (state.diamonds ?? 0) + reward.diamonds;
    store.setJSON('mps_state', state);
    if (this._coinTxt) this._coinTxt.setText('💰 ' + state.coins);
    if (this._diamondTxt) this._diamondTxt.setText('💎 ' + (state.diamonds ?? 0));

    if (state.wheelClaimedDate !== today) {
      this._showSpinWheel(reward, state.loginStreak!);
    } else {
      this._showDailyLoginPopup(reward, state.loginStreak!);
    }
  }

  private _showSpinWheel(streakReward: typeof DAILY_REWARDS[0], streak: number) {
    const W = this.scale.width, H = this.scale.height;
    const state = Game.state!;
    const today = localDateKey();

    const SEGS = [
      { label: '50💰',  coins: 50,  diamonds: 0, crystals: 0, weight: 3, color: 0xF57C00, border: 0xFFCC44 },
      { label: '150💰', coins: 150, diamonds: 0, crystals: 0, weight: 2, color: 0xFFAA00, border: 0xFFEE88 },
      { label: '1💎',   coins: 0,   diamonds: 1, crystals: 0, weight: 2, color: 0x2244BB, border: 0x88AAFF },
      { label: '3💎',   coins: 0,   diamonds: 3, crystals: 0, weight: 2, color: 0x113399, border: 0x5588FF },
      { label: '1🌙',   coins: 0,   diamonds: 0, crystals: 1, weight: 1, color: 0x4A0080, border: 0xCC88FF },
    ] as const;

    const totalWeight = SEGS.reduce((s, sg) => s + sg.weight, 0);
    let r = Math.floor(Math.random() * totalWeight);
    let winner = 0;
    for (let i = 0; i < SEGS.length; i++) { r -= SEGS[i].weight; if (r < 0) { winner = i; break; } }

    // Build angle ranges (0°=top, clockwise)
    const segAngles: { start: number; end: number; mid: number }[] = [];
    let cur = 0;
    for (const sg of SEGS) {
      const span = (sg.weight / totalWeight) * 360;
      segAngles.push({ start: cur, end: cur + span, mid: cur + span / 2 });
      cur += span;
    }

    // Target: pointer at top (0° in our coordinate), spin 3 full rotations + alignment
    const winnerMid = segAngles[winner].mid;
    const toTop = ((360 - winnerMid) % 360);
    const targetAngle = toTop + 3 * 360;

    const popup = this.add.container(0, 0).setDepth(65);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.82);
    overlay.fillRect(0, 0, W, H);
    popup.add(overlay);

    const panelW = 390, panelH = 540;
    const px = W / 2 - panelW / 2, py = H / 2 - panelH / 2 - 20;
    const panelG = this.add.graphics();
    panelG.fillStyle(0x0d0828, 1);
    panelG.fillRoundedRect(px, py, panelW, panelH, 22);
    panelG.lineStyle(2.5, 0x9955FF, 1);
    panelG.strokeRoundedRect(px, py, panelW, panelH, 22);
    panelG.fillStyle(0x3311AA, 0.12);
    panelG.fillRoundedRect(px + 4, py + 4, panelW - 8, 60, { tl: 18, tr: 18, bl: 0, br: 0 });
    popup.add(panelG);

    popup.add(this.add.text(W / 2, py + 32, t('daily.spinTitle'), {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#FFFFFF',
    }).setOrigin(0.5));
    const streakRewardStr = `💰${streakReward.coins}` + (streakReward.diamonds > 0 ? ` 💎${streakReward.diamonds}` : '');
    popup.add(this.add.text(W / 2, py + 60, t('daily.streakAward', { n: streak, reward: streakRewardStr }), {
      fontFamily: FONT, fontSize: '12px', color: '#BB88FF',
    }).setOrigin(0.5));

    // Wheel
    const wheelCx = W / 2, wheelCy = py + 240;
    const wheelR = 140;
    const wheelCont = this.add.container(wheelCx, wheelCy).setDepth(66);
    popup.add(wheelCont);

    const wheelG = this.add.graphics();
    for (let i = 0; i < SEGS.length; i++) {
      const startRad = (segAngles[i].start - 90) * (Math.PI / 180);
      const endRad   = (segAngles[i].end   - 90) * (Math.PI / 180);
      wheelG.fillStyle(SEGS[i].color, 1);
      wheelG.beginPath(); wheelG.moveTo(0, 0);
      wheelG.arc(0, 0, wheelR, startRad, endRad, false);
      wheelG.closePath(); wheelG.fillPath();
      wheelG.lineStyle(2, SEGS[i].border, 0.65);
      wheelG.beginPath(); wheelG.moveTo(0, 0);
      wheelG.arc(0, 0, wheelR, startRad, endRad, false);
      wheelG.closePath(); wheelG.strokePath();
    }
    wheelG.fillStyle(0x0d0828, 1); wheelG.fillCircle(0, 0, 20);
    wheelG.lineStyle(2.5, 0xAA88FF, 0.9); wheelG.strokeCircle(0, 0, 20);
    wheelCont.add(wheelG);

    for (let i = 0; i < SEGS.length; i++) {
      const midRad = (segAngles[i].mid - 90) * (Math.PI / 180);
      const lx = Math.cos(midRad) * (wheelR * 0.65);
      const ly = Math.sin(midRad) * (wheelR * 0.65);
      wheelCont.add(this.add.text(lx, ly, SEGS[i].label, {
        fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#FFFFFF',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5));
    }

    // Pointer (fixed, at top)
    const ptrG = this.add.graphics().setDepth(67);
    ptrG.fillStyle(0xFFDD44, 1);
    ptrG.fillTriangle(W / 2 - 13, wheelCy - wheelR - 20, W / 2 + 13, wheelCy - wheelR - 20, W / 2, wheelCy - wheelR + 12);
    ptrG.lineStyle(2, 0xAA8800, 1);
    ptrG.strokeTriangle(W / 2 - 13, wheelCy - wheelR - 20, W / 2 + 13, wheelCy - wheelR - 20, W / 2, wheelCy - wheelR + 12);
    popup.add(ptrG);

    let spun = false;
    const spinBtn = makeButton(this, W / 2, py + panelH - 50, 220, 46, t('daily.spinBtn'), 0x6622BB, () => {
      if (spun) return;
      spun = true;
      (spinBtn as Phaser.GameObjects.Container).setAlpha(0.4);

      this.tweens.add({
        targets: wheelCont, angle: targetAngle, duration: 3600, ease: 'Cubic.Out',
        onComplete: () => {
          const seg = SEGS[winner];
          state.coins       = (state.coins       ?? 0) + seg.coins;
          state.diamonds    = (state.diamonds    ?? 0) + seg.diamonds;
          state.moonCrystals = (state.moonCrystals ?? 0) + seg.crystals;
          state.wheelClaimedDate = today;
          store.setJSON('mps_state', state);
          this._updateCoinDisplay();

          const rewardStr = (seg.coins > 0 ? `+${seg.coins}💰` : '') +
            (seg.diamonds > 0 ? `+${seg.diamonds}💎` : '') +
            (seg.crystals > 0 ? `+${seg.crystals}🌙` : '');
          const rewardTxt = this.add.text(W / 2, wheelCy + wheelR + 36, rewardStr, {
            fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#FFD700',
            stroke: '#000000', strokeThickness: 3,
          }).setOrigin(0.5).setDepth(69).setScale(0);
          popup.add(rewardTxt);
          this.tweens.add({ targets: rewardTxt, scale: 1, duration: 420, ease: 'Back.Out' });
          this._spawnParticles(W / 2, wheelCy, 0xFFD700, 20);

          const closeBtn = makeButton(this, W / 2, py + panelH - 50, 220, 46, t('daily.claim'), 0x226611, () => {
            popup.destroy();
          }, 15);
          popup.add(closeBtn as Phaser.GameObjects.Container);
          (spinBtn as Phaser.GameObjects.Container).destroy();
        },
      });
    }, 16);
    popup.add(spinBtn as Phaser.GameObjects.Container);
  }

  private _spawnParticles(x: number, y: number, color: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const speed = 50 + Math.random() * 90;
      const pg = this.add.graphics().setDepth(68);
      pg.fillStyle(color, 1);
      pg.fillCircle(0, 0, 3 + Math.random() * 4);
      pg.x = x; pg.y = y;
      this.tweens.add({
        targets: pg,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed - 20,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 400 + Math.random() * 300, ease: 'Cubic.Out',
        onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* ignore */ } },
      });
    }
  }

  private _coinBurst(fromX: number, fromY: number, amount: number) {
    const targetX = 100, targetY = 40; // coin HUD center
    for (let i = 0; i < 8; i++) {
      const delay = i * 55;
      const sx = fromX + (Math.random() - 0.5) * 40;
      const sy = fromY + (Math.random() - 0.5) * 20;
      const pg = this.add.graphics().setDepth(70);
      pg.fillStyle(0xFFD700, 1);
      pg.fillCircle(0, 0, 5);
      pg.lineStyle(1.5, 0xAA8800, 0.7);
      pg.strokeCircle(0, 0, 5);
      pg.x = sx; pg.y = sy;
      this.tweens.add({
        targets: pg, x: targetX, y: targetY, delay,
        duration: 380 + Math.random() * 120, ease: 'Cubic.In',
        onComplete: (_tw: any, tg: any) => {
          try { tg[0].destroy(); } catch { /* ignore */ }
          if (i === 7) {
            // Scale bounce on coin label when last coin arrives
            if (this._coinTxt) {
              this.tweens.add({ targets: this._coinTxt, scaleX: 1.3, scaleY: 1.3, duration: 100, ease: 'Back.Out', yoyo: true });
            }
            showFloat(this, targetX, targetY - 20, '+' + amount + '💰', '#FFD700');
          }
        },
      });
    }
  }

  private _restoreDailyAdBadgeIfNeeded() {
    const state = Game.state!;
    const today = localDateKey();
    if (state.lastLoginDate === today && state.dailyAdClaimedDate !== today) {
      const dayIdx = ((state.loginStreak! - 1) % DAILY_REWARDS.length);
      this._showDailyAdBadge(DAILY_REWARDS[dayIdx]);
    }
  }

  private _showDailyAdBadge(reward: typeof DAILY_REWARDS[0]) {
    const today = localDateKey();
    if (Game.state!.dailyAdClaimedDate === today) return;
    if (this._dailyAdBadge) { this._dailyAdBadge.destroy(); this._dailyAdBadge = null; }
    const W = this.scale.width;
    const badge = this.add.container(W - 70, 99).setDepth(12);
    const bg = this.add.graphics();
    bg.fillStyle(0x117733, 1);
    bg.fillRoundedRect(-58, -16, 116, 32, 16);
    bg.lineStyle(2, 0x44EE88, 1);
    bg.strokeRoundedRect(-58, -16, 116, 32, 16);
    const lbl = this.add.text(0, 0, t('daily.adBadge'), {
      fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#AAFFCC',
    }).setOrigin(0.5);
    badge.add([bg, lbl]);
    badge.setInteractive(new Phaser.Geom.Rectangle(-58, -16, 116, 32), Phaser.Geom.Rectangle.Contains);
    badge.on('pointerdown', () => {
      Ads.showRewarded((res: { rewarded: boolean }) => {
        if (res.rewarded) {
          // Another callback may have already granted today's bonus.
          if (Game.state!.dailyAdClaimedDate === today) return;
          Game.state!.coins    += reward.coins;
          Game.state!.diamonds  = (Game.state!.diamonds ?? 0) + reward.diamonds;
          Game.state!.dailyAdClaimedDate = today;
          store.setJSON('mps_state', Game.state);
          this._updateCoinDisplay();
          showToast(this, `🎁 x2! +${reward.coins}💰` + (reward.diamonds > 0 ? ` +${reward.diamonds}💎` : ''), '#AAFFCC');
          badge.destroy(); this._dailyAdBadge = null;
        }
      });
    });
    this.tweens.add({ targets: bg, alpha: { from: 0.7, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
    this._dailyAdBadge = badge;
  }

  private _showDailyCheckInView() {
    const state = Game.state!;
    const streak = state.loginStreak ?? 1;
    const dayIdx = ((streak - 1) % DAILY_REWARDS.length);
    const reward = DAILY_REWARDS[dayIdx];
    this._showDailyLoginPopup(reward, streak, true);
  }

  private _showDailyLoginPopup(reward: typeof DAILY_REWARDS[0], streak: number, isReview = false) {
    const W = this.scale.width, H = this.scale.height;
    const cx = W / 2;
    const panelW = 400, panelH = 420;
    const px = cx - panelW / 2, py = H / 2 - panelH / 2 - 20;

    const popup = this.add.container(0, 0).setDepth(55);

    // Overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.70);
    overlay.fillRect(0, 0, W, H);
    popup.add(overlay);

    // Panel
    const panel = this.add.graphics();
    panel.fillStyle(0x0d0828, 1);
    panel.fillRoundedRect(px, py, panelW, panelH, 22);
    panel.lineStyle(2.5, 0x9955FF, 1);
    panel.strokeRoundedRect(px, py, panelW, panelH, 22);
    panel.fillStyle(0x3311AA, 0.12);
    panel.fillRoundedRect(px + 4, py + 4, panelW - 8, 64, { tl: 18, tr: 18, bl: 0, br: 0 });
    popup.add(panel);

    // Header
    popup.add(this.add.text(cx, py + 34, t('daily.loginTitle'), {
      fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#FFFFFF',
    }).setOrigin(0.5));

    // Streak text
    popup.add(this.add.text(cx, py + 76, t('daily.streakDays', { n: streak }), {
      fontFamily: FONT, fontSize: '15px', color: '#BB88FF',
    }).setOrigin(0.5));

    // 7-day row
    const dayW = 46, dayGap = 8;
    const rowW = 7 * dayW + 6 * dayGap;
    const rowX = cx - rowW / 2;
    const rowY = py + 102;
    DAILY_REWARDS.forEach((r, i) => {
      const dx = rowX + i * (dayW + dayGap);
      const isToday = i === (streak - 1) % DAILY_REWARDS.length;
      const isPast  = streak > i + 1 || (streak === DAILY_REWARDS.length && i < streak - 1);

      const card = this.add.graphics();
      card.fillStyle(isToday ? 0x5522BB : (isPast ? 0x221144 : 0x120830), 1);
      card.fillRoundedRect(dx, rowY, dayW, 56, 10);
      card.lineStyle(1.5, isToday ? 0xCC88FF : 0x442288, isToday ? 1 : 0.55);
      card.strokeRoundedRect(dx, rowY, dayW, 56, 10);
      if (isToday) {
        card.lineStyle(2.5, 0xFF99FF, 0.45);
        card.strokeRoundedRect(dx - 2, rowY - 2, dayW + 4, 60, 12);
      }
      popup.add(card);

      popup.add(this.add.text(dx + dayW / 2, rowY + 14, isPast ? '✓' : r.emoji, {
        fontFamily: FONT, fontSize: '18px', color: isPast ? '#8866AA' : '#FFFFFF',
      }).setOrigin(0.5));
      popup.add(this.add.text(dx + dayW / 2, rowY + 40, `D${i + 1}`, {
        fontFamily: FONT, fontSize: '11px', color: isToday ? '#EE99FF' : '#665588',
      }).setOrigin(0.5));
    });

    // Big reward display
    const rewardY = py + 194;
    popup.add(this.add.text(cx, rewardY, t('daily.todayReward'), {
      fontFamily: FONT, fontSize: '14px', color: '#AA88CC',
    }).setOrigin(0.5));

    const rewardLine = `💰 ${reward.coins}` + (reward.diamonds > 0 ? `    💎 ${reward.diamonds}` : '');
    popup.add(this.add.text(cx, rewardY + 34, rewardLine, {
      fontFamily: FONT, fontSize: '32px', fontStyle: 'bold', color: '#FFD700',
    }).setOrigin(0.5));

    // Streak bonus note (day 7 special)
    if (streak % DAILY_REWARDS.length === 0) {
      popup.add(this.add.text(cx, rewardY + 76, t('daily.weekBonus'), {
        fontFamily: FONT, fontSize: '13px', color: '#FF99CC',
      }).setOrigin(0.5));
    }

    // Best streak record
    const longestStreak = Game.state!.longestStreak ?? streak;
    if (longestStreak > 1) {
      popup.add(this.add.text(cx, py + panelH - 126, t('daily.bestStreak', { n: longestStreak }), {
        fontFamily: FONT, fontSize: '12px', color: '#BB88CC',
      }).setOrigin(0.5));
    }

    // Claim button
    const btnY = py + panelH - 110;
    const btnG = this.add.graphics();
    btnG.fillStyle(0x4411BB, 1);
    btnG.fillRoundedRect(cx - 120, btnY, 240, 46, 23);
    btnG.lineStyle(2, 0xAA66FF, 1);
    btnG.strokeRoundedRect(cx - 120, btnY, 240, 46, 23);
    popup.add(btnG);
    const btnTxt = this.add.text(cx, btnY + 23, isReview ? t('btn.close') : t('daily.claimBtn'), {
      fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#FFFFFF',
    }).setOrigin(0.5);
    popup.add(btnTxt);

    const btnZone = this.add.zone(cx, btnY + 23, 240, 46).setInteractive();
    btnZone.on('pointerover',  () => { btnG.clear(); btnG.fillStyle(0x6622EE, 1); btnG.fillRoundedRect(cx - 120, btnY, 240, 46, 23); btnG.lineStyle(2, 0xCC88FF, 1); btnG.strokeRoundedRect(cx - 120, btnY, 240, 46, 23); });
    btnZone.on('pointerout',   () => { btnG.clear(); btnG.fillStyle(0x4411BB, 1); btnG.fillRoundedRect(cx - 120, btnY, 240, 46, 23); btnG.lineStyle(2, 0xAA66FF, 1); btnG.strokeRoundedRect(cx - 120, btnY, 240, 46, 23); });
    btnZone.on('pointerdown',  () => { popup.destroy(); if (!isReview) this._showDailyAdBadge(reward); });
    popup.add(btnZone);

    // x2 ad button
    const adBtnY = py + panelH - 56;
    const today = localDateKey();
    const alreadyClaimed = Game.state!.dailyAdClaimedDate === today;
    const adBtnG = this.add.graphics();
    const adBtnColor = alreadyClaimed ? 0x332244 : 0x117733;
    adBtnG.fillStyle(adBtnColor, 1);
    adBtnG.fillRoundedRect(cx - 120, adBtnY, 240, 40, 20);
    adBtnG.lineStyle(1.5, alreadyClaimed ? 0x554466 : 0x44EE88, 1);
    adBtnG.strokeRoundedRect(cx - 120, adBtnY, 240, 40, 20);
    popup.add(adBtnG);
    popup.add(this.add.text(cx, adBtnY + 20,
      alreadyClaimed ? t('daily.adClaimed') : t('daily.adWatch'),
      { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold',
        color: alreadyClaimed ? '#776688' : '#AAFFCC' }
    ).setOrigin(0.5));
    if (!alreadyClaimed) {
      const adZone = this.add.zone(cx, adBtnY + 20, 240, 40).setInteractive();
      adZone.on('pointerdown', () => {
        Ads.showRewarded((res: { rewarded: boolean }) => {
          if (res.rewarded) {
            const today2 = localDateKey();
            if (Game.state!.dailyAdClaimedDate === today2) return;
            Game.state!.coins    += reward.coins;
            Game.state!.diamonds  = (Game.state!.diamonds ?? 0) + reward.diamonds;
            Game.state!.dailyAdClaimedDate = today2;
            store.setJSON('mps_state', Game.state);
            this._updateCoinDisplay();
            showToast(this, `🎁 x2! +${reward.coins}💰` + (reward.diamonds > 0 ? ` +${reward.diamonds}💎` : ''), '#AAFFCC');
            popup.destroy();
            if (this._dailyAdBadge) { this._dailyAdBadge.destroy(); this._dailyAdBadge = null; }
          }
        });
      });
      popup.add(adZone);
    }

    // Entrance tween
    popup.setAlpha(0);
    popup.setScale(0.88);
    this.tweens.add({
      targets: popup, alpha: 1, scaleX: 1, scaleY: 1,
      duration: 220, ease: 'Back.Out',
    });
  }

  private _effectiveVisitorMult(state: GameState): number {
    const base = state.visitorPriceMult ?? 2;
    const isRushHour = !!(state.rushHourUntil && Date.now() < state.rushHourUntil);
    return isRushHour ? base * 2 : base;
  }

  private _showVisitorPopup() {
    const state = Game.state!;
    if (!state.visitorSpeciesId || !state.visitorExpiresAt) return;
    const W = this.scale.width, H = this.scale.height;
    const sp = SPECIES[state.visitorSpeciesId];
    const mult = this._effectiveVisitorMult(state);
    const candidates = state.monsters
      .filter(m => m.speciesId === state.visitorSpeciesId)
      .sort((a, b) => calcSellPrice(state, b) - calcSellPrice(state, a));
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
    popup.add(this.add.text(W/2, H/2 - 80, t('visitor.wants', { name: sp.name }), { fontFamily: FONT, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5));

    const close = () => popup.destroy();
    const priceFor = (m: Monster) => Math.max(1, Math.round(calcSellPrice(state, m) * mult));

    if (candidates.length === 0) {
      popup.add(this.add.text(W/2, H/2 - 30, t('visitor.noMonster', { name: sp.name }), { fontFamily: FONT, fontSize: '14px', color: '#BB9944' }).setOrigin(0.5));
      popup.add(this.add.text(W/2, H/2 - 6, t('visitor.expires', { mins }), { fontFamily: FONT, fontSize: '13px', color: '#BBBBCC' }).setOrigin(0.5));
      popup.add(makeButton(this, W/2, H/2 + 60, 120, 38, t('btn.close'), 0x2a1560, close, 13));
    } else {
      let sel = 0;
      const selTxt = this.add.text(W/2, H/2 - 52, '', {
        fontFamily: FONT, fontSize: '13px', color: '#DDCCFF',
      }).setOrigin(0.5);
      const offerTxt = this.add.text(W/2, H/2 - 28, '', {
        fontFamily: FONT, fontSize: '16px', color: '#FFD700', fontStyle: 'bold',
      }).setOrigin(0.5);
      const expiresTxt = this.add.text(W/2, H/2 - 4, t('visitor.expires', { mins }), {
        fontFamily: FONT, fontSize: '13px', color: '#BBBBCC',
      }).setOrigin(0.5);
      popup.add([selTxt, offerTxt, expiresTxt]);

      const sellBtn = makeButton(this, W/2, H/2 + 42, 260, 48, '', 0x2A7A18, () => {
        const mon = candidates[sel];
        const price = priceFor(mon);
        state.monsters = state.monsters.filter(m => m.id !== mon.id);
        state.listings = state.listings.filter(l => l.monsterId !== mon.id);
        state.coins += price;
        state.stats.sold++;
        state.stats.totalEarned += price;
        state.stats.visitorSales = (state.stats.visitorSales ?? 0) + 1;
        const { milestonePct, mastered } = applySellSideEffects(state, mon.habitatType, mon.speciesId);
        if (milestonePct) showToast(this, '🏅 ' + t('toast.habitatBonus', { pct: milestonePct }), '#FFD700');
        if (mastered)     showToast(this, '🏆 ' + t('toast.speciesMaster', { name: SPECIES[mon.speciesId].name }), '#FFDD44');
        recordQuestProgress('sell');
        checkAndApplyShopLevelUp(state);
        state.visitorSpeciesId = undefined;
        state.visitorExpiresAt = undefined;
        store.setJSON('mps_state', state);
        sfx.sell();
        showToast(this, t('toast.soldFor', { price }), '#aaffaa');
        this._coinBurst(W / 2, H / 2, price);
        close();
        this._updateCoinDisplay();
        this._updateVisitorBanner();
        this.refreshAll();
      }, 13);
      popup.add(sellBtn);

      const refreshOffer = () => {
        const m = candidates[sel];
        const price = priceFor(m);
        const label = (m.nickname ? m.nickname + ' · ' : '') + sp.name + ' · Lv' + m.level;
        selTxt.setText(candidates.length > 1 ? ('◀  ' + label + '  ▶') : label);
        offerTxt.setText(t('visitor.offer', { price, mult: Math.round(mult * 10) / 10 }));
        setButtonLabel(sellBtn, t('visitor.sell', { name: m.nickname ?? sp.name, price }));
      };
      refreshOffer();

      if (candidates.length > 1) {
        const cycle = (dir: number) => { sel = (sel + dir + candidates.length) % candidates.length; refreshOffer(); };
        popup.add(makeButton(this, W/2 - 138, H/2 - 52, 34, 28, '◀', 0x3A2050, () => cycle(-1), 12));
        popup.add(makeButton(this, W/2 + 138, H/2 - 52, 34, 28, '▶', 0x3A2050, () => cycle(1), 12));
      }

      popup.add(makeButton(this, W/2, H/2 + 96, 120, 32, t('btn.close'), 0x2a1560, close, 12));
    }

    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    overlay.on('pointerdown', close);
  }

  private _showQuestsPanel() {
    const state = Game.state!;
    const daily   = state.quests ?? [];
    const weekly  = state.weeklyQuests ?? [];
    const W = this.scale.width, H = this.scale.height;
    const now = Date.now();

    const popup = this.add.container(0, 0).setDepth(50);
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.65); overlay.fillRect(0, 0, W, H);
    popup.add(overlay);

    const ROW_H = 84;
    const panH = Math.min(H - 40, 56 + (daily.length + weekly.length) * ROW_H + 32 + 50);
    const panY = Math.max(20, H / 2 - panH / 2);
    const panel = this.add.graphics();
    panel.fillStyle(0x100C1C, 1);
    panel.fillRoundedRect(W/2 - 170, panY, 340, panH, 16);
    panel.lineStyle(2, 0xCC9900, 0.8);
    panel.strokeRoundedRect(W/2 - 170, panY, 340, panH, 16);
    popup.add(panel);

    popup.add(this.add.text(W/2, panY + 22, t('quests.title'), {
      fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#FFD700',
    }).setOrigin(0.5));

    let curY = panY + 42;

    const drawSection = (label: string, labelCol: string, resetAt: number, quests: typeof daily, isWeekly: boolean) => {
      const minsLeft = Math.max(0, Math.floor((resetAt - now) / 60000));
      let resetStr: string;
      if (isWeekly) {
        const dLeft = Math.floor(minsLeft / 1440), hLeft2 = Math.floor((minsLeft % 1440) / 60);
        resetStr = t('quests.weeklyResets', { d: dLeft, h: hLeft2 });
      } else {
        const hLeft = Math.floor(minsLeft / 60), mLeft = minsLeft % 60;
        resetStr = t('quests.resets', { h: hLeft, m: mLeft });
      }

      // Section header
      const hdrBg = this.add.graphics();
      hdrBg.fillStyle(isWeekly ? 0x1A0A30 : 0x1C1408, 1);
      hdrBg.fillRoundedRect(W/2 - 162, curY, 324, 24, 6);
      popup.add(hdrBg);
      popup.add(this.add.text(W/2 - 152, curY + 12, label, {
        fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: labelCol,
      }).setOrigin(0, 0.5));
      popup.add(this.add.text(W/2 + 150, curY + 12, resetStr, {
        fontFamily: FONT, fontSize: '11px', color: '#887766',
      }).setOrigin(1, 0.5));
      curY += 28;

      quests.forEach(q => {
        const done = q.completed, clmd = q.claimed;
        const diamonds = q.diamondReward ?? 0;
        const crystals = q.crystalReward ?? 0;
        const hasDiamond = diamonds > 0;

        const qBg = this.add.graphics();
        qBg.fillStyle(done ? (clmd ? 0x101820 : (isWeekly ? 0x1A103A : 0x1A2A10)) : (isWeekly ? 0x12082A : 0x1A1408), 1);
        qBg.fillRoundedRect(W/2 - 158, curY, 316, ROW_H - 6, 10);
        qBg.lineStyle(1.5, done ? (isWeekly ? 0x8855FF : 0x55BB33) : (isWeekly ? 0x4422AA : 0x5A3A10), 0.75);
        qBg.strokeRoundedRect(W/2 - 158, curY, 316, ROW_H - 6, 10);
        popup.add(qBg);

        popup.add(this.add.text(W/2 - 148, curY + 13, q.label, {
          fontFamily: FONT, fontSize: '13px', fontStyle: 'bold',
          color: done ? (isWeekly ? '#CCAAFF' : '#AAFFAA') : (isWeekly ? '#C0A8EE' : '#FFEEAA'),
        }).setOrigin(0, 0.5));

        let rewardStr: string;
        if (crystals > 0) {
          rewardStr = t('quests.rewardCrystal', { diamonds: String(diamonds), crystals: String(crystals), coins: String(q.coinReward) });
        } else if (hasDiamond) {
          rewardStr = t('quests.rewardDiamond', { amount: String(diamonds), coins: String(q.coinReward) });
        } else {
          rewardStr = t('quests.reward', { amount: q.coinReward });
        }
        popup.add(this.add.text(W/2 - 148, curY + 34, rewardStr, {
          fontFamily: FONT, fontSize: '11px', color: isWeekly ? '#BB99FF' : '#FFD700',
        }).setOrigin(0, 0.5));

        const barW = 150, barH = 8;
        const barG = this.add.graphics();
        barG.fillStyle(0x000000, 0.45); barG.fillRoundedRect(W/2 - 148, curY + 52, barW, barH, 3);
        const fill = Math.min(1, q.progress / q.target);
        if (fill > 0) {
          barG.fillStyle(done ? (isWeekly ? 0xAA66FF : 0x44DD44) : (isWeekly ? 0x6633CC : 0xDD9922), 1);
          barG.fillRoundedRect(W/2 - 148, curY + 52, barW * fill, barH, 3);
        }
        popup.add(barG);
        popup.add(this.add.text(W/2 + 8, curY + 56, q.progress + '/' + q.target, {
          fontFamily: FONT, fontSize: '11px', color: '#BBBBBB',
        }).setOrigin(0, 0.5));

        if (done && !clmd) {
          const claimBtn = makeButton(this, W/2 + 112, curY + (ROW_H - 6) / 2, 88, 34,
            t('quests.claim'), isWeekly ? 0x5522BB : 0x2A7A10, () => {
              if (q.claimed) return;
              q.claimed = true;
              state.coins += q.coinReward;
              if (diamonds > 0) state.diamonds = (state.diamonds ?? 0) + diamonds;
              if (crystals > 0) state.moonCrystals = (state.moonCrystals ?? 0) + crystals;
              state.stats.questsCompleted = (state.stats.questsCompleted ?? 0) + 1;
              store.setJSON('mps_state', state);
              sfx.buy();
              if (crystals > 0) {
                showToast(this, t('quests.toastCrystal', { diamonds: String(diamonds), crystals: String(crystals) }), '#DDBBFF');
              } else if (hasDiamond) {
                showToast(this, t('quests.toastDiamond', { diamonds: String(diamonds), coins: String(q.coinReward) }), '#AACCFF');
              } else {
                showToast(this, t('quests.toast', { amount: q.coinReward }), '#aaffaa');
              }
              this._updateCoinDisplay();
              this._updateQuestBtn();
              getNewAchievements(state).forEach(a => this._showAchievementPopup(a));
              close();
              this._showQuestsPanel();
            }, 11);
          popup.add(claimBtn);
        } else if (clmd) {
          popup.add(this.add.text(W/2 + 112, curY + (ROW_H - 6) / 2, t('quests.claimed'), {
            fontFamily: FONT, fontSize: '11px', color: isWeekly ? '#8866CC' : '#66AA66',
          }).setOrigin(0.5));
        }

        curY += ROW_H;
      });
    };

    drawSection(t('quests.daily'),  '#FFD700', state.questResetAt ?? 0,       daily,  false);
    curY += 4;
    drawSection(t('quests.weekly'), '#CC99FF', state.weeklyQuestResetAt ?? 0, weekly, true);

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
      fontFamily: FONT, fontSize: '13px', color: '#6699BB',
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
    const allQuests = [...(Game.state!.quests ?? []), ...(Game.state!.weeklyQuests ?? [])];
    const unclaimedCount = allQuests.filter(q => q.completed && !q.claimed).length;
    setButtonLabel(this._questBtn, unclaimedCount > 0 ? t('nav.questsDone') : t('nav.quests'));
    setButtonColor(this._questBtn, unclaimedCount > 0 ? 0x22AA44 : 0x1A1040);
    this._updateQuestDot(x, bw, btnY, bh, unclaimedCount > 0);
  }

  refreshAll() {
    this._bobTweens.forEach(t => { try { t.stop(); } catch { /* ignore */ } });
    this._bobTweens = [];
    this._bloomTimers.forEach(t => t.destroy());
    this._bloomTimers = [];
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
    if (this._dexDot) this._updateDexDot(W / 2, 100, btnY, bh, hasNew);
    this._updateShopBadge();
    // Show level-up modal if a visitor sell triggered one (HabitatRoom clears this flag and handles inline)
    const pendingLv = Game.state!.pendingShopLvPopup;
    if (pendingLv) {
      Game.state!.pendingShopLvPopup = undefined;
      store.setJSON('mps_state', Game.state);
      this.time.delayedCall(300, () => this._showShopLevelUpPopup(pendingLv.level, pendingLv.coins, pendingLv.diamonds, pendingLv.crystals));
    }
    this._updateCoinDisplay();
    this._updateQuestBtn();
    this._updateTabs();

    // Announce featured species once per session
    const featId = Game.state!.featuredSpeciesId;
    if (featId !== undefined && (Game.state!.featuredUntil ?? 0) > Date.now() && featId !== this._featuredAnnouncedId) {
      this._featuredAnnouncedId = featId;
      const featSp = SPECIES[featId];
      if (featSp) this.time.delayedCall(1800, () => showToast(this, t('toast.featured', { name: featSp.name }), '#FFD700'));
    }

    // Detect if visitor banner + quest chip need to stack (adjusts card grid)
    const _now = Date.now();
    const _state = Game.state!;
    const _isBannerActive = !!(_state.visitorSpeciesId && _state.visitorExpiresAt && _state.visitorExpiresAt > _now)
      || !!(_state.rushHourUntil && _state.rushHourUntil > _now);
    const _allQuests = [...(_state.quests ?? []), ...(_state.weeklyQuests ?? [])];
    const _hasQuestContent = _allQuests.some(q => !q.completed) || _allQuests.some(q => q.completed && !q.claimed);
    const hasStackedBanner = _isBannerActive && _hasQuestContent;
    const hasAnyBanner = _isBannerActive || _hasQuestContent;

    this._updateVisitorBanner();
    this._updateEggTimerStrip();

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

    const slots = this._getSlotPositions(W, hasStackedBanner, hasAnyBanner);
    let idx = 0;
    monsters.forEach(mon => { if (idx < slots.length) { this._drawTerrarium(slots[idx].x, slots[idx].y, mon); idx++; } });
    eggs.forEach(egg => { if (idx < slots.length) { this._drawEggTerrarium(slots[idx].x, slots[idx].y, egg); idx++; } });

    const usage = monsters.length + eggs.length;
    // Draw empty frames for owned-but-empty tanks
    for (let e = usage; e < capacity && idx < slots.length; e++) {
      this._drawEmptyTankCard(slots[idx].x, slots[idx].y);
      idx++;
    }
    if (capacity < MAX_TANKS * TANK_CAPACITY && idx < slots.length) {
      this._drawBuyTankCard(slots[idx].x, slots[idx].y);
    }
  }

  private _drawEmptyTankCard(cx: number, cy: number) {
    const CW = 234, CH = 200;
    const vpPad = 7, nameH = 40;
    const vpX = cx - CW/2 + vpPad, vpY = cy - CH/2 + vpPad;
    const vpW = CW - vpPad*2, vpH = CH - nameH - vpPad*2;
    const vpCY = vpY + vpH/2;

    const glowCol = HAB_GLOW[this._currentHabitat] ?? 0x8844CC;
    const cardBg = this._getHabitatCardBg();
    const frame = this.add.graphics().setDepth(20);
    this._drawGlassCard(frame, cx - CW/2, cy - CH/2, CW, CH, glowCol, cardBg);
    this._displayGroup.add(frame);

    const interior = this.add.graphics().setDepth(21);
    interior.fillStyle(glowCol, 0.06); interior.fillRect(vpX, vpY, vpW, vpH);
    interior.lineStyle(1, glowCol, 0.25); interior.strokeRect(vpX, vpY, vpW, vpH);
    this._displayGroup.add(interior);

    const namePlateG = this.add.graphics().setDepth(22);
    namePlateG.fillStyle(0x000000, 0.40);
    namePlateG.fillRoundedRect(cx - CW/2, cy + CH/2 - nameH, CW, nameH, { tl: 0, tr: 0, bl: 14, br: 14 });
    namePlateG.lineStyle(1, glowCol, 0.28);
    namePlateG.beginPath();
    namePlateG.moveTo(cx - CW/2 + 14, cy + CH/2 - nameH);
    namePlateG.lineTo(cx + CW/2 - 14, cy + CH/2 - nameH);
    namePlateG.strokePath();
    this._displayGroup.add(namePlateG);

    this._displayGroup.add(this.add.text(cx, vpCY - 8, '🥚', {
      fontFamily: FONT, fontSize: '36px',
    }).setOrigin(0.5).setDepth(22).setAlpha(0.55));
    this._displayGroup.add(this.add.text(cx, vpCY + 22, t('hub.goShop'), {
      fontFamily: FONT, fontSize: '13px', color: '#C8B8EE',
    }).setOrigin(0.5).setDepth(22));
    this._displayGroup.add(this.add.text(cx, cy + CH/2 - nameH / 2, t('hub.empty').split('!')[0], {
      fontFamily: FONT, fontSize: '13px', color: '#D0C8EE',
    }).setOrigin(0.5).setDepth(23));

    const zone = this.add.zone(cx, cy, CW, CH).setInteractive().setDepth(25);
    zone.on('pointerdown', () => {
      Ads.maybeInterstitial(() => { this.scene.start('Merchant'); });
    });
    this._displayGroup.add(zone);
  }

  private _drawBuyTankCard(cx: number, cy: number) {
    const CW = 234, CH = 200;
    const vpPad = 7, nameH = 40;
    const vpX = cx - CW/2 + vpPad, vpY = cy - CH/2 + vpPad;
    const vpW = CW - vpPad*2, vpH = CH - nameH - vpPad*2;

    const glowCol = HAB_GLOW[this._currentHabitat] ?? 0x8844CC;
    const cardBg = this._getHabitatCardBg();
    const frame = this.add.graphics().setDepth(20);
    this._drawGlassCard(frame, cx - CW/2, cy - CH/2, CW, CH, glowCol, cardBg);
    this._displayGroup.add(frame);

    const interior = this.add.graphics().setDepth(21);
    interior.fillStyle(glowCol, 0.08); interior.fillRect(vpX, vpY, vpW, vpH);
    interior.lineStyle(1, glowCol, 0.28); interior.strokeRect(vpX, vpY, vpW, vpH);
    this._displayGroup.add(interior);

    const namePlateG = this.add.graphics().setDepth(22);
    namePlateG.fillStyle(glowCol, 0.22);
    namePlateG.fillRoundedRect(cx - CW/2, cy + CH/2 - nameH, CW, nameH, { tl: 0, tr: 0, bl: 14, br: 14 });
    namePlateG.lineStyle(1, glowCol, 0.40);
    namePlateG.beginPath();
    namePlateG.moveTo(cx - CW/2 + 14, cy + CH/2 - nameH);
    namePlateG.lineTo(cx + CW/2 - 14, cy + CH/2 - nameH);
    namePlateG.strokePath();
    this._displayGroup.add(namePlateG);
    this._displayGroup.add(this.add.text(cx, cy + CH/2 - nameH / 2, t('hub.buyTank'), {
      fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#FFFFFF',
      stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(23));

    const vpCY = vpY + vpH/2;
    this._displayGroup.add(this.add.text(cx, vpCY - 18, '+', {
      fontFamily: FONT, fontSize: '52px', color: '#FFFFFF', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(22).setAlpha(0.35));
    this._displayGroup.add(this.add.text(cx, vpCY + 28, TANK_COST + ' 💰', {
      fontFamily: FONT, fontSize: '18px', color: '#FFD700',
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

  private _getSlotPositions(W: number, hasStackedBanner: boolean = false, hasAnyBanner: boolean = false) {
    const H = this.scale.height;
    const col1 = W / 4, col2 = W * 3 / 4;
    const startY = 288;
    // Quest chip / visitor banner sits at H-160 (h=44). Row-3 card bottom must clear it.
    // hasStackedBanner (visitor+quest): container shifts to H-168, needs offset 90
    // hasAnyBanner (quest or visitor only): chip top at H-160, card center max = H-264, offset 78
    const bannerOffset = hasStackedBanner ? 90 : (hasAnyBanner ? 78 : 0);
    const maxCY3 = H - 186 - bannerOffset;
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

    const glowCol = HAB_GLOW[sp.habitat] ?? 0x8844CC;
    const frame = this.add.graphics().setDepth(20);
    this._drawGlassCard(frame, cx - CW/2, cy - CH/2, CW, CH, glowCol, this._getHabitatCardBg(sp.habitat as HabitatType));
    this._displayGroup.add(frame);

    const innerBg = this.add.graphics().setDepth(21);
    this._drawMiniHabitatBg(innerBg, sp.habitat, vpX, vpY, vpW, vpH);
    this._displayGroup.add(innerBg);

    const viewBorder = this.add.graphics().setDepth(22);
    viewBorder.lineStyle(1.5, glowCol, 0.30); viewBorder.strokeRect(vpX, vpY, vpW, vpH);
    this._displayGroup.add(viewBorder);

    // Frosted nameplate at card bottom
    const namePlateG = this.add.graphics().setDepth(22);
    namePlateG.fillStyle(0x000000, 0.58);
    namePlateG.fillRoundedRect(cx - CW/2, cy + CH/2 - nameH, CW, nameH, { tl: 0, tr: 0, bl: 14, br: 14 });
    namePlateG.lineStyle(1, glowCol, 0.22);
    namePlateG.beginPath();
    namePlateG.moveTo(cx - CW/2 + 14, cy + CH/2 - nameH);
    namePlateG.lineTo(cx + CW/2 - 14, cy + CH/2 - nameH);
    namePlateG.strokePath();
    this._displayGroup.add(namePlateG);

    const displayName = mon.nickname ?? sp.name;
    this._displayGroup.add(this.add.text(cx, cy + CH/2 - nameH / 2, displayName, {
      fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#FFFFFF',
      stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(23));

    // Level badge top-left
    const lvlLabel = getLevelName(mon.level);
    const lvlBg = this.add.graphics().setDepth(23);
    lvlBg.fillStyle(0x000000, 0.72); lvlBg.fillRoundedRect(vpX + 3, vpY + 3, lvlLabel.length*8.5 + 12, 22, 5);
    this._displayGroup.add(lvlBg);
    this._displayGroup.add(this.add.text(vpX + 7, vpY + 13, lvlLabel, {
      fontFamily: FONT, fontSize: '14px', color: '#FFE066', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(24));

    const monTrait = TRAITS.find(t => t.id === mon.trait);
    if (monTrait) {
      this._displayGroup.add(this.add.text(vpX + vpW - 5, vpY + vpH - 5, monTrait.emoji, {
        fontFamily: FONT, fontSize: '15px',
      }).setOrigin(1, 1).setDepth(24));
    }

    if (mods.isGolden) {
      this._displayGroup.add(this.add.text(vpX + vpW - 5, vpY + 5, '★', {
        fontFamily: FONT, fontSize: '15px', color: '#FFD700',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(1, 0).setDepth(24));
    }

    // Evolved ✨ badge
    if (mon.evolved) {
      this._displayGroup.add(this.add.text(vpX + 4, vpY + vpH - 4, '✨', {
        fontFamily: FONT, fontSize: '13px',
      }).setOrigin(0, 1).setDepth(24));
    }

    // Featured species gold banner
    const featuredId = Game.state!.featuredSpeciesId;
    if (featuredId !== undefined && mon.speciesId === featuredId && (Game.state!.featuredUntil ?? 0) > Date.now()) {
      const featBg = this.add.graphics().setDepth(25);
      featBg.fillStyle(0x7A5000, 0.95);
      featBg.fillRoundedRect(vpX, vpY + vpH - 20, vpW, 20, { tl: 0, tr: 0, bl: 2, br: 2 });
      featBg.lineStyle(1, 0xFFCC00, 0.7);
      featBg.strokeRoundedRect(vpX, vpY + vpH - 20, vpW, 20, { tl: 0, tr: 0, bl: 2, br: 2 });
      this._displayGroup.add(featBg);
      this._displayGroup.add(this.add.text(cx, vpY + vpH - 10, '⭐ ' + t('hub.featured2x'), {
        fontFamily: FONT, fontSize: '11px', color: '#FFD700', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(26));
    }

    const vpCY = vpY + vpH/2 + 2;
    const texKey = makeMonsterTexture(this, mon);
    const img = this.add.image(cx, vpCY, texKey).setDisplaySize(96, 96).setDepth(22);
    this._displayGroup.add(img);
    this._bobTweens.push(this.tweens.add({
      targets: img, y: img.y - 5, duration: 1100 + Math.random()*400, ease: 'Sine.InOut', yoyo: true, repeat: -1,
    }));
    const bs = img.scaleX;
    this.time.delayedCall(Math.random() * 2000, () => {
      if (!img.active) return;
      this.tweens.add({
        targets: img, scaleX: bs * 1.06, scaleY: bs * 1.06,
        duration: 1400 + Math.random() * 600, ease: 'Sine.InOut', yoyo: true, repeat: -1,
      });
    });

    // Happy Bloom — gold border pulse + floating stars when happiness is maxed
    if (mon.happiness >= 100) {
      const bloomBorder = this.add.graphics().setDepth(29);
      bloomBorder.lineStyle(3, 0xFFD700, 1);
      bloomBorder.strokeRoundedRect(cx - CW/2, cy - CH/2, CW, CH, 8);
      this._displayGroup.add(bloomBorder);
      this.tweens.add({ targets: bloomBorder, alpha: 0.2, duration: 900, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
      const spawnStars = () => {
        if (!img.active) return;
        for (let i = 0; i < 3; i++) {
          const sx = cx + (Math.random() - 0.5) * 60;
          const sy = vpCY + (Math.random() - 0.5) * 20;
          const star = this.add.text(sx, sy, Math.random() > 0.5 ? '✦' : '✧', {
            fontFamily: FONT, fontSize: `${11 + Math.floor(Math.random() * 6)}px`,
            color: Math.random() > 0.5 ? '#FFD0F0' : '#FFFFFF',
          }).setOrigin(0.5).setDepth(28).setAlpha(0);
          this._displayGroup.add(star);
          this.tweens.add({
            targets: star, y: sy - 40 - Math.random() * 20, alpha: { from: 0.9, to: 0 },
            duration: 1200 + Math.random() * 600, ease: 'Sine.In', delay: i * 200,
            onComplete: () => { if (star.active) star.destroy(); },
          });
        }
      };
      spawnStars();
      this._bloomTimers.push(this.time.addEvent({ delay: 3000, loop: true, callback: spawnStars }));
    }

    // Stat indicator dots (hunger · happiness · cleanliness) bottom-left of viewport
    const statDotG = this.add.graphics().setDepth(24);
    const dotY = vpY + vpH - 9;
    statDotG.fillStyle(0x000000, 0.55); statDotG.fillRoundedRect(vpX + 1, dotY - 7, 54, 15, 4);
    const statPcts = [mon.hunger / 100, mon.happiness / 100, mon.cleanliness / 100];
    const statCols = [
      (p: number) => p > 0.65 ? 0xF57C00 : p > 0.30 ? 0xFFCC44 : 0xFF4444,
      (p: number) => p > 0.65 ? 0x44DD44 : p > 0.30 ? 0xFFCC22 : 0xFF4444,
      (p: number) => p > 0.65 ? 0x29B6F6 : p > 0.30 ? 0xFFCC22 : 0xFF4444,
    ];
    statPcts.forEach((p, i) => {
      const dx = vpX + 10 + i * 16;
      statDotG.fillStyle(0x111111, 0.50); statDotG.fillCircle(dx, dotY, 4.5);
      statDotG.fillStyle(statCols[i](Math.max(0, Math.min(1, p))), 1); statDotG.fillCircle(dx, dotY, 4);
    });
    this._displayGroup.add(statDotG);

    const listing = Game.state!.listings.find(l => l.monsterId === mon.id);
    if (listing) {
      const ready = Date.now() >= listing.readyAt;
      const banner = this.add.graphics().setDepth(25);
      banner.fillStyle(ready ? 0x1A7040 : 0x884400, 0.93);
      banner.fillRoundedRect(vpX, vpY, vpW, 22, { tl: 2, tr: 2, bl: 0, br: 0 });
      banner.lineStyle(1, ready ? 0x55EE88 : 0xFFCC44, 0.55);
      banner.strokeRoundedRect(vpX, vpY, vpW, 22, { tl: 2, tr: 2, bl: 0, br: 0 });
      this._displayGroup.add(banner);
      this._displayGroup.add(this.add.text(cx, vpY + 11, ready ? t('hub.listingReady') : t('hub.listingActive'), {
        fontFamily: FONT, fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 1,
      }).setOrigin(0.5).setDepth(26));

      if (ready) {
        // Pulsing green glow border on the whole card
        const readyGlow = this.add.graphics().setDepth(20);
        readyGlow.lineStyle(3, 0x44FF88, 0.8);
        readyGlow.strokeRoundedRect(cx - CW/2, cy - CH/2, CW, CH, 8);
        this._displayGroup.add(readyGlow);
        this.tweens.add({ targets: readyGlow, alpha: 0.15, duration: 700, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
      }
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
    const habBase: Record<string, number> = { dirt: 0xFF9900, grass: 0x66EE33, aquatic: 0x22CCFF };
    const eggColor = shiftHue(habBase[sp.habitat] ?? sp.baseColor, mods.hueShift);
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
      fontFamily: FONT, fontSize: '16px', fontStyle: 'bold',
      color: isReady ? '#CCFFAA' : eNameColor, stroke: '#000000', strokeThickness: 1,
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
        fontFamily: FONT, fontSize: '13px', color: '#CCBBAA',
      }).setOrigin(0, 0).setDepth(24));
    }

    const remaining = Math.max(0, egg.hatchEndAt - now);
    const timerTxt = this.add.text(cx, vpY + vpH - 14, isReady ? '✨ Tap to hatch!' : this._formatMs(remaining), {
      fontFamily: FONT, fontSize: '13px',
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
        if (monCount >= cap) { showToast(this, t('toast.habitatFull'), '#ff9999'); return; }
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
    if (this._welcomeActive || this._instantOfferActive) return;
    this._instantOfferActive = true;
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

    popup.add(this.add.text(W/2, H/2 - 68, t('hatchOffer.hatching', { name }), {
      fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5));
    popup.add(this.add.text(W/2, H/2 - 40, t('hatchOffer.remaining', { mins: minsLeft }), {
      fontFamily: FONT, fontSize: '14px', color: '#BBCCFF',
    }).setOrigin(0.5));

    const close = () => { this._instantOfferActive = false; popup.destroy(); };

    popup.add(makeButton(this, W/2, H/2 + 10, 240, 46, t('hatchOffer.watch'), 0x7A4A00, () => {
      Ads.showRewarded(res => {
        close();
        if (res.rewarded) {
          const egg = Game.state!.eggs.find(e => e.id === eggId);
          if (egg) { egg.hatchEndAt = Date.now() - 1; }
          this.refreshAll();
          showToast(this, t('hatchOffer.hatched'), '#aaffaa');
        }
      });
    }, 14));
    popup.add(makeButton(this, W/2, H/2 + 68, 120, 38, t('btn.wait'), 0x2a1560, close, 13));
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
    this._updateEggStripTimerLabels();
    this._checkReadyBreedingEggs();
  }

  private _updateEggStripTimerLabels() {
    const now = Date.now();
    this._eggStripTexts.forEach((txt, eggId) => {
      if (!txt.active) return;
      const egg = Game.state?.eggs.find(e => e.id === eggId);
      if (!egg) return;
      const remaining = Math.max(0, egg.hatchEndAt - now);
      const ready = remaining <= 0;
      txt.setText(ready ? '✨ Ready!' : ('🥚 ' + this._formatMs(remaining)));
      txt.setStyle({ color: ready ? '#88FFAA' : '#AABBFF', fontStyle: ready ? 'bold' : 'normal' });
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
    if (this._coinTxt) {
      this._coinTxt.setText('💰 ' + Game.state!.coins);
      this.tweens.killTweensOf(this._coinTxt);
      this.tweens.add({ targets: this._coinTxt, scaleX: 1.28, scaleY: 1.28, duration: 110, ease: 'Back.Out', yoyo: true });
    }
    if (this._diamondTxt) {
      const diamonds = Game.state!.diamonds ?? 0;
      const crystals = Game.state!.moonCrystals ?? 0;
      if (crystals > 0) {
        this._diamondTxt.setFontSize('16px');
        this._diamondTxt.setText('💎 ' + diamonds + '\n🌙 ' + crystals);
      } else {
        this._diamondTxt.setFontSize('22px');
        this._diamondTxt.setText('💎 ' + diamonds);
      }
    }
  }

  updateCoins() { this._updateCoinDisplay(); }

  private _markDiscovered(speciesId: number) {
    const disc = Game.state!.stats.discovered;
    if (!disc.includes(speciesId)) {
      disc.push(speciesId);
    }
  }

  private _showShopLevelUpPopup(newLevel: number, coins: number, diamonds: number, crystals: number) {
    const W = this.scale.width, H = this.scale.height;
    const isMilestone = newLevel % 5 === 0;

    const popup = this.add.container(0, 0).setDepth(58);
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.70);
    overlay.fillRect(0, 0, W, H);
    popup.add(overlay);

    const panW = 340, panH = 310;
    const px = W / 2 - panW / 2, py = H / 2 - panH / 2 - 20;
    const panel = this.add.graphics();
    panel.fillStyle(0x0A0820, 1);
    panel.fillRoundedRect(px, py, panW, panH, 20);
    panel.lineStyle(3, isMilestone ? 0xFFCC00 : 0x9955FF, 1);
    panel.strokeRoundedRect(px, py, panW, panH, 20);
    if (isMilestone) {
      panel.fillStyle(0xFFAA00, 0.08);
      panel.fillRoundedRect(px + 4, py + 4, panW - 8, 60, { tl: 16, tr: 16, bl: 0, br: 0 });
    }
    popup.add(panel);

    // Badge animation
    const badge = this.add.graphics().setDepth(59);
    badge.fillStyle(isMilestone ? 0xFFAA00 : 0x5522AA, 1);
    badge.fillCircle(W / 2, py + 50, 34);
    badge.lineStyle(4, isMilestone ? 0xFFEE44 : 0xCC88FF, 1);
    badge.strokeCircle(W / 2, py + 50, 34);
    popup.add(badge);
    popup.add(this.add.text(W / 2, py + 44, 'Lv', { fontFamily: FONT, fontSize: '12px', color: '#FFFFFF', fontStyle: 'bold' }).setOrigin(0.5));
    popup.add(this.add.text(W / 2, py + 58, String(newLevel), { fontFamily: FONT, fontSize: '22px', color: '#FFFFFF', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2 }).setOrigin(0.5));

    popup.add(this.add.text(W / 2, py + 100, t('shopLv.levelUp', { n: newLevel }), {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold',
      color: isMilestone ? '#FFD700' : '#CC99FF',
    }).setOrigin(0.5));

    // Reward lines
    let ry = py + 138;
    popup.add(this.add.text(W / 2, ry, `+${coins} 💰`, { fontFamily: FONT, fontSize: '20px', color: '#FFD700', fontStyle: 'bold' }).setOrigin(0.5));
    if (diamonds > 0) {
      ry += 36;
      popup.add(this.add.text(W / 2, ry, `+${diamonds} 💎`, { fontFamily: FONT, fontSize: '20px', color: '#88CCFF', fontStyle: 'bold' }).setOrigin(0.5));
    }
    if (crystals > 0) {
      ry += 36;
      popup.add(this.add.text(W / 2, ry, t('shopLv.rewardCrystal'), { fontFamily: FONT, fontSize: '18px', color: '#CCAAFF', fontStyle: 'bold' }).setOrigin(0.5));
    }

    const close = () => { popup.destroy(); };
    popup.add(makeButton(this, W / 2, py + panH - 32, 180, 44, '🎉 ' + t('btn.confirm'), isMilestone ? 0x7A5A00 : 0x3A1878, close, 15));

    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
    overlay.on('pointerdown', close);

    // Particle burst
    this._spawnLvUpBurst(W / 2, py + 50, isMilestone ? 0xFFD700 : 0xAA66FF);
    sfx.levelup();
  }

  private _spawnLvUpBurst(cx: number, cy: number, color: number) {
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const dist = 60 + Math.random() * 50;
      const star = this.add.text(cx, cy, '✦', {
        fontFamily: FONT, fontSize: `${10 + Math.floor(Math.random() * 8)}px`,
        color: '#' + color.toString(16).padStart(6, '0'),
      }).setOrigin(0.5).setDepth(59).setAlpha(0.9);
      this.tweens.add({
        targets: star,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        alpha: 0, scaleX: 0.3, scaleY: 0.3,
        duration: 700 + Math.random() * 400,
        ease: 'Sine.Out',
        onComplete: () => { if (star.active) star.destroy(); },
      });
    }
  }

  private _checkReadyBreedingEggs() {
    if (this._welcomeActive || this._hatchPromptActive || this.scene.isActive('HatchScene')) return;
    const now = Date.now();
    const readyEgg = Game.state!.eggs.find(
      e => e.source === 'breeding' && now >= e.hatchEndAt && !this._hatchPrompted.has(e.id),
    );
    if (!readyEgg) return;
    this._hatchPrompted.add(readyEgg.id);
    this._hatchPromptActive = true;

    const W = this.scale.width, H = this.scale.height;
    const sp = SPECIES[readyEgg.speciesId];
    const popup = this.add.container(0, 0).setDepth(55);

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.65);
    overlay.fillRect(0, 0, W, H);
    popup.add(overlay);

    const panel = this.add.graphics();
    panel.fillStyle(0x0A0820, 1);
    panel.fillRoundedRect(W / 2 - 160, H / 2 - 110, 320, 220, 18);
    panel.lineStyle(2, 0xAA66FF, 0.9);
    panel.strokeRoundedRect(W / 2 - 160, H / 2 - 110, 320, 220, 18);
    popup.add(panel);

    popup.add(this.add.text(W / 2, H / 2 - 80, '🥚✨', {
      fontFamily: FONT, fontSize: '36px',
    }).setOrigin(0.5));
    popup.add(this.add.text(W / 2, H / 2 - 36, t('toast.breedEggReady'), {
      fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#CC99FF',
    }).setOrigin(0.5));
    popup.add(this.add.text(W / 2, H / 2 - 10, sp.name, {
      fontFamily: FONT, fontSize: '14px', color: '#DDCCFF',
    }).setOrigin(0.5));

    const close = () => { this._hatchPromptActive = false; popup.destroy(); };

    const hatchBtn = makeButton(this, W / 2, H / 2 + 44, 220, 46, '🐣 ' + t('btn.hatchNow'), 0x5A2A90, () => {
      close();
      const cap = (Game.state!.tanks?.[readyEgg.habitatType] ?? 1) * TANK_CAPACITY;
      const monCount = Game.state!.monsters.filter(m => m.habitatType === readyEgg.habitatType).length;
      if (monCount >= cap) { showToast(this, t('toast.habitatFull'), '#ff9999'); return; }
      this.scene.launch('HatchScene', { eggId: readyEgg.id });
    });
    popup.add(hatchBtn);

    const laterBtn = makeButton(this, W / 2, H / 2 + 96, 220, 38, t('btn.later'), 0x221144, close, 14);
    popup.add(laterBtn);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, W, H), Phaser.Geom.Rectangle.Contains);
  }

  onEggHatched(eggId: string, monster: Monster) {
    if (!Game.state!.eggs.some(e => e.id === eggId)) return;
    Game.state!.eggs = Game.state!.eggs.filter(e => e.id !== eggId);
    if (Game.state!.monsters.some(m => m.id === monster.id)) return;
    Game.state!.monsters.push(monster);
    Game.state!.stats.hatched++;
    this._markDiscovered(monster.speciesId);
    // Advance both daily and weekly hatch quests.
    recordQuestProgress('hatch');
    store.setJSON('mps_state', Game.state);
    this._updateCoinDisplay();
    this.refreshAll();
  }
}
