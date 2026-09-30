/**
 * Security headers. Netlify serves the copies in netlify.toml (kept identical by
 * a unit test); other hosts (Cloudflare, `next start`) get them from next.config.ts.
 */

/** Hosts the browser may contact. Supabase projects live on *.supabase.co. */
export function contentSecurityPolicy(extraSupabaseOrigin?: string): string {
  const supabase = ['https://*.supabase.co', 'wss://*.supabase.co'];
  if (extraSupabaseOrigin) {
    supabase.push(extraSupabaseOrigin, extraSupabaseOrigin.replace(/^http/, 'ws'));
  }
  const analytics = [
    'https://plausible.io',
    'https://cloud.umami.is',
    'https://api-gateway.umami.dev',
  ];
  const sentry = [
    'https://*.ingest.sentry.io',
    'https://*.ingest.us.sentry.io',
    'https://*.ingest.de.sentry.io',
  ];

  return [
    "default-src 'self'",
    // Next.js inlines small scripts; a nonce would force every page to be dynamic.
    `script-src 'self' 'unsafe-inline' ${analytics.slice(0, 2).join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase.filter((s) => s.startsWith('http')).join(' ')}`,
    "font-src 'self'",
    `connect-src 'self' ${[...supabase, ...analytics, ...sentry].join(' ')}`,
    // 'self': the kitchen board prints tickets through a hidden same-site frame.
    "frame-src 'self' https://www.openstreetmap.org",
    "worker-src 'self'",
    "manifest-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export function securityHeaders(extraSupabaseOrigin?: string): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(extraSupabaseOrigin) },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()',
    },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ];
}
