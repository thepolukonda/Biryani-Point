'use client';

import { useSyncExternalStore } from 'react';

const noop = () => () => {};

/** false during server render and hydration, true afterwards (safe place to read localStorage). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** Live CSS media query, e.g. useMediaQuery('(prefers-reduced-motion: reduce)'). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// A shared clock for "5 min ago" labels. 0 during server render and hydration (so the
// HTML always matches), then the real time, refreshed every `TICK_MS`.
const TICK_MS = 20_000;
let clock = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const clockListeners = new Set<() => void>();

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);
  if (!timer) {
    clock = Date.now();
    timer = setInterval(() => {
      clock = Date.now();
      clockListeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function useNow(): number {
  return useSyncExternalStore(
    subscribeClock,
    () => clock || (clock = Date.now()),
    () => 0,
  );
}
