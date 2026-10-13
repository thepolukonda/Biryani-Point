/**
 * Running the Google Sheet import from the app: the links come from Settings (or, when a
 * link is empty there, from the SHEET_*_CSV_URL environment variables).
 */
import 'server-only';
import { serverEnv } from '@/config/env.server';
import { reportError } from '@/shared/monitoring';
import { serviceDb, type Db } from '@/models/db';
import * as integrations from '@/models/integrations';
import * as rateLimits from '@/models/rate-limits';
import * as restaurant from '@/models/restaurant';
import { syncSheet, type SheetUrls, type SyncResult } from './sync';

async function sheetUrls(db: Db): Promise<SheetUrls> {
  const env = serverEnv();
  const s = await integrations.loadSettings(db);
  return {
    menu: s.sheet_menu_csv_url || env.SHEET_MENU_CSV_URL,
    categories: s.sheet_categories_csv_url || env.SHEET_CATEGORIES_CSV_URL,
    options: s.sheet_options_csv_url || env.SHEET_OPTIONS_CSV_URL,
    hours: s.sheet_hours_csv_url || env.SHEET_HOURS_CSV_URL,
    settings: s.sheet_settings_csv_url || env.SHEET_SETTINGS_CSV_URL,
  };
}

/** "Sync now" from the admin panel: imports even when the sheet looks unchanged. */
export async function importNow(onChanged: () => void): Promise<SyncResult> {
  const db = serviceDb();
  return syncSheet({ db, trigger: 'manual', force: true, urls: await sheetUrls(db), onChanged });
}

/**
 * The scheduled run: housekeeping first (it also keeps a free Supabase project from
 * pausing), then the import, unless the menu is edited in the admin panel.
 */
export async function scheduledRun(
  onChanged: () => void,
): Promise<SyncResult | { status: 'skipped' }> {
  const db = serviceDb();
  try {
    await rateLimits.purgeExpired(db);
  } catch (e) {
    reportError(e, { where: 'purge_expired_data' });
  }
  const { menu_source } = await restaurant.loadMenuSource(db);
  if (menu_source === 'admin') return { status: 'skipped' };
  return syncSheet({ db, trigger: 'schedule', urls: await sheetUrls(db), onChanged });
}
