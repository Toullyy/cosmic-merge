import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  signInAnonymously,
  signInWithPopup,
  linkWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { auth, db } from './firebase';
import type { GameState } from './types';

export const cloudStatus = {
  uid: null as string | null,
  isAnonymous: true,
  synced: false,
  enabled: false,
};

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

// Debounce: saves at most once per 4 seconds
export function scheduleSaveToCloud(state: GameState): void {
  if (!cloudStatus.enabled) return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    _doSaveToCloud(state);
  }, 4000);
}

async function _doSaveToCloud(state: GameState): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await setDoc(doc(db, 'users', user.uid), {
      state: JSON.stringify(state),
      savedAt: state.lastTickAt,
    });
    cloudStatus.synced = true;
  } catch {
    // Silently fail — localStorage remains source of truth
  }
}

export async function loadFromCloud(): Promise<GameState | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) return null;
    return JSON.parse(snap.data().state) as GameState;
  } catch {
    return null;
  }
}

export async function initCloudAuth(): Promise<void> {
  try {
    const cred = await signInAnonymously(auth);
    cloudStatus.uid = cred.user.uid;
    cloudStatus.isAnonymous = cred.user.isAnonymous;
    cloudStatus.enabled = true;
  } catch (e) {
    console.warn('Cloud auth unavailable:', e);
  }
}

export async function linkGoogleAccount(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  const provider = new GoogleAuthProvider();
  try {
    if (user.isAnonymous) {
      await linkWithPopup(user, provider);
    } else {
      await signInWithPopup(auth, provider);
    }
    cloudStatus.uid = auth.currentUser!.uid;
    cloudStatus.isAnonymous = false;
    return true;
  } catch (e: any) {
    // If anonymous account can't be linked (credential in use), sign in directly
    if (e?.code === 'auth/credential-already-in-use') {
      try {
        await signInWithPopup(auth, provider);
        cloudStatus.uid = auth.currentUser!.uid;
        cloudStatus.isAnonymous = false;
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}
