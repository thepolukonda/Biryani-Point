'use client';

import { useEffect } from 'react';
import { reportError } from '@/shared/monitoring';

// Last-resort page if a root layout itself fails. Plain styles: global CSS is not loaded here.
// No restaurant name or phone: they come from the database, which may be what failed.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(
    () => reportError(error, { digest: error.digest, where: 'global error boundary' }),
    [error],
  );
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, sans-serif',
          background: '#fbf8f3',
          color: '#17130f',
        }}
      >
        <title>Something went wrong</title>
        <main style={{ maxWidth: 560, margin: '15vh auto', padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 28 }}>Something went wrong</h1>
          <p>ბოდიში, რაღაც შეფერხდა · Что-то пошло не так</p>
          <p>Please try again in a minute.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 48,
              padding: '0 24px',
              borderRadius: 12,
              border: 0,
              background: '#e9a72d',
              color: '#1a1208',
              fontWeight: 700,
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
