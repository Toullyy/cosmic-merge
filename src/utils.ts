import type { GameState, Quest } from './types';
import { ACHIEVEMENTS, DECAY, BOWL_EAT_RATE, TRAITS, getDecayMult } from './data';
import type { Achievement } from './data';
import { scheduleSaveToCloud } from './cloudSync';

export const FONT = '"Noto Sans Thai", "Sarabun", system-ui, sans-serif';

// Local-time date key (YYYY-MM-DD). Using UTC here caused daily resets to drift
// relative to the local-midnight quest reset.
export function localDateKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export const store = {
  get(k: string, d: string = ''): string {
    try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; }
  },
  set(k: string, v: string): void {
    try { localStorage.setItem(k, v); } catch { /* ignore */ }
  },
  getJSON<T>(k: string, d: T | null = null): T | null {
    try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : d; } catch { return d; }
  },
  setJSON(k: string, v: unknown): void {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
    if (k === 'mps_state') scheduleSaveToCloud(v as GameState);
  },
};

export interface OfflineSummary {
  elapsedMs: number;
  readyEggs: number;
  visitorWaiting: boolean;
}

export const Game: {
  state: GameState | null;
  phaser: import('phaser').Game | null;
  uid: string | null;
  isAnonymous: boolean;
  offlineSummary: OfflineSummary | null;
} = {
  state: null,
  phaser: null,
  uid: null,
  isAnonymous: true,
  offlineSummary: null,
};

export function reconcileOfflineTime(state: GameState): void {
  const now = Date.now();
  const rawElapsed = now - (state.lastTickAt ?? now);
  // Guard against a backwards clock jump or a corrupt/future timestamp. Without
  // this, `hours` is negative, the early-return below leaves lastTickAt in the
  // future, and all stat decay freezes until real time catches up.
  if (!Number.isFinite(rawElapsed) || rawElapsed <= 0) {
    if (state.lastTickAt !== now) {
      state.lastTickAt = now;
      store.setJSON('mps_state', state);
    }
    return;
  }
  const elapsed = Math.min(rawElapsed, 7 * 24 * 3600000);
  const hours = elapsed / 3600000;
  if (hours < 0.001) return;
  state.monsters.forEach(mon => {
    const decayMult = getDecayMult(state, mon.habitatType);
    const trait = TRAITS.find(tr => tr.id === mon.trait);
    const hMod  = (trait?.decayMod?.happiness   ?? 1) * decayMult;
    const nuMod = (trait?.decayMod?.hunger       ?? 1) * decayMult;
    const cMod  = (trait?.decayMod?.cleanliness  ?? 1) * decayMult;
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

export function recordQuestProgress(type: Quest['type']): void {
  if (!Game.state) return;
  let changed = false;
  const tick = (list: Quest[] | undefined) => {
    list?.forEach(q => {
      if (q.type === type && !q.completed) {
        q.progress = Math.min(q.target, q.progress + 1);
        if (q.progress >= q.target) q.completed = true;
        changed = true;
      }
    });
  };
  tick(Game.state.quests);
  tick(Game.state.weeklyQuests);
  if (changed) store.setJSON('mps_state', Game.state);
}

export function getNewAchievements(state: GameState): Achievement[] {
  const existing = new Set(state.achievements ?? []);
  const newOnes = ACHIEVEMENTS.filter(a => !existing.has(a.id) && a.check(state));
  if (newOnes.length > 0) {
    state.achievements = [...(state.achievements ?? []), ...newOnes.map(a => a.id)];
    newOnes.forEach(a => { state.diamonds = (state.diamonds ?? 0) + a.diamonds; });
    store.setJSON('mps_state', state);
  }
  return newOnes;
}

export const sfx = {
  ctx: null as AudioContext | null,
  muted: store.get('mps_mute', '0') === '1',

  unlock() {
    if (this.ctx?.state === 'running') return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  },

  tone(f: number, d: number, type: OscillatorType = 'sine', v: number = 0.08, slide: number = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + d + 0.02);
  },

  feed()    { this.tone(440, 0.1,  'sine',     0.07,  60); },
  pet()     { this.tone(520, 0.12, 'sine',     0.06,  80); },
  clean()   { this.tone(360, 0.1,  'triangle', 0.06,  40); },
  hatch()   { this.tone(380, 0.3,  'triangle', 0.09, 150); },
  sell()    { this.tone(300, 0.2,  'sine',     0.08, -50); },
  buy()     { this.tone(500, 0.15, 'sine',     0.08,  30); },
  levelup() { this.tone(600, 0.4,  'sine',     0.1,  200); },
  toggle()  { this.muted = !this.muted; store.set('mps_mute', this.muted ? '1' : '0'); },
};
