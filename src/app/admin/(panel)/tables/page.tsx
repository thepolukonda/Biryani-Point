import type { Metadata } from 'next';
import { tablesPage } from '@/controllers/admin/pages';
import { TablesManager } from '@/views/admin/counter/tables-manager';

export const metadata: Metadata = { title: 'Tables' };
export const dynamic = 'force-dynamic';

export default async function TablesPage() {
  const { tables, busy } = await tablesPage();
  return <TablesManager tables={tables} busy={busy} />;
}
