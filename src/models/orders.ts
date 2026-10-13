/**
 * Model: orders and their items. Every query on `orders` / `order_items` lives here.
 * Works with any client (server or the kitchen browser); the caller picks it.
 */
import { ADMIN_ORDER_SELECT, OPEN_STATUSES, type AdminOrder } from '@/shared/admin/orders';
import { check, must, type Db, type Enums, type Json, type Update } from './db/core';

export type OrderStatus = Enums['order_status'];

/** Statuses during which a table counts as taken. */
export const TABLE_BUSY_STATUSES: OrderStatus[] = ['accepted', 'preparing', 'ready'];

// Kitchen and history ---------------------------------------------------------------------

/** The kitchen board: open orders, newest first. */
export async function listOpen(db: Db): Promise<AdminOrder[]> {
  const result = await db
    .from('orders')
    .select(ADMIN_ORDER_SELECT)
    .in('status', OPEN_STATUSES)
    .order('created_at', { ascending: false })
    .limit(200);
  return must(result, 'orders.listOpen') as AdminOrder[];
}

export async function findById(db: Db, id: string): Promise<AdminOrder | null> {
  const result = await db.from('orders').select(ADMIN_ORDER_SELECT).eq('id', id).maybeSingle();
  check(result, 'orders.findById');
  return result.data as AdminOrder | null;
}

export type OrderSearch =
  | { kind: 'latest' }
  | { kind: 'number'; number: number }
  | { kind: 'phone'; digits: string }
  | { kind: 'name'; text: string };

/** The latest 100 orders, optionally narrowed by order number, phone digits or name. */
export async function search(db: Db, filter: OrderSearch): Promise<AdminOrder[]> {
  let query = db
    .from('orders')
    .select(ADMIN_ORDER_SELECT)
    .order('created_at', { ascending: false })
    .limit(100);
  if (filter.kind === 'number') query = query.eq('order_number', filter.number);
  if (filter.kind === 'phone') query = query.like('customer_phone', `%${filter.digits}%`);
  if (filter.kind === 'name')
    query = query.ilike('customer_name', `%${filter.text.replace(/[%_]/g, '')}%`);
  return must(await query, 'orders.search') as AdminOrder[];
}

/** The fields the workflow rules look at, or null when there is no such order. */
export async function findState(db: Db, id: string) {
  const result = await db
    .from('orders')
    .select('type, status, scheduled_for')
    .eq('id', id)
    .maybeSingle();
  check(result, 'orders.findState');
  return result.data;
}

/** Changes an order. Database rules may refuse (markers such as `not_paid`, `payment_locked`). */
export async function update(db: Db, id: string, patch: Update<'orders'>): Promise<void> {
  check(await db.from('orders').update(patch).eq('id', id), 'orders.update');
}

// Tables -----------------------------------------------------------------------------------

/** Table ids that have an open order right now. */
export async function busyTableIds(db: Db): Promise<string[]> {
  const result = await db.from('orders').select('table_id').in('status', TABLE_BUSY_STATUSES);
  return must(result, 'orders.busyTableIds')
    .map((o) => o.table_id)
    .filter((id): id is string => !!id);
}

export async function countOpenAtTable(db: Db, tableId: string): Promise<number> {
  const result = await db
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('table_id', tableId)
    .in('status', TABLE_BUSY_STATUSES);
  check(result, 'orders.countOpenAtTable');
  return result.count ?? 0;
}

// Creating orders (database functions, server only) ----------------------------------------

export type CreatedOrder = {
  duplicate: boolean;
  same_request: boolean;
  public_id: string;
  order_number: number;
};

/** A website order with its items, in one transaction. Idempotent by idempotency_key. */
export async function createOnline(db: Db, order: Json, items: Json): Promise<CreatedOrder> {
  const result = await db.rpc('create_order', { p_order: order, p_items: items });
  return must(result, 'orders.createOnline') as unknown as CreatedOrder;
}

/** A table or takeaway order taken by staff. Refuses with `table_busy` / `table_not_found`. */
export async function createCounter(db: Db, order: Json, items: Json) {
  const result = await db.rpc('create_counter_order', { p_order: order, p_items: items });
  return must(result, 'orders.createCounter') as unknown as { id: string; order_number: number };
}

/** Adds dishes to an open order; returns the new KOT round. Refuses with `order_closed`. */
export async function addRound(
  db: Db,
  orderId: string,
  items: Json,
  subtotalTetri: number,
): Promise<number> {
  const result = await db.rpc('add_order_round', {
    p_order_id: orderId,
    p_items: items,
    p_subtotal_tetri: subtotalTetri,
  });
  return must(result, 'orders.addRound') as number;
}

// Public tracking --------------------------------------------------------------------------

/** The public tracking view (no phone, address or IP), via a database function. */
export async function findPublic(db: Db, publicId: string): Promise<Json | null> {
  const result = await db.rpc('get_public_order', { p_public_id: publicId });
  check(result, 'orders.findPublic');
  return result.data ?? null;
}

// Tickets ----------------------------------------------------------------------------------

/** One order with its items and each dish's veg flag, for a printed ticket. */
export async function findForTicket(db: Db, id: string) {
  const result = await db
    .from('orders')
    .select('*, order_items(*, menu_items(is_veg))')
    .eq('id', id)
    .maybeSingle();
  check(result, 'orders.findForTicket');
  return result.data;
}

// Reports ----------------------------------------------------------------------------------

export async function listForReport(db: Db, from: Date, to: Date) {
  const result = await db
    .from('orders')
    .select(
      'order_number, created_at, status, type, source, total_tetri, subtotal_tetri, delivery_fee_tetri, payment_method, payment_status, customer_locale',
    )
    .gte('created_at', from.toISOString())
    .lt('created_at', to.toISOString())
    .order('created_at', { ascending: false })
    .limit(10_000);
  return must(result, 'orders.listForReport');
}

export async function listItemsForReport(db: Db, from: Date, to: Date) {
  const result = await db
    .from('order_items')
    .select('item_name, quantity, line_total_tetri, orders!inner(status, created_at)')
    .gte('orders.created_at', from.toISOString())
    .lt('orders.created_at', to.toISOString())
    .limit(50_000);
  return must(result, 'orders.listItemsForReport');
}
