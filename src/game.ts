import Phaser from 'phaser';
import { Game } from './utils';
import { Boot } from './scenes/Boot';
import { Hub } from './scenes/Hub';
import { Merchant } from './scenes/Merchant';
import { HatchScene } from './scenes/HatchScene';
import { BreedingLab } from './scenes/BreedingLab';
import { HabitatRoom } from './scenes/HabitatRoom';

Game.phaser = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 540,
  height: 960,
  backgroundColor: '#1a0a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 2 },
  scene: [Boot, Hub, Merchant, HatchScene, BreedingLab, HabitatRoom],
});
