import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Hero } from '@/views/home/hero';
import {
  About,
  HowItWorks,
  Marquee,
  OrderCta,
  OwnerNote,
  Visit,
  WhatWeServe,
} from '@/views/home/sections';
import { SignatureDishes } from '@/views/home/signature-dishes';
import { loadBrand, loadMenu, loadRestaurant } from '@/controllers/site/shop';
import type { Locale } from '@/shared/domain/i18n-text';
import { describeOpenState } from '@/shared/domain/open-label';
import { siteUrl } from '@/config/env';
import { jsonLdString, restaurantJsonLd } from '@/shared/seo/json-ld';
import { pageMetadata } from '@/shared/seo/metadata';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const brand = await loadBrand(locale);
  return pageMetadata({
    locale,
    path: '/',
    title: brand.seoTitle,
    description: brand.seoDescription,
    siteName: brand.siteName,
  });
}

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const [menu, restaurant, brand] = await Promise.all([
    loadMenu(),
    loadRestaurant(),
    loadBrand(locale),
  ]);

  const signature = restaurant.signatureItemSlugs
    .map((slug) => menu.items.find((i) => i.slug === slug))
    .filter((i) => i !== undefined);
  const featured = signature.length > 0 ? signature : menu.items.filter((i) => i.isPopular);
  const prices = menu.items.map((i) => i.priceTetri);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            restaurantJsonLd({
              restaurant,
              menu,
              locale,
              siteUrl,
              description: brand.seoDescription,
            }),
          ),
        }}
      />
      <Hero
        restaurant={restaurant}
        initialOpen={describeOpenState(new Date(), restaurant.schedule)}
        heroItem={featured[0] ?? menu.items[0]}
        dishCount={menu.items.length}
        fromTetri={prices.length ? Math.min(...prices) : 0}
      />
      <Marquee words={brand.highlights} />
      <About brand={brand} />
      <WhatWeServe menu={menu} monogram={restaurant.profile.monogram} />
      <SignatureDishes slugs={featured.map((i) => i.slug)} />
      <OwnerNote restaurant={restaurant} />
      <HowItWorks />
      <Visit restaurant={restaurant} />
      <OrderCta />
    </>
  );
}
