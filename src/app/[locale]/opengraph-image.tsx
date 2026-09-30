import { getRestaurant } from '@/lib/data/restaurant';
import { isLocale } from '@/lib/domain/i18n-text';
import { brandCard, brandCardAlt, OG_SIZE } from '@/lib/seo/og-image';

export const revalidate = 3600;

// One image; its alt text comes from the business profile, in the page's language.
export async function generateImageMetadata({ params }: { params: { locale: string } }) {
  const { profile } = await getRestaurant();
  const locale = isLocale(params.locale) ? params.locale : 'en';
  return [
    { id: 'card', alt: brandCardAlt(profile, locale), size: OG_SIZE, contentType: 'image/png' },
  ];
}

export default async function OpenGraphImage() {
  return brandCard((await getRestaurant()).profile);
}
