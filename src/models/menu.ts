/**
 * Model: the menu tables (categories, dishes, option groups and options, and which
 * dishes use which groups), the Sheet import function, and the dish photo bucket.
 */
import {
  check,
  DbError,
  must,
  type Db,
  type Insert,
  type Json,
  type Row,
  type Update,
} from './db/core';

export type MenuRows = {
  categories: Row<'categories'>[];
  items: Row<'menu_items'>[];
  groups: Row<'modifier_groups'>[];
  options: Row<'modifier_options'>[];
  links: Row<'item_modifier_groups'>[];
};

export type GroupWithOptions = Row<'modifier_groups'> & {
  modifier_options: Row<'modifier_options'>[];
};

// Reading ----------------------------------------------------------------------------------

/** What customers can see: visible categories and dishes, with all groups and options. */
export async function loadVisible(db: Db): Promise<MenuRows> {
  const [categories, items, groups, options, links] = await Promise.all([
    db.from('categories').select('*').eq('is_visible', true).order('sort_order'),
    db.from('menu_items').select('*').eq('is_visible', true).order('sort_order'),
    db.from('modifier_groups').select('*').order('sort_order'),
    db.from('modifier_options').select('*').order('sort_order'),
    db.from('item_modifier_groups').select('*').order('sort_order'),
  ]);
  return {
    categories: must(categories, 'menu.categories'),
    items: must(items, 'menu.items'),
    groups: must(groups, 'menu.groups'),
    options: must(options, 'menu.options'),
    links: must(links, 'menu.links'),
  };
}

/** Everything, hidden entries included, for the admin menu editor. */
export async function loadAll(db: Db) {
  const [categories, items, groups, links] = await Promise.all([
    db.from('categories').select('*').order('sort_order'),
    db.from('menu_items').select('*').order('sort_order'),
    db.from('modifier_groups').select('*, modifier_options(*)').order('sort_order'),
    db.from('item_modifier_groups').select('*'),
  ]);
  return {
    categories: must(categories, 'menu.categories'),
    items: must(items, 'menu.items'),
    groups: must(groups, 'menu.groups') as GroupWithOptions[],
    links: must(links, 'menu.links'),
  };
}

/** Visible dishes' slugs and names (for the "signature dishes" picker). */
export async function listVisibleItemNames(db: Db) {
  const result = await db
    .from('menu_items')
    .select('slug, name')
    .eq('is_visible', true)
    .order('sort_order');
  return must(result, 'menu.listVisibleItemNames');
}

export async function listCategoryNames(db: Db) {
  return must(await db.from('categories').select('slug, name'), 'menu.listCategoryNames');
}

// Dishes -----------------------------------------------------------------------------------

export async function findItemPhoto(db: Db, itemId: string): Promise<string | null> {
  const result = await db.from('menu_items').select('photo_path').eq('id', itemId).maybeSingle();
  check(result, 'menu.findItemPhoto');
  return result.data?.photo_path ?? null;
}

export async function updateItem(db: Db, id: string, patch: Update<'menu_items'>) {
  check(await db.from('menu_items').update(patch).eq('id', id), 'menu.updateItem');
}

/** Adds a dish at the end of the menu; returns its id. */
export async function insertItem(db: Db, row: Omit<Insert<'menu_items'>, 'sort_order'>) {
  const last = await db
    .from('menu_items')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  check(last, 'menu.insertItem');
  const result = await db
    .from('menu_items')
    .insert({ ...row, sort_order: (last.data?.sort_order ?? 0) + 1 })
    .select('id')
    .single();
  return must(result, 'menu.insertItem').id;
}

/** Sold out until a time (null = available again). Staff may call it, via a database function. */
export async function setSoldOutUntil(db: Db, itemId: string, until: Date | null) {
  const result = await db.rpc('set_item_sold_out', {
    p_item_id: itemId,
    p_until: until ? until.toISOString() : (null as unknown as string),
  });
  check(result, 'menu.setSoldOutUntil');
}

/** Replaces the option groups a dish uses, in the given order. */
export async function setItemGroups(db: Db, itemId: string, groupIds: string[]) {
  check(await db.from('item_modifier_groups').delete().eq('item_id', itemId), 'menu.setItemGroups');
  if (groupIds.length === 0) return;
  const rows = groupIds.map((group_id, i) => ({ item_id: itemId, group_id, sort_order: i }));
  check(await db.from('item_modifier_groups').insert(rows), 'menu.setItemGroups');
}

// Ordering ---------------------------------------------------------------------------------

export type Sortable = 'menu_items' | 'categories';

/** The entries that share a position list with `id`: a dish's category, or all categories. */
export async function listSiblings(
  db: Db,
  kind: Sortable,
  id: string,
): Promise<{ id: string; sort_order: number }[] | null> {
  if (kind === 'categories') {
    const result = await db
      .from('categories')
      .select('id, sort_order')
      .order('sort_order')
      .order('id');
    return must(result, 'menu.listSiblings');
  }
  const current = await db.from('menu_items').select('category_id').eq('id', id).maybeSingle();
  check(current, 'menu.listSiblings');
  if (!current.data) return null;
  const result = await db
    .from('menu_items')
    .select('id, sort_order')
    .eq('category_id', current.data.category_id)
    .order('sort_order')
    .order('id');
  return must(result, 'menu.listSiblings');
}

export async function setPositions(db: Db, kind: Sortable, ids: string[]) {
  const results = await Promise.all(
    ids.map((id, i) => db.from(kind).update({ sort_order: i }).eq('id', id)),
  );
  for (const r of results) check(r, 'menu.setPositions');
}

// Categories -------------------------------------------------------------------------------

export async function updateCategory(db: Db, id: string, patch: Update<'categories'>) {
  check(await db.from('categories').update(patch).eq('id', id), 'menu.updateCategory');
}

/** New categories go last. */
export async function insertCategory(db: Db, row: Omit<Insert<'categories'>, 'sort_order'>) {
  check(await db.from('categories').insert({ ...row, sort_order: 999 }), 'menu.insertCategory');
}

// Option groups ----------------------------------------------------------------------------

/** Creates or updates a group; returns its id. */
export async function saveGroup(
  db: Db,
  id: string | undefined,
  row: Insert<'modifier_groups'>,
): Promise<string> {
  const result = id
    ? await db.from('modifier_groups').update(row).eq('id', id).select('id').single()
    : await db.from('modifier_groups').insert(row).select('id').single();
  return must(result, 'menu.saveGroup').id;
}

/** Makes a group's options exactly `options` (matched by slug; others are deleted). */
export async function replaceOptions(
  db: Db,
  groupId: string,
  options: Omit<Insert<'modifier_options'>, 'group_id'>[],
) {
  const keep = `(${options.map((o) => `"${o.slug}"`).join(',')})`;
  check(
    await db.from('modifier_options').delete().eq('group_id', groupId).not('slug', 'in', keep),
    'menu.replaceOptions',
  );
  const rows = options.map((o) => ({ ...o, group_id: groupId }));
  check(
    await db.from('modifier_options').upsert(rows, { onConflict: 'group_id,slug' }),
    'menu.replaceOptions',
  );
}

export async function deleteGroup(db: Db, id: string) {
  check(await db.from('modifier_groups').delete().eq('id', id), 'menu.deleteGroup');
}

// Sheet import -----------------------------------------------------------------------------

/** Applies a whole menu snapshot in one transaction (database function). Returns its summary. */
export async function applySnapshot(db: Db, snapshot: Json): Promise<Record<string, unknown>> {
  const result = await db.rpc('apply_menu_snapshot', { p_snapshot: snapshot });
  if (result.error) throw new DbError('menu.applySnapshot', result.error);
  return result.data as Record<string, unknown>;
}

// Photos -----------------------------------------------------------------------------------

export const PHOTO_BUCKET = 'menu-images';

export async function removePhoto(db: Db, path: string) {
  check(await db.storage.from(PHOTO_BUCKET).remove([path]), 'menu.removePhoto');
}

/** Upload from the owner's browser (storage rules allow only the owner). */
export async function uploadPhoto(db: Db, path: string, file: Blob) {
  const result = await db.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  check(result, 'menu.uploadPhoto');
}
