import { store } from './utils';
import { SPECIES } from './data';
import { t } from './i18n';
import type { GameState } from './types';

const KEY = 'mps_notify';
const MAX_DELAY = 24 * 3600000;

export function notificationsEnabled(): boolean {
  return store.get(KEY, '0') === '1';
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function setNotificationsEnabled(on: boolean): void {
  store.set(KEY, on ? '1' : '0');
  if (!on) clearScheduledNotifications();
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

let _timers: number[] = [];

export function clearScheduledNotifications(): void {
  _timers.forEach(id => clearTimeout(id));
  _timers = [];
}

function schedule(fn: () => void, delay: number) {
  if (delay <= 0 || delay > MAX_DELAY) return;
  _timers.push(window.setTimeout(fn, delay));
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>(resolve => setTimeout(() => resolve(null), 1500)),
    ]);
  } catch {
    return null;
  }
}

async function show(title: string, body: string, tag: string): Promise<void> {
  if (!notificationsEnabled() || !notificationsSupported() || Notification.permission !== 'granted') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;
  const icon = import.meta.env.BASE_URL + 'icon-192.png';
  const reg = await getRegistration();
  try {
    if (reg) {
      await reg.showNotification(title, { body, tag, icon, badge: icon });
    } else {
      new Notification(title, { body, tag, icon });
    }
  } catch {
    /* notifications unavailable — ignore */
  }
}

export function scheduleIdleNotifications(state: GameState | null): void {
  clearScheduledNotifications();
  if (!state || !notificationsEnabled() || !notificationsSupported() || Notification.permission !== 'granted') return;
  const now = Date.now();

  state.eggs.forEach(egg => {
    const delay = egg.hatchEndAt - now;
    if (delay <= 0) return;
    const sp = SPECIES[egg.speciesId];
    schedule(() => {
      void show(
        t('notify.eggReadyTitle'),
        t('notify.eggReadyBody', { name: sp?.name ?? '???' }),
        'egg_' + egg.id,
      );
    }, delay + 1000);
  });

  if (state.visitorNextAt && state.visitorNextAt > now) {
    schedule(() => {
      void show(t('notify.visitorTitle'), t('notify.visitorBody'), 'visitor');
    }, state.visitorNextAt - now + 1000);
  }
}
