import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fillLegal, LEGAL, type LegalPage } from '@/content/legal';
import { getBrand, getRestaurant } from '@/lib/data/restaurant';
import { formatGeorgianPhone } from '@/lib/domain/phone';
import { profileText } from '@/lib/domain/restaurant';
import { orderLabel } from '@/lib/orders/format';
import type { Locale } from '@/lib/domain/i18n-text';
import { pageMetadata } from '@/lib/seo/metadata';

export async function legalMetadata(locale: Locale, page: LegalPage): Promise<Metadata> {
  const [t, brand] = await Promise.all([
    getTranslations({ locale, namespace: 'legal' }),
    getBrand(locale),
  ]);
  return pageMetadata({
    locale,
    path: `/${page}`,
    title: t(page),
    description: t(`${page}Description`, { name: brand.siteName }),
    siteName: brand.siteName,
  });
}

export async function LegalPageView({ locale, page }: { locale: Locale; page: LegalPage }) {
  setRequestLocale(locale);
  const [t, restaurant] = await Promise.all([
    getTranslations({ locale, namespace: 'legal' }),
    getRestaurant(),
  ]);
  const doc = LEGAL[locale][page];
  const brand = profileText(restaurant.profile, locale);
  const fill = (text: string) =>
    fillLegal(text, {
      name: brand.siteName,
      address: brand.address,
      phone: formatGeorgianPhone(restaurant.phone),
      orderExample: orderLabel(restaurant.profile.orderPrefix, 1042),
    });
  return (
    <article className="mx-auto w-[min(760px,100%-32px)] py-12">
      <h1 className="font-display text-4xl leading-tight">{t(page)}</h1>
      <p className="text-muted mt-2 text-sm">{t('updated', { date: doc.updated })}</p>
      {doc.sections.map((s) => (
        <section key={s.heading} className="mt-8">
          <h2 className="text-xl font-extrabold">{s.heading}</h2>
          {s.body.map((p) => (
            <p key={p} className="text-ink-soft mt-3 leading-relaxed">
              {fill(p)}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
