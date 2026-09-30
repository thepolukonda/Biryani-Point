'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCart, useShop, useMonogram } from '@/components/providers/shop-provider';
import { cn } from '@/lib/cn';
import { pickText, type Locale } from '@/lib/domain/i18n-text';
import type { MenuItem } from '@/lib/domain/menu';
import { SpiceMeter, VegMark } from './dietary';
import { DishPhoto } from './dish-photo';
import { Price } from './price';
import { QuantityControl } from './quantity-control';

const SPICE_KEYS = { 1: 'mild', 2: 'medium', 3: 'spicy' } as const;

export function useSpiceLabel() {
  const t = useTranslations();
  return (level: MenuItem['spiceLevel']) =>
    level ? t('menu.spiceLevel', { level: t(`checkout.${SPICE_KEYS[level]}`) }) : '';
}

/**
 * Menu row: text on the left, photo with the add control on the right.
 * The dish name is a button stretched over the whole card (opens details);
 * the add control sits above it, so there are no nested interactive elements.
 */
export function DishCard({ item, priority = false }: { item: MenuItem; priority?: boolean }) {
  const monogram = useMonogram();
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const { openItem } = useShop();
  const cart = useCart();
  const spiceLabel = useSpiceLabel();
  const inCart = cart.lines.some((l) => l.itemSlug === item.slug);
  const name = pickText(item.name, locale);

  return (
    <article
      className={cn(
        'border-line relative flex min-h-36 gap-3.5 border-b py-4 transition-[box-shadow,border-color]',
        'md:bg-surface md:hover:border-line-strong md:hover:shadow-card md:rounded-xl md:border md:p-3.5',
        inCart && 'md:border-gold md:shadow-[0_0_0_1px_var(--color-gold)]',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="flex items-start gap-2 text-base leading-snug font-semibold">
          <VegMark
            veg={item.isVeg}
            label={t(item.isVeg ? 'common.vegLabel' : 'common.nonVegLabel')}
            className="mt-1"
          />
          <button
            type="button"
            onClick={() => openItem(item.slug)}
            className={cn(
              'text-left after:absolute after:inset-0 after:z-[1] after:content-[""] hover:underline',
              'focus-visible:after:outline-ink focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:outline-3',
              !item.isAvailable && 'text-muted',
            )}
          >
            {name}
          </button>
        </h3>
        {item.description && (
          <p className="text-muted mt-1 mb-2.5 line-clamp-2 text-[13.5px]">
            {pickText(item.description, locale)}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <Price tetri={item.priceTetri} className={cn(!item.isAvailable && 'text-muted')} />
          {item.isPopular && (
            <span className="bg-gold-soft text-gold-text rounded-sm px-2 py-0.5 text-xs font-bold">
              {t('common.popular')}
            </span>
          )}
          <SpiceMeter level={item.spiceLevel} label={spiceLabel(item.spiceLevel)} />
        </div>
      </div>

      <div className="relative size-26 shrink-0 md:size-30">
        <DishPhoto
          monogram={monogram}
          path={item.photoPath}
          alt=""
          sizes="(min-width: 768px) 120px, 104px"
          priority={priority}
          soldOut={!item.isAvailable}
          className="size-full rounded-lg"
        />
        <QuantityControl itemSlug={item.slug} className="absolute right-1.5 bottom-1.5" />
      </div>
    </article>
  );
}
