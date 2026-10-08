import Phaser from 'phaser';
import { FONT } from '../utils';
import { makeButton } from '../ui/Button';

const PAGES = [
  {
    title: '🥚 Hatching Monsters',
    lines: [
      'Visit the Shop to buy monster eggs.',
      'Eggs hatch over time — rarer species take longer.',
      'Tap a ready egg on the main screen to hatch it.',
      'Watch an ad to hatch instantly!',
    ],
  },
  {
    title: '💛 Caring for Your Monsters',
    lines: [
      'Tap a monster to enter its habitat room.',
      '🍽 Feed — increases hunger & happiness.',
      '🎾 Play — boosts happiness.',
      '🧹 Clean — improves cleanliness.',
      'A happier monster sells for more!',
    ],
  },
  {
    title: '💰 Selling Monsters',
    lines: [
      'Your monster must be Adult (Lv 5+) to list.',
      'Tap "List" to post it for sale.',
      'A buyer arrives in 15 min – 2 hrs.',
      'Collect the sale, or watch an ad to double it!',
    ],
  },
  {
    title: '🧬 Breeding & Collection',
    lines: [
      'Raise 2 monsters to Lv 4+ to unlock breeding.',
      'Breeding can produce rare cross-habitat species!',
      'Collect all 25 species in the Dex.',
      'Buy more tanks (100 G each) to house more monsters.',
    ],
  },
];

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

    this.add.text(W / 2, panelY + 26, '📖 How to Play', {
      fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
    }).setOrigin(0.5).setDepth(2);

    this._pageIndicator = this.add.text(W / 2, panelY + 50, '1 / 4', {
      fontFamily: FONT, fontSize: '12px', color: '#555588',
    }).setOrigin(0.5).setDepth(2);

    this._contentGroup = this.add.group();
    this._renderPage(W, panelY, panelW, panelH);

    const btnY = H - 76;
    makeButton(this, 80, btnY, 110, 48, '◀ Prev', 0x1a1040, () => {
      if (this._page > 0) { this._page--; this._refresh(W, panelY, panelW, panelH); }
    }, 14).setDepth(3);

    makeButton(this, W / 2, btnY, 140, 52, '✓ Got it!', 0x2a1560, () => {
      this.scene.stop();
    }, 16).setDepth(3);

    makeButton(this, W - 80, btnY, 110, 48, 'Next ▶', 0x1a1040, () => {
      if (this._page < PAGES.length - 1) { this._page++; this._refresh(W, panelY, panelW, panelH); }
    }, 14).setDepth(3);
  }

  private _refresh(W: number, panelY: number, panelW: number, panelH: number) {
    this._contentGroup.clear(true, true);
    this._pageIndicator.setText((this._page + 1) + ' / ' + PAGES.length);
    this._renderPage(W, panelY, panelW, panelH);
  }

  private _renderPage(W: number, panelY: number, panelW: number, _panelH: number) {
    const p = PAGES[this._page];
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
