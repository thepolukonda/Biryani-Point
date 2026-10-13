'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { cn } from '@/shared/cn';
import type { Schedule } from '@/shared/domain/hours';
import { describeOpenState, type OpenLabel } from '@/shared/domain/open-label';

/**
 * Live "Open now, until 23:00" / "Closed, opens tomorrow at 12:00" chip.
 * Starts with the server's answer (no hydration mismatch), then re-checks every
 * minute in the browser, so a cached page never shows a stale status for long.
 */
export function OpenStatus({
  schedule,
  initial,
  className,
  tone = 'light',
}: {
  schedule: Schedule;
  initial: OpenLabel;
  className?: string;
  tone?: 'light' | 'dark';
}) {
  const label = useOpenLabel(schedule, initial);
  const text = useOpenText(label);
  const open = label.kind === 'open';

  return (
    <span
      className={cn(
        'inline-flex min-h-8 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap',
        tone === 'light' && (open ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger'),
        tone === 'dark' && 'text-on-night bg-white/10',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full',
          open ? 'bg-veg shadow-[0_0_0_3px_rgb(30_142_62/0.2)]' : 'bg-chili',
        )}
      />
      <span>{text}</span>
    </span>
  );
}

export function useOpenLabel(schedule: Schedule, initial: OpenLabel): OpenLabel {
  const [label, setLabel] = useState(initial);
  useEffect(() => {
    const tick = () => setLabel(describeOpenState(new Date(), schedule));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [schedule]);
  return label;
}

export function useOpenText(label: OpenLabel): string {
  const t = useTranslations('status');
  const days = useTranslations('onDays');
  if (label.kind === 'open') return t('openUntil', { t: label.until });
  if (label.kind === 'closed-indefinitely') return t('closed');
  const next =
    label.opensWhen === 'today'
      ? t('today', { t: label.time })
      : label.opensWhen === 'tomorrow'
        ? t('tomorrow', { t: label.time })
        : t('onDay', { d: days(label.weekday), t: label.time });
  return t('closedOpens', { next });
}
