'use client';

/** Browser-side controller for the order tracking page: live status and fallback polling. */
import type { PublicOrder } from '@/model-helpers/orders/public-order';
import { watchOrder } from '@/model-helpers/browser/live';

export { watchOrder };

/** The latest public view of the order, or null when offline. */
export async function fetchTrackedOrder(publicId: string): Promise<PublicOrder | null> {
  try {
    const response = await fetch(`/api/orders/${publicId}`, { cache: 'no-store' });
    return response.ok ? ((await response.json()) as PublicOrder) : null;
  } catch {
    return null;
  }
}
