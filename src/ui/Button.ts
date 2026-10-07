import Phaser from 'phaser';
import { FONT, sfx } from '../utils';

export function makeButton(
  scene: Phaser.Scene,
  x: number, y: number,
  w: number, h: number,
  label: string,
  fill: number,
  cb: (() => void) | null,
  fontSize: number = 18,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  const bg = scene.add.graphics();
  bg.fillStyle(fill, 1);
  bg.fillRoundedRect(-w/2, -h/2, w, h, 10);
  bg.lineStyle(2, 0xffffff, 0.22);
  bg.strokeRoundedRect(-w/2, -h/2, w, h, 10);
  const txt = scene.add.text(0, 0, label, {
    fontFamily: FONT,
    fontSize: fontSize + 'px',
    color: '#ffffff',
    align: 'center',
    wordWrap: { width: w - 16 },
  }).setOrigin(0.5);
  container.add([bg, txt]);
  container.setSize(w, h);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-w/2, -h/2, w, h),
    Phaser.Geom.Rectangle.Contains,
  );
  container.on('pointerdown', () => {
    sfx.unlock();
    scene.tweens.add({ targets: container, scaleX: 0.93, scaleY: 0.93, duration: 80, yoyo: true });
    if (cb) cb();
  });
  return container;
}
