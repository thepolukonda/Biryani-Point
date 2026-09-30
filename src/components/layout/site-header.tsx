import { useLocale, useTranslations } from 'next-intl';
import { Logo } from '@/components/brand/logo';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@/lib/domain/i18n-text';
import { logoBrand, profileText, type BusinessProfile } from '@/lib/domain/restaurant';
import { CartButton, MainNav } from './header-parts';
import { LanguageSwitcher } from './language-switcher';

export function SiteHeader({ profile }: { profile: BusinessProfile }) {
  const t = useTranslations('common');
  const siteName = profileText(profile, useLocale() as Locale).siteName;
  const brand = logoBrand(profile);
  return (
    <>
      <a
        href="#main"
        className="bg-ink fixed top-[-60px] left-3 z-[100] rounded-md px-4 py-2.5 font-semibold text-white focus:top-3"
      >
        {t('skipToMenu')}
      </a>
      <header className="border-line bg-surface/92 sticky top-0 z-40 border-b pt-[env(safe-area-inset-top)] backdrop-blur-md backdrop-saturate-150">
        <div className="mx-auto flex h-16 w-[min(1240px,100%-32px)] items-center gap-2 md:h-[72px] md:gap-3">
          <Link href="/" className="mr-auto rounded-md" aria-label={siteName}>
            <span className="md:hidden">
              <Logo brand={brand} size="sm" />
            </span>
            <span className="hidden md:block">
              <Logo brand={brand} />
            </span>
          </Link>
          <MainNav />
          <LanguageSwitcher compact className="max-sm:hidden" />
          <CartButton />
        </div>
      </header>
    </>
  );
}
