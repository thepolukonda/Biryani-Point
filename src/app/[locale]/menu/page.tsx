import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Roundel } from '@/views/brand/logo';
import { OrderPanel } from '@/views/cart/order-panel';
import { DishPhoto } from '@/views/menu/dish-photo';
import { MenuBrowser } from '@/views/menu/menu-browser';
import { OrderAgain } from '@/views/menu/order-again';
import { OpenStatus } from '@/views/restaurant/open-status';
import { ButtonAnchor } from '@/views/ui/button';
import { PhoneIcon, PinIcon, StarIcon, TruckIcon, WhatsAppIcon } from '@/views/ui/icons';
import { loadBrand, loadMenu, loadRestaurant } from '@/controllers/site/shop';
import { pickText, type Locale } from '@/shared/domain/i18n-text';
import { formatGel } from '@/shared/domain/money';
import { describeOpenState } from '@/shared/domain/open-label';
import { siteUrl } from '@/config/env';
import { directionsUrl, whatsappUrl } from '@/shared/links';
import { jsonLdString, restaurantJsonLd } from '@/shared/seo/json-ld';
import { pageMetadata } from '@/shared/seo/metadata';

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<'/[locale]/menu'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const [t, brand] = await Promise.all([
    getTranslations({ locale, namespace: 'meta' }),
    loadBrand(locale),
  ]);
  return pageMetadata({
    locale,
    path: '/menu',
    title: t('menuTitle'),
    description: brand.menuDescription,
    siteName: brand.siteName,
  });
}

export default async function MenuPage({ params }: PageProps<'/[locale]/menu'>) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const [menu, restaurant, t, brand] = await Promise.all([
    loadMenu(),
    loadRestaurant(),
    getTranslations({ locale }),
    loadBrand(locale),
  ]);
  const initialOpen = describeOpenState(new Date(), restaurant.schedule);
  const { freeDeliveryOverTetri, deliveryFeeTetri } = restaurant.fees;

  return (
    <div className="mx-auto w-[min(1240px,100%-32px)] pb-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdString(
            restaurantJsonLd({
              restaurant,
              menu,
              locale,
              siteUrl,
              description: brand.menuDescription,
            }),
          ),
        }}
      />

      {/* Venue header (prototype order page) */}
      <section className="pt-3 md:pt-5" aria-labelledby="venue-title">
        <div className="relative flex h-40 items-center justify-end overflow-hidden rounded-xl bg-[linear-gradient(120deg,#f7b32b,#ee9a12_55%,#e08a0a)] px-5 md:h-60 md:rounded-2xl md:px-14">
          <span
            aria-hidden
            className="border-on-gold/20 absolute -top-16 -left-16 size-80 rounded-full border-2 border-dashed"
          />
          <span
            aria-hidden
            className="border-on-gold/20 absolute right-[30%] -bottom-36 size-64 rounded-full border-2 border-dashed"
          />
          <p className="text-on-gold relative max-w-[11ch] text-right text-[clamp(1.75rem,4.6vw,3.75rem)] leading-[0.98] font-extrabold tracking-tight">
            {t('menu.cover')}
          </p>
        </div>
        <div className="relative -mt-11 flex flex-wrap items-end gap-x-5 gap-y-3 px-1 md:-mt-14 md:px-7">
          <div className="border-surface bg-night shadow-lift grid size-24 shrink-0 place-items-center rounded-full border-4 md:size-32 md:border-[5px]">
            <Roundel
              className="size-full"
              monogram={restaurant.profile.monogram}
              label={brand.brandName}
            />
          </div>
          <div className="min-w-0 flex-1 basis-[calc(100%-120px)] pt-12 md:basis-auto md:pt-0 md:pb-1">
            <h1
              id="venue-title"
              className="text-2xl leading-tight font-extrabold tracking-tight md:text-[34px]"
            >
              {brand.siteName}
            </h1>
            {brand.specialties && (
              <p className="text-muted text-[13.5px] md:text-[15px]">{brand.specialties}</p>
            )}
          </div>
          <div className="flex basis-full gap-2 md:basis-auto md:pb-1.5">
            <ButtonAnchor
              href={`tel:${restaurant.phone}`}
              size="sm"
              variant="soft"
              className="flex-1 md:flex-none"
            >
              <PhoneIcon />
              {t('visit.call')}
            </ButtonAnchor>
            <ButtonAnchor
              href={whatsappUrl(restaurant.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              size="sm"
              variant="whatsapp"
              className="flex-1 md:flex-none"
            >
              <WhatsAppIcon />
              WhatsApp
            </ButtonAnchor>
          </div>
        </div>
        <ul className="mt-3.5 flex flex-wrap gap-2 px-1 md:mt-4.5 md:px-7">
          <li className="shrink-0">
            <OpenStatus schedule={restaurant.schedule} initial={initialOpen} />
          </li>
          <li className="bg-soft [&_svg]:text-muted inline-flex min-h-8 shrink-0 items-center gap-2 rounded-full px-3 text-sm whitespace-nowrap [&_svg]:size-4">
            <TruckIcon />
            {t('menu.pickupOrDelivery')}
          </li>
          {deliveryFeeTetri > 0 && freeDeliveryOverTetri > 0 && (
            <li className="bg-soft inline-flex min-h-8 shrink-0 items-center rounded-full px-3 text-sm whitespace-nowrap">
              {t('menu.freeDeliveryOver', { amount: formatGel(freeDeliveryOverTetri, locale) })}
            </li>
          )}
          {brand.street && (
            <li className="bg-soft [&_svg]:text-muted inline-flex min-h-8 shrink-0 items-center gap-2 rounded-full px-3 text-sm whitespace-nowrap [&_svg]:size-4">
              <PinIcon />
              {brand.street}
            </li>
          )}
        </ul>
      </section>

      {/* Big category tiles */}
      <nav aria-label={t('menu.categoriesLabel')} className="mt-6 md:mt-8">
        <ul className="-mx-4 flex scrollbar-none gap-1 overflow-x-auto px-3 pb-1.5 md:mx-0 md:gap-3.5 md:px-0.5">
          <li>
            <a
              href="#popular"
              className="hover:bg-soft flex w-23 flex-col items-center gap-2.5 rounded-xl p-2 text-center md:w-31 md:px-2 md:py-3.5"
            >
              <span className="bg-gold-soft text-gold-text grid size-18 place-items-center rounded-full shadow-[0_6px_18px_rgb(23_19_15/0.12)] md:size-24 [&_svg]:size-10">
                <StarIcon />
              </span>
              <b className="text-[13px] leading-tight font-semibold md:text-sm">
                {t('menu.popularTitle')}
              </b>
            </a>
          </li>
          {menu.categories.map((c) => {
            const items = menu.items.filter((i) => i.categorySlug === c.slug);
            const cover = items.find((i) => i.photoPath);
            return (
              <li key={c.slug}>
                <a
                  href={`#cat-${c.slug}`}
                  className="group hover:bg-soft flex w-23 flex-col items-center gap-2.5 rounded-xl p-2 text-center md:w-31 md:px-2 md:py-3.5"
                >
                  <DishPhoto
                    monogram={restaurant.profile.monogram}
                    path={cover?.photoPath ?? null}
                    alt=""
                    sizes="96px"
                    className="size-18 rounded-full shadow-[0_6px_18px_rgb(23_19_15/0.12)] transition-transform group-hover:-translate-y-0.5 md:size-24"
                  />
                  <span>
                    <b className="block text-[13px] leading-tight font-semibold md:text-sm">
                      {pickText(c.name, locale)}
                    </b>
                    <small className="text-muted hidden text-xs md:block">{items.length}</small>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="grid items-start gap-9 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <OrderAgain />
          <MenuBrowser />
          <p className="text-muted mt-8 text-sm">{t('home.menuNote')}</p>
        </div>
        <OrderPanel />
      </div>

      {/* Info */}
      <section
        className="bg-soft mt-14 grid gap-4 rounded-2xl p-6 md:p-8"
        aria-labelledby="info-title"
      >
        <h2 id="info-title" className="text-2xl font-extrabold">
          {t('nav.info')}
        </h2>
        <div className="bg-surface flex flex-col rounded-xl p-5">
          <h3 className="font-bold">{brand.street || brand.siteName}</h3>
          <p className="text-muted">{brand.cityLine}</p>
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
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
              {t('visit.call')}
            </ButtonAnchor>
          </div>
        </div>
      </section>
    </div>
  );
}
