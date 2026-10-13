import type { MetadataRoute } from 'next';
import { siteUrl } from '@/config/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Private or per-customer pages.
      disallow: ['/admin', '/api/', '/*/cart', '/*/checkout', '/*/order/'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
