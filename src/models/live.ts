'use client';

/**
 * Model: live database updates in the browser (Supabase Realtime), for the kitchen board
 * and the customer's tracking page. Realtime applies RLS, so the kitchen connection must
 * carry the signed-in staff member's token, otherwise every event is filtered out.
 */
import type { AdminOrder } from '@/shared/admin/orders';
import { browserClient } from './db/browser';
import type { Row } from './db/core';
import * as orders from './orders';
import * as tables from './tables';

export const browserDb = browserClient;

export type KitchenEvents = {
  /** A new order: only its id arrives; load it with the items. */
  onOrderCreated: (id: string) => void;
  /** A changed order row (without its items). */
  onOrderChanged: (row: AdminOrder) => void;
  onTablesChanged: () => void;
  onConnection: (connected: boolean) => void;
};

/** Subscribes the kitchen board to order and table changes. Returns the unsubscribe. */
export function watchKitchen(events: KitchenEvents): () => void {
  const db = browserClient();
  let channel: ReturnType<typeof db.channel> | null = null;
  let cancelled = false;
  void (async () => {
    const { data } = await db.auth.getSession();
    if (data.session) await db.realtime.setAuth(data.session.access_token);
    if (cancelled) return;
    channel = db
      .channel('kitchen-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) =>
        events.onOrderCreated((payload.new as { id: string }).id),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) =>
        events.onOrderChanged(payload.new as AdminOrder),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dining_tables' }, () =>
        events.onTablesChanged(),
      )
      .subscribe((status) => events.onConnection(status === 'SUBSCRIBED'));
  })();
  // Keep the realtime token fresh when the session refreshes.
  const { data: listener } = db.auth.onAuthStateChange((_event, session) => {
    if (session) void db.realtime.setAuth(session.access_token);
  });
  return () => {
    cancelled = true;
    listener.subscription.unsubscribe();
    if (channel) void db.removeChannel(channel);
  };
}

/**
 * Tells the tracking page when its order changes. The database broadcasts each status
 * change on the order's own channel name; no order data travels on it.
 */
export function watchOrder(
  publicId: string,
  onChange: () => void,
  onConnection: (connected: boolean) => void,
): () => void {
  const db = browserClient();
  const channel = db
    .channel(`order:${publicId}`, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'status' }, onChange)
    .subscribe((status) => onConnection(status === 'SUBSCRIBED'));
  return () => void db.removeChannel(channel);
}

// Reads for the kitchen board (as the signed-in staff member) --------------------------------

export const loadOrder = (id: string) => orders.findById(browserClient(), id);
export const loadOpenOrders = () => orders.listOpen(browserClient());
export const loadTables = (): Promise<Row<'dining_tables'>[]> => tables.listAll(browserClient());
