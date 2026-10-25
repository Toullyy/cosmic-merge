import Phaser from 'phaser';
import { FONT } from '../utils';
import { t } from '../i18n';
import { TRAITS } from '../data';
import { makeButton } from '../ui/Button';

const TRAIT_PAGE = 4;

function getPages() {
  return [
    {
      title: t('howto.page0.title'),
      lines: [t('howto.page0.l0'), t('howto.page0.l1'), t('howto.page0.l2'), t('howto.page0.l3')],
    },
    {
      title: t('howto.page1.title'),
      lines: [t('howto.page1.l0'), t('howto.page1.l1'), t('howto.page1.l2'), t('howto.page1.l3'), t('howto.page1.l4')],
    },
    {
      title: t('howto.page2.title'),
      lines: [t('howto.page2.l0'), t('howto.page2.l1'), t('howto.page2.l2'), t('howto.page2.l3')],
    },
    {
      title: t('howto.page3.title'),
      lines: [t('howto.page3.l0'), t('howto.page3.l1'), t('howto.page3.l2'), t('howto.page3.l3')],
    },
    {
      title: t('howto.page4.title'),
      lines: [], // rendered specially as trait grid
    },
  ];
}

const PAGE_ICONS = ['🐣', '🍽', '🧬', '💰', '⚡'];
const TRAIT_COLORS: Record<string, number> = {
  greedy: 0xFF8844, lazy: 0x8888CC, lucky: 0x44CC44,
  fierce: 0xFF4422, playful: 0x44CCFF, pristine: 0xFFEE44,
};

export class HowToPlay extends Phaser.Scene {
  private _page = 0;
  private _contentGroup!: Phaser.GameObjects.Group;
  private _dotG!: Phaser.GameObjects.Graphics;
  private _panelY = 90;
  private _panelW = 460;
  private _panelH = 680;
  private _W = 540;

  constructor() { super({ key: 'HowToPlay' }); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this._W = W;
    this._panelW = W - 40;
    this._panelH = H - 200;
    const panelX = 20, panelY = this._panelY;

    // ── Starfield behind overlay ───────────────────────────────────────────
    const stars = this.add.graphics().setDepth(0);
    stars.fillStyle(0x040112, 1);
    stars.fillRect(0, 0, W, H);
    for (let i = 0; i < 50; i++) {
      const sx = Math.random() * W, sy = Math.random() * H;
      stars.fillStyle(0xFFFFFF, 0.12 + Math.random() * 0.55);
      stars.fillCircle(sx, sy, 0.5 + Math.random() * 1.3);
    }
    // Nebula puffs
    stars.fillStyle(0x6622BB, 0.05); stars.fillCircle(W * 0.2, H * 0.25, 130);
    stars.fillStyle(0x2244BB, 0.04); stars.fillCircle(W * 0.8, H * 0.70, 110);
    stars.fillStyle(0x882299, 0.03); stars.fillCircle(W * 0.5, H * 0.5,  140);

    // Twinkling stars
    for (let i = 0; i < 18; i++) {
      const tg = this.add.graphics().setDepth(0);
      const tx = Math.random() * W, ty = Math.random() * H;
      tg.fillStyle(0xFFFFFF, 0.65); tg.fillCircle(tx, ty, 0.8 + Math.random());
      this.tweens.add({
        targets: tg, alpha: { from: 0.20, to: 0.90 },
        duration: 900 + Math.random() * 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut',
        delay: Math.random() * 1200,
      });
    }

    // Dark overlay
    const overlay = this.add.graphics().setDepth(1);
    overlay.fillStyle(0x000000, 0.72);
    overlay.fillRect(0, 0, W, H);
    overlay.setInteractive();

    // ── Panel ──────────────────────────────────────────────────────────────
    const panel = this.add.graphics().setDepth(2);
    panel.fillStyle(0x0d0828, 1);
    panel.fillRoundedRect(panelX, panelY, this._panelW, this._panelH, 20);
    panel.lineStyle(2, 0x6040cc, 0.9);
    panel.strokeRoundedRect(panelX, panelY, this._panelW, this._panelH, 20);
    panel.fillStyle(0x4020AA, 0.08);
    panel.fillRoundedRect(panelX + 4, panelY + 4, this._panelW - 8, 60, { tl: 16, tr: 16, bl: 0, br: 0 });

    this.add.text(W / 2, panelY + 26, t('howto.title'), {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(3);

    // ── Dot indicator (replaces "1 / 5" text) ─────────────────────────────
    this._dotG = this.add.graphics().setDepth(3);
    this._drawDots();

    // ── Content group ──────────────────────────────────────────────────────
    this._contentGroup = this.add.group();
    this._renderPage(W, panelY, this._panelW, this._panelH);

    // ── Nav buttons ────────────────────────────────────────────────────────
    const btnY = H - 76;
    makeButton(this, 80, btnY, 110, 48, t('btn.prev'), 0x1a1040, () => {
      if (this._page > 0) { this._page--; this._refresh(panelY); }
    }, 14).setDepth(4);

    makeButton(this, W / 2, btnY, 140, 52, t('btn.gotIt'), 0x2a1560, () => {
      this.scene.stop();
    }, 16).setDepth(4);

    makeButton(this, W - 80, btnY, 110, 48, t('btn.next'), 0x1a1040, () => {
      if (this._page < getPages().length - 1) { this._page++; this._refresh(panelY); }
    }, 14).setDepth(4);
  }

  // ── Dot indicator ────────────────────────────────────────────────────────

  private _drawDots() {
    const pages = getPages();
    const dotGap = 16;
    const startX = this._W / 2 - (pages.length - 1) * dotGap / 2;
    const dy = this._panelY + 52;
    this._dotG.clear();
    pages.forEach((_, i) => {
      const dx = startX + i * dotGap;
      if (i === this._page) {
        this._dotG.fillStyle(0xCC88FF, 1);
        this._dotG.fillCircle(dx, dy, 5);
        this._dotG.fillStyle(0xAA66FF, 0.30);
        this._dotG.fillCircle(dx, dy, 9);
      } else {
        this._dotG.lineStyle(1.5, 0x554488, 0.75);
        this._dotG.strokeCircle(dx, dy, 4);
      }
    });
  }

  // ── Page refresh with fade ────────────────────────────────────────────────

  private _refresh(panelY: number) {
    this._drawDots();
    const children = [...this._contentGroup.getChildren()];
    if (children.length === 0) {
      this._renderPage(this._W, panelY, this._panelW, this._panelH);
      return;
    }
    this.tweens.add({
      targets: children, alpha: 0, duration: 110, ease: 'Sine.In',
      onComplete: () => {
        this._contentGroup.clear(true, true);
        this._renderPage(this._W, panelY, this._panelW, this._panelH);
        const fresh = this._contentGroup.getChildren();
        fresh.forEach(c => (c as any).setAlpha(0));
        this.tweens.add({ targets: [...fresh], alpha: 1, duration: 180, ease: 'Sine.Out' });
      },
    });
  }

  // ── Page content ─────────────────────────────────────────────────────────

  private _renderPage(W: number, panelY: number, panelW: number, _panelH: number) {
    const p = getPages()[this._page];
    const cx = W / 2;

    // Large page icon
    this._contentGroup.add(this.add.text(cx, panelY + 84, PAGE_ICONS[this._page] ?? '✨', {
      fontFamily: FONT, fontSize: '40px',
    }).setOrigin(0.5).setDepth(3));

    // Page title
    const titleY = panelY + 136;
    this._contentGroup.add(this.add.text(cx, titleY, p.title, {
      fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#aaddff',
    }).setOrigin(0.5).setDepth(3));

    if (this._page === TRAIT_PAGE) {
      this._renderTraitPage(cx, titleY, panelW, panelY);
      return;
    }

    p.lines.forEach((line, i) => {
      this._contentGroup.add(this.add.text(cx, titleY + 52 + i * 54, line, {
        fontFamily: FONT, fontSize: '15px', color: '#ccccdd',
        align: 'center', wordWrap: { width: panelW - 48 },
      }).setOrigin(0.5).setDepth(3));
    });
  }

  private _renderTraitPage(cx: number, titleY: number, panelW: number, panelY: number) {
    TRAITS.forEach((tr, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cardW = (panelW - 60) / 2;
      const cardX = cx - (panelW / 2) + 24 + col * (cardW + 12);
      const cardY = titleY + 44 + row * 100;
      const tc = TRAIT_COLORS[tr.id] ?? 0x8888FF;

      const cardBg = this.add.graphics().setDepth(3);
      cardBg.fillStyle(0x0a0420, 0.85);
      cardBg.fillRoundedRect(cardX, cardY, cardW, 86, 12);
      cardBg.lineStyle(1.5, tc, 0.60);
      cardBg.strokeRoundedRect(cardX, cardY, cardW, 86, 12);
      cardBg.fillStyle(tc, 0.08);
      cardBg.fillRoundedRect(cardX + 2, cardY + 2, cardW - 4, 26, { tl: 10, tr: 10, bl: 0, br: 0 });
      this._contentGroup.add(cardBg);

      this._contentGroup.add(this.add.text(cardX + cardW / 2, cardY + 15, tr.emoji + ' ' + tr.name, {
        fontFamily: FONT, fontSize: '14px', fontStyle: 'bold',
        color: '#' + tc.toString(16).padStart(6, '0'),
      }).setOrigin(0.5).setDepth(4));

      this._contentGroup.add(this.add.text(cardX + cardW / 2, cardY + 54, tr.desc, {
        fontFamily: FONT, fontSize: '11px', color: '#bbbbcc',
        align: 'center', wordWrap: { width: cardW - 16 },
      }).setOrigin(0.5).setDepth(4));
    });

    this._contentGroup.add(this.add.text(cx, panelY + this._panelH - 10, '', {
      fontFamily: FONT, fontSize: '11px', color: '#555577',
    }).setOrigin(0.5).setDepth(3));
  }
}
