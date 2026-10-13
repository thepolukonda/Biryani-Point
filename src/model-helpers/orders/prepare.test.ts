import { describe, expect, it } from 'vitest';
import { zonedTimeToUtc, type Weekday } from '@/shared/domain/hours';
import type { Menu } from '@/shared/domain/menu';
import { TEST_PROFILE } from '@/shared/domain/profile.fixture';
import type { RestaurantInfo } from '@/shared/domain/restaurant';
import { prepareOrder } from './prepare';
import { fieldErrors, orderRequestSchema, type OrderRequest } from '@/shared/orders/schema';

const TZ = 'Asia/Tbilisi';
const at = (y: number, m: number, d: number, h: number, min = 0) =>
  zonedTimeToUtc({ year: y, month: m, day: d }, h * 60 + min, TZ);

const menu: Menu = {
  categories: [{ slug: 'biryani', name: { en: 'Biryani' }, blurb: null }],
  items: [
    {
      slug: 'chicken-biryani',
      categorySlug: 'biryani',
      name: { en: 'Chicken Biryani' },
      description: null,
      priceTetri: 2000,
      photoPath: null,
      isVeg: false,
      spiceLevel: null,
      allergens: [],
      isPopular: true,
      isAvailable: true,
      modifierGroups: [
        {
          slug: 'spice-level',
          name: { en: 'Spice level' },
          minSelect: 1,
          maxSelect: 1,
          options: [
            {
              slug: 'mild',
              name: { en: 'Mild' },
              priceDeltaTetri: 0,
              isDefault: false,
              isAvailable: true,
            },
            {
              slug: 'medium',
              name: { en: 'Medium' },
              priceDeltaTetri: 0,
              isDefault: true,
              isAvailable: true,
            },
          ],
        },
      ],
    },
  ],
};

const restaurant: RestaurantInfo = {
  profile: TEST_PROFILE,
  timezone: TZ,
  phone: '+995500904721',
  whatsapp: '995500904721',
  location: { lat: 41.641, lng: 41.6151 },
  schedule: {
    timezone: TZ,
    hours: ([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((weekday) => ({
      weekday,
      opens: '12:00',
      closes: '23:00',
    })),
    closures: [],
    lastOrderMinutesBeforeClose: 15,
  },
  fees: { deliveryFeeTetri: 500, freeDeliveryOverTetri: 5000, minDeliveryOrderTetri: 1500 },
  zones: [
    {
      id: 'z1',
      name: '5 km',
      kind: 'radius',
      radiusKm: 5,
      feeTetri: null,
      minOrderTetri: null,
      sortOrder: 0,
    },
  ],
  prepMinutes: { pickup: 30, delivery: 45 },
  slotIntervalMinutes: 15,
  scheduleDaysAhead: 2,
  deliveryEnabled: true,
  pickupEnabled: true,
  ordersPaused: false,
  pauseMessage: null,
  signatureItemSlugs: [],
  googleReviewUrl: null,
  owner: { name: null, note: null },
};

const base: OrderRequest = {
  idempotencyKey: 'key_0123456789abcdef',
  locale: 'ka',
  type: 'delivery',
  name: '  Nino  ',
  phone: '555 12 34 56',
  addressText: 'Gorgiladze St 10, apt 4',
  when: { kind: 'asap' },
  paymentMethod: 'cash',
  lines: [
    {
      itemSlug: 'chicken-biryani',
      quantity: 2,
      options: [{ group: 'spice-level', option: 'mild' }],
    },
  ],
};

const openNow = at(2026, 9, 28, 14, 0);
const ctx = (overrides: Partial<RestaurantInfo> = {}, now = openNow) => ({
  menu,
  restaurant: { ...restaurant, ...overrides },
  now,
  onlinePaymentsEnabled: false,
});

describe('prepareOrder', () => {
  it('prices a delivery order from the server menu', () => {
    const result = prepareOrder(base, ctx());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order).toMatchObject({
      customer_name: 'Nino',
      customer_phone: '+995555123456',
      customer_locale: 'ka',
      subtotal_tetri: 4000,
      delivery_fee_tetri: 500,
      total_tetri: 4500,
      prep_minutes: 45,
      scheduled_for: null,
      estimated_ready_at: new Date(openNow.getTime() + 45 * 60_000).toISOString(),
    });
    expect(result.items[0]).toMatchObject({
      item_slug: 'chicken-biryani',
      unit_price_tetri: 2000,
      quantity: 2,
      modifiers: [expect.objectContaining({ group_slug: 'spice-level', option_slug: 'mild' })],
    });
  });

  it('ignores any price the browser might send', () => {
    const tampered = {
      ...base,
      lines: [{ ...base.lines[0]!, unitPriceTetri: 1 }],
    } as unknown as OrderRequest;
    const result = prepareOrder(tampered, ctx());
    expect(result.ok && result.order.subtotal_tetri).toBe(4000);
  });

  it('refuses ASAP orders while closed, but accepts a time within tomorrow’s hours', () => {
    const lateNight = at(2026, 9, 28, 23, 30);
    expect(prepareOrder(base, ctx({}, lateNight))).toEqual({
      ok: false,
      errors: [{ code: 'closed_now' }],
    });

    const scheduled = {
      ...base,
      when: { kind: 'scheduled' as const, at: at(2026, 9, 29, 13, 0).toISOString() },
    };
    const result = prepareOrder(scheduled, ctx({}, lateNight));
    expect(result.ok && result.order.scheduled_for).toBe(at(2026, 9, 29, 13, 0).toISOString());
  });

  it('refuses a time outside opening hours or too soon', () => {
    const tooSoon = {
      ...base,
      when: { kind: 'scheduled' as const, at: at(2026, 9, 28, 14, 10).toISOString() },
    };
    const closed = {
      ...base,
      when: { kind: 'scheduled' as const, at: at(2026, 9, 29, 10, 0).toISOString() },
    };
    expect(prepareOrder(tooSoon, ctx())).toMatchObject({
      ok: false,
      errors: [{ code: 'invalid_time' }],
    });
    expect(prepareOrder(closed, ctx())).toMatchObject({
      ok: false,
      errors: [{ code: 'invalid_time' }],
    });
  });

  it('stops everything when online orders are paused', () => {
    expect(prepareOrder(base, ctx({ ordersPaused: true }))).toEqual({
      ok: false,
      errors: [{ code: 'orders_paused' }],
    });
  });

  it('refuses delivery when delivery is switched off', () => {
    expect(prepareOrder(base, ctx({ deliveryEnabled: false }))).toMatchObject({
      ok: false,
      errors: [{ code: 'type_unavailable' }],
    });
  });

  it('checks the delivery zone when a location is shared', () => {
    const inside = { ...base, location: { lat: 41.65, lng: 41.62 } };
    const outside = { ...base, location: { lat: 41.9, lng: 41.8 } };
    expect(prepareOrder(inside, ctx()).ok).toBe(true);
    expect(prepareOrder(outside, ctx())).toMatchObject({
      ok: false,
      errors: [{ code: 'outside_zone' }],
    });
  });

  it('enforces the delivery minimum but not for pickup', () => {
    const small = { ...base, lines: [{ ...base.lines[0]!, quantity: 1 }] };
    const fees = { deliveryFeeTetri: 0, freeDeliveryOverTetri: 0, minDeliveryOrderTetri: 3000 };
    expect(prepareOrder(small, ctx({ fees }))).toMatchObject({
      ok: false,
      errors: [{ code: 'below_minimum' }],
    });
    const pickup = { ...small, type: 'pickup' as const, paymentMethod: 'pay_at_pickup' as const };
    expect(prepareOrder(pickup, ctx({ fees })).ok).toBe(true);
  });

  it('only allows the payment method that fits the order type', () => {
    expect(prepareOrder({ ...base, paymentMethod: 'pay_at_pickup' }, ctx())).toMatchObject({
      ok: false,
      errors: [{ code: 'payment_unavailable' }],
    });
    expect(prepareOrder({ ...base, paymentMethod: 'online' }, ctx())).toMatchObject({ ok: false });
  });

  it('reports problems with a cart line', () => {
    const bad = { ...base, lines: [{ itemSlug: 'chicken-biryani', quantity: 1, options: [] }] };
    const result = prepareOrder(bad, ctx());
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.map((e) => e.code)).toEqual(['too_few_options']);
  });
});

describe('orderRequestSchema', () => {
  it('accepts a normal request', () => {
    expect(orderRequestSchema.safeParse(base).success).toBe(true);
  });

  it('requires an address or a location for delivery', () => {
    const result = orderRequestSchema.safeParse({ ...base, addressText: '' });
    expect(result.success).toBe(false);
    expect(!result.success && fieldErrors(result.error)).toEqual({
      addressText: 'address_required',
    });
    expect(
      orderRequestSchema.safeParse({ ...base, addressText: '', location: { lat: 41.6, lng: 41.6 } })
        .success,
    ).toBe(true);
    expect(
      orderRequestSchema.safeParse({ ...base, type: 'pickup', addressText: undefined }).success,
    ).toBe(true);
  });

  it('accepts foreign numbers with a country code, rejects anything else', () => {
    expect(orderRequestSchema.safeParse({ ...base, phone: '+7 999 123 45 67' }).success).toBe(true);
    const result = orderRequestSchema.safeParse({ ...base, phone: '7 999 123 45 67' });
    expect(!result.success && fieldErrors(result.error)).toEqual({ phone: 'invalid_phone' });
  });

  it('rejects silly quantities and empty carts', () => {
    expect(orderRequestSchema.safeParse({ ...base, lines: [] }).success).toBe(false);
    expect(
      orderRequestSchema.safeParse({ ...base, lines: [{ ...base.lines[0]!, quantity: 500 }] })
        .success,
    ).toBe(false);
  });

  it('rejects a bad scheduled time format', () => {
    expect(
      orderRequestSchema.safeParse({ ...base, when: { kind: 'scheduled', at: 'tomorrow' } })
        .success,
    ).toBe(false);
  });
});
