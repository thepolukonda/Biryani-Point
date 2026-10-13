import { loadRestaurant } from '@/controllers/site/shop';
import { iconImage } from '@/shared/seo/og-image';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';
export const revalidate = 3600;

export default async function AppleIcon() {
  // iOS rounds the corners itself, so the icon fills the square (like a maskable icon).
  return iconImage((await loadRestaurant()).profile, size.width, { maskable: true });
}
