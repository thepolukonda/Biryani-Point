import { useLocale } from 'next-intl';
import { cn } from '@/shared/cn';
import type { Locale } from '@/shared/domain/i18n-text';
import { formatGel, type Tetri } from '@/shared/domain/money';

export function Price({ tetri, className }: { tetri: Tetri; className?: string }) {
  const locale = useLocale() as Locale;
  return (
    <span className={cn('tabular font-bold whitespace-nowrap', className)}>
      {formatGel(tetri, locale)}
    </span>
  );
}
