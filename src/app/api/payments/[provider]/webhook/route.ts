/**
 * POST /api/payments/<provider>/webhook: status updates from a card gateway.
 * Inactive until a provider is registered (see src/lib/payments/README.md).
 */
import { NextResponse } from 'next/server';
import { reportError } from '@/lib/monitoring';
import { paymentProviderById } from '@/lib/payments/registry';
import { serviceClient } from '@/lib/supabase/clients';
import type { Json } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  ctx: RouteContext<'/api/payments/[provider]/webhook'>,
) {
  const { provider: id } = await ctx.params;
  const provider = paymentProviderById(id);
  if (!provider) return NextResponse.json({ error: 'unknown_provider' }, { status: 404 });

  const raw = await request.text();
  let event;
  try {
    event = await provider.parseWebhook(request, raw);
  } catch (e) {
    reportError(e, { where: 'payment webhook signature', provider: id });
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const db = serviceClient();
  // Store each event once; a retried webhook hits the unique constraint and stops here.
  const stored = await db.from('payment_webhook_events').insert({
    provider: id,
    event_id: event.eventId,
    payload: JSON.parse(raw) as NonNullable<Json>,
  });
  if (stored.error) {
    if (stored.error.code === '23505') return NextResponse.json({ ok: true, duplicate: true });
    reportError(stored.error, { where: 'payment webhook store' });
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }

  const payment = await db
    .from('payments')
    .update({ status: event.status })
    .eq('provider', id)
    .eq('provider_payment_id', event.providerPaymentId)
    .select('order_id, amount_tetri')
    .maybeSingle();
  if (payment.data) {
    if (event.status === 'paid' && event.amountTetri !== payment.data.amount_tetri) {
      reportError(new Error('Paid amount does not match'), { provider: id, event });
    } else {
      await db
        .from('orders')
        .update({ payment_status: event.status })
        .eq('id', payment.data.order_id);
    }
  }
  await db
    .from('payment_webhook_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('provider', id)
    .eq('event_id', event.eventId);

  return NextResponse.json({ ok: true });
}
