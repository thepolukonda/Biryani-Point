/** Model: the signed-in user's own session (Supabase Auth through the cookie-based client). */
import { DbError, type Db } from './db/core';

/** The user behind the session cookie, verified with the auth server; null when signed out. */
export async function currentUser(db: Db) {
  const { data, error } = await db.auth.getUser();
  return error || !data.user ? null : data.user;
}

/** Signs in and sets the session cookie. Null for a wrong email or password. */
export async function signIn(db: Db, email: string, password: string) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  return error || !data.user ? null : data.user;
}

export async function signOut(db: Db) {
  await db.auth.signOut();
}

export async function changePassword(db: Db, password: string) {
  const { error } = await db.auth.updateUser({ password });
  if (error) throw new DbError('session.changePassword', error);
}
