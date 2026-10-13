/** Model: the dining tables. */
import { check, must, type Db, type Insert } from './db/core';

export async function listAll(db: Db) {
  const result = await db.from('dining_tables').select('*').order('sort_order').order('name');
  return must(result, 'tables.listAll');
}

/** Creates or updates a table. A duplicate name fails with DbError.isDuplicate. */
export async function save(db: Db, id: string | undefined, row: Insert<'dining_tables'>) {
  const result = id
    ? await db.from('dining_tables').update(row).eq('id', id)
    : await db.from('dining_tables').insert(row);
  check(result, 'tables.save');
}

/** Past orders keep the table's name; only their link to the table is cleared. */
export async function remove(db: Db, id: string) {
  check(await db.from('dining_tables').delete().eq('id', id), 'tables.remove');
}
