import Phaser from 'phaser';
import { Game, FONT, store, sfx } from '../utils';
import { CATALOG, HABITATS, newEgg, SPECIES, generateMerchantStock, MERCHANT_REFRESH_MS, TANK_CAPACITY, DECORATIONS } from '../data';
import { shiftHue } from '../MonsterRenderer';
import { makeButton } from '../ui/Button';
import { showToast } from '../ui/Toast';

export class Merchant extends Phaser.Scene {
  private _filter: string = 'dirt';
  private _filterGroup!: Phaser.GameObjects.Group;
  private _gridGroup!: Phaser.GameObjects.Group;
  private _coinTxt!: Phaser.GameObjects.Text;
  private _refreshTxt!: Phaser.GameObjects.Text;
  private _refreshTimer: Phaser.Time.TimerEvent | null = null;

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
      fontFamily: FONT, fontSize: '11px', color: '#9988BB', align: 'center',
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

    // Deep indigo sky gradient
    bg.fillGradientStyle(0x08041A, 0x08041A, 0x160838, 0x160838, 1);
    bg.fillRect(0, 0, W, H * 0.55);
    bg.fillGradientStyle(0x160838, 0x160838, 0x1C0A44, 0x1C0A44, 1);
    bg.fillRect(0, H * 0.55, W, H * 0.45);

    // Star field
    for (let i = 0; i < 56; i++) {
      const sx = Math.random() * W, sy = Math.random() * H * 0.88;
      bg.fillStyle(0xFFFFFF, 0.25 + Math.random() * 0.55);
      bg.fillCircle(sx, sy, 0.7 + Math.random() * 1.2);
    }

    // Header band (darker for sign area)
    bg.fillGradientStyle(0x200858, 0x200858, 0x140430, 0x140430, 1);
    bg.fillRect(0, 0, W, 130);

    // Left corner: small potions on a shelf
    bg.fillStyle(0x280A58, 1);
    bg.fillRect(0, H * 0.48, 36, H * 0.16);
    bg.lineStyle(1.5, 0x3A1070, 1);
    bg.strokeRect(0, H * 0.48, 36, 1);
    bg.strokeRect(0, H * 0.64, 36, 1);
    ([
      [14, H * 0.52, 0xFF4488, 0xFF88BB],
      [24, H * 0.56, 0x44AAFF, 0x88CCFF],
      [10, H * 0.60, 0xFFCC00, 0xFFEE88],
    ] as [number, number, number, number][]).forEach(([px, py, col, sheen]) => {
      bg.fillStyle(col, 0.85);
      bg.fillRect(px - 4, py - 10, 8, 13);
      bg.fillEllipse(px, py - 10, 10, 8);
      bg.fillStyle(0x000000, 0.25);
      bg.fillRect(px - 2, py - 12, 4, 5);
      bg.fillStyle(sheen, 0.45);
      bg.fillRect(px - 2, py - 9, 3, 8);
    });

    // Right corner: crystal cluster
    bg.fillStyle(0x280A58, 1);
    bg.fillRect(W - 36, H * 0.48, 36, H * 0.16);
    bg.lineStyle(1.5, 0x3A1070, 1);
    bg.strokeRect(W - 36, H * 0.48, 36, 1);
    bg.strokeRect(W - 36, H * 0.64, 36, 1);
    ([
      [W - 22, H * 0.52, 0xCC44FF, 16],
      [W - 12, H * 0.55, 0x88AAFF, 13],
      [W - 28, H * 0.60, 0xFF66CC, 12],
    ] as [number, number, number, number][]).forEach(([cx, cy, cc, ch]) => {
      bg.fillStyle(cc, 0.88);
      bg.fillTriangle(cx - 4, cy, cx + 4, cy, cx, cy - ch);
      bg.fillTriangle(cx - 7, cy, cx - 1, cy, cx - 4, cy - ch * 0.72);
      bg.fillTriangle(cx + 1, cy, cx + 7, cy, cx + 4, cy - ch * 0.72);
      bg.fillStyle(0xFFFFFF, 0.35);
      bg.fillTriangle(cx - 1, cy - 2, cx + 1, cy - 2, cx, cy - ch * 0.78);
    });

    // Floor gradient hint
    bg.fillGradientStyle(0x0A0220, 0x0A0220, 0x18064A, 0x18064A, 1);
    bg.fillRect(0, H * 0.92, W, H * 0.08);

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

    this.add.text(W / 2, 81, '✶ Monster Egg Shop ✶', {
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
    this._coinTxt = this.add.text(50, 28, String(Game.state!.coins), {
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
    makeButton(this, W - 62, 28, 100, 40, '← Back', 0x341278, () => {
      this.scene.start('Hub');
    }, 14).setDepth(5);
  }

  // ── AMBIENT ────────────────────────────────────────────────────────────────

  private _startAmbient(W: number, H: number) {
    // Glowing orbs at corners/sides
    ([
      [W * 0.06, H * 0.28, 0x7722FF, 44],
      [W * 0.92, H * 0.22, 0x2266FF, 40],
      [W * 0.04, H * 0.68, 0xFF3388, 36],
      [W * 0.94, H * 0.72, 0x22DDFF, 36],
      [W * 0.50, H * 0.90, 0xAA33FF, 28],
    ] as [number, number, number, number][]).forEach(([ox, oy, oc, or]) => {
      const og = this.add.graphics().setDepth(1);
      og.fillStyle(oc, 0.09);
      og.fillCircle(ox, oy, or);
      og.fillStyle(oc, 0.15);
      og.fillCircle(ox, oy, or * 0.5);
      this.tweens.add({
        targets: og, alpha: { from: 0.6, to: 0.2 },
        duration: 1800 + Math.random() * 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut',
      });
    });

    // Floating magic sparkles
    const sparkleColors = [0xFFCC44, 0xCC66FF, 0x66DDFF, 0xFF88CC, 0xAAFF88];
    const spawnSparkle = () => {
      if (!this.scene?.isActive('Merchant')) return;
      const sx = 26 + Math.random() * (W - 52);
      const sy = 148 + Math.random() * (H - 200);
      const sc = sparkleColors[Math.floor(Math.random() * sparkleColors.length)];
      const sg = this.add.graphics().setDepth(2);
      sg.fillStyle(sc, 0.88);
      sg.fillCircle(0, 0, 1.5 + Math.random() * 2);
      sg.setPosition(sx, sy);
      this.tweens.add({
        targets: sg,
        y: sy - 36 - Math.random() * 36,
        alpha: 0, scaleX: 0.2, scaleY: 0.2,
        duration: 850 + Math.random() * 650, ease: 'Sine.Out',
        onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
      });
    };
    this.time.addEvent({ delay: 380, loop: true, callback: spawnSparkle });
  }

  // ── FILTER TABS ────────────────────────────────────────────────────────────

  private _refreshLabel(): string {
    const remaining = Math.max(0, Game.state!.merchantRefreshAt - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return 'Restocks in ' + mins + ':' + String(secs).padStart(2, '0');
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
          this._refreshTxt.setText('Fresh stock!');
        } else {
          this._refreshTxt.setText(this._refreshLabel());
        }
      },
    });
  }

  private _buildFilterTabs(W: number) {
    const filters = ['dirt', 'grass', 'aquatic', 'decor'];
    const labels: Record<string, string> = {
      dirt: '⛰ Dirt', grass: '🌿 Grass',
      aquatic: '🌊 Aqua', decor: '🎨 Decor',
    };
    const tabW = (W - 20) / 4;
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
    const filters = ['dirt', 'grass', 'aquatic', 'decor'];
    const tabW = (W - 20) / 4;
    const activeCol: Record<string, number> = { dirt: 0x7A3808, grass: 0x286020, aquatic: 0x0E5A90, decor: 0x702808 };
    const glowCol: Record<string, number>   = { dirt: 0xFFAA44, grass: 0x66DD33, aquatic: 0x44CCFF, decor: 0xFFAA22 };

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
    this._gridGroup.clear(true, true);

    if (this._filter === 'decor') {
      this._buildDecorGrid(W, H);
      return;
    }

    const stockIds = Game.state!.merchantStock ?? [];
    const filtered = stockIds.map(id => SPECIES[id]).filter(sp => sp && sp.habitat === this._filter);

    if (filtered.length === 0) {
      this._gridGroup.add(this.add.text(W / 2, 440, 'No ' + this._filter + ' species\nin stock. Check back soon!', {
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
      const card = this.add.graphics();
      card.fillStyle(0x000000, 0.38);
      card.fillRoundedRect(cx - cardW / 2 + 4, cy - cardH / 2 + 4, cardW, cardH, 16);
      // Card body
      card.fillGradientStyle(cDark, cDark, cLight, cLight, 1);
      card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 16);
      // Border
      card.lineStyle(2, borderCol, unlocked ? 0.78 : 0.22);
      card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 16);
      // Sheen on top half
      card.fillStyle(0xFFFFFF, 0.04);
      card.fillRoundedRect(cx - cardW / 2 + 4, cy - cardH / 2 + 4, cardW - 8, cardH * 0.48,
        { tl: 12, tr: 12, bl: 0, br: 0 });
      this._gridGroup.add(card);

      // Egg with glow
      const eggG = this.add.graphics();
      const eggColor = shiftHue(sp.baseColor, ((sp.id * 13) % 12 - 6) * 15);
      if (unlocked) {
        eggG.fillStyle(eggColor, 0.10); eggG.fillEllipse(cx, cy - 46, 84, 96);
        eggG.fillStyle(eggColor, 0.18); eggG.fillEllipse(cx, cy - 46, 66, 76);
        eggG.fillStyle(eggColor, 1);    eggG.fillEllipse(cx, cy - 46, 50, 64);
        eggG.fillStyle(0xFFFFFF, 0.28); eggG.fillEllipse(cx - 9, cy - 58, 16, 22);
        eggG.fillStyle(0xFFFFFF, 0.55); eggG.fillEllipse(cx - 10, cy - 60, 9, 11);
        if (sp.hatchHours >= 10) {
          eggG.fillStyle(0xFFD700, 0.92); eggG.fillCircle(cx + 16, cy - 58, 5);
          eggG.fillStyle(0xFFFFFF, 0.78); eggG.fillCircle(cx + 14, cy - 60, 2);
        }
      } else {
        eggG.fillStyle(sp.baseColor, 0.16); eggG.fillEllipse(cx, cy - 46, 66, 76);
        eggG.fillStyle(sp.baseColor, 0.28); eggG.fillEllipse(cx, cy - 46, 50, 64);
        eggG.lineStyle(1.5, sp.baseColor, 0.44); eggG.strokeEllipse(cx, cy - 46, 50, 64);
        eggG.fillStyle(0xFFFFFF, 0.07); eggG.fillEllipse(cx - 9, cy - 58, 16, 22);
      }
      this._gridGroup.add(eggG);

      // Name
      this._gridGroup.add(this.add.text(cx, cy - 6, unlocked ? sp.name : '???', {
        fontFamily: FONT, fontSize: '16px', fontStyle: 'bold',
        color: unlocked ? '#FFFFFF' : '#665588',
      }).setOrigin(0.5));

      // Stats row
      const statRow = unlocked ? ('⏱ ' + sp.hatchHours + 'h  ·  💰 ' + sp.price) : '🔒 Locked';
      this._gridGroup.add(this.add.text(cx, cy + 15, statRow, {
        fontFamily: FONT, fontSize: '12px', color: unlocked ? '#CCBBEE' : '#443366',
      }).setOrigin(0.5));

      // Tier dots
      const dots = Math.min(5, Math.max(1, Math.ceil(sp.hatchHours / 5)));
      for (let d = 0; d < 5; d++) {
        const dg = this.add.graphics();
        dg.fillStyle(d < dots ? (unlocked ? 0xFFCC44 : 0x443366) : 0x1A0A3A, 1);
        dg.fillCircle(cx - 16 + d * 8, cy + 34, 3.5);
        this._gridGroup.add(dg);
      }

      // Buy / Unlock button
      const btnLabel = unlocked
        ? ('Buy  ' + sp.price + '💰')
        : (HABITATS[sp.habitat].unlockCost + '💰 Unlock');
      const btnCol = unlocked ? 0x1E6828 : 0x480E78;
      const btn = makeButton(this, cx, cy + 62, unlocked ? 148 : 195, 38, btnLabel, btnCol, () => {
        this._handleBuy(sp.id, unlocked);
      }, 13);
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
      this._gridGroup.add(this.add.text(W / 2, 440, 'Unlock habitats to\nbuy decorations!', {
        fontFamily: FONT, fontSize: '16px', color: '#7766AA', align: 'center',
      }).setOrigin(0.5));
      return;
    }

    visible.forEach((dec, idx) => {
      const col = idx % cols, row = Math.floor(idx / cols);
      const cx = gapX + cardW / 2 + col * (cardW + gapX);
      const cy = startY + 14 + row * (cardH + 14) + cardH / 2;
      const isOwned = ownedAll.includes(dec.id);

      const card = this.add.graphics();
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
      }).setDepth(1));
      this._gridGroup.add(this.add.text(cx + cardW / 2 - 12, cy - cardH / 2 + 15, tierStars, {
        fontFamily: FONT, fontSize: '12px', color: isOwned ? '#88EE88' : '#CCBB88',
      }).setOrigin(1, 0.5));
      this._gridGroup.add(this.add.text(cx, cy - 22, dec.name, {
        fontFamily: FONT, fontSize: '15px', fontStyle: 'bold',
        color: isOwned ? '#AAFFAA' : '#FFFFFF',
      }).setOrigin(0.5));
      this._gridGroup.add(this.add.text(cx, cy - 2, dec.desc, {
        fontFamily: FONT, fontSize: '12px', color: '#CCBBEE',
        wordWrap: { width: cardW - 24 }, align: 'center',
      }).setOrigin(0.5));

      if (isOwned) {
        const oBadge = this.add.graphics();
        oBadge.fillStyle(0x44AA44, 0.20);
        oBadge.fillRoundedRect(cx - 44, cy + 24, 88, 28, 14);
        oBadge.lineStyle(1.5, 0x66CC66, 0.80);
        oBadge.strokeRoundedRect(cx - 44, cy + 24, 88, 28, 14);
        this._gridGroup.add(oBadge);
        this._gridGroup.add(this.add.text(cx, cy + 38, '✓ Installed', {
          fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#66CC66',
        }).setOrigin(0.5));
      } else {
        const btn = makeButton(this, cx, cy + 40, 158, 36, 'Buy  ' + dec.cost + '💰', 0x461070, () => {
          this._handleBuyDecor(dec.id);
        }, 13);
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
      showToast(this, 'Unlock ' + HABITATS[dec.habitat].label + ' first!', '#ffaaaa');
      return;
    }
    if (state.habitats[dec.habitat].decorations.includes(decId)) {
      showToast(this, 'Already installed!', '#ffaaaa');
      return;
    }
    if (state.coins < dec.cost) {
      showToast(this, 'Need ' + dec.cost + '💰', '#ffaaaa');
      return;
    }
    state.coins -= dec.cost;
    state.habitats[dec.habitat].decorations.push(decId);
    store.setJSON('mps_state', state);
    this._coinTxt.setText(String(state.coins));
    sfx.buy();
    showToast(this, dec.name + ' installed!', '#aaffaa');
    this._buildGrid(this.scale.width, this.scale.height);
  }

  private _handleBuy(spId: number, unlocked: boolean) {
    const sp = SPECIES[spId];
    const state = Game.state!;
    if (!unlocked) {
      const cost = HABITATS[sp.habitat].unlockCost;
      if (state.coins < cost) {
        showToast(this, 'Need ' + cost + '💰 to unlock ' + HABITATS[sp.habitat].label, '#ff9999');
        return;
      }
      state.coins -= cost;
      state.habitats[sp.habitat].unlocked = true;
      if (!state.tanks) state.tanks = { dirt: 0, grass: 0, aquatic: 0 };
      state.tanks[sp.habitat] = 4;
      store.setJSON('mps_state', state);
      this._coinTxt.setText(String(state.coins));
      sfx.buy();
      showToast(this, HABITATS[sp.habitat].label + ' unlocked!', '#aaffaa');
      this._buildGrid(this.scale.width, this.scale.height);
      return;
    }
    if (state.coins < sp.price) {
      showToast(this, 'Not enough coins! Need ' + sp.price + '💰', '#ff9999');
      return;
    }
    const tankCount = state.tanks?.[sp.habitat] ?? 0;
    if (tankCount === 0) {
      showToast(this, 'Buy a tank in Hub first!', '#ffaaaa');
      return;
    }
    const cap = tankCount * TANK_CAPACITY;
    const usage = state.monsters.filter(m => m.habitatType === sp.habitat).length
                + state.eggs.filter(e => e.habitatType === sp.habitat).length;
    if (usage >= cap) {
      showToast(this, 'Habitat full! Buy more tanks in the Hub.', '#ffaaaa');
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
    showToast(this, sp.name + ' egg added! Hatch in ' + sp.hatchHours + 'h', '#aaffaa');
    this._buildGrid(this.scale.width, this.scale.height);
  }
}
