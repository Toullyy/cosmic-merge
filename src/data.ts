import type { Species, FoodType, ToyType, CleanTool, HabitatType, HabitatConfig, Monster, Egg, GameState } from './types';

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
  // Tier 1
  { id:'pellet', name:'Pellets',     tier:1, hungerGain:15, happinessGain:3,  cost:3  },
  { id:'berry',  name:'Berries',     tier:1, hungerGain:8,  happinessGain:10, cost:4  },
  // Tier 2
  { id:'pasta',  name:'Pasta',       tier:2, hungerGain:25, happinessGain:8,  cost:8  },
  { id:'gummy',  name:'Gummies',     tier:2, hungerGain:12, happinessGain:22, cost:10 },
  // Tier 3
  { id:'feast',  name:'Royal Feast', tier:3, hungerGain:45, happinessGain:15, cost:20 },
  { id:'cake',   name:'Sweet Cake',  tier:3, hungerGain:20, happinessGain:38, cost:22 },
];

export const TOY_TYPES: ToyType[] = [
  { id:'yarn',  name:'Yarn Ball', tier:1, happinessGain:15, cost:6  },
  { id:'stick', name:'Wand',      tier:2, happinessGain:25, cost:12 },
  { id:'gem',   name:'Gem Toy',   tier:3, happinessGain:38, cost:22 },
];

export const CLEAN_TOOLS: CleanTool[] = [
  { id:'cloth', name:'Cloth',    tier:1, cleanGain:20, cost:4  },
  { id:'brush', name:'Brush',    tier:2, cleanGain:35, cost:10 },
  { id:'bath',  name:'Bath Kit', tier:3, cleanGain:55, cost:20 },
];

export const DECAY = { happiness: -2, hunger: -5, cleanliness: -3 };

export const HABITATS: Record<HabitatType, HabitatConfig> = {
  dirt:    { label:'Dirt Den',    bgColor:0x3E2723, wallColor:0x5D4037, unlockCost:0    },
  grass:   { label:'Grass Grove', bgColor:0x1B5E20, wallColor:0x2E7D32, unlockCost:500  },
  aquatic: { label:'Aqua Tank',   bgColor:0x01579B, wallColor:0x0277BD, unlockCost:1000 },
};

export const CATALOG = SPECIES.filter(s => s.id < 15);

export const LISTING_DURATION_MS = 15 * 60 * 1000;
export const MERCHANT_REFRESH_MS = 30 * 60 * 1000;

export const TANK_COST = 100;
export const TANK_CAPACITY = 2;
export const MAX_TANKS = 3;

export const LEVEL_NAMES = ['', 'Hatchling', 'Hatchling', 'Young', 'Young', 'Adult', 'Adult', 'Elder', 'Elder', 'Ancient', 'Ancient'];
export function getLevelName(level: number): string {
  return LEVEL_NAMES[Math.min(10, Math.max(1, level))] ?? 'Ancient';
}

export const BUYER_NAMES = [
  'Dr. Malone', 'Prof. Chen', 'Lady Ashford', 'Capt. Rex', 'Zara the Keeper',
  'Elder Voss', 'Dr. Yuki', 'Baron Fenn', 'Ranger Moss', 'Sage Iria',
  'Lord Brunt', 'Dame Lyra', 'Dr. Patel', 'Prof. Okeke', 'Lady Sorn',
];
export const BUYER_JOBS = [
  'Scientist', 'Zookeeper', 'Collector', 'Adventurer', 'Alchemist',
  'Explorer', 'Biologist', 'Merchant', 'Monster Trainer', 'Royal Keeper',
];

export function randomBuyer(): { name: string; job: string } {
  return {
    name: BUYER_NAMES[Math.floor(Math.random() * BUYER_NAMES.length)],
    job:  BUYER_JOBS[Math.floor(Math.random() * BUYER_JOBS.length)],
  };
}

export function randomListingDuration(): number {
  return (15 + Math.floor(Math.random() * 106)) * 60 * 1000;
}

export function generateMerchantStock(): number[] {
  const byH: Record<HabitatType, number[]> = { dirt: [], grass: [], aquatic: [] };
  CATALOG.forEach(s => byH[s.habitat].push(s.id));
  const stock: number[] = [];
  (['dirt', 'grass', 'aquatic'] as HabitatType[]).forEach(h => {
    const pool = [...byH[h]];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    stock.push(pool[0], pool[1], pool[2]); // 3 per habitat = 9 total
  });
  return stock;
}

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
    stats: { hatched: 0, sold: 0, totalEarned: 0, discovered: [0] },
    listings: [],
    merchantRefreshAt: Date.now() + MERCHANT_REFRESH_MS,
    merchantStock: generateMerchantStock(),
    tanks: { dirt: 1, grass: 1, aquatic: 1 },
    newDiscoveries: [],
  };
}
