/**
 * Error reporting hook. Logs everywhere; also sends to Sentry when
 * NEXT_PUBLIC_SENTRY_DSN is set (no SDK needed: uses Sentry's envelope endpoint).
 */
type Context = Record<string, unknown>;

function parseDsn(dsn: string) {
  const match = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(dsn.trim());
  if (!match) return null;
  const [, key, host, project] = match;
  return { key: key!, url: `https://${host}/api/${project}/envelope/` };
}

export function reportError(error: unknown, context: Context = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error('[error]', err.message, context, err.stack);

  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  const target = dsn ? parseDsn(dsn) : null;
  if (!target) return;

  const eventId = crypto.randomUUID().replace(/-/g, '');
  const event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    environment: process.env.NODE_ENV,
    exception: { values: [{ type: err.name, value: err.message, stacktrace: { frames: [] } }] },
    extra: { ...context, stack: err.stack },
    tags: { runtime: typeof window === 'undefined' ? 'server' : 'browser' },
  };
  const body = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');

  fetch(`${target.url}?sentry_key=${target.key}&sentry_version=7`, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-sentry-envelope' },
    keepalive: true,
  }).catch(() => {
    // Reporting must never throw.
  });
}
