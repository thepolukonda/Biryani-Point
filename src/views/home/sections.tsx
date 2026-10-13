import { useLocale, useTranslations } from 'next-intl';
import { DishPhoto } from '@/views/menu/dish-photo';
import { ButtonAnchor, ButtonLink } from '@/views/ui/button';
import {
  ArrowRightIcon,
  ClockIcon,
  FlameIcon,
  LeafIcon,
  PhoneIcon,
  PinIcon,
  StarIcon,
  TruckIcon,
  WhatsAppIcon,
} from '@/views/ui/icons';
import { Link } from '@/config/i18n/navigation';
import { pickText, type Locale } from '@/shared/domain/i18n-text';
import type { Menu } from '@/shared/domain/menu';
import { profileText, type BrandText, type RestaurantInfo } from '@/shared/domain/restaurant';
import { directionsUrl, osmEmbedUrl, osmUrl, whatsappUrl } from '@/shared/links';

const wrap = 'mx-auto w-[min(1240px,100%-32px)]';

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="text-gold-text text-sm font-bold tracking-[0.16em] uppercase">{children}</p>;
}

export function Marquee({ words }: { words: string[] }) {
  if (words.length === 0) return null;
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-8 pr-8" aria-hidden={hidden || undefined}>
      {words.map((w) => (
        <li key={w} className="flex items-center gap-8 whitespace-nowrap">
          {w}
          <span aria-hidden className="text-on-gold/50">
            ✺
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="bg-gold text-on-gold overflow-hidden py-3 text-sm font-bold">
      <div className="animate-marquee flex w-max motion-reduce:animate-none">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}

// One icon per "why us" card, in order.
const FEATURE_ICONS = [FlameIcon, ClockIcon, TruckIcon, LeafIcon];

export function About({ brand }: { brand: BrandText }) {
  const t = useTranslations('home');
  if (!brand.aboutTitle && brand.aboutParagraphs.length === 0 && brand.features.length === 0)
    return null;
  return (
    <section
      id="about"
      className={`${wrap} scroll-mt-24 py-16 md:py-24`}
      aria-labelledby="about-title"
    >
      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div>
          <Kicker>{t('aboutKicker')}</Kicker>
          <h2
            id="about-title"
            className="font-display mt-3 text-[clamp(2rem,4.5vw,3rem)] leading-tight text-balance"
          >
            {brand.aboutTitle}
          </h2>
          {brand.aboutParagraphs.map((p, i) => (
            <p key={i} className={`text-muted text-lg ${i === 0 ? 'mt-5' : 'mt-4'}`}>
              {p}
            </p>
          ))}
        </div>
        {brand.features.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {brand.features.map(({ title, text }, i) => {
              const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length]!;
              return (
                <li key={i} className="bg-surface shadow-card rounded-xl p-5">
                  <span className="bg-gold-soft text-gold-text grid size-11 place-items-center rounded-md [&_svg]:size-5">
                    <Icon />
                  </span>
                  <h3 className="mt-4 font-bold">{title}</h3>
                  {text && <p className="text-muted mt-1 text-sm">{text}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

export function WhatWeServe({ menu, monogram }: { menu: Menu; monogram: string }) {
  const t = useTranslations('home');
  const locale = useLocale() as Locale;
  return (
    <section
      id="food"
      className="bg-surface scroll-mt-24 py-16 md:py-24"
      aria-labelledby="serve-title"
    >
      <div className={wrap}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Kicker>{t('serveKicker')}</Kicker>
            <h2
              id="serve-title"
              className="font-display mt-3 text-[clamp(2rem,4.5vw,3rem)] leading-tight"
            >
              {t('serveTitle')}
            </h2>
          </div>
          <ButtonLink href="/menu" variant="dark">
            {t('fullMenu')}
            <ArrowRightIcon />
          </ButtonLink>
        </div>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {menu.categories.map((category) => {
            const items = menu.items.filter((i) => i.categorySlug === category.slug);
            const cover =
              items.find((i) => i.isPopular && i.photoPath) ??
              items.find((i) => i.photoPath) ??
              items[0];
            const name = pickText(category.name, locale);
            return (
              <li key={category.slug}>
                <Link
                  href={{ pathname: '/menu', hash: `cat-${category.slug}` }}
                  className="group bg-night text-on-night relative block overflow-hidden rounded-2xl"
                >
                  <DishPhoto
                    monogram={monogram}
                    path={cover?.photoPath ?? null}
                    alt=""
                    sizes="(min-width: 768px) 400px, 100vw"
                    className="aspect-[4/3] w-full opacity-80 transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="from-night via-night/60 absolute inset-0 flex flex-col justify-end bg-gradient-to-t to-transparent p-5">
                    <span className="tabular text-gold text-sm font-bold">{items.length}</span>
                    <h3 className="text-2xl font-extrabold">{name}</h3>
                    <p className="text-on-night-muted mt-1 line-clamp-2 text-sm">
                      {category.blurb
                        ? pickText(category.blurb, locale)
                        : items
                            .slice(0, 3)
                            .map((i) => pickText(i.name, locale))
                            .join(', ')}
                    </p>
                    <span className="text-gold mt-3 inline-flex items-center gap-1.5 text-sm font-semibold [&_svg]:size-4">
                      {t('seeDishes', { n: items.length })}
                      <ArrowRightIcon />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function OwnerNote({ restaurant }: { restaurant: RestaurantInfo }) {
  const t = useTranslations('home');
  const locale = useLocale() as Locale;
  if (!restaurant.owner.note) return null;
  return (
    <section className={`${wrap} py-12`} aria-labelledby="owner-title">
      <figure className="bg-gold-soft rounded-2xl p-8 md:p-12">
        <h2
          id="owner-title"
          className="text-gold-text text-sm font-bold tracking-[0.16em] uppercase"
        >
          {t('ownerTitle')}
        </h2>
        <blockquote className="font-display mt-4 text-2xl leading-snug md:text-3xl">
          “{pickText(restaurant.owner.note, locale)}”
        </blockquote>
        {restaurant.owner.name && (
          <figcaption className="mt-4 font-semibold">{restaurant.owner.name}</figcaption>
        )}
      </figure>
    </section>
  );
}

export function Visit({ restaurant }: { restaurant: RestaurantInfo }) {
  const t = useTranslations();
  const brand = profileText(restaurant.profile, useLocale() as Locale);
  return (
    <section
      id="visit"
      className={`${wrap} scroll-mt-24 py-16 md:py-24`}
      aria-labelledby="visit-title"
    >
      <Kicker>{t('visit.kicker')}</Kicker>
      <h2
        id="visit-title"
        className="font-display mt-3 text-[clamp(2rem,4.5vw,3rem)] leading-tight"
      >
        {t('visit.title')}
      </h2>
      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="bg-surface shadow-card flex flex-col rounded-xl p-6">
          <span className="bg-gold-soft text-gold-text grid size-11 place-items-center rounded-md [&_svg]:size-5">
            <PinIcon />
          </span>
          <address className="mt-4 not-italic">
            <b className="block text-lg">{brand.street || brand.siteName}</b>
            <span className="text-muted">{brand.cityLine}</span>
          </address>
          <div className="mt-auto flex flex-wrap gap-2 pt-5">
            <ButtonAnchor
              href={directionsUrl(restaurant.location)}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              variant="dark"
            >
              {t('visit.directions')}
            </ButtonAnchor>
            <ButtonAnchor href={`tel:${restaurant.phone}`} size="sm" variant="soft">
              <PhoneIcon />
              {t('visit.call')}
            </ButtonAnchor>
            <ButtonAnchor
              href={whatsappUrl(restaurant.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              variant="whatsapp"
            >
              <WhatsAppIcon />
              WhatsApp
            </ButtonAnchor>
          </div>
        </div>

        <div className="bg-soft-2 overflow-hidden rounded-xl lg:row-span-1">
          <iframe
            title={t('visit.mapTitle', { name: brand.brandName })}
            src={osmEmbedUrl(restaurant.location)}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="block h-full min-h-72 w-full border-0"
          />
          <a
            href={osmUrl(restaurant.location)}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-surface text-gold-text block px-4 py-2.5 text-sm font-semibold hover:underline"
          >
            {t('home.mapLink')}
          </a>
        </div>
      </div>

      {restaurant.googleReviewUrl && (
        <div className="bg-surface shadow-card mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <span className="text-gold [&_svg]:size-6">
              <StarIcon />
            </span>
            <div>
              <b className="block">{t('visit.reviewTitle')}</b>
              <span className="text-muted text-sm">{t('visit.reviewSub')}</span>
            </div>
          </div>
          <ButtonAnchor
            href={restaurant.googleReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
          >
            {t('visit.reviewAction')}
          </ButtonAnchor>
        </div>
      )}
    </section>
  );
}

export function HowItWorks() {
  const t = useTranslations('home');
  return (
    <section className="bg-surface py-16" aria-labelledby="how-title">
      <div className={wrap}>
        <h2 id="how-title" className="font-display text-3xl">
          {t('howTitle')}
        </h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[t('how1'), t('how2'), t('how3')].map((step, i) => (
            <li key={step} className="border-line flex gap-4 rounded-xl border p-5">
              <span className="bg-ink text-gold grid size-10 shrink-0 place-items-center rounded-full font-extrabold">
                {i + 1}
              </span>
              <p className="pt-1.5">{step}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function OrderCta() {
  const t = useTranslations('home');
  return (
    <section className={`${wrap} pb-16 md:pb-24`} aria-labelledby="cta-title">
      <div className="on-dark bg-night text-on-night flex flex-col items-start justify-between gap-6 rounded-2xl p-8 md:flex-row md:items-center md:p-12">
        <div>
          <h2 id="cta-title" className="font-display text-3xl md:text-4xl">
            {t('ctaTitle')}
          </h2>
          <p className="text-on-night-muted mt-2 max-w-xl">{t('ctaSub')}</p>
        </div>
        <ButtonLink href="/menu" size="lg">
          {t('ctaOrder')}
          <ArrowRightIcon />
        </ButtonLink>
      </div>
    </section>
  );
}
