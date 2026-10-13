/**
 * Controller for POST /api/payments/<provider>/webhook: status updates from a card gateway.
 * Inactive until a provider is registered (see src/model-helpers/payments/README.md).
 */
import 'server-only';
import { NextResponse } from 'next/server';
import { reportError } from '@/shared/monitoring';
import { paymentProviderById } from '@/model-helpers/payments/registry';
import { applyWebhookEvent } from '@/model-helpers/payments/webhook';
import type { Json } from '@/models/db/core';

export async function receiveWebhook(request: Request, providerId: string) {
  const provider = paymentProviderById(providerId);
  if (!provider) return NextResponse.json({ error: 'unknown_provider' }, { status: 404 });

  const raw = await request.text();
  let event;
  try {
    event = await provider.parseWebhook(request, raw);
  } catch (e) {
    reportError(e, { where: 'payment webhook signature', provider: providerId });
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  try {
    const fresh = await applyWebhookEvent(providerId, event, JSON.parse(raw) as Json);
    return NextResponse.json(fresh ? { ok: true } : { ok: true, duplicate: true });
  } catch (e) {
    reportError(e, { where: 'payment webhook' });
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
}
