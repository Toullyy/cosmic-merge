export type HabitatType = 'dirt' | 'grass' | 'aquatic';
export type BodyShape = 'round' | 'lumpy' | 'spiky' | 'flat' | 'long';

export interface Species {
  id: number;
  name: string;
  habitat: HabitatType;
  hatchHours: number;
  price: number;
  bodyShape: BodyShape;
  baseColor: number;
}

export interface Monster {
  id: string;
  speciesId: number;
  variantIndex: number;
  habitatType: HabitatType;
  level: number;
  xp: number;
  happiness: number;
  hunger: number;
  cleanliness: number;
  lastCaredAt: number;
  source: string;
}

export interface Egg {
  id: string;
  speciesId: number;
  variantIndex: number;
  habitatType: HabitatType;
  hatchEndAt: number;
  source: string;
  parentIds: string[];
}

export interface HabitatState {
  unlocked: boolean;
  decorations: unknown[];
}

export interface GameStats {
  hatched: number;
  sold: number;
  totalEarned: number;
  discovered: number[];
}

export interface GameState {
  version: number;
  coins: number;
  lastTickAt: number;
  monsters: Monster[];
  eggs: Egg[];
  habitats: Record<HabitatType, HabitatState>;
  stats: GameStats;
}

export interface VariantModifiers {
  hueShift: number;
  patternType: number;
  isGolden: boolean;
}

export interface HabitatConfig {
  label: string;
  bgColor: number;
  wallColor: number;
  unlockCost: number;
}

export interface FoodType {
  id: string;
  name: string;
  hungerGain: number;
  happinessGain: number;
  cost: number;
}
