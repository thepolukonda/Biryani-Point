/**
 * Controller for the order API.
 *   POST /api/orders              the only way a website order is created
 *   GET  /api/orders/<publicId>   the public view of one order (tracking page polling)
 */
import 'server-only';
import { revalidateTag } from 'next/cache';
import { after, NextResponse } from 'next/server';
import { reportError } from '@/shared/monitoring';
import { fieldErrors, orderRequestSchema } from '@/shared/orders/schema';
import { clientIp } from '@/shared/request';
import { placeOrder } from '@/model-helpers/orders/online';
import { getPublicOrder } from '@/model-helpers/orders/public-order';

const MAX_BODY_BYTES = 32_000;

function error(status: number, code: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: code, ...extra }, { status });
}

export async function createOrder(request: Request) {
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
  // Honeypot: people never see this field; bots fill it in.
  if (parsed.data.website) return error(400, 'invalid');

  try {
    const result = await placeOrder(parsed.data, clientIp(request.headers));
    if (!result.ok) {
      if (result.reason === 'rate_limited') return error(429, 'rate_limited');
      if (result.reason === 'conflict') return error(409, 'conflict');
      // The browser's copy of the menu or settings is stale: refresh cached pages.
      if (result.menuIsStale) {
        revalidateTag('menu', 'max');
        revalidateTag('restaurant', 'max');
      }
      return error(422, 'rejected', { errors: result.errors });
    }
    if (result.announce) after(result.announce);
    return NextResponse.json(
      { publicId: result.publicId, orderNumber: result.orderNumber, duplicate: result.duplicate },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (e) {
    reportError(e, { where: 'POST /api/orders' });
    return error(500, 'server');
  }
}

export async function showOrder(publicId: string) {
  const order = await getPublicOrder(publicId);
  if (!order) return error(404, 'not_found');
  return NextResponse.json(order, { headers: { 'cache-control': 'no-store' } });
}
