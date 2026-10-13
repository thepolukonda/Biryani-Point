import 'server-only';
import { cache } from 'react';
import { staffDb } from '@/models/db';
import * as session from '@/models/session';
import * as staff from '@/models/staff';

export type StaffUser = {
  id: string;
  email: string;
  role: 'owner' | 'staff';
  displayName: string;
};

/** The signed-in staff member, or null. Checked against the auth server on every request. */
export const currentStaff = cache(async (): Promise<StaffUser | null> => {
  const db = await staffDb();
  const user = await session.currentUser(db);
  if (!user) return null;
  const member = await staff.findByUser(db, user.id);
  if (!member) return null;
  return {
    id: user.id,
    email: user.email ?? '',
    role: member.role,
    displayName: member.display_name,
  };
});
