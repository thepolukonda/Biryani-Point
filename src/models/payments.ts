/** Model: card payments and the gateway webhook log (service client only). */
import { check, DbError, type Db, type Enums, type Json } from './db/core';

/** Stores a webhook event once. False when it was already stored (a retried webhook). */
export async function storeWebhookEvent(
  db: Db,
  provider: string,
  eventId: string,
  payload: Json,
): Promise<boolean> {
  const result = await db
    .from('payment_webhook_events')
    .insert({ provider, event_id: eventId, payload: payload ?? {} });
  if (!result.error) return true;
  if (result.error.code === '23505') return false;
  throw new DbError('payments.storeWebhookEvent', result.error);
}

export async function markWebhookProcessed(db: Db, provider: string, eventId: string) {
  const result = await db
    .from('payment_webhook_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('provider', provider)
    .eq('event_id', eventId);
  check(result, 'payments.markWebhookProcessed');
}

/** Sets a payment's status; returns its order and amount, or null when unknown. */
export async function updateStatus(
  db: Db,
  provider: string,
  providerPaymentId: string,
  status: Enums['payment_status'],
) {
  const result = await db
    .from('payments')
    .update({ status })
    .eq('provider', provider)
    .eq('provider_payment_id', providerPaymentId)
    .select('order_id, amount_tetri')
    .maybeSingle();
  check(result, 'payments.updateStatus');
  return result.data;
}
