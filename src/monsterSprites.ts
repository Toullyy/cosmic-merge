// SVG sprite templates for the 5 monster body shapes.
// Each function receives hex color values and returns a complete SVG string
// rendered at 256×256 pixels using a 128×128 coordinate system.

function h(c: number): string {
  return '#' + Math.max(0, Math.min(0xFFFFFF, c)).toString(16).padStart(6, '0');
}

// ── Shared kawaii eye block (cx1/cx2 = left/right center x, ey = eye y) ──────
function eyes(cx1: number, cx2: number, ey: number, ec: string): string {
  return `
<circle cx="${cx1}" cy="${ey}" r="20" fill="${ec}" opacity="0.12"/>
<circle cx="${cx2}" cy="${ey}" r="20" fill="${ec}" opacity="0.12"/>
<circle cx="${cx1}" cy="${ey}" r="16" fill="white"/>
<circle cx="${cx2}" cy="${ey}" r="16" fill="white"/>
<circle cx="${cx1}" cy="${ey + 1}" r="12" fill="${ec}"/>
<circle cx="${cx2}" cy="${ey + 1}" r="12" fill="${ec}"/>
<circle cx="${cx1 + 1}" cy="${ey + 2}" r="8" fill="#0A001E"/>
<circle cx="${cx2 + 1}" cy="${ey + 2}" r="8" fill="#0A001E"/>
<circle cx="${cx1 + 5}" cy="${ey - 5}" r="5.5" fill="white"/>
<circle cx="${cx2 + 5}" cy="${ey - 5}" r="5.5" fill="white"/>
<circle cx="${cx1 - 4}" cy="${ey + 5}" r="2.8" fill="white" opacity="0.65"/>
<circle cx="${cx2 - 4}" cy="${ey + 5}" r="2.8" fill="white" opacity="0.65"/>
<circle cx="${cx1 - 2}" cy="${ey + 8}" r="1.8" fill="white" opacity="0.45"/>
<circle cx="${cx2 - 2}" cy="${ey + 8}" r="1.8" fill="white" opacity="0.45"/>
<circle cx="${cx1}" cy="${ey}" r="16" fill="none" stroke="#0A001E" stroke-width="2.5"/>
<circle cx="${cx2}" cy="${ey}" r="16" fill="none" stroke="#0A001E" stroke-width="2.5"/>
<circle cx="${cx1}" cy="${ey + 1}" r="12" fill="none" stroke="#0A001E" stroke-width="1.5" opacity="0.45"/>
<circle cx="${cx2}" cy="${ey + 1}" r="12" fill="none" stroke="#0A001E" stroke-width="1.5" opacity="0.45"/>`;
}

// ── Shared blush block ─────────────────────────────────────────────────────────
function blush(lx: number, rx: number, y: number): string {
  return `
<ellipse cx="${lx}" cy="${y}" rx="18" ry="10" fill="#FF3366" opacity="0.60"/>
<ellipse cx="${rx}" cy="${y}" rx="18" ry="10" fill="#FF3366" opacity="0.60"/>
<ellipse cx="${lx}" cy="${y}" rx="11" ry="6" fill="#FF5599" opacity="0.28"/>
<ellipse cx="${rx}" cy="${y}" rx="11" ry="6" fill="#FF5599" opacity="0.28"/>`;
}

// ── Shared open-mouth block (cx = center x, my = mouth top y) ─────────────────
function mouth(cx: number, my: number): string {
  const mx1 = cx - 14, mx2 = cx + 14;
  return `
<path d="M ${mx1} ${my} Q ${cx} ${my + 16} ${mx2} ${my}" fill="#2A0010" stroke="#0A001E" stroke-width="2.5"/>
<path d="M ${mx1 + 2} ${my} Q ${cx} ${my + 12} ${mx2 - 2} ${my}" fill="#CC1140"/>
<path d="M ${mx1 + 2} ${my} L ${mx1 + 8} ${my} L ${mx1 + 7} ${my + 7} L ${mx1 + 3} ${my + 7} Z" fill="white"/>
<path d="M ${mx1 + 9} ${my} L ${cx + 1} ${my} L ${cx + 1} ${my + 7} L ${mx1 + 9} ${my + 7} Z" fill="white"/>
<path d="M ${cx + 2} ${my} L ${mx2 - 4} ${my} L ${mx2 - 5} ${my + 7} L ${cx + 1} ${my + 7} Z" fill="white"/>
<line x1="${mx1 + 8}" y1="${my}" x2="${mx1 + 7}" y2="${my + 7}" stroke="#DDDDDD" stroke-width="0.8"/>
<line x1="${cx + 1}" y1="${my}" x2="${cx + 1}" y2="${my + 7}" stroke="#DDDDDD" stroke-width="0.8"/>
<ellipse cx="${cx}" cy="${my + 9}" rx="8" ry="4" fill="#FF4477" opacity="0.75"/>
<path d="M ${mx1} ${my} Q ${cx} ${my + 16} ${mx2} ${my}" fill="none" stroke="#0A001E" stroke-width="2.5"/>`;
}

// ── Leaf sprouts for dirt habitat (head top around ht = head top y coord) ─────
function dirtLeaves(ht: number): string {
  const bot = ht + 16;
  return `
<ellipse cx="64" cy="${ht - 2}" rx="5.5" ry="11" fill="#66BB6A" stroke="#388E3C" stroke-width="1"/>
<ellipse cx="64" cy="${ht - 2}" rx="2.5" ry="5.5" fill="#A5D6A7" opacity="0.55"/>
<line x1="64" y1="${bot - 4}" x2="64" y2="${ht - 12}" stroke="#2E7D32" stroke-width="1.4" opacity="0.65"/>
<ellipse cx="50" cy="${ht + 4}" rx="5" ry="10" fill="#5CB85C" stroke="#388E3C" stroke-width="1" transform="rotate(-26,50,${bot})"/>
<ellipse cx="50" cy="${ht + 4}" rx="2.3" ry="5" fill="#A5D6A7" opacity="0.55" transform="rotate(-26,50,${bot})"/>
<ellipse cx="78" cy="${ht + 4}" rx="5" ry="10" fill="#5CB85C" stroke="#388E3C" stroke-width="1" transform="rotate(26,78,${bot})"/>
<ellipse cx="78" cy="${ht + 4}" rx="2.3" ry="5" fill="#A5D6A7" opacity="0.55" transform="rotate(26,78,${bot})"/>`;
}

// ── bugSVG — round chibi creature ────────────────────────────────────────────
function bugSVG(bc: number, sc: number, lc: number, ec: number, habitat: string): string {
  const b = h(bc), s = h(sc), l = h(lc), e = h(ec);

  const gExt = habitat === 'grass' ? `
<ellipse cx="28" cy="48" rx="13" ry="19" fill="#4CAF50" opacity="0.88" transform="rotate(-14,28,48)"/>
<ellipse cx="100" cy="48" rx="13" ry="19" fill="#4CAF50" opacity="0.88" transform="rotate(14,100,48)"/>
<ellipse cx="28" cy="48" rx="6.5" ry="10" fill="#81C784" opacity="0.60" transform="rotate(-14,28,48)"/>
<ellipse cx="100" cy="48" rx="6.5" ry="10" fill="#81C784" opacity="0.60" transform="rotate(14,100,48)"/>` : '';

  const dExt = habitat === 'dirt' ? dirtLeaves(16) : '';

  const aExt = habitat === 'aquatic' ? `
<polygon points="44,100 28,93 28,107" fill="${l}" opacity="0.75"/>
<polygon points="84,100 100,93 100,107" fill="${l}" opacity="0.75"/>
<polygon points="44,100 31,95 31,105" fill="white" opacity="0.35"/>
<polygon points="84,100 97,95 97,105" fill="white" opacity="0.35"/>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="256" height="256">
<defs>
<radialGradient id="bg" cx="32%" cy="28%" r="72%">
<stop offset="0%" stop-color="${l}"/>
<stop offset="42%" stop-color="${b}"/>
<stop offset="100%" stop-color="${s}"/>
</radialGradient>
</defs>
<ellipse cx="64" cy="122" rx="26" ry="7" fill="black" opacity="0.15"/>
${gExt}${dExt}
<ellipse cx="85" cy="98" rx="7" ry="5" fill="${s}" opacity="0.80"/>
<ellipse cx="90" cy="94" rx="4.5" ry="4.5" fill="${s}" opacity="0.75"/>
<ellipse cx="85" cy="98" rx="4" ry="3" fill="${l}" opacity="0.30"/>
<ellipse cx="54" cy="114" rx="9" ry="5" fill="${s}" stroke="#0A001E" stroke-width="2"/>
<ellipse cx="74" cy="114" rx="9" ry="5" fill="${s}" stroke="#0A001E" stroke-width="2"/>
<ellipse cx="54" cy="113" rx="5" ry="2.5" fill="${l}" opacity="0.30"/>
<ellipse cx="74" cy="113" rx="5" ry="2.5" fill="${l}" opacity="0.30"/>
<ellipse cx="64" cy="90" rx="20" ry="5" fill="#0A001E" opacity="0.22"/>
<circle cx="65" cy="101" r="14" fill="#0A001E" opacity="0.88"/>
<ellipse cx="65" cy="102" rx="13" ry="8" fill="${s}" opacity="0.28"/>
<ellipse cx="64" cy="100" rx="20" ry="13" fill="url(#bg)" stroke="#0A001E" stroke-width="4"/>
<g fill="${l}" opacity="0.45">
<ellipse cx="46" cy="93" rx="4" ry="2" transform="rotate(-50,46,93)"/>
<ellipse cx="52" cy="108" rx="3.5" ry="1.8" transform="rotate(-90,52,108)"/>
<ellipse cx="76" cy="108" rx="3.5" ry="1.8" transform="rotate(90,76,108)"/>
<ellipse cx="82" cy="93" rx="4" ry="2" transform="rotate(50,82,93)"/>
</g>
${aExt}
<ellipse cx="22" cy="78" rx="12" ry="8" fill="${s}" stroke="#0A001E" stroke-width="2.5"/>
<ellipse cx="22" cy="78" rx="9" ry="6" fill="${b}"/>
<ellipse cx="22" cy="74" rx="5.5" ry="3.5" fill="${l}" opacity="0.35"/>
<ellipse cx="106" cy="78" rx="12" ry="8" fill="${s}" stroke="#0A001E" stroke-width="2.5"/>
<ellipse cx="106" cy="78" rx="9" ry="6" fill="${b}"/>
<ellipse cx="106" cy="74" rx="5.5" ry="3.5" fill="${l}" opacity="0.35"/>
<circle cx="65" cy="51" r="37" fill="#0A001E" opacity="0.88"/>
<circle cx="66" cy="52" r="34" fill="${s}" opacity="0.25"/>
<circle cx="64" cy="50" r="34" fill="url(#bg)" stroke="#0A001E" stroke-width="4.5"/>
<ellipse cx="50" cy="36" rx="15" ry="9" fill="white" opacity="0.45"/>
<ellipse cx="47" cy="33" rx="6" ry="3.5" fill="white" opacity="0.60"/>
<g fill="${l}" opacity="0.62">
<ellipse cx="36" cy="38" rx="5" ry="3" transform="rotate(-40,36,38)"/>
<ellipse cx="32" cy="50" rx="5" ry="2.5" transform="rotate(-70,32,50)"/>
<ellipse cx="36" cy="62" rx="5" ry="3" transform="rotate(-100,36,62)"/>
<ellipse cx="44" cy="72" rx="5" ry="2.5" transform="rotate(-130,44,72)"/>
<ellipse cx="64" cy="77" rx="5.5" ry="2.5" transform="rotate(180,64,77)"/>
<ellipse cx="84" cy="72" rx="5" ry="2.5" transform="rotate(130,84,72)"/>
<ellipse cx="92" cy="62" rx="5" ry="3" transform="rotate(100,92,62)"/>
<ellipse cx="96" cy="50" rx="5" ry="2.5" transform="rotate(70,96,50)"/>
<ellipse cx="92" cy="38" rx="5" ry="3" transform="rotate(40,92,38)"/>
<ellipse cx="84" cy="28" rx="5" ry="2.5" transform="rotate(20,84,28)"/>
<ellipse cx="64" cy="22" rx="5.5" ry="2.5" transform="rotate(0,64,22)"/>
<ellipse cx="44" cy="28" rx="5" ry="2.5" transform="rotate(-20,44,28)"/>
</g>
<g fill="${l}" opacity="0.30">
<ellipse cx="42" cy="44" rx="4" ry="2" transform="rotate(-30,42,44)"/>
<ellipse cx="40" cy="56" rx="3.5" ry="2" transform="rotate(-60,40,56)"/>
<ellipse cx="52" cy="70" rx="4" ry="2" transform="rotate(-120,52,70)"/>
<ellipse cx="76" cy="70" rx="4" ry="2" transform="rotate(120,76,70)"/>
<ellipse cx="88" cy="56" rx="3.5" ry="2" transform="rotate(60,88,56)"/>
<ellipse cx="86" cy="44" rx="4" ry="2" transform="rotate(30,86,44)"/>
</g>
${eyes(48, 80, 52, e)}
${blush(30, 98, 64)}
${mouth(64, 68)}
</svg>`;
}

// ── slimeSVG — chibi blob/slime ───────────────────────────────────────────────
function slimeSVG(bc: number, sc: number, lc: number, ec: number, habitat: string): string {
  const b = h(bc), s = h(sc), l = h(lc), e = h(ec);
  const blob      = 'M 64 14 C 88 14 104 36 106 62 C 108 84 102 106 84 116 C 76 122 52 122 44 116 C 24 106 22 84 24 62 C 24 36 40 14 64 14 Z';
  const blobShad  = 'M 66 17 C 91 17 108 39 110 65 C 112 87 105 109 86 118 C 78 124 54 124 46 118 C 26 109 20 87 22 65 C 22 39 41 17 66 17 Z';
  const blobBlack = 'M 64 11 C 90 11 107 34 109 61 C 111 85 104 108 83 118 C 75 124 53 124 45 118 C 22 108 17 85 19 61 C 19 34 38 11 64 11 Z';

  const gExt = habitat === 'grass' ? `
<ellipse cx="48" cy="20" rx="10" ry="7" fill="#4CAF50" opacity="0.88" transform="rotate(-18,48,20)"/>
<ellipse cx="80" cy="18" rx="9" ry="6" fill="#66BB6A" opacity="0.80" transform="rotate(14,80,18)"/>
<ellipse cx="64" cy="15" rx="8" ry="5" fill="#4CAF50" opacity="0.80" transform="rotate(4,64,15)"/>` : '';

  const dExt = habitat === 'dirt' ? dirtLeaves(14) : '';

  const aExt = habitat === 'aquatic' ? `
<ellipse cx="107" cy="64" rx="7" ry="11" fill="${l}" opacity="0.38"/>
<ellipse cx="106" cy="63" rx="3.5" ry="5.5" fill="white" opacity="0.28"/>
<ellipse cx="21" cy="64" rx="7" ry="11" fill="${l}" opacity="0.38"/>
<ellipse cx="22" cy="63" rx="3.5" ry="5.5" fill="white" opacity="0.28"/>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="256" height="256">
<defs>
<radialGradient id="bg" cx="35%" cy="28%" r="70%">
<stop offset="0%" stop-color="${l}"/>
<stop offset="42%" stop-color="${b}"/>
<stop offset="100%" stop-color="${s}"/>
</radialGradient>
</defs>
<ellipse cx="64" cy="122" rx="30" ry="7" fill="black" opacity="0.15"/>
${gExt}${dExt}${aExt}
<circle cx="48" cy="20" r="7" fill="${l}" opacity="0.55"/>
<circle cx="80" cy="20" r="7" fill="${l}" opacity="0.55"/>
<circle cx="48" cy="19" r="3.5" fill="white" opacity="0.40"/>
<circle cx="80" cy="19" r="3.5" fill="white" opacity="0.40"/>
<path d="${blobBlack}" fill="#0A001E" opacity="0.88"/>
<path d="${blobShad}" fill="${s}" opacity="0.28"/>
<path d="${blob}" fill="url(#bg)" stroke="#0A001E" stroke-width="4.5"/>
<ellipse cx="50" cy="38" rx="15" ry="9" fill="white" opacity="0.45"/>
<ellipse cx="47" cy="35" rx="6" ry="3.5" fill="white" opacity="0.60"/>
<g fill="${l}" opacity="0.58">
<ellipse cx="38" cy="30" rx="5" ry="3" transform="rotate(-40,38,30)"/>
<ellipse cx="24" cy="48" rx="5" ry="2.5" transform="rotate(-70,24,48)"/>
<ellipse cx="22" cy="66" rx="5" ry="3" transform="rotate(-90,22,66)"/>
<ellipse cx="26" cy="84" rx="5" ry="2.5" transform="rotate(-110,26,84)"/>
<ellipse cx="44" cy="18" rx="5" ry="2.5" transform="rotate(-20,44,18)"/>
<ellipse cx="64" cy="14" rx="5.5" ry="2.5" transform="rotate(0,64,14)"/>
<ellipse cx="84" cy="18" rx="5" ry="2.5" transform="rotate(20,84,18)"/>
<ellipse cx="100" cy="30" rx="5" ry="3" transform="rotate(40,100,30)"/>
<ellipse cx="106" cy="48" rx="5" ry="2.5" transform="rotate(70,106,48)"/>
<ellipse cx="106" cy="66" rx="5" ry="3" transform="rotate(90,106,66)"/>
<ellipse cx="102" cy="84" rx="5" ry="2.5" transform="rotate(110,102,84)"/>
</g>
<g fill="${l}" opacity="0.28">
<ellipse cx="32" cy="40" rx="4" ry="2" transform="rotate(-30,32,40)"/>
<ellipse cx="28" cy="60" rx="3.5" ry="2" transform="rotate(-60,28,60)"/>
<ellipse cx="36" cy="80" rx="4" ry="2" transform="rotate(-100,36,80)"/>
<ellipse cx="92" cy="40" rx="4" ry="2" transform="rotate(30,92,40)"/>
<ellipse cx="100" cy="60" rx="3.5" ry="2" transform="rotate(60,100,60)"/>
<ellipse cx="92" cy="80" rx="4" ry="2" transform="rotate(100,92,80)"/>
</g>
<ellipse cx="14" cy="80" rx="12" ry="8" fill="${s}" stroke="#0A001E" stroke-width="2"/>
<ellipse cx="14" cy="80" rx="8.5" ry="5.5" fill="${b}"/>
<ellipse cx="14" cy="76" rx="5" ry="3" fill="${l}" opacity="0.35"/>
<ellipse cx="114" cy="80" rx="12" ry="8" fill="${s}" stroke="#0A001E" stroke-width="2"/>
<ellipse cx="114" cy="80" rx="8.5" ry="5.5" fill="${b}"/>
<ellipse cx="114" cy="76" rx="5" ry="3" fill="${l}" opacity="0.35"/>
${eyes(48, 80, 54, e)}
${blush(28, 100, 67)}
${mouth(64, 72)}
</svg>`;
}

// ── salamanderSVG — chibi spiky creature ──────────────────────────────────────
function salamanderSVG(bc: number, sc: number, lc: number, ec: number, habitat: string): string {
  const b = h(bc), s = h(sc), l = h(lc), e = h(ec);

  const spikeSize = habitat === 'dirt' ? 14 : 10;
  const spikeHalf = habitat === 'dirt' ? 8  : 6;
  const spikeBase = habitat === 'dirt' ? 28 : 26;

  const spikes = `
<polygon points="50,${16 - spikeSize} ${50 - spikeHalf},${spikeBase} ${50 + spikeHalf},${spikeBase}" fill="${s}"/>
<polygon points="64,${14 - spikeSize} ${64 - spikeHalf},${spikeBase} ${64 + spikeHalf},${spikeBase}" fill="${s}"/>
<polygon points="78,${16 - spikeSize} ${78 - spikeHalf},${spikeBase} ${78 + spikeHalf},${spikeBase}" fill="${s}"/>
<polygon points="50,${18 - spikeSize} ${50 - spikeHalf + 2},${spikeBase - 4} ${50 + spikeHalf - 2},${spikeBase - 4}" fill="${l}" opacity="0.40"/>
<polygon points="64,${16 - spikeSize} ${64 - spikeHalf + 2},${spikeBase - 4} ${64 + spikeHalf - 2},${spikeBase - 4}" fill="${l}" opacity="0.40"/>
<polygon points="78,${18 - spikeSize} ${78 - spikeHalf + 2},${spikeBase - 4} ${78 + spikeHalf - 2},${spikeBase - 4}" fill="${l}" opacity="0.40"/>`;

  const gExt = habitat === 'grass' ? `
<ellipse cx="28" cy="50" rx="10" ry="16" fill="#4CAF50" opacity="0.85" transform="rotate(-12,28,50)"/>
<ellipse cx="100" cy="50" rx="10" ry="16" fill="#4CAF50" opacity="0.85" transform="rotate(12,100,50)"/>
<ellipse cx="28" cy="50" rx="5" ry="9" fill="#81C784" opacity="0.55" transform="rotate(-12,28,50)"/>
<ellipse cx="100" cy="50" rx="5" ry="9" fill="#81C784" opacity="0.55" transform="rotate(12,100,50)"/>` : '';

  const aExt = habitat === 'aquatic' ? `
<polygon points="46,100 30,94 30,106" fill="${l}" opacity="0.75"/>
<polygon points="82,100 98,94 98,106" fill="${l}" opacity="0.75"/>
<polygon points="46,100 33,96 33,104" fill="white" opacity="0.32"/>
<polygon points="82,100 95,96 95,104" fill="white" opacity="0.32"/>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="256" height="256">
<defs>
<radialGradient id="bg" cx="35%" cy="25%" r="70%">
<stop offset="0%" stop-color="${l}"/>
<stop offset="42%" stop-color="${b}"/>
<stop offset="100%" stop-color="${s}"/>
</radialGradient>
</defs>
<ellipse cx="64" cy="122" rx="26" ry="7" fill="black" opacity="0.15"/>
${gExt}${spikes}
<ellipse cx="49" cy="110" rx="8" ry="5" fill="${s}" stroke="#0A001E" stroke-width="2"/>
<ellipse cx="79" cy="110" rx="8" ry="5" fill="${s}" stroke="#0A001E" stroke-width="2"/>
<ellipse cx="50" cy="117" rx="7" ry="4" fill="${s}" stroke="#0A001E" stroke-width="2"/>
<ellipse cx="78" cy="117" rx="7" ry="4" fill="${s}" stroke="#0A001E" stroke-width="2"/>
<ellipse cx="49" cy="109" rx="4" ry="2.5" fill="${l}" opacity="0.30"/>
<ellipse cx="79" cy="109" rx="4" ry="2.5" fill="${l}" opacity="0.30"/>
<ellipse cx="86" cy="98" rx="8" ry="5" fill="${s}" opacity="0.75"/>
<ellipse cx="90" cy="94" rx="5" ry="4" fill="${s}" opacity="0.65"/>
<ellipse cx="64" cy="90" rx="18" ry="5" fill="#0A001E" opacity="0.22"/>
<circle cx="65" cy="101" r="13" fill="#0A001E" opacity="0.88"/>
<ellipse cx="65" cy="101" rx="12" ry="8" fill="${s}" opacity="0.25"/>
<ellipse cx="64" cy="100" rx="18" ry="12" fill="url(#bg)" stroke="#0A001E" stroke-width="4"/>
<g fill="${l}" opacity="0.45">
<ellipse cx="48" cy="93" rx="4" ry="2" transform="rotate(-50,48,93)"/>
<ellipse cx="54" cy="107" rx="3.5" ry="1.8" transform="rotate(-90,54,107)"/>
<ellipse cx="74" cy="107" rx="3.5" ry="1.8" transform="rotate(90,74,107)"/>
<ellipse cx="80" cy="93" rx="4" ry="2" transform="rotate(50,80,93)"/>
</g>
${aExt}
<circle cx="65" cy="51" r="37" fill="#0A001E" opacity="0.88"/>
<circle cx="66" cy="52" r="34" fill="${s}" opacity="0.25"/>
<circle cx="64" cy="50" r="34" fill="url(#bg)" stroke="#0A001E" stroke-width="4.5"/>
<ellipse cx="50" cy="36" rx="15" ry="9" fill="white" opacity="0.45"/>
<ellipse cx="47" cy="33" rx="6" ry="3.5" fill="white" opacity="0.60"/>
<g fill="${l}" opacity="0.62">
<ellipse cx="36" cy="38" rx="5" ry="3" transform="rotate(-40,36,38)"/>
<ellipse cx="32" cy="50" rx="5" ry="2.5" transform="rotate(-70,32,50)"/>
<ellipse cx="36" cy="62" rx="5" ry="3" transform="rotate(-100,36,62)"/>
<ellipse cx="44" cy="72" rx="5" ry="2.5" transform="rotate(-130,44,72)"/>
<ellipse cx="64" cy="77" rx="5.5" ry="2.5" transform="rotate(180,64,77)"/>
<ellipse cx="84" cy="72" rx="5" ry="2.5" transform="rotate(130,84,72)"/>
<ellipse cx="92" cy="62" rx="5" ry="3" transform="rotate(100,92,62)"/>
<ellipse cx="96" cy="50" rx="5" ry="2.5" transform="rotate(70,96,50)"/>
<ellipse cx="92" cy="38" rx="5" ry="3" transform="rotate(40,92,38)"/>
<ellipse cx="84" cy="28" rx="5" ry="2.5" transform="rotate(20,84,28)"/>
<ellipse cx="64" cy="22" rx="5.5" ry="2.5" transform="rotate(0,64,22)"/>
<ellipse cx="44" cy="28" rx="5" ry="2.5" transform="rotate(-20,44,28)"/>
</g>
<g fill="${l}" opacity="0.30">
<ellipse cx="42" cy="44" rx="4" ry="2" transform="rotate(-30,42,44)"/>
<ellipse cx="40" cy="56" rx="3.5" ry="2" transform="rotate(-60,40,56)"/>
<ellipse cx="52" cy="70" rx="4" ry="2" transform="rotate(-120,52,70)"/>
<ellipse cx="76" cy="70" rx="4" ry="2" transform="rotate(120,76,70)"/>
<ellipse cx="88" cy="56" rx="3.5" ry="2" transform="rotate(60,88,56)"/>
<ellipse cx="86" cy="44" rx="4" ry="2" transform="rotate(30,86,44)"/>
</g>
${eyes(48, 80, 52, e)}
${blush(30, 98, 64)}
${mouth(64, 68)}
</svg>`;
}

// ── geckoSVG — chibi gecko/lizard ─────────────────────────────────────────────
function geckoSVG(bc: number, sc: number, lc: number, ec: number, habitat: string): string {
  const b = h(bc), s = h(sc), l = h(lc), e = h(ec);

  const gExt = habitat === 'grass' ? `
<ellipse cx="28" cy="48" rx="12" ry="18" fill="#4CAF50" opacity="0.85" transform="rotate(-10,28,48)"/>
<ellipse cx="100" cy="48" rx="12" ry="18" fill="#4CAF50" opacity="0.85" transform="rotate(10,100,48)"/>
<ellipse cx="28" cy="48" rx="6" ry="10" fill="#81C784" opacity="0.55" transform="rotate(-10,28,48)"/>
<ellipse cx="100" cy="48" rx="6" ry="10" fill="#81C784" opacity="0.55" transform="rotate(10,100,48)"/>` : '';

  const dExt = habitat === 'dirt' ? `
<polygon points="52,14 47,28 57,28" fill="${s}"/>
<polygon points="76,14 71,28 81,28" fill="${s}"/>
<polygon points="52,17 48,24 56,24" fill="${l}" opacity="0.40"/>
<polygon points="76,17 72,24 80,24" fill="${l}" opacity="0.40"/>` : '';

  const aExt = habitat === 'aquatic' ? `
<polygon points="42,100 26,93 26,107" fill="${l}" opacity="0.72"/>
<polygon points="86,100 102,93 102,107" fill="${l}" opacity="0.72"/>
<polygon points="42,100 29,95 29,105" fill="white" opacity="0.30"/>
<polygon points="86,100 99,95 99,105" fill="white" opacity="0.30"/>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="256" height="256">
<defs>
<radialGradient id="bg" cx="35%" cy="28%" r="68%">
<stop offset="0%" stop-color="${l}"/>
<stop offset="42%" stop-color="${b}"/>
<stop offset="100%" stop-color="${s}"/>
</radialGradient>
</defs>
<ellipse cx="64" cy="122" rx="30" ry="7" fill="black" opacity="0.15"/>
${gExt}${dExt}
<path d="M 86 100 Q 102 96 108 88" stroke="${s}" stroke-width="5" fill="none" stroke-linecap="round"/>
<ellipse cx="108" cy="87" rx="5" ry="3.5" fill="${s}"/>
<circle cx="46" cy="112" r="6" fill="${s}" stroke="#0A001E" stroke-width="2.5"/>
<circle cx="82" cy="112" r="6" fill="${s}" stroke="#0A001E" stroke-width="2.5"/>
<circle cx="48" cy="118" r="5" fill="${s}" stroke="#0A001E" stroke-width="2"/>
<circle cx="80" cy="118" r="5" fill="${s}" stroke="#0A001E" stroke-width="2"/>
<circle cx="46" cy="111" r="2.8" fill="${l}" opacity="0.35"/>
<circle cx="82" cy="111" r="2.8" fill="${l}" opacity="0.35"/>
<ellipse cx="64" cy="90" rx="22" ry="5" fill="#0A001E" opacity="0.22"/>
<circle cx="65" cy="101" r="14" fill="#0A001E" opacity="0.88"/>
<ellipse cx="65" cy="101" rx="13" ry="8" fill="${s}" opacity="0.25"/>
<ellipse cx="64" cy="100" rx="22" ry="12" fill="url(#bg)" stroke="#0A001E" stroke-width="4"/>
<ellipse cx="50" cy="95" rx="5" ry="3" fill="${l}" opacity="0.35"/>
<ellipse cx="64" cy="93" rx="5" ry="3" fill="${l}" opacity="0.32"/>
<ellipse cx="78" cy="95" rx="5" ry="3" fill="${l}" opacity="0.35"/>
<g fill="${l}" opacity="0.45">
<ellipse cx="44" cy="93" rx="4" ry="2" transform="rotate(-50,44,93)"/>
<ellipse cx="50" cy="108" rx="3.5" ry="1.8" transform="rotate(-90,50,108)"/>
<ellipse cx="78" cy="108" rx="3.5" ry="1.8" transform="rotate(90,78,108)"/>
<ellipse cx="84" cy="93" rx="4" ry="2" transform="rotate(50,84,93)"/>
</g>
${aExt}
<circle cx="65" cy="51" r="37" fill="#0A001E" opacity="0.88"/>
<circle cx="66" cy="52" r="34" fill="${s}" opacity="0.25"/>
<circle cx="64" cy="50" r="34" fill="url(#bg)" stroke="#0A001E" stroke-width="4.5"/>
<ellipse cx="50" cy="36" rx="15" ry="9" fill="white" opacity="0.45"/>
<ellipse cx="47" cy="33" rx="6" ry="3.5" fill="white" opacity="0.60"/>
<g fill="${l}" opacity="0.62">
<ellipse cx="36" cy="38" rx="5" ry="3" transform="rotate(-40,36,38)"/>
<ellipse cx="32" cy="50" rx="5" ry="2.5" transform="rotate(-70,32,50)"/>
<ellipse cx="36" cy="62" rx="5" ry="3" transform="rotate(-100,36,62)"/>
<ellipse cx="44" cy="72" rx="5" ry="2.5" transform="rotate(-130,44,72)"/>
<ellipse cx="64" cy="77" rx="5.5" ry="2.5" transform="rotate(180,64,77)"/>
<ellipse cx="84" cy="72" rx="5" ry="2.5" transform="rotate(130,84,72)"/>
<ellipse cx="92" cy="62" rx="5" ry="3" transform="rotate(100,92,62)"/>
<ellipse cx="96" cy="50" rx="5" ry="2.5" transform="rotate(70,96,50)"/>
<ellipse cx="92" cy="38" rx="5" ry="3" transform="rotate(40,92,38)"/>
<ellipse cx="84" cy="28" rx="5" ry="2.5" transform="rotate(20,84,28)"/>
<ellipse cx="64" cy="22" rx="5.5" ry="2.5" transform="rotate(0,64,22)"/>
<ellipse cx="44" cy="28" rx="5" ry="2.5" transform="rotate(-20,44,28)"/>
</g>
<g fill="${l}" opacity="0.30">
<ellipse cx="42" cy="44" rx="4" ry="2" transform="rotate(-30,42,44)"/>
<ellipse cx="40" cy="56" rx="3.5" ry="2" transform="rotate(-60,40,56)"/>
<ellipse cx="52" cy="70" rx="4" ry="2" transform="rotate(-120,52,70)"/>
<ellipse cx="76" cy="70" rx="4" ry="2" transform="rotate(120,76,70)"/>
<ellipse cx="88" cy="56" rx="3.5" ry="2" transform="rotate(60,88,56)"/>
<ellipse cx="86" cy="44" rx="4" ry="2" transform="rotate(30,86,44)"/>
</g>
${eyes(48, 80, 52, e)}
${blush(30, 98, 64)}
${mouth(64, 68)}
</svg>`;
}

// ── caterpillarSVG — chibi caterpillar (big head + body segments) ─────────────
function caterpillarSVG(bc: number, sc: number, lc: number, ec: number, habitat: string): string {
  const b = h(bc), s = h(sc), l = h(lc), e = h(ec);

  const gExt = habitat === 'grass' ? `
<ellipse cx="90" cy="88" rx="9" ry="6" fill="#4CAF50" opacity="0.75" transform="rotate(28,90,88)"/>
<ellipse cx="90" cy="64" rx="8" ry="5" fill="#4CAF50" opacity="0.68" transform="rotate(22,90,64)"/>` : '';

  const dExt = habitat === 'dirt' ? `
<circle cx="88" cy="88" r="5.5" fill="${b}" stroke="${s}" stroke-width="1.5"/>
<circle cx="88" cy="64" r="5" fill="${b}" stroke="${s}" stroke-width="1.5"/>` : '';

  const aExt = habitat === 'aquatic' ? `
<path d="M 80 86 L 96 82 L 96 94 Z" fill="${l}" opacity="0.68"/>
<path d="M 80 62 L 95 58 L 95 70 Z" fill="${l}" opacity="0.62"/>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="256" height="256">
<defs>
<radialGradient id="bg" cx="35%" cy="28%" r="68%">
<stop offset="0%" stop-color="${l}"/>
<stop offset="42%" stop-color="${b}"/>
<stop offset="100%" stop-color="${s}"/>
</radialGradient>
<radialGradient id="bg2" cx="38%" cy="30%" r="65%">
<stop offset="0%" stop-color="${l}"/>
<stop offset="42%" stop-color="${b}"/>
<stop offset="100%" stop-color="${s}"/>
</radialGradient>
</defs>
<ellipse cx="64" cy="122" rx="22" ry="6" fill="black" opacity="0.15"/>
${gExt}${dExt}${aExt}
<ellipse cx="64" cy="79" rx="14" ry="4" fill="#0A001E" opacity="0.20"/>
<circle cx="64" cy="111" r="13" fill="#0A001E" opacity="0.85"/>
<circle cx="64" cy="110" r="11" fill="url(#bg2)" stroke="#0A001E" stroke-width="3"/>
<ellipse cx="59" cy="105" rx="5" ry="3" fill="${l}" opacity="0.28"/>
<circle cx="64" cy="88" r="16" fill="#0A001E" opacity="0.85"/>
<circle cx="64" cy="87" r="14" fill="url(#bg2)" stroke="#0A001E" stroke-width="3.5"/>
<ellipse cx="58" cy="82" rx="6" ry="3.5" fill="${l}" opacity="0.28"/>
<g fill="${l}" opacity="0.40">
<ellipse cx="52" cy="82" rx="3.5" ry="1.8" transform="rotate(-80,52,82)"/>
<ellipse cx="76" cy="82" rx="3.5" ry="1.8" transform="rotate(80,76,82)"/>
<ellipse cx="54" cy="106" rx="3" ry="1.5" transform="rotate(-80,54,106)"/>
<ellipse cx="74" cy="106" rx="3" ry="1.5" transform="rotate(80,74,106)"/>
</g>
<path d="M 56 14 Q 48 4 44 0" stroke="${s}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M 72 14 Q 80 4 84 0" stroke="${s}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<circle cx="44" cy="0" r="4.5" fill="${l}"/>
<circle cx="84" cy="0" r="4.5" fill="${l}"/>
<circle cx="43" cy="-1" r="2" fill="white" opacity="0.55"/>
<circle cx="83" cy="-1" r="2" fill="white" opacity="0.55"/>
<circle cx="65" cy="45" r="35" fill="#0A001E" opacity="0.88"/>
<circle cx="66" cy="46" r="32" fill="${s}" opacity="0.25"/>
<circle cx="64" cy="44" r="32" fill="url(#bg)" stroke="#0A001E" stroke-width="4.5"/>
<ellipse cx="50" cy="30" rx="14" ry="8" fill="white" opacity="0.45"/>
<ellipse cx="47" cy="28" rx="5.5" ry="3" fill="white" opacity="0.60"/>
<g fill="${l}" opacity="0.62">
<ellipse cx="36" cy="32" rx="5" ry="3" transform="rotate(-40,36,32)"/>
<ellipse cx="32" cy="44" rx="5" ry="2.5" transform="rotate(-70,32,44)"/>
<ellipse cx="36" cy="56" rx="5" ry="3" transform="rotate(-100,36,56)"/>
<ellipse cx="44" cy="66" rx="5" ry="2.5" transform="rotate(-130,44,66)"/>
<ellipse cx="64" cy="70" rx="5.5" ry="2.5" transform="rotate(180,64,70)"/>
<ellipse cx="84" cy="66" rx="5" ry="2.5" transform="rotate(130,84,66)"/>
<ellipse cx="92" cy="56" rx="5" ry="3" transform="rotate(100,92,56)"/>
<ellipse cx="96" cy="44" rx="5" ry="2.5" transform="rotate(70,96,44)"/>
<ellipse cx="92" cy="32" rx="5" ry="3" transform="rotate(40,92,32)"/>
<ellipse cx="84" cy="22" rx="5" ry="2.5" transform="rotate(20,84,22)"/>
<ellipse cx="64" cy="16" rx="5.5" ry="2.5" transform="rotate(0,64,16)"/>
<ellipse cx="44" cy="22" rx="5" ry="2.5" transform="rotate(-20,44,22)"/>
</g>
<g fill="${l}" opacity="0.30">
<ellipse cx="42" cy="38" rx="4" ry="2" transform="rotate(-30,42,38)"/>
<ellipse cx="40" cy="50" rx="3.5" ry="2" transform="rotate(-60,40,50)"/>
<ellipse cx="52" cy="64" rx="4" ry="2" transform="rotate(-120,52,64)"/>
<ellipse cx="76" cy="64" rx="4" ry="2" transform="rotate(120,76,64)"/>
<ellipse cx="88" cy="50" rx="3.5" ry="2" transform="rotate(60,88,50)"/>
<ellipse cx="86" cy="38" rx="4" ry="2" transform="rotate(30,86,38)"/>
</g>
${eyes(50, 78, 44, e)}
${blush(32, 96, 56)}
${mouth(64, 60)}
</svg>`;
}

const GOLDEN_OVERLAY = `
<circle cx="64" cy="64" r="55" fill="#FFD700" opacity="0.06"/>
<circle cx="64" cy="64" r="48" fill="#FFD700" opacity="0.09"/>
<circle cx="64" cy="64" r="48" fill="none" stroke="#FFD700" stroke-width="4" opacity="0.92"/>
<circle cx="64" cy="64" r="53" fill="none" stroke="#FFF59D" stroke-width="2" opacity="0.52"/>
<circle cx="20" cy="20" r="7" fill="#FFD700" opacity="0.40"/>
<circle cx="108" cy="22" r="5" fill="#FFD700" opacity="0.40"/>
<circle cx="21" cy="107" r="4.5" fill="#FFD700" opacity="0.40"/>
<circle cx="107" cy="107" r="3.5" fill="#FFD700" opacity="0.40"/>
<circle cx="20" cy="20" r="3.2" fill="white" opacity="0.90"/>
<circle cx="108" cy="22" r="2.2" fill="white" opacity="0.90"/>
<circle cx="21" cy="107" r="2" fill="white" opacity="0.90"/>
<circle cx="107" cy="107" r="1.6" fill="white" opacity="0.90"/>`;

function injectGolden(svg: string, golden: boolean): string {
  if (!golden) return svg;
  return svg.replace(/<ellipse cx="\d+?" cy="\d+?" rx="\d+?" ry="\d+?" fill="black"/, GOLDEN_OVERLAY + '\n$&');
}

function injectSpots(svg: string, sc: number): string {
  const s = h(sc);
  const circles = [
    `<circle cx="46" cy="85" r="8.5" fill="${s}" opacity="0.46"/>`,
    `<circle cx="68" cy="93" r="7.0" fill="${s}" opacity="0.40"/>`,
    `<circle cx="82" cy="84" r="6.5" fill="${s}" opacity="0.36"/>`,
    `<circle cx="54" cy="101" r="6.0" fill="${s}" opacity="0.32"/>`,
    `<circle cx="76" cy="102" r="5.5" fill="${s}" opacity="0.28"/>`,
    `<circle cx="88" cy="94" r="5.0" fill="${s}" opacity="0.25"/>`,
  ].join('');
  return svg.replace('</svg>', circles + '</svg>');
}

export function buildMonsterSVG(
  bodyShape: string, bc: number, sc: number, lc: number, ec: number,
  habitat: string, golden = false, pattern = 0
): string {
  let svg: string;
  switch (bodyShape) {
    case 'round':  svg = bugSVG(bc, sc, lc, ec, habitat); break;
    case 'lumpy':  svg = slimeSVG(bc, sc, lc, ec, habitat); break;
    case 'spiky':  svg = salamanderSVG(bc, sc, lc, ec, habitat); break;
    case 'flat':   svg = geckoSVG(bc, sc, lc, ec, habitat); break;
    case 'long':   svg = caterpillarSVG(bc, sc, lc, ec, habitat); break;
    default:       svg = bugSVG(bc, sc, lc, ec, habitat); break;
  }
  if (pattern >= 1) svg = injectSpots(svg, sc);
  return injectGolden(svg, golden);
}
