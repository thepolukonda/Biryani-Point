/**
 * Orders taken by staff: table tabs (dine-in) and counter takeaway. Dishes are priced here
 * from the live menu, never by the browser, and saved through database functions that
 * only the server may call.
 */
import 'server-only';
import { priceOrder, type PricingProblem } from '@/shared/domain/pricing';
import type { CartLine } from '@/shared/orders/schema';
import { newPublicId, sha256 } from '@/shared/request';
import { DbError, serviceDb, staffDb, type Json } from '@/models/db';
import * as orders from '@/models/orders';
import { fail, type Outcome } from '../outcome';
import { getMenuUncached, getRestaurantUncached } from '../restaurant';
import { toDraftItem } from './prepare';

/** The first dish the kitchen cannot make, and why. */
export type DishProblem = { dish: string; code: PricingProblem['code'] };

async function price(lines: CartLine[]) {
  const [menu, restaurant] = await Promise.all([getMenuUncached(), getRestaurantUncached()]);
  const priced = priceOrder({
    lines,
    menu: new Map(menu.items.map((i) => [i.slug, i])),
    // No delivery fee or minimum at the counter.
    orderType: 'pickup',
    fees: restaurant.fees,
  });
  const problem = priced.problems[0];
  if (problem) {
    const dish = menu.items.find((i) => i.slug === problem.itemSlug)?.name.en ?? 'A dish';
    return { problem: { dish, code: problem.code } satisfies DishProblem } as const;
  }
  return { priced, restaurant } as const;
}

export type CounterOrderInput = {
  kind: 'dine_in' | 'takeaway';
  tableId?: string;
  customerName?: string;
  notes?: string;
  payment: 'later' | 'cash' | 'card';
  lines: CartLine[];
  idempotencyKey: string;
};

type CounterReason = 'table_required' | 'dish' | 'table_busy' | 'table_not_found';

export async function createCounterOrder(
  input: CounterOrderInput,
  staffUserId: string,
): Promise<
  | { ok: true; orderId: string; orderNumber: number }
  | { ok: false; reason: CounterReason; problem?: DishProblem }
> {
  if (input.kind === 'dine_in' && !input.tableId) return fail('table_required');
  const result = await price(input.lines);
  if ('problem' in result) return { ok: false, reason: 'dish', problem: result.problem };
  const { priced, restaurant } = result;
  const prep = restaurant.prepMinutes.pickup;

  try {
    const created = await orders.createCounter(
      serviceDb(),
      {
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
        created_by: staffUserId,
      } as Json,
      priced.lines.map(toDraftItem) as unknown as Json,
    );
    return { ok: true, orderId: created.id, orderNumber: created.order_number };
  } catch (e) {
    if (e instanceof DbError && e.has('table_busy')) return fail('table_busy');
    if (e instanceof DbError && e.has('table_not_found')) return fail('table_not_found');
    throw e;
  }
}

/** Another round of dishes for an open table tab or takeaway. Prints as its own KOT. */
export async function addRound(
  orderId: string,
  lines: CartLine[],
): Promise<
  | { ok: true; round: number }
  | { ok: false; reason: 'dish' | 'order_closed'; problem?: DishProblem }
> {
  const result = await price(lines);
  if ('problem' in result) return { ok: false, reason: 'dish', problem: result.problem };
  try {
    const round = await orders.addRound(
      serviceDb(),
      orderId,
      result.priced.lines.map(toDraftItem) as unknown as Json,
      result.priced.subtotalTetri,
    );
    return { ok: true, round };
  } catch (e) {
    if (e instanceof DbError && e.has('order_closed')) return fail('order_closed');
    throw e;
  }
}

/**
 * Takes payment. A table tab is closed (and the table is free again); a takeaway is only
 * marked paid, and is closed when it is picked up.
 */
export async function settle(
  orderId: string,
  method: 'cash' | 'card',
): Promise<Outcome<'not_found' | 'payment_locked'>> {
  const db = await staffDb();
  const current = await orders.findState(db, orderId);
  if (!current) return fail('not_found');
  const closeTable = current.type === 'dine_in';
  try {
    await orders.update(db, orderId, {
      payment_method: method,
      payment_status: 'paid',
      ...(closeTable ? { status: 'completed' as const } : {}),
    });
  } catch (e) {
    if (e instanceof DbError && e.has('payment_locked')) return fail('payment_locked');
    throw e;
  }
  return { ok: true };
}
