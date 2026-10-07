import type { GameState } from './types';

export const FONT = '"Noto Sans Thai", "Sarabun", system-ui, sans-serif';

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
  },
};

export const Game: { state: GameState | null; phaser: import('phaser').Game | null } = {
  state: null,
  phaser: null,
};

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
