/**
 * The kitchen's work on orders: the live board, moving an order through its statuses,
 * prep time, payment, and the order history search.
 *
 * Runs as the signed-in staff member, so the database's rules apply too (staff may only
 * change workflow fields, only forwards, and payment only while an order is in progress).
 */
import 'server-only';
import type { AdminOrder } from '@/shared/admin/orders';
import { DbError, staffDb, type Update } from '@/models/db';
import * as orders from '@/models/orders';
import type { OrderStatus } from '@/models/orders';
import * as tables from '@/models/tables';
import { fail, type Outcome } from '../outcome';

export async function openOrders(): Promise<AdminOrder[]> {
  return orders.listOpen(await staffDb());
}

export async function allTables() {
  return tables.listAll(await staffDb());
}

export type StatusChange = {
  orderId: string;
  status: OrderStatus;
  prepMinutes?: number;
  reason?: string;
};

export async function changeStatus(
  change: StatusChange,
): Promise<Outcome<'reason_required' | 'not_found' | 'not_paid' | 'moved_on'>> {
  const { orderId, status, prepMinutes, reason } = change;
  if ((status === 'rejected' || status === 'cancelled') && !reason) return fail('reason_required');

  const db = await staffDb();
  const current = await orders.findState(db, orderId);
  if (!current) return fail('not_found');

  const patch: Update<'orders'> = { status };
  if (status === 'accepted' && prepMinutes) {
    patch.prep_minutes = prepMinutes;
    // Scheduled orders keep their time; ASAP orders get "now + prep time".
    if (!current.scheduled_for) patch.estimated_ready_at = readyAt(prepMinutes);
  }
  if (reason) patch.rejection_reason = reason;

  try {
    await orders.update(db, orderId, patch);
  } catch (e) {
    if (e instanceof DbError && e.has('not_paid')) return fail('not_paid');
    if (e instanceof DbError && e.has('cannot move')) return fail('moved_on');
    throw e;
  }
  return { ok: true };
}

export async function setPrepTime(orderId: string, prepMinutes: number) {
  await orders.update(await staffDb(), orderId, {
    prep_minutes: prepMinutes,
    estimated_ready_at: readyAt(prepMinutes),
  });
}

export async function setPaid(orderId: string, paid: boolean): Promise<Outcome<'payment_locked'>> {
  try {
    await orders.update(await staffDb(), orderId, { payment_status: paid ? 'paid' : 'unpaid' });
  } catch (e) {
    if (e instanceof DbError && e.has('payment_locked')) return fail('payment_locked');
    throw e;
  }
  return { ok: true };
}

/**
 * The latest orders, or those matching `q`: an order number ("BP-1042", "bp1042", "1042"),
 * at least 6 digits of a phone number, or part of a name.
 */
export async function searchHistory(q: string, orderPrefix: string): Promise<AdminOrder[]> {
  return orders.search(await staffDb(), parseSearch(q, orderPrefix));
}

export function parseSearch(q: string, orderPrefix: string): orders.OrderSearch {
  if (!q) return { kind: 'latest' };
  const numberPattern = new RegExp(`^(${orderPrefix}-?)?(\\d+)$`, 'i');
  const number = Number(numberPattern.exec(q)?.[2]);
  if (Number.isInteger(number) && number > 0) return { kind: 'number', number };
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 6) return { kind: 'phone', digits: digits.slice(-9) };
  return { kind: 'name', text: q };
}

const readyAt = (prepMinutes: number) => new Date(Date.now() + prepMinutes * 60_000).toISOString();
