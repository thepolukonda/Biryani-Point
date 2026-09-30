import 'server-only';
import { pickText, type I18nText } from '@/lib/domain/i18n-text';
import { sessionClient } from '@/lib/supabase/session';
import type { ReportItem, ReportOrder } from './reports';

export const RANGES = { '7': 7, '30': 30, '90': 90, '365': 365 } as const;
export type RangeKey = keyof typeof RANGES;

export function rangeFrom(key: string | undefined): { key: RangeKey; from: Date; to: Date } {
  const k: RangeKey = key && key in RANGES ? (key as RangeKey) : '30';
  const to = new Date();
  return { key: k, from: new Date(to.getTime() - RANGES[k] * 86_400_000), to };
}

export async function loadReport(from: Date, to: Date) {
  const db = await sessionClient();
  const [orders, items] = await Promise.all([
    db
      .from('orders')
      .select(
        'order_number, created_at, status, type, source, total_tetri, subtotal_tetri, delivery_fee_tetri, payment_method, payment_status, customer_locale',
      )
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())
      .order('created_at', { ascending: false })
      .limit(10_000),
    db
      .from('order_items')
      .select('item_name, quantity, line_total_tetri, orders!inner(status, created_at)')
      .gte('orders.created_at', from.toISOString())
      .lt('orders.created_at', to.toISOString())
      .limit(50_000),
  ]);
  if (orders.error) throw new Error(orders.error.message);
  if (items.error) throw new Error(items.error.message);

  return {
    orders: orders.data as (ReportOrder & Record<string, unknown>)[],
    items: (items.data ?? []).map((i): ReportItem => ({
      name: pickText(i.item_name as I18nText, 'en'),
      quantity: i.quantity,
      line_total_tetri: i.line_total_tetri,
      order_status: (i.orders as unknown as { status: string }).status,
    })),
  };
}
