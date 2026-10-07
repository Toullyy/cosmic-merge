'use strict';

function makeButton(scene, x, y, w, h, label, fill, cb, fontSize) {
  var container = scene.add.container(x, y);
  var bg = scene.add.graphics();
  bg.fillStyle(fill, 1);
  bg.fillRoundedRect(-w/2, -h/2, w, h, 10);
  bg.lineStyle(2, 0xffffff, 0.22);
  bg.strokeRoundedRect(-w/2, -h/2, w, h, 10);
  var txt = scene.add.text(0, 0, label, {
    fontFamily: FONT,
    fontSize: (fontSize || 18) + 'px',
    color: '#ffffff',
    align: 'center',
    wordWrap: { width: w - 16 }
  }).setOrigin(0.5);
  container.add([bg, txt]);

  // Container is the hit target — inherits depth, so it works inside overlays
  container.setSize(w, h);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-w/2, -h/2, w, h),
    Phaser.Geom.Rectangle.Contains
  );
  container.on('pointerdown', function() {
    sfx.unlock();
    scene.tweens.add({ targets: container, scaleX: 0.93, scaleY: 0.93, duration: 80, yoyo: true });
    if (cb) cb();
  });

  return container;
}
