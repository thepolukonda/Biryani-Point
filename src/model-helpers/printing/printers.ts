/** Printer settings and the print log (REPRINT / COPY marks). */
import 'server-only';
import { staffDb, type Update } from '@/models/db';
import * as printing from '@/models/printing';

/**
 * Records a print and returns its copy number (1 = first print, 2+ = reprint).
 * `firstOnly` (auto-print) returns null when the ticket was already printed, e.g. by
 * another kitchen device. Each KOT `round` (dishes added to a table later) is its own ticket.
 */
export async function claimPrint(
  orderId: string,
  kind: 'kot' | 'bill',
  firstOnly: boolean,
  round: number,
) {
  return printing.claim(await staffDb(), orderId, kind, firstOnly, round);
}

export async function saveSettings(patch: Update<'print_settings'>) {
  await printing.updateSettings(await staffDb(), patch);
}
