import type { MetadataRoute } from 'next';
import { LOCALES } from '@/lib/domain/i18n-text';
import { siteUrl } from '@/lib/env';

const PAGES: { path: string; priority: number; changeFrequency: 'daily' | 'monthly' | 'yearly' }[] =
  [
    { path: '', priority: 1, changeFrequency: 'daily' },
    { path: '/menu', priority: 0.9, changeFrequency: 'daily' },
    { path: '/privacy', priority: 0.2, changeFrequency: 'yearly' },
    { path: '/terms', priority: 0.2, changeFrequency: 'yearly' },
    { path: '/refunds', priority: 0.2, changeFrequency: 'yearly' },
  ];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap((page) =>
    LOCALES.map((locale) => ({
      url: `${siteUrl}/${locale}${page.path}`,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: {
        languages: {
          ...Object.fromEntries(LOCALES.map((l) => [l, `${siteUrl}/${l}${page.path}`])),
          'x-default': `${siteUrl}/en${page.path}`,
        },
      },
    })),
  );
}
