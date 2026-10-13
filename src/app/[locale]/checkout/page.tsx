import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckoutForm } from '@/views/checkout/checkout-form';
import { canPayOnline, loadBrand } from '@/controllers/site/shop';
import type { Locale } from '@/shared/domain/i18n-text';
import { pageMetadata } from '@/shared/seo/metadata';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/checkout'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const [t, brand] = await Promise.all([
    getTranslations({ locale, namespace: 'meta' }),
    loadBrand(locale),
  ]);
  return pageMetadata({
    locale,
    path: '/checkout',
    title: t('checkoutTitle'),
    siteName: brand.siteName,
    noindex: true,
  });
}

export default async function CheckoutPage({ params }: PageProps<'/[locale]/checkout'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="mx-auto w-[min(1240px,100%-32px)]">
      <CheckoutForm onlinePayments={canPayOnline()} />
    </div>
  );
}
