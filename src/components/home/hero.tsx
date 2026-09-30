import { useLocale, useTranslations } from 'next-intl';
import { Roundel } from '@/components/brand/logo';
import { DishPhoto } from '@/components/menu/dish-photo';
import { OpenSign } from '@/components/restaurant/open-sign';
import { ButtonLink, ButtonAnchor } from '@/components/ui/button';
import { ArrowRightIcon, ClockIcon, PinIcon, TruckIcon } from '@/components/ui/icons';
import type { MenuItem } from '@/lib/domain/menu';
import { formatAmount } from '@/lib/domain/money';
import type { OpenLabel } from '@/lib/domain/open-label';
import { formatGeorgianPhone } from '@/lib/domain/phone';
import type { Locale } from '@/lib/domain/i18n-text';
import { profileText, type RestaurantInfo } from '@/lib/domain/restaurant';

export function Hero({
  restaurant,
  initialOpen,
  heroItem,
  dishCount,
  fromTetri,
}: {
  restaurant: RestaurantInfo;
  initialOpen: OpenLabel;
  heroItem: MenuItem | undefined;
  dishCount: number;
  fromTetri: number;
}) {
  const t = useTranslations();
  const brand = profileText(restaurant.profile, useLocale() as Locale);
  const nameWords = brand.brandName.trim().split(/\s+/);
  const nameLast = nameWords.length > 1 ? nameWords.pop() : undefined;

  return (
    <section
      className="on-dark bg-night text-on-night relative overflow-hidden"
      aria-labelledby="hero-title"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(circle_at_80%_10%,rgb(233_167_45/0.35),transparent_45%),radial-gradient(circle_at_0%_100%,rgb(209_54_29/0.25),transparent_40%)]"
      />
      <div className="relative mx-auto grid w-[min(1240px,100%-32px)] items-center gap-10 py-10 md:py-16 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-gold text-sm font-semibold tracking-[0.18em] uppercase">
            {brand.tagline}
          </p>
          <h1
            id="hero-title"
            className="font-display mt-3 text-[clamp(2.4rem,7vw,4.5rem)] leading-[1.02] text-balance"
          >
            {brand.headline || brand.siteName}
          </h1>
          {brand.intro && (
            <p className="text-on-night-muted mt-5 max-w-xl text-lg">{brand.intro}</p>
          )}
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/menu" size="lg">
              {t('home.ctaOrder')}
              <ArrowRightIcon />
            </ButtonLink>
            <ButtonAnchor
              href="#visit"
              size="lg"
              variant="outline"
              className="text-on-night hover:border-gold border-white/25 bg-transparent"
            >
              {t('home.ctaFind')}
            </ButtonAnchor>
          </div>
          <ul className="text-on-night-muted [&_svg]:text-gold mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm [&_svg]:size-4">
            <li className="inline-flex items-center gap-2">
              <TruckIcon />
              {t('home.fact1')}
            </li>
            <li className="inline-flex items-center gap-2">
              <ClockIcon />
              {t('home.fact2')}
            </li>
            {brand.street && (
              <li className="inline-flex items-center gap-2">
                <PinIcon />
                {brand.street}
              </li>
            )}
          </ul>
          <dl className="mt-8 grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-6">
            <div>
              <dt className="sr-only">{t('home.statDishes')}</dt>
              <dd className="font-display text-on-night text-3xl">{dishCount}</dd>
              <dd className="text-on-night-muted text-xs">{t('home.statDishes')}</dd>
            </div>
            <div>
              <dt className="sr-only">{t('home.statFrom')}</dt>
              <dd className="font-display text-on-night text-3xl">
                {formatAmount(fromTetri).replace(/\.00$/, '')}
                <span className="text-lg"> ₾</span>
              </dd>
              <dd className="text-on-night-muted text-xs">{t('home.statFrom')}</dd>
            </div>
            <div>
              <dt className="sr-only">{t('home.statLanguages')}</dt>
              <dd className="font-display text-on-night text-3xl">3</dd>
              <dd className="text-on-night-muted text-xs">{t('home.statLanguages')}</dd>
            </div>
          </dl>
        </div>

        {/* The shop sign from the prototype, with a live OPEN / CLOSED board. */}
        <div className="relative mx-auto w-full max-w-[520px]">
          <DishPhoto
            monogram={restaurant.profile.monogram}
            path={heroItem?.photoPath ?? null}
            alt=""
            sizes="(min-width: 1024px) 520px, 90vw"
            priority
            className="aspect-[4/3] w-full rounded-2xl ring-1 ring-white/10"
          />
          <div className="border-gold/40 bg-night-soft/95 shadow-lift absolute -bottom-6 left-4 flex max-w-[calc(100%-2rem)] items-center gap-4 rounded-xl border p-4 backdrop-blur sm:left-6">
            <Roundel monogram={restaurant.profile.monogram} className="size-14 shrink-0" />
            <div className="min-w-0">
              <p
                className="font-black tracking-[0.12em] whitespace-nowrap uppercase"
                translate="no"
              >
                {nameWords.join(' ')}
                {nameLast && <span className="text-gold"> {nameLast}</span>}
              </p>
              <p className="text-on-night-muted truncate text-xs">{brand.tagline}</p>
              <a
                href={`tel:${restaurant.phone}`}
                className="tabular text-gold mt-0.5 block text-sm hover:underline"
              >
                {formatGeorgianPhone(restaurant.phone)}
              </a>
            </div>
            <OpenSign schedule={restaurant.schedule} initial={initialOpen} />
          </div>
        </div>
      </div>
    </section>
  );
}
