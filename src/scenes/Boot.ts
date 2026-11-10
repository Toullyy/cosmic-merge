import Phaser from 'phaser';
import { Game, store, getNewAchievements, reconcileOfflineTime, calcShopLevel } from '../utils';
import type { GameState } from '../types';
import { newState, generateMerchantStock, MERCHANT_REFRESH_MS, TANK_CAPACITY, randomBuyer, VISITOR_INTERVAL_MS, checkAndUpdateVisitor, ensureQuestsFresh, TRAITS, SPECIES } from '../data';
import { preloadMonsterTexture } from '../MonsterRenderer';
import { initCloudAuth, loadFromCloud, scheduleSaveToCloud } from '../cloudSync';
import { auth } from '../firebase';
import { scheduleIdleNotifications, clearScheduledNotifications } from '../notifications';

export class Boot extends Phaser.Scene {
  constructor() { super({ key: 'Boot' }); }

  create() {
    const saved = store.getJSON<GameState>('mps_state', null);
    const localTickAt = saved?.lastTickAt ?? 0;
    const awayMs = saved?.lastTickAt ? Math.max(0, Date.now() - saved.lastTickAt) : 0;
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
      // daily + weekly quests (local-midnight / Monday reset)
      ensureQuestsFresh(Game.state);
      // assign trait to monsters that don't have one; initialise bowl
      Game.state.monsters.forEach(m => {
        if (!m.trait) m.trait = TRAITS[Math.floor(Math.random() * TRAITS.length)].id;
        if (m.bowl === undefined) m.bowl = null;
      });
      // initialize achievements + stats counters
      if (!Game.state.achievements) Game.state.achievements = [];
      if (Game.state.stats.questsCompleted === undefined) Game.state.stats.questsCompleted = 0;
      if (Game.state.stats.visitorSales === undefined) Game.state.stats.visitorSales = 0;
      if (Game.state.loginStreak   === undefined) Game.state.loginStreak   = 0;
      if (Game.state.longestStreak === undefined) Game.state.longestStreak = 0;
      if (Game.state.lastLoginDate === undefined) Game.state.lastLoginDate = '';
      if (!Game.state.dailyAdClaimedDate) Game.state.dailyAdClaimedDate = '';
      if (!Game.state.discoveredColors)   Game.state.discoveredColors   = {};
      // gameplay depth migrations
      if (Game.state.moonCrystals === undefined) Game.state.moonCrystals = 0;
      if (!Game.state.habitatMilestones) Game.state.habitatMilestones = { dirt: 0, grass: 0, aquatic: 0 };
      if (!Game.state.speciesSold) Game.state.speciesSold = {};
      if (!Game.state.wheelClaimedDate) Game.state.wheelClaimedDate = '';
      // Retroactive: existing players just sync level, no reward
      if (Game.state.shopLevel === undefined)
        Game.state.shopLevel = calcShopLevel(Game.state.stats.sold);
      // Clear old number-format pendingShopLvPopup from pre-migration saves
      if (typeof Game.state.pendingShopLvPopup === 'number')
        Game.state.pendingShopLvPopup = undefined;
      // monsters: init evolved flag
      Game.state.monsters.forEach(m => {
        if (m.evolved === undefined) m.evolved = false;
      });
      // featured species: pick from week seed if missing/expired
      const _now = Date.now();
      if (!Game.state.featuredSpeciesId || !Game.state.featuredUntil || _now > Game.state.featuredUntil) {
        const _week = Math.floor(_now / (7 * 24 * 3600000));
        Game.state.featuredSpeciesId = (_week * 3 + 7) % 15;
        const _nextSun = new Date(); _nextSun.setDate(_nextSun.getDate() + (7 - _nextSun.getDay()) % 7 || 7); _nextSun.setHours(0, 0, 0, 0);
        Game.state.featuredUntil = _nextSun.getTime();
      }
      // rush hour scheduling
      if (!Game.state.rushHourNextAt) {
        const _d = new Date(); const _h = _d.getHours();
        const _todayNoon = new Date(_d); _todayNoon.setHours(12, 0, 0, 0);
        const _today8pm = new Date(_d); _today8pm.setHours(20, 0, 0, 0);
        if (_h < 12) Game.state.rushHourNextAt = _todayNoon.getTime();
        else if (_h < 20) Game.state.rushHourNextAt = _today8pm.getTime();
        else { const _tmrNoon = new Date(_todayNoon); _tmrNoon.setDate(_tmrNoon.getDate() + 1); Game.state.rushHourNextAt = _tmrNoon.getTime(); }
      }
      // trait collector scheduling (once per week, 24h window)
      if (!Game.state.traitCollectorNextAt) {
        Game.state.traitCollectorNextAt = Date.now() + 2 * 24 * 3600000; // first appearance 2 days after install
      }
      if (!Game.state.hallOfFame) Game.state.hallOfFame = [];
      if (Game.state.visitorSellStreak === undefined) Game.state.visitorSellStreak = 0;
      // deduplicate monsters by id (fix for users who got duplicates from double-tap bug)
      const seenIds = new Set<string>();
      Game.state.monsters = Game.state.monsters.filter(m => {
        if (seenIds.has(m.id)) return false;
        seenIds.add(m.id);
        return true;
      });
      reconcileOfflineTime(Game.state);
      if (awayMs >= 5 * 60 * 1000) {
        // Offline catch-up gift: if away 4+ hours and have monsters, one monster saved some coins
        let giftCoins: number | undefined;
        let giftMonsterName: string | undefined;
        if (awayMs >= 4 * 3600000 && Game.state.monsters.length > 0) {
          const donor = Game.state.monsters[Math.floor(Math.random() * Game.state.monsters.length)];
          giftCoins = 20 + Math.floor(Math.random() * 31); // 20–50 coins
          Game.state.coins += giftCoins;
          store.setJSON('mps_state', Game.state);
          giftMonsterName = donor.nickname ?? (TRAITS.find(t => t.id === donor.trait)?.emoji ?? '🐾') + ' ' + SPECIES[donor.speciesId].name;
        }
        Game.offlineSummary = {
          elapsedMs: awayMs,
          readyEggs: Game.state.eggs.filter(e => e.hatchEndAt <= Date.now()).length,
          visitorWaiting: !!Game.state.visitorExpiresAt && Game.state.visitorExpiresAt > Date.now(),
          giftCoins,
          giftMonsterName,
        };
      }
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
      this.scene.start('TitleScreen');
    } else {
      Promise.all(monsters.map(m => preloadMonsterTexture(this, m))).then(() => {
        this.scene.start('TitleScreen');
      });
    }

    // Background cloud sync — non-blocking, does not affect startup
    const bootTime = Date.now();
    initCloudAuth().then(async () => {
      Game.uid = auth.currentUser?.uid ?? null;
      Game.isAnonymous = auth.currentUser?.isAnonymous ?? true;
      const cloud = await loadFromCloud();
      // Only restore if the cloud save is newer than the local save we loaded at
      // boot, and we haven't been in-session long enough to accumulate mutations.
      if (
        cloud?.state.version === 1 &&
        cloud.savedAt > localTickAt &&
        Date.now() - bootTime < 30000
      ) {
        // Cloud has a newer save (e.g. from another device)
        const cloudAwayMs = cloud.state.lastTickAt ? Math.max(0, Date.now() - cloud.state.lastTickAt) : 0;
        Game.state = cloud.state;
        reconcileOfflineTime(Game.state);
        if (cloudAwayMs >= 5 * 60 * 1000) {
          Game.offlineSummary = {
            elapsedMs: cloudAwayMs,
            readyEggs: Game.state.eggs.filter(e => e.hatchEndAt <= Date.now()).length,
            visitorWaiting: !!Game.state.visitorExpiresAt && Game.state.visitorExpiresAt > Date.now(),
          };
        }
        store.setJSON('mps_state', Game.state);
      } else if (Game.state) {
        scheduleSaveToCloud(Game.state);
      }
    }).catch(() => { /* cloud unavailable — continue offline */ });
  }
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
      scheduleIdleNotifications(Game.state);
    } else {
      clearScheduledNotifications();
      reconcileOfflineTime(Game.state);
      checkAndUpdateVisitor(Game.state);
      ensureQuestsFresh(Game.state);
      const hub = Game.phaser?.scene.getScene('Hub') as any;
      if (hub && hub.scene.isActive()) hub.onResume();
    }
  });
}
