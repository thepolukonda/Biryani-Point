'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCartCount, useShop, useMonogram } from '@/views/providers/shop-provider';
import { Button } from '@/views/ui/button';
import { readJson, STORAGE_KEYS } from '@/shared/browser-storage';
import { cartStore, type CartLine } from '@/shared/cart/store';
import { pickText, type Locale } from '@/shared/domain/i18n-text';
import { formatGel } from '@/shared/domain/money';
import { priceLine } from '@/shared/domain/pricing';
import { useHydrated } from '@/shared/hooks';
import { DishPhoto } from './dish-photo';

export type LastOrder = { lines: Omit<CartLine, 'key' | 'addedAt'>[]; at: number };

/** "Order again" banner with the previous order, shown while the cart is empty. */
export function OrderAgain() {
  const monogram = useMonogram();
  const t = useTranslations('menu');
  const locale = useLocale() as Locale;
  const { itemsBySlug, openDrawer, announce } = useShop();
  const count = useCartCount();
  const hydrated = useHydrated();
  const last = hydrated ? readJson<LastOrder | null>(STORAGE_KEYS.lastOrder, null) : null;

  if (!last || count > 0) return null;
  // Only lines that can still be ordered exactly as before.
  const lines = last.lines.filter((l) => {
    const result = priceLine(l, itemsBySlug.get(l.itemSlug));
    return result.line && result.problems.length === 0;
  });
  if (lines.length === 0) return null;

  const total = lines.reduce(
    (s, l) => s + (priceLine(l, itemsBySlug.get(l.itemSlug)).line?.lineTotalTetri ?? 0),
    0,
  );
  const summary = lines
    .map((l) => `${l.quantity}× ${pickText(itemsBySlug.get(l.itemSlug)!.name, locale)}`)
    .join(', ');

  return (
    <div className="bg-gold-soft mt-5 flex items-center gap-3.5 rounded-xl p-3.5 md:p-4">
      <div className="flex shrink-0">
        {lines.slice(0, 3).map((l, i) => (
          <DishPhoto
            monogram={monogram}
            key={l.itemSlug + i}
            path={itemsBySlug.get(l.itemSlug)?.photoPath ?? null}
            alt=""
            sizes="42px"
            className="border-gold-soft -ml-3 size-10.5 rounded-full border-2 first:ml-0"
          />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <b className="block">{t('againTitle')}</b>
        <small className="text-ink-soft block truncate text-sm">
          {summary} · {formatGel(total, locale)}
        </small>
      </div>
      <Button
        variant="dark"
        size="sm"
        onClick={() => {
          cartStore.replaceAll(lines);
          announce(t('againAction'));
          openDrawer();
        }}
      >
        {t('againAction')}
      </Button>
    </div>
  );
}
