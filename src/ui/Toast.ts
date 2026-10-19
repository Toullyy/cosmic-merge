import Phaser from 'phaser';
import { FONT } from '../utils';

export function showToast(scene: Phaser.Scene, msg: string, color: string = '#ffffff') {
  const W = scene.scale.width;
  const baseY = scene.scale.height - 140;

  const container = scene.add.container(W / 2, baseY + 20).setDepth(200);

  const txt = scene.add.text(0, 0, msg, {
    fontFamily: FONT,
    fontSize: '17px',
    color,
    align: 'center',
    stroke: '#000000',
    strokeThickness: 2,
  }).setOrigin(0.5);

  const padX = 24, padY = 12;
  const bw = Math.min(W - 50, txt.width + padX * 2);
  const bh = Math.max(44, txt.height + padY * 2);
  const br = bh / 2;

  const bg = scene.add.graphics();
  bg.fillStyle(0x07050F, 0.94);
  bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, br);
  bg.lineStyle(1.5, 0xffffff, 0.13);
  bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, br);

  container.addAt(bg, 0);
  container.add(txt);

  scene.tweens.add({
    targets: container,
    y: baseY - 30,
    alpha: { from: 1, to: 0 },
    duration: 1800,
    ease: 'Cubic.Out',
    onComplete: () => { container.destroy(); },
  });
}

export function showFloat(scene: Phaser.Scene, x: number, y: number, msg: string, color: string = '#ffd700') {
  const txt = scene.add.text(x, y, msg, {
    fontFamily: FONT,
    fontSize: '24px',
    color,
    fontStyle: 'bold',
    stroke: '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(200);
  scene.tweens.add({
    targets: txt,
    y: y - 72,
    alpha: { from: 1, to: 0 },
    duration: 1200,
    ease: 'Cubic.Out',
    onComplete: () => { txt.destroy(); },
  });
}
