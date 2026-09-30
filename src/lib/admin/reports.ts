/**
 * Report maths (pure, unit-tested). Revenue counts orders that were not rejected
 * or cancelled; days and weeks are the restaurant's local days (its time zone).
 */
export type ReportOrder = {
  order_number: number;
  created_at: string;
  status: string;
  type: 'delivery' | 'pickup' | 'dine_in';
  /** 'counter' = taken by staff (table or takeaway). Missing = website. */
  source?: 'website' | 'counter';
  total_tetri: number;
};

/** Where an order came from: website delivery or pickup, counter takeaway, or a table. */
export type Channel = 'delivery' | 'pickup' | 'takeaway' | 'table';

export function channelOf(o: Pick<ReportOrder, 'type' | 'source'>): Channel {
  if (o.type === 'dine_in') return 'table';
  if (o.type === 'delivery') return 'delivery';
  return o.source === 'counter' ? 'takeaway' : 'pickup';
}

export type ReportItem = {
  name: string;
  quantity: number;
  line_total_tetri: number;
  order_status: string;
};

const COUNTED = (status: string) => status !== 'rejected' && status !== 'cancelled';

export function localDay(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone });
}

/** Monday of the local week, as YYYY-MM-DD. */
export function localWeek(iso: string, timeZone: string): string {
  const [y, m, d] = localDay(iso, timeZone).split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const back = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - back);
  return date.toISOString().slice(0, 10);
}

export type Bucket = {
  key: string;
  orders: number;
  revenueTetri: number;
  delivery: number;
  pickup: number;
  takeaway: number;
  table: number;
  rejected: number;
};

export function bucketOrders(
  orders: ReportOrder[],
  by: 'day' | 'week',
  timeZone: string,
): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const o of orders) {
    const key = by === 'day' ? localDay(o.created_at, timeZone) : localWeek(o.created_at, timeZone);
    const b = map.get(key) ?? {
      key,
      orders: 0,
      revenueTetri: 0,
      delivery: 0,
      pickup: 0,
      takeaway: 0,
      table: 0,
      rejected: 0,
    };
    if (COUNTED(o.status)) {
      b.orders += 1;
      b.revenueTetri += o.total_tetri;
      b[channelOf(o)] += 1;
    } else b.rejected += 1;
    map.set(key, b);
  }
  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export function totals(orders: ReportOrder[]) {
  const counted = orders.filter((o) => COUNTED(o.status));
  const revenue = counted.reduce((s, o) => s + o.total_tetri, 0);
  return {
    orders: counted.length,
    revenueTetri: revenue,
    averageTetri: counted.length ? Math.round(revenue / counted.length) : 0,
    rejected: orders.length - counted.length,
  };
}

export function topItems(items: ReportItem[], limit = 10) {
  const map = new Map<string, { name: string; quantity: number; revenueTetri: number }>();
  for (const i of items) {
    if (!COUNTED(i.order_status)) continue;
    const row = map.get(i.name) ?? { name: i.name, quantity: 0, revenueTetri: 0 };
    row.quantity += i.quantity;
    row.revenueTetri += i.line_total_tetri;
    map.set(i.name, row);
  }
  return [...map.values()]
    .sort((a, b) => b.quantity - a.quantity || b.revenueTetri - a.revenueTetri)
    .slice(0, limit);
}

/** CSV with a header row; values quoted when needed. Starts with a BOM so Excel reads Georgian/Russian. */
export function toCsv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    // Guard against spreadsheet formula injection.
    const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
