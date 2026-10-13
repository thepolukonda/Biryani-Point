'use server';

import { z } from 'zod';
import { reportError } from '@/shared/monitoring';
import * as kitchen from '@/model-helpers/orders/kitchen';
import { requireStaff } from './guard';

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

const STATUS_ERRORS = {
  reason_required: 'Please give a reason.',
  not_found: 'Order not found.',
  not_paid: 'Mark the order paid first.',
  moved_on: 'This order has already moved on. Refresh the board.',
} as const;

/** Move an order to its next status. */
export async function updateOrderStatus(raw: z.input<typeof input>): Promise<ActionResult> {
  await requireStaff();
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Invalid request.' };
  try {
    const result = await kitchen.changeStatus(parsed.data);
    return result.ok ? result : { ok: false, error: STATUS_ERRORS[result.reason] };
  } catch (e) {
    reportError(e, { where: 'updateOrderStatus', ...parsed.data });
    return { ok: false, error: 'Could not update the order.' };
  }
}

export async function setPrepTime(orderId: string, prepMinutes: number): Promise<ActionResult> {
  await requireStaff();
  const parsed = z
    .object({ orderId: z.uuid(), prepMinutes: z.number().int().min(1).max(240) })
    .safeParse({ orderId, prepMinutes });
  if (!parsed.success) return { ok: false, error: 'Invalid request.' };
  try {
    await kitchen.setPrepTime(orderId, prepMinutes);
    return { ok: true };
  } catch (e) {
    reportError(e, { where: 'setPrepTime', orderId });
    return { ok: false, error: 'Could not update the time.' };
  }
}

export async function setPaid(orderId: string, paid: boolean): Promise<ActionResult> {
  await requireStaff();
  if (!z.uuid().safeParse(orderId).success) return { ok: false, error: 'Invalid request.' };
  try {
    const result = await kitchen.setPaid(orderId, paid);
    if (result.ok) return result;
    return { ok: false, error: 'Payment can only change while the order is in progress.' };
  } catch (e) {
    reportError(e, { where: 'setPaid', orderId });
    return { ok: false, error: 'Could not update payment.' };
  }
}
