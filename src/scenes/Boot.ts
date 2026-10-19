import Phaser from 'phaser';
import { Game, store, getNewAchievements } from '../utils';
import { DECAY, BOWL_EAT_RATE, newState, generateMerchantStock, MERCHANT_REFRESH_MS, TANK_CAPACITY, randomBuyer, VISITOR_INTERVAL_MS, checkAndUpdateVisitor, generateDailyQuests, getDecayMult, TRAITS } from '../data';
import { preloadMonsterTexture } from '../MonsterRenderer';
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
      // migrate tanks: ensure each unlocked habitat has at least 4 slots
      if (!Game.state.tanks) {
        Game.state.tanks = { dirt: 0, grass: 0, aquatic: 0 } as any;
      }
      (['dirt', 'grass', 'aquatic'] as const).forEach(h => {
        const unlocked = Game.state!.habitats[h].unlocked;
        const minSlots = unlocked ? 4 : 0;
        if ((Game.state!.tanks![h] ?? 0) < minSlots) {
          Game.state!.tanks![h] = minSlots;
        }
      });
      if (!Game.state.newDiscoveries) Game.state.newDiscoveries = [];
      // give default toy+tool to monsters that don't have one
      Game.state.monsters.forEach(m => {
        if (!m.ownedToy)  m.ownedToy  = 'yarn';
        if (!m.ownedTool) m.ownedTool = 'cloth';
      });
      if (Game.state.diamonds === undefined) Game.state.diamonds = 0;
      if (!Game.state.stats.goldenDiscovered) Game.state.stats.goldenDiscovered = [];
      // migrate existing listings — add buyer if missing
      Game.state.listings.forEach(l => {
        if (!l.buyerName) {
          const b = randomBuyer();
          l.buyerName = b.name;
          l.buyerJob  = b.job;
        }
      });
      // migrate decorations to string[] if needed
      (['dirt', 'grass', 'aquatic'] as const).forEach(h => {
        if (!Array.isArray(Game.state!.habitats[h].decorations)) {
          Game.state!.habitats[h].decorations = [];
        }
      });
      // visitor defaults
      if (Game.state.visitorNextAt === undefined) {
        Game.state.visitorNextAt = Date.now() + VISITOR_INTERVAL_MS;
      }
      checkAndUpdateVisitor(Game.state);
      // daily quests
      const now2 = Date.now();
      if (!Game.state.quests || !Game.state.questResetAt || now2 >= Game.state.questResetAt) {
        Game.state.quests = generateDailyQuests();
        const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
        Game.state.questResetAt = midnight.getTime();
      }
      // assign trait to monsters that don't have one; initialise bowl
      Game.state.monsters.forEach(m => {
        if (!m.trait) m.trait = TRAITS[Math.floor(Math.random() * TRAITS.length)].id;
        if (m.bowl === undefined) m.bowl = null;
      });
      // initialize achievements + stats counters
      if (!Game.state.achievements) Game.state.achievements = [];
      if (Game.state.stats.questsCompleted === undefined) Game.state.stats.questsCompleted = 0;
      if (Game.state.stats.visitorSales === undefined) Game.state.stats.visitorSales = 0;
      reconcileOfflineTime(Game.state);
      // retroactive achievement check (silent — no popups, just awards diamonds for past play)
      getNewAchievements(Game.state);
    } else {
      Game.state = newState();
      store.setJSON('mps_state', Game.state);
    }
    registerVisibilityHandler();

    // Hide boot splash once game is ready
    const bootEl = document.getElementById('boot');
    if (bootEl) bootEl.style.display = 'none';

    // Preload all monster SVG textures before showing Hub
    const monsters = Game.state!.monsters;
    if (monsters.length === 0) {
      this.scene.start('Hub');
    } else {
      Promise.all(monsters.map(m => preloadMonsterTexture(this, m))).then(() => {
        this.scene.start('Hub');
      });
    }
  }
}

function reconcileOfflineTime(state: GameState) {
  const now = Date.now();
  const elapsed = Math.min(now - (state.lastTickAt ?? now), 7 * 24 * 3600000);
  const hours = elapsed / 3600000;
  if (hours < 0.001) return;
  state.monsters.forEach(mon => {
    const decayMult = getDecayMult(state, mon.habitatType);
    const trait = TRAITS.find(t => t.id === mon.trait);
    const hMod  = (trait?.decayMod?.happiness    ?? 1) * decayMult;
    const nuMod = (trait?.decayMod?.hunger        ?? 1) * decayMult;
    const cMod  = (trait?.decayMod?.cleanliness   ?? 1) * decayMult;
    mon.happiness   = Math.max(0, mon.happiness   + DECAY.happiness   * hours * hMod);
    mon.cleanliness = Math.max(0, mon.cleanliness + DECAY.cleanliness * hours * cMod);
    if (mon.bowl && mon.bowl.remaining > 0) {
      const ate = Math.min(mon.bowl.remaining, BOWL_EAT_RATE * hours);
      mon.bowl.remaining -= ate;
      if (mon.bowl.remaining < 0.01) mon.bowl = null;
      mon.hunger = Math.max(0, Math.min(100, mon.hunger + ate + DECAY.hunger * hours * nuMod));
    } else {
      mon.bowl = null;
      mon.hunger = Math.max(0, mon.hunger + DECAY.hunger * hours * nuMod);
    }
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
      checkAndUpdateVisitor(Game.state);
      const hub = Game.phaser?.scene.getScene('Hub') as any;
      if (hub && hub.scene.isActive()) hub.refreshAll();
    }
  });
}
