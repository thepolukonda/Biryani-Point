import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { sessionClient } from '@/lib/supabase/session';

export type StaffUser = {
  id: string;
  email: string;
  role: 'owner' | 'staff';
  displayName: string;
};

/** The signed-in staff member, or null. Checked against the auth server on every request. */
export const currentStaff = cache(async (): Promise<StaffUser | null> => {
  const db = await sessionClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  const staff = await db
    .from('staff')
    .select('role, display_name')
    .eq('user_id', data.user.id)
    .maybeSingle();
  if (!staff.data) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? '',
    role: staff.data.role,
    displayName: staff.data.display_name,
  };
});

export async function requireStaff(): Promise<StaffUser> {
  const user = await currentStaff();
  if (!user) redirect('/admin/login');
  return user;
}

export async function requireOwner(): Promise<StaffUser> {
  const user = await requireStaff();
  if (user.role !== 'owner') redirect('/admin?denied=1');
  return user;
}
