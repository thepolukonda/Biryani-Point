/** Per-page metadata with canonical URL and hreflang alternates for all three languages. */
import type { Metadata } from 'next';
import { LOCALES, type Locale } from '@/shared/domain/i18n-text';
import { siteUrl } from '@/config/env';

const OG_LOCALE: Record<Locale, string> = { en: 'en_US', ka: 'ka_GE', ru: 'ru_RU' };

export function pageMetadata(args: {
  locale: Locale;
  /** Path after the locale, starting with "/" ("/" for home). */
  path: string;
  title?: string;
  description?: string;
  siteName: string;
  noindex?: boolean;
}): Metadata {
  const suffix = args.path === '/' ? '' : args.path;
  const url = `${siteUrl}/${args.locale}${suffix}`;
  // Setting openGraph here replaces the inherited share image, so name it again.
  const image = (kind: 'opengraph' | 'twitter') => ({
    url: `${siteUrl}/${args.locale}/${kind}-image/card`,
    width: 1200,
    height: 630,
  });
  return {
    ...(args.title ? { title: args.title } : {}),
    ...(args.description ? { description: args.description } : {}),
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LOCALES.map((l) => [l, `${siteUrl}/${l}${suffix}`])),
        'x-default': `${siteUrl}/en${suffix}`,
      },
    },
    openGraph: {
      type: 'website',
      url,
      siteName: args.siteName,
      locale: OG_LOCALE[args.locale],
      alternateLocale: LOCALES.filter((l) => l !== args.locale).map((l) => OG_LOCALE[l]),
      ...(args.title ? { title: args.title } : {}),
      ...(args.description ? { description: args.description } : {}),
      images: [image('opengraph')],
    },
    twitter: { card: 'summary_large_image', images: [image('twitter')] },
    ...(args.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
