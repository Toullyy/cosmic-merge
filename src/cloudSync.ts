import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  signInAnonymously,
  signInWithRedirect,
  linkWithRedirect,
  getRedirectResult,
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

// Debounce: saves at most once per 30 seconds to stay within Firestore free-tier quota
export function scheduleSaveToCloud(state: GameState): void {
  if (!cloudStatus.enabled) return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    _doSaveToCloud(state);
  }, 30000);
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
  // Restore cached session immediately — always available from SDK persistence even if redirect fails
  if (auth.currentUser) {
    cloudStatus.uid = auth.currentUser.uid;
    cloudStatus.isAnonymous = auth.currentUser.isAnonymous;
    cloudStatus.enabled = true;
  }
  try {
    const redirectResult = await getRedirectResult(auth);
    if (redirectResult) {
      cloudStatus.uid = redirectResult.user.uid;
      cloudStatus.isAnonymous = false;
      cloudStatus.enabled = true;
      return;
    }
    if (!auth.currentUser) {
      // First time: sign in anonymously
      const cred = await signInAnonymously(auth);
      cloudStatus.uid = cred.user.uid;
      cloudStatus.isAnonymous = cred.user.isAnonymous;
      cloudStatus.enabled = true;
    }
  } catch (e) {
    console.warn('Cloud auth unavailable:', e);
    // cloudStatus.enabled already set above if a cached session existed
  }
}

// Redirects to Google — page will navigate away, no return value
export async function linkGoogleAccount(): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const provider = new GoogleAuthProvider();
  if (user.isAnonymous) {
    await linkWithRedirect(user, provider);
  } else {
    await signInWithRedirect(auth, provider);
  }
}
