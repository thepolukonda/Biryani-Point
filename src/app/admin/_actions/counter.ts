'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import { requireOwner, requireStaff } from '@/lib/admin/auth';
import { getMenuUncached, getRestaurantUncached } from '@/lib/data/restaurant';
import { priceOrder, type PricingProblem } from '@/lib/domain/pricing';
import { reportError } from '@/lib/monitoring';
import { toDraftItem } from '@/lib/orders/prepare';
import { cartLineSchema } from '@/lib/orders/schema';
import { newPublicId, sha256 } from '@/lib/request';
import { serviceClient } from '@/lib/supabase/clients';
import type { Json } from '@/lib/supabase/database.types';
import { sessionClient } from '@/lib/supabase/session';
import type { FormState } from './settings';

/**
 * Orders taken by staff: table tabs (dine-in) and counter takeaway. Dishes are priced here
 * from the live menu, never by the browser, and saved through database functions that
 * only the server may call.
 */

export type CounterResult =
  | { ok: true; orderId: string; orderNumber?: number; round?: number }
  | { ok: false; error: string };

const lines = z.array(cartLineSchema).min(1, 'Add at least one dish.').max(30);

const PROBLEM_TEXT: Partial<Record<PricingProblem['code'], string>> = {
  item_unavailable: 'is sold out',
  item_not_found: 'is no longer on the menu',
  too_few_options: 'needs an option chosen',
  too_many_options: 'has too many options',
  option_unavailable: 'has an option that is sold out',
};

/** Prices the dishes, or explains the first problem in plain words. */
async function price(input: z.infer<typeof lines>) {
  const [menu, restaurant] = await Promise.all([getMenuUncached(), getRestaurantUncached()]);
  const priced = priceOrder({
    lines: input,
    menu: new Map(menu.items.map((i) => [i.slug, i])),
    // No delivery fee or minimum at the counter.
    orderType: 'pickup',
    fees: restaurant.fees,
  });
  const problem = priced.problems[0];
  if (problem) {
    const item = menu.items.find((i) => i.slug === problem.itemSlug);
    const name = item?.name.en ?? 'A dish';
    return {
      error: `${name} ${PROBLEM_TEXT[problem.code] ?? 'cannot be ordered'}. Please change the order.`,
    } as const;
  }
  return { priced, restaurant } as const;
}

const createInput = z.object({
  kind: z.enum(['dine_in', 'takeaway']),
  tableId: z.uuid().optional(),
  customerName: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
  payment: z.enum(['later', 'cash', 'card']),
  lines,
  idempotencyKey: z.string().min(16).max(100),
});

export async function createCounterOrder(raw: z.input<typeof createInput>): Promise<CounterResult> {
  const user = await requireStaff();
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const input = parsed.data;
  if (input.kind === 'dine_in' && !input.tableId) return { ok: false, error: 'Choose a table.' };

  const result = await price(input.lines);
  if ('error' in result) return { ok: false, error: result.error! };
  const { priced, restaurant } = result;
  const prep = restaurant.prepMinutes.pickup;

  const { data, error } = await serviceClient().rpc('create_counter_order', {
    p_order: {
      public_id: newPublicId(),
      idempotency_key: input.idempotencyKey,
      request_hash: sha256(JSON.stringify(input)),
      type: input.kind === 'dine_in' ? 'dine_in' : 'pickup',
      table_id: input.kind === 'dine_in' ? input.tableId : null,
      customer_name: input.customerName ?? '',
      notes: input.notes || null,
      prep_minutes: prep,
      estimated_ready_at: new Date(Date.now() + prep * 60_000).toISOString(),
      subtotal_tetri: priced.subtotalTetri,
      payment_method: input.payment === 'card' ? 'card' : 'cash',
      payment_status: input.payment === 'later' ? 'unpaid' : 'paid',
      created_by: user.id,
    } as Json,
    p_items: priced.lines.map(toDraftItem) as unknown as Json,
  });
  if (error) {
    if (error.message.includes('table_busy'))
      return {
        ok: false,
        error: 'This table already has an open order. Add dishes to it instead.',
      };
    if (error.message.includes('table_not_found'))
      return { ok: false, error: 'This table no longer exists. Reload the page.' };
    reportError(error, { where: 'createCounterOrder' });
    return { ok: false, error: 'Could not save the order. Please try again.' };
  }
  const out = data as { id: string; order_number: number };
  return { ok: true, orderId: out.id, orderNumber: out.order_number, round: 1 };
}

const roundInput = z.object({ orderId: z.uuid(), lines });

/** Another round of dishes for an open table tab or takeaway. Prints as its own KOT. */
export async function addOrderRound(raw: z.input<typeof roundInput>): Promise<CounterResult> {
  await requireStaff();
  const parsed = roundInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const result = await price(parsed.data.lines);
  if ('error' in result) return { ok: false, error: result.error! };

  const { data, error } = await serviceClient().rpc('add_order_round', {
    p_order_id: parsed.data.orderId,
    p_items: result.priced.lines.map(toDraftItem) as unknown as Json,
    p_subtotal_tetri: result.priced.subtotalTetri,
  });
  if (error) {
    if (error.message.includes('order_closed'))
      return { ok: false, error: 'This order is already closed.' };
    reportError(error, { where: 'addOrderRound', orderId: parsed.data.orderId });
    return { ok: false, error: 'Could not add the dishes. Please try again.' };
  }
  return { ok: true, orderId: parsed.data.orderId, round: data as number };
}

const settleInput = z.object({ orderId: z.uuid(), method: z.enum(['cash', 'card']) });

/**
 * Takes payment. A table tab is closed (and the table is free again); a takeaway is only
 * marked paid, and is closed when it is picked up.
 */
export async function settleOrder(raw: z.input<typeof settleInput>): Promise<CounterResult> {
  await requireStaff();
  const parsed = settleInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Invalid request.' };
  const { orderId, method } = parsed.data;
  const db = await sessionClient();
  const current = await db.from('orders').select('type, status').eq('id', orderId).single();
  if (current.error) return { ok: false, error: 'Order not found.' };
  const closeTable = current.data.type === 'dine_in';
  const { error } = await db
    .from('orders')
    .update({
      payment_method: method,
      payment_status: 'paid',
      ...(closeTable ? { status: 'completed' as const } : {}),
    })
    .eq('id', orderId);
  if (error) {
    reportError(error, { where: 'settleOrder', orderId });
    return {
      ok: false,
      error: error.message.includes('payment_locked')
        ? 'This order is already closed.'
        : 'Could not record the payment.',
    };
  }
  return { ok: true, orderId };
}

// Tables (owner) ------------------------------------------------------------------------

const tableInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, 'Give the table a name, e.g. 4 or T4.').max(40),
  seats: z.coerce.number().int().min(1, 'Seats: 1 to 50.').max(50, 'Seats: 1 to 50.'),
  area: z.string().trim().max(40).optional(),
  sort_order: z.coerce.number().int().min(0).max(9999).default(0),
  is_active: z.boolean(),
});

export async function saveTable(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = tableInput.safeParse({
    id: form.get('id') || undefined,
    name: form.get('name'),
    seats: form.get('seats'),
    area: form.get('area') || undefined,
    sort_order: form.get('sort_order') || 0,
    is_active: form.get('is_active') === 'on',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const { id, area, ...rest } = parsed.data;
  const row = { ...rest, area: area || null };
  const db = await sessionClient();
  const { error } = id
    ? await db.from('dining_tables').update(row).eq('id', id)
    : await db.from('dining_tables').insert(row);
  if (error) {
    if (error.code === '23505') return { error: `There is already a table called "${row.name}".` };
    reportError(error, { where: 'saveTable' });
    return { error: 'Could not save the table.' };
  }
  refresh();
  return { ok: true, message: id ? 'Table saved.' : `Table ${row.name} added.` };
}

export async function removeTable(id: string): Promise<FormState> {
  await requireOwner();
  if (!z.uuid().safeParse(id).success) return { error: 'Invalid table.' };
  const db = await sessionClient();
  const open = await db
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('table_id', id)
    .in('status', ['accepted', 'preparing', 'ready']);
  if ((open.count ?? 0) > 0)
    return { error: 'This table has an open order. Close it (Bill & pay) before removing it.' };
  // Past orders keep the table's name; only the link to the table is cleared.
  const { error } = await db.from('dining_tables').delete().eq('id', id);
  if (error) {
    reportError(error, { where: 'removeTable' });
    return { error: 'Could not remove the table.' };
  }
  refresh();
  return { ok: true, message: 'Table removed.' };
}
