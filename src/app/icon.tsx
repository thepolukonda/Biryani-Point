import { getRestaurant } from '@/lib/data/restaurant';
import { iconImage } from '@/lib/seo/og-image';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';
export const revalidate = 3600;

/** The browser-tab icon: the round logo with the monogram. */
export default async function Icon() {
  return iconImage((await getRestaurant()).profile, size.width);
}
