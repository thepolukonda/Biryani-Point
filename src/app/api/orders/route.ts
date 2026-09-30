/**
 * POST /api/orders: the only way an order is created.
 * Validates, rate-limits, re-prices everything from the database and stores the
 * order in one transaction. The browser's totals are never used.
 */
import { after, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getMenuUncached, getRestaurantUncached } from '@/lib/data/restaurant';
import { siteUrl } from '@/lib/env';
import { reportError } from '@/lib/monitoring';
import { notifyNewOrder } from '@/lib/notify';
import { prepareOrder } from '@/lib/orders/prepare';
import { fieldErrors, orderRequestSchema } from '@/lib/orders/schema';
import { onlinePaymentsEnabled } from '@/lib/payments/registry';
import { clientIp, hashIp, newPublicId, sha256 } from '@/lib/request';
import { serviceClient } from '@/lib/supabase/clients';
import type { Json } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 32_000;
// Every attempt counts per device (stops bots); only orders that would go through count per
// phone, so a customer fixing a too-small cart or a missed time slot isn't locked out.
const LIMITS = {
  perIp: { windowSeconds: 600, max: 15 },
  perPhone: { windowSeconds: 600, max: 4 },
};

function error(status: number, code: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: code, ...extra }, { status });
}

export async function POST(request: Request) {
  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY_BYTES) return error(413, 'server');

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return error(413, 'server');
    body = JSON.parse(text);
  } catch {
    return error(400, 'invalid');
  }

  const parsed = orderRequestSchema.safeParse(body);
  if (!parsed.success) return error(400, 'invalid', { fields: fieldErrors(parsed.error) });
  const input = parsed.data;

  // Honeypot: people never see this field; bots fill it in.
  if (input.website) return error(400, 'invalid');

  const db = serviceClient();
  const ipHash = hashIp(clientIp(request.headers));

  try {
    const ipOk = await db.rpc('rate_limit_hit', {
      p_key: `order:ip:${ipHash}`,
      p_window_seconds: LIMITS.perIp.windowSeconds,
      p_max: LIMITS.perIp.max,
    });
    if (ipOk.error) throw ipOk.error;
    if (ipOk.data === false) return error(429, 'rate_limited');

    const now = new Date();
    const [menu, restaurant] = await Promise.all([getMenuUncached(now), getRestaurantUncached()]);
    const prepared = prepareOrder(input, {
      menu,
      restaurant,
      now,
      onlinePaymentsEnabled: onlinePaymentsEnabled(),
    });
    if (!prepared.ok) {
      // The browser's copy of the menu or settings is stale: refresh cached pages.
      if (
        prepared.errors.some((e) =>
          ['item_unavailable', 'item_not_found', 'orders_paused'].includes(e.code),
        )
      ) {
        revalidateTag('menu', 'max');
        revalidateTag('restaurant', 'max');
      }
      return error(422, 'rejected', { errors: prepared.errors });
    }

    const phoneOk = await db.rpc('rate_limit_hit', {
      p_key: `order:phone:${hashIp(input.phone.replace(/D/g, '').slice(-9))}`,
      p_window_seconds: LIMITS.perPhone.windowSeconds,
      p_max: LIMITS.perPhone.max,
    });
    if (phoneOk.error) throw phoneOk.error;
    if (phoneOk.data === false) return error(429, 'rate_limited');

    const { idempotencyKey, website: _honeypot, ...rest } = input;
    const publicId = newPublicId();
    const created = await db.rpc('create_order', {
      p_order: {
        ...prepared.order,
        public_id: publicId,
        idempotency_key: idempotencyKey,
        request_hash: sha256(JSON.stringify(rest)),
        client_ip_hash: ipHash,
      } as unknown as Json,
      p_items: prepared.items as unknown as Json,
    });
    if (created.error) throw created.error;

    const result = created.data as {
      duplicate: boolean;
      same_request: boolean;
      public_id: string;
      order_number: number;
    };
    if (result.duplicate && !result.same_request) return error(409, 'conflict');

    if (!result.duplicate) {
      after(() =>
        notifyNewOrder(
          {
            orderNumber: result.order_number,
            type: prepared.order.type,
            customerName: prepared.order.customer_name,
            customerPhone: prepared.order.customer_phone,
            customerLocale: prepared.order.customer_locale,
            addressText: prepared.order.address_text,
            location:
              prepared.order.address_lat !== null && prepared.order.address_lng !== null
                ? { lat: prepared.order.address_lat, lng: prepared.order.address_lng }
                : null,
            scheduledFor: prepared.order.scheduled_for,
            notes: prepared.order.notes,
            subtotalTetri: prepared.order.subtotal_tetri,
            deliveryFeeTetri: prepared.order.delivery_fee_tetri,
            totalTetri: prepared.order.total_tetri,
            paymentMethod: prepared.order.payment_method,
            items: prepared.items.map((i) => ({
              name: i.item_name,
              quantity: i.quantity,
              lineTotalTetri: i.line_total_tetri,
              modifiers: i.modifiers,
              notes: i.notes,
            })),
            trackingUrl: `${siteUrl}/${input.locale}/order/${result.public_id}`,
          },
          restaurant,
        ),
      );
    }

    return NextResponse.json(
      { publicId: result.public_id, orderNumber: result.order_number, duplicate: result.duplicate },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (e) {
    reportError(e, { where: 'POST /api/orders' });
    return error(500, 'server');
  }
}
