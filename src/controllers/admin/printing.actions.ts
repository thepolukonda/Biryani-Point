'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import { requireOwner, requireStaff } from './guard';
import { reportError } from '@/shared/monitoring';
import * as printers from '@/model-helpers/printing/printers';
import type { Json, Update } from '@/models/db/core';
import type { FormState } from './form-state';

export type ClaimResult = { ok: true; copy: number | null } | { ok: false; error: string };

/**
 * Records a print and returns its copy number (1 = first print, 2+ = reprint).
 * `firstOnly` (auto-print) returns copy: null when the ticket was already printed,
 * e.g. by another kitchen device. Each KOT `round` (dishes added to a table later) is
 * its own ticket.
 */
export async function claimPrint(
  orderId: string,
  kind: 'kot' | 'bill',
  firstOnly = false,
  round = 1,
): Promise<ClaimResult> {
  await requireStaff();
  const parsed = z
    .object({
      orderId: z.uuid(),
      kind: z.enum(['kot', 'bill']),
      firstOnly: z.boolean(),
      round: z.number().int().min(1).max(99),
    })
    .safeParse({ orderId, kind, firstOnly, round });
  if (!parsed.success) return { ok: false, error: 'Invalid request.' };
  try {
    return { ok: true, copy: await printers.claimPrint(orderId, kind, firstOnly, round) };
  } catch (e) {
    reportError(e, { where: 'claimPrint', orderId, kind });
    return { ok: false, error: 'Could not print.' };
  }
}

async function save(patch: Update<'print_settings'>, message = 'Saved.'): Promise<FormState> {
  try {
    await printers.saveSettings(patch);
  } catch (e) {
    reportError(e, { where: 'savePrintSettings' });
    return { error: 'Could not save. Please try again.' };
  }
  refresh();
  return { ok: true, message };
}

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v));

const billDetails = z.object({
  legal_name: text(120),
  tax_id: text(40),
  legal_address: text(200),
});

export async function saveBillDetails(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = billDetails.safeParse({
    legal_name: form.get('legal_name') ?? '',
    tax_id: form.get('tax_id') ?? '',
    legal_address: form.get('legal_address') ?? '',
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the fields.' };
  const footer: Record<string, string> = {};
  for (const l of ['en', 'ka', 'ru']) {
    const v = String(form.get(`bill_footer_${l}`) ?? '')
      .trim()
      .slice(0, 160);
    if (v) footer[l] = v;
  }
  if (Object.keys(footer).length > 0 && !footer.en)
    return {
      error: 'Write the bill message in English too (it is used when a language is empty).',
    };

  return save({
    ...parsed.data,
    vat_registered: form.get('vat_registered') === 'on',
    bill_footer: footer as NonNullable<Json>,
  });
}

const printer = z.object({
  paper_width_mm: z.coerce.number().pipe(z.union([z.literal(58), z.literal(80)])),
  kot_language: z.enum(['en', 'ka', 'ru']),
  bill_language: z.enum(['customer', 'en', 'ka', 'ru']),
  kot_copies: z.coerce.number().int().min(1).max(3),
  bill_copies: z.coerce.number().int().min(1).max(3),
});

export async function savePrinterSettings(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = printer.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Check the printer options.' };
  return save(
    {
      ...parsed.data,
      auto_print_kot: form.get('auto_print_kot') === 'on',
      auto_print_bill: form.get('auto_print_bill') === 'on',
      bill_show_phone: form.get('bill_show_phone') === 'on',
      bill_show_qr: form.get('bill_show_qr') === 'on',
    },
    'Saved. The preview below shows the new settings.',
  );
}
