import Phaser from 'phaser';
import { FONT } from '../utils';
import { makeButton } from '../ui/Button';
import { fetchShops } from '../shopSync';
import { makeMonsterTexture } from '../MonsterRenderer';
import { SPECIES } from '../data';
import { t, currentLang } from '../i18n';
import type { PublicShop, PublicMonster, Monster } from '../types';

const HAB_COLOR: Record<string, number> = {
  dirt:    0x7A4420,
  grass:   0x2A6020,
  aquatic: 0x145070,
};

export class VisitScene extends Phaser.Scene {
  constructor() { super('VisitScene'); }

  private _items: Phaser.GameObjects.GameObject[] = [];
  private _scrollCleanup: (() => void) | null = null;

  create() {
    const W = 540, H = 960;

    // Background
    const bg = this.add.graphics().setDepth(0);
    bg.fillGradientStyle(0x08031A, 0x08031A, 0x0F0825, 0x0F0825, 1);
    bg.fillRect(0, 0, W, H);

    // Stars
    const rng = new Phaser.Math.RandomDataGenerator(['visit-stars']);
    const stars = this.add.graphics().setDepth(0);
    for (let i = 0; i < 60; i++) {
      stars.fillStyle(0xffffff, 0.1 + rng.frac() * 0.4);
      stars.fillCircle(rng.integerInRange(0, W), rng.integerInRange(0, Math.floor(H * 0.55)), rng.frac() * 1.5 + 0.5);
    }

    // Fixed header
    this.add.text(W / 2, 50, t('visit.title'), {
      fontFamily: FONT, fontSize: '26px', color: '#FFD700',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    makeButton(this, 52, 50, 86, 40, t('btn.back'), 0x1A1040, () => {
      this.scene.start('Hub');
    }, 13).setDepth(10);

    // Loading text
    const loadTxt = this.add.text(W / 2, H / 2, t('visit.loading'), {
      fontFamily: FONT, fontSize: '20px', color: '#888888',
    }).setOrigin(0.5).setDepth(10);

    fetchShops().then(shops => {
      if (!this.scene.isActive('VisitScene')) return;
      loadTxt.destroy();
      this._showList(shops);
    });
  }

  private _clearItems() {
    this._scrollCleanup?.();
    this._scrollCleanup = null;
    this._items.forEach(o => {
      const go = o as Phaser.GameObjects.GameObject;
      if (go.active) go.destroy();
    });
    this._items = [];
  }

  // ─── LIST MODE ────────────────────────────────────────────────

  private _showList(shops: PublicShop[]) {
    const W = 540, H = 960;
    this._clearItems();

    if (shops.length === 0) {
      const txt = this.add.text(W / 2, H / 2, t('visit.empty'), {
        fontFamily: FONT, fontSize: '18px', color: '#666666',
        align: 'center', wordWrap: { width: 420 },
      }).setOrigin(0.5).setDepth(10);
      this._items.push(txt);
      return;
    }

    const VIEW_TOP = 82, VIEW_H = H - VIEW_TOP - 20;
    const CARD_H = 112, GAP = 10;

    this._buildScrollable(VIEW_TOP, VIEW_H, container => {
      let totalH = 0;
      shops.forEach((shop, i) => {
        const cy = GAP + CARD_H / 2 + i * (CARD_H + GAP);
        this._makeListCard(shop, W / 2, cy, W - 32, CARD_H, container);
        totalH = cy + CARD_H / 2 + GAP;
      });
      return totalH;
    });
  }

  private _makeListCard(
    shop: PublicShop, cx: number, cy: number,
    cW: number, cH: number,
    container: Phaser.GameObjects.Container,
  ) {
    const bg = this.add.graphics().setDepth(2);
    bg.fillStyle(0x000000, 0.45);
    bg.fillRoundedRect(cx - cW / 2, cy - cH / 2, cW, cH, 14);
    bg.fillStyle(0x160830, 0.85);
    bg.fillRoundedRect(cx - cW / 2 + 2, cy - cH / 2 + 2, cW - 4, cH - 4, 12);
    bg.lineStyle(1.5, 0x3A1870, 0.8);
    bg.strokeRoundedRect(cx - cW / 2 + 2, cy - cH / 2 + 2, cW - 4, cH - 4, 12);
    container.add(bg);

    const nameT = this.add.text(cx - cW / 2 + 18, cy - 30, shop.name, {
      fontFamily: FONT, fontSize: '18px', color: '#FFD700', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    container.add(nameT);

    const info = `🐾 ${t('visit.monsters', { n: String(shop.monsters.length) })}   ·   💰 ${t('visit.sold', { n: String(shop.stats.sold) })}`;
    const infoT = this.add.text(cx - cW / 2 + 18, cy - 4, info, {
      fontFamily: FONT, fontSize: '14px', color: '#AAAAEE',
    }).setOrigin(0, 0.5);
    container.add(infoT);

    const agoT = this.add.text(cx - cW / 2 + 18, cy + 28, _formatAgo(shop.updatedAt), {
      fontFamily: FONT, fontSize: '12px', color: '#555577',
    }).setOrigin(0, 0.5);
    container.add(agoT);

    const btn = makeButton(this, cx + cW / 2 - 68, cy, 110, 42, t('visit.viewShop'), 0x1A4A8A, () => {
      this._showDetail(shop);
    });
    container.add(btn);
  }

  // ─── DETAIL MODE ──────────────────────────────────────────────

  private _showDetail(shop: PublicShop) {
    const W = 540, H = 960;
    this._clearItems();

    const backBtn = makeButton(this, 52, 50, 86, 40, t('visit.backList'), 0x1A1040, () => {
      this._clearItems();
      const loadT = this.add.text(W / 2, H / 2, t('visit.loading'), {
        fontFamily: FONT, fontSize: '20px', color: '#888888',
      }).setOrigin(0.5).setDepth(10);
      fetchShops().then(shops => {
        if (!this.scene.isActive('VisitScene')) return;
        loadT.destroy();
        this._showList(shops);
      });
    }, 12).setDepth(10);
    this._items.push(backBtn);

    const nameT = this.add.text(W / 2, 50, t('visit.shopOf', { name: shop.name }), {
      fontFamily: FONT, fontSize: '20px', color: '#FFD700',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);
    this._items.push(nameT);

    const statsT = this.add.text(W / 2, 80, `🐾 ${shop.monsters.length}  ·  💰 ${t('visit.sold', { n: String(shop.stats.sold) })}`, {
      fontFamily: FONT, fontSize: '14px', color: '#8888AA',
    }).setOrigin(0.5).setDepth(10);
    this._items.push(statsT);

    if (shop.monsters.length === 0) {
      const emptyT = this.add.text(W / 2, H / 2, t('visit.noMonsters'), {
        fontFamily: FONT, fontSize: '18px', color: '#555555', align: 'center',
      }).setOrigin(0.5).setDepth(10);
      this._items.push(emptyT);
      return;
    }

    // Preload monster textures synchronously (SVG fallback)
    shop.monsters.forEach(m => {
      makeMonsterTexture(this, { speciesId: m.speciesId, variantIndex: m.variantIndex } as unknown as Monster);
    });

    const VIEW_TOP = 100, VIEW_H = H - VIEW_TOP - 20;
    const COLS = 2, CARD_W = 242, CARD_H = 130, GAP = 10;
    const offsetX = (W - (COLS * CARD_W + (COLS - 1) * GAP)) / 2;

    this._buildScrollable(VIEW_TOP, VIEW_H, container => {
      let totalH = 0;
      shop.monsters.forEach((m, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const cx = offsetX + col * (CARD_W + GAP) + CARD_W / 2;
        const cy = GAP + CARD_H / 2 + row * (CARD_H + GAP);
        totalH = cy + CARD_H / 2 + GAP;
        this._makeMonsterCard(m, cx, cy, CARD_W, CARD_H, container);
      });
      return totalH;
    });
  }

  private _makeMonsterCard(
    m: PublicMonster, cx: number, cy: number,
    cW: number, cH: number,
    container: Phaser.GameObjects.Container,
  ) {
    const sp = SPECIES[m.speciesId];

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.3);
    bg.fillRoundedRect(cx - cW / 2, cy - cH / 2, cW, cH, 10);
    bg.fillStyle(0x08122A, 0.88);
    bg.fillRoundedRect(cx - cW / 2 + 1, cy - cH / 2 + 1, cW - 2, cH - 2, 9);
    bg.lineStyle(1, 0x253666, 0.7);
    bg.strokeRoundedRect(cx - cW / 2 + 1, cy - cH / 2 + 1, cW - 2, cH - 2, 9);
    container.add(bg);

    const key = `mon_${m.speciesId}_${m.variantIndex}`;
    if (this.textures.exists(key)) {
      const img = this.add.image(cx - cW / 2 + 50, cy, key).setDisplaySize(76, 76);
      container.add(img);
    }

    const displayName = m.nickname || sp?.name || '???';
    const nameT = this.add.text(cx - cW / 2 + 102, cy - 40, `${displayName}  Lv${m.level}`, {
      fontFamily: FONT, fontSize: '13px', color: '#EEEEFF', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    container.add(nameT);

    if (m.trait) {
      const traitT = this.add.text(cx - cW / 2 + 102, cy - 20, `✦ ${m.trait}`, {
        fontFamily: FONT, fontSize: '11px', color: '#FFD580',
      }).setOrigin(0, 0.5);
      container.add(traitT);
    }

    // Happiness bar
    const barW = 112, barH = 7, barX = cx - cW / 2 + 102, barY = cy + 2;
    const hapG = this.add.graphics();
    hapG.fillStyle(0x222244, 1);
    hapG.fillRoundedRect(barX, barY, barW, barH, 3);
    const hapColor = m.happiness > 70 ? 0x44CC55 : m.happiness > 40 ? 0xFF9900 : 0xFF3344;
    hapG.fillStyle(hapColor, 1);
    hapG.fillRoundedRect(barX, barY, Math.max(3, Math.round(barW * m.happiness / 100)), barH, 3);
    container.add(hapG);

    const hapT = this.add.text(barX, barY + 14, `❤️ ${m.happiness}%`, {
      fontFamily: FONT, fontSize: '11px', color: '#9999BB',
    }).setOrigin(0, 0);
    container.add(hapT);

    // Habitat badge
    const habBg = this.add.graphics();
    habBg.fillStyle(HAB_COLOR[m.habitatType] ?? 0x333333, 1);
    habBg.fillRoundedRect(barX, barY + 32, 58, 18, 5);
    container.add(habBg);

    const habT = this.add.text(barX + 29, barY + 41, m.habitatType, {
      fontFamily: FONT, fontSize: '10px', color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    container.add(habT);
  }

  // ─── SCROLL HELPER ────────────────────────────────────────────

  private _buildScrollable(
    viewTop: number,
    viewH: number,
    populate: (container: Phaser.GameObjects.Container) => number,
  ) {
    const W = 540;

    const container = this.add.container(0, viewTop).setDepth(5);
    this._items.push(container);

    const maskGfx = this.add.graphics();
    maskGfx.fillStyle(0xffffff);
    maskGfx.fillRect(0, viewTop, W, viewH);
    container.setMask(maskGfx.createGeometryMask());
    maskGfx.setVisible(false);
    this._items.push(maskGfx);

    const contentH = populate(container);
    const maxScroll = Math.max(0, contentH - viewH);
    if (maxScroll <= 0) return;

    let startPY = 0, startCY = viewTop, hasMoved = false;

    const onDown = (p: Phaser.Input.Pointer) => {
      startPY = p.y;
      startCY = container.y;
      hasMoved = false;
    };
    const onMove = (p: Phaser.Input.Pointer) => {
      if (!p.isDown) return;
      if (Math.abs(p.y - startPY) > 5) hasMoved = true;
      if (!hasMoved) return;
      const ny = startCY + (p.y - startPY);
      container.y = Math.max(viewTop - maxScroll, Math.min(viewTop, ny));
    };

    this.input.on('pointerdown', onDown);
    this.input.on('pointermove', onMove);

    this._scrollCleanup = () => {
      this.input.off('pointerdown', onDown);
      this.input.off('pointermove', onMove);
    };
  }
}

function _formatAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const isTh = currentLang() === 'th';
  if (mins < 2)  return isTh ? 'เพิ่งออนไลน์' : 'just now';
  if (mins < 60) return isTh ? `${mins} น. ที่แล้ว` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return isTh ? `${hrs} ชม. ที่แล้ว` : `${hrs}h ago`;
  return isTh ? `${Math.floor(hrs / 24)} วันที่แล้ว` : `${Math.floor(hrs / 24)}d ago`;
}
