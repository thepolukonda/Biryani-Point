/**
 * Payment provider interface for a future Georgian card gateway (Bank of Georgia
 * iPay, TBC Pay, ...). Nothing is wired to a real provider; see ./README.md.
 */
import type { Tetri } from '@/lib/domain/money';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type CreatePaymentInput = {
  orderId: string;
  orderNumber: number;
  publicId: string;
  amountTetri: Tetri;
  currency: 'GEL';
  locale: 'en' | 'ka' | 'ru';
  /** Where the bank sends the customer back after paying. */
  returnUrl: string;
  /** Where the bank sends server-to-server status updates. */
  webhookUrl: string;
};

export type CreatePaymentResult = {
  providerPaymentId: string;
  /** Send the customer here to pay. */
  redirectUrl: string;
};

export type WebhookEvent = {
  /** Unique per event, so a retried webhook is processed once. */
  eventId: string;
  providerPaymentId: string;
  status: PaymentStatus;
  amountTetri: Tetri;
};

export interface PaymentProvider {
  /** Short id used in URLs and the database, e.g. "bog" or "tbc". */
  readonly id: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /**
   * Check the webhook really came from the provider (signature / shared secret)
   * and translate it. Throw if the signature is wrong.
   */
  parseWebhook(request: Request, rawBody: string): Promise<WebhookEvent>;
  refund?(providerPaymentId: string, amountTetri: Tetri): Promise<void>;
}
