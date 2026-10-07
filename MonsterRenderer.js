'use strict';

function shiftHue(baseColorInt, degrees) {
  var r = (baseColorInt >> 16) & 0xff;
  var g = (baseColorInt >> 8)  & 0xff;
  var b =  baseColorInt        & 0xff;
  var rn = r/255, gn = g/255, bn = b/255;
  var max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  var d = max - min, h = 0, s = max === 0 ? 0 : d/max, v = max;
  if (d > 0) {
    if      (max === rn) h = ((gn - bn)/d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn)/d + 2) / 6;
    else                 h = ((rn - gn)/d + 4) / 6;
  }
  h = ((h + degrees / 360) % 1 + 1) % 1;
  var i = Math.floor(h * 6), f = h*6 - i;
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
    patternType: Math.floor(vi / 50),
    isGolden:    vi % 7 === 0
  };
}

function drawBody(g, sp, bodyColor, cx, cy, r) {
  var shadow = darken(bodyColor, 60);
  var base   = bodyColor;
  var belly  = lighten(bodyColor, 32);
  var spec   = lighten(bodyColor, 72);

  switch (sp.bodyShape) {
    case 'round':
      g.fillStyle(shadow, 0.55);
      g.fillCircle(cx + 5, cy + 6, r);
      g.fillStyle(base, 1);
      g.fillCircle(cx, cy, r);
      g.fillStyle(belly, 0.5);
      g.fillCircle(cx + r*0.12, cy + r*0.2, r * 0.56);
      g.fillStyle(spec, 0.52);
      g.fillCircle(cx - r*0.34, cy - r*0.34, r * 0.22);
      break;
    case 'lumpy':
      g.fillStyle(shadow, 0.5);
      g.fillCircle(cx + 4, cy + 5, r * 0.82);
      g.fillCircle(cx - r*0.42 + 3, cy + r*0.18 + 4, r * 0.58);
      g.fillCircle(cx + r*0.38 + 3, cy + r*0.12 + 4, r * 0.52);
      g.fillStyle(base, 1);
      g.fillCircle(cx, cy, r * 0.82);
      g.fillCircle(cx - r*0.42, cy + r*0.18, r * 0.58);
      g.fillCircle(cx + r*0.38, cy + r*0.12, r * 0.52);
      g.fillStyle(belly, 0.42);
      g.fillCircle(cx, cy, r * 0.45);
      g.fillStyle(spec, 0.46);
      g.fillCircle(cx - r*0.24, cy - r*0.3, r * 0.2);
      break;
    case 'spiky': {
      var spikes = 5, shadowPts = [], pts = [];
      for (var si = 0; si < spikes * 2; si++) {
        var srad = si % 2 === 0 ? r : r * 0.52;
        var sang = (si / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        shadowPts.push({ x: cx + Math.cos(sang)*srad + 4, y: cy + Math.sin(sang)*srad + 5 });
        pts.push({ x: cx + Math.cos(sang)*srad, y: cy + Math.sin(sang)*srad });
      }
      g.fillStyle(shadow, 0.5);
      g.fillPoints(shadowPts, true);
      g.fillStyle(base, 1);
      g.fillPoints(pts, true);
      g.fillStyle(belly, 0.38);
      g.fillCircle(cx, cy + r*0.1, r * 0.42);
      g.fillStyle(spec, 0.44);
      g.fillCircle(cx - r*0.2, cy - r*0.22, r * 0.18);
      break;
    }
    case 'flat':
      g.fillStyle(shadow, 0.5);
      g.fillEllipse(cx + 5, cy + 5, r * 2.25, r * 1.18);
      g.fillStyle(base, 1);
      g.fillEllipse(cx, cy, r * 2.2, r * 1.15);
      g.fillStyle(belly, 0.44);
      g.fillEllipse(cx + r*0.1, cy + r*0.08, r * 1.1, r * 0.52);
      g.fillStyle(spec, 0.5);
      g.fillEllipse(cx - r*0.42, cy - r*0.2, r * 0.52, r * 0.26);
      break;
    case 'long':
      g.fillStyle(shadow, 0.5);
      g.fillEllipse(cx + 4, cy + 5, r * 1.18, r * 2.25);
      g.fillStyle(base, 1);
      g.fillEllipse(cx, cy, r * 1.15, r * 2.2);
      g.fillStyle(belly, 0.44);
      g.fillEllipse(cx + r*0.05, cy + r*0.1, r * 0.52, r * 1.1);
      g.fillStyle(spec, 0.5);
      g.fillEllipse(cx - r*0.18, cy - r*0.45, r * 0.26, r * 0.52);
      break;
  }
}

function drawTail(g, sp, bodyColor, cx, cy, r) {
  var tailBase = darken(bodyColor, 22);
  var tailTip  = lighten(bodyColor, 18);
  switch (sp.bodyShape) {
    case 'round':
      g.fillStyle(tailBase, 1);
      g.fillEllipse(cx + r*0.9, cy + r*0.52, r*0.4, r*0.22);
      g.fillCircle(cx + r*1.1, cy + r*0.42, r*0.18);
      g.fillCircle(cx + r*1.22, cy + r*0.3, r*0.12);
      g.fillStyle(tailTip, 0.6);
      g.fillCircle(cx + r*1.22, cy + r*0.3, r*0.08);
      break;
    case 'lumpy':
      g.fillStyle(tailBase, 1);
      g.fillCircle(cx + r*0.88, cy + r*0.52, r*0.22);
      g.fillCircle(cx + r*1.06, cy + r*0.44, r*0.16);
      g.fillStyle(tailTip, 0.55);
      g.fillCircle(cx + r*1.06, cy + r*0.44, r*0.1);
      break;
    case 'spiky':
      g.fillStyle(tailBase, 1);
      g.fillTriangle(
        cx + r*0.68, cy + r*0.38,
        cx + r*1.28, cy + r*0.08,
        cx + r*0.82, cy + r*0.68
      );
      g.fillStyle(tailTip, 0.38);
      g.fillTriangle(
        cx + r*0.72, cy + r*0.42,
        cx + r*1.1,  cy + r*0.18,
        cx + r*0.86, cy + r*0.58
      );
      break;
    case 'flat':
      g.fillStyle(tailBase, 1);
      g.fillEllipse(cx + r*1.1, cy, r*0.58, r*0.3);
      g.fillStyle(tailTip, 0.45);
      g.fillEllipse(cx + r*1.08, cy - r*0.04, r*0.36, r*0.17);
      break;
    case 'long':
      g.fillStyle(tailBase, 1);
      g.fillEllipse(cx + r*0.2,  cy + r*1.02, r*0.52, r*0.26);
      g.fillEllipse(cx + r*0.38, cy + r*1.14, r*0.36, r*0.2);
      g.fillStyle(tailTip, 0.45);
      g.fillEllipse(cx + r*0.38, cy + r*1.14, r*0.2, r*0.12);
      break;
  }
}

function drawFeatures(g, sp, bodyColor, cx, cy, r) {
  var irisColor = shiftHue(bodyColor, 150);
  var eyeOffY = sp.bodyShape === 'flat' ? 0.16 : sp.bodyShape === 'long' ? 0.28 : 0.1;
  var eyeY = cy - r * eyeOffY;
  var eyeX = r * 0.28;
  var er   = Math.max(3.5, r * 0.13);

  // whites
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - eyeX, eyeY, er * 1.55);
  g.fillCircle(cx + eyeX, eyeY, er * 1.55);
  // iris
  g.fillStyle(irisColor, 1);
  g.fillCircle(cx - eyeX, eyeY + 0.6, er * 1.15);
  g.fillCircle(cx + eyeX, eyeY + 0.6, er * 1.15);
  // pupil
  g.fillStyle(0x080015, 1);
  g.fillCircle(cx - eyeX + 1, eyeY + 1, er * 0.7);
  g.fillCircle(cx + eyeX + 1, eyeY + 1, er * 0.7);
  // primary highlight
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - eyeX + er*0.45, eyeY - er*0.42, er * 0.44);
  g.fillCircle(cx + eyeX + er*0.45, eyeY - er*0.42, er * 0.44);
  // secondary highlight
  g.fillStyle(0xffffff, 0.6);
  g.fillCircle(cx - eyeX - er*0.28, eyeY + er*0.32, er * 0.22);
  g.fillCircle(cx + eyeX - er*0.28, eyeY + er*0.32, er * 0.22);

  // cheek blush
  g.fillStyle(lighten(bodyColor, 50), 0.28);
  g.fillEllipse(cx - eyeX - er*0.5, eyeY + er*0.9, er*2.0, er*0.85);
  g.fillEllipse(cx + eyeX + er*0.5, eyeY + er*0.9, er*2.0, er*0.85);

  // smile
  var mouthR = r * (sp.bodyShape === 'flat' ? 0.21 : 0.2);
  var mouthY = eyeY + r * (sp.bodyShape === 'flat' ? 0.27 : 0.31);
  g.lineStyle(Math.max(2, r * 0.07), darken(bodyColor, 35), 1);
  g.beginPath();
  g.arc(cx, mouthY, mouthR, 0.15 * Math.PI, 0.85 * Math.PI, false);
  g.strokePath();

  // habitat accents
  if (sp.habitat === 'dirt') {
    var hornW = r * 0.13, hornH = r * 0.27;
    var hornTopY = cy - r * (sp.bodyShape === 'flat' ? 0.54 : sp.bodyShape === 'long' ? 0.92 : 0.84);
    g.fillStyle(darken(bodyColor, 28), 1);
    g.fillTriangle(cx - r*0.26, hornTopY, cx - r*0.26 - hornW, hornTopY + hornH, cx - r*0.26 + hornW, hornTopY + hornH);
    g.fillTriangle(cx + r*0.26, hornTopY, cx + r*0.26 - hornW, hornTopY + hornH, cx + r*0.26 + hornW, hornTopY + hornH);
    g.fillStyle(lighten(bodyColor, 24), 0.5);
    g.fillTriangle(cx - r*0.26, hornTopY + 3, cx - r*0.26 - hornW*0.4, hornTopY + hornH*0.5, cx - r*0.26 + hornW*0.4, hornTopY + hornH*0.5);
    g.fillTriangle(cx + r*0.26, hornTopY + 3, cx + r*0.26 - hornW*0.4, hornTopY + hornH*0.5, cx + r*0.26 + hornW*0.4, hornTopY + hornH*0.5);
  } else if (sp.habitat === 'grass') {
    var earR = sp.bodyShape === 'flat' ? r * 1.02 : r * 0.86;
    g.fillStyle(lighten(bodyColor, 28), 1);
    g.fillEllipse(cx - earR, eyeY - r*0.1, r*0.34, r*0.58);
    g.fillEllipse(cx + earR, eyeY - r*0.1, r*0.34, r*0.58);
    g.fillStyle(lighten(bodyColor, 55), 0.5);
    g.fillEllipse(cx - earR, eyeY - r*0.08, r*0.18, r*0.36);
    g.fillEllipse(cx + earR, eyeY - r*0.08, r*0.18, r*0.36);
  } else if (sp.habitat === 'aquatic') {
    var finBaseY = cy + r * 0.08;
    var finW = r * 0.36, finH = r * 0.52;
    var finX = sp.bodyShape === 'flat' ? r * 1.02 : sp.bodyShape === 'long' ? r * 0.54 : r * 0.84;
    g.fillStyle(lighten(bodyColor, 22), 0.88);
    g.fillTriangle(cx - finX, finBaseY, cx - finX - finW, finBaseY - finH/2, cx - finX - finW, finBaseY + finH/2);
    g.fillTriangle(cx + finX, finBaseY, cx + finX + finW, finBaseY - finH/2, cx + finX + finW, finBaseY + finH/2);
    g.fillStyle(lighten(bodyColor, 48), 0.4);
    g.fillTriangle(cx - finX + 2, finBaseY, cx - finX - finW*0.55, finBaseY - finH*0.38, cx - finX - finW*0.55, finBaseY + finH*0.38);
    g.fillTriangle(cx + finX - 2, finBaseY, cx + finX + finW*0.55, finBaseY - finH*0.38, cx + finX + finW*0.55, finBaseY + finH*0.38);
  }

  // spots (subset of species)
  if (Math.floor(sp.id * 7) % 3 === 1) {
    g.fillStyle(darken(bodyColor, 30), 0.5);
    var spr = r * 0.1;
    g.fillCircle(cx + r*0.22, cy + r*0.2, spr);
    g.fillCircle(cx - r*0.18, cy + r*0.3, spr * 0.75);
    g.fillCircle(cx + r*0.38, cy,           spr * 0.85);
  }
}

function drawGoldenGlow(g, cx, cy, r) {
  g.fillStyle(0xFFD700, 0.07);
  g.fillCircle(cx, cy, r + 16);
  g.lineStyle(3, 0xFFD700, 0.88);
  g.strokeCircle(cx, cy, r + 6);
  g.lineStyle(2, 0xFFF59D, 0.52);
  g.strokeCircle(cx, cy, r + 11);
  g.lineStyle(1, 0xFFE082, 0.28);
  g.strokeCircle(cx, cy, r + 16);
}

function makeMonsterTexture(scene, monster) {
  var key = 'mon_' + monster.speciesId + '_' + monster.variantIndex;
  if (scene.textures.exists(key)) return key;
  var sp = SPECIES[monster.speciesId];
  var mods = getVariantModifiers(monster.variantIndex);
  var bodyColor = shiftHue(sp.baseColor, mods.hueShift);
  var SIZE = 128, cx = 64, cy = 64;
  var r = sp.bodyShape === 'flat' ? 36 : sp.bodyShape === 'long' ? 32 : 42;
  var g = scene.make.graphics({ x: 0, y: 0, add: false });
  drawTail(g, sp, bodyColor, cx, cy, r);
  drawBody(g, sp, bodyColor, cx, cy, r);
  drawFeatures(g, sp, bodyColor, cx, cy, r);
  if (mods.isGolden) drawGoldenGlow(g, cx, cy, r);
  g.generateTexture(key, SIZE, SIZE);
  g.destroy();
  return key;
}
