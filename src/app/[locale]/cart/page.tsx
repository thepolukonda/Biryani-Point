import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CartPageView } from '@/views/cart/cart-page';
import { loadBrand } from '@/controllers/site/shop';
import type { Locale } from '@/shared/domain/i18n-text';
import { pageMetadata } from '@/shared/seo/metadata';

export async function generateMetadata({ params }: PageProps<'/[locale]/cart'>): Promise<Metadata> {
  const { locale } = (await params) as { locale: Locale };
  const [t, brand] = await Promise.all([
    getTranslations({ locale, namespace: 'meta' }),
    loadBrand(locale),
  ]);
  return pageMetadata({
    locale,
    path: '/cart',
    title: t('cartTitle'),
    siteName: brand.siteName,
    noindex: true,
  });
}

export default async function CartPage({ params }: PageProps<'/[locale]/cart'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="mx-auto w-[min(1240px,100%-32px)]">
      <CartPageView />
    </div>
  );
}
