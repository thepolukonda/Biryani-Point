'use client';

import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/config/env';
import type { Database } from './database.types';

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** One Supabase client per browser tab (publishable key; RLS protects the data). */
export function browserClient() {
  client ??= createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  return client;
}
