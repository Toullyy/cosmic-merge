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
  bg.fillStyle(0xffffff, 0.13);
  bg.fillRoundedRect(-w/2 + 3, -h/2 + 2, w - 6, h * 0.42, { tl: 8, tr: 8, bl: 0, br: 0 });
  bg.lineStyle(4, 0xffffff, 0.06);
  bg.strokeRoundedRect(-w/2 - 1, -h/2 - 1, w + 2, h + 2, 11);
  bg.lineStyle(1.5, 0xffffff, 0.28);
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
  container.setInteractive();
  container.on('pointerdown', () => {
    scene.tweens.add({ targets: container, scaleX: 0.94, scaleY: 0.94, duration: 55, yoyo: true });
    if (cb) cb();
  });
  return container;
}

export function setButtonLabel(btn: Phaser.GameObjects.Container, label: string) {
  const txt = btn.list.find(c => c instanceof Phaser.GameObjects.Text) as Phaser.GameObjects.Text | undefined;
  if (txt) txt.setText(label);
}

export function setButtonColor(btn: Phaser.GameObjects.Container, fill: number) {
  const g = btn.list[0] as Phaser.GameObjects.Graphics | undefined;
  if (!g) return;
  const w = btn.width, h = btn.height;
  g.clear();
  g.fillStyle(fill, 1);
  g.fillRoundedRect(-w/2, -h/2, w, h, 10);
  g.fillStyle(0xffffff, 0.13);
  g.fillRoundedRect(-w/2 + 3, -h/2 + 2, w - 6, h * 0.42, { tl: 8, tr: 8, bl: 0, br: 0 });
  g.lineStyle(4, 0xffffff, 0.06);
  g.strokeRoundedRect(-w/2 - 1, -h/2 - 1, w + 2, h + 2, 11);
  g.lineStyle(1.5, 0xffffff, 0.28);
  g.strokeRoundedRect(-w/2, -h/2, w, h, 10);
}
