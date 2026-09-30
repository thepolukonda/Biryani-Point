'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import type { Schedule } from '@/lib/domain/hours';
import type { OpenLabel } from '@/lib/domain/open-label';
import { useOpenLabel, useOpenText } from './open-status';

/** The glowing OPEN / CLOSED board from the prototype's shop sign. Live. */
export function OpenSign({ schedule, initial }: { schedule: Schedule; initial: OpenLabel }) {
  const t = useTranslations('status');
  const label = useOpenLabel(schedule, initial);
  const text = useOpenText(label);
  const open = label.kind === 'open';

  return (
    <div className="ml-auto shrink-0 text-center" title={text}>
      <span
        className={cn(
          'block rounded-md border-2 px-2.5 py-1 text-xs font-black tracking-[0.14em]',
          open
            ? 'border-[#4ade80] text-[#86efac] shadow-[0_0_14px_rgb(74_222_128/0.45)]'
            : 'border-chili text-[#fca5a5] shadow-[0_0_14px_rgb(209_54_29/0.45)]',
        )}
      >
        {open ? t('openSign') : t('closedSign')}
      </span>
      <span className="sr-only">{text}</span>
      <span
        aria-hidden
        className="text-on-night-muted mt-1 block max-w-24 text-[10px] leading-tight"
      >
        {label.kind === 'open'
          ? t('until', { t: label.until })
          : label.kind === 'closed'
            ? t('opens', { next: label.time })
            : ''}
      </span>
    </div>
  );
}
