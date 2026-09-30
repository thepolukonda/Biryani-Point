/**
 * Order text for people: the WhatsApp message (same English kitchen format as the
 * prototype) and the Telegram/email notification.
 */
import { pickText, type I18nText } from '@/lib/domain/i18n-text';
import { formatAmount } from '@/lib/domain/money';
import type { BusinessProfile } from '@/lib/domain/restaurant';
import { mapPinUrl } from '@/lib/links';

export type OrderForText = {
  orderNumber: number;
  type: 'delivery' | 'pickup';
  customerName: string;
  customerPhone: string;
  customerLocale: string;
  addressText: string | null;
  location: { lat: number; lng: number } | null;
  scheduledFor: string | null;
  notes: string | null;
  subtotalTetri: number;
  deliveryFeeTetri: number;
  totalTetri: number;
  paymentMethod: string;
  items: {
    name: I18nText;
    quantity: number;
    lineTotalTetri: number;
    modifiers: { option: I18nText }[];
    notes: string | null;
  }[];
  trackingUrl?: string;
};

/** "BP-1042": the order number with the prefix from the business profile. */
export const orderLabel = (prefix: string, n: number) => `${prefix}-${n}`;

/** The restaurant details the order texts need. */
export type ShopForText = { timezone: string; profile: BusinessProfile };

const LANGUAGE = { ka: 'Georgian', ru: 'Russian' } as const;
const PAYMENT: Record<string, string> = {
  cash: 'Cash on delivery',
  pay_at_pickup: 'Pay at pickup',
  online: 'Paid online',
};

function when(scheduledFor: string | null, timezone: string) {
  if (!scheduledFor) return 'As soon as possible';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(scheduledFor));
}

function itemLines(order: OrderForText, bullet: string) {
  return order.items.map((item) => {
    const options = item.modifiers.map((m) => pickText(m.option, 'en')).join(', ');
    const note = item.notes ? ` (note: ${item.notes})` : '';
    return `${bullet}${item.quantity} × ${pickText(item.name, 'en')}${options ? ` [${options}]` : ''}  GEL ${formatAmount(item.lineTotalTetri)}${note}`;
  });
}

/** Plain text in English so the kitchen always reads the same format (like the prototype). */
export function whatsappOrderText(order: OrderForText, shop: ShopForText): string {
  const { timezone, profile } = shop;
  return [
    `*New order ${orderLabel(profile.orderPrefix, order.orderNumber)}: ${pickText(profile.siteName, 'en')}*`,
    '',
    ...itemLines(order, '• '),
    '',
    order.deliveryFeeTetri ? `Subtotal: GEL ${formatAmount(order.subtotalTetri)}` : null,
    order.deliveryFeeTetri ? `Delivery: GEL ${formatAmount(order.deliveryFeeTetri)}` : null,
    `*Total: GEL ${formatAmount(order.totalTetri)}*`,
    '',
    `Name: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
    `Type: ${order.type === 'delivery' ? 'Delivery' : 'Pickup'}`,
    order.type === 'delivery' && order.addressText ? `Address: ${order.addressText}` : null,
    order.type === 'delivery' && order.location ? `Location: ${mapPinUrl(order.location)}` : null,
    `When: ${when(order.scheduledFor, timezone)}`,
    `Payment: ${PAYMENT[order.paymentMethod] ?? order.paymentMethod}`,
    order.notes ? `Notes: ${order.notes}` : null,
    order.customerLocale in LANGUAGE
      ? `Customer language: ${LANGUAGE[order.customerLocale as keyof typeof LANGUAGE]}`
      : null,
    order.trackingUrl ? `Track: ${order.trackingUrl}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Telegram message (HTML parse mode). */
export function telegramOrderText(
  order: OrderForText,
  shop: ShopForText,
  adminUrl: string,
): string {
  const e = escapeHtml;
  const { timezone, profile } = shop;
  return [
    `🛎 <b>New order ${orderLabel(profile.orderPrefix, order.orderNumber)}</b> · ${order.type === 'delivery' ? '🛵 Delivery' : '🏪 Pickup'}`,
    `⏰ ${e(when(order.scheduledFor, timezone))}`,
    '',
    ...itemLines(order, '• ').map(e),
    '',
    `<b>Total: GEL ${formatAmount(order.totalTetri)}</b> (${e(PAYMENT[order.paymentMethod] ?? order.paymentMethod)})`,
    '',
    `👤 ${e(order.customerName)} · <a href="tel:${order.customerPhone}">${order.customerPhone}</a>`,
    order.type === 'delivery' && order.addressText ? `📍 ${e(order.addressText)}` : null,
    order.type === 'delivery' && order.location
      ? `🗺 <a href="${mapPinUrl(order.location)}">Map pin</a>`
      : null,
    order.notes ? `📝 ${e(order.notes)}` : null,
    '',
    `<a href="${e(adminUrl)}">Open the kitchen board</a>`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}
