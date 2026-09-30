import type { Metadata } from 'next';
import { TablesManager } from '@/components/admin/counter/tables-manager';
import { requireOwner } from '@/lib/admin/auth';
import { sessionClient } from '@/lib/supabase/session';

export const metadata: Metadata = { title: 'Tables' };
export const dynamic = 'force-dynamic';

export default async function TablesPage() {
  await requireOwner();
  const db = await sessionClient();
  const [tables, open] = await Promise.all([
    db.from('dining_tables').select('*').order('sort_order').order('name'),
    db.from('orders').select('table_id').in('status', ['accepted', 'preparing', 'ready']),
  ]);
  const busy = (open.data ?? []).map((o) => o.table_id).filter((id): id is string => !!id);
  return <TablesManager tables={tables.data ?? []} busy={busy} />;
}
