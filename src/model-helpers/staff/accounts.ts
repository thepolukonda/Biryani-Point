/** Staff accounts, managed by the owner. Sign-ups are closed, so this is the only way in. */
import 'server-only';
import { DbError, serviceDb } from '@/models/db';
import * as staff from '@/models/staff';
import type { StaffRole } from '@/models/staff';
import { fail, type Outcome } from '../outcome';

export type StaffMember = {
  userId: string;
  name: string;
  role: StaffRole;
  email: string;
  lastSignIn: string | null;
};

export async function listMembers(): Promise<StaffMember[]> {
  const db = serviceDb();
  const [members, logins] = await Promise.all([staff.listAll(db), staff.listLogins(db)]);
  const byId = new Map(logins.map((u) => [u.id, u]));
  return members.map((s) => ({
    userId: s.user_id,
    name: s.display_name,
    role: s.role,
    email: byId.get(s.user_id)?.email ?? '',
    lastSignIn: byId.get(s.user_id)?.last_sign_in_at ?? null,
  }));
}

export async function addMember(input: {
  email: string;
  name: string;
  role: StaffRole;
  password: string;
}): Promise<Outcome<'email_taken'>> {
  const db = serviceDb();
  let userId: string;
  try {
    userId = await staff.createLogin(db, input.email, input.password, input.name);
  } catch (e) {
    if (e instanceof DbError && e.has('already')) return fail('email_taken');
    throw e;
  }
  try {
    await staff.insert(db, userId, input.role, input.name);
  } catch (e) {
    // No staff row means a login nobody can use: remove it again.
    await staff.deleteLogin(db, userId);
    throw e;
  }
  return { ok: true };
}

/** The last owner cannot make themselves staff, or nobody could manage the restaurant. */
export async function setRole(
  actingUserId: string,
  userId: string,
  role: StaffRole,
): Promise<Outcome<'last_owner'>> {
  const db = serviceDb();
  if (userId === actingUserId && role === 'staff' && (await staff.countOwners(db)) <= 1)
    return fail('last_owner');
  await staff.setRole(db, userId, role);
  return { ok: true };
}

export async function resetPassword(userId: string, password: string) {
  await staff.setLoginPassword(serviceDb(), userId, password);
}

export async function removeMember(actingUserId: string, userId: string): Promise<Outcome<'self'>> {
  if (userId === actingUserId) return fail('self');
  await staff.deleteLogin(serviceDb(), userId);
  return { ok: true };
}
