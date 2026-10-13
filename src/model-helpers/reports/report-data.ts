import 'server-only';
import { formatAmount } from '@/shared/domain/money';
import { pickText, type I18nText } from '@/shared/domain/i18n-text';
import { orderLabel } from '@/shared/orders/format';
import { slugify } from '@/shared/text';
import { staffDb } from '@/models/db';
import * as ordersModel from '@/models/orders';
import { getRestaurant } from '../restaurant';
import {
  bucketOrders,
  channelOf,
  localDay,
  toCsv,
  topItems,
  totals,
  type ReportItem,
  type ReportOrder,
} from './reports';

export const RANGES = { '7': 7, '30': 30, '90': 90, '365': 365 } as const;
export type RangeKey = keyof typeof RANGES;

export function rangeFrom(key: string | undefined): { key: RangeKey; from: Date; to: Date } {
  const k: RangeKey = key && key in RANGES ? (key as RangeKey) : '30';
  const to = new Date();
  return { key: k, from: new Date(to.getTime() - RANGES[k] * 86_400_000), to };
}

export async function loadReport(from: Date, to: Date) {
  const db = await staffDb();
  const [orders, items] = await Promise.all([
    ordersModel.listForReport(db, from, to),
    ordersModel.listItemsForReport(db, from, to),
  ]);

  return {
    orders: orders as (ReportOrder & Record<string, unknown>)[],
    items: items.map((i): ReportItem => ({
      name: pickText(i.item_name as I18nText, 'en'),
      quantity: i.quantity,
      line_total_tetri: i.line_total_tetri,
      order_status: (i.orders as unknown as { status: string }).status,
    })),
  };
}

/** The Reports page: totals, revenue per day or week, and the best-selling dishes. */
export async function reportSummary(rangeKey: string | undefined, by: 'day' | 'week') {
  const range = rangeFrom(rangeKey);
  const [{ orders, items }, { timezone }] = await Promise.all([
    loadReport(range.from, range.to),
    getRestaurant(),
  ]);
  const buckets = bucketOrders(orders, by, timezone);
  return {
    range,
    by,
    totals: totals(orders),
    buckets,
    top: topItems(items),
    maxRevenueTetri: Math.max(1, ...buckets.map((b) => b.revenueTetri)),
  };
}

/** The orders of a range as a CSV file, e.g. "biryani-point-orders-last-30-days.csv". */
export async function reportCsv(rangeKey: string | undefined) {
  const range = rangeFrom(rangeKey);
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

  const fileBase = slugify(profile.brandName) || 'restaurant';
  return { csv, fileName: `${fileBase}-orders-last-${range.key}-days.csv` };
}
