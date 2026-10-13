/**
 * Editing the menu from the admin panel. While the menu comes from the Google Sheet,
 * only "sold out" and photos can change here; everything else is edited in the sheet.
 */
import 'server-only';
import { serverEnv } from '@/config/env.server';
import { zonedParts, zonedTimeToUtc } from '@/shared/domain/hours';
import { DbError, serviceDb, staffDb, type Insert } from '@/models/db';
import * as integrations from '@/models/integrations';
import * as menu from '@/models/menu';
import type { Sortable } from '@/models/menu';
import * as restaurant from '@/models/restaurant';
import { fail, type Outcome } from './outcome';
import { getRestaurant } from './restaurant';

type EditReason = 'from_sheet' | 'duplicate_slug';

async function editedInSheet(): Promise<boolean> {
  const { menu_source } = await restaurant.loadMenuSource(await staffDb());
  return menu_source === 'sheet';
}

/** Runs a write that may hit a unique slug, as an Outcome. */
async function saving(write: () => Promise<void>): Promise<Outcome<EditReason>> {
  if (await editedInSheet()) return fail('from_sheet');
  try {
    await write();
  } catch (e) {
    if (e instanceof DbError && e.isDuplicate) return fail('duplicate_slug');
    throw e;
  }
  return { ok: true };
}

// The editor page --------------------------------------------------------------------------

export async function editorData() {
  const db = await staffDb();
  const [rows, source, runs, links] = await Promise.all([
    menu.loadAll(db),
    restaurant.loadMenuSource(db),
    integrations.listRecentRuns(db),
    // Only whether a link exists, not the link itself (owner-only table).
    integrations.loadSettings(serviceDb()),
  ]);
  return {
    ...rows,
    source: source.menu_source,
    runs,
    sheetConfigured: Boolean(links.sheet_menu_csv_url || serverEnv().SHEET_MENU_CSV_URL),
  };
}

// Sold out and photos (allowed while the Sheet manages the menu) ---------------------------

/** 05:00 tomorrow, local time: the end of "today" for a restaurant that may close after midnight. */
function endOfBusinessDay(timeZone: string, now = new Date()) {
  const p = zonedParts(now, timeZone);
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day + (p.hour < 5 ? 0 : 1)));
  return zonedTimeToUtc(
    { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate() },
    5 * 60,
    timeZone,
  );
}

export async function setSoldOut(itemId: string, mode: 'today' | 'indefinite' | 'off') {
  const until =
    mode === 'off'
      ? null
      : mode === 'today'
        ? endOfBusinessDay((await getRestaurant()).timezone)
        : new Date('2099-12-31T00:00:00Z');
  await menu.setSoldOutUntil(await staffDb(), itemId, until);
}

/** Points the dish at its newly uploaded photo and deletes the old file. */
export async function setItemPhoto(itemId: string, path: string) {
  const db = await staffDb();
  const old = await menu.findItemPhoto(db, itemId);
  await menu.updateItem(db, itemId, { photo_path: path });
  if (old && old !== path) await menu.removePhoto(db, old);
}

// Dishes, categories, order ----------------------------------------------------------------

export type ItemInput = Omit<Insert<'menu_items'>, 'id' | 'sort_order'> & {
  id?: string;
  groupIds: string[];
};

export function saveItem({ id, groupIds, ...row }: ItemInput) {
  return saving(async () => {
    const db = await staffDb();
    let itemId = id;
    if (itemId) await menu.updateItem(db, itemId, row);
    else itemId = await menu.insertItem(db, row);
    await menu.setItemGroups(db, itemId, groupIds);
  });
}

export type CategoryInput = Omit<Insert<'categories'>, 'id' | 'sort_order'> & { id?: string };

export function saveCategory({ id, ...row }: CategoryInput) {
  return saving(async () => {
    const db = await staffDb();
    if (id) await menu.updateCategory(db, id, row);
    else await menu.insertCategory(db, row);
  });
}

/** Moves a dish (within its category) or a category up or down one place. */
export async function move(
  kind: Sortable,
  id: string,
  direction: -1 | 1,
): Promise<Outcome<'from_sheet' | 'not_found'>> {
  if (await editedInSheet()) return fail('from_sheet');
  const db = await staffDb();
  const list = await menu.listSiblings(db, kind, id);
  if (!list) return fail('not_found');
  const index = list.findIndex((s) => s.id === id);
  if (index < 0 || !list[index + direction]) return { ok: true };
  // Swap and renumber, so equal sort orders can't get stuck.
  const reordered = list.map((s) => s.id);
  [reordered[index], reordered[index + direction]] = [
    reordered[index + direction]!,
    reordered[index]!,
  ];
  await menu.setPositions(db, kind, reordered);
  return { ok: true };
}

// Option groups ----------------------------------------------------------------------------

export type GroupInput = {
  id?: string;
  group: Insert<'modifier_groups'>;
  options: Omit<Insert<'modifier_options'>, 'group_id'>[];
};

export function saveGroup({ id, group, options }: GroupInput) {
  return saving(async () => {
    const db = await staffDb();
    const groupId = await menu.saveGroup(db, id, group);
    await menu.replaceOptions(db, groupId, options);
  });
}

export function deleteGroup(id: string) {
  return saving(async () => menu.deleteGroup(await staffDb(), id));
}
