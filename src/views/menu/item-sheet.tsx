'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useCart, useShop, useMonogram } from '@/views/providers/shop-provider';
import { Button } from '@/views/ui/button';
import { CloseIcon, MinusIcon, PlusIcon } from '@/views/ui/icons';
import { cartStore, defaultOptions } from '@/shared/cart/store';
import { cn } from '@/shared/cn';
import { pickText, type Locale } from '@/shared/domain/i18n-text';
import type { MenuItem, MenuModifierGroup } from '@/shared/domain/menu';
import { formatGel } from '@/shared/domain/money';
import { MAX_QUANTITY_PER_LINE, type SelectedOption } from '@/shared/domain/pricing';
import { useSpiceLabel } from './dish-card';
import { SpiceMeter, VegMark } from './dietary';
import { DishPhoto } from './dish-photo';

/** The dish sheet, rendered once per page and opened through the shop context. */
export function ItemSheet() {
  const { sheet, closeItem, itemsBySlug } = useShop();
  const ref = useRef<HTMLDialogElement>(null);
  const item = sheet ? itemsBySlug.get(sheet.itemSlug) : undefined;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (item && !dialog.open) dialog.showModal();
    if (!item && dialog.open) dialog.close();
  }, [item]);

  return (
    <dialog
      ref={ref}
      onClose={closeItem}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeItem();
      }}
      aria-labelledby="item-sheet-title"
      className={cn(
        'bg-surface text-ink shadow-lift m-0 mt-auto w-full max-w-full overflow-hidden rounded-t-2xl p-0',
        'backdrop:bg-ink/50 open:animate-rise max-h-[92dvh]',
        'md:m-auto md:w-[min(560px,100%-24px)] md:rounded-2xl',
      )}
    >
      {item && sheet && (
        <SheetBody
          key={`${item.slug}:${sheet.editKey ?? 'new'}`}
          item={item}
          editKey={sheet.editKey}
        />
      )}
    </dialog>
  );
}

function initialSelection(item: MenuItem, editOptions: SelectedOption[] | undefined) {
  const source =
    editOptions ??
    defaultOptions(item) ??
    item.modifierGroups.flatMap((g) =>
      g.options
        .filter((o) => o.isDefault && o.isAvailable)
        .slice(0, g.maxSelect)
        .map((o) => ({ group: g.slug, option: o.slug })),
    );
  const map: Record<string, string[]> = {};
  for (const g of item.modifierGroups) map[g.slug] = [];
  for (const o of source) map[o.group]?.push(o.option);
  return map;
}

function SheetBody({ item, editKey }: { item: MenuItem; editKey?: string }) {
  const monogram = useMonogram();
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const { closeItem, announce, openDrawer } = useShop();
  const cart = useCart();
  const spiceLabel = useSpiceLabel();
  const editing = editKey ? cart.lines.find((l) => l.key === editKey) : undefined;

  const [selection, setSelection] = useState(() => initialSelection(item, editing?.options));
  const [quantity, setQuantity] = useState(editing?.quantity ?? 1);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const notesId = useId();

  const name = pickText(item.name, locale);
  const missing = item.modifierGroups.filter((g) => (selection[g.slug]?.length ?? 0) < g.minSelect);
  const unitPrice = useMemo(() => {
    let price = item.priceTetri;
    for (const g of item.modifierGroups) {
      for (const slug of selection[g.slug] ?? []) {
        price += g.options.find((o) => o.slug === slug)?.priceDeltaTetri ?? 0;
      }
    }
    return Math.max(0, price);
  }, [item, selection]);

  const submit = () => {
    if (!item.isAvailable) return;
    if (missing.length > 0) {
      setShowErrors(true);
      document.getElementById(`group-${missing[0]!.slug}`)?.focus();
      return;
    }
    const options = item.modifierGroups.flatMap((g) =>
      (selection[g.slug] ?? []).map((option) => ({ group: g.slug, option })),
    );
    const line = {
      itemSlug: item.slug,
      quantity,
      options,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    if (editKey) cartStore.replace(editKey, line);
    else cartStore.add(line);
    announce(t('menu.added', { n: name }));
    closeItem();
    if (editKey) openDrawer();
  };

  const toggle = (group: MenuModifierGroup, option: string) => {
    setSelection((current) => {
      const chosen = current[group.slug] ?? [];
      let next: string[];
      if (group.maxSelect === 1)
        next = chosen.includes(option) && group.minSelect === 0 ? [] : [option];
      else if (chosen.includes(option)) next = chosen.filter((o) => o !== option);
      else next = chosen.length >= group.maxSelect ? chosen : [...chosen, option];
      return { ...current, [group.slug]: next };
    });
  };

  return (
    <div className="flex max-h-[92dvh] flex-col">
      <div className="overflow-y-auto overscroll-contain">
        <div className="relative">
          <DishPhoto
            monogram={monogram}
            path={item.photoPath}
            alt={name}
            sizes="(min-width: 768px) 560px, 100vw"
            soldOut={!item.isAvailable}
            className="aspect-[16/10] w-full"
          />
          <button
            type="button"
            onClick={closeItem}
            aria-label={t('menu.closeDetails')}
            className="shadow-card absolute top-3.5 right-3.5 grid size-11 place-items-center rounded-full bg-white/95 [&_svg]:size-5"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="grid gap-5 px-5 pt-5 pb-6 md:px-6">
          <div>
            <h2
              id="item-sheet-title"
              className="flex items-start gap-2.5 text-2xl leading-tight font-extrabold tracking-tight"
            >
              <VegMark
                veg={item.isVeg}
                label={t(item.isVeg ? 'common.vegLabel' : 'common.nonVegLabel')}
                className="mt-2"
              />
              {name}
            </h2>
            {item.description && (
              <p className="text-muted mt-2">{pickText(item.description, locale)}</p>
            )}
            <p className="mt-3 flex flex-wrap items-center gap-3 text-lg font-bold">
              <span className="tabular">{formatGel(item.priceTetri, locale)}</span>
              {item.spiceLevel ? (
                <span className="text-muted inline-flex items-center gap-1.5 text-sm font-medium">
                  <SpiceMeter level={item.spiceLevel} label={spiceLabel(item.spiceLevel)} />
                  {spiceLabel(item.spiceLevel)}
                </span>
              ) : null}
            </p>
            {item.allergens.length > 0 && (
              <p className="text-muted mt-2 text-sm">
                {t('menu.allergens', { list: item.allergens.join(', ') })}
              </p>
            )}
          </div>

          {item.modifierGroups.map((group) => (
            <ModifierGroup
              key={group.slug}
              group={group}
              chosen={selection[group.slug] ?? []}
              onToggle={(option) => toggle(group, option)}
              error={showErrors && missing.includes(group)}
            />
          ))}

          <div className="grid gap-1.5">
            <label htmlFor={notesId} className="text-sm font-semibold">
              {t('menu.noteLabel')}{' '}
              <span className="text-muted font-normal">{t('common.optional')}</span>
            </label>
            <textarea
              id={notesId}
              value={notes}
              maxLength={200}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('menu.notePlaceholder')}
              rows={2}
              className="bg-soft focus:border-gold-text focus:bg-surface w-full resize-y rounded-md border-[1.5px] border-transparent px-3.5 py-3 text-base focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="safe-bottom border-line bg-surface flex gap-2.5 border-t px-5 pt-3 md:px-6">
        <div
          role="group"
          aria-label={t('common.quantity')}
          className="bg-soft inline-flex h-14 items-center rounded-full p-1"
        >
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
            aria-label={t('menu.lessLabel', { n: name })}
            className="hover:bg-surface grid size-12 place-items-center rounded-full disabled:opacity-40 [&_svg]:size-4"
          >
            <MinusIcon />
          </button>
          <output className="tabular min-w-6 text-center font-bold" aria-live="polite">
            {quantity}
          </output>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(MAX_QUANTITY_PER_LINE, q + 1))}
            aria-label={t('menu.moreLabel', { n: name })}
            className="hover:bg-surface grid size-12 place-items-center rounded-full [&_svg]:size-4"
          >
            <PlusIcon />
          </button>
        </div>
        <Button size="lg" className="flex-1" onClick={submit} disabled={!item.isAvailable}>
          {!item.isAvailable
            ? t('common.soldOut')
            : t(editKey ? 'menu.itemUpdate' : 'menu.itemAdd', {
                p: formatGel(unitPrice * quantity, locale),
              })}
        </Button>
      </div>
    </div>
  );
}

function ModifierGroup({
  group,
  chosen,
  onToggle,
  error,
}: {
  group: MenuModifierGroup;
  chosen: string[];
  onToggle: (option: string) => void;
  error: boolean;
}) {
  const t = useTranslations('menu');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;
  const single = group.maxSelect === 1;
  const radio = single && group.minSelect === 1;
  const rule =
    group.minSelect === group.maxSelect
      ? group.minSelect === 1
        ? t('chooseOne')
        : t('chooseExactly', { n: group.minSelect })
      : group.minSelect > 0
        ? t('chooseBetween', { min: group.minSelect, max: group.maxSelect })
        : t('chooseUpTo', { n: group.maxSelect });
  const hintId = `group-${group.slug}-hint`;

  return (
    <fieldset
      id={`group-${group.slug}`}
      tabIndex={-1}
      aria-describedby={hintId}
      aria-invalid={error || undefined}
      className={cn(
        'rounded-xl border p-4 focus:outline-none',
        error ? 'border-danger bg-danger-soft' : 'border-line',
      )}
    >
      <legend className="float-left mb-3 flex w-full flex-wrap items-baseline justify-between gap-2">
        <span className="text-base font-bold">{pickText(group.name, locale)}</span>
        <span
          id={hintId}
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
            group.minSelect > 0
              ? error
                ? 'bg-danger text-white'
                : 'bg-ink text-white'
              : 'bg-soft text-muted',
          )}
        >
          {group.minSelect > 0 ? t('required') : t('optional')} · {rule}
        </span>
      </legend>
      <div className="clear-both grid gap-1">
        {group.options.map((option) => {
          const checked = chosen.includes(option.slug);
          const full = !single && !checked && chosen.length >= group.maxSelect;
          const disabled = !option.isAvailable || full;
          return (
            <label
              key={option.slug}
              className={cn(
                'hover:bg-soft flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-2',
                disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <input
                type={radio ? 'radio' : 'checkbox'}
                name={`opt-${group.slug}`}
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(option.slug)}
                className="size-5 accent-[var(--color-gold-text)]"
              />
              <span className="flex-1">{pickText(option.name, locale)}</span>
              {!option.isAvailable ? (
                <span className="text-muted text-xs font-semibold">{tc('soldOut')}</span>
              ) : option.priceDeltaTetri !== 0 ? (
                <span className="tabular text-muted text-sm">
                  {option.priceDeltaTetri > 0
                    ? t('optionPrice', { p: formatGel(option.priceDeltaTetri, locale) })
                    : t('optionDiscount', { p: formatGel(-option.priceDeltaTetri, locale) })}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
