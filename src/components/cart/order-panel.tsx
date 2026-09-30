'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCartPricing } from '@/components/providers/shop-provider';
import { ButtonLink } from '@/components/ui/button';
import { BagIcon } from '@/components/ui/icons';
import type { Locale } from '@/lib/domain/i18n-text';
import { formatGel } from '@/lib/domain/money';
import { CartLines } from './cart-lines';
import { CartSummary, OrderTypeToggle, useCanCheckout } from './cart-summary';

/** Sticky order panel beside the menu on large screens (the drawer covers smaller ones). */
export function OrderPanel() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const pricing = useCartPricing();
  const canCheckout = useCanCheckout();

  return (
    <aside
      aria-labelledby="order-panel-title"
      className="border-line bg-surface shadow-card sticky top-[calc(72px+1rem)] mt-6 hidden max-h-[calc(100dvh-72px-2rem)] flex-col rounded-2xl border lg:flex"
    >
      <h2 id="order-panel-title" className="px-5 pt-5 pb-2 text-xl font-extrabold">
        {t('cart.yourOrder')}
      </h2>
      {pricing.count === 0 ? (
        <div className="text-muted px-5 pt-5 pb-8 text-center">
          <span className="bg-soft text-faint mx-auto mb-3 grid size-19 place-items-center rounded-full [&_svg]:size-8">
            <BagIcon />
          </span>
          <b className="text-ink block">{t('cart.emptyPanelTitle')}</b>
          {t('cart.emptyPanelSub')}
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-5">
            <OrderTypeToggle className="mb-1" />
            <CartLines compact />
          </div>
          <div className="border-line border-t px-5 pt-3 pb-5">
            <CartSummary className="mb-3" />
            <ButtonLink
              href="/checkout"
              size="lg"
              aria-disabled={!canCheckout || undefined}
              tabIndex={canCheckout ? undefined : -1}
              className="w-full justify-between"
            >
              <span>{t('cart.checkout')}</span>
              <span className="tabular">{formatGel(pricing.totalTetri, locale)}</span>
            </ButtonLink>
          </div>
        </>
      )}
    </aside>
  );
}
