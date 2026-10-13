/** Who may run a controller: every admin controller starts with one of these. */
import 'server-only';
import { redirect } from 'next/navigation';
import { currentStaff, type StaffUser } from '@/model-helpers/staff/auth';

export { currentStaff, type StaffUser };

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
