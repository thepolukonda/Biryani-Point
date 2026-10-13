/**
 * The cart: a tiny external store persisted in localStorage and kept in sync
 * across browser tabs. Holds only what the customer chose (item, options,
 * quantity, notes); prices are always worked out from the current menu.
 */
import { readJson, STORAGE_KEYS, writeJson } from '@/shared/browser-storage';
import type { MenuItem } from '@/shared/domain/menu';
import {
  cartLineKey,
  MAX_LINES,
  MAX_QUANTITY_PER_LINE,
  type OrderType,
  type SelectedOption,
} from '@/shared/domain/pricing';

export type CartLine = {
  key: string;
  itemSlug: string;
  quantity: number;
  options: SelectedOption[];
  notes?: string;
  addedAt: number;
};

export type CartState = { lines: CartLine[]; orderType: OrderType };

const EMPTY: CartState = { lines: [], orderType: 'delivery' };

let state: CartState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function sanitise(raw: unknown): CartState {
  const value = raw as Partial<CartState> | null;
  if (!value || !Array.isArray(value.lines)) return EMPTY;
  const lines = value.lines
    .filter(
      (l): l is CartLine =>
        !!l &&
        typeof l.itemSlug === 'string' &&
        Number.isInteger(l.quantity) &&
        l.quantity > 0 &&
        Array.isArray(l.options),
    )
    .slice(0, MAX_LINES)
    .map((l) => ({
      ...l,
      quantity: Math.min(l.quantity, MAX_QUANTITY_PER_LINE),
      key: cartLineKey(l),
    }));
  return { lines, orderType: value.orderType === 'pickup' ? 'pickup' : 'delivery' };
}

function ensureLoaded() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  state = sanitise(readJson(STORAGE_KEYS.cart, EMPTY));
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEYS.cart) return;
    state = sanitise(event.newValue ? JSON.parse(event.newValue) : EMPTY);
    listeners.forEach((l) => l());
  });
}

function set(next: CartState) {
  state = next;
  writeJson(STORAGE_KEYS.cart, next);
  listeners.forEach((l) => l());
}

export const cartStore = {
  subscribe(listener: () => void) {
    ensureLoaded();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): CartState {
    ensureLoaded();
    return state;
  },
  getServerSnapshot(): CartState {
    return EMPTY;
  },

  /** Add a line, merging with an identical one (same item, options and notes). */
  add(input: Omit<CartLine, 'key' | 'addedAt'>) {
    const key = cartLineKey(input);
    const existing = state.lines.find((l) => l.key === key);
    const lines = existing
      ? state.lines.map((l) =>
          l.key === key
            ? { ...l, quantity: Math.min(l.quantity + input.quantity, MAX_QUANTITY_PER_LINE) }
            : l,
        )
      : [...state.lines, { ...input, key, addedAt: Date.now() }].slice(-MAX_LINES);
    set({ ...state, lines });
    return key;
  },

  /** Replace a line (editing options/notes from the item sheet). */
  replace(oldKey: string, input: Omit<CartLine, 'key' | 'addedAt'>) {
    const key = cartLineKey(input);
    const old = state.lines.find((l) => l.key === oldKey);
    const without = state.lines.filter((l) => l.key !== oldKey && l.key !== key);
    const merged = state.lines.find((l) => l.key === key && l.key !== oldKey);
    const line: CartLine = {
      ...input,
      key,
      quantity: Math.min(input.quantity + (merged?.quantity ?? 0), MAX_QUANTITY_PER_LINE),
      addedAt: old?.addedAt ?? Date.now(),
    };
    const index = state.lines.findIndex((l) => l.key === oldKey);
    const lines = [...without];
    lines.splice(index < 0 ? lines.length : Math.min(index, lines.length), 0, line);
    set({ ...state, lines });
    return key;
  },

  setQuantity(key: string, quantity: number) {
    const q = Math.min(Math.max(0, Math.trunc(quantity)), MAX_QUANTITY_PER_LINE);
    const lines =
      q === 0
        ? state.lines.filter((l) => l.key !== key)
        : state.lines.map((l) => (l.key === key ? { ...l, quantity: q } : l));
    set({ ...state, lines });
  },

  setNotes(key: string, notes: string) {
    const line = state.lines.find((l) => l.key === key);
    if (!line) return key;
    const trimmed = notes.trim().slice(0, 200);
    return cartStore.replace(key, {
      itemSlug: line.itemSlug,
      quantity: line.quantity,
      options: line.options,
      ...(trimmed ? { notes: trimmed } : {}),
    });
  },

  remove(key: string) {
    set({ ...state, lines: state.lines.filter((l) => l.key !== key) });
  },

  setOrderType(orderType: OrderType) {
    if (state.orderType !== orderType) set({ ...state, orderType });
  },

  replaceAll(lines: Omit<CartLine, 'key' | 'addedAt'>[]) {
    const now = Date.now();
    set({
      ...state,
      lines: lines
        .slice(0, MAX_LINES)
        .map((l, i) => ({ ...l, key: cartLineKey(l), addedAt: now + i })),
    });
  },

  clear() {
    set({ ...state, lines: [] });
  },
};

/** Default choices for an item, if they satisfy every group (so "+" can add in one tap). */
export function defaultOptions(item: MenuItem): SelectedOption[] | null {
  const selected: SelectedOption[] = [];
  for (const group of item.modifierGroups) {
    const defaults = group.options.filter((o) => o.isDefault && o.isAvailable);
    if (defaults.length < group.minSelect || defaults.length > group.maxSelect) return null;
    for (const option of defaults) selected.push({ group: group.slug, option: option.slug });
  }
  return selected;
}
