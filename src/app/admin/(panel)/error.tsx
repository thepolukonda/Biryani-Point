'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { reportError } from '@/shared/monitoring';

// A page in the admin panel failed. The menu stays usable; staff can retry or move on.
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(
    () => reportError(error, { digest: error.digest, where: 'admin error boundary' }),
    [error],
  );
  return (
    <div className="bg-surface shadow-card mx-auto grid max-w-lg justify-items-center gap-3 rounded-xl p-8 text-center">
      <h1 className="text-2xl font-extrabold">This page could not load</h1>
      <p className="text-muted">
        Check the internet connection and try again. If it keeps happening, reload the page.
      </p>
      {error.digest && <p className="text-muted text-xs">Error code: {error.digest}</p>}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="bg-ink min-h-12 rounded-xl px-5 font-bold text-white"
        >
          Try again
        </button>
        <Link
          href="/admin"
          className="bg-soft inline-flex min-h-12 items-center rounded-xl px-5 font-bold"
        >
          Back to orders
        </Link>
      </div>
    </div>
  );
}
