/**
 * localStorage / sessionStorage that never throws (private mode, blocked storage,
 * quota) and never runs on the server.
 */
type Area = 'local' | 'session';

function area(kind: Area): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(key: string, fallback: T, kind: Area = 'local'): T {
  try {
    const raw = area(kind)?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown, kind: Area = 'local'): void {
  try {
    area(kind)?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the site still works, it just won't remember.
  }
}

export function removeKey(key: string, kind: Area = 'local'): void {
  try {
    area(kind)?.removeItem(key);
  } catch {
    // ignore
  }
}

export const STORAGE_KEYS = {
  cart: 'bp-cart-v2',
  lastOrder: 'bp-last-order',
  details: 'bp-details',
  checkoutKey: 'bp-checkout-key',
  recentOrders: 'bp-recent-orders',
} as const;
