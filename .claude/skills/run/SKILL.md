# Run Skill — Monster Pet Shop

description: Launch the Monster Pet Shop dev server and drive the game in a real browser via Playwright for visual verification.

## How to launch

```bash
npm run dev
```

Server starts at **http://localhost:5173/cosmic-merge/** (Vite, port 5173 by default).

Run in background and wait for "ready" before opening the browser:

```bash
npx vite &
sleep 3   # wait for server to be ready
```

Or use `run_in_background: true` in the Bash tool and wait for the notification.

## How to drive with Playwright

```js
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

// Emulate a mobile portrait screen (game canvas size)
await page.setViewportSize({ width: 540, height: 960 });
await page.goto('http://localhost:5173/cosmic-merge/');

// Wait for the Boot scene to finish and Hub to load
await page.waitForTimeout(2000);

// Take a screenshot to verify the game loaded
await page.screenshot({ path: 'screenshot.png' });
```

## Key things to check visually

- **Hub scene** — 3 habitat tabs at top, terrarium cards with monster sprites, bottom nav (4 buttons)
- **Coin + Diamond HUD** — top-left coin box and diamond box both visible and not overflowing
- **Bottom nav** — 4 buttons: Shop / Quests / Dex / Breed, evenly spaced
- **Visitor banner** — appears above bottom nav when a VIP visitor is active
- **HabitatRoom** — tap a monster card → see stats bars, Feed/Play/Clean buttons, trait name in level line

## Common test interactions

```js
// Tap the Shop button (bottom nav, position 1 of 4)
await page.tap({ x: 540 * 1/8, y: 960 - 54 });

// Tap first terrarium card
await page.tap({ x: 540/4, y: 300 });

// Tap Feed button in HabitatRoom
await page.tap({ x: 540/2 - 148, y: 960 - 72 });
```

## Notes

- The game is a Phaser 3 canvas app — DOM elements are minimal. Use screenshots to verify rendering.
- State is in localStorage key `mps_state`. Clear it in DevTools to reset to new game.
- Golden monsters appear when `variantIndex % 7 === 0` — use vi=0 or vi=7 to force one.
- After any change, run `npm run build` first to confirm no TypeScript errors, then `/run` to verify visually.
