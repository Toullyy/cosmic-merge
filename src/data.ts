import type { Species, FoodType, HabitatType, HabitatConfig, Monster, Egg, GameState } from './types';

export const SPECIES: Species[] = [
  // ── Dirt (0–4) ──────────────────────────────────────────────────────────
  { id:0,  name:'Blobbit',     habitat:'dirt',    hatchHours:1,  price:80,   bodyShape:'round',  baseColor:0x8B7355 },
  { id:1,  name:'Dustmole',    habitat:'dirt',    hatchHours:2,  price:120,  bodyShape:'lumpy',  baseColor:0xA0856C },
  { id:2,  name:'Craglet',     habitat:'dirt',    hatchHours:4,  price:200,  bodyShape:'spiky',  baseColor:0x7A6248 },
  { id:3,  name:'Murkworm',    habitat:'dirt',    hatchHours:8,  price:350,  bodyShape:'long',   baseColor:0x9E8A6E },
  { id:4,  name:'Stoneback',   habitat:'dirt',    hatchHours:15, price:600,  bodyShape:'flat',   baseColor:0x6B5B45 },
  // ── Grass (5–9) ─────────────────────────────────────────────────────────
  { id:5,  name:'Leafwhip',    habitat:'grass',   hatchHours:1,  price:90,   bodyShape:'round',  baseColor:0x4CAF50 },
  { id:6,  name:'Sproutkin',   habitat:'grass',   hatchHours:3,  price:150,  bodyShape:'lumpy',  baseColor:0x66BB6A },
  { id:7,  name:'Thornpup',    habitat:'grass',   hatchHours:5,  price:250,  bodyShape:'spiky',  baseColor:0x388E3C },
  { id:8,  name:'Fernfang',    habitat:'grass',   hatchHours:10, price:420,  bodyShape:'long',   baseColor:0x2E7D32 },
  { id:9,  name:'Mosshulk',    habitat:'grass',   hatchHours:18, price:700,  bodyShape:'flat',   baseColor:0x1B5E20 },
  // ── Aquatic (10–14) ─────────────────────────────────────────────────────
  { id:10, name:'Aquabit',     habitat:'aquatic', hatchHours:2,  price:100,  bodyShape:'round',  baseColor:0x4FC3F7 },
  { id:11, name:'Finling',     habitat:'aquatic', hatchHours:3,  price:160,  bodyShape:'lumpy',  baseColor:0x29B6F6 },
  { id:12, name:'Coralwing',   habitat:'aquatic', hatchHours:6,  price:280,  bodyShape:'flat',   baseColor:0x0288D1 },
  { id:13, name:'Depthcrawl',  habitat:'aquatic', hatchHours:12, price:480,  bodyShape:'long',   baseColor:0x01579B },
  { id:14, name:'Tidegiant',   habitat:'aquatic', hatchHours:22, price:800,  bodyShape:'spiky',  baseColor:0x006064 },
  // ── Rare / breeding-only (15–24) ────────────────────────────────────────
  { id:15, name:'Stormfin',    habitat:'aquatic', hatchHours:20, price:1000, bodyShape:'round',  baseColor:0x7C4DFF },
  { id:16, name:'Emberclaw',   habitat:'dirt',    hatchHours:18, price:950,  bodyShape:'spiky',  baseColor:0xFF6B35 },
  { id:17, name:'Crystalwing', habitat:'aquatic', hatchHours:25, price:1200, bodyShape:'flat',   baseColor:0xB3E5FC },
  { id:18, name:'Shadowpelt',  habitat:'dirt',    hatchHours:22, price:1100, bodyShape:'lumpy',  baseColor:0x424242 },
  { id:19, name:'Goldenleaf',  habitat:'grass',   hatchHours:15, price:900,  bodyShape:'round',  baseColor:0xFFD54F },
  { id:20, name:'Mistwalker',  habitat:'grass',   hatchHours:20, price:1050, bodyShape:'long',   baseColor:0xCE93D8 },
  { id:21, name:'Ironbark',    habitat:'grass',   hatchHours:24, price:1300, bodyShape:'flat',   baseColor:0x795548 },
  { id:22, name:'Prismfish',   habitat:'aquatic', hatchHours:20, price:1100, bodyShape:'round',  baseColor:0xE040FB },
  { id:23, name:'Voidmaw',     habitat:'dirt',    hatchHours:25, price:1500, bodyShape:'spiky',  baseColor:0x1A237E },
  { id:24, name:'Celestial',   habitat:'grass',   hatchHours:25, price:2000, bodyShape:'round',  baseColor:0xE8EAF6 },
];

export const FOOD_TYPES: FoodType[] = [
  { id:'pasta', name:'Pasta Pellets', hungerGain:20, happinessGain:5,  cost:5  },
  { id:'gummy', name:'Gummy Drops',   hungerGain:10, happinessGain:15, cost:8  },
  { id:'fish',  name:'Fish Crackers', hungerGain:30, happinessGain:10, cost:10 },
];

export const DECAY = { happiness: -2, hunger: -5, cleanliness: -3 };

export const HABITATS: Record<HabitatType, HabitatConfig> = {
  dirt:    { label:'Dirt Den',    bgColor:0x3E2723, wallColor:0x5D4037, unlockCost:0    },
  grass:   { label:'Grass Grove', bgColor:0x1B5E20, wallColor:0x2E7D32, unlockCost:500  },
  aquatic: { label:'Aqua Tank',   bgColor:0x01579B, wallColor:0x0277BD, unlockCost:1000 },
};

export const CATALOG = SPECIES.filter(s => s.id < 15);

export const XP_TABLE = [0, 50, 120, 210, 320, 450, 600, 780, 980, 1200];

export function newMonster(speciesId: number, variantIndex?: number, source?: string): Monster {
  const sp = SPECIES[speciesId];
  return {
    id: 'mon_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
    speciesId,
    variantIndex: variantIndex !== undefined ? variantIndex : Math.floor(Math.random() * 100),
    habitatType: sp.habitat,
    level: 1,
    xp: 0,
    happiness: 80,
    hunger: 70,
    cleanliness: 90,
    lastCaredAt: Date.now(),
    source: source ?? 'merchant',
  };
}

export function newEgg(speciesId: number, variantIndex?: number, source?: string, parentIds?: string[]): Egg {
  const sp = SPECIES[speciesId];
  const ms = sp.hatchHours * 3600000;
  return {
    id: 'egg_' + Date.now() + '_' + Math.floor(Math.random() * 9999),
    speciesId,
    variantIndex: variantIndex !== undefined ? variantIndex : Math.floor(Math.random() * 100),
    habitatType: sp.habitat,
    hatchEndAt: Date.now() + ms,
    source: source ?? 'merchant',
    parentIds: parentIds ?? [],
  };
}

export function newState(): GameState {
  return {
    version: 1,
    coins: 200,
    lastTickAt: Date.now(),
    monsters: [newMonster(0, Math.floor(Math.random() * 100), 'starter')],
    eggs: [],
    habitats: {
      dirt:    { unlocked: true,  decorations: [] },
      grass:   { unlocked: false, decorations: [] },
      aquatic: { unlocked: false, decorations: [] },
    },
    stats: { hatched: 0, sold: 0, totalEarned: 0 },
  };
}
