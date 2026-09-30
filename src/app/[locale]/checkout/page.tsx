import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CheckoutForm } from '@/components/checkout/checkout-form';
import { getBrand } from '@/lib/data/restaurant';
import type { Locale } from '@/lib/domain/i18n-text';
import { onlinePaymentsEnabled } from '@/lib/payments/registry';
import { pageMetadata } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/checkout'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const [t, brand] = await Promise.all([
    getTranslations({ locale, namespace: 'meta' }),
    getBrand(locale),
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
      <CheckoutForm onlinePayments={onlinePaymentsEnabled()} />
    </div>
  );
}
