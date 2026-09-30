/**
 * npm run seed:images
 * Uploads the prototype dish photos (supabase/seed/images) to the menu-images bucket
 * as items/<slug>.webp. Safe to run again; existing files are replaced.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { SEED_IMAGE_DIR } from './sheet-template-data';

process.loadEnvFile?.('.env.local');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local');
  const db = createClient(url, key, { auth: { persistSession: false } });

  const files = fs.readdirSync(SEED_IMAGE_DIR).filter((f) => f.endsWith('.webp'));
  for (const file of files) {
    const { error } = await db.storage
      .from('menu-images')
      .upload(`items/${file}`, fs.readFileSync(path.join(SEED_IMAGE_DIR, file)), {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: true,
      });
    if (error) throw new Error(`${file}: ${error.message}`);
    console.log(`uploaded items/${file}`);
  }
  console.log(`${files.length} photos uploaded.`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
