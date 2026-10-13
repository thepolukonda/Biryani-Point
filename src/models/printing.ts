/** Model: printer and bill settings, and the print log behind the REPRINT / COPY marks. */
import { check, type Db, type Row, type Update } from './db/core';

const SETTINGS_ID = 1;

export type PrintSettingsRow = Row<'print_settings'>;

export async function loadSettings(db: Db): Promise<PrintSettingsRow | null> {
  const result = await db.from('print_settings').select('*').eq('id', SETTINGS_ID).maybeSingle();
  check(result, 'printing.loadSettings');
  return result.data;
}

export async function updateSettings(db: Db, patch: Update<'print_settings'>) {
  check(
    await db.from('print_settings').update(patch).eq('id', SETTINGS_ID),
    'printing.updateSettings',
  );
}

/**
 * Records a print and returns its copy number (1 = first print). With `firstOnly`,
 * returns null when that ticket was already printed (e.g. by another kitchen device).
 */
export async function claim(
  db: Db,
  orderId: string,
  kind: 'kot' | 'bill',
  firstOnly: boolean,
  round: number,
): Promise<number | null> {
  const result = await db.rpc('claim_print', {
    p_order_id: orderId,
    p_kind: kind,
    p_first_only: firstOnly,
    p_round: round,
  });
  check(result, 'printing.claim');
  return result.data ?? null;
}
