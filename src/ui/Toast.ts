import Phaser from 'phaser';
import { FONT } from '../utils';

export function showToast(scene: Phaser.Scene, msg: string, color: string = '#ffffff') {
  const W = scene.scale.width;
  const txt = scene.add.text(W / 2, scene.scale.height - 140, msg, {
    fontFamily: FONT,
    fontSize: '18px',
    color,
    backgroundColor: '#00000099',
    padding: { x: 16, y: 8 },
  }).setOrigin(0.5).setDepth(200);
  scene.tweens.add({
    targets: txt,
    y: txt.y - 40,
    alpha: { from: 1, to: 0 },
    duration: 1600,
    ease: 'Cubic.Out',
    onComplete: () => { txt.destroy(); },
  });
}

export function showFloat(scene: Phaser.Scene, x: number, y: number, msg: string, color: string = '#ffd700') {
  const txt = scene.add.text(x, y, msg, {
    fontFamily: FONT,
    fontSize: '22px',
    color,
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(200);
  scene.tweens.add({
    targets: txt,
    y: y - 60,
    alpha: { from: 1, to: 0 },
    duration: 1200,
    ease: 'Cubic.Out',
    onComplete: () => { txt.destroy(); },
  });
}
