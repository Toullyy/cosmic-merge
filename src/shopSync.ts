import { collection, getDocs, doc, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { GameState, PublicShop, PublicMonster } from './types';

export async function publishShop(state: GameState): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const name = user.displayName || `Player #${user.uid.slice(-4).toUpperCase()}`;
  const monsters: PublicMonster[] = state.monsters.map(m => ({
    id: m.id,
    speciesId: m.speciesId,
    variantIndex: m.variantIndex,
    level: m.level,
    nickname: m.nickname ?? null,
    trait: m.trait ?? null,
    happiness: m.happiness,
    habitatType: m.habitatType,
  }));
  try {
    await setDoc(doc(db, 'shops', user.uid), {
      uid: user.uid,
      name,
      updatedAt: Date.now(),
      monsters,
      stats: {
        sold: state.stats.sold,
        hatched: state.stats.hatched,
        totalEarned: state.stats.totalEarned,
      },
    } as PublicShop);
  } catch {
    // Silently fail — best-effort public snapshot
  }
}

export async function fetchShops(limitCount: number = 20): Promise<PublicShop[]> {
  const user = auth.currentUser;
  try {
    const q = query(
      collection(db, 'shops'),
      orderBy('updatedAt', 'desc'),
      limit(limitCount + 1),
    );
    const snap = await getDocs(q);
    const shops: PublicShop[] = [];
    snap.forEach(d => {
      if (d.id !== user?.uid) shops.push(d.data() as PublicShop);
    });
    return shops.slice(0, limitCount);
  } catch {
    return [];
  }
}
