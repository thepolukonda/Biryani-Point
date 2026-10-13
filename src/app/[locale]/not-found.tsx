import { getTranslations } from 'next-intl/server';
import { Roundel } from '@/views/brand/logo';
import { ButtonLink } from '@/views/ui/button';
import { loadRestaurant } from '@/controllers/site/shop';

export default async function NotFound() {
  // A 404 must still render when the database is down.
  const [t, monogram] = await Promise.all([
    getTranslations('errors'),
    loadRestaurant()
      .then((r) => r.profile.monogram)
      .catch(() => null),
  ]);
  return (
    <div className="mx-auto grid w-[min(640px,100%-32px)] justify-items-center gap-3 py-20 text-center">
      {monogram && <Roundel monogram={monogram} className="size-24" />}
      <p className="font-display text-gold-text text-7xl">404</p>
      <h1 className="text-3xl font-extrabold">{t('notFoundTitle')}</h1>
      <p className="text-muted">{t('notFoundSub')}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/menu">{t('goMenu')}</ButtonLink>
        <ButtonLink href="/" variant="soft">
          {t('goHome')}
        </ButtonLink>
      </div>
    </div>
  );
}
