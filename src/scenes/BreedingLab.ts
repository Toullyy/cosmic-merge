import Phaser from 'phaser';
import { Game, FONT, store, sfx } from '../utils';
import { t } from '../i18n';
import { SPECIES, HABITATS, newEgg } from '../data';
import { makeMonsterTexture, lighten } from '../MonsterRenderer';
import { makeButton, setButtonLabel } from '../ui/Button';
import { showToast, showFloat } from '../ui/Toast';
import { Ads } from '../ads';
import type { Monster } from '../types';

interface Slot {
  x: number; y: number;
  graphics: Phaser.GameObjects.Graphics;
  img: Phaser.GameObjects.Image | null;
  labelTxt: Phaser.GameObjects.Text | null;
}

export class BreedingLab extends Phaser.Scene {
  private _selectedA: Monster | null = null;
  private _selectedB: Monster | null = null;
  private _slotA!: Slot;
  private _slotB!: Slot;
  private _listGroup!: Phaser.GameObjects.Group;
  private _breedBtn!: Phaser.GameObjects.Container;
  private _listPage: number = 0;

  constructor() { super({ key: 'BreedingLab' }); }

  create() {
    sfx.unlock();
    const W = this.scale.width, H = this.scale.height;

    // ── Magical Lab Background ─────────────────────────────────────────────
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x060318, 0x060318, 0x1A0848, 0x1A0848, 1);
    bg.fillRect(0, 0, W, H);

    // Star field
    for (let si = 0; si < 55; si++) {
      const sx = Math.random() * W, sy = Math.random() * H * 0.65;
      const sa = 0.3 + Math.random() * 0.7;
      bg.fillStyle(0xFFFFFF, sa); bg.fillCircle(sx, sy, 0.8 + Math.random() * 1.2);
    }

    // Central arcane circle glow (behind slots)
    const arcX = W / 2, arcY = 200;
    bg.fillStyle(0x8844FF, 0.04); bg.fillCircle(arcX, arcY, 200);
    bg.fillStyle(0x6622CC, 0.07); bg.fillCircle(arcX, arcY, 150);
    bg.fillStyle(0x4400AA, 0.10); bg.fillCircle(arcX, arcY, 100);

    // Arcane rune ring
    bg.lineStyle(1, 0xAA66FF, 0.25);
    bg.strokeCircle(arcX, arcY, 132);
    bg.lineStyle(1, 0x8844DD, 0.18);
    bg.strokeCircle(arcX, arcY, 148);
    for (let ri = 0; ri < 12; ri++) {
      const ra = (ri / 12) * Math.PI * 2;
      const r1 = 128, r2 = 140;
      bg.beginPath();
      bg.moveTo(arcX + Math.cos(ra) * r1, arcY + Math.sin(ra) * r1);
      bg.lineTo(arcX + Math.cos(ra) * r2, arcY + Math.sin(ra) * r2);
      bg.strokePath();
      bg.fillStyle(0xBB88FF, 0.45);
      bg.fillCircle(arcX + Math.cos(ra) * 140, arcY + Math.sin(ra) * 140, 2.5);
    }

    // Bottom lab floor glow
    bg.fillGradientStyle(0x220066, 0x220066, 0x0A0030, 0x0A0030, 1);
    bg.fillRect(0, H * 0.60, W, H * 0.40);
    bg.fillStyle(0x6622CC, 0.08); bg.fillEllipse(W / 2, H * 0.74, W * 1.2, 80);

    // ── Header ─────────────────────────────────────────────────────────────
    this.add.text(W/2, 46, t('breed.title'), {
      fontFamily: FONT, fontSize: '24px', color: '#EECCff', fontStyle: 'bold',
      stroke: '#220044', strokeThickness: 3,
    }).setOrigin(0.5);
    this.add.text(W/2, 76, t('breed.subtitle'), {
      fontFamily: FONT, fontSize: '15px', color: '#AA88DD',
    }).setOrigin(0.5);

    makeButton(this, W - 70, 30, 110, 40, t('btn.back'), 0x5828A0, () => {
      Ads.maybeInterstitial(() => { this.scene.start('Hub'); });
    }, 15);

    // ── Parent Slots ───────────────────────────────────────────────────────
    this._slotA = this._buildParentSlot(W/2 - 108, 190, t('breed.parentA'), 0xFFAA44);
    this._slotB = this._buildParentSlot(W/2 + 108, 190, t('breed.parentB'), 0x44AAFF);

    // Merge symbol between slots
    const midG = this.add.graphics();
    midG.fillStyle(0xCC88FF, 0.90);
    midG.fillCircle(W/2, 190, 16);
    midG.fillStyle(0x330066, 1);
    midG.fillCircle(W/2, 190, 11);
    midG.fillStyle(0xEEBBFF, 1);
    midG.fillRect(W/2 - 6, 186, 12, 8);   // horizontal bar
    midG.fillRect(W/2 - 1, 181, 2, 18);   // vertical bar
    // DNA connector lines (slot rim at ±56 from center, merge symbol at ±20)
    midG.lineStyle(1.5, 0x9955DD, 0.45);
    midG.beginPath(); midG.moveTo(W/2 - 56, 190); midG.lineTo(W/2 - 20, 190); midG.strokePath();
    midG.beginPath(); midG.moveTo(W/2 + 20, 190); midG.lineTo(W/2 + 56, 190); midG.strokePath();
    midG.lineStyle(1, 0xBB77FF, 0.28);
    for (let di = 0; di < 3; di++) {
      const dx = W/2 - 54 + di * 12;
      midG.beginPath(); midG.moveTo(dx, 183); midG.lineTo(dx + 9, 197); midG.strokePath();
    }
    for (let di = 0; di < 3; di++) {
      const dx = W/2 + 22 + di * 12;
      midG.beginPath(); midG.moveTo(dx, 183); midG.lineTo(dx + 9, 197); midG.strokePath();
    }

    // Pulse animation on merge symbol
    this.tweens.add({ targets: midG, scaleX: 1.15, scaleY: 1.15, duration: 900, ease: 'Sine.InOut', yoyo: true, repeat: -1 });

    // ── Monster List ───────────────────────────────────────────────────────
    this._listGroup = this.add.group();
    this._buildMonsterList(W, H);

    // ── Breed Button ───────────────────────────────────────────────────────
    this._breedBtn = makeButton(this, W/2, H - 60, 230, 56, t('btn.breed'), 0x8830CC, () => {
      this._doBreed();
    }, 18);
    this._breedBtn.setAlpha(0.38);

    // ── Ambient sparkles ───────────────────────────────────────────────────
    this._startAmbient(W, H);
  }

  private _startAmbient(W: number, H: number) {
    const spawnSparkle = () => {
      if (!this.scene?.isActive('BreedingLab')) return;
      const sx = 60 + Math.random() * (W - 120);
      const sy = 100 + Math.random() * (H * 0.55);
      const sc = [0xCC88FF, 0xFFBB44, 0x88EEFF, 0xFF88CC][Math.floor(Math.random() * 4)];
      const sg = this.add.graphics();
      sg.fillStyle(sc, 0.88); sg.fillCircle(0, 0, 1.5 + Math.random() * 2);
      sg.setPosition(sx, sy);
      this.tweens.add({
        targets: sg,
        x: sx + (Math.random() - 0.5) * 50,
        y: sy - 35 - Math.random() * 40,
        alpha: 0, scaleX: 0.1, scaleY: 0.1,
        duration: 900 + Math.random() * 900, ease: 'Quad.Out',
        onComplete: (_tw: any, tg: any) => { try { tg[0].destroy(); } catch { /* */ } },
      });
    };
    this.time.addEvent({ delay: 260, loop: true, callback: spawnSparkle });
    for (let i = 0; i < 8; i++) this.time.delayedCall(i * 200, spawnSparkle);
  }

  private _buildParentSlot(x: number, y: number, label: string, glowCol: number): Slot {
    const g = this.add.graphics();
    // Outer glow rings
    g.fillStyle(glowCol, 0.06); g.fillCircle(x, y, 75);
    g.fillStyle(glowCol, 0.10); g.fillCircle(x, y, 60);
    // Slot circle
    g.fillStyle(0x120630, 0.95); g.fillCircle(x, y, 52);
    g.lineStyle(2, glowCol, 0.80); g.strokeCircle(x, y, 52);
    g.lineStyle(1, glowCol, 0.30); g.strokeCircle(x, y, 60);
    // Rune marks on ring
    for (let ri = 0; ri < 6; ri++) {
      const ra = (ri / 6) * Math.PI * 2;
      g.fillStyle(glowCol, 0.55); g.fillCircle(x + Math.cos(ra) * 52, y + Math.sin(ra) * 52, 3);
    }
    // Inner shine
    g.fillStyle(0xFFFFFF, 0.04); g.fillEllipse(x, y - 18, 60, 30);
    this.add.text(x, y + 74, label, {
      fontFamily: FONT, fontSize: '13px', color: '#' + glowCol.toString(16).padStart(6, '0'),
    }).setOrigin(0.5);
    const labelTxt = this.add.text(x, y, '?', { fontFamily: FONT, fontSize: '28px', color: '#7766BB' }).setOrigin(0.5);
    return { x, y, graphics: g, img: null, labelTxt };
  }

  private _buildMonsterList(W: number, _H: number) {
    this._listGroup.clear(true, true);
    const eligible = Game.state!.monsters.filter(m => m.level >= 4);
    const scrollY = 312;
    const PAGE_SIZE = 6;
    const totalPages = Math.max(1, Math.ceil(eligible.length / PAGE_SIZE));
    if (this._listPage >= totalPages) this._listPage = totalPages - 1;

    if (eligible.length === 0) {
      this._listGroup.add(this.add.text(W/2, scrollY + 40,
        t('breed.noMonsters'), {
        fontFamily: FONT, fontSize: '16px', color: '#9988CC', align: 'center', lineSpacing: 8,
      }).setOrigin(0.5));
      return;
    }

    const habColors: Record<string, number> = { dirt: 0xFFAA44, grass: 0x55DD44, aquatic: 0x44CCFF };
    const pageItems = eligible.slice(this._listPage * PAGE_SIZE, (this._listPage + 1) * PAGE_SIZE);

    pageItems.forEach((mon, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const cx = W/2 - 140 + col * 140;
      const cy = scrollY + row * 148;
      const sp = SPECIES[mon.speciesId];

      const isA = this._selectedA?.id === mon.id;
      const isB = this._selectedB?.id === mon.id;
      const habCol = habColors[sp.habitat] ?? 0x8888FF;
      const selCol = isA ? 0xFF8844 : (isB ? 0x44AAFF : habCol);
      const selAlpha = isA || isB ? 1.0 : 0.35;

      const cardBg = this.add.graphics();
      cardBg.fillStyle(0x000000, 0.30); cardBg.fillRoundedRect(cx - 56, cy - 56, 116, 126, 14);
      cardBg.fillStyle(isA || isB ? 0x200A50 : 0x160840, 1);
      cardBg.fillRoundedRect(cx - 58, cy - 58, 116, 126, 14);
      cardBg.fillStyle(selCol, 0.12);
      cardBg.fillRoundedRect(cx - 58, cy - 58, 116, 28, { tl: 14, tr: 14, bl: 0, br: 0 });
      cardBg.lineStyle(2, selCol, selAlpha);
      cardBg.strokeRoundedRect(cx - 58, cy - 58, 116, 126, 14);
      if (isA || isB) {
        cardBg.lineStyle(4, selCol, 0.20);
        cardBg.strokeRoundedRect(cx - 62, cy - 62, 124, 134, 16);
      }
      this._listGroup.add(cardBg);

      const img = this.add.image(cx, cy - 8, makeMonsterTexture(this, mon)).setDisplaySize(80, 80);
      this._listGroup.add(img);
      this._listGroup.add(this.add.text(cx, cy + 44, sp.name, {
        fontFamily: FONT, fontSize: '13px', color: '#ddddee', align: 'center',
      }).setOrigin(0.5));
      this._listGroup.add(this.add.text(cx, cy + 62, t('breed.lv', { n: mon.level }), {
        fontFamily: FONT, fontSize: '12px', color: '#' + habCol.toString(16).padStart(6, '0'),
      }).setOrigin(0.5));

      if (isA) {
        this._listGroup.add(this.add.text(cx, cy - 50, 'A', {
          fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#FF8844',
        }).setOrigin(0.5));
      } else if (isB) {
        this._listGroup.add(this.add.text(cx, cy - 50, 'B', {
          fontFamily: FONT, fontSize: '11px', fontStyle: 'bold', color: '#44AAFF',
        }).setOrigin(0.5));
      }

      const zone = this.add.zone(cx, cy, 116, 126).setInteractive();
      zone.on('pointerdown', () => { this._selectMonster(mon); });
      this._listGroup.add(zone);
    });

    // Pagination controls
    if (totalPages > 1) {
      const paginY = scrollY + 2 * 148 + 24;
      const prevBtn = makeButton(this, W/2 - 80, paginY, 110, 38, '◀ Prev',
        this._listPage > 0 ? 0x5030A0 : 0x1A0838, () => {
          if (this._listPage > 0) { this._listPage--; this._buildMonsterList(this.scale.width, this.scale.height); }
        }, 13);
      prevBtn.setAlpha(this._listPage > 0 ? 1 : 0.35);
      this._listGroup.add(prevBtn);

      this._listGroup.add(this.add.text(W/2, paginY, (this._listPage + 1) + ' / ' + totalPages, {
        fontFamily: FONT, fontSize: '14px', color: '#AABBDD',
      }).setOrigin(0.5));

      const nextBtn = makeButton(this, W/2 + 80, paginY, 110, 38, 'Next ▶',
        this._listPage < totalPages - 1 ? 0x5030A0 : 0x1A0838, () => {
          if (this._listPage < totalPages - 1) { this._listPage++; this._buildMonsterList(this.scale.width, this.scale.height); }
        }, 13);
      nextBtn.setAlpha(this._listPage < totalPages - 1 ? 1 : 0.35);
      this._listGroup.add(nextBtn);
    }
  }

  private _selectMonster(mon: Monster) {
    if (this._selectedA?.id === mon.id) {
      this._selectedA = null;
    } else if (this._selectedB?.id === mon.id) {
      this._selectedB = null;
    } else if (!this._selectedA) {
      this._selectedA = mon;
    } else if (!this._selectedB) {
      this._selectedB = mon;
    } else {
      this._selectedA = mon;
    }
    this._updateSlots();
    this._buildMonsterList(this.scale.width, this.scale.height);
    const ready = !!(this._selectedA && this._selectedB);
    this._breedBtn.setAlpha(ready ? 1 : 0.38);
    if (ready) {
      const spA = SPECIES[this._selectedA!.speciesId], spB = SPECIES[this._selectedB!.speciesId];
      const cost = Math.round(Math.max(spA.price, spB.price) * 0.3);
      setButtonLabel(this._breedBtn, t('btn.breed') + '\n💰 ' + cost);
      this.tweens.killTweensOf(this._breedBtn);
      this.tweens.add({ targets: this._breedBtn, scaleX: 1.05, scaleY: 1.05, duration: 600, ease: 'Sine.InOut', yoyo: true, repeat: -1 });
    } else {
      setButtonLabel(this._breedBtn, t('btn.breed'));
      this.tweens.killTweensOf(this._breedBtn);
    }
  }

  private _updateSlots() {
    this._updateSlot(this._slotA, this._selectedA, 0xFFAA44);
    this._updateSlot(this._slotB, this._selectedB, 0x44AAFF);
  }

  private _updateSlot(slot: Slot, mon: Monster | null, glowCol: number) {
    slot.img?.destroy(); slot.img = null;
    slot.labelTxt?.destroy();
    if (mon) {
      slot.img = this.add.image(slot.x, slot.y - 4, makeMonsterTexture(this, mon)).setDisplaySize(90, 90);
      slot.labelTxt = this.add.text(slot.x, slot.y + 36, SPECIES[mon.speciesId].name, {
        fontFamily: FONT, fontSize: '12px', color: '#' + glowCol.toString(16).padStart(6, '0'),
      }).setOrigin(0.5);
    } else {
      slot.labelTxt = this.add.text(slot.x, slot.y, '?', {
        fontFamily: FONT, fontSize: '28px', color: '#7766BB',
      }).setOrigin(0.5);
    }
  }

  private _brewing = false;

  private _doBreed() {
    if (this._brewing) return;
    if (!this._selectedA || !this._selectedB) return;
    const a = this._selectedA, b = this._selectedB;
    if (a.id === b.id) { showToast(this, t('toast.cannotSelf'), '#ff9999'); return; }

    const spA = SPECIES[a.speciesId], spB = SPECIES[b.speciesId];
    const breedCost = Math.round(Math.max(spA.price, spB.price) * 0.3);
    if (Game.state!.coins < breedCost) {
      showToast(this, t('toast.notEnoughCoins'), '#ff9999');
      return;
    }

    this._brewing = true;
    this._breedBtn.setAlpha(0.38);
    this.tweens.killTweensOf(this._breedBtn);
    setButtonLabel(this._breedBtn, '✨ กำลังผสม...');

    // Deduct cost upfront; refund half on failure
    Game.state!.coins -= breedCost;
    store.setJSON('mps_state', Game.state);
    showFloat(this, this.scale.width / 2, this.scale.height / 2 + 60, '-' + breedCost + ' 💰', '#FF8888');

    // Spinning arcane circle overlay
    const W = this.scale.width, H = this.scale.height;
    const overlay = this.add.graphics().setDepth(20);
    overlay.fillStyle(0x000000, 0.45);
    overlay.fillRect(0, 0, W, H);

    const cx = W / 2, cy = 200;
    const circle = this.add.graphics().setDepth(21);
    let angle = 0;
    const spinTimer = this.time.addEvent({
      delay: 30, loop: true,
      callback: () => {
        angle += 8;
        circle.clear();
        circle.lineStyle(4, 0xAA66FF, 1);
        circle.strokeCircle(cx, cy, 80);
        circle.lineStyle(3, 0xFF99FF, 0.7);
        circle.strokeCircle(cx, cy, 55);
        // spinning arc
        const rad = Phaser.Math.DegToRad(angle);
        const x1 = cx + Math.cos(rad) * 80, y1 = cy + Math.sin(rad) * 80;
        const x2 = cx + Math.cos(rad + 2.5) * 80, y2 = cy + Math.sin(rad + 2.5) * 80;
        circle.lineStyle(6, 0xFFCCFF, 1);
        circle.lineBetween(cx, cy, x1, y1);
        circle.lineBetween(cx, cy, x2, y2);
      },
    });

    const statusTxt = this.add.text(cx, cy + 110, '...', {
      fontFamily: FONT, fontSize: '18px', color: '#CC99FF', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(21);
    this.tweens.add({ targets: statusTxt, alpha: { from: 0.4, to: 1 }, duration: 600, yoyo: true, repeat: -1 });

    this.time.delayedCall(2200, () => {
      spinTimer.destroy();
      circle.destroy();
      overlay.destroy();
      statusTxt.destroy();
      this._brewing = false;
      this._breedBtn.setAlpha(0.38);
      setButtonLabel(this._breedBtn, t('btn.breed'));

      const SUCCESS_RATE = 0.75;
      const success = Math.random() < SUCCESS_RATE;

      if (success) {
        let childSpeciesId: number;
        if (a.speciesId === b.speciesId) {
          childSpeciesId = a.speciesId;
        } else {
          childSpeciesId = 15 + (a.speciesId + b.speciesId) % 10;
        }
        const blendVi = Math.floor((a.variantIndex + b.variantIndex) / 2);
        const childVi = Math.max(0, Math.min(99, blendVi + Math.floor(Math.random() * 21) - 10));
        const baseHours = Math.max(spA.hatchHours, spB.hatchHours) * 1.5;
        const childSp = SPECIES[childSpeciesId];
        const finalHours = Math.max(baseHours, childSp.hatchHours * 0.5);

        const egg = newEgg(childSpeciesId, childVi, 'breeding', [a.id, b.id]);
        egg.hatchEndAt = Date.now() + finalHours * 3600000;
        Game.state!.eggs.push(egg);
        store.setJSON('mps_state', Game.state);
        sfx.buy();
        showToast(this, '✨ ' + t('toast.breedStarted', { h: Math.ceil(finalHours) }), '#aaffaa');
      } else {
        // Refund 50% of cost on failure
        const refund = Math.round(breedCost * 0.5);
        Game.state!.coins += refund;
        store.setJSON('mps_state', Game.state);
        sfx.buy();
        showFloat(this, cx, cy + 60, '+' + refund + ' 💰', '#AADDFF');
        showToast(this, '💔 ผสมพันธุ์ไม่สำเร็จ (คืน ' + refund + ' 💰)', '#ff9999');
      }

      this._selectedA = null; this._selectedB = null;
      this._updateSlots();
      this._buildMonsterList(W, H);
    });
  }
}
