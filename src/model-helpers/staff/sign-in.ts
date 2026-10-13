/**
 * Signing in to the admin panel, with a limit on wrong passwords.
 *
 * Supabase sees our server's address, not the visitor's, so wrong passwords are limited
 * here: per device and per account. Only failures count, so staff sharing one Wi-Fi are fine.
 */
import 'server-only';
import { reportError } from '@/shared/monitoring';
import { hashIp, sha256 } from '@/shared/request';
import { serviceDb, staffDb } from '@/models/db';
import * as rateLimits from '@/models/rate-limits';
import * as session from '@/models/session';
import * as staff from '@/models/staff';
import { fail, type Outcome } from '../outcome';

const FAILURE_WINDOW_SECONDS = 900;
const MAX_FAILURES = 10;

/** The rate-limit window rate_limit_hit() is counting in right now. */
function currentWindow() {
  const w = FAILURE_WINDOW_SECONDS * 1000;
  return new Date(Math.floor(Date.now() / w) * w);
}

async function tooManyFailures(keys: string[]): Promise<boolean> {
  try {
    const hits = await rateLimits.hitsInWindow(serviceDb(), keys, currentWindow());
    return hits.some((h) => h >= MAX_FAILURES);
  } catch (e) {
    reportError(e, { where: 'signIn rate limit' });
    return false;
  }
}

async function recordFailure(keys: string[]) {
  try {
    await Promise.all(
      keys.map((key) => rateLimits.hit(serviceDb(), key, FAILURE_WINDOW_SECONDS, MAX_FAILURES)),
    );
  } catch (e) {
    reportError(e, { where: 'signIn rate limit' });
  }
}

export async function signIn(
  email: string,
  password: string,
  clientIp: string,
): Promise<Outcome<'locked' | 'wrong_password' | 'not_staff'>> {
  const keys = [
    `login:ip:${hashIp(clientIp)}`,
    `login:email:${sha256(email.toLowerCase()).slice(0, 32)}`,
  ];
  if (await tooManyFailures(keys)) return fail('locked');

  const db = await staffDb();
  const user = await session.signIn(db, email, password);
  if (!user) {
    await recordFailure(keys);
    return fail('wrong_password');
  }
  if (!(await staff.findByUser(db, user.id))) {
    await session.signOut(db);
    return fail('not_staff');
  }
  return { ok: true };
}

export async function signOut() {
  await session.signOut(await staffDb());
}

export async function changeOwnPassword(password: string) {
  await session.changePassword(await staffDb(), password);
}
