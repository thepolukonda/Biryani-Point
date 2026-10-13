'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/config/i18n/navigation';
import { cn } from '@/shared/cn';
import type { Locale } from '@/shared/domain/i18n-text';

// Each language is named in itself, so people can find theirs.
const NAMES: Record<Locale, { short: string; full: string }> = {
  en: { short: 'EN', full: 'English' },
  ka: { short: 'ქარ', full: 'ქართული' },
  ru: { short: 'РУ', full: 'Русский' },
};

export function LanguageSwitcher({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const t = useTranslations('common');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [pending, startTransition] = useTransition();

  return (
    <label className={cn('relative inline-flex', className)}>
      <span className="sr-only">{t('language')}</span>
      <select
        value={locale}
        aria-label={t('language')}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as Locale;
          startTransition(() => {
            // @ts-expect-error -- params always match the current pathname
            router.replace({ pathname, params }, { locale: next, scroll: false });
          });
        }}
        className={cn(
          'bg-soft h-11 cursor-pointer appearance-none rounded-full pr-8 pl-3.5 text-sm font-semibold',
          'hover:bg-soft-2 focus-visible:outline-ink focus-visible:outline-3',
        )}
      >
        {(Object.keys(NAMES) as Locale[]).map((code) => (
          <option key={code} value={code} lang={code}>
            {compact ? NAMES[code].short : `${NAMES[code].short} · ${NAMES[code].full}`}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="text-muted pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </label>
  );
}
