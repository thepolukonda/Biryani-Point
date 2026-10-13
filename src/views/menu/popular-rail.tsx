'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useShop, useMonogram } from '@/views/providers/shop-provider';
import { pickText, type Locale } from '@/shared/domain/i18n-text';
import { DishPhoto } from './dish-photo';
import { Price } from './price';
import { QuantityControl } from './quantity-control';

/** Horizontally scrolling "Popular" cards (falls back to the first dishes). */
export function PopularRail() {
  const monogram = useMonogram();
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const { menu, openItem } = useShop();
  let items = menu.items.filter((i) => i.isPopular);
  if (items.length < 3) items = menu.items.slice(0, 6);
  if (items.length === 0) return null;

  return (
    <section
      id="popular"
      className="scroll-mt-44 pt-6 md:scroll-mt-36"
      aria-labelledby="popular-title"
    >
      <h2 id="popular-title" className="mb-3.5 text-xl font-extrabold tracking-tight md:text-2xl">
        {t('menu.popularTitle')}
      </h2>
      <ul className="-mx-4 flex snap-x snap-mandatory scrollbar-none gap-3.5 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0.5">
        {items.map((item) => {
          const name = pickText(item.name, locale);
          return (
            <li key={item.slug} className="relative w-[62%] shrink-0 snap-start sm:w-56">
              <div className="relative">
                <DishPhoto
                  monogram={monogram}
                  path={item.photoPath}
                  alt=""
                  sizes="(min-width: 640px) 224px, 62vw"
                  soldOut={!item.isAvailable}
                  className="aspect-[4/3] w-full rounded-xl"
                />
                <QuantityControl itemSlug={item.slug} className="absolute right-2.5 bottom-2.5" />
              </div>
              <h3 className="mt-2.5 leading-snug font-semibold">
                <button
                  type="button"
                  onClick={() => openItem(item.slug)}
                  className="focus-visible:after:outline-ink text-left after:absolute after:inset-0 after:z-[1] after:content-[''] hover:underline focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:outline-3"
                >
                  {name}
                </button>
              </h3>
              <Price tetri={item.priceTetri} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
