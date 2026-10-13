/**
 * The owner's settings: restaurant details, ordering, hours, closures, delivery zones and
 * the Google Sheet links. Settings the Google Sheet controls are not changed from here.
 */
import 'server-only';
import { staffDb, type Insert, type Update } from '@/models/db';
import * as integrations from '@/models/integrations';
import * as menu from '@/models/menu';
import * as restaurant from '@/models/restaurant';
import type { SettingsUpdate } from '@/models/restaurant';
import { notificationsConfigured } from './notify';
import { fail, type Outcome } from './outcome';
import { loadPrintSettings } from './printing/ticket-data';

export async function editorData() {
  const db = await staffDb();
  const [settings, links, hours, closures, zones, dishes, print] = await Promise.all([
    restaurant.loadSettings(db),
    integrations.loadSettings(db),
    restaurant.listHours(db),
    restaurant.listClosures(db),
    restaurant.listZones(db),
    menu.listVisibleItemNames(db),
    loadPrintSettings(),
  ]);
  return {
    settings,
    integrations: links,
    hours,
    closures,
    zones,
    dishes,
    print,
    notifications: notificationsConfigured(),
  };
}

/**
 * Saves the fields the Sheet doesn't control. `skipped` says some were left alone;
 * `all_from_sheet` means every field was the Sheet's.
 */
export async function saveSettings(
  patch: SettingsUpdate,
): Promise<Outcome<'all_from_sheet', { skipped: boolean }>> {
  const db = await staffDb();
  const { menu_source, sheet_managed_fields } = await restaurant.loadMenuSource(db);
  const managed = menu_source === 'sheet' ? new Set(sheet_managed_fields) : new Set<string>();
  const allowed = Object.fromEntries(
    Object.entries(patch).filter(([key]) => !managed.has(key)),
  ) as SettingsUpdate;
  if (Object.keys(allowed).length === 0) return fail('all_from_sheet');
  await restaurant.updateSettings(db, allowed);
  return { ok: true, skipped: Object.keys(allowed).length < Object.keys(patch).length };
}

/** Replaces the week's opening hours, unless they come from the Sheet's Hours tab. */
export async function saveHours(
  ranges: { weekday: number; opens: string; closes: string }[],
): Promise<Outcome<'from_sheet'>> {
  const db = await staffDb();
  const [{ menu_source }, sheetHours] = await Promise.all([
    restaurant.loadMenuSource(db),
    restaurant.hasSheetHours(db),
  ]);
  if (menu_source === 'sheet' && sheetHours) return fail('from_sheet');
  await restaurant.replaceHours(
    db,
    ranges.map((r) => ({
      weekday: r.weekday,
      opens_at: r.opens,
      closes_at: r.closes,
      source: 'admin',
    })),
  );
  return { ok: true };
}

export async function addClosure(row: Omit<Insert<'closures'>, 'source'>) {
  await restaurant.insertClosure(await staffDb(), { ...row, source: 'admin' });
}

export async function deleteClosure(id: string) {
  await restaurant.deleteAdminClosure(await staffDb(), id);
}

export async function saveZone(id: string | null, row: Insert<'delivery_zones'>) {
  await restaurant.saveZone(await staffDb(), id, row);
}

export async function deleteZone(id: string) {
  await restaurant.deleteZone(await staffDb(), id);
}

/** Saves the Sheet links and where the menu is edited. Switching to admin frees all fields. */
export async function saveIntegrations(
  urls: Update<'integration_settings'>,
  source: 'sheet' | 'admin',
) {
  const db = await staffDb();
  await Promise.all([
    integrations.updateSettings(db, urls),
    restaurant.updateSettings(db, {
      menu_source: source,
      ...(source === 'admin' ? { sheet_managed_fields: [] } : {}),
    }),
  ]);
}
