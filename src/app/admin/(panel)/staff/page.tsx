import type { Metadata } from 'next';
import { staffPage } from '@/controllers/admin/pages';
import { StaffManager } from '@/views/admin/staff-manager';

export const metadata: Metadata = { title: 'Staff' };
export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  const { members, me } = await staffPage();
  return <StaffManager members={members} me={me} />;
}
