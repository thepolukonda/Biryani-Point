'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { CartSummary, OrderTypeToggle, useCanCheckout } from '@/components/cart/cart-summary';
import { optionSummary } from '@/components/cart/cart-lines';
import { useCart, useCartPricing, useShop } from '@/components/providers/shop-provider';
import { useOpenLabel, useOpenText } from '@/components/restaurant/open-status';
import { Button, ButtonLink } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { BagIcon } from '@/components/ui/icons';
import { Link, useRouter } from '@/i18n/navigation';
import { readJson, removeKey, STORAGE_KEYS, writeJson } from '@/lib/browser-storage';
import { cartStore } from '@/lib/cart/store';
import { cn } from '@/lib/cn';
import { pickText, type Locale } from '@/lib/domain/i18n-text';
import { formatGel } from '@/lib/domain/money';
import { useHydrated } from '@/lib/hooks';
import { priceLine } from '@/lib/domain/pricing';
import { describeOpenState } from '@/lib/domain/open-label';
import { formatGeorgianPhone, normaliseCustomerPhone } from '@/lib/domain/phone';
import { localDetailsKey } from '@/lib/orders/local';
import type { OrderError } from '@/lib/orders/prepare';
import { fieldErrors, orderRequestSchema, type PaymentMethod } from '@/lib/orders/schema';
import { LocationField, type Location } from './location-field';
import { TimeField, type When } from './time-field';

type Saved = { name: string; phone: string; address: string };

function newKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function CheckoutForm({ onlinePayments }: { onlinePayments: boolean }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const cart = useCart();
  const pricing = useCartPricing();
  const { restaurant, itemsBySlug } = useShop();
  const open = useOpenLabel(
    restaurant.schedule,
    describeOpenState(new Date(), restaurant.schedule),
  );
  const openText = useOpenText(open);

  // Remembered details (prototype feature). Read once; the form only shows after hydration.
  const [saved] = useState(() => readJson<Saved | null>(STORAGE_KEYS.details, null));
  const [name, setName] = useState(saved?.name ?? '');
  const [phone, setPhone] = useState(saved?.phone ?? '');
  const [address, setAddress] = useState(saved?.address ?? '');
  const [location, setLocation] = useState<Location | null>(null);
  const [when, setWhen] = useState<When>({ kind: 'asap' });
  const [payOnline, setPayOnline] = useState(false);
  const [notes, setNotes] = useState('');
  const [remember, setRemember] = useState(true);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [timeAvailable, setTimeAvailable] = useState(true);
  const canCheckout = useCanCheckout();
  const hydrated = useHydrated();
  const idempotency = useRef<{ key: string; payload: string } | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const honeypotId = useId();

  const delivery = cart.orderType === 'delivery';
  // Cash for delivery, pay at pickup for pickup, unless the customer chose online payment.
  const payment: PaymentMethod =
    payOnline && onlinePayments ? 'online' : delivery ? 'cash' : 'pay_at_pickup';
  const paymentOptions: { value: PaymentMethod; label: string; hint: string }[] = [
    delivery
      ? { value: 'cash', label: t('checkout.payCash'), hint: t('checkout.payCashHint') }
      : {
          value: 'pay_at_pickup',
          label: t('checkout.payAtPickup'),
          hint: t('checkout.payAtPickupHint'),
        },
    ...(onlinePayments
      ? [{ value: 'online' as const, label: t('checkout.payOnline'), hint: '' }]
      : []),
  ];

  const errorText = (code: string | undefined) =>
    code
      ? t.has(`checkout.errors.${code}`)
        ? t(`checkout.errors.${code}`)
        : t('checkout.errors.invalid')
      : undefined;

  function describe(error: OrderError): string {
    const lineName = () => {
      const index = error.detail?.line;
      const line = index !== undefined ? cart.lines[index] : undefined;
      const item = line ? itemsBySlug.get(line.itemSlug) : undefined;
      return item ? pickText(item.name, locale) : '';
    };
    switch (error.code) {
      case 'below_minimum':
        return t('checkout.errors.below_minimum', {
          m: formatGel(error.detail?.minimumTetri ?? 0, locale),
          r: formatGel(error.detail?.shortByTetri ?? 0, locale),
        });
      case 'item_unavailable':
        return t('checkout.errors.item_unavailable', { n: lineName() });
      case 'invalid_quantity':
        return t('checkout.errors.invalid_quantity', { n: lineName() });
      case 'too_few_options':
      case 'too_many_options':
      case 'unknown_option':
      case 'option_unavailable':
      case 'duplicate_option':
        return t('checkout.errors.options', { n: lineName() });
      default:
        return errorText(error.code) ?? t('checkout.errors.server');
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setFormError('');

    const request = {
      locale,
      type: cart.orderType,
      name: name.trim(),
      phone: phone.trim(),
      ...(delivery && address.trim() ? { addressText: address.trim() } : {}),
      ...(delivery && location ? { location } : {}),
      when,
      paymentMethod: payment,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      lines: cart.lines.map((l) => ({
        itemSlug: l.itemSlug,
        quantity: l.quantity,
        options: l.options,
        ...(l.notes ? { notes: l.notes } : {}),
      })),
      ...(honeypot ? { website: honeypot } : {}),
    };

    // Same details as the last attempt = same key, so a double tap or a retry (even after a
    // reload) can never create a second order. Changed details = a new key.
    const payload = JSON.stringify(request);
    const previous =
      idempotency.current ??
      readJson<{ key: string; payload: string } | null>(STORAGE_KEYS.checkoutKey, null, 'session');
    idempotency.current = previous?.payload === payload ? previous : { key: newKey(), payload };
    writeJson(STORAGE_KEYS.checkoutKey, idempotency.current, 'session');
    const body = { ...request, idempotencyKey: idempotency.current.key };

    const parsed = orderRequestSchema.safeParse(body);
    if (!parsed.success) {
      const fields = fieldErrors(parsed.error);
      setErrors(fields);
      setFormError(fields.lines ? t('checkout.errors.empty_cart') : t('checkout.errors.fix'));
      const first = Object.keys(fields)[0];
      window.setTimeout(
        () => document.querySelector<HTMLElement>(`[name="${first}"]:not(:disabled)`)?.focus(),
        0,
      );
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as {
        publicId?: string;
        error?: string;
        errors?: OrderError[];
        fields?: Record<string, string>;
      };

      if (response.ok && data.publicId) {
        if (remember)
          writeJson(STORAGE_KEYS.details, { name: request.name, phone: request.phone, address });
        else removeKey(STORAGE_KEYS.details);
        writeJson(STORAGE_KEYS.lastOrder, { lines: request.lines, at: Date.now() });
        writeJson(localDetailsKey(data.publicId), {
          name: request.name,
          phone: normaliseCustomerPhone(request.phone) ?? request.phone,
          addressText: delivery ? address.trim() || null : null,
          location: delivery ? location : null,
          notes: notes.trim() || null,
        });
        const recent = readJson<string[]>(STORAGE_KEYS.recentOrders, []);
        writeJson(
          STORAGE_KEYS.recentOrders,
          [data.publicId, ...recent.filter((id) => id !== data.publicId)].slice(0, 10),
        );
        removeKey(STORAGE_KEYS.checkoutKey, 'session');
        idempotency.current = null;
        setPlaced(true);
        cartStore.clear();
        router.push(`/order/${data.publicId}?new=1`);
        return;
      }

      if (response.status === 400 && data.fields) {
        setErrors(data.fields);
        setFormError(t('checkout.errors.fix'));
      } else if (response.status === 422 && data.errors?.length) {
        setFormError([...new Set(data.errors.map(describe))].join(' '));
        if (data.errors.some((e) => e.code === 'invalid_time')) setErrors({ when: 'invalid_time' });
      } else if (response.status === 429) setFormError(t('checkout.errors.rate_limited'));
      else if (response.status === 409) setFormError(t('checkout.errors.conflict'));
      else setFormError(t('checkout.errors.server'));
    } catch {
      setFormError(t('checkout.errors.network'));
    } finally {
      setSubmitting(false);
    }
  }

  // Field problems move focus to the first bad field (done in submit); anything else to the message.
  useEffect(() => {
    if (formError && Object.keys(errors).length === 0) errorRef.current?.focus();
  }, [formError, errors]);

  if (placed) {
    return (
      <p role="status" className="py-24 text-center text-lg font-semibold">
        {t('checkout.placing')}
      </p>
    );
  }

  if (!hydrated) {
    // The cart lives in the browser: show a placeholder until it has been read, instead of
    // flashing "Nothing here yet" to someone with a full cart.
    return (
      <div role="status" aria-busy="true" className="grid animate-pulse gap-4 py-8">
        <span className="sr-only">{t('common.loading')}</span>
        <div className="bg-soft h-9 w-48 rounded-md" />
        <div className="bg-soft h-40 rounded-2xl" />
        <div className="bg-soft h-40 rounded-2xl" />
      </div>
    );
  }

  if (pricing.count === 0 && !submitting) {
    return (
      <div className="grid justify-items-center gap-2 py-20 text-center">
        <span className="bg-soft text-faint grid size-19 place-items-center rounded-full [&_svg]:size-8">
          <BagIcon />
        </span>
        <h1 className="text-2xl font-extrabold">{t('cart.emptyTitle')}</h1>
        <p className="text-muted">{t('cart.emptySub')}</p>
        <ButtonLink href="/menu" variant="dark" className="mt-3">
          {t('cart.browse')}
        </ButtonLink>
      </div>
    );
  }

  const blocked = restaurant.ordersPaused;
  // Below the minimum, a sold-out dish, or no time left to order for: the server would
  // refuse the order, so don't let it be sent.
  const cannotSend = blocked || !canCheckout || !timeAvailable;
  const phoneE164 = normaliseCustomerPhone(phone);

  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid items-start gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_400px]"
    >
      <div className="grid gap-6">
        <h1 className="text-3xl font-extrabold tracking-tight">{t('checkout.title')}</h1>

        {blocked ? (
          <p role="alert" className="bg-danger-soft text-danger rounded-lg p-4">
            {t('checkout.pausedBanner', { phone: formatGeorgianPhone(restaurant.phone) })}
          </p>
        ) : open.kind !== 'open' || !open.acceptingOrders ? (
          <p className="bg-gold-soft text-gold-text rounded-lg p-4">{openText}</p>
        ) : null}

        <section
          className="bg-surface shadow-card grid gap-4 rounded-2xl p-5 md:p-6"
          aria-labelledby="how-title"
        >
          <h2 id="how-title" className="text-lg font-bold">
            {t('checkout.how')}
          </h2>
          <OrderTypeToggle />
          <TimeField
            orderType={cart.orderType}
            value={when}
            onChange={setWhen}
            onAvailableChange={setTimeAvailable}
            error={errorText(errors.when)}
          />
        </section>

        <section
          className="bg-surface shadow-card grid gap-4 rounded-2xl p-5 md:p-6"
          aria-labelledby="details-title"
        >
          <h2 id="details-title" className="text-lg font-bold">
            {t('checkout.details')}
          </h2>
          <Field label={t('checkout.name')} error={errorText(errors.name)}>
            {(p) => (
              <Input
                {...p}
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={80}
                required
              />
            )}
          </Field>
          <Field
            label={t('checkout.phone')}
            hint={t('checkout.phoneHint')}
            error={errorText(errors.phone)}
          >
            {(p) => (
              <Input
                {...p}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => phoneE164 && setPhone(formatGeorgianPhone(phoneE164))}
                placeholder="+995 5__ __ __ __"
                required
              />
            )}
          </Field>
          {delivery && (
            <>
              <Field
                label={t('checkout.address')}
                hint={t('checkout.addressHint')}
                error={errorText(errors.addressText)}
              >
                {(p) => (
                  <Textarea
                    {...p}
                    name="addressText"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    autoComplete="street-address"
                    placeholder={t('checkout.addressPlaceholder')}
                    maxLength={300}
                    rows={2}
                  />
                )}
              </Field>
              <LocationField value={location} onChange={setLocation} />
              {!location && restaurant.zones.length > 0 && (
                <p className="text-muted -mt-2 text-sm">{t('checkout.zoneUnchecked')}</p>
              )}
            </>
          )}
          <Field
            label={t('checkout.notes')}
            optionalLabel={t('common.optional')}
            error={errorText(errors.notes)}
          >
            {(p) => (
              <Textarea
                {...p}
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('checkout.notesPlaceholder')}
                maxLength={500}
                rows={2}
              />
            )}
          </Field>

          {/* Honeypot: hidden from people and screen readers; bots fill it in. */}
          <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor={honeypotId}>{t('checkout.honeypot')}</label>
            <input
              id={honeypotId}
              name="bp_extra_contact"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <label className="text-ink-soft flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="size-5 accent-[var(--color-gold-text)]"
            />
            {t('checkout.remember')}
          </label>
        </section>

        <section
          className="bg-surface shadow-card grid gap-3 rounded-2xl p-5 md:p-6"
          aria-labelledby="pay-title"
        >
          <fieldset className="grid gap-2">
            <legend id="pay-title" className="mb-2 text-lg font-bold">
              {t('checkout.payment')}
            </legend>
            {paymentOptions.map((o) => (
              <label
                key={o.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-4',
                  payment === o.value ? 'border-ink bg-soft' : 'border-line',
                )}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={o.value}
                  checked={payment === o.value}
                  onChange={() => setPayOnline(o.value === 'online')}
                  className="mt-0.5 size-5 accent-[var(--color-gold-text)]"
                />
                <span>
                  <b className="block">{o.label}</b>
                  {o.hint && <span className="text-muted text-sm">{o.hint}</span>}
                </span>
              </label>
            ))}
          </fieldset>
        </section>
      </div>

      <aside
        className="bg-surface shadow-card grid gap-4 rounded-2xl p-5 lg:sticky lg:top-24"
        aria-labelledby="summary-title"
      >
        <div className="flex items-center justify-between">
          <h2 id="summary-title" className="text-lg font-bold">
            {t('checkout.summary')}
          </h2>
          <Link href="/cart" className="text-gold-text text-sm font-semibold underline">
            {t('checkout.editOrder')}
          </Link>
        </div>
        <ul className="grid gap-2 text-sm">
          {cart.lines.map((line) => {
            const item = itemsBySlug.get(line.itemSlug);
            const priced = priceLine(line, item).line;
            return (
              <li key={line.key} className="flex justify-between gap-3">
                <span>
                  {line.quantity} × {item ? pickText(item.name, locale) : line.itemSlug}
                  {item && optionSummary(item, line, locale) && (
                    <span className="text-muted block">{optionSummary(item, line, locale)}</span>
                  )}
                  {line.notes && <span className="text-muted block italic">{line.notes}</span>}
                </span>
                {priced && (
                  <span className="tabular shrink-0">
                    {formatGel(priced.lineTotalTetri, locale)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="border-line border-t pt-3">
          <CartSummary />
        </div>

        <div ref={errorRef} tabIndex={-1} role="alert" className="focus:outline-none">
          {formError && (
            <p className="bg-danger-soft text-danger rounded-md px-3 py-2.5 text-sm font-semibold">
              {formError}
            </p>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={submitting || cannotSend}
          aria-busy={submitting || undefined}
          className="w-full"
        >
          {submitting
            ? t('checkout.placing')
            : t('checkout.placeOrder', { t: formatGel(pricing.totalTetri, locale) })}
        </Button>
        <p className="text-muted text-xs">
          {t.rich('checkout.agree', {
            terms: (chunks) => (
              <Link href="/terms" className="underline">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/privacy" className="underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </aside>
    </form>
  );
}
