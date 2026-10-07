'use strict';

function shiftHue(baseColorInt, degrees) {
  var r = (baseColorInt >> 16) & 0xff;
  var g = (baseColorInt >> 8) & 0xff;
  var b = baseColorInt & 0xff;
  var rn = r/255, gn = g/255, bn = b/255;
  var max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  var d = max - min;
  var h = 0, s = max === 0 ? 0 : d/max, v = max;
  if (d > 0) {
    if (max === rn)      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else                 h = ((rn - gn) / d + 4) / 6;
  }
  h = ((h + degrees / 360) % 1 + 1) % 1;
  var i = Math.floor(h * 6), f = h * 6 - i;
  var p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
  var nr, ng, nb;
  switch (i % 6) {
    case 0: nr=v; ng=t; nb=p; break;
    case 1: nr=q; ng=v; nb=p; break;
    case 2: nr=p; ng=v; nb=t; break;
    case 3: nr=p; ng=q; nb=v; break;
    case 4: nr=t; ng=p; nb=v; break;
    case 5: nr=v; ng=p; nb=q; break;
  }
  return (Math.round(nr*255) << 16) | (Math.round(ng*255) << 8) | Math.round(nb*255);
}

function darken(c, amt) {
  var r = Math.max(0, ((c >> 16) & 0xff) - amt);
  var g = Math.max(0, ((c >> 8)  & 0xff) - amt);
  var b = Math.max(0, ( c        & 0xff) - amt);
  return (r << 16) | (g << 8) | b;
}

function lighten(c, amt) {
  var r = Math.min(255, ((c >> 16) & 0xff) + amt);
  var g = Math.min(255, ((c >> 8)  & 0xff) + amt);
  var b = Math.min(255, ( c        & 0xff) + amt);
  return (r << 16) | (g << 8) | b;
}

function getVariantModifiers(vi) {
  return {
    hueShift:    ((vi % 12) - 6) * 15,
    patternType: Math.floor(vi / 50),  // 0=plain, 1=spots
    isGolden:    vi % 7 === 0
  };
}

function drawBody(g, sp, bodyColor, cx, cy, r) {
  var dark = darken(bodyColor, 40);
  var light = lighten(bodyColor, 40);
  switch (sp.bodyShape) {
    case 'round':
      g.fillStyle(dark, 1);
      g.fillCircle(cx, cy, r);
      g.fillStyle(bodyColor, 1);
      g.fillCircle(cx - r*0.04, cy - r*0.05, r*0.9);
      g.fillStyle(light, 0.45);
      g.fillCircle(cx - r*0.32, cy - r*0.35, r*0.38);
      break;
    case 'lumpy':
      g.fillStyle(bodyColor, 1);
      g.fillCircle(cx, cy, r * 0.82);
      g.fillCircle(cx - r*0.42, cy + r*0.18, r * 0.58);
      g.fillCircle(cx + r*0.38, cy + r*0.12, r * 0.52);
      g.fillStyle(light, 0.3);
      g.fillCircle(cx - r*0.25, cy - r*0.3, r * 0.32);
      break;
    case 'spiky': {
      var spikes = 5, pts = [];
      for (var i = 0; i < spikes * 2; i++) {
        var rad = i % 2 === 0 ? r : r * 0.52;
        var ang = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        pts.push({ x: cx + Math.cos(ang)*rad, y: cy + Math.sin(ang)*rad });
      }
      g.fillStyle(bodyColor, 1);
      g.fillPoints(pts, true);
      g.fillStyle(light, 0.35);
      g.fillCircle(cx - r*0.25, cy - r*0.25, r * 0.28);
      break;
    }
    case 'flat':
      g.fillStyle(dark, 1);
      g.fillEllipse(cx, cy, r * 2.2, r * 1.15);
      g.fillStyle(bodyColor, 1);
      g.fillEllipse(cx - 1, cy - 2, r * 2.1, r * 1.05);
      g.fillStyle(light, 0.3);
      g.fillEllipse(cx - r*0.3, cy - r*0.2, r * 0.8, r * 0.35);
      break;
    case 'long':
      g.fillStyle(dark, 1);
      g.fillEllipse(cx, cy, r * 1.15, r * 2.2);
      g.fillStyle(bodyColor, 1);
      g.fillEllipse(cx - 1, cy - 2, r * 1.05, r * 2.1);
      g.fillStyle(light, 0.3);
      g.fillEllipse(cx - r*0.2, cy - r*0.4, r * 0.38, r * 0.65);
      break;
  }
}

function drawFeatures(g, sp, bodyColor, cx, cy, r) {
  // eye offset — different for each shape
  var eyeY = cy - r * (sp.bodyShape === 'flat' ? 0.15 : sp.bodyShape === 'long' ? 0.3 : 0.1);
  var eyeX = r * 0.28;
  var er   = Math.max(3, r * 0.12);

  // whites
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - eyeX, eyeY, er * 1.4);
  g.fillCircle(cx + eyeX, eyeY, er * 1.4);
  // pupils
  g.fillStyle(0x1a0a2e, 1);
  g.fillCircle(cx - eyeX + 1, eyeY + 1, er);
  g.fillCircle(cx + eyeX + 1, eyeY + 1, er);
  // highlights
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - eyeX + er*0.4, eyeY - er*0.4, er * 0.4);
  g.fillCircle(cx + eyeX + er*0.4, eyeY - er*0.4, er * 0.4);

  // mouth
  var mouthR = r * (sp.bodyShape === 'flat' ? 0.25 : 0.22);
  var mouthY = eyeY + r * (sp.bodyShape === 'flat' ? 0.28 : 0.3);
  g.lineStyle(Math.max(2, r * 0.07), 0x1a0a2e, 1);
  g.beginPath();
  g.arc(cx, mouthY, mouthR, 0.1 * Math.PI, 0.9 * Math.PI, false);
  g.strokePath();

  // habitat-specific accents
  if (sp.habitat === 'dirt') {
    // stubby horns
    var hornW = r * 0.14, hornH = r * 0.28;
    var hornY = cy - r * (sp.bodyShape === 'flat' ? 0.55 : sp.bodyShape === 'long' ? 0.95 : 0.82);
    g.fillStyle(darken(bodyColor, 20), 1);
    g.fillTriangle(cx - r*0.28, hornY, cx - r*0.28 - hornW, hornY + hornH, cx - r*0.28 + hornW, hornY + hornH);
    g.fillTriangle(cx + r*0.28, hornY, cx + r*0.28 - hornW, hornY + hornH, cx + r*0.28 + hornW, hornY + hornH);
  } else if (sp.habitat === 'grass') {
    // leaf ears
    var earX = cx + r * (sp.bodyShape === 'flat' ? 1.05 : 0.88);
    var earY = cy - r * (sp.bodyShape === 'flat' ? 0.2 : sp.bodyShape === 'long' ? 0.55 : 0.35);
    g.fillStyle(lighten(bodyColor, 30), 1);
    g.fillEllipse(cx - earX + cx, earY, r*0.35, r*0.55);
    g.fillEllipse(earX, earY, r*0.35, r*0.55);
  } else if (sp.habitat === 'aquatic') {
    // side fins
    var finY = cy + r * 0.05;
    var finW = r * 0.38, finH = r * 0.55;
    var fx = cx + r * (sp.bodyShape === 'flat' ? 1.0 : sp.bodyShape === 'long' ? 0.52 : 0.82);
    g.fillStyle(lighten(bodyColor, 25), 0.85);
    g.fillTriangle(cx - fx + cx, finY, cx - fx + cx - finW, finY - finH/2, cx - fx + cx - finW, finY + finH/2);
    g.fillTriangle(fx, finY, fx + finW, finY - finH/2, fx + finW, finY + finH/2);
  }

  // spots (pattern type 1+)
  if (Math.floor(sp.id * 3 + 1) % 2 === 0) {
    g.fillStyle(darken(bodyColor, 25), 0.5);
    var spr = r * 0.1;
    g.fillCircle(cx + r*0.22, cy + r*0.18, spr);
    g.fillCircle(cx - r*0.18, cy + r*0.28, spr * 0.8);
  }
}

function drawGoldenGlow(g, cx, cy, r) {
  g.lineStyle(4, 0xFFD700, 0.8);
  g.strokeCircle(cx, cy, r + 5);
  g.lineStyle(2, 0xFFF176, 0.5);
  g.strokeCircle(cx, cy, r + 10);
}

function makeMonsterTexture(scene, monster) {
  var key = 'mon_' + monster.speciesId + '_' + monster.variantIndex;
  if (scene.textures.exists(key)) return key;
  var sp = SPECIES[monster.speciesId];
  var mods = getVariantModifiers(monster.variantIndex);
  var bodyColor = shiftHue(sp.baseColor, mods.hueShift);
  var SIZE = 128, cx = 64, cy = 64;
  var r = sp.bodyShape === 'flat' ? 38 : sp.bodyShape === 'long' ? 34 : 44;
  var g = scene.make.graphics({ x: 0, y: 0, add: false });
  drawBody(g, sp, bodyColor, cx, cy, r);
  drawFeatures(g, sp, bodyColor, cx, cy, r);
  if (mods.isGolden) drawGoldenGlow(g, cx, cy, r);
  g.generateTexture(key, SIZE, SIZE);
  g.destroy();
  return key;
}
