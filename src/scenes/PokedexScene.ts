import Phaser from 'phaser';
import { Game, FONT } from '../utils';
import { SPECIES } from '../data';
import { makeMonsterTexture } from '../MonsterRenderer';
import { makeButton } from '../ui/Button';
import type { HabitatType, Monster } from '../types';

type FilterType = 'all' | HabitatType;

const FILTERS: FilterType[] = ['all', 'dirt', 'grass', 'aquatic'];
const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All', dirt: '⛰ Dirt', grass: '🌿 Grass', aquatic: '🌊 Aqua',
};

export class PokedexScene extends Phaser.Scene {
  private _filter: FilterType = 'all';

  constructor() { super({ key: 'PokedexScene' }); }

  init(data?: { filter?: FilterType }) {
    this._filter = (data as any)?.filter ?? 'all';
  }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this._buildBg(W, H);
    this._buildHeader(W);
    this._buildTabs(W);
    this._buildGrid(W);
  }

  private _buildBg(W: number, H: number) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a1020, 0x0a1020, 0x1a0a2e, 0x1a0a2e, 1);
    bg.fillRect(0, 0, W, H);
    bg.fillStyle(0xffffff, 0.18);
    [[48, 180], [130, 310], [255, 72], [375, 230], [488, 108], [70, 540], [315, 470], [465, 610]].forEach(s => {
      bg.fillCircle(s[0], s[1], 1.2);
    });
  }

  private _buildHeader(W: number) {
    makeButton(this, 52, 34, 90, 44, '← Back', 0x1a0a2e, () => {
      this.scene.start('Hub');
    }, 15).setDepth(10);

    this.add.text(W / 2, 24, 'Collection', {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(10);

    const total = SPECIES.length;
    const found = (Game.state!.stats.discovered ?? []).length;
    const pct = Math.round((found / total) * 100);
    this.add.text(W / 2, 52, found + ' / ' + total + ' found  (' + pct + '%)', {
      fontFamily: FONT, fontSize: '14px', color: '#9999bb',
    }).setOrigin(0.5).setDepth(10);

    // progress bar
    const pbg = this.add.graphics().setDepth(9);
    pbg.fillStyle(0x0a0420, 1);
    pbg.fillRoundedRect(W / 2 - 130, 62, 260, 8, 4);
    if (found > 0) {
      pbg.fillStyle(0x7040e0, 1);
      pbg.fillRoundedRect(W / 2 - 130, 62, Math.max(8, 260 * found / total), 8, 4);
    }
  }

  private _buildTabs(W: number) {
    const tabW = W / FILTERS.length;
    FILTERS.forEach((f, i) => {
      const tx = tabW * i;
      const isActive = f === this._filter;
      const tabBg = this.add.graphics().setDepth(5);
      tabBg.fillStyle(isActive ? 0x4a2080 : 0x14082a, isActive ? 1 : 0.9);
      tabBg.fillRect(tx + 1, 74, tabW - 2, 28);
      if (isActive) {
        tabBg.lineStyle(1, 0x8050e0, 1);
        tabBg.strokeRect(tx + 1, 74, tabW - 2, 28);
      }
      this.add.text(tx + tabW / 2, 88, FILTER_LABELS[f], {
        fontFamily: FONT, fontSize: '12px', color: isActive ? '#ffffff' : '#605590',
      }).setOrigin(0.5).setDepth(6);
      if (!isActive) {
        const zone = this.add.zone(tx + tabW / 2, 88, tabW - 2, 28).setInteractive().setDepth(7);
        zone.on('pointerdown', () => this.scene.restart({ filter: f }));
      }
    });
  }

  private _buildGrid(W: number) {
    const discovered = new Set<number>(Game.state!.stats.discovered ?? []);
    const filtered = this._filter === 'all' ? SPECIES : SPECIES.filter(s => s.habitat === this._filter);

    const COLS = 5;
    const cellW = Math.floor(W / COLS);
    const cellH = 114;
    const startY = 108;

    filtered.forEach((sp, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const cx = cellW * col + cellW / 2;
      const cy = startY + row * cellH + cellH / 2;
      const isFound = discovered.has(sp.id);

      const card = this.add.graphics().setDepth(3);
      card.fillStyle(isFound ? 0x1e1040 : 0x0c0818, 1);
      card.fillRoundedRect(cx - cellW / 2 + 4, cy - cellH / 2 + 4, cellW - 8, cellH - 8, 10);
      if (isFound) {
        card.lineStyle(1, 0x4a2080, 0.7);
        card.strokeRoundedRect(cx - cellW / 2 + 4, cy - cellH / 2 + 4, cellW - 8, cellH - 8, 10);
      }

      if (isFound) {
        const dummyMon: Monster = {
          id: 'dex_' + sp.id, speciesId: sp.id, variantIndex: 0,
          habitatType: sp.habitat, level: 1, xp: 0,
          happiness: 80, hunger: 70, cleanliness: 90,
          lastCaredAt: 0, source: 'dex',
        };
        const texKey = makeMonsterTexture(this, dummyMon);
        this.add.image(cx, cy - 14, texKey).setDisplaySize(62, 62).setDepth(4);
        this.add.text(cx, cy + 37, sp.name, {
          fontFamily: FONT, fontSize: '9px', color: '#ccccff', align: 'center',
          wordWrap: { width: cellW - 8 },
        }).setOrigin(0.5).setDepth(4);
        // star badge for rare breeding-only species
        if (sp.id >= 15) {
          this.add.text(cx - cellW / 2 + 12, cy - cellH / 2 + 14, '★', {
            fontFamily: FONT, fontSize: '10px', color: '#FFD700',
          }).setOrigin(0.5).setDepth(5);
        }
      } else {
        this.add.text(cx, cy - 12, '?', {
          fontFamily: FONT, fontSize: '30px', color: '#2a1860', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(4);
        this.add.text(cx, cy + 37, '???', {
          fontFamily: FONT, fontSize: '9px', color: '#321c60',
        }).setOrigin(0.5).setDepth(4);
      }
    });
  }
}
