'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { reportError } from '@/lib/monitoring';
import { clientIp, hashIp, sha256 } from '@/lib/request';
import { serviceClient } from '@/lib/supabase/clients';
import { sessionClient } from '@/lib/supabase/session';

const credentials = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
});

export type SignInState = { error?: string };

const FAILURE_WINDOW_SECONDS = 900;
const MAX_FAILURES = 10;

/** The rate-limit window rate_limit_hit() is counting in right now. */
function currentWindow() {
  const w = FAILURE_WINDOW_SECONDS * 1000;
  return new Date(Math.floor(Date.now() / w) * w).toISOString();
}

async function tooManyFailures(keys: string[]): Promise<boolean> {
  const { data, error } = await serviceClient()
    .from('rate_limits')
    .select('hits')
    .in('key', keys)
    .eq('window_start', currentWindow());
  if (error) reportError(error, { where: 'signIn rate limit' });
  return (data ?? []).some((r) => r.hits >= MAX_FAILURES);
}

async function recordFailure(keys: string[]) {
  const results = await Promise.all(
    keys.map((key) =>
      serviceClient().rpc('rate_limit_hit', {
        p_key: key,
        p_window_seconds: FAILURE_WINDOW_SECONDS,
        p_max: MAX_FAILURES,
      }),
    ),
  );
  const error = results.find((r) => r.error)?.error;
  if (error) reportError(error, { where: 'signIn rate limit' });
}

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const parsed = credentials.safeParse({
    email: form.get('email'),
    password: form.get('password'),
  });
  if (!parsed.success) return { error: 'Enter your email and password.' };

  // Supabase sees our server's address, not the visitor's, so limit wrong passwords here:
  // per device and per account. Only failures count, so staff sharing one Wi-Fi are fine.
  const keys = [
    `login:ip:${hashIp(clientIp(await headers()))}`,
    `login:email:${sha256(parsed.data.email.toLowerCase()).slice(0, 32)}`,
  ];
  if (await tooManyFailures(keys))
    return { error: 'Too many wrong attempts. Wait 15 minutes and try again.' };

  const db = await sessionClient();
  const { data, error } = await db.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    await recordFailure(keys);
    return { error: 'Wrong email or password.' };
  }

  const staff = await db.from('staff').select('user_id').eq('user_id', data.user.id).maybeSingle();
  if (!staff.data) {
    await db.auth.signOut();
    return { error: 'This account is not set up as staff. Ask the owner to add you.' };
  }
  redirect('/admin');
}

export async function signOut() {
  const db = await sessionClient();
  await db.auth.signOut();
  redirect('/admin/login');
}

const passwordSchema = z.object({ password: z.string().min(10).max(200) });

export async function changeOwnPassword(
  _prev: { message?: string; error?: string },
  form: FormData,
) {
  const parsed = passwordSchema.safeParse({ password: form.get('password') });
  if (!parsed.success) return { error: 'Use at least 10 characters.' };
  const db = await sessionClient();
  const { error } = await db.auth.updateUser({ password: parsed.data.password });
  return error ? { error: error.message } : { message: 'Password changed.' };
}
