'use server';

import { z } from 'zod';
import { requireStaff } from '@/lib/admin/auth';
import { reportError } from '@/lib/monitoring';
import type { Database } from '@/lib/supabase/database.types';
import { sessionClient } from '@/lib/supabase/session';

const statusSchema = z.enum([
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
  'completed',
  'rejected',
  'cancelled',
]);

const input = z.object({
  orderId: z.uuid(),
  status: statusSchema,
  prepMinutes: z.number().int().min(1).max(240).optional(),
  reason: z.string().trim().min(1).max(300).optional(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Move an order to its next status. Runs as the signed-in staff member, so the
 * database's rules apply (staff may only change workflow fields, and only forwards).
 */
export async function updateOrderStatus(raw: z.input<typeof input>): Promise<ActionResult> {
  await requireStaff();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Invalid request.' };
  const { orderId, status, prepMinutes, reason } = parsed.data;
  if ((status === 'rejected' || status === 'cancelled') && !reason)
    return { ok: false, error: 'Please give a reason.' };

  const db = await sessionClient();
  const current = await db.from('orders').select('scheduled_for').eq('id', orderId).single();
  if (current.error) return { ok: false, error: 'Order not found.' };

  const update: Database['public']['Tables']['orders']['Update'] = { status };
  if (status === 'accepted' && prepMinutes) {
    update.prep_minutes = prepMinutes;
    // Scheduled orders keep their time; ASAP orders get "now + prep time".
    if (!current.data.scheduled_for)
      update.estimated_ready_at = new Date(Date.now() + prepMinutes * 60_000).toISOString();
  }
  if (reason) update.rejection_reason = reason;

  const { error } = await db.from('orders').update(update).eq('id', orderId);
  if (error) {
    reportError(error, { where: 'updateOrderStatus', orderId, status });
    return {
      ok: false,
      error: error.message.includes('not_paid')
        ? 'Mark the order paid first.'
        : error.message.includes('cannot move')
          ? 'This order has already moved on. Refresh the board.'
          : 'Could not update the order.',
    };
  }
  return { ok: true };
}

export async function setPrepTime(orderId: string, prepMinutes: number): Promise<ActionResult> {
  await requireStaff();
  const parsed = z
    .object({ orderId: z.uuid(), prepMinutes: z.number().int().min(1).max(240) })
    .safeParse({ orderId, prepMinutes });
  if (!parsed.success) return { ok: false, error: 'Invalid request.' };
  const db = await sessionClient();
  const { error } = await db
    .from('orders')
    .update({
      prep_minutes: prepMinutes,
      estimated_ready_at: new Date(Date.now() + prepMinutes * 60_000).toISOString(),
    })
    .eq('id', orderId);
  return error ? { ok: false, error: 'Could not update the time.' } : { ok: true };
}

export async function setPaid(orderId: string, paid: boolean): Promise<ActionResult> {
  await requireStaff();
  if (!z.uuid().safeParse(orderId).success) return { ok: false, error: 'Invalid request.' };
  const db = await sessionClient();
  const { error } = await db
    .from('orders')
    .update({ payment_status: paid ? 'paid' : 'unpaid' })
    .eq('id', orderId);
  if (!error) return { ok: true };
  return {
    ok: false,
    error: error.message.includes('payment_locked')
      ? 'Payment can only change while the order is in progress.'
      : 'Could not update payment.',
  };
}
