import Phaser from 'phaser';
import { FONT } from '../utils';
import { t } from '../i18n';
import { makeButton } from '../ui/Button';

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
  ];
}

export class HowToPlay extends Phaser.Scene {
  private _page = 0;
  private _contentGroup!: Phaser.GameObjects.Group;
  private _pageIndicator!: Phaser.GameObjects.Text;

  constructor() { super({ key: 'HowToPlay' }); }

  create() {
    const W = this.scale.width, H = this.scale.height;

    const overlay = this.add.graphics().setDepth(0);
    overlay.fillStyle(0x000000, 0.88);
    overlay.fillRect(0, 0, W, H);
    overlay.setInteractive();

    const panelW = W - 40, panelH = H - 200;
    const panelX = 20, panelY = 90;

    const panel = this.add.graphics().setDepth(1);
    panel.fillStyle(0x0d0828, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 20);
    panel.lineStyle(2, 0x6040cc, 0.9);
    panel.strokeRoundedRect(panelX, panelY, panelW, panelH, 20);

    this.add.text(W / 2, panelY + 26, t('howto.title'), {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(2);

    this._pageIndicator = this.add.text(W / 2, panelY + 50, '1 / 4', {
      fontFamily: FONT, fontSize: '12px', color: '#555588',
    }).setOrigin(0.5).setDepth(2);

    this._contentGroup = this.add.group();
    this._renderPage(W, panelY, panelW, panelH);

    const btnY = H - 76;
    makeButton(this, 80, btnY, 110, 48, t('btn.prev'), 0x1a1040, () => {
      if (this._page > 0) { this._page--; this._refresh(W, panelY, panelW, panelH); }
    }, 14).setDepth(3);

    makeButton(this, W / 2, btnY, 140, 52, t('btn.gotIt'), 0x2a1560, () => {
      this.scene.stop();
    }, 16).setDepth(3);

    makeButton(this, W - 80, btnY, 110, 48, t('btn.next'), 0x1a1040, () => {
      if (this._page < getPages().length - 1) { this._page++; this._refresh(W, panelY, panelW, panelH); }
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

    p.lines.forEach((line, i) => {
      this._contentGroup.add(this.add.text(cx, titleY + 52 + i * 54, line, {
        fontFamily: FONT, fontSize: '15px', color: '#ccccdd',
        align: 'center', wordWrap: { width: panelW - 48 },
      }).setOrigin(0.5).setDepth(2));
    });
  }
}
