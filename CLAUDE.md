# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server at http://localhost:5173/cosmic-merge/
npm run build    # TypeScript check + Vite production build → dist/
npm run preview  # Preview production build locally
```

There are no tests. Visual verification is done by running `npm run dev` and opening the game in a mobile-emulated browser (540×960px portrait). The `/verify` and `/run` skills can automate this with Playwright.

## Project overview

**Monster Pet Shop** — a Phaser 3 PWA Tamagotchi/shop sim where players hatch eggs, raise monsters, and sell them. Deployed to GitHub Pages at `/cosmic-merge/`.

Canvas size: **540×960px** portrait. All coordinates are relative to this.

## Source layout

All TypeScript source lives in `src/`. The `.js` files in the root and `scenes/` are **legacy stubs** — ignore them. The actual game is the `.ts` files under `src/`.

```
src/
  game.ts           — Phaser.Game bootstrap, scene list
  types.ts          — all TypeScript interfaces (Monster, GameState, etc.)
  data.ts           — static data + factory functions (SPECIES, TRAITS, ACHIEVEMENTS, newMonster, etc.)
  utils.ts          — Game singleton, store (localStorage), sfx, recordQuestProgress, getNewAchievements
  MonsterRenderer.ts — procedural monster drawing, getVariantModifiers, shiftHue/darken/lighten
  monsterSprites.ts  — SVG-based sprite builder (used by MonsterRenderer)
  ads.ts            — ad abstraction layer (mock by default)
  scenes/
    Boot.ts         — load/migrate state, reconcileOfflineTime, start Hub
    Hub.ts          — main shop floor, terrarium cards, bottom nav, visitor/quest/achievement UI
    HabitatRoom.ts  — per-monster detail view: stats bars, feed/play/clean pickers, sell listing
    Merchant.ts     — egg shop (buy eggs + habitat unlocks + decorations)
    HatchScene.ts   — egg crack animation, creates monster
    BreedingLab.ts  — pick 2 monsters (level ≥ 4) → produce egg
    PokedexScene.ts — species discovery log
    HowToPlay.ts    — tutorial overlay
  ui/
    Button.ts       — makeButton(), setButtonLabel(), setButtonColor()
    Toast.ts        — showToast(), showFloat()
```

## State management

`GameState` is the single source of truth, held in `Game.state` (from `utils.ts`) and persisted to `localStorage` under key `mps_state`. **Always call `store.setJSON('mps_state', Game.state)` after mutating state.**

`Boot.ts` runs once at startup: loads the save, applies all migrations, calls `reconcileOfflineTime`, then starts `Hub`. The migration block is additive — add new `if (!state.foo)` guards when adding fields to `GameState`.

State version is `1`; if `saved.version !== 1`, a fresh state is created via `newState()`.

## Key data constants (src/data.ts)

| Constant | Value |
|----------|-------|
| `DECAY` | `{ happiness: -2, hunger: -5, cleanliness: -3 }` per hour |
| `TANK_CAPACITY` | 1 monster per tank |
| `MAX_TANKS` | 8 per habitat |
| `TANK_COST` | 100 coins |
| `LISTING_DURATION_MS` | 15 min base (randomised up to ~2h) |
| `MERCHANT_REFRESH_MS` | 30 min |
| `VISITOR_INTERVAL_MS` | 2 hours |
| `VISITOR_DURATION_MS` | 10 min |
| `XP_TABLE` | XP needed per level (index = current level) |

Species IDs 0–14 are buyable (in `CATALOG`). IDs 15–24 are breeding-only rares.

## Monster variants

`variantIndex` (0–99) controls appearance via `getVariantModifiers(vi)`:
- `hueShift = ((vi % 12) - 6) * 15` degrees
- `patternType = Math.floor(vi / 50)` → 0 plain, 1 spots
- `isGolden = vi % 7 === 0` → golden glow + 1.5× sell price

## Sell price formula

```
price = max(10, round(sp.price × (1 + level×0.2) × (happiness/100) × 0.8 × goldenMult × traitSellMod))
```

Used in both `HabitatRoom._calcSell()` and the maxPrice hint — keep them in sync.

## Traits (src/data.ts → TRAITS)

Each `Monster.trait` is a string id. Effects applied in:
- `reconcileOfflineTime` (Boot.ts) — `decayMod` multipliers
- `HabitatRoom._calcSell()` — `sellMod`
- Feed callback — `xpMod` bonus XP
- Play callback — `hapGainMod` bonus happiness

## Achievements (src/data.ts → ACHIEVEMENTS)

`getNewAchievements(state)` in `utils.ts` checks all ACHIEVEMENTS, awards diamonds, saves, and returns newly unlocked ones. Called in:
- `Boot.ts` (silently, after migration — retroactive awards)
- `Hub.refreshAll()` (with animated popup per new achievement)
- Quest claim callback in `Hub._showQuestsPanel()`

## Quest tracking

`recordQuestProgress(type)` in `utils.ts` increments quest progress for all incomplete quests of the given type and saves. Called in HabitatRoom after feed/play/clean/sell, and in Hub after hatch.

## Scene flow

```
Boot → Hub (main loop)
Hub  → Merchant (shop)
Hub  → HabitatRoom (tap a monster)
Hub  → BreedingLab
Hub  → PokedexScene
Hub  → HowToPlay
HatchScene launched over Hub (scene.launch, not scene.start)
```

`scene.start()` destroys the current scene. `scene.launch()` runs the new scene on top. After HatchScene, it calls `hub.onEggHatched()`.

## UI patterns

- **makeButton(scene, cx, cy, w, h, label, color, callback, fontSize)** — returns a `Container`. Use `setButtonLabel()` / `setButtonColor()` to update without recreating.
- **showToast(scene, msg, color)** — bottom toast notification.
- **showFloat(scene, x, y, msg, color)** — floating text that fades upward.
- All UI elements use `FONT = '"Noto Sans Thai", "Sarabun", system-ui, sans-serif'` for Thai language support.
- Depths: background 0–2, habitat bg 3–4, monster 5–6, overlays 10–12, pickers 28–29, popups 50, achievement popup 60.

## Adding a new feature checklist

1. Add types to `src/types.ts`
2. Add data/constants to `src/data.ts`
3. Add migration guard in `Boot.ts` create() block: `if (!state.newField) state.newField = default`
4. Implement logic — mutate `Game.state`, then `store.setJSON('mps_state', Game.state)`
5. Run `npm run build` to confirm no TypeScript errors before committing
