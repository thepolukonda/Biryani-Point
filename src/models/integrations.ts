/**
 * Model: integration settings (the Google Sheet links, owner-only by RLS) and the log of
 * Sheet imports.
 */
import { check, must, type Db, type Json, type Update } from './db/core';

const SETTINGS_ID = 1;

export async function loadSettings(db: Db) {
  const result = await db.from('integration_settings').select('*').eq('id', SETTINGS_ID).single();
  return must(result, 'integrations.loadSettings');
}

export async function updateSettings(db: Db, patch: Update<'integration_settings'>) {
  check(
    await db.from('integration_settings').update(patch).eq('id', SETTINGS_ID),
    'integrations.updateSettings',
  );
}

// Sheet import runs ------------------------------------------------------------------------

export type SyncTrigger = 'schedule' | 'manual' | 'cli';

export async function listRecentRuns(db: Db, limit = 5) {
  const result = await db
    .from('sheet_sync_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);
  return must(result, 'integrations.listRecentRuns');
}

export async function startRun(db: Db, trigger: SyncTrigger): Promise<string> {
  const result = await db.from('sheet_sync_runs').insert({ trigger }).select('id').single();
  return must(result, 'integrations.startRun').id;
}

export async function finishRun(
  db: Db,
  id: string,
  status: 'ok' | 'unchanged' | 'error',
  fields: { problems: Json; summary: Json; contentHash: string | null },
) {
  const result = await db
    .from('sheet_sync_runs')
    .update({
      status,
      finished_at: new Date().toISOString(),
      problems: fields.problems ?? [],
      summary: fields.summary ?? {},
      content_hash: fields.contentHash,
    })
    .eq('id', id);
  check(result, 'integrations.finishRun');
}

/** The content hash of the last successful import, other than run `exceptRunId`. */
export async function lastImportedHash(db: Db, exceptRunId: string): Promise<string | null> {
  const result = await db
    .from('sheet_sync_runs')
    .select('content_hash')
    .in('status', ['ok', 'unchanged'])
    .neq('id', exceptRunId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  check(result, 'integrations.lastImportedHash');
  return result.data?.content_hash ?? null;
}
