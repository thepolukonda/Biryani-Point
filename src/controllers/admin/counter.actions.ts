'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import type { PricingProblem } from '@/shared/domain/pricing';
import { reportError } from '@/shared/monitoring';
import { cartLineSchema } from '@/shared/orders/schema';
import * as counter from '@/model-helpers/orders/counter';
import type { DishProblem } from '@/model-helpers/orders/counter';
import * as tablesHelper from '@/model-helpers/tables';
import type { FormState } from './form-state';
import { requireOwner, requireStaff } from './guard';

/** Table tabs (dine-in) and counter takeaway, taken by staff. */

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

const dishError = (p: DishProblem) =>
  `${p.dish} ${PROBLEM_TEXT[p.code] ?? 'cannot be ordered'}. Please change the order.`;

const createInput = z.object({
  kind: z.enum(['dine_in', 'takeaway']),
  tableId: z.uuid().optional(),
  customerName: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
  payment: z.enum(['later', 'cash', 'card']),
  lines,
  idempotencyKey: z.string().min(16).max(100),
});

const CREATE_ERRORS = {
  table_required: 'Choose a table.',
  table_busy: 'This table already has an open order. Add dishes to it instead.',
  table_not_found: 'This table no longer exists. Reload the page.',
} as const;

export async function createCounterOrder(raw: z.input<typeof createInput>): Promise<CounterResult> {
  const user = await requireStaff();
  const parsed = createInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  try {
    const result = await counter.createCounterOrder(parsed.data, user.id);
    if (result.ok) return { ...result, round: 1 };
    if (result.reason === 'dish') return { ok: false, error: dishError(result.problem!) };
    return { ok: false, error: CREATE_ERRORS[result.reason] };
  } catch (e) {
    reportError(e, { where: 'createCounterOrder' });
    return { ok: false, error: 'Could not save the order. Please try again.' };
  }
}

const roundInput = z.object({ orderId: z.uuid(), lines });

/** Another round of dishes for an open table tab or takeaway. Prints as its own KOT. */
export async function addOrderRound(raw: z.input<typeof roundInput>): Promise<CounterResult> {
  await requireStaff();
  const parsed = roundInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { orderId } = parsed.data;
  try {
    const result = await counter.addRound(orderId, parsed.data.lines);
    if (result.ok) return { ok: true, orderId, round: result.round };
    if (result.reason === 'dish') return { ok: false, error: dishError(result.problem!) };
    return { ok: false, error: 'This order is already closed.' };
  } catch (e) {
    reportError(e, { where: 'addOrderRound', orderId });
    return { ok: false, error: 'Could not add the dishes. Please try again.' };
  }
}

const settleInput = z.object({ orderId: z.uuid(), method: z.enum(['cash', 'card']) });

/** Takes payment: closes a table tab; marks a takeaway paid (closed when picked up). */
export async function settleOrder(raw: z.input<typeof settleInput>): Promise<CounterResult> {
  await requireStaff();
  const parsed = settleInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Invalid request.' };
  const { orderId, method } = parsed.data;
  try {
    const result = await counter.settle(orderId, method);
    if (result.ok) return { ok: true, orderId };
    return {
      ok: false,
      error: result.reason === 'not_found' ? 'Order not found.' : 'This order is already closed.',
    };
  } catch (e) {
    reportError(e, { where: 'settleOrder', orderId });
    return { ok: false, error: 'Could not record the payment.' };
  }
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
  const { area, ...rest } = parsed.data;
  try {
    const result = await tablesHelper.saveTable({ ...rest, area: area || null });
    if (!result.ok) return { error: `There is already a table called "${rest.name}".` };
  } catch (e) {
    reportError(e, { where: 'saveTable' });
    return { error: 'Could not save the table.' };
  }
  refresh();
  return { ok: true, message: rest.id ? 'Table saved.' : `Table ${rest.name} added.` };
}

export async function removeTable(id: string): Promise<FormState> {
  await requireOwner();
  if (!z.uuid().safeParse(id).success) return { error: 'Invalid table.' };
  try {
    const result = await tablesHelper.removeTable(id);
    if (!result.ok)
      return { error: 'This table has an open order. Close it (Bill & pay) before removing it.' };
  } catch (e) {
    reportError(e, { where: 'removeTable' });
    return { error: 'Could not remove the table.' };
  }
  refresh();
  return { ok: true, message: 'Table removed.' };
}
