import type { Metadata } from 'next';
import { StaffManager, type StaffMember } from '@/components/admin/staff-manager';
import { requireOwner } from '@/lib/admin/auth';
import { serviceClient } from '@/lib/supabase/clients';

export const metadata: Metadata = { title: 'Staff' };
export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const me = await requireOwner();
  const admin = serviceClient();
  const [staff, users] = await Promise.all([
    admin.from('staff').select('*').order('created_at'),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ]);
  const byId = new Map((users.data?.users ?? []).map((u) => [u.id, u]));
  const members: StaffMember[] = (staff.data ?? []).map((s) => ({
    userId: s.user_id,
    name: s.display_name,
    role: s.role,
    email: byId.get(s.user_id)?.email ?? '',
    lastSignIn: byId.get(s.user_id)?.last_sign_in_at ?? null,
  }));
  return <StaffManager members={members} me={me.id} />;
}
