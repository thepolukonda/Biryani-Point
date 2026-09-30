import path from 'node:path';
import type { NextConfig } from 'next';
import { securityHeaders } from './security-headers';

// Canonical links, the sitemap and share images need the public address. On Netlify fall
// back to the site's main URL, so a forgotten variable never ships "localhost" links.
if (!process.env.NEXT_PUBLIC_SITE_URL?.trim() && process.env.NETLIFY === 'true') {
  if (!process.env.URL) throw new Error('Set NEXT_PUBLIC_SITE_URL in Netlify.');
  process.env.NEXT_PUBLIC_SITE_URL = process.env.URL;
}

const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321');
const supabaseIsLocal = ['127.0.0.1', 'localhost'].includes(supabaseUrl.hostname);

// next-intl reads its request config through the `next-intl/config` alias. Its Next.js
// plugin only sets this alias for our setup, but it also eagerly loads @swc/core (for an
// optional message-extraction feature we don't use), and that native module refuses to
// start on some Windows profiles. Setting the alias directly avoids loading it at all.
const I18N_REQUEST_CONFIG = './src/i18n/request.ts';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    resolveAlias: { 'next-intl/config': I18N_REQUEST_CONFIG },
  },
  webpack(config: { resolve: { alias: Record<string, string> } }) {
    config.resolve.alias['next-intl/config'] = path.resolve(I18N_REQUEST_CONFIG);
    return config;
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: supabaseUrl.protocol.replace(':', '') as 'http' | 'https',
        hostname: supabaseUrl.hostname,
        port: supabaseUrl.port,
        pathname: '/storage/v1/object/public/menu-images/**',
      },
    ],
    // Dish photos rarely change; a new upload gets a new file name.
    minimumCacheTTL: 60 * 60 * 24 * 30,
    // Local Supabase runs on 127.0.0.1, which Next.js blocks by default (SSRF protection).
    dangerouslyAllowLocalIP: supabaseIsLocal,
  },
  // Netlify applies the same headers from netlify.toml. Elsewhere (Cloudflare, `next start`)
  // they come from here. Not in `next dev`, where the CSP would block hot reloading.
  async headers() {
    if (process.env.NETLIFY === 'true' || process.env.NODE_ENV !== 'production') return [];
    const extra = supabaseUrl.hostname.endsWith('.supabase.co') ? undefined : supabaseUrl.origin;
    return [
      { source: '/:path*', headers: securityHeaders(extra) },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};

export default nextConfig;
