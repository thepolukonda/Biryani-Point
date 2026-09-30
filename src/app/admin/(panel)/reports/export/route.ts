/** GET /admin/reports/export?range=30 : orders as CSV (owner only). */
import { NextResponse } from 'next/server';
import { currentStaff } from '@/lib/admin/auth';
import { loadReport, rangeFrom } from '@/lib/admin/report-data';
import { channelOf, localDay, toCsv, type ReportOrder } from '@/lib/admin/reports';
import { getRestaurant } from '@/lib/data/restaurant';
import { formatAmount } from '@/lib/domain/money';
import { orderLabel } from '@/lib/orders/format';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await currentStaff();
  if (!user || user.role !== 'owner')
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const range = rangeFrom(new URL(request.url).searchParams.get('range') ?? undefined);
  const [{ orders }, { timezone, profile }] = await Promise.all([
    loadReport(range.from, range.to),
    getRestaurant(),
  ]);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const csv = toCsv([
    [
      'Order',
      'Date',
      'Time',
      'Status',
      'Type',
      'Subtotal GEL',
      'Delivery GEL',
      'Total GEL',
      'Payment',
      'Paid',
      'Language',
    ],
    ...orders.map((o) => [
      orderLabel(profile.orderPrefix, o.order_number),
      localDay(o.created_at, timezone),
      time.format(new Date(o.created_at)),
      o.status,
      channelOf(o as ReportOrder),
      formatAmount(o.subtotal_tetri as number),
      formatAmount(o.delivery_fee_tetri as number),
      formatAmount(o.total_tetri),
      String(o.payment_method),
      String(o.payment_status),
      String(o.customer_locale),
    ]),
  ]);

  // e.g. "biryani-point-orders-last-30-days.csv"
  const fileBase =
    profile.brandName
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'restaurant';
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${fileBase}-orders-last-${range.key}-days.csv"`,
      'cache-control': 'no-store',
    },
  });
}
