import type { Metadata } from 'next';
import { ordersBoardPage } from '@/controllers/admin/pages';
import { OrdersBoard } from '@/views/admin/orders-board';

export const metadata: Metadata = { title: 'Orders' };
export const dynamic = 'force-dynamic';

export default async function OrdersPage({ searchParams }: PageProps<'/admin'>) {
  const [{ denied }, { orders, print, menu, tables }] = await Promise.all([
    searchParams,
    ordersBoardPage(),
  ]);
  return (
    <>
      {denied && (
        <p className="bg-danger-soft text-danger mb-4 rounded-lg px-4 py-3">
          That page is for the owner only.
        </p>
      )}
      <OrdersBoard
        initial={orders}
        autoPrint={{ kot: print.auto_print_kot, bill: print.auto_print_bill }}
        menu={menu}
        tables={tables}
      />
    </>
  );
}
