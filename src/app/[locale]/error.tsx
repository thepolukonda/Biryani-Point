'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Roundel } from '@/components/brand/logo';
import { useShop } from '@/components/providers/shop-provider';
import { Button, ButtonAnchor } from '@/components/ui/button';
import { PhoneIcon } from '@/components/ui/icons';
import { reportError } from '@/lib/monitoring';

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations();
  const { restaurant } = useShop();
  useEffect(
    () => reportError(error, { digest: error.digest, where: 'customer error boundary' }),
    [error],
  );
  return (
    <div className="mx-auto grid w-[min(640px,100%-32px)] justify-items-center gap-3 py-20 text-center">
      <Roundel monogram={restaurant.profile.monogram} className="size-20" />
      <h1 className="text-3xl font-extrabold">{t('errors.errorTitle')}</h1>
      <p className="text-muted">{t('errors.errorSub')}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        <Button onClick={() => retry()}>{t('common.tryAgain')}</Button>
        <ButtonAnchor href={`tel:${restaurant.phone}`} variant="soft">
          <PhoneIcon />
          {t('visit.call')}
        </ButtonAnchor>
      </div>
    </div>
  );
}
