import Phaser from 'phaser';
import { FONT, sfx } from '../utils';

function _drawBg(g: Phaser.GameObjects.Graphics, w: number, h: number, fill: number) {
  g.clear();
  const r = Math.min(Math.floor(h / 2), 28);   // pill shape for typical button heights
  // drop shadow
  g.fillStyle(0x000000, 0.38);
  g.fillRoundedRect(-w/2 + 4, -h/2 + 6, w, h, r);
  // main fill
  g.fillStyle(fill, 1);
  g.fillRoundedRect(-w/2, -h/2, w, h, r);
  // bottom inner shadow (3-D depth)
  g.fillStyle(0x000000, 0.26);
  g.fillRoundedRect(-w/2 + 3, h/2 - 11, w - 6, 11, { tl: 0, tr: 0, bl: r - 3, br: r - 3 });
  // top gloss
  g.fillStyle(0xffffff, 0.44);
  g.fillRoundedRect(-w/2 + 4, -h/2 + 2, w - 8, h * 0.44, { tl: r - 3, tr: r - 3, bl: 0, br: 0 });
  // top shine stripe
  g.fillStyle(0xffffff, 0.72);
  g.fillRoundedRect(-w/2 + 10, -h/2 + 4, w - 20, 4, 2);
  // white border
  g.lineStyle(3, 0xffffff, 0.92);
  g.strokeRoundedRect(-w/2, -h/2, w, h, r);
}

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
  _drawBg(bg, w, h, fill);
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
    scene.tweens.add({ targets: container, scaleX: 0.91, scaleY: 0.91, duration: 65, yoyo: true });
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
  _drawBg(g, btn.width, btn.height, fill);
}
