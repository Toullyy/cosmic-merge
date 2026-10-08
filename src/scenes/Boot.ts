import Phaser from 'phaser';
import { Game, store } from '../utils';
import { DECAY, newState, generateMerchantStock, MERCHANT_REFRESH_MS, TANK_CAPACITY, randomBuyer } from '../data';
import type { GameState } from '../types';

export class Boot extends Phaser.Scene {
  constructor() { super({ key: 'Boot' }); }

  create() {
    const saved = store.getJSON<GameState>('mps_state', null);
    if (saved && saved.version === 1) {
      Game.state = saved;
      if (!Game.state.stats.discovered) {
        Game.state.stats.discovered = [];
        Game.state.monsters.forEach(m => {
          if (!Game.state!.stats.discovered.includes(m.speciesId))
            Game.state!.stats.discovered.push(m.speciesId);
        });
      }
      if (!Game.state.listings) Game.state.listings = [];
      if (!Game.state.merchantStock || !Game.state.merchantStock.length) {
        Game.state.merchantStock = generateMerchantStock();
        Game.state.merchantRefreshAt = Date.now() + MERCHANT_REFRESH_MS;
      }
      // migrate tanks: give enough tanks to cover existing monsters
      if (!Game.state.tanks) {
        const calcTanks = (h: string) => {
          const cnt = Game.state!.monsters.filter(m => m.habitatType === h).length;
          return Math.max(1, Math.ceil(cnt / TANK_CAPACITY));
        };
        Game.state.tanks = {
          dirt:    calcTanks('dirt'),
          grass:   calcTanks('grass'),
          aquatic: calcTanks('aquatic'),
        } as any;
      }
      if (!Game.state.newDiscoveries) Game.state.newDiscoveries = [];
      // migrate existing listings — add buyer if missing
      Game.state.listings.forEach(l => {
        if (!l.buyerName) {
          const b = randomBuyer();
          l.buyerName = b.name;
          l.buyerJob  = b.job;
        }
      });
      reconcileOfflineTime(Game.state);
    } else {
      Game.state = newState();
      store.setJSON('mps_state', Game.state);
    }
    registerVisibilityHandler();
    this.scene.start('Hub');
  }
}

function reconcileOfflineTime(state: GameState) {
  const now = Date.now();
  const elapsed = Math.min(now - (state.lastTickAt ?? now), 7 * 24 * 3600000);
  const hours = elapsed / 3600000;
  if (hours < 0.001) return;
  state.monsters.forEach(mon => {
    mon.happiness   = Math.max(0, mon.happiness   + DECAY.happiness   * hours);
    mon.hunger      = Math.max(0, mon.hunger      + DECAY.hunger      * hours);
    mon.cleanliness = Math.max(0, mon.cleanliness + DECAY.cleanliness * hours);
  });
  state.lastTickAt = now;
  store.setJSON('mps_state', state);
}

let _visibilityRegistered = false;
function registerVisibilityHandler() {
  if (_visibilityRegistered) return;
  _visibilityRegistered = true;
  document.addEventListener('visibilitychange', () => {
    if (!Game.state) return;
    if (document.visibilityState === 'hidden') {
      Game.state.lastTickAt = Date.now();
      store.setJSON('mps_state', Game.state);
    } else {
      reconcileOfflineTime(Game.state);
      const hub = Game.phaser?.scene.getScene('Hub') as any;
      if (hub && hub.scene.isActive()) hub.refreshAll();
    }
  });
}
