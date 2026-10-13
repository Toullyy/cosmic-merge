// SVG sprite templates for the 5 monster body shapes.
// Each function receives hex color strings and returns a complete SVG string
// rendered at 256×256 pixels using a 128×128 coordinate system.

function h(c: number): string {
  return '#' + Math.max(0, Math.min(0xFFFFFF, c)).toString(16).padStart(6, '0');
}

function bugSVG(bc: number, sc: number, lc: number, ec: number, habitat: string): string {
  const b = h(bc), s = h(sc), l = h(lc), e = h(ec);
  const gExt = habitat === 'grass' ? `
<ellipse cx="30" cy="78" rx="14" ry="22" fill="#4CAF50" opacity="0.75" transform="rotate(-22,30,78)"/>
<ellipse cx="98" cy="78" rx="14" ry="22" fill="#4CAF50" opacity="0.75" transform="rotate(22,98,78)"/>
<ellipse cx="30" cy="78" rx="7" ry="12" fill="#81C784" opacity="0.55" transform="rotate(-22,30,78)"/>
<ellipse cx="98" cy="78" rx="7" ry="12" fill="#81C784" opacity="0.55" transform="rotate(22,98,78)"/>` : '';
  const dExt = habitat === 'dirt' ? `
<path d="M 46 43 L 40 20 L 55 39 Z" fill="${s}"/>
<path d="M 64 40 L 61 18 L 74 38 Z" fill="${s}"/>
<path d="M 82 43 L 88 20 L 73 39 Z" fill="${s}"/>
<path d="M 46 44 L 43 27 L 53 41 Z" fill="${l}" opacity="0.38"/>
<path d="M 64 41 L 63 24 L 70 39 Z" fill="${l}" opacity="0.38"/>
<path d="M 82 44 L 85 27 L 75 41 Z" fill="${l}" opacity="0.38"/>` : '';
  const aExt = habitat === 'aquatic' ? `
<circle cx="94" cy="65" r="14" fill="#88DDFF" opacity="0.25"/>
<circle cx="90" cy="61" r="5" fill="white" opacity="0.40"/>
<circle cx="94" cy="65" r="14" fill="none" stroke="#66CCFF" stroke-width="1" opacity="0.5"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="256" height="256">
<defs>
<radialGradient id="bg" cx="32%" cy="28%" r="72%">
<stop offset="0%" stop-color="${l}"/>
<stop offset="55%" stop-color="${b}"/>
<stop offset="100%" stop-color="${s}"/>
</radialGradient>
</defs>
<ellipse cx="64" cy="123" rx="32" ry="6" fill="black" opacity="0.15"/>
${gExt}${dExt}
<ellipse cx="66" cy="85" rx="36" ry="42" fill="${s}" opacity="0.28"/>
<ellipse cx="64" cy="83" rx="34" ry="40" fill="url(#bg)" stroke="${s}" stroke-width="2"/>
<circle cx="48" cy="70" r="4.5" fill="${s}" opacity="0.30"/>
<circle cx="76" cy="66" r="4" fill="${s}" opacity="0.26"/>
<circle cx="86" cy="82" r="3.5" fill="${s}" opacity="0.24"/>
<circle cx="52" cy="92" r="5" fill="${s}" opacity="0.28"/>
<circle cx="78" cy="92" r="4" fill="${s}" opacity="0.24"/>
<circle cx="40" cy="86" r="3.5" fill="${s}" opacity="0.26"/>
<circle cx="64" cy="104" r="4.5" fill="${s}" opacity="0.20"/>
<circle cx="44" cy="100" r="3" fill="${s}" opacity="0.20"/>
<circle cx="84" cy="100" r="3" fill="${s}" opacity="0.20"/>
<ellipse cx="48" cy="60" rx="15" ry="9" fill="white" opacity="0.20"/>
<ellipse cx="46" cy="58" rx="6" ry="3.5" fill="white" opacity="0.28"/>
${aExt}
<circle cx="48" cy="60" r="13" fill="${e}" opacity="0.14"/>
<circle cx="80" cy="60" r="13" fill="${e}" opacity="0.14"/>
<circle cx="48" cy="60" r="11" fill="white"/>
<circle cx="80" cy="60" r="11" fill="white"/>
<circle cx="48" cy="61.5" r="7.5" fill="${e}"/>
<circle cx="80" cy="61.5" r="7.5" fill="${e}"/>
<circle cx="49.5" cy="63" r="4.5" fill="#0A001E"/>
<circle cx="81.5" cy="63" r="4.5" fill="#0A001E"/>
<circle cx="53" cy="57" r="3.2" fill="white"/>
<circle cx="85" cy="57" r="3.2" fill="white"/>
<circle cx="47" cy="65" r="1.6" fill="white" opacity="0.65"/>
<circle cx="79" cy="65" r="1.6" fill="white" opacity="0.65"/>
<ellipse cx="32" cy="67" rx="10" ry="5" fill="#FF6B8A" opacity="0.28"/>
<ellipse cx="96" cy="67" rx="10" ry="5" fill="#FF6B8A" opacity="0.28"/>
<path d="M 50 74 L 78 74 Q 78 86 64 89 Q 50 86 50 74 Z" fill="#1A0008"/>
<polygon points="52,74 56,74 54,81" fill="white"/>
<polygon points="58,74 62,74 60,81" fill="white"/>
<polygon points="64,74 68,74 66,81" fill="white"/>
<polygon points="70,74 74,74 72,81" fill="white"/>
<polygon points="55,89 58,89 56.5,83" fill="white"/>
<polygon points="62,89 65,89 63.5,83" fill="white"/>
<polygon points="69,89 72,89 70.5,83" fill="white"/>
<line x1="50" y1="74" x2="78" y2="74" stroke="${s}" stroke-width="2" stroke-linecap="round"/>
<path d="M 50 74 Q 50 90 64 91 Q 78 90 78 74" stroke="${s}" stroke-width="2" fill="none"/>
<ellipse cx="50" cy="119" rx="11" ry="7" fill="${s}" opacity="0.80"/>
<ellipse cx="78" cy="119" rx="11" ry="7" fill="${s}" opacity="0.80"/>
<ellipse cx="50" cy="118" rx="6" ry="3.5" fill="${l}" opacity="0.30"/>
<ellipse cx="78" cy="118" rx="6" ry="3.5" fill="${l}" opacity="0.30"/>
</svg>`;
}

function slimeSVG(bc: number, sc: number, lc: number, ec: number, habitat: string): string {
  const b = h(bc), s = h(sc), l = h(lc), e = h(ec);
  const blob = 'M 64 22 C 84 22 104 42 106 64 C 108 86 96 106 64 112 C 32 106 20 86 22 64 C 24 42 44 22 64 22 Z';
  const blobShad = 'M 67 26 C 88 26 108 46 110 68 C 112 90 100 110 67 116 C 34 110 22 90 24 68 C 26 46 46 26 67 26 Z';
  const gExt = habitat === 'grass' ? `
<ellipse cx="64" cy="24" rx="13" ry="8" fill="#4CAF50" opacity="0.85" transform="rotate(-12,64,24)"/>
<ellipse cx="76" cy="20" rx="10" ry="6" fill="#66BB6A" opacity="0.78" transform="rotate(14,76,20)"/>
<ellipse cx="52" cy="21" rx="8" ry="5" fill="#4CAF50" opacity="0.72" transform="rotate(-24,52,21)"/>` : '';
  const dExt = habitat === 'dirt' ? `
<ellipse cx="50" cy="29" rx="7" ry="5" fill="${s}" transform="rotate(-20,50,29)"/>
<ellipse cx="78" cy="29" rx="7" ry="5" fill="${s}" transform="rotate(20,78,29)"/>
<ellipse cx="50" cy="28" rx="3.5" ry="2.5" fill="${l}" opacity="0.4" transform="rotate(-20,50,28)"/>
<ellipse cx="78" cy="28" rx="3.5" ry="2.5" fill="${l}" opacity="0.4" transform="rotate(20,78,28)"/>` : '';
  const aExt = habitat === 'aquatic' ? `
<ellipse cx="90" cy="50" rx="7" ry="10" fill="${l}" opacity="0.35"/>
<ellipse cx="84" cy="90" rx="5.5" ry="7.5" fill="${l}" opacity="0.28"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="256" height="256">
<defs>
<radialGradient id="bg" cx="35%" cy="28%" r="70%">
<stop offset="0%" stop-color="${l}"/>
<stop offset="55%" stop-color="${b}"/>
<stop offset="100%" stop-color="${s}"/>
</radialGradient>
</defs>
<ellipse cx="66" cy="118" rx="36" ry="8" fill="black" opacity="0.15"/>
<path d="${blobShad}" fill="${s}" opacity="0.30"/>
<path d="${blob}" fill="url(#bg)" stroke="${s}" stroke-width="2"/>
<ellipse cx="46" cy="42" rx="16" ry="11" fill="white" opacity="0.20"/>
<ellipse cx="43" cy="39" rx="6" ry="4" fill="white" opacity="0.28"/>
<ellipse cx="64" cy="70" rx="26" ry="30" fill="${l}" opacity="0.14"/>
${gExt}${dExt}${aExt}
<ellipse cx="21" cy="78" rx="10" ry="7" fill="${b}" stroke="${s}" stroke-width="1.5"/>
<ellipse cx="107" cy="78" rx="10" ry="7" fill="${b}" stroke="${s}" stroke-width="1.5"/>
<ellipse cx="20" cy="77" rx="5" ry="3.5" fill="${l}" opacity="0.30"/>
<ellipse cx="106" cy="77" rx="5" ry="3.5" fill="${l}" opacity="0.30"/>
<circle cx="50" cy="60" r="15" fill="${e}" opacity="0.14"/>
<circle cx="78" cy="60" r="15" fill="${e}" opacity="0.14"/>
<circle cx="50" cy="60" r="12" fill="white"/>
<circle cx="78" cy="60" r="12" fill="white"/>
<circle cx="50" cy="61.5" r="8" fill="${e}"/>
<circle cx="78" cy="61.5" r="8" fill="${e}"/>
<circle cx="51.5" cy="63" r="4.8" fill="#0A001E"/>
<circle cx="79.5" cy="63" r="4.8" fill="#0A001E"/>
<circle cx="55" cy="57" r="3.2" fill="white"/>
<circle cx="83" cy="57" r="3.2" fill="white"/>
<circle cx="48.5" cy="65.5" r="1.6" fill="white" opacity="0.65"/>
<circle cx="76.5" cy="65.5" r="1.6" fill="white" opacity="0.65"/>
<ellipse cx="37" cy="70" rx="11" ry="5.5" fill="#FF6B8A" opacity="0.27"/>
<ellipse cx="91" cy="70" rx="11" ry="5.5" fill="#FF6B8A" opacity="0.27"/>
<path d="M 52 76 Q 64 84 76 76" stroke="${s}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>`;
}

function salamanderSVG(bc: number, sc: number, lc: number, ec: number, habitat: string): string {
  const b = h(bc), s = h(sc), l = h(lc), e = h(ec);
  const gExt = habitat === 'grass' ? `
<ellipse cx="34" cy="52" rx="10" ry="18" fill="#4CAF50" opacity="0.78" transform="rotate(-15,34,52)"/>
<ellipse cx="86" cy="52" rx="10" ry="18" fill="#4CAF50" opacity="0.78" transform="rotate(15,86,52)"/>
<ellipse cx="34" cy="52" rx="5" ry="10" fill="#81C784" opacity="0.5" transform="rotate(-15,34,52)"/>
<ellipse cx="86" cy="52" rx="5" ry="10" fill="#81C784" opacity="0.5" transform="rotate(15,86,52)"/>` : '';
  const dExt = habitat === 'dirt' ? `
<path d="M 54 28 L 49 14 L 60 26 Z" fill="${s}"/>
<path d="M 66 28 L 72 14 L 62 26 Z" fill="${s}"/>` : '';
  const aExt = habitat === 'aquatic' ? `
<path d="M 38 52 L 22 42 L 22 64 Z" fill="${l}" opacity="0.75"/>
<path d="M 82 52 L 98 42 L 98 64 Z" fill="${l}" opacity="0.75"/>
<path d="M 38 52 L 26 45 L 26 61 Z" fill="white" opacity="0.35"/>
<path d="M 82 52 L 94 45 L 94 61 Z" fill="white" opacity="0.35"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="256" height="256">
<defs>
<radialGradient id="bg" cx="35%" cy="25%" r="70%">
<stop offset="0%" stop-color="${l}"/>
<stop offset="55%" stop-color="${b}"/>
<stop offset="100%" stop-color="${s}"/>
</radialGradient>
</defs>
<ellipse cx="66" cy="120" rx="38" ry="7" fill="black" opacity="0.15"/>
<ellipse cx="98" cy="96" rx="20" ry="11" fill="${s}" opacity="0.5"/>
<ellipse cx="112" cy="86" rx="12" ry="7" fill="${s}" opacity="0.45"/>
<ellipse cx="97" cy="94" rx="18" ry="10" fill="${b}" stroke="${s}" stroke-width="1.5"/>
<ellipse cx="111" cy="84" rx="11" ry="6" fill="${b}" stroke="${s}" stroke-width="1.5"/>
<ellipse cx="118" cy="77" rx="7" ry="4" fill="${b}" stroke="${s}" stroke-width="1"/>
<polyline points="38,88 24,98 16,92" fill="none" stroke="${s}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<polyline points="62,90 68,106 80,102" fill="none" stroke="${s}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<polyline points="34,96 18,108 10,102" fill="none" stroke="${s}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<polyline points="66,98 72,114 84,110" fill="none" stroke="${s}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
<ellipse cx="52" cy="96" rx="32" ry="18" fill="${s}" opacity="0.30"/>
<ellipse cx="50" cy="93" rx="31" ry="17" fill="url(#bg)" stroke="${s}" stroke-width="2"/>
<ellipse cx="50" cy="95" rx="16" ry="9" fill="${l}" opacity="0.36"/>
<ellipse cx="38" cy="82" rx="12" ry="7" fill="white" opacity="0.18"/>
<g fill="${s}">
<path d="M 32 77 L 28 64 L 37 76 Z"/>
<path d="M 44 75 L 41 60 L 51 74 Z"/>
<path d="M 56 77 L 54 63 L 63 76 Z"/>
</g>
<g fill="${l}" opacity="0.35">
<path d="M 33 77 L 30 68 L 35 77 Z"/>
<path d="M 45 75 L 43 65 L 48 75 Z"/>
<path d="M 57 77 L 55 66 L 61 77 Z"/>
</g>
${gExt}${dExt}${aExt}
<circle cx="62" cy="54" r="24" fill="${s}" opacity="0.28"/>
<circle cx="60" cy="52" r="23" fill="url(#bg)" stroke="${s}" stroke-width="2"/>
<ellipse cx="49" cy="41" rx="10" ry="7" fill="white" opacity="0.22"/>
<ellipse cx="47" cy="39" rx="4" ry="3" fill="white" opacity="0.30"/>
<ellipse cx="60" cy="62" rx="13" ry="8" fill="${b}" stroke="${s}" stroke-width="1.5"/>
<ellipse cx="58" cy="62" rx="7" ry="4" fill="${l}" opacity="0.28"/>
<circle cx="55" cy="61" r="2" fill="${s}" opacity="0.7"/>
<circle cx="62" cy="61" r="2" fill="${s}" opacity="0.7"/>
<circle cx="48" cy="48" r="13" fill="${e}" opacity="0.14"/>
<circle cx="72" cy="48" r="13" fill="${e}" opacity="0.14"/>
<circle cx="48" cy="48" r="10" fill="white"/>
<circle cx="72" cy="48" r="10" fill="white"/>
<circle cx="48" cy="49.5" r="6.8" fill="${e}"/>
<circle cx="72" cy="49.5" r="6.8" fill="${e}"/>
<circle cx="49.5" cy="51" r="4.2" fill="#0A001E"/>
<circle cx="73.5" cy="51" r="4.2" fill="#0A001E"/>
<circle cx="52.5" cy="46" r="2.8" fill="white"/>
<circle cx="76.5" cy="46" r="2.8" fill="white"/>
<circle cx="47" cy="52.5" r="1.4" fill="white" opacity="0.65"/>
<circle cx="71" cy="52.5" r="1.4" fill="white" opacity="0.65"/>
<ellipse cx="36" cy="55" rx="9" ry="4.5" fill="#FF6B8A" opacity="0.27"/>
<ellipse cx="84" cy="55" rx="9" ry="4.5" fill="#FF6B8A" opacity="0.27"/>
<path d="M 50 64 Q 60 70 70 64" stroke="${s}" stroke-width="2" fill="none" stroke-linecap="round"/>
</svg>`;
}

function geckoSVG(bc: number, sc: number, lc: number, ec: number, habitat: string): string {
  const b = h(bc), s = h(sc), l = h(lc), e = h(ec);
  const gExt = habitat === 'grass' ? `
<ellipse cx="34" cy="54" rx="10" ry="20" fill="#4CAF50" opacity="0.78" transform="rotate(-10,34,54)"/>
<ellipse cx="90" cy="54" rx="10" ry="20" fill="#4CAF50" opacity="0.78" transform="rotate(10,90,54)"/>
<ellipse cx="34" cy="54" rx="5" ry="11" fill="#81C784" opacity="0.5" transform="rotate(-10,34,54)"/>
<ellipse cx="90" cy="54" rx="5" ry="11" fill="#81C784" opacity="0.5" transform="rotate(10,90,54)"/>` : '';
  const dExt = habitat === 'dirt' ? `
<path d="M 54 28 L 50 14 L 60 26 Z" fill="${s}"/>
<path d="M 66 28 L 70 14 L 60 26 Z" fill="${s}"/>` : '';
  const aExt = habitat === 'aquatic' ? `
<path d="M 38 52 L 20 42 L 20 64 Z" fill="${l}" opacity="0.70"/>
<path d="M 86 52 L 104 42 L 104 64 Z" fill="${l}" opacity="0.70"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="256" height="256">
<defs>
<radialGradient id="bg" cx="35%" cy="28%" r="68%">
<stop offset="0%" stop-color="${l}"/>
<stop offset="55%" stop-color="${b}"/>
<stop offset="100%" stop-color="${s}"/>
</radialGradient>
</defs>
<ellipse cx="66" cy="120" rx="44" ry="7" fill="black" opacity="0.15"/>
<ellipse cx="108" cy="97" rx="20" ry="10" fill="${s}" opacity="0.48"/>
<ellipse cx="106" cy="95" rx="18" ry="9" fill="${b}" stroke="${s}" stroke-width="1.5"/>
<ellipse cx="118" cy="90" rx="10" ry="5" fill="${b}" stroke="${s}" stroke-width="1"/>
<polyline points="32,90 16,100 6,96" fill="none" stroke="${s}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
<polyline points="76,92 86,104 98,100" fill="none" stroke="${s}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
<polyline points="28,98 12,110 2,106" fill="none" stroke="${s}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
<polyline points="78,100 88,112 100,108" fill="none" stroke="${s}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
<g fill="${b}" stroke="${s}" stroke-width="1.5">
<circle cx="6" cy="96" r="5.5"/><circle cx="2" cy="106" r="5.5"/>
<circle cx="98" cy="100" r="5.5"/><circle cx="100" cy="108" r="5.5"/>
</g>
<g fill="${l}" opacity="0.38">
<circle cx="5" cy="95" r="2.5"/><circle cx="1" cy="105" r="2.5"/>
<circle cx="97" cy="99" r="2.5"/><circle cx="99" cy="107" r="2.5"/>
</g>
<ellipse cx="54" cy="98" rx="42" ry="20" fill="${s}" opacity="0.28"/>
<ellipse cx="52" cy="95" rx="40" ry="18" fill="url(#bg)" stroke="${s}" stroke-width="2"/>
<ellipse cx="50" cy="97" rx="22" ry="10" fill="${l}" opacity="0.34"/>
<g fill="${s}" opacity="0.40">
<circle cx="36" cy="90" r="3.5"/><circle cx="50" cy="88" r="3.5"/><circle cx="64" cy="90" r="3.5"/>
</g>
<ellipse cx="36" cy="83" rx="14" ry="8" fill="white" opacity="0.18"/>
${gExt}${dExt}${aExt}
<circle cx="63" cy="57" r="27" fill="${s}" opacity="0.28"/>
<circle cx="61" cy="55" r="26" fill="url(#bg)" stroke="${s}" stroke-width="2"/>
<ellipse cx="48" cy="44" rx="13" ry="8" fill="white" opacity="0.22"/>
<ellipse cx="46" cy="42" rx="5" ry="3" fill="white" opacity="0.30"/>
<ellipse cx="61" cy="66" rx="15" ry="9" fill="${b}" stroke="${s}" stroke-width="1.5"/>
<ellipse cx="59" cy="66" rx="8" ry="5" fill="${l}" opacity="0.28"/>
<circle cx="48" cy="50" r="15" fill="${e}" opacity="0.14"/>
<circle cx="74" cy="50" r="15" fill="${e}" opacity="0.14"/>
<circle cx="48" cy="50" r="12" fill="white"/>
<circle cx="74" cy="50" r="12" fill="white"/>
<circle cx="48" cy="51.5" r="8.5" fill="${e}"/>
<circle cx="74" cy="51.5" r="8.5" fill="${e}"/>
<circle cx="49.5" cy="53" r="5" fill="#0A001E"/>
<circle cx="75.5" cy="53" r="5" fill="#0A001E"/>
<circle cx="53" cy="47" r="3.5" fill="white"/>
<circle cx="79" cy="47" r="3.5" fill="white"/>
<circle cx="47" cy="56" r="1.8" fill="white" opacity="0.65"/>
<circle cx="73" cy="56" r="1.8" fill="white" opacity="0.65"/>
<ellipse cx="34" cy="61" rx="11" ry="5.5" fill="#FF6B8A" opacity="0.27"/>
<ellipse cx="88" cy="61" rx="11" ry="5.5" fill="#FF6B8A" opacity="0.27"/>
<path d="M 50 69 Q 62 76 74 69" stroke="${s}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>`;
}

function caterpillarSVG(bc: number, sc: number, lc: number, ec: number, habitat: string): string {
  const b = h(bc), s = h(sc), l = h(lc), e = h(ec);
  const gExt = habitat === 'grass' ? `
<ellipse cx="80" cy="86" rx="10" ry="6" fill="#4CAF50" opacity="0.72" transform="rotate(30,80,86)"/>
<ellipse cx="78" cy="64" rx="9" ry="5.5" fill="#4CAF50" opacity="0.68" transform="rotate(25,78,64)"/>` : '';
  const dExt = habitat === 'dirt' ? `
<circle cx="80" cy="86" r="6" fill="${b}" stroke="${s}" stroke-width="1.5"/>
<circle cx="78" cy="64" r="5.5" fill="${b}" stroke="${s}" stroke-width="1.5"/>` : '';
  const aExt = habitat === 'aquatic' ? `
<path d="M 80 84 L 96 80 L 96 92 Z" fill="${l}" opacity="0.65"/>
<path d="M 80 62 L 94 58 L 94 70 Z" fill="${l}" opacity="0.60"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="256" height="256">
<defs>
<radialGradient id="bg" cx="35%" cy="28%" r="68%">
<stop offset="0%" stop-color="${l}"/>
<stop offset="55%" stop-color="${b}"/>
<stop offset="100%" stop-color="${s}"/>
</radialGradient>
<radialGradient id="bg2" cx="38%" cy="30%" r="65%">
<stop offset="0%" stop-color="${l}"/>
<stop offset="60%" stop-color="${b}"/>
<stop offset="100%" stop-color="${s}"/>
</radialGradient>
</defs>
<ellipse cx="64" cy="120" rx="26" ry="7" fill="black" opacity="0.15"/>
<circle cx="70" cy="110" r="16" fill="${s}" opacity="0.30"/>
<circle cx="68" cy="108" r="15.5" fill="url(#bg2)" stroke="${s}" stroke-width="1.8"/>
<ellipse cx="62" cy="103" rx="7" ry="5" fill="${l}" opacity="0.26"/>
<circle cx="64" cy="86" r="17" fill="${s}" opacity="0.28"/>
<circle cx="62" cy="84" r="16.5" fill="url(#bg)" stroke="${s}" stroke-width="1.8"/>
<ellipse cx="56" cy="79" rx="7.5" ry="5" fill="${l}" opacity="0.26"/>
<circle cx="67" cy="63" r="16" fill="${s}" opacity="0.28"/>
<circle cx="65" cy="61" r="15.5" fill="url(#bg2)" stroke="${s}" stroke-width="1.8"/>
<ellipse cx="59" cy="56" rx="7" ry="4.5" fill="${l}" opacity="0.26"/>
${gExt}${dExt}${aExt}
<circle cx="63" cy="38" r="20" fill="${s}" opacity="0.28"/>
<circle cx="61" cy="36" r="19" fill="url(#bg)" stroke="${s}" stroke-width="2"/>
<ellipse cx="51" cy="27" rx="9" ry="6" fill="white" opacity="0.22"/>
<ellipse cx="49" cy="25" rx="4" ry="2.5" fill="white" opacity="0.30"/>
<path d="M 54 19 Q 46 10 40 4" stroke="${s}" stroke-width="2" fill="none" stroke-linecap="round"/>
<path d="M 68 19 Q 76 10 82 4" stroke="${s}" stroke-width="2" fill="none" stroke-linecap="round"/>
<circle cx="40" cy="4" r="4.5" fill="${l}"/>
<circle cx="82" cy="4" r="4.5" fill="${l}"/>
<circle cx="39" cy="3" r="2" fill="white" opacity="0.55"/>
<circle cx="81" cy="3" r="2" fill="white" opacity="0.55"/>
<circle cx="52" cy="34" r="12" fill="${e}" opacity="0.14"/>
<circle cx="70" cy="34" r="12" fill="${e}" opacity="0.14"/>
<circle cx="52" cy="34" r="9.5" fill="white"/>
<circle cx="70" cy="34" r="9.5" fill="white"/>
<circle cx="52" cy="35.5" r="6.5" fill="${e}"/>
<circle cx="70" cy="35.5" r="6.5" fill="${e}"/>
<circle cx="53.5" cy="37" r="4" fill="#0A001E"/>
<circle cx="71.5" cy="37" r="4" fill="#0A001E"/>
<circle cx="56" cy="31.5" r="2.8" fill="white"/>
<circle cx="74" cy="31.5" r="2.8" fill="white"/>
<circle cx="51" cy="39" r="1.4" fill="white" opacity="0.65"/>
<circle cx="69" cy="39" r="1.4" fill="white" opacity="0.65"/>
<ellipse cx="40" cy="41" rx="9" ry="4.5" fill="#FF6B8A" opacity="0.27"/>
<ellipse cx="82" cy="41" rx="9" ry="4.5" fill="#FF6B8A" opacity="0.27"/>
<path d="M 51 46 Q 61 52 72 46" stroke="${s}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
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
  // Insert golden glow right before the drop shadow (first <ellipse>)
  return svg.replace(/<ellipse cx="\d+?" cy="\d+?" rx="\d+?" ry="\d+?" fill="black"/, GOLDEN_OVERLAY + '\n$&');
}

export function buildMonsterSVG(
  bodyShape: string, bc: number, sc: number, lc: number, ec: number,
  habitat: string, golden = false
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
  return injectGolden(svg, golden);
}
