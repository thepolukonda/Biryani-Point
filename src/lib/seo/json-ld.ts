/** schema.org Restaurant + Menu, so search engines can show hours, address and dishes. */
import { pickText, type Locale } from '@/lib/domain/i18n-text';
import type { Menu } from '@/lib/domain/menu';
import { formatAmount } from '@/lib/domain/money';
import { profileText, type RestaurantInfo } from '@/lib/domain/restaurant';
import { menuImageUrl } from '@/lib/images';

const DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function restaurantJsonLd(args: {
  restaurant: RestaurantInfo;
  menu: Menu;
  locale: Locale;
  siteUrl: string;
  description: string;
}) {
  const { restaurant, menu, locale, siteUrl } = args;
  const { profile } = restaurant;
  const brand = profileText(profile, locale);
  const prices = menu.items.map((i) => i.priceTetri);
  const hero = menu.items.find((i) => i.photoPath);

  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': `${siteUrl}/#restaurant`,
    name: brand.siteName,
    description: args.description,
    url: `${siteUrl}/${locale}`,
    telephone: restaurant.phone,
    ...(hero?.photoPath ? { image: menuImageUrl(hero.photoPath) } : {}),
    ...(profile.cuisines.length ? { servesCuisine: profile.cuisines } : {}),
    ...(profile.email ? { email: profile.email } : {}),
    priceRange: prices.length
      ? `GEL ${formatAmount(Math.min(...prices))}–${formatAmount(Math.max(...prices))}`
      : undefined,
    acceptsReservations: false,
    currenciesAccepted: 'GEL',
    paymentAccepted: 'Cash',
    availableLanguage: ['English', 'Georgian', 'Russian'],
    address: {
      '@type': 'PostalAddress',
      // English: search engines match addresses best in the Latin alphabet.
      streetAddress: profileText(profile, 'en').street,
      addressLocality: profileText(profile, 'en').city,
      ...(profile.postalCode ? { postalCode: profile.postalCode } : {}),
      addressCountry: profile.countryCode,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: restaurant.location.lat,
      longitude: restaurant.location.lng,
    },
    openingHoursSpecification: restaurant.schedule.hours.map((h) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${DAY[h.weekday - 1]}`,
      opens: h.opens,
      closes: h.closes,
    })),
    hasMenu: {
      '@type': 'Menu',
      url: `${siteUrl}/${locale}/menu`,
      inLanguage: locale,
      hasMenuSection: menu.categories.map((c) => ({
        '@type': 'MenuSection',
        name: pickText(c.name, locale),
        hasMenuItem: menu.items
          .filter((i) => i.categorySlug === c.slug)
          .map((i) => ({
            '@type': 'MenuItem',
            name: pickText(i.name, locale),
            ...(i.description ? { description: pickText(i.description, locale) } : {}),
            ...(i.photoPath ? { image: menuImageUrl(i.photoPath) } : {}),
            ...(i.isVeg ? { suitableForDiet: 'https://schema.org/VegetarianDiet' } : {}),
            offers: {
              '@type': 'Offer',
              price: formatAmount(i.priceTetri),
              priceCurrency: 'GEL',
              availability: i.isAvailable
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            },
          })),
      })),
    },
  };
}

/** Safe for a <script> tag: no "</script>" breakout. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
