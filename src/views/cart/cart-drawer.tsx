'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { useCartPricing, useShop } from '@/views/providers/shop-provider';
import { Button, ButtonLink } from '@/views/ui/button';
import { BagIcon, CloseIcon } from '@/views/ui/icons';
import { cn } from '@/shared/cn';
import type { Locale } from '@/shared/domain/i18n-text';
import { formatGel } from '@/shared/domain/money';
import { CartLines } from './cart-lines';
import { CartSummary, OrderTypeToggle, useCanCheckout } from './cart-summary';

/** Slide-over cart, available on every customer page. */
export function CartDrawer() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const { drawerOpen, closeDrawer } = useShop();
  const pricing = useCartPricing();
  const canCheckout = useCanCheckout();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (drawerOpen && !dialog.open) dialog.showModal();
    if (!drawerOpen && dialog.open) dialog.close();
  }, [drawerOpen]);

  return (
    <dialog
      ref={ref}
      onClose={closeDrawer}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeDrawer();
      }}
      aria-labelledby="cart-drawer-title"
      className={cn(
        'bg-surface text-ink shadow-lift m-0 ml-auto h-dvh max-h-dvh w-[min(480px,100%)] max-w-full p-0',
        'backdrop:bg-ink/45 open:animate-drawer',
      )}
    >
      <div className="flex h-full flex-col">
        <div className="border-line flex items-center justify-between border-b px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3.5">
          <h2 id="cart-drawer-title" className="text-[22px] font-extrabold">
            {t('cart.yourOrder')}
          </h2>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label={t('common.close')}
            className="bg-soft grid size-11 place-items-center rounded-full [&_svg]:size-5"
          >
            <CloseIcon />
          </button>
        </div>

        {pricing.count === 0 ? (
          <div className="grid flex-1 place-content-center justify-items-center gap-2 px-6 text-center">
            <span className="bg-soft text-faint grid size-19 place-items-center rounded-full [&_svg]:size-8">
              <BagIcon />
            </span>
            <p className="text-xl font-bold">{t('cart.emptyTitle')}</p>
            <p className="text-muted">{t('cart.emptySub')}</p>
            <ButtonLink href="/menu" variant="dark" className="mt-3" onClick={closeDrawer}>
              {t('cart.browse')}
            </ButtonLink>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-5">
              <OrderTypeToggle className="mb-2" />
              <CartLines compact />
              <CartSummary className="mt-4" />
            </div>
            <div className="safe-bottom border-line grid gap-2 border-t px-5 pt-3">
              <ButtonLink
                href="/checkout"
                size="lg"
                onClick={closeDrawer}
                aria-disabled={!canCheckout || undefined}
                tabIndex={canCheckout ? undefined : -1}
                className="justify-between"
              >
                <span>{t('cart.checkout')}</span>
                <span className="tabular">{formatGel(pricing.totalTetri, locale)}</span>
              </ButtonLink>
              <div className="flex justify-between">
                <Button variant="ghost" size="sm" onClick={closeDrawer}>
                  {t('cart.addMore')}
                </Button>
                <ButtonLink href="/cart" variant="ghost" size="sm" onClick={closeDrawer}>
                  {t('cart.openFullCart')}
                </ButtonLink>
              </div>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
