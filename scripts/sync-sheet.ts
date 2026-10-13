/**
 * npm run sheet:sync [-- --force]
 * Imports the Google Sheet into the database configured in .env.local, using the
 * links from Admin -> Settings, or the SHEET_*_CSV_URL variables.
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/models/db/database.types';
import { syncSheet, type SheetUrls } from '../src/model-helpers/sheet/sync';

process.loadEnvFile?.('.env.local');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local');
  const db = createClient<Database>(url, key, { auth: { persistSession: false } });

  const saved = await db.from('integration_settings').select('*').eq('id', 1).single();
  const s = saved.data;
  const urls: SheetUrls = {
    menu: s?.sheet_menu_csv_url || process.env.SHEET_MENU_CSV_URL,
    categories: s?.sheet_categories_csv_url || process.env.SHEET_CATEGORIES_CSV_URL,
    options: s?.sheet_options_csv_url || process.env.SHEET_OPTIONS_CSV_URL,
    hours: s?.sheet_hours_csv_url || process.env.SHEET_HOURS_CSV_URL,
    settings: s?.sheet_settings_csv_url || process.env.SHEET_SETTINGS_CSV_URL,
  };

  const result = await syncSheet({
    db,
    urls,
    trigger: 'cli',
    force: process.argv.includes('--force'),
  });
  console.log(`Sheet import: ${result.status}`);
  for (const p of result.problems)
    console.log(`  [${p.severity}] ${p.tab}${p.row ? ` row ${p.row}` : ''}: ${p.message}`);
  if (result.summary) console.log('  ', result.summary);
  if (result.status === 'not_configured')
    console.log('  No Menu tab link is set. See README "Google Sheet menu".');
  if (result.status === 'error') process.exit(1);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
