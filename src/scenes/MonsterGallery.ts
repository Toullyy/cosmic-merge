import Phaser from 'phaser';
import { FONT } from '../utils';
import { t } from '../i18n';
import { SPECIES } from '../data';
import { preloadMonsterTexture } from '../MonsterRenderer';
import { makeButton, setButtonColor } from '../ui/Button';
import type { Monster } from '../types';

const VARIANTS = [
  { vi: 6,  label: 'Normal'  },   // vi=6 → hueShift=0, not golden, no spots
  { vi: 7,  label: '✨ Gold'  },   // vi=7 → golden
  { vi: 50, label: '🔵 Spot'  },   // vi=50 → spotted pattern
  { vi: 56, label: '✨🔵 Both' },  // vi=56 → golden + spotted
];

const HAB_BG:     Record<string, number> = { dirt: 0x1A0A04, grass: 0x031208, aquatic: 0x01090F };
const HAB_BORDER: Record<string, number> = { dirt: 0x7A3808, grass: 0x286020, aquatic: 0x0E5A90 };
const HAB_ICON:   Record<string, string> = { dirt: '⛰', grass: '🌿', aquatic: '🌊' };

const COLS   = 3;
const CELL_W = 540 / COLS;   // 180
const CELL_H = 148;
const HDR_H  = 64;

function fakeMon(speciesId: number, vi: number): Monster {
  return {
    id: 'gal_' + speciesId + '_' + vi,
    speciesId, variantIndex: vi,
    habitatType: SPECIES[speciesId].habitat,
    level: 1, xp: 0, happiness: 100, hunger: 100, cleanliness: 100,
    lastCaredAt: 0, source: 'gallery',
  };
}

export class MonsterGallery extends Phaser.Scene {
  private _viIdx   = 0;
  private _cards!:  Phaser.GameObjects.Group;
  private _varBtns: Phaser.GameObjects.Container[] = [];
  private _totalH  = 0;

  // scroll state
  private _dragStartPtrY   = 0;
  private _dragStartScrollY = 0;

  constructor() { super({ key: 'MonsterGallery' }); }

  // ── create (sync) ──────────────────────────────────────────────────────────

  create() {
    const W = this.scale.width, H = this.scale.height;
    const rows   = Math.ceil(SPECIES.length / COLS);
    this._totalH = HDR_H + rows * CELL_H + 20;

    // Dark bg — world height
    this.add.rectangle(W / 2, this._totalH / 2, W, this._totalH, 0x08011A).setDepth(0);

    // Camera bounds
    this.cameras.main.setBounds(0, 0, W, this._totalH);

    // ── Header (fixed, scrollFactor 0) ────────────────────────────────────
    const hdrBg = this.add.graphics().setScrollFactor(0).setDepth(10);
    hdrBg.fillStyle(0x0C0230, 1);
    hdrBg.fillRect(0, 0, W, HDR_H);
    hdrBg.lineStyle(1.5, 0x6622BB, 0.50);
    hdrBg.lineBetween(0, HDR_H, W, HDR_H);

    makeButton(this, 44, 20, 76, 30, t('btn.back'), 0x341278, () => {
      this.scene.start('Hub');
    }, 13).setScrollFactor(0).setDepth(11);

    this.add.text(W / 2, 14, t('gallery.title'), {
      fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#CC88FF',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(11);

    // Variant toggle buttons
    const btnW = 76, gap = 4;
    const totalBW = VARIANTS.length * btnW + (VARIANTS.length - 1) * gap;
    const bx0 = W / 2 - totalBW / 2 + btnW / 2;
    this._varBtns = VARIANTS.map((v, i) => {
      const btn = makeButton(this, bx0 + i * (btnW + gap), 46, btnW, 24, v.label,
        i === 0 ? 0x4A1878 : 0x1A0840, () => {
          this._viIdx = i;
          this._varBtns.forEach((b, j) => setButtonColor(b, j === i ? 0x4A1878 : 0x1A0840));
          this._rebuildCards();
        }, 11);
      return btn.setScrollFactor(0).setDepth(11);
    });

    // Loading text
    const loadTxt = this.add.text(W / 2, H / 2, t('gallery.loading'), {
      fontFamily: FONT, fontSize: '16px', color: '#9977BB',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20);

    // Card group (filled after textures load)
    this._cards = this.add.group();

    // ── Scroll input — Zone over content area ─────────────────────────────
    const zoneH  = Math.max(H, this._totalH);
    const zoneY  = HDR_H + zoneH / 2;           // starts below header
    const zone   = this.add.zone(W / 2, zoneY, W, zoneH)
      .setOrigin(0.5, 0)
      .setDepth(5)
      .setInteractive();

    zone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this._dragStartPtrY    = ptr.y;
      this._dragStartScrollY = this.cameras.main.scrollY;
    });

    zone.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!ptr.isDown) return;
      const delta = this._dragStartPtrY - ptr.y;
      this.cameras.main.scrollY = Phaser.Math.Clamp(
        this._dragStartScrollY + delta, 0, Math.max(0, this._totalH - H)
      );
    });

    // ── Load all textures async, then build ───────────────────────────────
    const toLoad = SPECIES.flatMap(sp => VARIANTS.map(v => fakeMon(sp.id, v.vi)));
    Promise.all(toLoad.map(m => preloadMonsterTexture(this, m))).then(() => {
      loadTxt.destroy();
      this._rebuildCards();
    });
  }

  // ── Cards ─────────────────────────────────────────────────────────────────

  private _rebuildCards() {
    this._cards.clear(true, true);
    const vi = VARIANTS[this._viIdx].vi;

    SPECIES.forEach((sp, idx) => {
      const col = idx % COLS, row = Math.floor(idx / COLS);
      const cx = col * CELL_W + CELL_W / 2;
      const cy = HDR_H + row * CELL_H + CELL_H / 2;
      const isRare   = sp.id >= 15;
      const borderCol = isRare ? 0x8833CC : (HAB_BORDER[sp.habitat] ?? 0x4422AA);

      // Card
      const card = this.add.graphics().setDepth(2);
      card.fillStyle(0x000000, 0.30);
      card.fillRoundedRect(cx - CELL_W / 2 + 5, cy - CELL_H / 2 + 5, CELL_W - 6, CELL_H - 6, 10);
      card.fillStyle(HAB_BG[sp.habitat] ?? 0x0A0220, 1);
      card.fillRoundedRect(cx - CELL_W / 2 + 3, cy - CELL_H / 2 + 3, CELL_W - 6, CELL_H - 6, 10);
      card.lineStyle(1.5, borderCol, isRare ? 0.90 : 0.65);
      card.strokeRoundedRect(cx - CELL_W / 2 + 3, cy - CELL_H / 2 + 3, CELL_W - 6, CELL_H - 6, 10);
      if (vi % 7 === 0) {                       // golden tint on border
        card.lineStyle(2, 0xFFD700, 0.40);
        card.strokeRoundedRect(cx - CELL_W / 2 + 1, cy - CELL_H / 2 + 1, CELL_W - 2, CELL_H - 2, 11);
      }
      this._cards.add(card);

      // Habitat / rare icon (top-left)
      this._cards.add(this.add.text(cx - CELL_W / 2 + 6, cy - CELL_H / 2 + 6,
        isRare ? '⭐' : (HAB_ICON[sp.habitat] ?? ''), {
          fontFamily: FONT, fontSize: '11px',
        }).setDepth(3));

      // Species # (top-right)
      this._cards.add(this.add.text(cx + CELL_W / 2 - 6, cy - CELL_H / 2 + 8,
        '#' + String(sp.id).padStart(2, '0'), {
          fontFamily: FONT, fontSize: '10px', color: '#443366',
        }).setOrigin(1, 0).setDepth(3));

      // Sprite
      const key = 'mon_' + sp.id + '_' + vi;
      if (this.textures.exists(key)) {
        this._cards.add(this.add.image(cx, cy - 16, key).setDisplaySize(86, 86).setDepth(3));
      }

      // Name
      this._cards.add(this.add.text(cx, cy + 48, sp.name, {
        fontFamily: FONT, fontSize: '12px', fontStyle: 'bold',
        color: isRare ? '#CC88FF' : '#FFFFFF',
      }).setOrigin(0.5).setDepth(3));

      // Stats
      this._cards.add(this.add.text(cx, cy + 64, '⏱' + sp.hatchHours + 'h  💰' + sp.price, {
        fontFamily: FONT, fontSize: '10px', color: '#776699',
      }).setOrigin(0.5).setDepth(3));
    });
  }
}
