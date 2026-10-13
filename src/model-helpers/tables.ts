/** The restaurant's dining tables (owner), and which of them are taken right now. */
import 'server-only';
import { DbError, staffDb, type Insert } from '@/models/db';
import * as orders from '@/models/orders';
import * as tables from '@/models/tables';
import { fail, type Outcome } from './outcome';

export async function listWithBusy() {
  const db = await staffDb();
  const [all, busy] = await Promise.all([tables.listAll(db), orders.busyTableIds(db)]);
  return { tables: all, busy };
}

export type TableInput = Omit<Insert<'dining_tables'>, 'id'> & { id?: string };

export async function saveTable({ id, ...row }: TableInput): Promise<Outcome<'duplicate_name'>> {
  try {
    await tables.save(await staffDb(), id, row);
  } catch (e) {
    if (e instanceof DbError && e.isDuplicate) return fail('duplicate_name');
    throw e;
  }
  return { ok: true };
}

/** A table with an open order cannot be removed; close it (Bill & pay) first. */
export async function removeTable(id: string): Promise<Outcome<'has_open_order'>> {
  const db = await staffDb();
  if ((await orders.countOpenAtTable(db, id)) > 0) return fail('has_open_order');
  await tables.remove(db, id);
  return { ok: true };
}
