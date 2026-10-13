/**
 * Model: the restaurant's settings row, opening hours, closures and delivery zones.
 */
import { check, must, type Db, type Insert, type Row, type Update } from './db/core';

const SETTINGS_ID = 1;

export type SettingsRow = Row<'restaurant_settings'>;
export type SettingsUpdate = Update<'restaurant_settings'>;

export async function loadSettings(db: Db): Promise<SettingsRow> {
  const result = await db.from('restaurant_settings').select('*').eq('id', SETTINGS_ID).single();
  return must(result, 'restaurant.loadSettings');
}

/** Where the menu is edited, and which settings the Sheet controls. */
export async function loadMenuSource(db: Db) {
  const result = await db
    .from('restaurant_settings')
    .select('menu_source, sheet_managed_fields')
    .eq('id', SETTINGS_ID)
    .single();
  return must(result, 'restaurant.loadMenuSource');
}

export async function updateSettings(db: Db, patch: SettingsUpdate) {
  check(
    await db.from('restaurant_settings').update(patch).eq('id', SETTINGS_ID),
    'restaurant.updateSettings',
  );
}

// Opening hours ----------------------------------------------------------------------------

export async function listHours(db: Db) {
  const result = await db.from('opening_hours').select('*').order('weekday').order('opens_at');
  return must(result, 'restaurant.listHours');
}

export async function hasSheetHours(db: Db): Promise<boolean> {
  const result = await db.from('opening_hours').select('id').eq('source', 'sheet').limit(1);
  return must(result, 'restaurant.hasSheetHours').length > 0;
}

/** Replaces the whole week. */
export async function replaceHours(db: Db, rows: Insert<'opening_hours'>[]) {
  check(await db.from('opening_hours').delete().gte('weekday', 1), 'restaurant.replaceHours');
  if (rows.length) check(await db.from('opening_hours').insert(rows), 'restaurant.replaceHours');
}

// Closures ---------------------------------------------------------------------------------

/** All closures, or only those ending on or after `endingFrom` (YYYY-MM-DD). */
export async function listClosures(db: Db, endingFrom?: string) {
  let query = db.from('closures').select('*');
  if (endingFrom) query = query.gte('ends_on', endingFrom);
  return must(await query.order('starts_on'), 'restaurant.listClosures');
}

export async function insertClosure(db: Db, row: Insert<'closures'>) {
  check(await db.from('closures').insert(row), 'restaurant.insertClosure');
}

/** Only closures added in the admin panel can be removed there (the Sheet owns its own). */
export async function deleteAdminClosure(db: Db, id: string) {
  check(
    await db.from('closures').delete().eq('id', id).eq('source', 'admin'),
    'restaurant.deleteAdminClosure',
  );
}

// Delivery zones ---------------------------------------------------------------------------

export async function listZones(db: Db, { activeOnly = false } = {}) {
  let query = db.from('delivery_zones').select('*');
  if (activeOnly) query = query.eq('is_active', true);
  return must(await query.order('sort_order'), 'restaurant.listZones');
}

export async function saveZone(db: Db, id: string | null, row: Insert<'delivery_zones'>) {
  const result = id
    ? await db.from('delivery_zones').update(row).eq('id', id)
    : await db.from('delivery_zones').insert(row);
  check(result, 'restaurant.saveZone');
}

export async function deleteZone(db: Db, id: string) {
  check(await db.from('delivery_zones').delete().eq('id', id), 'restaurant.deleteZone');
}
