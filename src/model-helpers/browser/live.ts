'use client';

/**
 * The kitchen board's and tracking page's live data, in the browser. A failed read
 * (usually offline) returns null, so the screen keeps showing what it has.
 */
import * as live from '@/models/live';

export type { KitchenEvents } from '@/models/live';

export const watchKitchen = live.watchKitchen;
export const watchOrder = live.watchOrder;

async function orNull<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

/** One order with its items, or null when it's gone or not visible to this user. */
export const fetchOrder = (id: string) => orNull(() => live.loadOrder(id));
export const fetchOpenOrders = () => orNull(live.loadOpenOrders);
export const fetchTables = () => orNull(live.loadTables);
