/** Applying a card gateway's status update to the payment and its order. */
import 'server-only';
import { reportError } from '@/shared/monitoring';
import { serviceDb, type Json } from '@/models/db';
import * as orders from '@/models/orders';
import * as payments from '@/models/payments';
import type { WebhookEvent } from './types';

/** Returns false for an event that was already handled (gateways retry webhooks). */
export async function applyWebhookEvent(
  provider: string,
  event: WebhookEvent,
  payload: Json,
): Promise<boolean> {
  const db = serviceDb();
  if (!(await payments.storeWebhookEvent(db, provider, event.eventId, payload))) return false;

  const payment = await payments.updateStatus(db, provider, event.providerPaymentId, event.status);
  if (payment) {
    if (event.status === 'paid' && event.amountTetri !== payment.amount_tetri) {
      reportError(new Error('Paid amount does not match'), { provider, event });
    } else {
      await orders.update(db, payment.order_id, { payment_status: event.status });
    }
  }
  await payments.markWebhookProcessed(db, provider, event.eventId);
  return true;
}
