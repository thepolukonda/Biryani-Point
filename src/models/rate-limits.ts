/** Model: fixed-window rate-limit counters (rate_limits table; service client only). */
import { check, must, type Db } from './db/core';

/** Counts one hit. False once more than `max` hits are in the current window. */
export async function hit(db: Db, key: string, windowSeconds: number, max: number) {
  const result = await db.rpc('rate_limit_hit', {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  return must(result, 'rateLimits.hit') !== false;
}

/** Hit counts for these keys in the window that started at `windowStart`. */
export async function hitsInWindow(db: Db, keys: string[], windowStart: Date): Promise<number[]> {
  const result = await db
    .from('rate_limits')
    .select('hits')
    .in('key', keys)
    .eq('window_start', windowStart.toISOString());
  return must(result, 'rateLimits.hitsInWindow').map((r) => r.hits);
}

/** Housekeeping: clears old IP hashes and expired counters (database function). */
export async function purgeExpired(db: Db) {
  check(await db.rpc('purge_expired_data'), 'rateLimits.purgeExpired');
}
