/**
 * Controller for the scheduled job: Google Sheet import and housekeeping. Called every few
 * minutes by the Netlify scheduled function (netlify/functions/sheet-sync.mts) or a
 * Cloudflare cron trigger. Protected by CRON_SECRET: `Authorization: Bearer <CRON_SECRET>`.
 */
import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { serverEnv } from '@/config/env.server';
import { reportError } from '@/shared/monitoring';
import { scheduledRun } from '@/model-helpers/sheet/import';

function authorised(request: Request) {
  const expected = Buffer.from(`Bearer ${serverEnv().CRON_SECRET}`);
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function runScheduledJob(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  try {
    const result = await scheduledRun(() => {
      revalidateTag('menu', { expire: 0 });
      revalidateTag('restaurant', { expire: 0 });
    });
    if (result.status === 'skipped')
      return NextResponse.json({ status: 'skipped', reason: 'menu edited in admin' });
    return NextResponse.json({ status: result.status, problems: result.problems.length });
  } catch (e) {
    reportError(e, { where: 'cron sheet-sync' });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
