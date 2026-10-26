/**
 * Monster sprite generator — Pollinations.ai (free, no API key) + optional remove.bg
 *
 * Usage:
 *   node scripts/generate-sprites.mjs
 *
 * Optional background removal (transparent PNG):
 *   REMOVEBG_KEY=xxx node scripts/generate-sprites.mjs
 *
 * Regenerate specific sprites only:
 *   SPRITES=round_dirt,spiky_grass node scripts/generate-sprites.mjs
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'public', 'sprites');
mkdirSync(OUT, { recursive: true });

const REMOVEBG_KEY = process.env.REMOVEBG_KEY;
const ONLY = process.env.SPRITES ? process.env.SPRITES.split(',') : null;
const FORCE = process.env.FORCE === '1';

const BODY_PROMPTS = {
  round:  'cute chibi blob monster with giant oversized round head and tiny round body stub underneath, chubby plump shape, stubby little arms',
  lumpy:  'cute chibi blob monster with giant lumpy irregular round head and tiny blobby body below, bumpy wobbly appearance, small drip shapes',
  spiky:  'cute chibi dragon monster with giant round head and tiny cute pointed spines on top of head, stubby little dragon body, small wings',
  flat:   'cute chibi turtle-frog monster with giant wide round head and tiny flat body, small webbed hands and feet, dome-like appearance',
  long:   'cute chibi caterpillar monster with giant round head and tiny stacked round body segments below, small antenna with ball tips, friendly face',
};

const HABITAT_PROMPTS = {
  dirt:    'warm earthy brown and amber colors, tiny rocky horn accessories on head, glowing gem crystal details, underground cave creature vibes',
  grass:   'vibrant lime green and sunny yellow colors, round leaf ear accessories on head, tiny flower details, cheerful sunny forest creature',
  aquatic: 'bright ocean blue and turquoise colors, small cute fin ear accessories on head, sparkly bubble motifs, shiny wet appearance',
};

const BASE_STYLE =
  'chibi super deformed character, enormous round head that is 65% of total character height, ' +
  'tiny cute body barely visible below the oversized head, ' +
  'huge sparkling anime eyes with big white highlight dot, rosy pink blush circles on cheeks, ' +
  'happy cute smile, thick clean black outline, 3D clay toy render, soft pastel lighting, ' +
  'bright vibrant saturated colors, pure white background, centered, ' +
  'single character only, no text no scenery, professional game sprite art';

const NEGATIVE =
  'realistic body proportions, normal head size, small head, large body, elongated neck, ' +
  'flat 2d, pixel art, photograph, scary, dark background, gray background, black background, ' +
  'dark environment, studio backdrop, gradient background, dramatic lighting, evil, complex background, ' +
  'multiple characters, human face, weapon, text, blurry, watermark, ' +
  'ring shape, torus, donut shape, faceless, bodyless, headless, ' +
  'dinosaur, lizard with realistic proportions, dragon with realistic proportions';

const SPRITES = [];
for (const body of Object.keys(BODY_PROMPTS)) {
  for (const hab of Object.keys(HABITAT_PROMPTS)) {
    SPRITES.push({ key: `${body}_${hab}`, body, hab });
  }
}

async function pollinationsGenerate(prompt, seed) {
  const encoded = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}` +
    `?width=1024&height=1024&model=flux&nologo=true&seed=${seed}&negative=${encodeURIComponent(NEGATIVE)}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Pollinations ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function removeBg(imgBuffer) {
  if (!REMOVEBG_KEY) return imgBuffer;
  const form = new FormData();
  form.append('image_file', new Blob([imgBuffer], { type: 'image/png' }), 'sprite.png');
  form.append('size', 'auto');

  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': REMOVEBG_KEY },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    console.warn(`  remove.bg failed (${res.status}) — keeping original`);
    return imgBuffer;
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const todo = ONLY ? SPRITES.filter(s => ONLY.includes(s.key)) : SPRITES;
  console.log(`Generating ${todo.length} sprites via Pollinations.ai → ${OUT}`);
  if (!REMOVEBG_KEY) console.log('  (no REMOVEBG_KEY — backgrounds will be white)');

  const RATE_DELAY = 48_000; // Pollinations free: 1 per 45s
  let firstRequest = true;

  for (let i = 0; i < todo.length; i++) {
    const { key, body, hab } = todo[i];
    const outPath = join(OUT, `${key}.png`);

    if (existsSync(outPath) && !FORCE) {
      console.log(`[${key}] skipping (already exists — use FORCE=1 to overwrite)`);
      continue;
    }

    // Wait between requests (not before the very first one)
    if (!firstRequest) {
      process.stdout.write(`  waiting 48s... `);
      for (let s = 48; s > 0; s--) {
        process.stdout.write(`\r  waiting ${s}s...  `);
        await new Promise(r => setTimeout(r, 1000));
      }
      process.stdout.write('\r                    \r');
    }
    firstRequest = false;

    console.log(`[${key}] generating... (${i + 1}/${todo.length})`);
    const prompt = `${BODY_PROMPTS[body]}, ${HABITAT_PROMPTS[hab]}, ${BASE_STYLE}`;
    try {
      const seedOffset = parseInt(process.env.SEED_OFFSET || '0');
      let img = await pollinationsGenerate(prompt, i * 7 + 42 + seedOffset);
      if (REMOVEBG_KEY) {
        console.log(`[${key}] removing background...`);
        img = await removeBg(img);
      }
      writeFileSync(outPath, img);
      console.log(`[${key}] saved (${(img.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      console.error(`[${key}] FAILED: ${err.message}`);
      if (err.cause) console.error(`  cause: ${err.cause}`);
    }
  }

  console.log('Done.');
}

main();
