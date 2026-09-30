import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import { OrderTracker } from '@/components/order/order-tracker';
import { ButtonAnchor, ButtonLink } from '@/components/ui/button';
import { WhatsAppIcon } from '@/components/ui/icons';
import { getPublicOrder } from '@/lib/data/public-order';
import { getRestaurant } from '@/lib/data/restaurant';
import type { Locale } from '@/lib/domain/i18n-text';
import { whatsappUrl } from '@/lib/links';
import { orderLabel } from '@/lib/orders/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/order/[publicId]'>): Promise<Metadata> {
  const { locale, publicId } = (await params) as { locale: Locale; publicId: string };
  const [t, order, restaurant] = await Promise.all([
    getTranslations({ locale, namespace: 'meta' }),
    getPublicOrder(publicId),
    getRestaurant(),
  ]);
  return {
    title: order
      ? t('trackTitle', { number: orderLabel(restaurant.profile.orderPrefix, order.order_number) })
      : (await getTranslations({ locale, namespace: 'track' }))('notFoundTitle'),
    // Private links: never indexed, never sent as a referrer.
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}

export default async function OrderPage({ params }: PageProps<'/[locale]/order/[publicId]'>) {
  const { locale, publicId } = (await params) as { locale: Locale; publicId: string };
  setRequestLocale(locale);
  const [order, restaurant, t] = await Promise.all([
    getPublicOrder(publicId),
    getRestaurant(),
    getTranslations(),
  ]);

  if (!order) {
    return (
      <div className="mx-auto grid w-[min(640px,100%-32px)] justify-items-center gap-3 py-20 text-center">
        <h1 className="text-3xl font-extrabold">{t('track.notFoundTitle')}</h1>
        <p className="text-muted">{t('track.notFoundSub')}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <ButtonAnchor
            href={whatsappUrl(restaurant.whatsapp)}
            variant="whatsapp"
            target="_blank"
            rel="noopener noreferrer"
          >
            <WhatsAppIcon />
            WhatsApp
          </ButtonAnchor>
          <ButtonLink href="/menu" variant="soft">
            {t('track.backToMenu')}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <Suspense>
      <OrderTracker initial={order} />
    </Suspense>
  );
}
