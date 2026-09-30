import { useLocale } from 'next-intl';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/domain/i18n-text';
import { formatGel, type Tetri } from '@/lib/domain/money';

export function Price({ tetri, className }: { tetri: Tetri; className?: string }) {
  const locale = useLocale() as Locale;
  return (
    <span className={cn('tabular font-bold whitespace-nowrap', className)}>
      {formatGel(tetri, locale)}
    </span>
  );
}
