import { describe, expect, it } from 'vitest';
import { bucketOrders, localWeek, toCsv, topItems, totals, type ReportOrder } from './reports';

const TZ = 'Asia/Tbilisi';

const orders: ReportOrder[] = [
  // 23:30 UTC on the 28th is 03:30 on the 29th in Tbilisi (UTC+4).
  {
    order_number: 1,
    created_at: '2026-09-28T23:30:00Z',
    status: 'completed',
    type: 'delivery',
    total_tetri: 4000,
  },
  {
    order_number: 2,
    created_at: '2026-09-29T10:00:00Z',
    status: 'completed',
    type: 'pickup',
    total_tetri: 2000,
  },
  {
    order_number: 3,
    created_at: '2026-09-29T11:00:00Z',
    status: 'rejected',
    type: 'pickup',
    total_tetri: 9900,
  },
  {
    order_number: 5,
    created_at: '2026-09-29T12:00:00Z',
    status: 'completed',
    type: 'dine_in',
    source: 'counter',
    total_tetri: 3500,
  },
  {
    order_number: 4,
    created_at: '2026-09-27T12:00:00Z',
    status: 'accepted',
    type: 'delivery',
    total_tetri: 1000,
  },
];

describe('reports', () => {
  it('groups by Tbilisi day and ignores rejected orders in revenue', () => {
    expect(bucketOrders(orders, 'day', TZ)).toEqual([
      {
        key: '2026-09-29',
        orders: 3,
        revenueTetri: 9500,
        delivery: 1,
        pickup: 1,
        takeaway: 0,
        table: 1,
        rejected: 1,
      },
      {
        key: '2026-09-27',
        orders: 1,
        revenueTetri: 1000,
        delivery: 1,
        pickup: 0,
        takeaway: 0,
        table: 0,
        rejected: 0,
      },
    ]);
  });

  it('groups by week starting Monday', () => {
    expect(localWeek('2026-09-27T12:00:00Z', TZ)).toBe('2026-09-21'); // Sunday -> previous Monday
    expect(localWeek('2026-09-29T10:00:00Z', TZ)).toBe('2026-09-28');
    expect(bucketOrders(orders, 'week', TZ).map((b) => [b.key, b.orders])).toEqual([
      ['2026-09-28', 3],
      ['2026-09-21', 1],
    ]);
  });

  it('sums totals and averages', () => {
    expect(totals(orders)).toEqual({
      orders: 4,
      revenueTetri: 10500,
      averageTetri: 2625,
      rejected: 1,
    });
  });

  it('ranks top items by quantity', () => {
    const items = [
      { name: 'Chicken Biryani', quantity: 2, line_total_tetri: 4000, order_status: 'completed' },
      { name: 'Kerala Mandi', quantity: 1, line_total_tetri: 2500, order_status: 'completed' },
      { name: 'Chicken Biryani', quantity: 1, line_total_tetri: 2000, order_status: 'accepted' },
      { name: 'Kerala Mandi', quantity: 5, line_total_tetri: 12500, order_status: 'rejected' },
    ];
    expect(topItems(items)).toEqual([
      { name: 'Chicken Biryani', quantity: 3, revenueTetri: 6000 },
      { name: 'Kerala Mandi', quantity: 1, revenueTetri: 2500 },
    ]);
  });

  it('writes safe CSV', () => {
    expect(
      toCsv([
        ['a', 'b, c', 'say "hi"'],
        ['=HYPERLINK("x")', -5, null],
      ]),
    ).toBe('﻿a,"b, c","say ""hi"""\r\n"\'=HYPERLINK(""x"")",-5,\r\n');
  });
});
