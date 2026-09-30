import 'server-only';
import type { I18nText } from '@/lib/domain/i18n-text';
import { publicClient } from '@/lib/supabase/clients';

export type OrderStatus =
  | 'received'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'rejected'
  | 'cancelled';

/** What anyone with the tracking link may see (no phone, address or IP). */
export type PublicOrder = {
  public_id: string;
  order_number: number;
  status: OrderStatus;
  type: 'delivery' | 'pickup';
  customer_first_name: string;
  scheduled_for: string | null;
  estimated_ready_at: string | null;
  prep_minutes: number | null;
  subtotal_tetri: number;
  delivery_fee_tetri: number;
  discount_tetri: number;
  total_tetri: number;
  payment_method: 'cash' | 'pay_at_pickup' | 'online';
  payment_status: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  items: {
    name: I18nText;
    quantity: number;
    unit_price_tetri: number;
    line_total_tetri: number;
    modifiers: { group: I18nText; option: I18nText; group_slug: string; option_slug: string }[];
    notes: string | null;
  }[];
  events: { status: OrderStatus; at: string }[];
};

export const PUBLIC_ID_RE = /^[A-Za-z0-9_-]{20,40}$/;

export async function getPublicOrder(publicId: string): Promise<PublicOrder | null> {
  if (!PUBLIC_ID_RE.test(publicId)) return null;
  const { data, error } = await publicClient().rpc('get_public_order', { p_public_id: publicId });
  if (error) throw new Error(`Could not load order: ${error.message}`);
  return (data as PublicOrder | null) ?? null;
}
