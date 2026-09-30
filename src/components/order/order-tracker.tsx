'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useShop } from '@/components/providers/shop-provider';
import { Button, ButtonAnchor, ButtonLink } from '@/components/ui/button';
import { CheckIcon, PhoneIcon, ShareIcon, WhatsAppIcon } from '@/components/ui/icons';
import { readJson } from '@/lib/browser-storage';
import { cn } from '@/lib/cn';
import type { OrderStatus, PublicOrder } from '@/lib/data/public-order';
import { zonedParts } from '@/lib/domain/hours';
import { pickText, type Locale } from '@/lib/domain/i18n-text';
import { formatGel } from '@/lib/domain/money';
import { siteUrl } from '@/lib/env';
import { useHydrated } from '@/lib/hooks';
import { whatsappUrl } from '@/lib/links';
import { orderLabel, whatsappOrderText } from '@/lib/orders/format';
import { localDetailsKey, type LocalOrderDetails } from '@/lib/orders/local';
import { browserClient } from '@/lib/supabase/browser';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const FINAL: OrderStatus[] = ['completed', 'rejected', 'cancelled'];

function steps(type: PublicOrder['type']): OrderStatus[] {
  return type === 'delivery'
    ? ['received', 'accepted', 'preparing', 'out_for_delivery', 'completed']
    : ['received', 'accepted', 'preparing', 'ready', 'completed'];
}

export function OrderTracker({ initial }: { initial: PublicOrder }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const params = useSearchParams();
  const { restaurant } = useShop();
  const [order, setOrder] = useState(initial);
  const [live, setLive] = useState(false);
  const [copied, setCopied] = useState(false);
  const hydrated = useHydrated();
  const details = hydrated
    ? readJson<LocalOrderDetails | null>(localDetailsKey(initial.public_id), null)
    : null;
  const isNew = params.get('new') === '1';
  const final = FINAL.includes(order.status);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/orders/${initial.public_id}`, { cache: 'no-store' });
      if (response.ok) setOrder((await response.json()) as PublicOrder);
    } catch {
      // Offline: keep showing the last known state.
    }
  }, [initial.public_id]);

  // Live updates: the database broadcasts every status change on this order's private channel name.
  useEffect(() => {
    if (final) return;
    const channel = browserClient()
      .channel(`order:${initial.public_id}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'status' }, () => void refresh())
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    // Fallback: poll every 30 s and whenever the tab comes back into view.
    const poll = window.setInterval(() => void refresh(), 30_000);
    const onVisible = () => document.visibilityState === 'visible' && void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      void browserClient().removeChannel(channel);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [initial.public_id, final, refresh]);

  // Built from plain parts (not Intl text) so the server and browser render identical HTML.
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = (iso: string) => {
    const p = zonedParts(new Date(iso), restaurant.timezone);
    return `${pad(p.hour)}:${pad(p.minute)}`;
  };
  const dayTime = (iso: string) => {
    const p = zonedParts(new Date(iso), restaurant.timezone);
    return `${t(`days.${WEEKDAYS[p.weekday - 1]}`)} ${pad(p.day)}.${pad(p.month)}, ${pad(p.hour)}:${pad(p.minute)}`;
  };

  const label = orderLabel(restaurant.profile.orderPrefix, order.order_number);
  // Built from the site address, so the server and browser render the same link.
  const url = `${siteUrl}/${locale}/order/${initial.public_id}`;
  const flow = steps(order.type);
  const reached = new Set(order.events.map((e) => e.status));
  const currentIndex = flow.indexOf(order.status);

  const share = async () => {
    const data = {
      title: t('track.title', { number: label }),
      text: t('track.shareText', { number: label, name: restaurant.profile.brandName }),
      url,
    };
    if (navigator.share) {
      await navigator.share(data).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  const fullWhatsapp =
    details &&
    whatsappOrderText(
      {
        orderNumber: order.order_number,
        type: order.type,
        customerName: details.name,
        customerPhone: details.phone,
        customerLocale: locale,
        addressText: details.addressText,
        location: details.location,
        scheduledFor: order.scheduled_for,
        notes: details.notes,
        subtotalTetri: order.subtotal_tetri,
        deliveryFeeTetri: order.delivery_fee_tetri,
        totalTetri: order.total_tetri,
        paymentMethod: order.payment_method,
        items: order.items.map((i) => ({ ...i, lineTotalTetri: i.line_total_tetri })),
        trackingUrl: url,
      },
      restaurant,
    );

  const rejected = order.status === 'rejected' || order.status === 'cancelled';

  return (
    <div className="mx-auto grid w-[min(760px,100%-32px)] gap-6 py-8 md:py-12">
      <header className="text-center">
        {isNew && (
          <span className="bg-ok-soft text-ok mx-auto mb-4 grid size-18 place-items-center rounded-full [&_svg]:size-8">
            <CheckIcon />
          </span>
        )}
        {isNew && (
          <p className="text-lg font-semibold">
            {t('track.thanks', { name: order.customer_first_name })}
          </p>
        )}
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-4xl">
          {t('track.title', { number: label })}
        </h1>
        <p className="text-muted mt-1 text-sm">
          {t('track.placedAt', { time: dayTime(order.created_at) })}
        </p>
      </header>

      {/* Status */}
      <section
        aria-labelledby="status-title"
        className={cn('shadow-card rounded-2xl p-6', rejected ? 'bg-danger-soft' : 'bg-surface')}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div aria-live="polite" aria-atomic="true">
            <h2
              id="status-title"
              className={cn('text-2xl font-extrabold', rejected && 'text-danger')}
            >
              {order.status === 'completed' && order.type === 'delivery'
                ? t('track.delivered')
                : t(`track.status.${order.status}`)}
            </h2>
            <p className={cn('mt-1', rejected ? 'text-danger' : 'text-muted')}>
              {t(`track.detail.${order.status}`)}
            </p>
            {rejected && order.rejection_reason && (
              <p className="text-danger mt-2 font-semibold">
                {t('track.reason', { reason: order.rejection_reason })}
              </p>
            )}
            {!final && order.estimated_ready_at && (
              <p className="mt-3 text-lg font-bold">
                {order.scheduled_for
                  ? t('track.scheduledFor', { time: dayTime(order.scheduled_for) })
                  : t(order.type === 'delivery' ? 'track.etaDelivery' : 'track.etaPickup', {
                      time: time(order.estimated_ready_at),
                    })}
              </p>
            )}
          </div>
          {!final && (
            <span className="bg-soft text-muted inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
              <span
                aria-hidden
                className={cn('size-2 rounded-full', live ? 'bg-veg' : 'bg-faint')}
              />
              {live ? t('track.live') : t('track.offline')}
            </span>
          )}
        </div>

        {!rejected && (
          <ol className="mt-6 grid gap-0">
            {flow.map((step, i) => {
              const done = reached.has(step) || i < currentIndex;
              const current = step === order.status;
              const at = order.events.find((e) => e.status === step)?.at;
              return (
                <li key={step} className="relative flex gap-4 pb-5 last:pb-0">
                  {i < flow.length - 1 && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute top-8 left-[15px] h-[calc(100%-2rem)] w-0.5',
                        done && i < currentIndex ? 'bg-gold' : 'bg-line',
                      )}
                    />
                  )}
                  <span
                    aria-hidden
                    className={cn(
                      'relative grid size-8 shrink-0 place-items-center rounded-full border-2 text-sm font-bold [&_svg]:size-4',
                      done
                        ? 'border-gold bg-gold text-on-gold'
                        : 'border-line bg-surface text-muted',
                      current && !final && 'ring-gold/25 ring-4',
                    )}
                  >
                    {done ? <CheckIcon /> : i + 1}
                  </span>
                  <div className="pt-1">
                    <p className={cn('font-semibold', !done && 'text-muted')}>
                      {step === 'completed' && order.type === 'delivery'
                        ? t('track.delivered')
                        : t(`track.status.${step}`)}
                      <span className="sr-only">{done ? ' ✓' : ''}</span>
                    </p>
                    {at && done && <p className="tabular text-muted text-sm">{time(at)}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Contact & share */}
      <section className="bg-surface shadow-card grid gap-3 rounded-2xl p-6">
        <p className="text-muted text-sm">{t('track.keepPage')}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void share()}>
            <ShareIcon />
            {copied ? t('track.copied') : t('track.share')}
          </Button>
          <ButtonAnchor
            variant="whatsapp"
            href={whatsappUrl(
              restaurant.whatsapp,
              `${t('track.waGreeting', { number: label })}\n${url}`,
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon />
            {t('track.whatsappAbout')}
          </ButtonAnchor>
          <ButtonAnchor variant="soft" href={`tel:${restaurant.phone}`}>
            <PhoneIcon />
            {t('track.call')}
          </ButtonAnchor>
        </div>
        {fullWhatsapp && !final && (
          <div className="bg-soft mt-2 rounded-lg p-4">
            <ButtonAnchor
              variant="outline"
              href={whatsappUrl(restaurant.whatsapp, fullWhatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <WhatsAppIcon />
              {t('track.whatsappSend')}
            </ButtonAnchor>
            <p className="text-muted mt-2 text-sm">{t('track.whatsappHint')}</p>
          </div>
        )}
      </section>

      {/* Items */}
      <section aria-labelledby="items-title" className="bg-surface shadow-card rounded-2xl p-6">
        <h2 id="items-title" className="mb-3 text-lg font-bold">
          {t('track.items')}
        </h2>
        <ul className="grid gap-2.5">
          {order.items.map((item, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span>
                {item.quantity} × {pickText(item.name, locale)}
                {item.modifiers.length > 0 && (
                  <span className="text-muted block text-sm">
                    {item.modifiers.map((m) => pickText(m.option, locale)).join(' · ')}
                  </span>
                )}
                {item.notes && (
                  <span className="text-muted block text-sm italic">{item.notes}</span>
                )}
              </span>
              <span className="tabular shrink-0">{formatGel(item.line_total_tetri, locale)}</span>
            </li>
          ))}
        </ul>
        <dl className="border-line mt-4 grid gap-1 border-t pt-3">
          <div className="text-muted flex justify-between">
            <dt>{t('cart.subtotal')}</dt>
            <dd className="tabular">{formatGel(order.subtotal_tetri, locale)}</dd>
          </div>
          {order.type === 'delivery' && (
            <div className="text-muted flex justify-between">
              <dt>{t('cart.deliveryFee')}</dt>
              <dd className="tabular">
                {order.delivery_fee_tetri
                  ? formatGel(order.delivery_fee_tetri, locale)
                  : t('common.free')}
              </dd>
            </div>
          )}
          <div className="flex justify-between pt-1 text-lg font-extrabold">
            <dt>{t('cart.total')}</dt>
            <dd className="tabular">{formatGel(order.total_tetri, locale)}</dd>
          </div>
          <div className="text-muted flex justify-between pt-1 text-sm">
            <dt>{t('track.payment')}</dt>
            <dd>
              {t(
                order.payment_method === 'cash'
                  ? 'checkout.payCash'
                  : order.payment_method === 'pay_at_pickup'
                    ? 'checkout.payAtPickup'
                    : 'checkout.payOnline',
              )}
              {' · '}
              {order.payment_status === 'paid' ? t('track.paid') : t('track.unpaid')}
            </dd>
          </div>
        </dl>
      </section>

      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink href="/menu" variant="soft">
          {t('track.backToMenu')}
        </ButtonLink>
      </div>
    </div>
  );
}
