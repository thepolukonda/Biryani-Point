/**
 * Supabase clients.
 *
 *  publicClient()   anon key, no cookies. For public reads (menu, hours) in server code; cacheable.
 *  serviceClient()  secret key, bypasses RLS. Server only: order creation, Sheet import.
 *
 * Signed-in staff use the cookie-based clients in ./session.ts (admin only).
 */
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv } from '@/config/env';
import { serverEnv } from '@/config/env.server';
import type { Database } from './database.types';

const noSession = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

export function publicClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    noSession,
  );
}

export function serviceClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SECRET_KEY,
    noSession,
  );
}
