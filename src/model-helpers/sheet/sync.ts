/**
 * Google Sheet -> database import. Runs on a schedule, from "Sync now" in the
 * admin panel, and from `npm run sheet:sync`.
 */
import { createHash } from 'node:crypto';
import { DbError, type Db, type Json } from '@/models/db/core';
import * as integrations from '@/models/integrations';
import type { SyncTrigger } from '@/models/integrations';
import * as menu from '@/models/menu';
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
  db: Db;
  urls: SheetUrls;
  trigger: SyncTrigger;
  /** Called after a successful import (e.g. revalidateTag in Next.js). */
  onChanged?: () => void | Promise<void>;
  /** Import even if the sheet looks unchanged. */
  force?: boolean;
}): Promise<SyncResult> {
  const { db, urls } = args;
  if (!urls.menu) return { status: 'not_configured', problems: [] };

  const runId = await integrations.startRun(db, args.trigger);

  const finish = async (
    status: 'ok' | 'unchanged' | 'error',
    fields: { problems?: SheetProblem[]; summary?: object; hash?: string },
  ) => {
    await integrations.finishRun(db, runId, status, {
      problems: (fields.problems ?? []) as unknown as Json,
      summary: (fields.summary ?? {}) as Json,
      contentHash: fields.hash ?? null,
    });
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
      if ((await integrations.lastImportedHash(db, runId)) === hash) {
        await finish('unchanged', { hash });
        return { status: 'unchanged', problems: [] };
      }
    }

    const known = await menu.listCategoryNames(db);
    const knownCategories: KnownCategory[] = known.map((c) => ({
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

    let summary: Record<string, unknown>;
    try {
      summary = await menu.applySnapshot(db, built.snapshot as unknown as Json);
    } catch (applyError) {
      const problems: SheetProblem[] = [
        ...built.problems,
        {
          tab: 'menu',
          severity: 'error',
          message: `The database refused the import: ${applyError instanceof DbError ? applyError.detail : (applyError as Error).message}. Nothing was changed.`,
        },
      ];
      await finish('error', { problems, hash });
      return { status: 'error', problems };
    }

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
