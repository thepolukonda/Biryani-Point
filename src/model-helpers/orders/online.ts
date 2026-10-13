/**
 * Placing a website order: rate limits, pricing everything again from the database, and
 * storing the order in one transaction. The browser's totals are never used.
 */
import 'server-only';
import { siteUrl } from '@/config/env';
import type { OrderRequest } from '@/shared/orders/schema';
import { hashIp, newPublicId, sha256 } from '@/shared/request';
import { serviceDb, type Json } from '@/models/db';
import * as orders from '@/models/orders';
import * as rateLimits from '@/models/rate-limits';
import { notifyNewOrder } from '../notify';
import { onlinePaymentsEnabled } from '../payments/registry';
import { getMenuUncached, getRestaurantUncached } from '../restaurant';
import { prepareOrder, type OrderError } from './prepare';

// Every attempt counts per device (stops bots); only orders that would go through count per
// phone, so a customer fixing a too-small cart or a missed time slot isn't locked out.
const LIMITS = {
  perIp: { windowSeconds: 600, max: 15 },
  perPhone: { windowSeconds: 600, max: 4 },
};

/** Problems that mean the visitor's copy of the menu or settings is out of date. */
const STALE_CODES = new Set(['item_unavailable', 'item_not_found', 'orders_paused']);

export type PlaceOrderResult =
  | {
      ok: true;
      publicId: string;
      orderNumber: number;
      duplicate: boolean;
      /** Sends the kitchen notifications; run it after the response (none for a duplicate). */
      announce: (() => Promise<void>) | null;
    }
  | { ok: false; reason: 'rate_limited' }
  | { ok: false; reason: 'conflict' }
  | { ok: false; reason: 'rejected'; errors: OrderError[]; menuIsStale: boolean };

export async function placeOrder(input: OrderRequest, clientIp: string): Promise<PlaceOrderResult> {
  const db = serviceDb();
  const ipHash = hashIp(clientIp);

  const { perIp, perPhone } = LIMITS;
  if (!(await rateLimits.hit(db, `order:ip:${ipHash}`, perIp.windowSeconds, perIp.max)))
    return { ok: false, reason: 'rate_limited' };

  const now = new Date();
  const [menu, restaurant] = await Promise.all([getMenuUncached(now), getRestaurantUncached()]);
  const prepared = prepareOrder(input, {
    menu,
    restaurant,
    now,
    onlinePaymentsEnabled: onlinePaymentsEnabled(),
  });
  if (!prepared.ok) {
    return {
      ok: false,
      reason: 'rejected',
      errors: prepared.errors,
      menuIsStale: prepared.errors.some((e) => STALE_CODES.has(e.code)),
    };
  }

  const phoneKey = `order:phone:${hashIp(input.phone.replace(/\D/g, '').slice(-9))}`;
  if (!(await rateLimits.hit(db, phoneKey, perPhone.windowSeconds, perPhone.max)))
    return { ok: false, reason: 'rate_limited' };

  const { idempotencyKey, website: _honeypot, ...rest } = input;
  const created = await orders.createOnline(
    db,
    {
      ...prepared.order,
      public_id: newPublicId(),
      idempotency_key: idempotencyKey,
      request_hash: sha256(JSON.stringify(rest)),
      client_ip_hash: ipHash,
    } as unknown as Json,
    prepared.items as unknown as Json,
  );
  if (created.duplicate && !created.same_request) return { ok: false, reason: 'conflict' };

  const { order, items } = prepared;
  const announce = created.duplicate
    ? null
    : () =>
        notifyNewOrder(
          {
            orderNumber: created.order_number,
            type: order.type,
            customerName: order.customer_name,
            customerPhone: order.customer_phone,
            customerLocale: order.customer_locale,
            addressText: order.address_text,
            location:
              order.address_lat !== null && order.address_lng !== null
                ? { lat: order.address_lat, lng: order.address_lng }
                : null,
            scheduledFor: order.scheduled_for,
            notes: order.notes,
            subtotalTetri: order.subtotal_tetri,
            deliveryFeeTetri: order.delivery_fee_tetri,
            totalTetri: order.total_tetri,
            paymentMethod: order.payment_method,
            items: items.map((i) => ({
              name: i.item_name,
              quantity: i.quantity,
              lineTotalTetri: i.line_total_tetri,
              modifiers: i.modifiers,
              notes: i.notes,
            })),
            trackingUrl: `${siteUrl}/${input.locale}/order/${created.public_id}`,
          },
          restaurant,
        );

  return {
    ok: true,
    publicId: created.public_id,
    orderNumber: created.order_number,
    duplicate: created.duplicate,
    announce,
  };
}
