/**
 * Netlify Scheduled Function: imports the Google Sheet every 5 minutes by calling
 * the site's own /api/cron/sheet-sync endpoint (free on all Netlify plans).
 */
import type { Config } from '@netlify/functions';

export default async function sheetSync() {
  const site = process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) {
    console.log('sheet-sync: URL or CRON_SECRET missing, skipped');
    return;
  }
  const response = await fetch(`${site}/api/cron/sheet-sync`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}` },
  });
  console.log('sheet-sync:', response.status, await response.text());
}

export const config: Config = {
  schedule: '*/5 * * * *',
};
