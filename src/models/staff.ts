/**
 * Model: staff accounts. The `staff` table says who may use the admin panel; the login
 * itself is a Supabase Auth user. The `auth.admin` calls need the service client.
 */
import { check, DbError, must, type Db, type Enums } from './db/core';

export type StaffRole = Enums['staff_role'];

export async function findByUser(db: Db, userId: string) {
  const result = await db
    .from('staff')
    .select('role, display_name')
    .eq('user_id', userId)
    .maybeSingle();
  check(result, 'staff.findByUser');
  return result.data;
}

export async function listAll(db: Db) {
  return must(await db.from('staff').select('*').order('created_at'), 'staff.listAll');
}

export async function countOwners(db: Db): Promise<number> {
  const result = await db
    .from('staff')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'owner');
  check(result, 'staff.countOwners');
  return result.count ?? 0;
}

export async function insert(db: Db, userId: string, role: StaffRole, displayName: string) {
  check(
    await db.from('staff').insert({ user_id: userId, role, display_name: displayName }),
    'staff.insert',
  );
}

export async function setRole(db: Db, userId: string, role: StaffRole) {
  check(await db.from('staff').update({ role }).eq('user_id', userId), 'staff.setRole');
}

// Logins (Supabase Auth admin API) ---------------------------------------------------------

export async function listLogins(db: Db) {
  const result = await db.auth.admin.listUsers({ perPage: 200 });
  if (result.error) throw new DbError('staff.listLogins', result.error);
  return result.data.users;
}

/** Creates a confirmed login and returns its user id. A taken email fails with has('already'). */
export async function createLogin(db: Db, email: string, password: string, name: string) {
  const result = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (result.error || !result.data.user)
    throw new DbError('staff.createLogin', result.error ?? { message: 'no user returned' });
  return result.data.user.id;
}

/** Deleting the login also removes its staff row (foreign key cascade). */
export async function deleteLogin(db: Db, userId: string) {
  const result = await db.auth.admin.deleteUser(userId);
  if (result.error) throw new DbError('staff.deleteLogin', result.error);
}

export async function setLoginPassword(db: Db, userId: string, password: string) {
  const result = await db.auth.admin.updateUserById(userId, { password });
  if (result.error) throw new DbError('staff.setLoginPassword', result.error);
}
