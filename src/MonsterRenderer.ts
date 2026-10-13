import Phaser from 'phaser';
import { SPECIES } from './data';
import { buildMonsterSVG } from './monsterSprites';
import type { Monster, Species, VariantModifiers } from './types';

export function shiftHue(baseColorInt: number, degrees: number): number {
  const r = (baseColorInt >> 16) & 0xff;
  const g = (baseColorInt >> 8)  & 0xff;
  const b =  baseColorInt        & 0xff;
  const rn = r/255, gn = g/255, bn = b/255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d/max, v = max;
  if (d > 0) {
    if      (max === rn) h = ((gn - bn)/d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn)/d + 2) / 6;
    else                 h = ((rn - gn)/d + 4) / 6;
  }
  h = ((h + degrees / 360) % 1 + 1) % 1;
  const i = Math.floor(h * 6), f = h*6 - i;
  const p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
  let nr = 0, ng = 0, nb = 0;
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

export function darken(c: number, amt: number): number {
  const r = Math.max(0, ((c >> 16) & 0xff) - amt);
  const g = Math.max(0, ((c >> 8)  & 0xff) - amt);
  const b = Math.max(0, ( c        & 0xff) - amt);
  return (r << 16) | (g << 8) | b;
}

export function lighten(c: number, amt: number): number {
  const r = Math.min(255, ((c >> 16) & 0xff) + amt);
  const g = Math.min(255, ((c >> 8)  & 0xff) + amt);
  const b = Math.min(255, ( c        & 0xff) + amt);
  return (r << 16) | (g << 8) | b;
}

export function getVariantModifiers(vi: number): VariantModifiers {
  return {
    hueShift:    ((vi % 12) - 6) * 15,
    patternType: Math.floor(vi / 50),
    isGolden:    vi % 7 === 0,
  };
}

function drawBody(g: Phaser.GameObjects.Graphics, sp: Species, bodyColor: number, cx: number, cy: number, r: number) {
  const shadow = darken(bodyColor, 60);
  const belly  = lighten(bodyColor, 32);
  const spec   = lighten(bodyColor, 72);

  switch (sp.bodyShape) {
    case 'round':
      g.fillStyle(lighten(bodyColor, 22), 0.10); g.fillCircle(cx, cy, r + 14);
      g.fillStyle(shadow, 0.55); g.fillCircle(cx + 5, cy + 6, r);
      g.fillStyle(bodyColor, 1); g.fillCircle(cx, cy, r);
      g.fillStyle(belly, 0.50);  g.fillCircle(cx + r*0.12, cy + r*0.2, r * 0.56);
      g.fillStyle(spec, 0.52);   g.fillCircle(cx - r*0.34, cy - r*0.34, r * 0.22);
      g.fillStyle(spec, 0.34);   g.fillCircle(cx - r*0.52, cy - r*0.46, r * 0.28);
      g.lineStyle(2.5, darken(bodyColor, 58), 0.70); g.strokeCircle(cx, cy, r);
      break;
    case 'lumpy':
      g.fillStyle(lighten(bodyColor, 22), 0.10); g.fillCircle(cx, cy, r + 14);
      g.fillStyle(shadow, 0.5);
      g.fillCircle(cx + 4, cy + 5, r * 0.82);
      g.fillCircle(cx - r*0.42 + 3, cy + r*0.18 + 4, r * 0.58);
      g.fillCircle(cx + r*0.38 + 3, cy + r*0.12 + 4, r * 0.52);
      g.fillStyle(bodyColor, 1);
      g.fillCircle(cx, cy, r * 0.82);
      g.fillCircle(cx - r*0.42, cy + r*0.18, r * 0.58);
      g.fillCircle(cx + r*0.38, cy + r*0.12, r * 0.52);
      g.fillStyle(belly, 0.42); g.fillCircle(cx, cy, r * 0.45);
      g.fillStyle(spec, 0.46);  g.fillCircle(cx - r*0.24, cy - r*0.3, r * 0.2);
      g.fillStyle(spec, 0.32);  g.fillCircle(cx - r*0.52, cy - r*0.44, r * 0.26);
      g.lineStyle(2, darken(bodyColor, 55), 0.65); g.strokeCircle(cx, cy, r * 0.82);
      break;
    case 'spiky': {
      g.fillStyle(lighten(bodyColor, 22), 0.10); g.fillCircle(cx, cy, r + 14);
      const spikes = 5;
      const shadowPts: Phaser.Types.Math.Vector2Like[] = [];
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      for (let si = 0; si < spikes * 2; si++) {
        const srad = si % 2 === 0 ? r : r * 0.52;
        const sang = (si / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        shadowPts.push({ x: cx + Math.cos(sang)*srad + 4, y: cy + Math.sin(sang)*srad + 5 });
        pts.push({ x: cx + Math.cos(sang)*srad, y: cy + Math.sin(sang)*srad });
      }
      g.fillStyle(shadow, 0.5);    g.fillPoints(shadowPts, true);
      g.fillStyle(bodyColor, 1);   g.fillPoints(pts, true);
      g.fillStyle(belly, 0.38);    g.fillCircle(cx, cy + r*0.1, r * 0.42);
      g.fillStyle(spec, 0.44);     g.fillCircle(cx - r*0.2, cy - r*0.22, r * 0.18);
      g.fillStyle(spec, 0.30);     g.fillCircle(cx - r*0.46, cy - r*0.38, r * 0.22);
      g.lineStyle(2, darken(bodyColor, 55), 0.65); g.strokePoints(pts, true);
      break;
    }
    case 'flat':
      g.fillStyle(lighten(bodyColor, 22), 0.10); g.fillEllipse(cx, cy, (r+14)*2.2, (r+14)*1.15);
      g.fillStyle(shadow, 0.5);    g.fillEllipse(cx + 5, cy + 5, r * 2.25, r * 1.18);
      g.fillStyle(bodyColor, 1);   g.fillEllipse(cx, cy, r * 2.2, r * 1.15);
      g.fillStyle(belly, 0.44);    g.fillEllipse(cx + r*0.1, cy + r*0.08, r * 1.1, r * 0.52);
      g.fillStyle(spec, 0.50);     g.fillEllipse(cx - r*0.42, cy - r*0.2, r * 0.52, r * 0.26);
      g.fillStyle(spec, 0.32);     g.fillEllipse(cx - r*0.60, cy - r*0.14, r * 0.50, r * 0.24);
      g.lineStyle(2, darken(bodyColor, 55), 0.65); g.strokeEllipse(cx, cy, r * 2.2, r * 1.15);
      break;
    case 'long':
      g.fillStyle(lighten(bodyColor, 22), 0.10); g.fillEllipse(cx, cy, (r+14)*1.15, (r+14)*2.2);
      g.fillStyle(shadow, 0.5);    g.fillEllipse(cx + 4, cy + 5, r * 1.18, r * 2.25);
      g.fillStyle(bodyColor, 1);   g.fillEllipse(cx, cy, r * 1.15, r * 2.2);
      g.fillStyle(belly, 0.44);    g.fillEllipse(cx + r*0.05, cy + r*0.1, r * 0.52, r * 1.1);
      g.fillStyle(spec, 0.50);     g.fillEllipse(cx - r*0.18, cy - r*0.45, r * 0.26, r * 0.52);
      g.fillStyle(spec, 0.32);     g.fillEllipse(cx - r*0.12, cy - r*0.65, r * 0.24, r * 0.48);
      g.lineStyle(2, darken(bodyColor, 55), 0.65); g.strokeEllipse(cx, cy, r * 1.15, r * 2.2);
      break;
  }
}

function drawTail(g: Phaser.GameObjects.Graphics, sp: Species, bodyColor: number, cx: number, cy: number, r: number) {
  const tailBase = darken(bodyColor, 22);
  const tailTip  = lighten(bodyColor, 18);
  switch (sp.bodyShape) {
    case 'round':
      g.fillStyle(tailBase, 1);
      g.fillEllipse(cx + r*0.9, cy + r*0.52, r*0.4, r*0.22);
      g.fillCircle(cx + r*1.1, cy + r*0.42, r*0.18);
      g.fillCircle(cx + r*1.22, cy + r*0.3, r*0.12);
      g.fillStyle(tailTip, 0.6); g.fillCircle(cx + r*1.22, cy + r*0.3, r*0.08);
      break;
    case 'lumpy':
      g.fillStyle(tailBase, 1);
      g.fillCircle(cx + r*0.88, cy + r*0.52, r*0.22);
      g.fillCircle(cx + r*1.06, cy + r*0.44, r*0.16);
      g.fillStyle(tailTip, 0.55); g.fillCircle(cx + r*1.06, cy + r*0.44, r*0.1);
      break;
    case 'spiky':
      g.fillStyle(tailBase, 1);
      g.fillTriangle(cx + r*0.68, cy + r*0.38, cx + r*1.28, cy + r*0.08, cx + r*0.82, cy + r*0.68);
      g.fillStyle(tailTip, 0.38);
      g.fillTriangle(cx + r*0.72, cy + r*0.42, cx + r*1.1, cy + r*0.18, cx + r*0.86, cy + r*0.58);
      break;
    case 'flat':
      g.fillStyle(tailBase, 1);  g.fillEllipse(cx + r*1.1, cy, r*0.58, r*0.3);
      g.fillStyle(tailTip, 0.45); g.fillEllipse(cx + r*1.08, cy - r*0.04, r*0.36, r*0.17);
      break;
    case 'long':
      g.fillStyle(tailBase, 1);
      g.fillEllipse(cx + r*0.2,  cy + r*1.02, r*0.52, r*0.26);
      g.fillEllipse(cx + r*0.38, cy + r*1.14, r*0.36, r*0.2);
      g.fillStyle(tailTip, 0.45); g.fillEllipse(cx + r*0.38, cy + r*1.14, r*0.2, r*0.12);
      break;
  }
}

function drawLegs(g: Phaser.GameObjects.Graphics, sp: Species, bodyColor: number, cx: number, cy: number, r: number) {
  const legCol = darken(bodyColor, 22);
  if (sp.bodyShape === 'round') {
    g.lineStyle(2.5, legCol, 0.88);
    const pairs = [{ dy: -r*0.08, ext: 0.22 }, { dy: r*0.14, ext: 0.28 }, { dy: r*0.34, ext: 0.18 }];
    pairs.forEach(lp => {
      g.beginPath(); g.moveTo(cx - r*0.84, cy + lp.dy); g.lineTo(cx - r*1.22, cy + lp.dy + r*lp.ext); g.strokePath();
      g.beginPath(); g.moveTo(cx + r*0.84, cy + lp.dy); g.lineTo(cx + r*1.22, cy + lp.dy + r*lp.ext); g.strokePath();
    });
  } else if (sp.bodyShape === 'spiky') {
    g.lineStyle(3.2, legCol, 0.9);
    g.beginPath(); g.moveTo(cx - r*0.52, cy + r*0.18); g.lineTo(cx - r*0.82, cy + r*0.54); g.lineTo(cx - r*1.02, cy + r*0.46); g.strokePath();
    g.beginPath(); g.moveTo(cx + r*0.52, cy + r*0.18); g.lineTo(cx + r*0.82, cy + r*0.54); g.lineTo(cx + r*1.02, cy + r*0.46); g.strokePath();
    g.beginPath(); g.moveTo(cx - r*0.26, cy + r*0.34); g.lineTo(cx - r*0.58, cy + r*0.68); g.lineTo(cx - r*0.78, cy + r*0.58); g.strokePath();
    g.beginPath(); g.moveTo(cx + r*0.26, cy + r*0.34); g.lineTo(cx + r*0.58, cy + r*0.68); g.lineTo(cx + r*0.78, cy + r*0.58); g.strokePath();
  } else if (sp.bodyShape === 'flat') {
    g.lineStyle(3.5, legCol, 0.9);
    g.beginPath(); g.moveTo(cx - r*0.76, cy - r*0.02); g.lineTo(cx - r*1.08, cy + r*0.30); g.lineTo(cx - r*1.26, cy + r*0.20); g.strokePath();
    g.beginPath(); g.moveTo(cx + r*0.76, cy - r*0.02); g.lineTo(cx + r*1.08, cy + r*0.30); g.lineTo(cx + r*1.26, cy + r*0.20); g.strokePath();
    g.beginPath(); g.moveTo(cx - r*0.56, cy + r*0.22); g.lineTo(cx - r*0.98, cy + r*0.50); g.lineTo(cx - r*1.18, cy + r*0.38); g.strokePath();
    g.beginPath(); g.moveTo(cx + r*0.56, cy + r*0.22); g.lineTo(cx + r*0.98, cy + r*0.50); g.lineTo(cx + r*1.18, cy + r*0.38); g.strokePath();
  }
}

function drawFeatures(g: Phaser.GameObjects.Graphics, sp: Species, bodyColor: number, cx: number, cy: number, r: number) {
  const irisColor = shiftHue(bodyColor, 150);
  const eyeOffY = sp.bodyShape === 'flat' ? 0.14 : sp.bodyShape === 'long' ? 0.26 : 0.08;
  const eyeY = cy - r * eyeOffY;
  const eyeX = r * 0.26;
  const er = Math.max(5.0, r * 0.18);

  g.fillStyle(irisColor, 0.12);
  g.fillCircle(cx - eyeX, eyeY, er * 2.6); g.fillCircle(cx + eyeX, eyeY, er * 2.6);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - eyeX, eyeY, er * 1.75); g.fillCircle(cx + eyeX, eyeY, er * 1.75);
  g.fillStyle(irisColor, 1);
  g.fillCircle(cx - eyeX, eyeY + 0.6, er * 1.28); g.fillCircle(cx + eyeX, eyeY + 0.6, er * 1.28);
  g.fillStyle(0x080015, 1);
  g.fillCircle(cx - eyeX + 1, eyeY + 1, er * 0.72); g.fillCircle(cx + eyeX + 1, eyeY + 1, er * 0.72);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - eyeX + er*0.42, eyeY - er*0.40, er * 0.45);
  g.fillCircle(cx + eyeX + er*0.42, eyeY - er*0.40, er * 0.45);
  g.fillStyle(0xffffff, 0.55);
  g.fillCircle(cx - eyeX - er*0.30, eyeY + er*0.30, er * 0.23);
  g.fillCircle(cx + eyeX - er*0.30, eyeY + er*0.30, er * 0.23);

  // Blush marks
  g.fillStyle(0xFF6688, 0.20);
  g.fillEllipse(cx - eyeX - er*1.0, eyeY + er*1.35, er*2.8, er*0.95);
  g.fillEllipse(cx + eyeX + er*1.0, eyeY + er*1.35, er*2.8, er*0.95);

  const mouthR = r * (sp.bodyShape === 'flat' ? 0.23 : 0.22);
  const mouthY = eyeY + r * (sp.bodyShape === 'flat' ? 0.30 : 0.35);
  g.lineStyle(Math.max(2.5, r * 0.08), darken(bodyColor, 30), 1);
  g.beginPath();
  g.arc(cx, mouthY, mouthR, 0.1 * Math.PI, 0.9 * Math.PI, false);
  g.strokePath();

  if (sp.habitat === 'dirt') {
    const hornW = r * 0.13, hornH = r * 0.27;
    const hornTopY = cy - r * (sp.bodyShape === 'flat' ? 0.54 : sp.bodyShape === 'long' ? 0.92 : 0.84);
    g.fillStyle(darken(bodyColor, 28), 1);
    g.fillTriangle(cx - r*0.26, hornTopY, cx - r*0.26 - hornW, hornTopY + hornH, cx - r*0.26 + hornW, hornTopY + hornH);
    g.fillTriangle(cx + r*0.26, hornTopY, cx + r*0.26 - hornW, hornTopY + hornH, cx + r*0.26 + hornW, hornTopY + hornH);
    g.fillStyle(lighten(bodyColor, 24), 0.5);
    g.fillTriangle(cx - r*0.26, hornTopY + 3, cx - r*0.26 - hornW*0.4, hornTopY + hornH*0.5, cx - r*0.26 + hornW*0.4, hornTopY + hornH*0.5);
    g.fillTriangle(cx + r*0.26, hornTopY + 3, cx + r*0.26 - hornW*0.4, hornTopY + hornH*0.5, cx + r*0.26 + hornW*0.4, hornTopY + hornH*0.5);
  } else if (sp.habitat === 'grass') {
    const earR = sp.bodyShape === 'flat' ? r * 1.02 : r * 0.86;
    g.fillStyle(lighten(bodyColor, 28), 1);
    g.fillEllipse(cx - earR, eyeY - r*0.1, r*0.34, r*0.58);
    g.fillEllipse(cx + earR, eyeY - r*0.1, r*0.34, r*0.58);
    g.fillStyle(lighten(bodyColor, 55), 0.5);
    g.fillEllipse(cx - earR, eyeY - r*0.08, r*0.18, r*0.36);
    g.fillEllipse(cx + earR, eyeY - r*0.08, r*0.18, r*0.36);
  } else if (sp.habitat === 'aquatic') {
    const finBaseY = cy + r * 0.08;
    const finW = r * 0.36, finH = r * 0.52;
    const finX = sp.bodyShape === 'flat' ? r * 1.02 : sp.bodyShape === 'long' ? r * 0.54 : r * 0.84;
    g.fillStyle(lighten(bodyColor, 22), 0.88);
    g.fillTriangle(cx - finX, finBaseY, cx - finX - finW, finBaseY - finH/2, cx - finX - finW, finBaseY + finH/2);
    g.fillTriangle(cx + finX, finBaseY, cx + finX + finW, finBaseY - finH/2, cx + finX + finW, finBaseY + finH/2);
    g.fillStyle(lighten(bodyColor, 48), 0.4);
    g.fillTriangle(cx - finX + 2, finBaseY, cx - finX - finW*0.55, finBaseY - finH*0.38, cx - finX - finW*0.55, finBaseY + finH*0.38);
    g.fillTriangle(cx + finX - 2, finBaseY, cx + finX + finW*0.55, finBaseY - finH*0.38, cx + finX + finW*0.55, finBaseY + finH*0.38);
  }

  if (Math.floor(sp.id * 7) % 3 === 1) {
    g.fillStyle(darken(bodyColor, 30), 0.65);
    const spr = r * 0.11;
    g.fillCircle(cx + r*0.22, cy + r*0.2, spr);
    g.fillCircle(cx - r*0.18, cy + r*0.3, spr * 0.75);
    g.fillCircle(cx + r*0.38, cy, spr * 0.85);
    g.fillCircle(cx - r*0.32, cy + r*0.05, spr * 0.65);
  }
  if (Math.floor(sp.id * 11) % 5 === 3) {
    g.lineStyle(Math.max(2.5, r * 0.09), darken(bodyColor, 40), 0.42);
    g.beginPath(); g.moveTo(cx - r*0.36, cy - r*0.50); g.lineTo(cx + r*0.10, cy + r*0.44); g.strokePath();
    g.beginPath(); g.moveTo(cx + r*0.04, cy - r*0.50); g.lineTo(cx + r*0.46, cy + r*0.34); g.strokePath();
  }
}

function drawGoldenGlow(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number) {
  g.fillStyle(0xFFD700, 0.06);  g.fillCircle(cx, cy, r + 20);
  g.fillStyle(0xFFD700, 0.09);  g.fillCircle(cx, cy, r + 13);
  g.lineStyle(4, 0xFFD700, 0.94); g.strokeCircle(cx, cy, r + 5);
  g.lineStyle(2, 0xFFF59D, 0.55); g.strokeCircle(cx, cy, r + 10);
  g.lineStyle(1, 0xFFE082, 0.28); g.strokeCircle(cx, cy, r + 16);
  const sparks: [number, number, number][] = [
    [cx - r*0.72, cy - r*0.70, 3.2], [cx + r*0.68, cy - r*0.64, 2.2],
    [cx - r*0.60, cy + r*0.68, 2.0], [cx + r*0.58, cy + r*0.52, 1.6],
  ];
  sparks.forEach(([sx, sy, sr]) => {
    g.fillStyle(0xFFFFFF, 0.9); g.fillCircle(sx, sy, sr);
    g.fillStyle(0xFFD700, 0.45); g.fillCircle(sx, sy, sr * 2.2);
  });
}

// ── PNG sprite loader (with SVG fallback) ─────────────────────────────────────

export function preloadMonsterTexture(scene: Phaser.Scene, monster: Monster): Promise<string> {
  const key = 'mon_' + monster.speciesId + '_' + monster.variantIndex;
  if (scene.textures.exists(key)) return Promise.resolve(key);

  const sp   = SPECIES[monster.speciesId];
  const mods = getVariantModifiers(monster.variantIndex);

  const buildFromSource = (src: CanvasImageSource) => {
    const SIZE = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;
    if (mods.hueShift !== 0) ctx.filter = `hue-rotate(${mods.hueShift}deg)`;
    ctx.drawImage(src as HTMLImageElement, 0, 0, SIZE, SIZE);
    ctx.filter = 'none';
    if (mods.isGolden) {
      const grd = ctx.createRadialGradient(256, 256, 140, 256, 256, 280);
      grd.addColorStop(0, 'rgba(255,215,0,0)');
      grd.addColorStop(1, 'rgba(255,215,0,0.55)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.strokeStyle = 'rgba(255,215,0,0.92)';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, SIZE - 10, SIZE - 10);
    }
    scene.textures.addCanvas(key, canvas);
  };

  const fallbackToSVG = () => new Promise<string>(resolve => {
    const bc     = shiftHue(sp.baseColor, mods.hueShift);
    const sc     = darken(bc, 50);
    const lc     = lighten(bc, 48);
    const ec     = shiftHue(bc, 150);
    const svgStr = buildMonsterSVG(sp.bodyShape, bc, sc, lc, ec, sp.habitat, mods.isGolden);
    const img    = new window.Image(256, 256);
    img.onload   = () => { scene.textures.addImage(key, img); resolve(key); };
    img.onerror  = () => { resolve(makeMonsterTextureFallback(scene, monster)); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
  });

  return new Promise<string>(resolve => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => { buildFromSource(img); resolve(key); };
    img.onerror = () => { fallbackToSVG().then(resolve); };
    img.src = `/sprites/${sp.bodyShape}_${sp.habitat}.png`;
  });
}

// Synchronous fallback (Graphics-based) used when SVG hasn't been pre-loaded.
function makeMonsterTextureFallback(scene: Phaser.Scene, monster: Monster): string {
  const key = 'mon_' + monster.speciesId + '_' + monster.variantIndex;
  if (scene.textures.exists(key)) return key;
  const sp = SPECIES[monster.speciesId];
  const mods = getVariantModifiers(monster.variantIndex);
  const bodyColor = shiftHue(sp.baseColor, mods.hueShift);
  const SIZE = 128, cx = 64, cy = 64;
  const r = sp.bodyShape === 'flat' ? 36 : sp.bodyShape === 'long' ? 32 : 42;
  const g = scene.make.graphics({ x: 0, y: 0, add: false } as any);
  drawLegs(g, sp, bodyColor, cx, cy, r);
  drawTail(g, sp, bodyColor, cx, cy, r);
  drawBody(g, sp, bodyColor, cx, cy, r);
  drawFeatures(g, sp, bodyColor, cx, cy, r);
  if (mods.isGolden) drawGoldenGlow(g, cx, cy, r);
  g.generateTexture(key, SIZE, SIZE);
  g.destroy();
  return key;
}

export function makeMonsterTexture(scene: Phaser.Scene, monster: Monster): string {
  const key = 'mon_' + monster.speciesId + '_' + monster.variantIndex;
  if (scene.textures.exists(key)) return key;
  return makeMonsterTextureFallback(scene, monster);
}
