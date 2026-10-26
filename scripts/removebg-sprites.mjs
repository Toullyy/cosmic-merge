/**
 * Post-process existing sprites through remove.bg API to get transparent PNGs.
 * Usage: REMOVEBG_KEY=xxx node scripts/removebg-sprites.mjs
 * Optional: SPRITES=round_dirt,spiky_grass  (process specific ones only)
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = join(__dirname, '..', 'public', 'sprites');
const REMOVEBG_KEY = process.env.REMOVEBG_KEY;
const ONLY = process.env.SPRITES ? process.env.SPRITES.split(',') : null;

if (!REMOVEBG_KEY) {
  console.error('Error: set REMOVEBG_KEY environment variable');
  process.exit(1);
}

async function removeBg(imgBuffer, name) {
  const form = new FormData();
  form.append('image_file', new Blob([imgBuffer], { type: 'image/png' }), name + '.png');
  form.append('size', 'auto');

  const res = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: { 'X-Api-Key': REMOVEBG_KEY },
    body: form,
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`remove.bg ${res.status}: ${msg.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const files = readdirSync(SPRITES_DIR)
    .filter(f => f.endsWith('.png'))
    .map(f => basename(f, '.png'))
    .filter(name => !ONLY || ONLY.includes(name));

  console.log(`Processing ${files.length} sprites via remove.bg...`);

  for (const name of files) {
    const path = join(SPRITES_DIR, name + '.png');
    try {
      const original = readFileSync(path);
      process.stdout.write(`[${name}] removing background... `);
      const result = await removeBg(original, name);
      writeFileSync(path, result);
      console.log(`done (${(result.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      console.error(`FAILED: ${err.message}`);
    }
  }
  console.log('Done.');
}

main();
