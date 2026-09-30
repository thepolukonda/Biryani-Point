import 'server-only';
import { siteUrl } from '@/lib/env';
import { isLocale, type I18nText, type Locale } from '@/lib/domain/i18n-text';
import type { Database } from '@/lib/supabase/database.types';
import { sessionClient } from '@/lib/supabase/session';
import { profileFromRow } from '@/lib/data/restaurant';
import type { BusinessProfile } from '@/lib/domain/restaurant';

type Tables = Database['public']['Tables'];
export type PrintSettings = Tables['print_settings']['Row'];
export type TicketKind = 'kot' | 'bill';

export type TicketItem = {
  name: I18nText;
  quantity: number;
  unitTetri: number;
  lineTotalTetri: number;
  modifiers: I18nText[];
  notes: string | null;
  veg: boolean;
  /** Which KOT round the dish was ordered in (1 = the first dishes). */
  kotRound: number;
};

export type TicketOrder = {
  id: string;
  number: number;
  type: 'delivery' | 'pickup' | 'dine_in';
  /** Taken by staff (table or takeaway) rather than on the website. */
  counter: boolean;
  tableLabel: string | null;
  kotRounds: number;
  createdAt: string;
  acceptedAt: string | null;
  prepMinutes: number | null;
  scheduledFor: string | null;
  estimatedReadyAt: string | null;
  customerName: string;
  customerPhone: string;
  customerLocale: Locale;
  addressText: string | null;
  hasPin: boolean;
  distanceKm: number | null;
  notes: string | null;
  subtotalTetri: number;
  deliveryFeeTetri: number;
  discountTetri: number;
  totalTetri: number;
  paymentMethod: Database['public']['Enums']['payment_method'];
  paid: boolean;
  trackingUrl: string;
  items: TicketItem[];
};

export type TicketContext = {
  order: TicketOrder;
  print: PrintSettings;
  restaurant: {
    phone: string;
    googleReviewUrl: string | null;
    timezone: string;
    profile: BusinessProfile;
  };
};

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  id: 1,
  legal_name: null,
  tax_id: null,
  legal_address: null,
  vat_registered: false,
  bill_footer: {},
  paper_width_mm: 80,
  kot_language: 'en',
  bill_language: 'customer',
  auto_print_kot: true,
  auto_print_bill: true,
  kot_copies: 1,
  bill_copies: 1,
  bill_show_phone: true,
  bill_show_qr: true,
  updated_at: new Date(0).toISOString(),
};

export async function loadPrintSettings(): Promise<PrintSettings> {
  const db = await sessionClient();
  const { data } = await db.from('print_settings').select('*').eq('id', 1).maybeSingle();
  return data ?? DEFAULT_PRINT_SETTINGS;
}

async function loadRestaurant(): Promise<TicketContext['restaurant']> {
  const db = await sessionClient();
  const { data, error } = await db.from('restaurant_settings').select('*').eq('id', 1).single();
  if (error) throw new Error(`Could not load restaurant settings: ${error.message}`);
  return {
    phone: data.phone,
    googleReviewUrl: data.google_review_url,
    timezone: data.timezone,
    profile: profileFromRow(data),
  };
}

/** Everything a ticket needs, read as the signed-in staff member (RLS applies). */
export async function loadTicket(orderId: string): Promise<TicketContext | null> {
  const db = await sessionClient();
  const [order, print, restaurant] = await Promise.all([
    db
      .from('orders')
      .select('*, order_items(*, menu_items(is_veg))')
      .eq('id', orderId)
      .maybeSingle(),
    loadPrintSettings(),
    loadRestaurant(),
  ]);
  const o = order.data;
  if (!o) return null;
  const locale = isLocale(o.customer_locale) ? o.customer_locale : 'en';
  return {
    print,
    restaurant,
    order: {
      id: o.id,
      number: o.order_number,
      type: o.type,
      counter: o.source === 'counter',
      tableLabel: o.table_label,
      kotRounds: o.kot_round,
      createdAt: o.created_at,
      acceptedAt: o.accepted_at,
      prepMinutes: o.prep_minutes,
      scheduledFor: o.scheduled_for,
      estimatedReadyAt: o.estimated_ready_at,
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      customerLocale: locale,
      addressText: o.address_text,
      hasPin: o.address_lat !== null && o.address_lng !== null,
      distanceKm: o.distance_km,
      notes: o.notes,
      subtotalTetri: o.subtotal_tetri,
      deliveryFeeTetri: o.delivery_fee_tetri,
      discountTetri: o.discount_tetri,
      totalTetri: o.total_tetri,
      paymentMethod: o.payment_method,
      paid: o.payment_status === 'paid',
      trackingUrl: `${siteUrl}/${locale}/order/${o.public_id}`,
      items: o.order_items
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((i) => ({
          name: i.item_name as I18nText,
          quantity: i.quantity,
          unitTetri: i.unit_price_tetri,
          lineTotalTetri: i.line_total_tetri,
          modifiers: (i.modifiers as { option: I18nText }[]).map((m) => m.option),
          notes: i.notes,
          veg: i.menu_items?.is_veg ?? false,
          kotRound: i.kot_round,
        })),
    },
  };
}

/** A made-up order for test prints and the preview on the Printers page. */
export async function sampleTicket(): Promise<TicketContext> {
  const [print, restaurant] = await Promise.all([loadPrintSettings(), loadRestaurant()]);
  const now = Date.now();
  const iso = (offsetMin: number) => new Date(now + offsetMin * 60_000).toISOString();
  const spicy = { en: 'Spicy', ka: 'ცხარე', ru: 'Остро' };
  const medium = { en: 'Medium', ka: 'საშუალო', ru: 'Средне' };
  const mild = { en: 'Mild', ka: 'მსუბუქი', ru: 'Не острое' };
  const items: TicketItem[] = [
    {
      name: { en: 'Chicken Biryani' },
      quantity: 2,
      unitTetri: 2000,
      lineTotalTetri: 4000,
      modifiers: [spicy],
      notes: null,
      veg: false,
      kotRound: 1,
    },
    {
      name: { en: 'Fry Pieces Biryani (Boneless)' },
      quantity: 1,
      unitTetri: 2200,
      lineTotalTetri: 2200,
      modifiers: [medium],
      notes: null,
      veg: false,
      kotRound: 1,
    },
    {
      name: { en: 'Veg Dum Biryani' },
      quantity: 1,
      unitTetri: 1800,
      lineTotalTetri: 1800,
      modifiers: [mild],
      notes: 'No onion',
      veg: true,
      kotRound: 1,
    },
    {
      name: { en: 'Chicken Noodles' },
      quantity: 2,
      unitTetri: 2000,
      lineTotalTetri: 4000,
      modifiers: [],
      notes: null,
      veg: false,
      kotRound: 1,
    },
  ];
  const subtotal = items.reduce((s, i) => s + i.lineTotalTetri, 0);
  return {
    print,
    restaurant,
    order: {
      id: 'sample',
      number: 1000,
      type: 'delivery',
      counter: false,
      tableLabel: null,
      kotRounds: 1,
      createdAt: iso(-3),
      acceptedAt: iso(0),
      prepMinutes: 25,
      scheduledFor: null,
      estimatedReadyAt: iso(25),
      customerName: 'Nino Beridze',
      customerPhone: '+995555123456',
      customerLocale: 'ka',
      addressText: 'Chavchavadze St 42, apt 7, 3rd floor',
      hasPin: true,
      distanceKm: 2.4,
      notes: 'Nut allergy! Please call on arrival.',
      subtotalTetri: subtotal,
      deliveryFeeTetri: 0,
      discountTetri: 0,
      totalTetri: subtotal,
      paymentMethod: 'cash',
      paid: false,
      trackingUrl: `${siteUrl}/ka/order/sample-order-preview-000`,
      items,
    },
  };
}
