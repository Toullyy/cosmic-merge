import Phaser from 'phaser';
import { Game, FONT, store, sfx } from '../utils';
import { SPECIES, HABITATS, newEgg } from '../data';
import { makeMonsterTexture } from '../MonsterRenderer';
import { makeButton } from '../ui/Button';
import { showToast } from '../ui/Toast';
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

  constructor() { super({ key: 'BreedingLab' }); }

  create() {
    sfx.unlock();
    const W = this.scale.width, H = this.scale.height;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x060312, 0x060312, 0x1a0a2e, 0x1a0a2e, 1);
    bg.fillRect(0, 0, W, H);

    this.add.text(W/2, 46, '🧬 Breeding Lab', {
      fontFamily: FONT, fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(W/2, 76, 'Select 2 monsters (Level 4+) to breed', {
      fontFamily: FONT, fontSize: '15px', color: '#8888cc',
    }).setOrigin(0.5);

    makeButton(this, W - 70, 30, 110, 40, '← Back', 0x2a1560, () => {
      Ads.maybeInterstitial(() => { this.scene.start('Hub'); });
    }, 15);

    this._slotA = this._buildParentSlot(W/2 - 100, 180, 'Parent A');
    this._slotB = this._buildParentSlot(W/2 + 100, 180, 'Parent B');
    this.add.text(W/2, 190, '+', { fontFamily: FONT, fontSize: '32px', color: '#6040c0' }).setOrigin(0.5);

    this._listGroup = this.add.group();
    this._buildMonsterList(W, H);

    this._breedBtn = makeButton(this, W/2, H - 60, 220, 54, '🧬 Breed!', 0x2a0860, () => {
      this._doBreed();
    }, 18);
    this._breedBtn.setAlpha(0.4);
  }

  private _buildParentSlot(x: number, y: number, label: string): Slot {
    const g = this.add.graphics();
    g.lineStyle(2, 0x4030a0, 0.8);
    g.strokeRoundedRect(x - 60, y - 70, 120, 130, 12);
    g.fillStyle(0x0d0618, 0.8);
    g.fillRoundedRect(x - 60, y - 70, 120, 130, 12);
    this.add.text(x, y + 48, label, { fontFamily: FONT, fontSize: '13px', color: '#6655aa' }).setOrigin(0.5);
    const labelTxt = this.add.text(x, y, '?', { fontFamily: FONT, fontSize: '28px', color: '#3a2a60' }).setOrigin(0.5);
    return { x, y, graphics: g, img: null, labelTxt };
  }

  private _buildMonsterList(W: number, _H: number) {
    this._listGroup.clear(true, true);
    const eligible = Game.state!.monsters.filter(m => m.level >= 4);
    const scrollY = 340;

    if (eligible.length === 0) {
      this._listGroup.add(this.add.text(W/2, scrollY + 40,
        'No monsters at Level 4+ yet.\nRaise your monsters to breed!', {
        fontFamily: FONT, fontSize: '16px', color: '#6655aa', align: 'center', lineSpacing: 8,
      }).setOrigin(0.5));
      return;
    }

    eligible.forEach((mon, idx) => {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const cx = W/2 - 140 + col * 140;
      const cy = scrollY + row * 150;
      const sp = SPECIES[mon.speciesId];

      const isA = this._selectedA?.id === mon.id;
      const isB = this._selectedB?.id === mon.id;
      const borderCol = isA ? 0xff8844 : (isB ? 0x44aaff : 0x2a2a4a);

      const cardBg = this.add.graphics();
      cardBg.fillStyle(0x100820, 1);
      cardBg.fillRoundedRect(cx - 58, cy - 58, 116, 126, 12);
      cardBg.lineStyle(2, borderCol, isA || isB ? 1 : 0.4);
      cardBg.strokeRoundedRect(cx - 58, cy - 58, 116, 126, 12);
      this._listGroup.add(cardBg);

      const img = this.add.image(cx, cy - 8, makeMonsterTexture(this, mon)).setDisplaySize(80, 80);
      this._listGroup.add(img);
      this._listGroup.add(this.add.text(cx, cy + 44, sp.name, {
        fontFamily: FONT, fontSize: '13px', color: '#ccccdd', align: 'center',
      }).setOrigin(0.5));
      this._listGroup.add(this.add.text(cx, cy + 62, 'Lv ' + mon.level, {
        fontFamily: FONT, fontSize: '12px', color: '#ffdd55',
      }).setOrigin(0.5));

      const zone = this.add.zone(cx, cy, 116, 126).setInteractive();
      zone.on('pointerdown', () => { this._selectMonster(mon); });
      this._listGroup.add(zone);
    });
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
    this._breedBtn.setAlpha(this._selectedA && this._selectedB ? 1 : 0.4);
  }

  private _updateSlots() {
    this._updateSlot(this._slotA, this._selectedA);
    this._updateSlot(this._slotB, this._selectedB);
  }

  private _updateSlot(slot: Slot, mon: Monster | null) {
    slot.img?.destroy(); slot.img = null;
    slot.labelTxt?.destroy();
    if (mon) {
      slot.img = this.add.image(slot.x, slot.y, makeMonsterTexture(this, mon)).setDisplaySize(88, 88);
      slot.labelTxt = this.add.text(slot.x, slot.y + 32, SPECIES[mon.speciesId].name, {
        fontFamily: FONT, fontSize: '12px', color: '#dddddd',
      }).setOrigin(0.5);
    } else {
      slot.labelTxt = this.add.text(slot.x, slot.y, '?', {
        fontFamily: FONT, fontSize: '28px', color: '#3a2a60',
      }).setOrigin(0.5);
    }
  }

  private _doBreed() {
    if (!this._selectedA || !this._selectedB) return;
    const a = this._selectedA, b = this._selectedB;
    if (a.id === b.id) { showToast(this, 'A monster cannot breed with itself!', '#ff9999'); return; }

    let childSpeciesId: number;
    if (a.speciesId === b.speciesId) {
      childSpeciesId = a.speciesId;
    } else {
      childSpeciesId = 15 + (a.speciesId + b.speciesId) % 10;
    }

    const blendVi = Math.floor((a.variantIndex + b.variantIndex) / 2);
    const childVi = Math.max(0, Math.min(99, blendVi + Math.floor(Math.random() * 21) - 10));

    const spA = SPECIES[a.speciesId], spB = SPECIES[b.speciesId];
    const baseHours = Math.max(spA.hatchHours, spB.hatchHours) * 1.5;
    const childSp = SPECIES[childSpeciesId];
    const finalHours = Math.max(baseHours, childSp.hatchHours * 0.5);

    const egg = newEgg(childSpeciesId, childVi, 'breeding', [a.id, b.id]);
    egg.hatchEndAt = Date.now() + finalHours * 3600000;
    Game.state!.eggs.push(egg);
    store.setJSON('mps_state', Game.state);
    sfx.buy();
    showToast(this, 'Breeding started! Hatch in ' + Math.ceil(finalHours) + 'h', '#aaffaa');

    this._selectedA = null; this._selectedB = null;
    this._updateSlots();
    this._buildMonsterList(this.scale.width, this.scale.height);
    this._breedBtn.setAlpha(0.4);
  }
}
