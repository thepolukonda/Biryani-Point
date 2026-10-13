'use server';

import { refresh } from 'next/cache';
import { z } from 'zod';
import { reportError } from '@/shared/monitoring';
import * as accounts from '@/model-helpers/staff/accounts';
import type { FormState } from './form-state';
import { requireOwner } from './guard';

export type { FormState };

const role = z.enum(['owner', 'staff']);
const password = z.string().min(10, 'The password needs at least 10 characters.').max(200);

const newStaff = z.object({
  email: z.email('Enter a valid email.'),
  name: z.string().trim().min(1, 'Enter a name.').max(80),
  role,
  password,
});

function unexpected(where: string, e: unknown): FormState {
  reportError(e, { where });
  return { error: 'Something went wrong. Please try again.' };
}

export async function addStaff(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = newStaff.safeParse({
    email: form.get('email'),
    name: form.get('name'),
    role: form.get('role'),
    password: form.get('password'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  try {
    const result = await accounts.addMember(parsed.data);
    if (!result.ok) return { error: 'That email already has an account.' };
  } catch (e) {
    return unexpected('addStaff', e);
  }
  refresh();
  const { name, email } = parsed.data;
  return {
    ok: true,
    message: `${name} can now sign in with ${email}. Give them the password in person.`,
  };
}

export async function setRole(userId: string, newRole: 'owner' | 'staff'): Promise<FormState> {
  const me = await requireOwner();
  if (!z.uuid().safeParse(userId).success) return { error: 'Invalid user.' };
  if (!role.safeParse(newRole).success) return { error: 'Invalid role.' };
  try {
    const result = await accounts.setRole(me.id, userId, newRole);
    if (!result.ok) return { error: 'You are the only owner. Make someone else owner first.' };
  } catch (e) {
    return unexpected('setRole', e);
  }
  refresh();
  return { ok: true };
}

export async function resetPassword(userId: string, newPassword: string): Promise<FormState> {
  await requireOwner();
  if (!z.uuid().safeParse(userId).success) return { error: 'Invalid user.' };
  if (!password.safeParse(newPassword).success)
    return { error: 'The password needs 10 to 200 characters.' };
  try {
    await accounts.resetPassword(userId, newPassword);
  } catch (e) {
    return unexpected('resetPassword', e);
  }
  return { ok: true, message: 'Password changed.' };
}

export async function removeStaff(userId: string): Promise<FormState> {
  const me = await requireOwner();
  if (!z.uuid().safeParse(userId).success) return { error: 'Invalid user.' };
  try {
    const result = await accounts.removeMember(me.id, userId);
    if (!result.ok) return { error: 'You cannot remove yourself.' };
  } catch (e) {
    return unexpected('removeStaff', e);
  }
  refresh();
  return { ok: true, message: 'Removed. They can no longer sign in.' };
}
