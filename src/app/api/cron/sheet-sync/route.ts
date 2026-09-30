/**
 * Scheduled Google Sheet import and housekeeping (old IP hashes, rate-limit rows). Called every few minutes by the Netlify scheduled
 * function (netlify/functions/sheet-sync.mts) or a Cloudflare cron trigger.
 * Protected by CRON_SECRET: `Authorization: Bearer <CRON_SECRET>`.
 */
import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env.server';
import { reportError } from '@/lib/monitoring';
import { syncSheet } from '@/lib/sheet/sync';
import { serviceClient } from '@/lib/supabase/clients';

export const dynamic = 'force-dynamic';

function authorised(request: Request) {
  const expected = Buffer.from(`Bearer ${serverEnv().CRON_SECRET}`);
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function run(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  const env = serverEnv();
  const db = serviceClient();
  // Housekeeping on every run (this also keeps a free Supabase project from pausing).
  const purge = await db.rpc('purge_expired_data');
  if (purge.error) reportError(purge.error, { where: 'purge_expired_data' });
  const [{ data: s }, { data: settings }] = await Promise.all([
    db.from('integration_settings').select('*').eq('id', 1).single(),
    db.from('restaurant_settings').select('menu_source').eq('id', 1).single(),
  ]);
  if (settings?.menu_source === 'admin')
    return NextResponse.json({ status: 'skipped', reason: 'menu edited in admin' });

  try {
    const result = await syncSheet({
      db,
      trigger: 'schedule',
      urls: {
        menu: s?.sheet_menu_csv_url || env.SHEET_MENU_CSV_URL,
        categories: s?.sheet_categories_csv_url || env.SHEET_CATEGORIES_CSV_URL,
        options: s?.sheet_options_csv_url || env.SHEET_OPTIONS_CSV_URL,
        hours: s?.sheet_hours_csv_url || env.SHEET_HOURS_CSV_URL,
        settings: s?.sheet_settings_csv_url || env.SHEET_SETTINGS_CSV_URL,
      },
      onChanged: () => {
        revalidateTag('menu', { expire: 0 });
        revalidateTag('restaurant', { expire: 0 });
      },
    });
    return NextResponse.json({ status: result.status, problems: result.problems.length });
  } catch (e) {
    reportError(e, { where: 'cron sheet-sync' });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
