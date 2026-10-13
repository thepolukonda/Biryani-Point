'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { syncSheetNow } from '@/controllers/admin/menu.actions';
import { cn } from '@/shared/cn';
import { useAdminBrand } from '../admin-brand';
import type { SyncRun } from './types';

type Problem = { tab: string; row?: number; severity: string; message: string };

const when = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));

export function SyncPanel({
  runs,
  configured,
  isOwner,
}: {
  runs: SyncRun[];
  configured: boolean;
  isOwner: boolean;
}) {
  const { timezone } = useAdminBrand();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{
    ok?: boolean;
    message?: string;
    error?: string;
    problems?: Problem[];
  } | null>(null);
  const last = runs[0];
  const problems: Problem[] = result?.problems ?? (last?.problems as Problem[] | null) ?? [];

  return (
    <section className="bg-surface shadow-card rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">Google Sheet</h2>
          <p className="text-muted text-sm">
            {!configured ? (
              <>
                Not connected yet.{' '}
                {isOwner && (
                  <Link
                    href="/admin/settings#sheet"
                    className="text-gold-text font-semibold underline"
                  >
                    Add the links in Settings
                  </Link>
                )}
              </>
            ) : last ? (
              <>
                Last check {when(last.started_at, timezone)}:{' '}
                <b className={cn(last.status === 'error' ? 'text-danger' : 'text-ok')}>
                  {last.status === 'ok'
                    ? 'updated'
                    : last.status === 'unchanged'
                      ? 'no changes'
                      : last.status === 'error'
                        ? 'problem'
                        : 'running'}
                </b>
                . The site checks the sheet every few minutes.
              </>
            ) : (
              'Connected. The first import runs within a few minutes.'
            )}
          </p>
        </div>
        {isOwner && configured && (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => setResult(await syncSheetNow()))}
            className="bg-gold text-on-gold min-h-12 rounded-md px-5 font-bold disabled:opacity-60"
          >
            {pending ? 'Importing…' : 'Sync now'}
          </button>
        )}
      </div>
      {result?.message && (
        <p className="bg-ok-soft text-ok mt-3 rounded-md px-3 py-2 text-sm font-semibold">
          {result.message}
        </p>
      )}
      {result?.error && (
        <p className="bg-danger-soft text-danger mt-3 rounded-md px-3 py-2 text-sm font-semibold">
          {result.error}
        </p>
      )}
      {problems.length > 0 && (
        <details className="mt-3" open={problems.some((p) => p.severity === 'error')}>
          <summary className="cursor-pointer font-semibold">
            {problems.length} note{problems.length === 1 ? '' : 's'} from the last import
          </summary>
          <ul className="mt-2 grid gap-1.5 text-sm">
            {problems.map((p, i) => (
              <li
                key={i}
                className={cn(
                  'rounded-md px-3 py-2',
                  p.severity === 'error'
                    ? 'bg-danger-soft text-danger'
                    : 'bg-gold-soft text-gold-text',
                )}
              >
                <b className="capitalize">{p.tab}</b>
                {p.row ? ` row ${p.row}` : ''}: {p.message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
