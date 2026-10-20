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

export class HowToPlay extends Phaser.Scene {
  private _page = 0;
  private _contentGroup!: Phaser.GameObjects.Group;
  private _pageIndicator!: Phaser.GameObjects.Text;
  private _panelY = 90;
  private _panelW = 460;
  private _panelH = 680;

  constructor() { super({ key: 'HowToPlay' }); }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this._panelW = W - 40;
    this._panelH = H - 200;

    const overlay = this.add.graphics().setDepth(0);
    overlay.fillStyle(0x000000, 0.88);
    overlay.fillRect(0, 0, W, H);
    overlay.setInteractive();

    const panelX = 20, panelY = this._panelY;

    const panel = this.add.graphics().setDepth(1);
    panel.fillStyle(0x0d0828, 1);
    panel.fillRoundedRect(panelX, panelY, this._panelW, this._panelH, 20);
    panel.lineStyle(2, 0x6040cc, 0.9);
    panel.strokeRoundedRect(panelX, panelY, this._panelW, this._panelH, 20);
    // inner glow at top
    panel.fillStyle(0x4020AA, 0.08);
    panel.fillRoundedRect(panelX + 4, panelY + 4, this._panelW - 8, 60, { tl: 16, tr: 16, bl: 0, br: 0 });

    this.add.text(W / 2, panelY + 26, t('howto.title'), {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(2);

    this._pageIndicator = this.add.text(W / 2, panelY + 50, '1 / 5', {
      fontFamily: FONT, fontSize: '12px', color: '#7766BB',
    }).setOrigin(0.5).setDepth(2);

    this._contentGroup = this.add.group();
    this._renderPage(W, panelY, this._panelW, this._panelH);

    const btnY = H - 76;
    makeButton(this, 80, btnY, 110, 48, t('btn.prev'), 0x1a1040, () => {
      if (this._page > 0) { this._page--; this._refresh(W, panelY, this._panelW, this._panelH); }
    }, 14).setDepth(3);

    makeButton(this, W / 2, btnY, 140, 52, t('btn.gotIt'), 0x2a1560, () => {
      this.scene.stop();
    }, 16).setDepth(3);

    makeButton(this, W - 80, btnY, 110, 48, t('btn.next'), 0x1a1040, () => {
      if (this._page < getPages().length - 1) { this._page++; this._refresh(W, panelY, this._panelW, this._panelH); }
    }, 14).setDepth(3);
  }

  private _refresh(W: number, panelY: number, panelW: number, panelH: number) {
    this._contentGroup.clear(true, true);
    this._pageIndicator.setText((this._page + 1) + ' / ' + getPages().length);
    this._renderPage(W, panelY, panelW, panelH);
  }

  private _renderPage(W: number, panelY: number, panelW: number, _panelH: number) {
    const p = getPages()[this._page];
    const cx = W / 2;
    const titleY = panelY + 80;

    this._contentGroup.add(this.add.text(cx, titleY, p.title, {
      fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#aaddff',
    }).setOrigin(0.5).setDepth(2));

    if (this._page === TRAIT_PAGE) {
      this._renderTraitPage(cx, titleY, panelW, panelY);
      return;
    }

    p.lines.forEach((line, i) => {
      this._contentGroup.add(this.add.text(cx, titleY + 52 + i * 54, line, {
        fontFamily: FONT, fontSize: '15px', color: '#ccccdd',
        align: 'center', wordWrap: { width: panelW - 48 },
      }).setOrigin(0.5).setDepth(2));
    });
  }

  private _renderTraitPage(cx: number, titleY: number, panelW: number, panelY: number) {
    const traitColors: Record<string, number> = {
      greedy: 0xFF8844, lazy: 0x8888CC, lucky: 0x44CC44,
      fierce: 0xFF4422, playful: 0x44CCFF, pristine: 0xFFEE44,
    };

    TRAITS.forEach((tr, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cardW = (panelW - 60) / 2;
      const cardX = cx - (panelW / 2) + 24 + col * (cardW + 12);
      const cardY = titleY + 48 + row * 102;
      const tc = traitColors[tr.id] ?? 0x8888FF;

      const cardBg = this.add.graphics().setDepth(2);
      cardBg.fillStyle(0x0a0420, 0.85);
      cardBg.fillRoundedRect(cardX, cardY, cardW, 90, 12);
      cardBg.lineStyle(1.5, tc, 0.60);
      cardBg.strokeRoundedRect(cardX, cardY, cardW, 90, 12);
      cardBg.fillStyle(tc, 0.08);
      cardBg.fillRoundedRect(cardX + 2, cardY + 2, cardW - 4, 28, { tl: 10, tr: 10, bl: 0, br: 0 });
      this._contentGroup.add(cardBg);

      this._contentGroup.add(this.add.text(cardX + cardW / 2, cardY + 16, tr.emoji + ' ' + tr.name, {
        fontFamily: FONT, fontSize: '15px', fontStyle: 'bold',
        color: '#' + tc.toString(16).padStart(6, '0'),
      }).setOrigin(0.5).setDepth(3));

      this._contentGroup.add(this.add.text(cardX + cardW / 2, cardY + 57, tr.desc, {
        fontFamily: FONT, fontSize: '12px', color: '#bbbbcc',
        align: 'center', wordWrap: { width: cardW - 16 },
      }).setOrigin(0.5).setDepth(3));
    });

    this._contentGroup.add(this.add.text(cx, panelY + this._panelH, '', {
      fontFamily: FONT, fontSize: '11px', color: '#555577',
    }).setOrigin(0.5).setDepth(2));
  }
}
