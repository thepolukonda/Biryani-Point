'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { VegMark } from '@/components/menu/dietary';
import { DishPhoto } from '@/components/menu/dish-photo';
import { useCart, useQuickAdd, useShop, useMonogram } from '@/components/providers/shop-provider';
import { Button } from '@/components/ui/button';
import { PauseIcon, PlayIcon, PlusIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { pickText, type Locale } from '@/lib/domain/i18n-text';
import type { MenuItem } from '@/lib/domain/menu';
import { formatGel } from '@/lib/domain/money';
import { useMediaQuery } from '@/lib/hooks';

const DURATION = 6000;

/**
 * Signature dishes from the prototype: tabs with progress bars and a big photo
 * that advances on its own. Pauses on hover/focus, has a pause button, and does
 * not move at all for people who prefer reduced motion.
 */
export function SignatureDishes({ slugs }: { slugs: string[] }) {
  const monogram = useMonogram();
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const cart = useCart();
  const quickAdd = useQuickAdd();
  const { itemsBySlug } = useShop();
  const items = slugs.map((s) => itemsBySlug.get(s)).filter((i): i is MenuItem => i !== undefined);
  const [index, setIndex] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const paused = userPaused || hoverPaused || reducedMotion;
  const go = useCallback(
    (i: number) => setIndex((i + items.length) % items.length),
    [items.length],
  );

  useEffect(() => {
    if (paused || items.length < 2) return;
    const id = window.setTimeout(() => go(index + 1), DURATION);
    return () => window.clearTimeout(id);
  }, [index, paused, go, items.length]);

  if (items.length === 0) return null;
  const item = items[index]!;
  const name = pickText(item.name, locale);
  const inOrder = cart.lines
    .filter((l) => l.itemSlug === item.slug)
    .reduce((s, l) => s + l.quantity, 0);

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const next =
      e.key === 'ArrowRight'
        ? i + 1
        : e.key === 'ArrowLeft'
          ? i - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? items.length - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    const target = (next + items.length) % items.length;
    go(target);
    tabs.current[target]?.focus();
  };

  return (
    <section
      id="signature"
      className="scroll-mt-24 py-16 md:py-24"
      aria-labelledby="sig-title"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocus={() => setHoverPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setHoverPaused(false);
      }}
    >
      <div className="mx-auto w-[min(1240px,100%-32px)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-gold-text text-sm font-bold tracking-[0.16em] uppercase">
              {t('home.sigKicker')}
            </p>
            <h2
              id="sig-title"
              className="font-display mt-3 text-[clamp(2rem,4.5vw,3rem)] leading-tight"
            >
              {t('home.sigTitle')}
            </h2>
          </div>
          {!reducedMotion && items.length > 1 && (
            <Button
              variant="soft"
              size="icon"
              onClick={() => setUserPaused((p) => !p)}
              aria-label={t(userPaused ? 'home.signaturePlay' : 'home.signatureAuto')}
              aria-pressed={userPaused}
            >
              {userPaused ? <PlayIcon /> : <PauseIcon />}
            </Button>
          )}
        </div>

        <div
          role="tablist"
          aria-label={t('home.sigKicker')}
          className="mt-6 flex scrollbar-none gap-2 overflow-x-auto pb-1"
        >
          {items.map((dish, i) => (
            <button
              key={dish.slug}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`sig-tab-${dish.slug}`}
              aria-selected={i === index}
              aria-controls="sig-panel"
              tabIndex={i === index ? 0 : -1}
              onClick={() => go(i)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={cn(
                'relative min-h-11 shrink-0 overflow-hidden rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors',
                i === index ? 'bg-ink text-white' : 'bg-surface text-muted hover:text-ink',
              )}
            >
              {pickText(dish.name, locale)}
              {i === index && !paused && (
                <span
                  aria-hidden
                  key={`${index}-bar`}
                  className="bg-gold absolute bottom-0 left-0 h-[3px] w-full origin-left"
                  style={{ animation: `sig-progress ${DURATION}ms linear forwards` }}
                />
              )}
            </button>
          ))}
        </div>

        <div
          id="sig-panel"
          role="tabpanel"
          aria-labelledby={`sig-tab-${item.slug}`}
          aria-live={paused ? 'polite' : 'off'}
          className="bg-surface shadow-card mt-6 grid overflow-hidden rounded-2xl md:grid-cols-[1.2fr_1fr]"
        >
          <DishPhoto
            monogram={monogram}
            key={item.slug}
            path={item.photoPath}
            alt={name}
            sizes="(min-width: 768px) 640px, 100vw"
            className="aspect-[4/3] w-full motion-safe:animate-[fade-in_0.5s_ease-out]"
          />
          <div className="flex flex-col justify-center gap-4 p-6 md:p-10">
            <h3 className="flex items-start gap-3 text-2xl font-extrabold md:text-3xl">
              <VegMark
                veg={item.isVeg}
                label={t(item.isVeg ? 'common.vegLabel' : 'common.nonVegLabel')}
                className="mt-2.5"
              />
              {name}
            </h3>
            {item.description && (
              <p className="text-muted text-lg">{pickText(item.description, locale)}</p>
            )}
            <p className="tabular text-2xl font-bold">{formatGel(item.priceTetri, locale)}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => quickAdd(item.slug)} disabled={!item.isAvailable}>
                <PlusIcon />
                {item.isAvailable ? t('home.addToOrder') : t('common.soldOut')}
              </Button>
              {inOrder > 0 && (
                <span className="text-ok text-sm font-semibold">
                  {t('home.inOrder', { q: inOrder })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
