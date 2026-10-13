/** Whether a request carries a valid staff session. Refreshing it may rewrite the cookies. */
import { proxyDb, type CookieJar } from '@/models/db/proxy';
import * as session from '@/models/session';

export type { CookieJar };

export async function isSignedIn(cookies: CookieJar): Promise<boolean> {
  return (await session.currentUser(proxyDb(cookies))) !== null;
}
