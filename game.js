'use strict';

(function() {
  Game.phaser = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 540,
    height: 960,
    backgroundColor: '#1a0a2e',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    input: { activePointers: 2 },
    scene: [Boot, Hub, Merchant, HatchScene, BreedingLab]
  });
})();
