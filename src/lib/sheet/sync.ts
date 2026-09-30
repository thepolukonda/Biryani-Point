/**
 * Google Sheet -> database import. Runs on a schedule, from "Sync now" in the
 * admin panel, and from `npm run sheet:sync`.
 */
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import {
  buildSnapshot,
  type KnownCategory,
  type SheetProblem,
  type SheetSources,
  type SheetTab,
} from './build';

/** Bump when parsing rules change, so an unchanged sheet is re-imported once. */
const PARSER_VERSION = '1';
const MAX_CSV_BYTES = 2 * 1024 * 1024;
const ALLOWED_HOSTS = [/^docs\.google\.com$/, /\.googleusercontent\.com$/];

export type SheetUrls = Partial<Record<SheetTab, string | null | undefined>>;

export type SyncResult = {
  status: 'ok' | 'unchanged' | 'error' | 'not_configured';
  problems: SheetProblem[];
  summary?: Record<string, unknown>;
};

export function isAllowedSheetUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_HOSTS.some((h) => h.test(url.hostname));
  } catch {
    return false;
  }
}

async function fetchCsv(tab: SheetTab, url: string): Promise<string> {
  if (!isAllowedSheetUrl(url)) {
    throw new SheetFetchError(
      tab,
      'The link must be a Google Sheets "Publish to web" CSV link (https://docs.google.com/...).',
    );
  }
  let response: Response;
  try {
    response = await fetch(url, {
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new SheetFetchError(
      tab,
      'Google Sheets did not answer in time. The website keeps the current menu.',
    );
  }
  if (!isAllowedSheetUrl(response.url))
    throw new SheetFetchError(tab, 'The link redirected somewhere unexpected.');
  if (!response.ok) {
    throw new SheetFetchError(
      tab,
      `Google Sheets answered ${response.status}. Check that the tab is still published to the web as CSV.`,
    );
  }
  const text = await response.text();
  if (text.length > MAX_CSV_BYTES)
    throw new SheetFetchError(tab, 'The tab is too large (over 2 MB).');
  if (/^\s*<(!doctype|html)/i.test(text)) {
    throw new SheetFetchError(
      tab,
      'The link gives a web page instead of CSV. When publishing, choose "Comma-separated values (.csv)".',
    );
  }
  return text;
}

class SheetFetchError extends Error {
  constructor(
    readonly tab: SheetTab,
    message: string,
  ) {
    super(message);
  }
}

export async function syncSheet(args: {
  db: SupabaseClient<Database>;
  urls: SheetUrls;
  trigger: 'schedule' | 'manual' | 'cli';
  /** Called after a successful import (e.g. revalidateTag in Next.js). */
  onChanged?: () => void | Promise<void>;
  /** Import even if the sheet looks unchanged. */
  force?: boolean;
}): Promise<SyncResult> {
  const { db, urls } = args;
  if (!urls.menu) return { status: 'not_configured', problems: [] };

  const run = await db
    .from('sheet_sync_runs')
    .insert({ trigger: args.trigger })
    .select('id')
    .single();
  if (run.error) throw new Error(`Could not start a sync run: ${run.error.message}`);
  const runId = run.data.id;

  const finish = async (
    status: 'ok' | 'unchanged' | 'error',
    fields: { problems?: SheetProblem[]; summary?: object; hash?: string },
  ) => {
    await db
      .from('sheet_sync_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        problems: (fields.problems ?? []) as unknown as NonNullable<Json>,
        summary: (fields.summary ?? {}) as NonNullable<Json>,
        content_hash: fields.hash ?? null,
      })
      .eq('id', runId);
  };

  try {
    const tabs = (Object.entries(urls) as [SheetTab, string | null | undefined][]).filter(
      (entry): entry is [SheetTab, string] => Boolean(entry[1]),
    );
    const texts = Object.fromEntries(
      await Promise.all(tabs.map(async ([tab, url]) => [tab, await fetchCsv(tab, url)] as const)),
    ) as Partial<Record<SheetTab, string>>;

    const hash = createHash('sha256')
      .update(PARSER_VERSION)
      .update(JSON.stringify(tabs.map(([tab]) => [tab, texts[tab]])))
      .digest('hex');

    if (!args.force) {
      const last = await db
        .from('sheet_sync_runs')
        .select('content_hash')
        .in('status', ['ok', 'unchanged'])
        .neq('id', runId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last.data?.content_hash === hash) {
        await finish('unchanged', { hash });
        return { status: 'unchanged', problems: [] };
      }
    }

    const known = await db.from('categories').select('slug, name');
    const knownCategories: KnownCategory[] = (known.data ?? []).map((c) => ({
      slug: c.slug,
      name: c.name as KnownCategory['name'],
    }));

    const sources: SheetSources = {
      menu: texts.menu!,
      categories: texts.categories ?? null,
      options: texts.options ?? null,
      hours: texts.hours ?? null,
      settings: texts.settings ?? null,
    };
    const built = buildSnapshot(sources, knownCategories);
    if (!built.ok) {
      await finish('error', { problems: built.problems, hash });
      return { status: 'error', problems: built.problems };
    }

    const applied = await db.rpc('apply_menu_snapshot', {
      p_snapshot: built.snapshot as unknown as Json,
    });
    if (applied.error) {
      const problems: SheetProblem[] = [
        ...built.problems,
        {
          tab: 'menu',
          severity: 'error',
          message: `The database refused the import: ${applied.error.message}. Nothing was changed.`,
        },
      ];
      await finish('error', { problems, hash });
      return { status: 'error', problems };
    }

    const summary = applied.data as Record<string, unknown>;
    await finish('ok', { problems: built.problems, summary, hash });
    await args.onChanged?.();
    return { status: 'ok', problems: built.problems, summary };
  } catch (error) {
    const problems: SheetProblem[] =
      error instanceof SheetFetchError
        ? [{ tab: error.tab, severity: 'error', message: error.message }]
        : [
            {
              tab: 'menu',
              severity: 'error',
              message: `Import failed: ${(error as Error).message}`,
            },
          ];
    await finish('error', { problems });
    return { status: 'error', problems };
  }
}
