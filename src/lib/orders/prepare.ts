/**
 * Turn a validated checkout request into an order ready to insert, using only
 * server data: the live menu, restaurant settings and the clock. Pure (no I/O),
 * so every rule here is unit-tested.
 */
import { getOpenState, isSchedulableTime } from '@/lib/domain/hours';
import type { I18nText } from '@/lib/domain/i18n-text';
import type { Menu } from '@/lib/domain/menu';
import { normaliseCustomerPhone } from '@/lib/domain/phone';
import { priceOrder, type PricedLine, type PricingProblem } from '@/lib/domain/pricing';
import { findDeliveryZone } from '@/lib/domain/zones';
import type { RestaurantInfo } from '@/lib/domain/restaurant';
import type { OrderRequest, PaymentMethod } from './schema';

export type OrderErrorCode =
  | 'orders_paused'
  | 'type_unavailable'
  | 'closed_now'
  | 'invalid_time'
  | 'outside_zone'
  | 'invalid_phone'
  | 'payment_unavailable'
  | PricingProblem['code'];

export type OrderError = { code: OrderErrorCode; detail?: PricingProblem };

export type OrderDraft = {
  type: 'delivery' | 'pickup';
  customer_name: string;
  customer_phone: string;
  customer_locale: string;
  address_text: string | null;
  address_lat: number | null;
  address_lng: number | null;
  delivery_zone_id: string | null;
  distance_km: number | null;
  scheduled_for: string | null;
  prep_minutes: number;
  estimated_ready_at: string;
  notes: string | null;
  subtotal_tetri: number;
  delivery_fee_tetri: number;
  discount_tetri: number;
  total_tetri: number;
  payment_method: PaymentMethod;
};

export type DraftItem = {
  item_slug: string;
  item_name: I18nText;
  base_price_tetri: number;
  unit_price_tetri: number;
  quantity: number;
  line_total_tetri: number;
  modifiers: {
    group_slug: string;
    option_slug: string;
    group: I18nText;
    option: I18nText;
    price_delta_tetri: number;
  }[];
  notes: string | null;
};

export function allowedPaymentMethods(
  type: 'delivery' | 'pickup',
  onlinePaymentsEnabled: boolean,
): PaymentMethod[] {
  const offline: PaymentMethod = type === 'delivery' ? 'cash' : 'pay_at_pickup';
  return onlinePaymentsEnabled ? [offline, 'online'] : [offline];
}

export function toDraftItem(line: PricedLine): DraftItem {
  return {
    item_slug: line.itemSlug,
    item_name: line.name,
    base_price_tetri: line.basePriceTetri,
    unit_price_tetri: line.unitPriceTetri,
    quantity: line.quantity,
    line_total_tetri: line.lineTotalTetri,
    modifiers: line.modifiers.map((m) => ({
      group_slug: m.groupSlug,
      option_slug: m.optionSlug,
      group: m.group,
      option: m.option,
      price_delta_tetri: m.priceDeltaTetri,
    })),
    notes: line.notes ?? null,
  };
}

export function prepareOrder(
  input: OrderRequest,
  ctx: { menu: Menu; restaurant: RestaurantInfo; now: Date; onlinePaymentsEnabled: boolean },
): { ok: true; order: OrderDraft; items: DraftItem[] } | { ok: false; errors: OrderError[] } {
  const { restaurant, now } = ctx;
  const errors: OrderError[] = [];

  if (restaurant.ordersPaused) return { ok: false, errors: [{ code: 'orders_paused' }] };
  if (
    (input.type === 'delivery' && !restaurant.deliveryEnabled) ||
    (input.type === 'pickup' && !restaurant.pickupEnabled)
  ) {
    return { ok: false, errors: [{ code: 'type_unavailable' }] };
  }

  const phone = normaliseCustomerPhone(input.phone);
  if (!phone) errors.push({ code: 'invalid_phone' });

  if (!allowedPaymentMethods(input.type, ctx.onlinePaymentsEnabled).includes(input.paymentMethod)) {
    errors.push({ code: 'payment_unavailable' });
  }

  // When: ASAP only while taking orders; otherwise a valid time inside opening hours.
  const prepMinutes =
    input.type === 'delivery' ? restaurant.prepMinutes.delivery : restaurant.prepMinutes.pickup;
  let scheduledFor: Date | null = null;
  if (input.when.kind === 'asap') {
    if (!getOpenState(now, restaurant.schedule).acceptingOrders)
      errors.push({ code: 'closed_now' });
  } else {
    scheduledFor = new Date(input.when.at);
    const ok = isSchedulableTime(scheduledFor, now, restaurant.schedule, {
      leadMinutes: prepMinutes,
      daysAhead: restaurant.scheduleDaysAhead,
    });
    if (!ok) errors.push({ code: 'invalid_time' });
  }

  // Delivery zone: checked when we have a location. Without one, staff confirm the address.
  let zone: ReturnType<typeof findDeliveryZone> = null;
  if (input.type === 'delivery' && input.location && restaurant.zones.length > 0) {
    zone = findDeliveryZone(input.location, restaurant.location, restaurant.zones);
    if (!zone) errors.push({ code: 'outside_zone' });
  }

  const priced = priceOrder({
    lines: input.lines,
    menu: new Map(ctx.menu.items.map((i) => [i.slug, i])),
    orderType: input.type,
    fees: restaurant.fees,
    zone: zone ? { feeTetri: zone.zone.feeTetri, minOrderTetri: zone.zone.minOrderTetri } : null,
  });
  for (const problem of priced.problems) errors.push({ code: problem.code, detail: problem });

  if (errors.length > 0 || !phone) return { ok: false, errors };

  const readyAt = scheduledFor ?? new Date(now.getTime() + prepMinutes * 60_000);
  return {
    ok: true,
    order: {
      type: input.type,
      customer_name: input.name.trim(),
      customer_phone: phone,
      customer_locale: input.locale,
      address_text: input.type === 'delivery' ? input.addressText?.trim() || null : null,
      address_lat: input.type === 'delivery' ? (input.location?.lat ?? null) : null,
      address_lng: input.type === 'delivery' ? (input.location?.lng ?? null) : null,
      delivery_zone_id: zone?.zone.id ?? null,
      distance_km: zone?.distanceKm ?? null,
      scheduled_for: scheduledFor?.toISOString() ?? null,
      prep_minutes: prepMinutes,
      estimated_ready_at: readyAt.toISOString(),
      notes: input.notes?.trim() || null,
      subtotal_tetri: priced.subtotalTetri,
      delivery_fee_tetri: priced.deliveryFeeTetri,
      discount_tetri: priced.discountTetri,
      total_tetri: priced.totalTetri,
      payment_method: input.paymentMethod,
    },
    items: priced.lines.map(toDraftItem),
  };
}
