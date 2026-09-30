'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCart, useQuickAdd, useShop } from '@/components/providers/shop-provider';
import { MinusIcon, PlusIcon } from '@/components/ui/icons';
import { cartStore } from '@/lib/cart/store';
import { cn } from '@/lib/cn';
import { pickText, type Locale } from '@/lib/domain/i18n-text';

/**
 * "+" on a dish, turning into a − 2 + stepper once it's in the order.
 * The number is the total of that dish across all its variations.
 */
export function QuantityControl({ itemSlug, className }: { itemSlug: string; className?: string }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const { itemsBySlug, announce } = useShop();
  const cart = useCart();
  const quickAdd = useQuickAdd();
  const item = itemsBySlug.get(itemSlug);
  if (!item) return null;

  const name = pickText(item.name, locale);
  const lines = cart.lines.filter((l) => l.itemSlug === itemSlug);
  const quantity = lines.reduce((s, l) => s + l.quantity, 0);

  if (!item.isAvailable) {
    return (
      <span
        className={cn(
          'bg-ink z-10 inline-flex h-7 items-center rounded-full px-2.5 text-xs font-bold whitespace-nowrap text-white',
          className,
        )}
      >
        {t('common.soldOut')}
      </span>
    );
  }

  if (quantity === 0) {
    return (
      <button
        type="button"
        onClick={() => quickAdd(itemSlug)}
        aria-label={t('menu.addLabel', { n: name })}
        className={cn(
          'bg-surface text-ink z-10 grid size-11 place-items-center rounded-full shadow-[0_3px_10px_rgb(23_19_15/0.22)]',
          'hover:bg-gold transition-[transform,background-color] active:scale-90 [&_svg]:size-[18px]',
          className,
        )}
      >
        <PlusIcon />
      </button>
    );
  }

  const decrement = () => {
    const latest = [...lines].sort((a, b) => b.addedAt - a.addedAt)[0]!;
    cartStore.setQuantity(latest.key, latest.quantity - 1);
    announce(
      quantity - 1 === 0
        ? t('cart.removed', { n: name })
        : t('cart.quantityChanged', { n: name, q: quantity - 1 }),
      { toast: false },
    );
  };

  return (
    <div
      role="group"
      aria-label={t('cart.quantityOf', { n: name })}
      className={cn(
        'bg-surface z-10 inline-flex h-11 items-center rounded-full p-0.5 shadow-[0_3px_10px_rgb(23_19_15/0.22)]',
        className,
      )}
    >
      <button
        type="button"
        onClick={decrement}
        aria-label={t('menu.lessLabel', { n: name })}
        className="hover:bg-soft grid size-10 place-items-center rounded-full [&_svg]:size-4"
      >
        <MinusIcon />
      </button>
      <span className="tabular min-w-5 text-center text-sm font-bold">{quantity}</span>
      <button
        type="button"
        onClick={() => quickAdd(itemSlug)}
        aria-label={t('menu.moreLabel', { n: name })}
        className="hover:bg-soft grid size-10 place-items-center rounded-full [&_svg]:size-4"
      >
        <PlusIcon />
      </button>
    </div>
  );
}
