'use strict';

function showToast(scene, msg, color) {
  var W = scene.scale.width;
  var txt = scene.add.text(W / 2, scene.scale.height - 140, msg, {
    fontFamily: FONT,
    fontSize: '18px',
    color: color || '#ffffff',
    backgroundColor: '#00000099',
    padding: { x: 16, y: 8 }
  }).setOrigin(0.5).setDepth(200);
  scene.tweens.add({
    targets: txt,
    y: txt.y - 40,
    alpha: { from: 1, to: 0 },
    duration: 1600,
    ease: 'Cubic.Out',
    onComplete: function() { txt.destroy(); }
  });
}

function showFloat(scene, x, y, msg, color) {
  var txt = scene.add.text(x, y, msg, {
    fontFamily: FONT,
    fontSize: '22px',
    color: color || '#ffd700',
    stroke: '#000000',
    strokeThickness: 3
  }).setOrigin(0.5).setDepth(200);
  scene.tweens.add({
    targets: txt,
    y: y - 60,
    alpha: { from: 1, to: 0 },
    duration: 1200,
    ease: 'Cubic.Out',
    onComplete: function() { txt.destroy(); }
  });
}
