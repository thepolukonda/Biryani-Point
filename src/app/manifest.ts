import type { MetadataRoute } from 'next';
import { getRestaurant } from '@/lib/data/restaurant';
import { profileText } from '@/lib/domain/restaurant';

export const revalidate = 3600;

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { profile } = await getRestaurant();
  const en = profileText(profile, 'en');
  return {
    name: en.siteName,
    short_name: profile.brandName,
    description: en.seoDescription || en.tagline,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbf8f3',
    theme_color: '#0a0a0a',
    categories: ['food', 'shopping'],
    icons: [
      { src: '/icons/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Menu', url: '/en/menu' },
      { name: 'მენიუ', url: '/ka/menu' },
      { name: 'Меню', url: '/ru/menu' },
    ],
  };
}
