/**
 * Public environment variables. Safe to import anywhere, including client components, so
 * this file is deliberately dependency-free (no Zod: it would ship to every page).
 * Server-only values live in `env.server.ts`.
 */

function optional(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

function url(name: string, value: string | undefined, fallback?: string): string {
  const v = optional(value) ?? fallback;
  if (!v) throw new Error(`Missing environment variable ${name}`);
  try {
    new URL(v);
  } catch {
    throw new Error(`Environment variable ${name} must be a URL, got "${v}"`);
  }
  return v;
}

function required(name: string, value: string | undefined, minLength: number): string {
  const v = optional(value);
  if (!v || v.length < minLength)
    throw new Error(`Missing or invalid environment variable ${name}`);
  return v;
}

// Next.js only inlines NEXT_PUBLIC_* when they are written out literally.
export const publicEnv = {
  NEXT_PUBLIC_SITE_URL: url(
    'NEXT_PUBLIC_SITE_URL',
    process.env.NEXT_PUBLIC_SITE_URL,
    'http://localhost:3000',
  ),
  NEXT_PUBLIC_SUPABASE_URL: url('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: required(
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    20,
  ),
  NEXT_PUBLIC_SENTRY_DSN: optional(process.env.NEXT_PUBLIC_SENTRY_DSN),
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: optional(process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN),
  NEXT_PUBLIC_UMAMI_WEBSITE_ID: optional(process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID),
  NEXT_PUBLIC_UMAMI_SCRIPT_URL: optional(process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL),
} as const;

export const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
