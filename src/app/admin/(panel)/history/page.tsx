import type { Metadata } from 'next';
import Link from 'next/link';
import { historyPage } from '@/controllers/admin/pages';
import { orderKindLabel, statusLabel } from '@/shared/admin/orders';
import { cn } from '@/shared/cn';
import { pickText, type I18nText } from '@/shared/domain/i18n-text';
import { formatAmount } from '@/shared/domain/money';
import { formatGeorgianPhone } from '@/shared/domain/phone';
import { orderLabel } from '@/shared/orders/format';

export const metadata: Metadata = { title: 'History' };
export const dynamic = 'force-dynamic';

const when = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));

export default async function HistoryPage({ searchParams }: PageProps<'/admin/history'>) {
  const { q, orders, orderPrefix: prefix, timezone } = await historyPage((await searchParams).q);

  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-extrabold">Order history</h1>
      <form className="flex flex-wrap gap-2" role="search">
        <label className="sr-only" htmlFor="q">
          Search orders
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Order number, phone or name"
          className="border-line bg-surface focus:border-gold-text min-h-12 min-w-64 flex-1 rounded-md border-[1.5px] px-3 text-base focus:outline-none"
        />
        <button type="submit" className="bg-ink min-h-12 rounded-md px-5 font-semibold text-white">
          Search
        </button>
        {q && (
          <Link
            href="/admin/history"
            className="text-muted inline-flex min-h-12 items-center px-3 font-semibold underline"
          >
            Clear
          </Link>
        )}
      </form>
      {orders.length === 0 ? (
        <p className="bg-surface text-muted rounded-xl p-8 text-center">No orders found.</p>
      ) : (
        <ul className="grid gap-2">
          {orders.map((o) => (
            <li key={o.id} className="bg-surface shadow-card rounded-xl">
              <details>
                <summary className="flex min-h-14 cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <b className="text-lg">{orderLabel(prefix, o.order_number)}</b>
                  <span className="text-muted text-sm">{when(o.created_at, timezone)}</span>
                  <span className="text-sm">{orderKindLabel(o)}</span>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-bold',
                      o.status === 'completed'
                        ? 'bg-ok-soft text-ok'
                        : ['rejected', 'cancelled'].includes(o.status)
                          ? 'bg-danger-soft text-danger'
                          : 'bg-gold-soft text-gold-text',
                    )}
                  >
                    {statusLabel(o)}
                  </span>
                  <span className="tabular ml-auto font-bold">
                    GEL {formatAmount(o.total_tetri)}
                  </span>
                </summary>
                <div className="border-line grid gap-1 border-t px-4 py-3 text-sm">
                  <p>
                    {o.customer_name} ·{' '}
                    <a href={`tel:${o.customer_phone}`} className="underline">
                      {formatGeorgianPhone(o.customer_phone)}
                    </a>
                    {o.address_text && ` · ${o.address_text}`}
                  </p>
                  <ul>
                    {o.order_items.map((i) => (
                      <li key={i.id}>
                        {i.quantity} × {pickText(i.item_name as I18nText, 'en')}
                        {(i.modifiers as { option: I18nText }[]).length > 0 &&
                          ` (${(i.modifiers as { option: I18nText }[]).map((m) => pickText(m.option, 'en')).join(', ')})`}{' '}
                        · GEL {formatAmount(i.line_total_tetri)}
                      </li>
                    ))}
                  </ul>
                  {o.notes && <p>Notes: {o.notes}</p>}
                  {o.rejection_reason && (
                    <p className="text-danger">Reason: {o.rejection_reason}</p>
                  )}
                  <p className="text-muted">
                    Payment: {o.payment_method.replace(/_/g, ' ')} · {o.payment_status}
                  </p>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
