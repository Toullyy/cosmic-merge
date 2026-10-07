'use strict';
window.Game = { state: null, phaser: null };

var FONT = '"Noto Sans Thai", "Sarabun", system-ui, sans-serif';

var store = {
  get: function(k, d) {
    try { var v = localStorage.getItem(k); return v === null ? d : v; } catch(e) { return d; }
  },
  set: function(k, v) { try { localStorage.setItem(k, v); } catch(e) {} },
  getJSON: function(k, d) {
    try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : d; } catch(e) { return d; }
  },
  setJSON: function(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} }
};

var sfx = {
  ctx: null,
  muted: store.get('mps_mute', '0') === '1',
  unlock: function() {
    if (!this.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone: function(f, d, type, v, slide) {
    if (this.muted || !this.ctx) return;
    var t = this.ctx.currentTime;
    var o = this.ctx.createOscillator();
    var g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    g.gain.setValueAtTime(v || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + d + 0.02);
  },
  feed:    function() { this.tone(440, 0.1, 'sine',     0.07,  60); },
  pet:     function() { this.tone(520, 0.12,'sine',     0.06,  80); },
  clean:   function() { this.tone(360, 0.1, 'triangle', 0.06,  40); },
  hatch:   function() { this.tone(380, 0.3, 'triangle', 0.09, 150); },
  sell:    function() { this.tone(300, 0.2, 'sine',     0.08, -50); },
  buy:     function() { this.tone(500, 0.15,'sine',     0.08,  30); },
  levelup: function() { this.tone(600, 0.4, 'sine',     0.1,  200); },
  toggle:  function() { this.muted = !this.muted; store.set('mps_mute', this.muted ? '1' : '0'); }
};
