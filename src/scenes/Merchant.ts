import Phaser from 'phaser';
import { Game, FONT, store, sfx } from '../utils';
import { CATALOG, HABITATS, newEgg, SPECIES, generateMerchantStock, MERCHANT_REFRESH_MS } from '../data';
import { shiftHue } from '../MonsterRenderer';
import { makeButton } from '../ui/Button';
import { showToast } from '../ui/Toast';

export class Merchant extends Phaser.Scene {
  private _filter: string = 'dirt';
  private _filterGroup!: Phaser.GameObjects.Group;
  private _gridGroup!: Phaser.GameObjects.Group;
  private _coinTxt!: Phaser.GameObjects.Text;
  private _refreshTxt!: Phaser.GameObjects.Text;
  private _refreshTimer: Phaser.Time.TimerEvent | null = null;

  constructor() { super({ key: 'Merchant' }); }

  create() {
    sfx.unlock();
    const W = this.scale.width, H = this.scale.height;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0d0618, 0x0d0618, 0x1a0a2e, 0x1a0a2e, 1);
    bg.fillRect(0, 0, W, H);

    this.add.text(W/2, 42, '🛒 Monster Egg Shop', {
      fontFamily: FONT, fontSize: '24px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    const coinBg = this.add.graphics();
    coinBg.fillStyle(0x00000066, 1);
    coinBg.fillRoundedRect(10, 10, 150, 40, 10);
    this.add.text(28, 30, '⬡', { fontFamily: FONT, fontSize: '20px', color: '#FFD700' }).setOrigin(0, 0.5);
    this._coinTxt = this.add.text(52, 30, String(Game.state!.coins), {
      fontFamily: FONT, fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5);

    makeButton(this, W - 70, 30, 110, 40, '← Back', 0x2a1560, () => {
      this.scene.start('Hub');
    }, 15);

    // ensure stock is initialised
    if (!Game.state!.merchantStock?.length || Date.now() >= Game.state!.merchantRefreshAt) {
      Game.state!.merchantStock = generateMerchantStock();
      Game.state!.merchantRefreshAt = Date.now() + MERCHANT_REFRESH_MS;
      store.setJSON('mps_state', Game.state);
    }

    this._refreshTxt = this.add.text(W/2, 66, this._refreshLabel(), {
      fontFamily: FONT, fontSize: '12px', color: '#7777aa', align: 'center',
    }).setOrigin(0.5);

    this._filter = 'dirt';
    this._filterGroup = this.add.group();
    this._buildFilterTabs(W);
    this._gridGroup = this.add.group();
    this._buildGrid(W, H);
    this._startRefreshTimer();
  }

  private _refreshLabel(): string {
    const remaining = Math.max(0, Game.state!.merchantRefreshAt - Date.now());
    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    return 'Stock refreshes in ' + mins + ':' + String(secs).padStart(2, '0');
  }

  private _startRefreshTimer() {
    if (this._refreshTimer) this._refreshTimer.remove();
    this._refreshTimer = this.time.addEvent({
      delay: 1000, loop: true, callback: () => {
        if (Date.now() >= Game.state!.merchantRefreshAt) {
          Game.state!.merchantStock = generateMerchantStock();
          Game.state!.merchantRefreshAt = Date.now() + MERCHANT_REFRESH_MS;
          store.setJSON('mps_state', Game.state);
          this._buildGrid(this.scale.width, this.scale.height);
          this._refreshTxt.setText('New stock! Refreshes in 30:00');
        } else {
          this._refreshTxt.setText(this._refreshLabel());
        }
      },
    });
  }

  private _buildFilterTabs(W: number) {
    const filters: string[] = ['dirt', 'grass', 'aquatic'];
    const labels: Record<string, string> = { dirt:'⛰ Dirt', grass:'🌿 Grass', aquatic:'🌊 Aqua' };
    const tabW = (W - 20) / 3;
    filters.forEach((f, i) => {
      const x = 10 + tabW * i;
      const g = this.add.graphics();
      const lbl = this.add.text(x + tabW/2, 94, labels[f], {
        fontFamily: FONT, fontSize: '15px', color: '#aaaaaa',
      }).setOrigin(0.5);
      this._filterGroup.addMultiple([g, lbl]);
      (g as any)._filterKey = f;
      (lbl as any)._filterKey = f;
      const zone = this.add.zone(x + tabW/2, 94, tabW - 4, 36).setInteractive();
      zone.on('pointerdown', () => {
        this._filter = f;
        this._buildGrid(this.scale.width, this.scale.height);
        this._updateFilterTabs();
      });
      this._filterGroup.add(zone);
    });
    this._updateFilterTabs();
  }

  private _updateFilterTabs() {
    const W = this.scale.width;
    const filters = ['dirt', 'grass', 'aquatic'];
    const tabW = (W - 20) / 3;
    this._filterGroup.getChildren().forEach(child => {
      const key = (child as any)._filterKey;
      if (!key) return;
      const isActive = key === this._filter;
      if (child.type === 'Graphics') {
        const g = child as Phaser.GameObjects.Graphics;
        g.clear();
        g.fillStyle(isActive ? 0x4a2080 : 0x1e1040, isActive ? 1 : 0.6);
        const i = filters.indexOf(key);
        g.fillRoundedRect(10 + tabW*i + 2, 78, tabW - 4, 32, 8);
      } else if (child.type === 'Text') {
        (child as Phaser.GameObjects.Text).setStyle({ color: isActive ? '#ffffff' : '#777777' });
      }
    });
  }

  private _buildGrid(W: number, H: number) {
    this._gridGroup.clear(true, true);

    const stockIds = Game.state!.merchantStock ?? [];
    const filtered = stockIds
      .map(id => SPECIES[id])
      .filter(sp => sp && sp.habitat === this._filter);

    if (filtered.length === 0) {
      const noStock = this.add.text(W/2, 420, 'No ' + this._filter + ' species\nin stock right now.\nCheck back after refresh!', {
        fontFamily: FONT, fontSize: '16px', color: '#554488', align: 'center',
      }).setOrigin(0.5);
      this._gridGroup.add(noStock);
      return;
    }

    const cols = 2, cardW = 210, cardH = 190, gapX = (W - cols*cardW) / (cols+1), startY = 128;

    filtered.forEach((sp, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = gapX + cardW/2 + col*(cardW + gapX);
      const cy = startY + 20 + row*(cardH + 16) + cardH/2;
      const unlocked = Game.state!.habitats[sp.habitat].unlocked;

      const cardBg = this.add.graphics();
      cardBg.fillStyle(unlocked ? 0x1a0f30 : 0x0d0820, 1);
      cardBg.fillRoundedRect(cx - cardW/2, cy - cardH/2, cardW, cardH, 14);
      cardBg.lineStyle(2, HABITATS[sp.habitat].wallColor, unlocked ? 0.7 : 0.25);
      cardBg.strokeRoundedRect(cx - cardW/2, cy - cardH/2, cardW, cardH, 14);
      this._gridGroup.add(cardBg);

      const eggG = this.add.graphics();
      const hueShift = ((sp.id * 13) % 12 - 6) * 15;
      const eggColor = shiftHue(sp.baseColor, hueShift);
      if (unlocked) {
        eggG.fillStyle(eggColor, 1);
        eggG.fillEllipse(cx, cy - 38, 46, 58);
        eggG.fillStyle(0xffffff, 0.22);
        eggG.fillEllipse(cx - 7, cy - 49, 14, 20);
      } else {
        eggG.fillStyle(0x333333, 1);
        eggG.fillEllipse(cx, cy - 38, 46, 58);
      }
      this._gridGroup.add(eggG);

      this._gridGroup.add(this.add.text(cx, cy, unlocked ? sp.name : '???', {
        fontFamily: FONT, fontSize: '15px', fontStyle: 'bold',
        color: unlocked ? '#ffffff' : '#555555', align: 'center',
      }).setOrigin(0.5));
      this._gridGroup.add(this.add.text(cx, cy + 22, '⏱ ' + sp.hatchHours + 'h', {
        fontFamily: FONT, fontSize: '13px', color: unlocked ? '#8888cc' : '#333355',
      }).setOrigin(0.5));

      const btnLabel = unlocked ? ('Buy  ' + sp.price + '⬡') : (HABITATS[sp.habitat].unlockCost + '⬡ Unlock');
      const btnCol = unlocked ? 0x2a5030 : 0x251040;
      const btn = makeButton(this, cx, cy + 66, 160, 36, btnLabel, btnCol, () => {
        this._handleBuy(sp.id, unlocked);
      }, 14);
      btn.setAlpha(unlocked ? 1 : 0.55);
      this._gridGroup.add(btn);
    });
  }

  private _handleBuy(spId: number, unlocked: boolean) {
    const sp = SPECIES[spId];
    const state = Game.state!;
    if (!unlocked) {
      const cost = HABITATS[sp.habitat].unlockCost;
      if (state.coins < cost) {
        showToast(this, 'Need ' + cost + '⬡ to unlock ' + HABITATS[sp.habitat].label, '#ff9999');
        return;
      }
      state.coins -= cost;
      state.habitats[sp.habitat].unlocked = true;
      store.setJSON('mps_state', state);
      this._coinTxt.setText(String(state.coins));
      sfx.buy();
      showToast(this, HABITATS[sp.habitat].label + ' unlocked!', '#aaffaa');
      this._buildGrid(this.scale.width, this.scale.height);
      return;
    }
    if (state.coins < sp.price) {
      showToast(this, 'Not enough coins! Need ' + sp.price + '⬡', '#ff9999');
      return;
    }
    state.coins -= sp.price;
    const vi = Math.floor(Math.random() * 100);
    const egg = newEgg(sp.id, vi, 'merchant');
    state.eggs.push(egg);
    store.setJSON('mps_state', state);
    this._coinTxt.setText(String(state.coins));
    sfx.buy();
    showToast(this, sp.name + ' egg added! Hatch in ' + sp.hatchHours + 'h', '#aaffaa');
    this._buildGrid(this.scale.width, this.scale.height);
  }
}
