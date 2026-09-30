'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { DishPhoto } from '@/components/menu/dish-photo';
import { useCart, useCartPricing, useShop } from '@/components/providers/shop-provider';
import { MinusIcon, PencilIcon, PlusIcon, TrashIcon } from '@/components/ui/icons';
import { cartStore, type CartLine } from '@/lib/cart/store';
import { cn } from '@/lib/cn';
import { pickText, type Locale } from '@/lib/domain/i18n-text';
import type { MenuItem } from '@/lib/domain/menu';
import { formatGel } from '@/lib/domain/money';
import { MAX_QUANTITY_PER_LINE, priceLine } from '@/lib/domain/pricing';

export function optionSummary(
  item: MenuItem | undefined,
  line: Pick<CartLine, 'options'>,
  locale: Locale,
) {
  if (!item) return '';
  return line.options
    .map((o) => {
      const group = item.modifierGroups.find((g) => g.slug === o.group);
      const option = group?.options.find((x) => x.slug === o.option);
      return option ? pickText(option.name, locale) : null;
    })
    .filter(Boolean)
    .join(' · ');
}

/** Editable list of cart lines (drawer and /cart page). */
export function CartLines({ compact = false }: { compact?: boolean }) {
  const cart = useCart();
  const pricing = useCartPricing();

  return (
    <ul className="divide-line divide-y">
      {cart.lines.map((line, index) => (
        <CartLineRow
          key={line.key}
          line={line}
          unavailable={pricing.problems.some(
            (p) =>
              p.line === index && (p.code === 'item_unavailable' || p.code === 'item_not_found'),
          )}
          needsOptions={pricing.problems.some(
            (p) =>
              p.line === index &&
              [
                'too_few_options',
                'too_many_options',
                'unknown_option',
                'option_unavailable',
              ].includes(p.code),
          )}
          compact={compact}
        />
      ))}
    </ul>
  );
}

function CartLineRow({
  line,
  unavailable,
  needsOptions,
  compact,
}: {
  line: CartLine;
  unavailable: boolean;
  needsOptions: boolean;
  compact: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const { itemsBySlug, openItem, announce, closeDrawer, restaurant } = useShop();
  const item = itemsBySlug.get(line.itemSlug);
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(line.notes ?? '');
  const noteId = useId();
  const name = item ? pickText(item.name, locale) : line.itemSlug;
  const options = optionSummary(item, line, locale);
  const priced = priceLine(line, item).line;
  const lineTotal = priced?.lineTotalTetri;

  const change = (q: number) => {
    cartStore.setQuantity(line.key, q);
    announce(q === 0 ? t('cart.removed', { n: name }) : t('cart.quantityChanged', { n: name, q }), {
      toast: false,
    });
  };

  return (
    <li className={cn('grid grid-cols-[52px_1fr_auto] gap-3 py-3.5', unavailable && 'opacity-70')}>
      <DishPhoto
        monogram={restaurant.profile.monogram}
        path={item?.photoPath ?? null}
        alt=""
        sizes="52px"
        className="size-13 rounded-md"
      />
      <div className="min-w-0">
        <p className="leading-snug font-semibold">{name}</p>
        {options && <p className="text-muted text-[13px]">{options}</p>}
        {!compact && item && (
          <p className="tabular text-muted text-[13px]">
            {t('common.each', { p: formatGel(priced?.unitPriceTetri ?? item.priceTetri, locale) })}
          </p>
        )}
        {unavailable && (
          <p className="text-danger mt-1 text-[13px] font-semibold">
            {t('checkout.errors.item_unavailable', { n: name })}
          </p>
        )}
        {needsOptions && item && (
          <button
            type="button"
            onClick={() => {
              closeDrawer();
              openItem(item.slug, line.key);
            }}
            className="text-danger mt-1 text-[13px] font-semibold underline"
          >
            {t('checkout.errors.options', { n: name })}
          </button>
        )}

        {editingNote ? (
          <div className="mt-2 grid gap-1.5">
            <label htmlFor={noteId} className="sr-only">
              {t('menu.noteLabel')}
            </label>
            <textarea
              id={noteId}
              value={note}
              autoFocus
              maxLength={200}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('menu.notePlaceholder')}
              className="bg-soft focus:bg-surface focus:outline-gold-text w-full rounded-md px-3 py-2 text-sm focus:outline-2"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  cartStore.setNotes(line.key, note);
                  setEditingNote(false);
                }}
                className="bg-ink min-h-9 rounded-md px-3 text-sm font-semibold text-white"
              >
                {t('cart.saveNote')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setNote(line.notes ?? '');
                  setEditingNote(false);
                }}
                className="hover:bg-soft min-h-9 rounded-md px-3 text-sm font-semibold"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            {line.notes && (
              <span className="text-ink-soft italic">
                {t('cart.itemNote', { note: line.notes })}
              </span>
            )}
            <button
              type="button"
              onClick={() => setEditingNote(true)}
              className="text-gold-text inline-flex min-h-8 items-center gap-1 font-semibold underline-offset-2 hover:underline [&_svg]:size-3.5"
            >
              <PencilIcon />
              {line.notes ? t('cart.editNote') : t('cart.addNote')}
            </button>
            {item && item.modifierGroups.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  closeDrawer();
                  openItem(item.slug, line.key);
                }}
                className="text-gold-text inline-flex min-h-8 items-center font-semibold underline-offset-2 hover:underline"
              >
                {t('common.edit')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid justify-items-end gap-1.5">
        <strong className="tabular text-[15px]">
          {lineTotal !== undefined ? formatGel(lineTotal, locale) : '—'}
        </strong>
        <div
          role="group"
          aria-label={t('cart.quantityOf', { n: name })}
          className="bg-soft inline-flex h-9 items-center rounded-full"
        >
          <button
            type="button"
            onClick={() => change(line.quantity - 1)}
            aria-label={
              line.quantity === 1
                ? t('cart.removeItem', { n: name })
                : t('menu.lessLabel', { n: name })
            }
            className="hover:bg-soft-2 grid size-9 place-items-center rounded-full [&_svg]:size-3.5"
          >
            {line.quantity === 1 ? <TrashIcon /> : <MinusIcon />}
          </button>
          <span className="tabular min-w-5 text-center text-sm font-bold">{line.quantity}</span>
          <button
            type="button"
            onClick={() => change(line.quantity + 1)}
            disabled={line.quantity >= MAX_QUANTITY_PER_LINE || unavailable}
            aria-label={t('menu.moreLabel', { n: name })}
            className="hover:bg-soft-2 grid size-9 place-items-center rounded-full disabled:opacity-40 [&_svg]:size-3.5"
          >
            <PlusIcon />
          </button>
        </div>
      </div>
    </li>
  );
}
