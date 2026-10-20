import Phaser from 'phaser';
import { Game, FONT, store, sfx } from '../utils';
import { t } from '../i18n';
import { CATALOG, HABITATS, newEgg, SPECIES, generateMerchantStock, MERCHANT_REFRESH_MS, TANK_CAPACITY, DECORATIONS, TOY_TYPES } from '../data';
import type { Monster } from '../types';
import { shiftHue, darken, lighten } from '../MonsterRenderer';
import { makeButton } from '../ui/Button';
import { showToast } from '../ui/Toast';

export class Merchant extends Phaser.Scene {
  private _filter: string = 'dirt';
  private _filterGroup!: Phaser.GameObjects.Group;
  private _gridGroup!: Phaser.GameObjects.Group;
  private _coinTxt!: Phaser.GameObjects.Text;
  private _refreshTxt!: Phaser.GameObjects.Text;
  private _refreshTimer: Phaser.Time.TimerEvent | null = null;
  private _toyHabitat = 'dirt';
  private _toyPickerGroup: Phaser.GameObjects.Group | null = null;

  constructor() { super({ key: 'Merchant' }); }

  create() {
    sfx.unlock();
    const W = this.scale.width, H = this.scale.height;

    this._buildBackground(W, H);
    this._buildHUD(W, H);

    if (!Game.state!.merchantStock?.length || Date.now() >= Game.state!.merchantRefreshAt) {
      Game.state!.merchantStock = generateMerchantStock();
      Game.state!.merchantRefreshAt = Date.now() + MERCHANT_REFRESH_MS;
      store.setJSON('mps_state', Game.state);
    }

    this._refreshTxt = this.add.text(W / 2, 122, this._refreshLabel(), {
      fontFamily: FONT, fontSize: '13px', color: '#9988BB', align: 'center',
    }).setOrigin(0.5).setDepth(5);

    this._filter = 'dirt';
    this._filterGroup = this.add.group();
    this._buildFilterTabs(W);
    this._gridGroup = this.add.group();
    this._buildGrid(W, H);
    this._startRefreshTimer();
    this._startAmbient(W, H);
  }

  // ── BACKGROUND ─────────────────────────────────────────────────────────────

  private _buildBackground(W: number, H: number) {
    const bg = this.add.graphics().setDepth(0);

    // Base: full deep indigo gradient
    bg.fillGradientStyle(0x06021C, 0x06021C, 0x100436, 0x100436, 1);
    bg.fillRect(0, 0, W, H);

    // Header band slightly richer purple
    bg.fillGradientStyle(0x1C0650, 0x1C0650, 0x080220, 0x080220, 1);
    bg.fillRect(0, 0, W, 165);

    // Stars — only in the header zone (y < 165) so they never overlap cards
    for (let i = 0; i < 38; i++) {
      const sx = Math.random() * W;
      const sy = Math.random() * 162;
      bg.fillStyle(0xFFFFFF, 0.18 + Math.random() * 0.50);
      bg.fillCircle(sx, sy, 0.6 + Math.random() * 1.1);
    }

    // Subtle divider line between header and card zone
    bg.fillStyle(0x6622BB, 0.28);
    bg.fillRect(0, 163, W, 2);

    // Bottom fade — same purple family, no black
    bg.fillGradientStyle(0x100436, 0x100436, 0x080220, 0x080220, 1);
    bg.fillRect(0, H - 70, W, 70);

    // Sign board (wooden)
    const sg = this.add.graphics().setDepth(3);
    // Board shadow
    sg.fillStyle(0x000000, 0.40);
    sg.fillRoundedRect(W / 2 - 148, 56, 300, 54, 10);
    // Board body (layered wood tones)
    sg.fillStyle(0x5C2E08, 1);
    sg.fillRoundedRect(W / 2 - 146, 54, 296, 52, 9);
    sg.fillStyle(0x7A3A0E, 1);
    sg.fillRoundedRect(W / 2 - 143, 56, 290, 46, 7);
    sg.lineStyle(2.5, 0xFFCC44, 0.88);
    sg.strokeRoundedRect(W / 2 - 143, 56, 290, 46, 7);
    sg.fillStyle(0xFFCC44, 0.10);
    sg.fillRoundedRect(W / 2 - 143, 56, 290, 46, 7);
    // Hanging rope lines
    ([W / 2 - 110, W / 2 + 110] as number[]).forEach(hx => {
      sg.lineStyle(1.5, 0x7A4A18, 0.72);
      sg.beginPath(); sg.moveTo(hx, 0); sg.lineTo(hx, 56); sg.strokePath();
      sg.fillStyle(0xFFAA22, 1);
      sg.fillCircle(hx, 6, 4.5);
      sg.fillCircle(hx, 20, 3.5);
      sg.fillCircle(hx, 33, 3);
    });

    this.add.text(W / 2, 81, t('merchant.title'), {
      fontFamily: FONT, fontSize: '18px', fontStyle: 'bold',
      color: '#FFE888', stroke: '#4A2204', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(4);
  }

  private _buildHUD(W: number, H: number) {
    // Coin badge
    const coinBg = this.add.graphics().setDepth(5);
    coinBg.fillStyle(0x160640, 0.94);
    coinBg.fillRoundedRect(8, 8, 148, 40, 20);
    coinBg.lineStyle(1.5, 0xFFCC00, 0.65);
    coinBg.strokeRoundedRect(8, 8, 148, 40, 20);
    this.add.text(26, 28, '💰', { fontFamily: FONT, fontSize: '18px' }).setOrigin(0, 0.5).setDepth(5);
    this._coinTxt = this.add.text(57, 28, String(Game.state!.coins), {
      fontFamily: FONT, fontSize: '17px', color: '#FFD700', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(5);

    // Diamond badge
    const dBg = this.add.graphics().setDepth(5);
    dBg.fillStyle(0x160640, 0.94);
    dBg.fillRoundedRect(164, 8, 82, 40, 20);
    dBg.lineStyle(1.5, 0x88CCFF, 0.55);
    dBg.strokeRoundedRect(164, 8, 82, 40, 20);
    this.add.text(178, 28, '💎', { fontFamily: FONT, fontSize: '16px' }).setOrigin(0, 0.5).setDepth(5);
    this.add.text(198, 28, String(Game.state!.diamonds ?? 0), {
      fontFamily: FONT, fontSize: '15px', color: '#88CCFF', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(5);

    // Back button
    makeButton(this, W - 62, 28, 100, 40, t('btn.back'), 0x6030A8, () => {
      this.scene.start('Hub');
    }, 14).setDepth(5);
  }

  // ── AMBIENT ────────────────────────────────────────────────────────────────

  private _startAmbient(W: number, H: number) {
    // Orbs confined to the header zone (y < 155) — never behind cards
    ([
      [W * 0.12, 62, 0x8833FF, 30],
      [W * 0.88, 58, 0x3366FF, 26],
      [W * 0.50, 140, 0xAA33FF, 20],
    ] as [number, number, number, number][]).forEach(([ox, oy, oc, or]) => {
      const og = this.add.graphics().setDepth(1);
      og.fillStyle(oc, 0.10);
      og.fillCircle(ox, oy, or);
      og.fillStyle(oc, 0.18);
      og.fillCircle(ox, oy, or * 0.45);
      this.tweens.add({
        targets: og, alpha: { from: 0.55, to: 0.15 },
        duration: 2000 + Math.random() * 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut',
      });
    });

    // Sparkles: header-only (y < 160), depth 1 so grid cards (depth 3) always win
    const sparkleColors = [0xFFCC44, 0xCC66FF, 0x66DDFF, 0xFF88CC];
    const spawnSparkle = () => {
      if (!this.scene?.isActive('Merchant')) return;
      const sx = 12 + Math.random() * (W - 24);
      const sy = 8 + Math.random() * 150;   // header band only
      const sc = sparkleColors[Math.floor(Math.random() * sparkleColors.length)];
      const sg = this.add.graphics().setDepth(1);
      sg.fillStyle(sc, 0.90);
      sg.fillCircle(0, 0, 1.5 + Math.random() * 2);
      sg.setPosition(sx, sy);
      this.tweens.add({
        targets: sg,
        y: sy - 28 - Math.random() * 24,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 700 + Math.random() * 500, ease: 'Sine.Out',
        onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
      });
    };
    this.time.addEvent({ delay: 480, loop: true, callback: spawnSparkle });

    // Subtle floating magic dust throughout the scene (card zone)
    const spawnDust = () => {
      if (!this.scene?.isActive('Merchant')) return;
      const dx = 12 + Math.random() * (W - 24);
      const dy = 170 + Math.random() * (H - 240);
      const dc = [0xFFCC44, 0xCC66FF, 0x66DDFF, 0xFF88CC][Math.floor(Math.random() * 4)];
      const dg = this.add.graphics().setDepth(1);
      dg.fillStyle(dc, 0.32);
      dg.fillCircle(0, 0, 0.8 + Math.random() * 1.2);
      dg.setPosition(dx, dy);
      this.tweens.add({
        targets: dg,
        y: dy - 16 - Math.random() * 14,
        x: dx + (Math.random() - 0.5) * 20,
        alpha: 0,
        duration: 1300 + Math.random() * 700, ease: 'Sine.Out',
        onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
      });
    };
    this.time.addEvent({ delay: 320, loop: true, callback: spawnDust });
  }

  // ── FILTER TABS ────────────────────────────────────────────────────────────

  private _refreshLabel(): string {
    const remaining = Math.max(0, Game.state!.merchantRefreshAt - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return t('merchant.restock', { time: mins + ':' + String(secs).padStart(2, '0') });
  }

  private _startRefreshTimer() {
    if (this._refreshTimer) this._refreshTimer.remove();
    this._refreshTimer = this.time.addEvent({
      delay: 1000, loop: true, callback: () => {
        if (Date.now() >= Game.state!.merchantRefreshAt) {
          Game.state!.merchantStock = generateMerchantStock();
          Game.state!.merchantRefreshAt = Date.now() + MERCHANT_REFRESH_MS;
          store.setJSON('mps_state', Game.state);
          this._buildGrid(this.scale.width, this.scale.height);
          this._refreshTxt.setText(t('merchant.freshStock'));
        } else {
          this._refreshTxt.setText(this._refreshLabel());
        }
      },
    });
  }

  private _buildFilterTabs(W: number) {
    const filters = ['dirt', 'grass', 'aquatic', 'decor', 'toys'];
    const labels: Record<string, string> = {
      dirt: t('tab.dirt'), grass: t('tab.grass'),
      aquatic: t('tab.aquatic'), decor: t('tab.decor'), toys: t('tab.toys'),
    };
    const tabW = (W - 20) / 5;
    filters.forEach((f, i) => {
      const x = 10 + tabW * i;
      const g = this.add.graphics().setDepth(4);
      const lbl = this.add.text(x + tabW / 2, 148, labels[f], {
        fontFamily: FONT, fontSize: '13px', color: '#9988CC',
      }).setOrigin(0.5).setDepth(5);
      this._filterGroup.addMultiple([g, lbl]);
      (g as any)._filterKey = f;
      (lbl as any)._filterKey = f;
      const zone = this.add.zone(x + tabW / 2, 148, tabW - 4, 34)
        .setInteractive().setDepth(5);
      zone.on('pointerdown', () => {
        this._filter = f;
        this._buildGrid(this.scale.width, this.scale.height);
        this._updateFilterTabs();
      });
      this._filterGroup.add(zone);
    });
    this._updateFilterTabs();
  }

  private _updateFilterTabs() {
    const W = this.scale.width;
    const filters = ['dirt', 'grass', 'aquatic', 'decor', 'toys'];
    const tabW = (W - 20) / filters.length;
    const activeCol: Record<string, number> = { dirt: 0x7A3808, grass: 0x286020, aquatic: 0x0E5A90, decor: 0x702808, toys: 0x4A1878 };
    const glowCol: Record<string, number>   = { dirt: 0xFFAA44, grass: 0x66DD33, aquatic: 0x44CCFF, decor: 0xFFAA22, toys: 0xCC88FF };

    this._filterGroup.getChildren().forEach(child => {
      const key = (child as any)._filterKey;
      if (!key) return;
      const i = filters.indexOf(key);
      const active = key === this._filter;
      if (child.type === 'Graphics') {
        const g = child as Phaser.GameObjects.Graphics;
        g.clear();
        const tx = 10 + tabW * i;
        if (active) {
          g.fillStyle(glowCol[key] ?? 0xFFAA44, 0.14);
          g.fillRoundedRect(tx, 133, tabW - 2, 32, 9);
          g.fillStyle(activeCol[key] ?? 0x7A3808, 1);
          g.fillRoundedRect(tx + 1, 134, tabW - 4, 30, 8);
          g.lineStyle(1.5, glowCol[key] ?? 0xFFAA44, 0.82);
          g.strokeRoundedRect(tx + 1, 134, tabW - 4, 30, 8);
        } else {
          g.fillStyle(0x160638, 0.85);
          g.fillRoundedRect(tx + 1, 134, tabW - 4, 30, 8);
          g.lineStyle(1, 0x3A1668, 0.55);
          g.strokeRoundedRect(tx + 1, 134, tabW - 4, 30, 8);
        }
      } else if (child.type === 'Text') {
        const gc = glowCol[key];
        const hex = '#' + gc.toString(16).padStart(6, '0');
        (child as Phaser.GameObjects.Text).setStyle({
          color: active ? hex : '#887799',
          fontStyle: active ? 'bold' : 'normal',
        });
      }
    });
  }

  // ── GRID ───────────────────────────────────────────────────────────────────

  private _buildGrid(W: number, H: number) {
    this._closeToyPicker();
    this._gridGroup.clear(true, true);
    this._refreshTxt.setVisible(this._filter !== 'toys');

    if (this._filter === 'toys') {
      this._buildToyGrid(W, H);
      return;
    }
    if (this._filter === 'decor') {
      this._buildDecorGrid(W, H);
      return;
    }

    const stockIds = Game.state!.merchantStock ?? [];
    const filtered = stockIds.map(id => SPECIES[id]).filter(sp => sp && sp.habitat === this._filter);

    if (filtered.length === 0) {
      this._gridGroup.add(this.add.text(W / 2, 440, t('merchant.noStock', { habitat: this._filter }), {
        fontFamily: FONT, fontSize: '16px', color: '#7766AA', align: 'center',
      }).setOrigin(0.5));
      return;
    }

    const cols = 2, cardW = 220, cardH = 198;
    const gapX = (W - cols * cardW) / (cols + 1);
    const startY = 172;

    const cardBase: Record<string, [number, number]> = {
      dirt:    [0x2A1208, 0x4A2210],
      grass:   [0x081A08, 0x143814],
      aquatic: [0x061420, 0x102838],
    };

    filtered.forEach((sp, idx) => {
      const col = idx % cols, row = Math.floor(idx / cols);
      const cx = gapX + cardW / 2 + col * (cardW + gapX);
      const cy = startY + 16 + row * (cardH + 14) + cardH / 2;
      const unlocked = Game.state!.habitats[sp.habitat].unlocked;
      const [cDark, cLight] = cardBase[sp.habitat] ?? [0x1A0840, 0x2E1458];
      const borderCol = HABITATS[sp.habitat].wallColor;

      // Card shadow
      const card = this.add.graphics().setDepth(3);
      card.fillStyle(0x000000, 0.44);
      card.fillRoundedRect(cx - cardW / 2 + 5, cy - cardH / 2 + 5, cardW, cardH, 16);
      // Card body
      card.fillGradientStyle(cDark, cDark, cLight, cLight, 1);
      card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 16);
      // Habitat color header strip
      card.fillStyle(borderCol, unlocked ? 0.22 : 0.07);
      card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, 60, { tl: 16, tr: 16, bl: 0, br: 0 });
      // Habitat bottom glow edge
      card.fillStyle(borderCol, unlocked ? 0.12 : 0.04);
      card.fillRoundedRect(cx - cardW / 2, cy + cardH / 2 - 20, cardW, 20, { tl: 0, tr: 0, bl: 16, br: 16 });
      // Border
      card.lineStyle(unlocked ? 2.5 : 1.5, borderCol, unlocked ? 0.90 : 0.22);
      card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 16);
      // Inner top glow
      card.fillStyle(0xFFFFFF, 0.06);
      card.fillRoundedRect(cx - cardW / 2 + 3, cy - cardH / 2 + 3, cardW - 6, cardH * 0.45, { tl: 13, tr: 13, bl: 0, br: 0 });
      this._gridGroup.add(card);

      // Egg with vivid habitat-based color + texture
      const eggG = this.add.graphics().setDepth(4);
      const habEggBase: Record<string, number> = { dirt: 0xFF9900, grass: 0x66EE33, aquatic: 0x22CCFF };
      const eggColor = shiftHue(habEggBase[sp.habitat] ?? sp.baseColor, ((sp.id * 11) % 7 - 3) * 20);
      const eggDark = darken(eggColor, 55);
      const eggLight = lighten(eggColor, 45);
      const eY = cy - 50;

      if (unlocked) {
        // Outer pulsing halos (3 concentric)
        eggG.fillStyle(eggColor, 0.07); eggG.fillEllipse(cx, eY, 108, 124);
        eggG.fillStyle(eggColor, 0.13); eggG.fillEllipse(cx, eY, 90, 106);
        eggG.fillStyle(eggColor, 0.22); eggG.fillEllipse(cx, eY, 76, 90);
        // Egg drop shadow
        eggG.fillStyle(eggDark, 0.70); eggG.fillEllipse(cx + 4, eY + 4, 66, 82);
        // Egg body
        eggG.fillStyle(eggColor, 1); eggG.fillEllipse(cx, eY, 66, 82);
        // Belly shimmer (right-center lighter area)
        eggG.fillStyle(eggLight, 0.38); eggG.fillEllipse(cx + 9, eY + 8, 32, 42);
        // Top highlight
        eggG.fillStyle(eggLight, 0.62); eggG.fillEllipse(cx - 10, eY - 22, 24, 32);
        eggG.fillStyle(0xFFFFFF, 0.74); eggG.fillEllipse(cx - 11, eY - 24, 13, 17);
        // Speckles (darker dots)
        const speckles: [number, number, number][] = [
          [cx - 15, eY - 10, 3.8], [cx + 13, eY - 4, 3.0], [cx - 6, eY + 12, 3.5],
          [cx + 21, eY - 26, 2.8], [cx - 3, eY + 24, 3.0], [cx + 16, eY + 10, 2.5],
          [cx - 20, eY + 4, 2.5],
        ];
        speckles.forEach(([ex, ey, er]) => {
          eggG.fillStyle(eggDark, 0.52); eggG.fillCircle(ex, ey, er);
        });
        // Crack hint lines (faint jagged)
        eggG.lineStyle(1.5, eggDark, 0.42);
        eggG.beginPath(); eggG.moveTo(cx + 7, eY - 20); eggG.lineTo(cx + 14, eY - 10); eggG.lineTo(cx + 8, eY); eggG.strokePath();
        eggG.lineStyle(1.2, eggDark, 0.28);
        eggG.beginPath(); eggG.moveTo(cx - 9, eY + 5); eggG.lineTo(cx - 4, eY + 12); eggG.strokePath();
        // Rare star sparkle for hatchHours >= 10
        if (sp.hatchHours >= 10) {
          eggG.fillStyle(0xFFD700, 0.20); eggG.fillCircle(cx + 25, eY - 34, 14);
          eggG.fillStyle(0xFFD700, 0.96); eggG.fillCircle(cx + 25, eY - 34, 7);
          eggG.fillStyle(0xFFFFFF, 0.90); eggG.fillCircle(cx + 23, eY - 36, 3.5);
        }
        // Pulse animation
        this.tweens.add({
          targets: eggG,
          alpha: { from: 1.0, to: 0.76 },
          duration: 1600 + Math.random() * 900,
          yoyo: true, repeat: -1, ease: 'Sine.InOut',
        });
      } else {
        // Locked egg: dim and mysterious with a visible lock icon
        eggG.fillStyle(0x1A0840, 0.95); eggG.fillEllipse(cx, eY, 70, 86);
        eggG.fillStyle(sp.baseColor, 0.18); eggG.fillEllipse(cx, eY, 66, 82);
        eggG.lineStyle(2, sp.baseColor, 0.36); eggG.strokeEllipse(cx, eY, 66, 82);
        eggG.fillStyle(0xFFFFFF, 0.05); eggG.fillEllipse(cx - 11, eY - 24, 16, 24);
        // Lock body
        eggG.fillStyle(0xAA9944, 0.65); eggG.fillRoundedRect(cx - 13, eY - 8, 26, 20, 5);
        // Lock shackle (arc)
        eggG.lineStyle(3.5, 0xAA9944, 0.65);
        eggG.beginPath();
        eggG.moveTo(cx - 7, eY - 8);
        eggG.lineTo(cx - 7, eY - 18);
        eggG.arc(cx, eY - 18, 7, Math.PI, 0, false);
        eggG.lineTo(cx + 7, eY - 8);
        eggG.strokePath();
        // Keyhole
        eggG.fillStyle(0x220A44, 0.90); eggG.fillCircle(cx, eY, 5);
        eggG.fillStyle(0x220A44, 0.90); eggG.fillRect(cx - 2.5, eY, 5, 7);
      }
      this._gridGroup.add(eggG);

      // Name
      this._gridGroup.add(this.add.text(cx, cy - 6, unlocked ? sp.name : '???', {
        fontFamily: FONT, fontSize: '16px', fontStyle: 'bold',
        color: unlocked ? '#FFFFFF' : '#665588',
      }).setOrigin(0.5).setDepth(4));

      // Stats row
      const statRow = unlocked ? ('⏱ ' + sp.hatchHours + 'h  ·  💰 ' + sp.price) : t('merchant.locked');
      this._gridGroup.add(this.add.text(cx, cy + 15, statRow, {
        fontFamily: FONT, fontSize: '12px', color: unlocked ? '#CCBBEE' : '#443366',
      }).setOrigin(0.5).setDepth(4));

      // Tier dots
      const dots = Math.min(5, Math.max(1, Math.ceil(sp.hatchHours / 5)));
      for (let d = 0; d < 5; d++) {
        const dg = this.add.graphics().setDepth(4);
        dg.fillStyle(d < dots ? (unlocked ? 0xFFCC44 : 0x443366) : 0x1A0A3A, 1);
        dg.fillCircle(cx - 16 + d * 8, cy + 34, 3.5);
        this._gridGroup.add(dg);
      }

      // Buy / Unlock button
      const btnLabel = unlocked
        ? t('btn.buy', { price: sp.price })
        : t('btn.unlock', { cost: HABITATS[sp.habitat].unlockCost });
      const btnCol = unlocked ? 0x1E6828 : 0x480E78;
      const btn = makeButton(this, cx, cy + 62, unlocked ? 148 : 195, 38, btnLabel, btnCol, () => {
        this._handleBuy(sp.id, unlocked);
      }, 13).setDepth(4);
      btn.setAlpha(unlocked ? 1.0 : 0.60);
      this._gridGroup.add(btn);
    });
  }

  private _buildDecorGrid(W: number, H: number) {
    const cols = 2, cardW = 220, cardH = 148;
    const gapX = (W - cols * cardW) / (cols + 1);
    const startY = 172;
    const ownedAll: string[] = (['dirt', 'grass', 'aquatic'] as const)
      .filter(h => Game.state!.habitats[h].unlocked)
      .flatMap(h => Game.state!.habitats[h].decorations);

    const visible = DECORATIONS.filter(d => Game.state!.habitats[d.habitat].unlocked);
    if (visible.length === 0) {
      this._gridGroup.add(this.add.text(W / 2, 440, t('merchant.noDecor'), {
        fontFamily: FONT, fontSize: '16px', color: '#7766AA', align: 'center',
      }).setOrigin(0.5));
      return;
    }

    visible.forEach((dec, idx) => {
      const col = idx % cols, row = Math.floor(idx / cols);
      const cx = gapX + cardW / 2 + col * (cardW + gapX);
      const cy = startY + 14 + row * (cardH + 14) + cardH / 2;
      const isOwned = ownedAll.includes(dec.id);

      const card = this.add.graphics().setDepth(3);
      card.fillStyle(0x000000, 0.32);
      card.fillRoundedRect(cx - cardW / 2 + 3, cy - cardH / 2 + 3, cardW, cardH, 14);
      if (isOwned) {
        card.fillGradientStyle(0x0A2008, 0x0A2008, 0x163A12, 0x163A12, 1);
      } else {
        card.fillGradientStyle(0x160640, 0x160640, 0x241058, 0x241058, 1);
      }
      card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 14);
      card.lineStyle(2, isOwned ? 0x44CC44 : HABITATS[dec.habitat].wallColor, isOwned ? 0.80 : 0.50);
      card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 14);
      this._gridGroup.add(card);

      const habIcons: Record<string, string> = { dirt: '⛰', grass: '🌿', aquatic: '🌊' };
      const tierStars = '★'.repeat(dec.tier) + '☆'.repeat(3 - dec.tier);

      this._gridGroup.add(this.add.text(cx - cardW / 2 + 12, cy - cardH / 2 + 13, habIcons[dec.habitat], {
        fontFamily: FONT, fontSize: '14px',
      }).setDepth(4));
      this._gridGroup.add(this.add.text(cx + cardW / 2 - 12, cy - cardH / 2 + 15, tierStars, {
        fontFamily: FONT, fontSize: '12px', color: isOwned ? '#88EE88' : '#CCBB88',
      }).setOrigin(1, 0.5).setDepth(4));
      this._gridGroup.add(this.add.text(cx, cy - 22, dec.name, {
        fontFamily: FONT, fontSize: '15px', fontStyle: 'bold',
        color: isOwned ? '#AAFFAA' : '#FFFFFF',
      }).setOrigin(0.5).setDepth(4));
      this._gridGroup.add(this.add.text(cx, cy - 2, dec.desc, {
        fontFamily: FONT, fontSize: '12px', color: '#CCBBEE',
        wordWrap: { width: cardW - 24 }, align: 'center',
      }).setOrigin(0.5).setDepth(4));

      if (isOwned) {
        const oBadge = this.add.graphics().setDepth(4);
        oBadge.fillStyle(0x44AA44, 0.20);
        oBadge.fillRoundedRect(cx - 44, cy + 24, 88, 28, 14);
        oBadge.lineStyle(1.5, 0x66CC66, 0.80);
        oBadge.strokeRoundedRect(cx - 44, cy + 24, 88, 28, 14);
        this._gridGroup.add(oBadge);
        this._gridGroup.add(this.add.text(cx, cy + 38, t('decor.installed'), {
          fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#66CC66',
        }).setOrigin(0.5).setDepth(4));
      } else {
        const btn = makeButton(this, cx, cy + 40, 158, 36, t('btn.buyDecor', { cost: dec.cost }), 0x461070, () => {
          this._handleBuyDecor(dec.id);
        }, 13).setDepth(4);
        this._gridGroup.add(btn);
      }
    });
  }

  // ── HANDLERS (logic unchanged) ─────────────────────────────────────────────

  private _handleBuyDecor(decId: string) {
    const dec = DECORATIONS.find(d => d.id === decId);
    if (!dec) return;
    const state = Game.state!;
    if (!state.habitats[dec.habitat].unlocked) {
      showToast(this, t('toast.unlockFirst', { name: HABITATS[dec.habitat].label }), '#ffaaaa');
      return;
    }
    if (state.habitats[dec.habitat].decorations.includes(decId)) {
      showToast(this, t('toast.alreadyInstalled'), '#ffaaaa');
      return;
    }
    if (state.coins < dec.cost) {
      showToast(this, t('toast.needCoins', { n: dec.cost }), '#ffaaaa');
      return;
    }
    state.coins -= dec.cost;
    state.habitats[dec.habitat].decorations.push(decId);
    store.setJSON('mps_state', state);
    this._coinTxt.setText(String(state.coins));
    sfx.buy();
    showToast(this, t('toast.decorInstalled', { name: dec.name }), '#aaffaa');
    this._buildGrid(this.scale.width, this.scale.height);
  }

  private _handleBuy(spId: number, unlocked: boolean) {
    const sp = SPECIES[spId];
    const state = Game.state!;
    if (!unlocked) {
      const cost = HABITATS[sp.habitat].unlockCost;
      if (state.coins < cost) {
        showToast(this, t('toast.needCoinsUnlock', { cost, name: HABITATS[sp.habitat].label }), '#ff9999');
        return;
      }
      state.coins -= cost;
      state.habitats[sp.habitat].unlocked = true;
      if (!state.tanks) state.tanks = { dirt: 0, grass: 0, aquatic: 0 };
      state.tanks[sp.habitat] = 4;
      store.setJSON('mps_state', state);
      this._coinTxt.setText(String(state.coins));
      sfx.buy();
      showToast(this, t('toast.unlocked', { name: HABITATS[sp.habitat].label }), '#aaffaa');
      this._buildGrid(this.scale.width, this.scale.height);
      return;
    }
    if (state.coins < sp.price) {
      showToast(this, t('toast.notEnough', { n: sp.price }), '#ff9999');
      return;
    }
    const tankCount = state.tanks?.[sp.habitat] ?? 0;
    if (tankCount === 0) {
      showToast(this, t('toast.buyTankFirst'), '#ffaaaa');
      return;
    }
    const cap = tankCount * TANK_CAPACITY;
    const usage = state.monsters.filter(m => m.habitatType === sp.habitat).length
                + state.eggs.filter(e => e.habitatType === sp.habitat).length;
    if (usage >= cap) {
      showToast(this, t('toast.habitatFull'), '#ffaaaa');
      return;
    }
    state.coins -= sp.price;
    const vi = Math.floor(Math.random() * 100);
    const egg = newEgg(sp.id, vi, 'merchant');
    state.eggs.push(egg);
    state.merchantStock = state.merchantStock.filter(id => id !== spId);
    store.setJSON('mps_state', state);
    this._coinTxt.setText(String(state.coins));
    sfx.buy();
    showToast(this, t('toast.eggAdded', { name: sp.name, h: sp.hatchHours }), '#aaffaa');
    this._buildGrid(this.scale.width, this.scale.height);
  }

  // ── TOYS TAB ──────────────────────────────────────────────────────────────

  private _buildToyGrid(W: number, H: number) {
    const habitats = ['dirt', 'grass', 'aquatic'] as const;
    const habLabels: Record<string, string> = { dirt: t('tab.dirt'), grass: t('tab.grass'), aquatic: t('tab.aquatic') };
    const habCols   = { dirt: 0xFFAA44, grass: 0x66DD33, aquatic: 0x44CCFF };
    const subTabW = (W - 20) / 3;

    // Habitat sub-tabs
    habitats.forEach((h, i) => {
      const tx = 10 + subTabW * i;
      const cx = tx + subTabW / 2;
      const active = h === this._toyHabitat;
      const col = habCols[h];

      const bg = this.add.graphics().setDepth(4);
      if (active) {
        bg.fillStyle(col, 0.18);
        bg.fillRoundedRect(tx + 1, 175, subTabW - 4, 28, 7);
        bg.lineStyle(1.5, col, 0.80);
        bg.strokeRoundedRect(tx + 1, 175, subTabW - 4, 28, 7);
      } else {
        bg.fillStyle(0x160638, 0.75);
        bg.fillRoundedRect(tx + 1, 175, subTabW - 4, 28, 7);
        bg.lineStyle(1, 0x3A1668, 0.50);
        bg.strokeRoundedRect(tx + 1, 175, subTabW - 4, 28, 7);
      }
      this._gridGroup.add(bg);

      const hexCol = '#' + col.toString(16).padStart(6, '0');
      this._gridGroup.add(this.add.text(cx, 189, habLabels[h], {
        fontFamily: FONT, fontSize: '13px',
        color: active ? hexCol : '#776699',
        fontStyle: active ? 'bold' : 'normal',
      }).setOrigin(0.5).setDepth(5));

      const zone = this.add.zone(cx, 189, subTabW - 4, 28).setInteractive().setDepth(5);
      zone.on('pointerdown', () => { this._toyHabitat = h; this._buildGrid(W, H); });
      this._gridGroup.add(zone);
    });

    // Toy cards
    const toyEmojis: Record<string, string> = { yarn: '🧶', stick: '🪄', gem: '💎' };
    const cardW = W - 40;
    const cardH = 96;
    const startY = 220;

    TOY_TYPES.forEach((toy, idx) => {
      const cy = startY + idx * (cardH + 10) + cardH / 2;
      const cx = W / 2;

      const card = this.add.graphics().setDepth(3);
      card.fillStyle(0x000000, 0.32);
      card.fillRoundedRect(cx - cardW / 2 + 3, cy - cardH / 2 + 3, cardW, cardH, 12);
      card.fillGradientStyle(0x1A0840, 0x1A0840, 0x2A1060, 0x2A1060, 1);
      card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 12);
      card.lineStyle(1.5, 0x6644AA, 0.50);
      card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 12);
      this._gridGroup.add(card);

      this._gridGroup.add(this.add.text(cx - cardW / 2 + 26, cy, toyEmojis[toy.id] ?? '🎁', {
        fontFamily: FONT, fontSize: '32px',
      }).setOrigin(0.5).setDepth(4));

      this._gridGroup.add(this.add.text(cx - cardW / 2 + 58, cy - 22, toy.name, {
        fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#FFFFFF',
      }).setOrigin(0, 0.5).setDepth(4));

      const tierStars = '★'.repeat(toy.tier) + '☆'.repeat(3 - toy.tier);
      this._gridGroup.add(this.add.text(cx - cardW / 2 + 58, cy - 2, tierStars + '   +' + toy.happinessGain + ' ❤', {
        fontFamily: FONT, fontSize: '12px', color: '#FFCC88',
      }).setOrigin(0, 0.5).setDepth(4));

      this._gridGroup.add(this.add.text(cx - cardW / 2 + 58, cy + 20, toy.cost + ' 💰', {
        fontFamily: FONT, fontSize: '13px', color: '#FFD700', fontStyle: 'bold',
      }).setOrigin(0, 0.5).setDepth(4));

      const btn = makeButton(this, cx + cardW / 2 - 66, cy, 112, 36, 'Give to ▾', 0x341278, () => {
        this._showMonsterPicker(toy.id, toy.name, toy.cost, toy.tier);
      }, 13).setDepth(4);
      this._gridGroup.add(btn);
    });
  }

  private _showMonsterPicker(toyId: string, toyName: string, toyCost: number, toyTier: number) {
    this._closeToyPicker();
    this._toyPickerGroup = this.add.group();

    const W = this.scale.width, H = this.scale.height;
    const state = Game.state!;
    const monsters = state.monsters.filter(m => m.habitatType === this._toyHabitat);
    const habIcons: Record<string, string> = { dirt: '⛰', grass: '🌿', aquatic: '🌊' };
    const toyEmojis: Record<string, string> = { yarn: '🧶', stick: '🪄', gem: '💎' };

    const backdrop = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65)
      .setDepth(28).setInteractive();
    backdrop.on('pointerdown', () => this._closeToyPicker());
    this._toyPickerGroup.add(backdrop);

    const panelW = Math.min(470, W - 30);
    const rowH = 76;
    const panelH = Math.min(560, 80 + Math.max(1, monsters.length) * rowH + 16);
    const panelX = W / 2 - panelW / 2;
    const panelY = Math.max(60, H / 2 - panelH / 2);

    const panel = this.add.graphics().setDepth(29);
    panel.fillStyle(0x12063A, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 18);
    panel.lineStyle(2, 0x8844DD, 0.85);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 18);
    this._toyPickerGroup.add(panel);

    const titleEmoji = toyEmojis[toyId] ?? '🎁';
    const habIcon = habIcons[this._toyHabitat] ?? '';
    this._toyPickerGroup.add(this.add.text(W / 2 - 16, panelY + 28,
      titleEmoji + ' ' + toyName + ' → ' + habIcon + ' monster', {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#CC88FF',
    }).setOrigin(0.5).setDepth(29));

    this._toyPickerGroup.add(makeButton(this, panelX + panelW - 24, panelY + 22, 36, 28, '✕', 0x4A1270, () => {
      this._closeToyPicker();
    }, 13).setDepth(29));

    if (monsters.length === 0) {
      this._toyPickerGroup.add(this.add.text(W / 2, panelY + panelH / 2 + 10,
        'No ' + this._toyHabitat + ' monsters yet!', {
        fontFamily: FONT, fontSize: '15px', color: '#7766AA',
      }).setOrigin(0.5).setDepth(29));
      return;
    }

    monsters.forEach((mon, idx) => {
      const sp = SPECIES[mon.speciesId];
      const ry = panelY + 56 + idx * rowH;
      const currentToy = TOY_TYPES.find(t => t.id === mon.ownedToy);
      const currentTier = currentToy?.tier ?? 0;

      const rowBg = this.add.graphics().setDepth(29);
      rowBg.fillStyle(0x1E0A4A, 0.80);
      rowBg.fillRoundedRect(panelX + 10, ry, panelW - 20, rowH - 6, 10);
      this._toyPickerGroup!.add(rowBg);

      const displayName = (sp?.name ?? 'Monster') + (mon.nickname ? ' "' + mon.nickname + '"' : '') + '  Lv.' + mon.level;
      this._toyPickerGroup!.add(this.add.text(panelX + 22, ry + 14, displayName, {
        fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#FFFFFF',
      }).setDepth(29));

      const curLabel = currentToy
        ? ('Has: ' + (toyEmojis[mon.ownedToy!] ?? '') + ' ' + currentToy.name)
        : 'No toy yet';
      this._toyPickerGroup!.add(this.add.text(panelX + 22, ry + 34, curLabel, {
        fontFamily: FONT, fontSize: '12px', color: '#9988BB',
      }).setDepth(29));

      const btnX = panelX + panelW - 80;
      const btnY = ry + rowH / 2 - 6;
      if (toyTier === currentTier) {
        const badge = this.add.graphics().setDepth(29);
        badge.fillStyle(0x2A2A2A, 0.70);
        badge.fillRoundedRect(btnX - 56, btnY - 13, 112, 26, 8);
        this._toyPickerGroup!.add(badge);
        this._toyPickerGroup!.add(this.add.text(btnX, btnY, '✓ Same tier', {
          fontFamily: FONT, fontSize: '12px', color: '#667766',
        }).setOrigin(0.5).setDepth(29));
      } else {
        const isUpgrade = toyTier > currentTier;
        const btnLabel = (isUpgrade ? '▲ ' : '▼ ') + toyCost + '💰';
        const btnCol = isUpgrade ? 0x1A5A18 : 0x5A2A12;
        this._toyPickerGroup!.add(makeButton(this, btnX, btnY, 112, 26, btnLabel, btnCol, () => {
          this._handleBuyToy(mon, toyId, toyName, toyCost);
        }, 12).setDepth(29));
      }
    });
  }

  private _closeToyPicker() {
    if (this._toyPickerGroup) {
      this._toyPickerGroup.clear(true, true);
      this._toyPickerGroup = null;
    }
  }

  private _handleBuyToy(mon: Monster, toyId: string, toyName: string, toyCost: number) {
    const state = Game.state!;
    if (state.coins < toyCost) {
      showToast(this, t('toast.needCoins', { n: toyCost }), '#ffaaaa');
      return;
    }
    state.coins -= toyCost;
    mon.ownedToy = toyId;
    store.setJSON('mps_state', state);
    this._coinTxt.setText(String(state.coins));
    sfx.buy();
    const spName = SPECIES[mon.speciesId]?.name ?? 'monster';
    showToast(this, toyName + ' given to ' + spName + '!', '#aaffaa');
    this._closeToyPicker();
    this._buildGrid(this.scale.width, this.scale.height);
  }
}
