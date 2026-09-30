import 'server-only';
import { serverEnv } from '@/lib/env.server';
import type { PaymentProvider } from './types';

/**
 * Register providers here when you add one, e.g.:
 *   import { bogProvider } from './providers/bog';
 *   const PROVIDERS = { bog: bogProvider };
 * Then set PAYMENT_PROVIDER=bog. Until then online payment is hidden at checkout.
 */
const PROVIDERS: Record<string, PaymentProvider> = {};

export function activePaymentProvider(): PaymentProvider | null {
  const id = serverEnv().PAYMENT_PROVIDER;
  return id ? (PROVIDERS[id] ?? null) : null;
}

export function paymentProviderById(id: string): PaymentProvider | null {
  return PROVIDERS[id] ?? null;
}

export const onlinePaymentsEnabled = () => activePaymentProvider() !== null;
