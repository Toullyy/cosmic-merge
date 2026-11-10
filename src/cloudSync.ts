import { doc, getDoc, setDoc } from 'firebase/firestore';
import { publishShop } from './shopSync';
import {
  signInAnonymously,
  signInWithRedirect,
  linkWithRedirect,
  signInWithPopup,
  linkWithPopup,
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
  lastLinkErrorCode: null as string | null,
  // Stores the result of a redirect-based link so TitleScreen can read it
  // even if the event was dispatched before the scene was created.
  pendingLinkResult: null as { ok: boolean; code?: string | null } | null,
};

export type LinkResult = 'linked' | 'redirecting' | 'failed';

const LINK_PENDING_KEY = 'mps_link_pending';

export function isLinkPending(): boolean {
  try { return !!localStorage.getItem(LINK_PENDING_KEY); } catch { return false; }
}

function _setLinkPending(): void {
  try { localStorage.setItem(LINK_PENDING_KEY, String(Date.now())); } catch { /* ignore */ }
}

function _clearLinkPending(): void {
  try { localStorage.removeItem(LINK_PENDING_KEY); } catch { /* ignore */ }
}

function _notifyLinkResult(ok: boolean, code: string | null = null, fromRedirect = false): void {
  cloudStatus.lastLinkErrorCode = ok ? null : code;
  // Only persist for redirect flows — popup results are handled synchronously
  // in the same TitleScreen session via the event listener, so storing them
  // would cause the stale result to replay on the next TitleScreen.create().
  if (fromRedirect) cloudStatus.pendingLinkResult = { ok, code };
  if (code === 'auth/unauthorized-domain') {
    console.error(`Google sign-in needs "${location.hostname}" in Firebase Console → Authentication → Settings → Authorized domains.`);
  }
  try {
    window.dispatchEvent(new CustomEvent('mps-auth-link', { detail: { ok, code } }));
  } catch { /* ignore */ }
}

// Popups are more reliable on desktop (redirect flows lose the pending result
// in browsers that partition third-party storage). Mobile/PWA still uses the
// redirect flow because popups are often blocked there.
function _preferRedirect(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  } catch { /* ignore */ }
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Cancel any pending debounced save (call when cloud state overwrites local state). */
export function abortCloudSave(): void {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
}

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
      // Wall-clock write time. Using state.lastTickAt here meant a long-running
      // session could keep writing a stale timestamp, so other devices would
      // wrongly consider the cloud save old and discard newer progress.
      savedAt: Date.now(),
    });
    cloudStatus.synced = true;
    publishShop(state);
  } catch {
    // Silently fail — localStorage remains source of truth
  }
}

export interface CloudSave {
  state: GameState;
  savedAt: number;
}

export async function loadFromCloud(): Promise<CloudSave | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    const state = JSON.parse(data.state) as GameState;
    const savedAt = typeof data.savedAt === 'number' ? data.savedAt : (state.lastTickAt ?? 0);
    return { state, savedAt };
  } catch {
    return null;
  }
}

let _authPromise: Promise<void> | null = null;

export function initCloudAuth(): Promise<void> {
  if (!_authPromise) _authPromise = _runInitCloudAuth();
  return _authPromise;
}

async function _runInitCloudAuth(): Promise<void> {
  // Restore cached session immediately — always available from SDK persistence even if redirect fails
  if (auth.currentUser) {
    cloudStatus.uid = auth.currentUser.uid;
    cloudStatus.isAnonymous = auth.currentUser.isAnonymous;
    cloudStatus.enabled = true;
  }
  const hadPendingLink = isLinkPending();
  try {
    const redirectResult = await getRedirectResult(auth);
    if (redirectResult) {
      const user = redirectResult.user;
      cloudStatus.uid = user.uid;
      cloudStatus.isAnonymous = user.isAnonymous;
      cloudStatus.enabled = true;
      _clearLinkPending();
      if (!user.isAnonymous) _notifyLinkResult(true, null, true);
      return;
    }

    // Some browsers resolve a link through the auth state instead of the
    // redirect result. If we were waiting for a link, verify it really stuck.
    if (hadPendingLink && auth.currentUser) {
      _clearLinkPending();
      if (!auth.currentUser.isAnonymous) {
        cloudStatus.uid = auth.currentUser.uid;
        cloudStatus.isAnonymous = false;
        cloudStatus.enabled = true;
        _notifyLinkResult(true, null, true);
        return;
      }
      _notifyLinkResult(false, null, true);
    }

    if (!auth.currentUser) {
      // First time: sign in anonymously
      const cred = await signInAnonymously(auth);
      cloudStatus.uid = cred.user.uid;
      cloudStatus.isAnonymous = cred.user.isAnonymous;
      cloudStatus.enabled = true;
    }
  } catch (e: any) {
    console.warn('Cloud auth unavailable:', e);
    const code = e?.code ?? '';
    if (hadPendingLink) _clearLinkPending();
    // Google is already tied to another Firebase user — sign in to it instead
    // of retrying the link (the account was probably used before).
    if (hadPendingLink && (code === 'auth/credential-already-in-use' || code === 'auth/account-exists-with-different-credential')) {
      try {
        _setLinkPending();
        await signInWithRedirect(auth, new GoogleAuthProvider());
        return;
      } catch { /* fall through */ }
    }
    if (hadPendingLink) _notifyLinkResult(false, code || 'auth/redirect-failed', true);
    // cloudStatus.enabled already set above if a cached session existed
  }
}

export async function linkGoogleAccount(): Promise<LinkResult> {
  // The title screen can be tapped before anonymous auth finishes. Wait for it
  // (with a short cap) so guests don't get a silent "failed" on the first tap.
  if (!auth.currentUser) {
    try {
      await Promise.race([
        initCloudAuth(),
        new Promise<void>(resolve => setTimeout(resolve, 5000)),
      ]);
    } catch { /* fall through */ }
  }

  let user = auth.currentUser;
  if (!user) {
    // Auth init failed/timed out — create a guest account so linking can work.
    try {
      const cred = await signInAnonymously(auth);
      user = cred.user;
      cloudStatus.uid = user.uid;
      cloudStatus.isAnonymous = true;
      cloudStatus.enabled = true;
    } catch (e: any) {
      const code = e?.code ?? 'auth/network-request-failed';
      _notifyLinkResult(false, code);
      return 'failed';
    }
  }
  const provider = new GoogleAuthProvider();

  const redirect = async (): Promise<LinkResult> => {
    _setLinkPending();
    if (user.isAnonymous) {
      await linkWithRedirect(user, provider);
    } else {
      await signInWithRedirect(auth, provider);
    }
    return 'redirecting';
  };

  // Mobile / installed PWA: popups are often blocked, so use redirect.
  if (_preferRedirect()) {
    try {
      return await redirect();
    } catch (e: any) {
      _clearLinkPending();
      const code = e?.code ?? 'auth/redirect-failed';
      console.warn('Google link failed:', code, e?.message);
      _notifyLinkResult(false, code);
      return 'failed';
    }
  }

  // Desktop: popup gives an immediate, verifiable result.
  try {
    const cred = user.isAnonymous
      ? await linkWithPopup(user, provider)
      : await signInWithPopup(auth, provider);
    cloudStatus.uid = cred.user.uid;
    cloudStatus.isAnonymous = cred.user.isAnonymous;
    cloudStatus.enabled = true;
    _clearLinkPending();
    if (cred.user.isAnonymous) {
      _notifyLinkResult(false, 'auth/link-not-completed');
      return 'failed';
    }
    _notifyLinkResult(true);
    return 'linked';
  } catch (e: any) {
    const code = e?.code ?? 'auth/unknown';

    if (code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        code === 'auth/web-storage-unsupported') {
      try {
        return await redirect();
      } catch (err: any) {
        _clearLinkPending();
        const redirectCode = err?.code ?? 'auth/redirect-failed';
        _notifyLinkResult(false, redirectCode);
        return 'failed';
      }
    }

    // The Google account already exists — sign in to it instead of linking.
    if (code === 'auth/credential-already-in-use' || code === 'auth/account-exists-with-different-credential') {
      try {
        const cred = await signInWithPopup(auth, provider);
        cloudStatus.uid = cred.user.uid;
        cloudStatus.isAnonymous = false;
        cloudStatus.enabled = true;
        _notifyLinkResult(true);
        return 'linked';
      } catch {
        _notifyLinkResult(false, code);
        return 'failed';
      }
    }

    if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
      console.warn('Google link failed:', code, e?.message);
    }
    _notifyLinkResult(false, code);
    return 'failed';
  }
}
