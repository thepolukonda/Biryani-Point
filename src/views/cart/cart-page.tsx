'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCartPricing } from '@/views/providers/shop-provider';
import { Button, ButtonLink } from '@/views/ui/button';
import { ArrowLeftIcon, BagIcon } from '@/views/ui/icons';
import { cartStore } from '@/shared/cart/store';
import type { Locale } from '@/shared/domain/i18n-text';
import { formatGel } from '@/shared/domain/money';
import { useHydrated } from '@/shared/hooks';
import { CartLines } from './cart-lines';
import { CartSummary, OrderTypeToggle, useCanCheckout } from './cart-summary';

export function CartPageView() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const pricing = useCartPricing();
  const canCheckout = useCanCheckout();
  const hydrated = useHydrated();

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

  if (pricing.count === 0) {
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

  return (
    <div className="grid items-start gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div>
        <ButtonLink href="/menu" variant="ghost" size="sm" className="-ml-3">
          <ArrowLeftIcon />
          {t('cart.addMore')}
        </ButtonLink>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{t('cart.pageTitle')}</h1>
        <div className="bg-surface shadow-card mt-5 rounded-2xl p-5">
          <CartLines />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted mt-3"
          onClick={() => {
            if (window.confirm(t('cart.clearConfirm'))) cartStore.clear();
          }}
        >
          {t('cart.clear')}
        </Button>
      </div>
      <aside
        className="bg-surface shadow-card rounded-2xl p-5 lg:sticky lg:top-24"
        aria-labelledby="cart-summary-title"
      >
        <h2 id="cart-summary-title" className="mb-3 text-lg font-bold">
          {t('checkout.summary')}
        </h2>
        <OrderTypeToggle className="mb-4" />
        <CartSummary />
        <ButtonLink
          href="/checkout"
          size="lg"
          aria-disabled={!canCheckout || undefined}
          tabIndex={canCheckout ? undefined : -1}
          className="mt-4 w-full justify-between"
        >
          <span>{t('cart.checkout')}</span>
          <span className="tabular">{formatGel(pricing.totalTetri, locale)}</span>
        </ButtonLink>
      </aside>
    </div>
  );
}
