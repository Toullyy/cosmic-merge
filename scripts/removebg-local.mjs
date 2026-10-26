/**
 * Local AI background removal for sprites using @imgly/background-removal-node.
 * No API key needed. Downloads ~60MB model on first run.
 *
 * Usage:
 *   node scripts/removebg-local.mjs
 *   SPRITES=round_dirt,spiky_aquatic node scripts/removebg-local.mjs
 */
import { removeBackground } from '@imgly/background-removal-node';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SPRITES_DIR = join(__dirname, '..', 'public', 'sprites');
const ONLY = process.env.SPRITES ? process.env.SPRITES.split(',') : null;

async function main() {
  const files = readdirSync(SPRITES_DIR)
    .filter(f => f.endsWith('.png'))
    .map(f => basename(f, '.png'))
    .filter(name => !ONLY || ONLY.includes(name));

  console.log(`Processing ${files.length} sprites with local AI background removal...`);
  console.log('(Model downloads ~60MB on first run)\n');

  for (const name of files) {
    const path = join(SPRITES_DIR, name + '.png');
    process.stdout.write(`[${name}] removing background... `);
    try {
      const blob = new Blob([readFileSync(path)], { type: 'image/png' });
      const resultBlob = await removeBackground(blob, {
        model: 'medium',
        output: { format: 'image/png', quality: 1 },
      });
      const buf = Buffer.from(await resultBlob.arrayBuffer());
      writeFileSync(path, buf);
      console.log(`done (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      console.error(`FAILED: ${err.message}`);
    }
  }
  console.log('\nDone.');
}

main();
