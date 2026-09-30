import type { Metadata } from 'next';
import Link from 'next/link';
import { requireOwner } from '@/lib/admin/auth';
import { loadReport, rangeFrom, RANGES } from '@/lib/admin/report-data';
import { bucketOrders, topItems, totals } from '@/lib/admin/reports';
import { cn } from '@/lib/cn';
import { getRestaurant } from '@/lib/data/restaurant';
import { formatAmount } from '@/lib/domain/money';

export const metadata: Metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

const gel = (t: number) => `GEL ${formatAmount(t)}`;
const dayLabel = (key: string) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${key}T00:00:00Z`));

export default async function ReportsPage({ searchParams }: PageProps<'/admin/reports'>) {
  await requireOwner();
  const params = await searchParams;
  const range = rangeFrom(typeof params.range === 'string' ? params.range : undefined);
  const by = params.by === 'week' ? 'week' : 'day';
  const [{ orders, items }, { timezone }] = await Promise.all([
    loadReport(range.from, range.to),
    getRestaurant(),
  ]);
  const sum = totals(orders);
  const buckets = bucketOrders(orders, by, timezone);
  const top = topItems(items);
  const max = Math.max(1, ...buckets.map((b) => b.revenueTetri));

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Reports</h1>
        <a
          href={`/admin/reports/export?range=${range.key}`}
          className="bg-ink inline-flex min-h-12 items-center rounded-md px-5 font-semibold text-white"
        >
          Download CSV
        </a>
      </div>

      <nav aria-label="Period" className="flex flex-wrap gap-2">
        {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((k) => (
          <Link
            key={k}
            href={`/admin/reports?range=${k}&by=${by}`}
            aria-current={k === range.key ? 'page' : undefined}
            className={cn(
              'inline-flex min-h-11 items-center rounded-full px-4 font-semibold',
              k === range.key ? 'bg-gold text-on-gold' : 'bg-surface',
            )}
          >
            Last {k} days
          </Link>
        ))}
      </nav>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Orders', String(sum.orders)],
          ['Revenue', gel(sum.revenueTetri)],
          ['Average order', gel(sum.averageTetri)],
          ['Rejected / cancelled', String(sum.rejected)],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface shadow-card rounded-2xl p-5">
            <dt className="text-muted text-sm">{label}</dt>
            <dd className="tabular mt-1 text-2xl font-extrabold">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted -mt-2 text-sm">
        Revenue counts every order that was not rejected or cancelled, including delivery fees.
      </p>

      <section className="bg-surface shadow-card rounded-2xl p-5" aria-labelledby="per-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="per-title" className="text-lg font-extrabold">
            Per {by}
          </h2>
          <div className="flex gap-2">
            {(['day', 'week'] as const).map((b) => (
              <Link
                key={b}
                href={`/admin/reports?range=${range.key}&by=${b}`}
                aria-current={b === by ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold',
                  b === by ? 'bg-ink text-white' : 'bg-soft',
                )}
              >
                By {b}
              </Link>
            ))}
          </div>
        </div>
        {buckets.length === 0 ? (
          <p className="text-muted">No orders in this period.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-left">
                <th scope="col" className="py-2 font-semibold">
                  {by === 'day' ? 'Day' : 'Week of'}
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Orders
                </th>
                <th scope="col" className="hidden py-2 text-right font-semibold sm:table-cell">
                  Delivery / pickup / takeaway / table
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Revenue
                </th>
                <th scope="col" className="hidden w-1/3 py-2 md:table-cell">
                  <span className="sr-only">Chart</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <tr key={b.key} className="border-line border-t">
                  <th scope="row" className="py-2 text-left font-medium">
                    {dayLabel(b.key)}
                  </th>
                  <td className="tabular py-2 text-right">{b.orders}</td>
                  <td className="tabular hidden py-2 text-right sm:table-cell">
                    {b.delivery} / {b.pickup} / {b.takeaway} / {b.table}
                  </td>
                  <td className="tabular py-2 text-right font-semibold">{gel(b.revenueTetri)}</td>
                  <td className="hidden py-2 pl-4 md:table-cell" aria-hidden>
                    <div
                      className="bg-gold h-3 rounded-full"
                      style={{ width: `${(b.revenueTetri / max) * 100}%` }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-surface shadow-card rounded-2xl p-5" aria-labelledby="top-title">
        <h2 id="top-title" className="mb-3 text-lg font-extrabold">
          Top dishes
        </h2>
        {top.length === 0 ? (
          <p className="text-muted">No dishes sold in this period.</p>
        ) : (
          <ol className="grid gap-1.5">
            {top.map((t, i) => (
              <li
                key={t.name}
                className="border-line flex items-center justify-between gap-3 border-b py-1.5 last:border-0"
              >
                <span>
                  <span className="bg-soft mr-2 inline-grid size-7 place-items-center rounded-full text-sm font-bold">
                    {i + 1}
                  </span>
                  {t.name}
                </span>
                <span className="tabular text-sm">
                  <b>{t.quantity}</b> sold · {gel(t.revenueTetri)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
