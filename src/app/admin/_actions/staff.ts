'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import { requireOwner } from '@/lib/admin/auth';
import { serviceClient } from '@/lib/supabase/clients';

export type FormState = { ok?: boolean; message?: string; error?: string };

const newStaff = z.object({
  email: z.email('Enter a valid email.'),
  name: z.string().trim().min(1, 'Enter a name.').max(80),
  role: z.enum(['owner', 'staff']),
  password: z.string().min(10, 'The password needs at least 10 characters.').max(200),
});

/** Creates a login for a kitchen member (sign-ups are closed, so this is the only way in). */
export async function addStaff(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = newStaff.safeParse({
    email: form.get('email'),
    name: form.get('name'),
    role: form.get('role'),
    password: form.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const { email, name, role, password } = parsed.data;

  const admin = serviceClient();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (created.error || !created.data.user) {
    return {
      error: created.error?.message.includes('already')
        ? 'That email already has an account.'
        : (created.error?.message ?? 'Could not create the account.'),
    };
  }
  const { error } = await admin
    .from('staff')
    .insert({ user_id: created.data.user.id, role, display_name: name });
  if (error) {
    await admin.auth.admin.deleteUser(created.data.user.id);
    return { error: error.message };
  }
  refresh();
  return {
    ok: true,
    message: `${name} can now sign in with ${email}. Give them the password in person.`,
  };
}

async function ownerCount() {
  const { count } = await serviceClient()
    .from('staff')
    .select('user_id', { count: 'exact', head: true })
    .eq('role', 'owner');
  return count ?? 0;
}

export async function setRole(userId: string, role: 'owner' | 'staff'): Promise<FormState> {
  const me = await requireOwner();
  if (!z.uuid().safeParse(userId).success) return { error: 'Invalid user.' };
  if (!z.enum(['owner', 'staff']).safeParse(role).success) return { error: 'Invalid role.' };
  if (userId === me.id && role === 'staff' && (await ownerCount()) <= 1)
    return { error: 'You are the only owner. Make someone else owner first.' };
  const { error } = await serviceClient().from('staff').update({ role }).eq('user_id', userId);
  if (error) return { error: error.message };
  refresh();
  return { ok: true };
}

export async function resetPassword(userId: string, password: string): Promise<FormState> {
  await requireOwner();
  if (!z.uuid().safeParse(userId).success) return { error: 'Invalid user.' };
  if (!z.string().min(10).max(200).safeParse(password).success)
    return { error: 'The password needs 10 to 200 characters.' };
  const { error } = await serviceClient().auth.admin.updateUserById(userId, { password });
  return error ? { error: error.message } : { ok: true, message: 'Password changed.' };
}

export async function removeStaff(userId: string): Promise<FormState> {
  const me = await requireOwner();
  if (!z.uuid().safeParse(userId).success) return { error: 'Invalid user.' };
  if (userId === me.id) return { error: 'You cannot remove yourself.' };
  const admin = serviceClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  refresh();
  return { ok: true, message: 'Removed. They can no longer sign in.' };
}
