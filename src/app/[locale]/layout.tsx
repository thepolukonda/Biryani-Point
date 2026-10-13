import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { fontVariables } from '@/app/fonts';
import { Announcer, BottomCartBar } from '@/views/layout/header-parts';
import { SiteFooter } from '@/views/layout/site-footer';
import { SiteHeader } from '@/views/layout/site-header';
import { Analytics } from '@/views/providers/analytics';
import { LazyOverlays } from '@/views/providers/lazy-overlays';
import { ServiceWorker } from '@/views/providers/service-worker';
import { ShopProvider } from '@/views/providers/shop-provider';
import { routing } from '@/config/i18n/routing';
import { loadBrand, loadMenu, loadRestaurant } from '@/controllers/site/shop';
import { menuForLocale } from '@/shared/domain/client-menu';
import type { Locale } from '@/shared/domain/i18n-text';
import { siteUrl } from '@/config/env';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const brand = await loadBrand(locale as Locale);
  return {
    metadataBase: new URL(siteUrl),
    title: { default: brand.seoTitle, template: `%s | ${brand.siteName}` },
    description: brand.seoDescription,
    applicationName: brand.siteName,
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [menu, restaurant, messages] = await Promise.all([
    loadMenu(),
    loadRestaurant(),
    getMessages(),
  ]);

  return (
    <html lang={locale} className={fontVariables}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider messages={clientMessages(messages)}>
          <ShopProvider menu={menuForLocale(menu, locale as Locale)} restaurant={restaurant}>
            <SiteHeader profile={restaurant.profile} />
            <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
              {children}
            </main>
            <SiteFooter restaurant={restaurant} />
            <LazyOverlays />
            <BottomCartBar />
            <Announcer />
          </ShopProvider>
          <ServiceWorker />
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}

/** Only the phrase groups that browser (client) components use; server pages read the rest directly. */
const CLIENT_NAMESPACES = [
  'common',
  'nav',
  'status',
  'days',
  'onDays',
  'menu',
  'cart',
  'checkout',
  'track',
  'errors',
] as const;
const CLIENT_KEYS = {
  home: ['sigKicker', 'sigTitle', 'signatureAuto', 'signaturePlay', 'addToOrder', 'inOrder'],
  visit: ['call'],
} as const;

function clientMessages(messages: Awaited<ReturnType<typeof getMessages>>) {
  const all = messages as Record<string, Record<string, unknown>>;
  const out: Record<string, unknown> = {};
  for (const ns of CLIENT_NAMESPACES) out[ns] = all[ns];
  for (const [ns, keys] of Object.entries(CLIENT_KEYS)) {
    out[ns] = Object.fromEntries(keys.map((k) => [k, all[ns]?.[k]]));
  }
  return out as typeof messages;
}
