import type { Metadata } from 'next';
import { OrdersBoard } from '@/components/admin/orders-board';
import { ADMIN_ORDER_SELECT, OPEN_STATUSES, type AdminOrder } from '@/lib/admin/orders';
import { getMenu } from '@/lib/data/restaurant';
import { loadPrintSettings } from '@/lib/print/ticket-data';
import { sessionClient } from '@/lib/supabase/session';

export const metadata: Metadata = { title: 'Orders' };
export const dynamic = 'force-dynamic';

export default async function OrdersPage({ searchParams }: PageProps<'/admin'>) {
  const { denied } = await searchParams;
  const db = await sessionClient();
  const [{ data, error }, print, menu, tables] = await Promise.all([
    db
      .from('orders')
      .select(ADMIN_ORDER_SELECT)
      .in('status', OPEN_STATUSES)
      .order('created_at', { ascending: false })
      .limit(200),
    loadPrintSettings(),
    getMenu(),
    db.from('dining_tables').select('*').order('sort_order').order('name'),
  ]);

  return (
    <>
      {denied && (
        <p className="bg-danger-soft text-danger mb-4 rounded-lg px-4 py-3">
          That page is for the owner only.
        </p>
      )}
      {error ? (
        <p className="bg-danger-soft text-danger rounded-lg px-4 py-3">
          Could not load orders: {error.message}
        </p>
      ) : (
        <OrdersBoard
          initial={(data ?? []) as AdminOrder[]}
          autoPrint={{ kot: print.auto_print_kot, bill: print.auto_print_bill }}
          menu={menu}
          tables={tables.data ?? []}
        />
      )}
    </>
  );
}
