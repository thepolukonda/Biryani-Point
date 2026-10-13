/**
 * New-order notifications. Each channel is optional and turns on when its
 * environment variables are set. A failing channel never affects the order.
 */
import 'server-only';
import { serverEnv } from '@/config/env.server';
import { siteUrl } from '@/config/env';
import { reportError } from '@/shared/monitoring';
import {
  orderLabel,
  telegramOrderText,
  whatsappOrderText,
  type OrderForText,
  type ShopForText,
} from '@/shared/orders/format';
import { getRestaurant } from '@/model-helpers/restaurant';

async function sendTelegram(text: string) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = serverEnv();
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Telegram ${response.status}: ${await response.text()}`);
}

async function sendEmail(subject: string, text: string) {
  const { RESEND_API_KEY, ORDER_EMAIL_FROM, ORDER_EMAIL_TO } = serverEnv();
  if (!RESEND_API_KEY || !ORDER_EMAIL_FROM || !ORDER_EMAIL_TO) return;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: ORDER_EMAIL_FROM,
      to: ORDER_EMAIL_TO.split(',').map((s) => s.trim()),
      subject,
      text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
}

export async function notifyNewOrder(order: OrderForText, shop: ShopForText): Promise<void> {
  const adminUrl = `${siteUrl}/admin`;
  const results = await Promise.allSettled([
    sendTelegram(telegramOrderText(order, shop, adminUrl)),
    sendEmail(
      `New order ${orderLabel(shop.profile.orderPrefix, order.orderNumber)} · GEL ${(order.totalTetri / 100).toFixed(2)}`,
      `${whatsappOrderText(order, shop)}\n\nKitchen board: ${adminUrl}`,
    ),
  ]);
  for (const result of results) {
    if (result.status === 'rejected') reportError(result.reason, { where: 'notifyNewOrder' });
  }
}

export function notificationsConfigured() {
  const env = serverEnv();
  return {
    telegram: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
    email: Boolean(env.RESEND_API_KEY && env.ORDER_EMAIL_FROM && env.ORDER_EMAIL_TO),
  };
}

export async function sendTestNotification(): Promise<{ telegram: string; email: string }> {
  const out = { telegram: 'not configured', email: 'not configured' };
  const configured = notificationsConfigured();
  const { brandName } = (await getRestaurant()).profile;
  if (configured.telegram) {
    out.telegram = await sendTelegram(
      `✅ Test message from the ${brandName} website. New orders will appear here.`,
    )
      .then(() => 'sent')
      .catch((e: Error) => `failed: ${e.message}`);
  }
  if (configured.email) {
    out.email = await sendEmail(
      `Test from the ${brandName} website`,
      'New orders will be emailed to this address.',
    )
      .then(() => 'sent')
      .catch((e: Error) => `failed: ${e.message}`);
  }
  return out;
}
