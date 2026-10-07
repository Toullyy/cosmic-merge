'use strict';

var Boot = new Phaser.Class({
  Extends: Phaser.Scene,
  initialize: function Boot() { Phaser.Scene.call(this, { key: 'Boot' }); },

  create: function() {
    var saved = store.getJSON('mps_state', null);
    if (saved && saved.version === 1) {
      Game.state = saved;
      reconcileOfflineTime(Game.state);
    } else {
      Game.state = newState();
      store.setJSON('mps_state', Game.state);
    }
    registerVisibilityHandler();
    this.scene.start('Hub');
  }
});

function reconcileOfflineTime(state) {
  var now = Date.now();
  var elapsed = Math.min(now - (state.lastTickAt || now), 7 * 24 * 3600000);
  var hours = elapsed / 3600000;
  if (hours < 0.001) return;
  state.monsters.forEach(function(mon) {
    mon.happiness   = Math.max(0, mon.happiness   + DECAY.happiness   * hours);
    mon.hunger      = Math.max(0, mon.hunger      + DECAY.hunger      * hours);
    mon.cleanliness = Math.max(0, mon.cleanliness + DECAY.cleanliness * hours);
  });
  state.lastTickAt = now;
  store.setJSON('mps_state', state);
}

var _visibilityRegistered = false;
function registerVisibilityHandler() {
  if (_visibilityRegistered) return;
  _visibilityRegistered = true;
  document.addEventListener('visibilitychange', function() {
    if (!Game.state) return;
    if (document.visibilityState === 'hidden') {
      Game.state.lastTickAt = Date.now();
      store.setJSON('mps_state', Game.state);
    } else {
      reconcileOfflineTime(Game.state);
      var hub = Game.phaser && Game.phaser.scene.getScene('Hub');
      if (hub && hub.scene.isActive()) hub.refreshAll();
    }
  });
}
