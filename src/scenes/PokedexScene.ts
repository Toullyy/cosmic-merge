import Phaser from 'phaser';
import { Game, FONT, store } from '../utils';
import { t } from '../i18n';
import { SPECIES } from '../data';
import { makeMonsterTexture, preloadMonsterTexture } from '../MonsterRenderer';
import { makeButton } from '../ui/Button';
import type { HabitatType, Monster } from '../types';

type FilterType = 'all' | HabitatType;

const FILTERS: FilterType[] = ['all', 'dirt', 'grass', 'aquatic'];
const FILTER_LABELS: Record<FilterType, string> = {
  all: '✨ All', dirt: '⛰ Dirt', grass: '🌿 Grass', aquatic: '🌊 Aqua',
};
const HABITAT_COLORS: Record<string, number> = {
  dirt: 0xFFAA44, grass: 0x55DD44, aquatic: 0x44CCFF, all: 0xAA88FF,
};
const HABITAT_DARK: Record<string, number> = {
  dirt: 0x3A1800, grass: 0x0A2208, aquatic: 0x041828, all: 0x1A0838,
};

export class PokedexScene extends Phaser.Scene {
  private _filter: FilterType = 'all';
  private _newOnes = new Set<number>();

  constructor() { super({ key: 'PokedexScene' }); }

  init(data?: { filter?: FilterType }) {
    this._filter = (data as any)?.filter ?? 'all';
  }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this._newOnes = new Set<number>((Game.state!.newDiscoveries ?? []).map(Number));
    if (this._newOnes.size > 0) {
      Game.state!.newDiscoveries = [];
      store.setJSON('mps_state', Game.state);
    }
    this._buildBg(W, H);
    this._buildHeader(W);
    this._buildTabs(W);

    // Preload all species (discovered for normal display, undiscovered for silhouettes)
    const preloads = SPECIES.map(sp => {
      const dummy: Monster = {
        id: 'dex_' + sp.id, speciesId: sp.id, variantIndex: 0,
        habitatType: sp.habitat, level: 1, xp: 0,
        happiness: 80, hunger: 70, cleanliness: 90, lastCaredAt: 0, source: 'dex',
      };
      return preloadMonsterTexture(this, dummy);
    });
    Promise.all(preloads).then(() => { this._buildGrid(W); });
  }

  private _buildBg(W: number, H: number) {
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x0A0320, 0x0A0320, 0x1A0848, 0x1A0848, 1);
    bg.fillRect(0, 0, W, H);

    // Nebula blobs
    const blobs = [
      { x: 80,  y: 200, r: 90,  col: 0x3010A0, a: 0.18 },
      { x: 460, y: 160, r: 70,  col: 0x6020C0, a: 0.14 },
      { x: 280, y: 500, r: 120, col: 0x1040A0, a: 0.12 },
      { x: 100, y: 700, r: 80,  col: 0x402080, a: 0.15 },
      { x: 420, y: 750, r: 100, col: 0x204080, a: 0.10 },
    ];
    blobs.forEach(b => {
      bg.fillStyle(b.col, b.a);
      bg.fillCircle(b.x, b.y, b.r);
    });

    // Static star field
    const rng = Phaser.Math.RND;
    for (let i = 0; i < 80; i++) {
      const x = rng.between(0, W);
      const y = rng.between(0, H);
      const r = rng.realInRange(0.5, 1.8);
      const a = rng.realInRange(0.3, 0.9);
      bg.fillStyle(0xFFFFFF, a);
      bg.fillCircle(x, y, r);
    }
    // A few bright colored stars
    [[40, 100, 0xAAEEFF], [500, 340, 0xFFCCFF], [220, 820, 0xCCFFAA], [370, 140, 0xFFEEAA]].forEach(([x, y, c]) => {
      bg.fillStyle(c as number, 0.7);
      bg.fillCircle(x as number, y as number, 2);
    });

    // Twinkling star overlays — 20 dots that pulse independently
    const twinklePositions: [number, number][] = [];
    for (let i = 0; i < 20; i++) {
      twinklePositions.push([rng.between(10, W - 10), rng.between(10, H - 10)]);
    }
    twinklePositions.forEach(([tx, ty]) => {
      const tg = this.add.graphics().setDepth(1);
      tg.fillStyle(0xFFFFFF, 1);
      tg.fillCircle(tx, ty, rng.realInRange(0.8, 2.0));
      this.tweens.add({
        targets: tg,
        alpha: { from: rng.realInRange(0.1, 0.4), to: rng.realInRange(0.7, 1.0) },
        duration: 800 + rng.between(0, 1400),
        yoyo: true, repeat: -1, ease: 'Sine.InOut',
        delay: rng.between(0, 1200),
      });
    });
  }

  private _buildHeader(W: number) {
    makeButton(this, 52, 34, 90, 44, t('btn.back'), 0x1a0a2e, () => {
      this.scene.start('Hub');
    }, 15).setDepth(10);

    // Title glow
    const titleGlow = this.add.graphics().setDepth(9);
    titleGlow.fillStyle(0x6030CC, 0.12);
    titleGlow.fillRoundedRect(W / 2 - 140, 6, 280, 46, 14);

    this.add.text(W / 2, 24, t('dex.title'), {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(10);

    const total = SPECIES.length;
    const found = (Game.state!.stats.discovered ?? []).length;
    const pct = Math.round((found / total) * 100);
    this.add.text(W / 2, 52, found + ' / ' + total + '  (' + pct + '%)', {
      fontFamily: FONT, fontSize: '13px', color: '#AABBDD',
    }).setOrigin(0.5).setDepth(10);

    // Progress bar track
    const pbg = this.add.graphics().setDepth(9);
    pbg.fillStyle(0x0a0420, 1);
    pbg.fillRoundedRect(W / 2 - 160, 64, 320, 10, 5);
    // Fill
    if (found > 0) {
      const fillW = Math.max(10, 320 * found / total);
      pbg.fillGradientStyle(0x7040E0, 0xAA60FF, 0x7040E0, 0xAA60FF, 1);
      pbg.fillRoundedRect(W / 2 - 160, 64, fillW, 10, 5);
      // Glow on fill
      pbg.fillStyle(0xCC88FF, 0.25);
      pbg.fillRoundedRect(W / 2 - 160, 64, fillW, 5, { tl: 5, tr: 5, bl: 0, br: 0 });
    }
  }

  private _buildTabs(W: number) {
    const tabW = Math.floor(W / FILTERS.length);
    FILTERS.forEach((f, i) => {
      const tx = tabW * i;
      const isActive = f === this._filter;
      const col = HABITAT_COLORS[f];
      const dark = HABITAT_DARK[f];

      const tabBg = this.add.graphics().setDepth(5);
      if (isActive) {
        tabBg.fillStyle(dark, 1);
        tabBg.fillRect(tx + 1, 78, tabW - 2, 26);
        tabBg.lineStyle(1.5, col, 0.9);
        tabBg.strokeRect(tx + 1, 78, tabW - 2, 26);
        // color glow bottom border
        tabBg.lineStyle(2, col, 0.6);
        tabBg.lineBetween(tx + 1, 104, tx + tabW - 1, 104);
        // shimmer
        tabBg.fillStyle(col, 0.08);
        tabBg.fillRect(tx + 4, 79, tabW - 8, 7);
      } else {
        tabBg.fillStyle(0x12062A, 0.85);
        tabBg.fillRect(tx + 1, 78, tabW - 2, 26);
        tabBg.lineStyle(1, 0x3A1880, 0.5);
        tabBg.strokeRect(tx + 1, 78, tabW - 2, 26);
      }

      this.add.text(tx + tabW / 2, 91, FILTER_LABELS[f], {
        fontFamily: FONT, fontSize: '12px',
        color: isActive ? '#' + col.toString(16).padStart(6, '0') : '#665599',
        fontStyle: isActive ? 'bold' : 'normal',
      }).setOrigin(0.5).setDepth(6);

      if (!isActive) {
        this.add.zone(tx + tabW / 2, 91, tabW - 2, 26)
          .setInteractive().setDepth(7)
          .on('pointerdown', () => this.scene.restart({ filter: f }));
      }
    });
  }

  private _buildGrid(W: number) {
    const discovered = new Set<number>(Game.state!.stats.discovered ?? []);
    const filtered = this._filter === 'all' ? SPECIES : SPECIES.filter(s => s.habitat === this._filter);

    const COLS = 5;
    const cellW = Math.floor(W / COLS);
    const cellH = 116;
    const startY = 110;

    filtered.forEach((sp, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const cx = cellW * col + cellW / 2;
      const cy = startY + row * cellH + cellH / 2;
      const isFound = discovered.has(sp.id);
      const borderCol = HABITAT_COLORS[sp.habitat] ?? 0x7840C0;

      const card = this.add.graphics().setDepth(3);

      if (isFound) {
        // Discovered card: habitat tinted background + colored border
        card.fillStyle(HABITAT_DARK[sp.habitat] ?? 0x1C0A40, 1);
        card.fillRoundedRect(cx - cellW / 2 + 4, cy - cellH / 2 + 4, cellW - 8, cellH - 8, 10);
        card.lineStyle(1.5, borderCol, 0.75);
        card.strokeRoundedRect(cx - cellW / 2 + 4, cy - cellH / 2 + 4, cellW - 8, cellH - 8, 10);
        // Header glow strip
        card.fillStyle(borderCol, 0.10);
        card.fillRoundedRect(cx - cellW / 2 + 4, cy - cellH / 2 + 4, cellW - 8, 22,
          { tl: 10, tr: 10, bl: 0, br: 0 });
      } else {
        // Undiscovered: dark mysterious card
        card.fillStyle(0x0A0520, 0.9);
        card.fillRoundedRect(cx - cellW / 2 + 4, cy - cellH / 2 + 4, cellW - 8, cellH - 8, 10);
        card.lineStyle(1, 0x2A1060, 0.6);
        card.strokeRoundedRect(cx - cellW / 2 + 4, cy - cellH / 2 + 4, cellW - 8, cellH - 8, 10);
        // Subtle dashed-like dots at corners
        card.fillStyle(0x3A1880, 0.4);
        card.fillCircle(cx - cellW / 2 + 8, cy - cellH / 2 + 8, 2);
        card.fillCircle(cx + cellW / 2 - 8, cy - cellH / 2 + 8, 2);
        card.fillCircle(cx - cellW / 2 + 8, cy + cellH / 2 - 8, 2);
        card.fillCircle(cx + cellW / 2 - 8, cy + cellH / 2 - 8, 2);
      }

      if (isFound) {
        const dummyMon: Monster = {
          id: 'dex_' + sp.id, speciesId: sp.id, variantIndex: 0,
          habitatType: sp.habitat, level: 1, xp: 0,
          happiness: 80, hunger: 70, cleanliness: 90,
          lastCaredAt: 0, source: 'dex',
        };
        const texKey = makeMonsterTexture(this, dummyMon);
        this.add.image(cx, cy - 12, texKey).setDisplaySize(60, 60).setDepth(4);
        this.add.text(cx, cy + 38, sp.name, {
          fontFamily: FONT, fontSize: '9px',
          color: '#' + borderCol.toString(16).padStart(6, '0'),
          align: 'center', wordWrap: { width: cellW - 8 },
        }).setOrigin(0.5).setDepth(4);

        // Rare star badge
        if (sp.id >= 15) {
          const sb = this.add.graphics().setDepth(5);
          sb.fillStyle(0x6B3A00, 0.9);
          sb.fillRoundedRect(cx - cellW / 2 + 5, cy - cellH / 2 + 5, 18, 15, 4);
          this.add.text(cx - cellW / 2 + 14, cy - cellH / 2 + 12, '★', {
            fontFamily: FONT, fontSize: '10px', color: '#FFD700',
          }).setOrigin(0.5).setDepth(6);
        }

        // NEW badge
        if (this._newOnes.has(sp.id)) {
          const badgeBg = this.add.graphics().setDepth(5);
          badgeBg.fillStyle(0xFF3333, 1);
          badgeBg.fillRoundedRect(cx + cellW / 2 - 26, cy - cellH / 2 + 5, 22, 13, 4);
          this.add.text(cx + cellW / 2 - 15, cy - cellH / 2 + 11, 'NEW', {
            fontFamily: FONT, fontSize: '7px', fontStyle: 'bold', color: '#ffffff',
          }).setOrigin(0.5).setDepth(6);
        }
      } else {
        // Undiscovered: dark silhouette of the actual monster + "???" label
        const texKey = 'mon_' + sp.id + '_0';
        if (this.textures.exists(texKey)) {
          const sil = this.add.image(cx, cy - 12, texKey)
            .setDisplaySize(60, 60).setDepth(4)
            .setTint(0x0D0520).setAlpha(0.70);
          // Faint habitat-colored glow behind silhouette
          const hintCol = HABITAT_COLORS[sp.habitat] ?? 0x7840C0;
          const glow = this.add.graphics().setDepth(3);
          glow.fillStyle(hintCol, 0.10);
          glow.fillCircle(cx, cy - 12, 32);
          this.tweens.add({
            targets: [sil, glow], alpha: { from: sil.alpha * 0.7, to: sil.alpha },
            duration: 1800 + Math.random() * 1200,
            yoyo: true, repeat: -1, ease: 'Sine.InOut',
            delay: Math.random() * 1000,
          });
        } else {
          this.add.text(cx, cy - 10, '?', {
            fontFamily: FONT, fontSize: '32px', fontStyle: 'bold',
            color: '#2A1480',
          }).setOrigin(0.5).setDepth(4);
        }
        this.add.text(cx, cy + 38, '???', {
          fontFamily: FONT, fontSize: '9px', color: '#2A1560',
        }).setOrigin(0.5).setDepth(4);
      }
    });
  }
}
