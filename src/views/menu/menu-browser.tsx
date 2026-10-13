'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useShop } from '@/views/providers/shop-provider';
import { SearchIcon } from '@/views/ui/icons';
import { cn } from '@/shared/cn';
import { type Locale } from '@/shared/domain/i18n-text';
import type { MenuItem } from '@/shared/domain/menu';
import { pickText } from '@/shared/domain/i18n-text';
import { DishCard } from './dish-card';
import { PopularRail } from './popular-rail';

type Diet = 'all' | 'veg' | 'nonveg';

function searchText(item: MenuItem): string {
  return [
    item.name.en,
    item.name.ka,
    item.name.ru,
    item.description?.en,
    item.description?.ka,
    item.description?.ru,
    item.isVeg ? 'veg vegetarian უხორცო вегетарианское' : 'chicken meat ქათამი курица',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * Sticky category tabs with scroll-spy, search and a veg filter, over the
 * Popular rail and the dish sections (same behaviour as the prototype).
 */
export function MenuBrowser() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const { menu } = useShop();
  const [query, setQuery] = useState('');
  const [diet, setDiet] = useState<Diet>('all');
  const deferredQuery = useDeferredValue(query);
  const [active, setActive] = useState(menu.categories[0]?.slug ?? '');
  const tabBar = useRef<HTMLUListElement>(null);

  const haystack = useMemo(
    () => new Map(menu.items.map((i) => [i.slug, searchText(i)])),
    [menu.items],
  );
  const q = deferredQuery.trim().toLowerCase();
  const filtering = q !== '' || diet !== 'all';
  const visible = menu.items.filter(
    (i) =>
      (diet === 'all' || (diet === 'veg') === i.isVeg) &&
      (!q || q.split(/\s+/).every((word) => haystack.get(i.slug)!.includes(word))),
  );
  const sections = menu.categories
    .map((c) => ({ category: c, items: visible.filter((i) => i.categorySlug === c.slug) }))
    .filter((s) => s.items.length > 0);

  // Scroll-spy: highlight the tab of the section in the middle of the screen.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive((entry.target as HTMLElement).dataset.cat ?? '');
        }
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );
    document.querySelectorAll<HTMLElement>('[data-cat]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sections.length, q, diet]);

  // Keep the active tab visible in the horizontally scrolling bar.
  useEffect(() => {
    const bar = tabBar.current;
    const tab = bar?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (bar && tab) bar.scrollTo({ left: tab.offsetLeft - 8, behavior: 'smooth' });
  }, [active]);

  const dietOptions: { value: Diet; label: string }[] = [
    { value: 'all', label: t('common.all') },
    { value: 'veg', label: t('common.veg') },
    { value: 'nonveg', label: t('common.nonVeg') },
  ];

  return (
    <div id="menu">
      <div className="border-line bg-cream/95 sticky top-[calc(4rem+env(safe-area-inset-top))] z-30 -mx-4 border-b px-4 py-2.5 backdrop-blur md:top-[calc(72px+env(safe-area-inset-top))] md:mx-0 md:px-0">
        <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-3">
          <nav
            aria-label={t('menu.categoriesLabel')}
            className="order-3 min-w-0 basis-full md:order-none md:flex-1 md:basis-auto"
          >
            <ul ref={tabBar} className="flex scrollbar-none gap-1 overflow-x-auto">
              {sections.map(({ category }) => (
                <li key={category.slug}>
                  <a
                    href={`#cat-${category.slug}`}
                    data-tab={category.slug}
                    aria-current={active === category.slug ? 'true' : undefined}
                    className={cn(
                      'inline-flex min-h-10 items-center rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-colors',
                      active === category.slug
                        ? 'bg-ink text-white'
                        : 'text-muted hover:bg-soft hover:text-ink',
                    )}
                  >
                    {pickText(category.name, locale)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <label className="relative min-w-0 flex-1 md:w-64 md:flex-none">
            <span className="sr-only">{t('common.searchLabel')}</span>
            <SearchIcon className="text-muted pointer-events-none absolute top-1/2 left-3 size-[17px] -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('menu.searchDishes')}
              enterKeyHint="search"
              className="bg-surface h-10 w-full rounded-full border-0 pr-3 pl-9 text-[15px] shadow-[inset_0_0_0_1px_var(--color-line)] focus:shadow-[inset_0_0_0_2px_var(--color-gold-text)] focus:outline-none"
            />
          </label>

          <fieldset className="flex shrink-0 gap-1">
            <legend className="sr-only">{t('menu.dietLabel')}</legend>
            {dietOptions.map((option) => (
              <label key={option.value} className="relative">
                <input
                  type="radio"
                  name="diet"
                  value={option.value}
                  checked={diet === option.value}
                  onChange={() => setDiet(option.value)}
                  className="peer absolute inset-0 cursor-pointer opacity-0"
                />
                <span
                  className={cn(
                    'border-line text-muted inline-flex h-10 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold whitespace-nowrap transition-colors',
                    'peer-checked:border-ink peer-checked:bg-surface peer-checked:text-ink peer-focus-visible:outline-ink peer-focus-visible:outline-3',
                  )}
                >
                  {option.label}
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {filtering ? t('menu.filterResults', { count: visible.length }) : ''}
      </p>

      {!filtering && <PopularRail />}

      {sections.map(({ category, items }, sectionIndex) => (
        <section
          key={category.slug}
          id={`cat-${category.slug}`}
          data-cat={category.slug}
          aria-labelledby={`h-${category.slug}`}
          className="scroll-mt-44 pt-8 md:scroll-mt-36"
        >
          <div className="mb-2 flex flex-wrap items-baseline gap-x-2.5 md:mb-3.5">
            <h2
              id={`h-${category.slug}`}
              className="text-xl font-extrabold tracking-tight md:text-2xl"
            >
              {pickText(category.name, locale)}
            </h2>
            <span className="text-muted text-sm font-medium">{items.length}</span>
            {category.blurb && (
              <p className="text-muted basis-full text-sm">{pickText(category.blurb, locale)}</p>
            )}
          </div>
          <div className="grid md:grid-cols-2 md:gap-3.5">
            {items.map((item, i) => (
              <DishCard key={item.slug} item={item} priority={sectionIndex === 0 && i < 2} />
            ))}
          </div>
        </section>
      ))}

      {sections.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-lg font-bold">{t('menu.noResultsTitle')}</p>
          <p className="text-muted mt-1">{t('menu.noResultsSub')}</p>
        </div>
      )}
    </div>
  );
}
