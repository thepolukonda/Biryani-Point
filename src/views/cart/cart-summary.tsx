'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCart, useCartPricing, useShop } from '@/views/providers/shop-provider';
import { useOpenLabel, useOpenText } from '@/views/restaurant/open-status';
import { ClockIcon, StoreIcon, TruckIcon } from '@/views/ui/icons';
import { cartStore } from '@/shared/cart/store';
import { cn } from '@/shared/cn';
import type { Locale } from '@/shared/domain/i18n-text';
import { formatGel } from '@/shared/domain/money';
import { describeOpenState } from '@/shared/domain/open-label';

/** Delivery / pickup switch (a radio group). */
export function OrderTypeToggle({ className }: { className?: string }) {
  const t = useTranslations('checkout');
  const cart = useCart();
  const { restaurant } = useShop();
  const types = [
    restaurant.deliveryEnabled &&
      ({ value: 'delivery', label: t('delivery'), Icon: TruckIcon } as const),
    restaurant.pickupEnabled && ({ value: 'pickup', label: t('pickup'), Icon: StoreIcon } as const),
  ].filter((x) => x !== false);
  if (types.length < 2) return null;

  return (
    <fieldset className={cn('bg-soft flex gap-1 rounded-md p-1', className)}>
      <legend className="sr-only">{t('how')}</legend>
      {types.map(({ value, label, Icon }) => (
        <label key={value} className="relative flex-1">
          <input
            type="radio"
            name="order-type"
            value={value}
            checked={cart.orderType === value}
            onChange={() => cartStore.setOrderType(value)}
            className="peer absolute inset-0 cursor-pointer opacity-0"
          />
          <span
            className={cn(
              'text-muted flex min-h-11 items-center justify-center gap-2 rounded-[9px] px-2 text-center text-sm font-semibold transition',
              'peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-[0_1px_4px_rgb(23_19_15/0.12)]',
              'peer-focus-visible:outline-ink peer-focus-visible:outline-3 [&_svg]:size-4',
            )}
          >
            <Icon />
            {label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/** Subtotal, delivery fee, minimum order, total and estimated time. */
export function CartSummary({ className }: { className?: string }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const cart = useCart();
  const pricing = useCartPricing();
  const { restaurant } = useShop();
  const open = useOpenLabel(
    restaurant.schedule,
    describeOpenState(new Date(), restaurant.schedule),
  );
  const openText = useOpenText(open);
  const minimum = pricing.problems.find((p) => p.code === 'below_minimum');
  const delivery = cart.orderType === 'delivery';
  const { freeDeliveryOverTetri, deliveryFeeTetri } = restaurant.fees;
  const toFree =
    delivery && deliveryFeeTetri > 0 && freeDeliveryOverTetri > 0
      ? freeDeliveryOverTetri - pricing.subtotalTetri
      : 0;
  const minutes = delivery ? restaurant.prepMinutes.delivery : restaurant.prepMinutes.pickup;

  return (
    <div className={cn('grid gap-1', className)}>
      <div className="text-muted flex justify-between text-[15px]">
        <span>{t('cart.subtotal')}</span>
        <span className="tabular">{formatGel(pricing.subtotalTetri, locale)}</span>
      </div>
      {delivery && (
        <div className="text-muted flex justify-between text-[15px]">
          <span>{t('cart.deliveryFee')}</span>
          <span className="tabular">
            {pricing.deliveryFeeTetri > 0
              ? formatGel(pricing.deliveryFeeTetri, locale)
              : t('common.free')}
          </span>
        </div>
      )}
      <div className="flex justify-between pt-2 text-lg font-extrabold">
        <span>{t('cart.total')}</span>
        <span className="tabular">{formatGel(pricing.totalTetri, locale)}</span>
      </div>

      {toFree > 0 && (
        <p className="text-gold-text text-sm">
          {t('cart.freeDeliveryHint', { amount: formatGel(toFree, locale) })}
        </p>
      )}
      {minimum?.minimumTetri !== undefined && minimum.shortByTetri !== undefined && (
        <p role="status" className="bg-danger-soft text-danger mt-2 rounded-md px-3 py-2.5 text-sm">
          {t('checkout.errors.below_minimum', {
            m: formatGel(minimum.minimumTetri, locale),
            r: formatGel(minimum.shortByTetri, locale),
          })}
        </p>
      )}

      {restaurant.ordersPaused ? (
        <p className="bg-danger-soft text-danger mt-2 rounded-md px-3 py-2.5 text-sm">
          {t('cart.pausedNotice')}
        </p>
      ) : open.kind === 'open' && open.acceptingOrders ? (
        <p className="text-muted mt-2 flex items-center gap-2 text-sm [&_svg]:size-4">
          <ClockIcon />
          {t(delivery ? 'cart.estimateDelivery' : 'cart.estimatePickup', { min: minutes })}
        </p>
      ) : (
        <p className="bg-gold-soft text-gold-text mt-2 rounded-md px-3 py-2.5 text-sm">
          {openText}
        </p>
      )}
    </div>
  );
}

/** True when the cart can go to checkout (problems block it). */
export function useCanCheckout() {
  const pricing = useCartPricing();
  const { restaurant } = useShop();
  return pricing.count > 0 && pricing.problems.length === 0 && !restaurant.ordersPaused;
}
