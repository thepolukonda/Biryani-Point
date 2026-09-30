import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Hero } from '@/components/home/hero';
import {
  About,
  HowItWorks,
  Marquee,
  OrderCta,
  OwnerNote,
  Visit,
  WhatWeServe,
} from '@/components/home/sections';
import { SignatureDishes } from '@/components/home/signature-dishes';
import { getBrand, getMenu, getRestaurant } from '@/lib/data/restaurant';
import type { Locale } from '@/lib/domain/i18n-text';
import { describeOpenState } from '@/lib/domain/open-label';
import { siteUrl } from '@/lib/env';
import { jsonLdString, restaurantJsonLd } from '@/lib/seo/json-ld';
import { pageMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const brand = await getBrand(locale);
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
    getMenu(),
    getRestaurant(),
    getBrand(locale),
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
