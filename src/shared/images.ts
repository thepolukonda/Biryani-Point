import { publicEnv } from '@/config/env';

/** Public URL of a file in the menu-images bucket (always rendered through next/image). */
export function menuImageUrl(path: string): string {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/menu-images/${encoded}`;
}
