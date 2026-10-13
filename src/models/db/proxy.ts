/** A Supabase client for the proxy: reads and refreshes the staff session cookie on a request. */
import { createServerClient } from '@supabase/ssr';
import type { Database } from './database.types';

export type CookieJar = {
  getAll: () => { name: string; value: string }[];
  setAll: (list: { name: string; value: string; options: object }[]) => void;
};

export function proxyDb(cookies: CookieJar) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies },
  );
}
