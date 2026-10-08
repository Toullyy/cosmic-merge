import Phaser from 'phaser';
import { Game, FONT, store, sfx } from '../utils';
import { SPECIES, HABITATS, TANK_COST, TANK_CAPACITY, MAX_TANKS, getLevelName } from '../data';
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

  constructor() { super({ key: 'Hub' }); }

  create() {
    sfx.unlock();
    const W = this.scale.width, H = this.scale.height;
    this._displayGroup = this.add.group();

    this._buildBackground(W, H);
    this._buildTwinkleStars(W, H);
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
    bg.fillGradientStyle(0x1a0a2e, 0x1a0a2e, 0x0a0420, 0x0a0420, 1);
    bg.fillRect(0, 0, W, H);
  }

  private _buildTwinkleStars(W: number, H: number) {
    const positions = [
      [42,140],[95,310],[140,520],[188,88],[220,680],
      [270,200],[310,450],[355,130],[400,580],[448,260],
      [490,380],[520,100],[55,720],[135,800],[310,750],[460,810],
    ];
    positions.forEach((s, i) => {
      const star = this.add.graphics().setDepth(0);
      star.fillStyle(0xffffff, 0.88);
      star.fillCircle(s[0], s[1], i % 3 === 0 ? 2 : 1.2);
      this.tweens.add({
        targets: star,
        alpha: 0.05 + Math.random() * 0.18,
        duration: 700 + Math.random() * 1400,
        yoyo: true, repeat: -1,
        delay: i * 90 + Math.random() * 400,
        ease: 'Sine.InOut',
      });
    });
  }

  private _buildVignette(W: number, H: number) {
    const v = this.add.graphics().setDepth(2);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.50, 0.50, 0, 0);
    v.fillRect(0, 0, W, H * 0.26);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.38, 0.38);
    v.fillRect(0, H * 0.74, W, H * 0.26);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.32, 0, 0, 0.32);
    v.fillRect(0, 0, W * 0.22, H);
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.32, 0.32, 0);
    v.fillRect(W * 0.78, 0, W * 0.22, H);
  }

  private _buildHabitatBg(W: number, H: number) {
    const g = this._bgGraphics;
    g.clear();
    const hCfg = HABITATS[this._currentHabitat];
    g.fillStyle(hCfg.wallColor, 0.08);
    g.fillRoundedRect(6, 128, W - 12, H - 230, 18);
    g.fillStyle(hCfg.bgColor, 0.5);
    g.fillRoundedRect(10, 132, W - 20, H - 238, 14);
    g.lineStyle(2, hCfg.wallColor, 0.65);
    g.strokeRoundedRect(10, 132, W - 20, H - 238, 14);
  }

  private _buildHUD(W: number) {
    const coinBg = this.add.graphics().setDepth(10);
    coinBg.fillStyle(0x000000, 0.93);
    coinBg.fillRoundedRect(8, 8, 196, 52, 14);
    coinBg.lineStyle(2, 0xFFD700, 0.7);
    coinBg.strokeRoundedRect(8, 8, 196, 52, 14);
    coinBg.lineStyle(4, 0xFFD700, 0.10);
    coinBg.strokeRoundedRect(5, 5, 202, 58, 17);

    this.add.text(30, 34, '⬡', {
      fontFamily: FONT, fontSize: '26px', color: '#FFD700',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(11);

    this._coinTxt = this.add.text(56, 34, String(Game.state!.coins), {
      fontFamily: FONT, fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0, 0.5).setDepth(11);

    const sndTxt = this.add.text(W - 50, 34, sfx.muted ? '🔇' : '🔊', {
      fontFamily: FONT, fontSize: '22px', color: '#cccccc',
    }).setOrigin(0.5, 0.5).setDepth(11).setInteractive({ useHandCursor: true });
    sndTxt.on('pointerdown', () => { sfx.toggle(); sndTxt.setText(sfx.muted ? '🔇' : '🔊'); });

    this.add.text(W - 16, 34, '?', {
      fontFamily: FONT, fontSize: '22px', color: '#9060e0', fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(11).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { this.scene.launch('HowToPlay'); });
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
      this._drawTab(tabBg, x, 76, tabW, 50, isActive, unlocked);
      const lbl = unlocked ? labels[type] : (labels[type] + ' 🔒');
      const tabTxt = this.add.text(x + tabW/2, 101, lbl, {
        fontFamily: FONT, fontSize: '15px',
        color: isActive ? '#ffffff' : (unlocked ? '#aaaaaa' : '#555555'),
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

  private _drawTab(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, active: boolean, unlocked: boolean) {
    g.clear();
    g.fillStyle(active ? 0x4a2080 : (unlocked ? 0x1e1040 : 0x110825), active ? 1 : 0.7);
    g.fillRoundedRect(x + 2, y, w - 4, h, { tl: 10, tr: 10, bl: 0, br: 0 });
    if (active) {
      g.lineStyle(2, 0x9060ff, 1);
      g.strokeRoundedRect(x + 2, y, w - 4, h, { tl: 10, tr: 10, bl: 0, br: 0 });
    }
  }

  private _updateTabs() {
    const types: HabitatType[] = ['dirt', 'grass', 'aquatic'];
    const labels: Record<string, string> = { dirt:'⛰ Dirt', grass:'🌿 Grass', aquatic:'🌊 Aqua' };
    const W = this.scale.width, tabW = (W - 20) / 3;
    types.forEach((type, i) => {
      const x = 10 + tabW * i;
      const btn = this._tabBtns[type];
      const isActive = type === this._currentHabitat;
      const unlocked = Game.state!.habitats[type].unlocked;
      this._drawTab(btn.bg, x, 76, tabW, 50, isActive, unlocked);
      btn.txt.setStyle({ color: isActive ? '#ffffff' : (unlocked ? '#aaaaaa' : '#555555') });
      btn.txt.setText(unlocked ? labels[type] : (labels[type] + ' 🔒'));
    });
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
    const CW = 234, CH = 196;
    const shadow = this.add.graphics().setDepth(19);
    shadow.fillStyle(0x000000, 0.15);
    shadow.fillRoundedRect(cx - CW/2 + 4, cy - CH/2 + 6, CW, CH, 16);
    this._displayGroup.add(shadow);

    const frame = this.add.graphics().setDepth(20);
    frame.fillStyle(0x0a0820, 0.75);
    frame.fillRoundedRect(cx - CW/2, cy - CH/2, CW, CH, 16);
    frame.lineStyle(2, 0x5040b0, 0.55);
    frame.strokeRoundedRect(cx - CW/2, cy - CH/2, CW, CH, 16);
    this._displayGroup.add(frame);

    this._displayGroup.add(this.add.text(cx, cy - 34, '+', {
      fontFamily: FONT, fontSize: '44px', color: '#5040b0', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(22));
    this._displayGroup.add(this.add.text(cx, cy + 14, 'Buy Tank', {
      fontFamily: FONT, fontSize: '16px', fontStyle: 'bold', color: '#9080cc',
    }).setOrigin(0.5).setDepth(22));
    this._displayGroup.add(this.add.text(cx, cy + 40, TANK_COST + ' ⬡', {
      fontFamily: FONT, fontSize: '14px', color: '#FFD700',
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
    const CW = 234, CH = 196, innerH = CH - 50;
    const sp = SPECIES[mon.speciesId];
    const hCfg = HABITATS[sp.habitat];
    const mods = getVariantModifiers(mon.variantIndex);

    const shadow = this.add.graphics().setDepth(19);
    shadow.fillStyle(0x000000, 0.22);
    shadow.fillRoundedRect(cx - CW/2 + 4, cy - CH/2 + 6, CW, CH, 16);
    this._displayGroup.add(shadow);

    const frame = this.add.graphics().setDepth(20);
    frame.fillStyle(darken(hCfg.wallColor, 30), 0.55);
    frame.fillRoundedRect(cx - CW/2, cy - CH/2, CW, CH, 16);
    frame.lineStyle(2, hCfg.wallColor, 0.85);
    frame.strokeRoundedRect(cx - CW/2, cy - CH/2, CW, CH, 16);
    this._displayGroup.add(frame);

    const inX = cx - CW/2 + 7, inY = cy - CH/2 + 7, inW = CW - 14;
    const innerBg = this.add.graphics().setDepth(21);
    innerBg.fillStyle(hCfg.bgColor, 0.65);
    innerBg.fillRoundedRect(inX, inY, inW, innerH, 11);
    this._displayGroup.add(innerBg);

    const glass = this.add.graphics().setDepth(24);
    glass.fillStyle(0xffffff, 0.09);
    glass.fillRoundedRect(inX, inY, inW / 2.6, innerH / 2.8, 9);
    glass.lineStyle(1, 0xffffff, 0.14);
    glass.strokeRoundedRect(inX, inY, inW / 2.6, innerH / 2.8, 9);
    this._displayGroup.add(glass);

    const innerCY = inY + innerH / 2;
    const texKey = makeMonsterTexture(this, mon);
    const img = this.add.image(cx, innerCY + 3, texKey).setDisplaySize(86, 86).setDepth(22);
    this._displayGroup.add(img);
    const tween = this.tweens.add({
      targets: img, y: img.y - 5,
      duration: 1100 + Math.random() * 400, ease: 'Sine.InOut', yoyo: true, repeat: -1,
    });
    this._bobTweens.push(tween);

    const lvlLabel = getLevelName(mon.level);
    const lvlBadge = this.add.graphics().setDepth(23);
    lvlBadge.fillStyle(0x000000, 0.78);
    lvlBadge.fillRoundedRect(cx - CW/2 + 7, inY + 4, lvlLabel.length * 7 + 16, 20, 8);
    this._displayGroup.add(lvlBadge);
    this._displayGroup.add(this.add.text(cx - CW/2 + 15, inY + 14, lvlLabel, {
      fontFamily: FONT, fontSize: '11px', color: '#ffdd55', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(24));

    if (mods.isGolden) {
      this._displayGroup.add(this.add.text(cx + CW/2 - 10, inY + 6, '★', {
        fontFamily: FONT, fontSize: '14px', color: '#FFD700',
      }).setOrigin(1, 0).setDepth(24));
    }

    const btmY = cy + CH/2 - 40;
    const displayName = mon.nickname ?? sp.name;
    this._displayGroup.add(this.add.text(cx, btmY + 8, displayName, {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(22));

    const pct = Math.max(0, Math.min(1, mon.happiness / 100));
    const barColor = mon.happiness > 66 ? 0x44cc88 : mon.happiness > 33 ? 0xffcc44 : 0xff5555;
    const barW = CW - 32;
    const barBg = this.add.graphics().setDepth(22);
    barBg.fillStyle(0x00000055, 1);
    barBg.fillRoundedRect(cx - barW/2, btmY + 25, barW, 8, 4);
    const barFill = this.add.graphics().setDepth(23);
    barFill.fillStyle(barColor, 1);
    barFill.fillRoundedRect(cx - barW/2, btmY + 25, Math.max(8, barW * pct), 8, 4);
    this._displayGroup.add(barBg);
    this._displayGroup.add(barFill);

    // listing banner
    const listing = Game.state!.listings.find(l => l.monsterId === mon.id);
    if (listing) {
      const ready = Date.now() >= listing.readyAt;
      const banner = this.add.graphics().setDepth(25);
      banner.fillStyle(ready ? 0x1A7040 : 0x884400, 0.92);
      banner.fillRoundedRect(cx - CW/2 + 8, cy - CH/2 + 8, CW - 16, 22, 6);
      this._displayGroup.add(banner);
      this._displayGroup.add(this.add.text(cx, cy - CH/2 + 19,
        ready ? 'READY - Tap to collect' : 'For Sale', {
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
    const CW = 234, CH = 196, innerH = CH - 50;
    const sp = SPECIES[egg.speciesId];
    const hCfg = HABITATS[sp.habitat];
    const mods = getVariantModifiers(egg.variantIndex);
    const now = Date.now();
    const isReady = now >= egg.hatchEndAt;
    const eggColor = shiftHue(sp.baseColor, mods.hueShift);

    const shadow = this.add.graphics().setDepth(19);
    shadow.fillStyle(0x000000, 0.22);
    shadow.fillRoundedRect(cx - CW/2 + 4, cy - CH/2 + 6, CW, CH, 16);
    this._displayGroup.add(shadow);

    const frameColor = isReady ? 0x88ff88 : hCfg.wallColor;
    const frame = this.add.graphics().setDepth(20);
    frame.fillStyle(darken(frameColor, 30), 0.5);
    frame.fillRoundedRect(cx - CW/2, cy - CH/2, CW, CH, 16);
    frame.lineStyle(isReady ? 3 : 2, frameColor, isReady ? 1 : 0.75);
    frame.strokeRoundedRect(cx - CW/2, cy - CH/2, CW, CH, 16);
    this._displayGroup.add(frame);

    const inX = cx - CW/2 + 7, inY = cy - CH/2 + 7, inW = CW - 14;
    const innerBg = this.add.graphics().setDepth(21);
    innerBg.fillStyle(hCfg.bgColor, 0.55);
    innerBg.fillRoundedRect(inX, inY, inW, innerH, 11);
    this._displayGroup.add(innerBg);

    const glass = this.add.graphics().setDepth(24);
    glass.fillStyle(0xffffff, 0.08);
    glass.fillRoundedRect(inX, inY, inW / 2.6, innerH / 2.8, 9);
    this._displayGroup.add(glass);

    const innerCY = inY + innerH / 2;
    const eggG = this.add.graphics().setDepth(22);
    eggG.fillStyle(darken(eggColor, 18), 1); eggG.fillEllipse(cx + 2, innerCY + 4, 50, 62);
    eggG.fillStyle(eggColor, 1);             eggG.fillEllipse(cx, innerCY, 50, 62);
    eggG.fillStyle(lighten(eggColor, 40), 0.4); eggG.fillEllipse(cx - 8, innerCY - 14, 16, 24);
    if (isReady) {
      eggG.lineStyle(2, darken(eggColor, 80), 1);
      eggG.beginPath(); eggG.moveTo(cx - 4, innerCY - 20); eggG.lineTo(cx + 5, innerCY - 5);
      eggG.lineTo(cx - 2, innerCY + 7); eggG.strokePath();
      eggG.beginPath(); eggG.moveTo(cx + 6, innerCY - 16); eggG.lineTo(cx - 2, innerCY - 8); eggG.strokePath();
    }
    this._displayGroup.add(eggG);
    const bobTween = this.tweens.add({
      targets: eggG, y: isReady ? -4 : -3,
      duration: isReady ? 550 : 1400, ease: 'Sine.InOut', yoyo: true, repeat: -1,
    });
    this._bobTweens.push(bobTween);

    const btmY = cy + CH/2 - 40;
    this._displayGroup.add(this.add.text(cx, btmY + 6, sp.name, {
      fontFamily: FONT, fontSize: '14px', fontStyle: 'bold',
      color: isReady ? '#aaffaa' : '#ccccdd',
    }).setOrigin(0.5).setDepth(22));

    const remaining = Math.max(0, egg.hatchEndAt - now);
    const timerTxt = this.add.text(cx, btmY + 24,
      isReady ? '✨ Tap to hatch!' : this._formatMs(remaining), {
      fontFamily: FONT, fontSize: '12px',
      color: isReady ? '#aaffaa' : '#9999cc', align: 'center',
    }).setOrigin(0.5).setDepth(22);
    (timerTxt as any)._eggId = egg.id;
    this._displayGroup.add(timerTxt);

    const zone = this.add.zone(cx, cy, CW, CH).setInteractive().setDepth(25);
    zone.on('pointerdown', () => {
      const refreshedEgg = Game.state!.eggs.find(e => e.id === egg.id);
      if (!refreshedEgg) return;
      if (Date.now() >= refreshedEgg.hatchEndAt) {
        const cap = (Game.state!.tanks?.[egg.habitatType] ?? 1) * TANK_CAPACITY;
        const monCount = Game.state!.monsters.filter(m => m.habitatType === egg.habitatType).length;
        if (monCount >= cap) {
          showToast(this, 'Habitat full! Buy more tanks to hatch.', '#ff9999');
          return;
        }
        this.scene.launch('HatchScene', { eggId: refreshedEgg.id });
      } else {
        // offer instant hatch via rewarded ad
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
      fontFamily: FONT, fontSize: '14px', color: '#9999cc',
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
      (child as Phaser.GameObjects.Text).setStyle({ color: remaining <= 0 ? '#aaffaa' : '#9999cc' });
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
