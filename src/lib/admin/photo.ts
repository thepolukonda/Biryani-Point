'use client';

import { browserClient } from '@/lib/supabase/browser';

const MAX_SIZE = 1600;

/**
 * Resize a photo in the browser and convert it to WebP before uploading, so a
 * 6 MB phone picture becomes ~150 KB. next/image then serves AVIF/WebP per screen.
 */
export async function toWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.82),
  );
  if (!blob) throw new Error('This browser could not convert the photo.');
  return blob;
}

/** Upload to the menu-images bucket (only the owner may, by storage policy). Returns the stored path. */
export async function uploadDishPhoto(slug: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo.');
  const webp = await toWebp(file);
  // A new file name every time, so browsers and the image cache never show the old photo.
  const path = `items/${slug}-${Date.now().toString(36)}.webp`;
  const { error } = await browserClient()
    .storage.from('menu-images')
    .upload(path, webp, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  if (error) throw new Error(error.message);
  return path;
}
