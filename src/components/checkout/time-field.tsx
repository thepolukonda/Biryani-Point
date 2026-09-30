'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useShop } from '@/components/providers/shop-provider';
import { cn } from '@/lib/cn';
import { getOpenState, getTimeSlots, zonedParts } from '@/lib/domain/hours';
import type { Locale } from '@/lib/domain/i18n-text';
import type { OrderType } from '@/lib/domain/pricing';

export type When = { kind: 'asap' } | { kind: 'scheduled'; at: string };

const INTL = { en: 'en-GB', ka: 'ka-GE', ru: 'ru-RU' } as const;

/** ASAP, or a time slot inside opening hours. ASAP is unavailable while closed. */
export function TimeField({
  orderType,
  value,
  onChange,
  onAvailableChange,
  error,
}: {
  orderType: OrderType;
  value: When;
  onChange: (value: When) => void;
  /** False while there is no time the order could be made for (closed, no slots left). */
  onAvailableChange?: (available: boolean) => void;
  error?: string;
}) {
  const t = useTranslations('checkout');
  const locale = useLocale() as Locale;
  const { restaurant } = useShop();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const lead =
    orderType === 'delivery' ? restaurant.prepMinutes.delivery : restaurant.prepMinutes.pickup;
  const accepting = getOpenState(now, restaurant.schedule).acceptingOrders;
  const slots = useMemo(
    () =>
      getTimeSlots(now, restaurant.schedule, {
        leadMinutes: lead,
        intervalMinutes: restaurant.slotIntervalMinutes,
        daysAhead: restaurant.scheduleDaysAhead,
      }),
    [now, restaurant, lead],
  );

  const available = accepting || slots.length > 0;
  useEffect(() => onAvailableChange?.(available), [available, onAvailableChange]);

  // Closed: switch to a scheduled time automatically.
  useEffect(() => {
    if (!accepting && value.kind === 'asap' && slots[0])
      onChange({ kind: 'scheduled', at: slots[0].toISOString() });
    if (
      value.kind === 'scheduled' &&
      slots.length &&
      !slots.some((s) => s.toISOString() === value.at)
    ) {
      onChange({ kind: 'scheduled', at: slots[0]!.toISOString() });
    }
  }, [accepting, slots, value, onChange]);

  const groups = useMemo(() => {
    const today = zonedParts(now, restaurant.timezone);
    const dayKey = (d: Date) => {
      const p = zonedParts(d, restaurant.timezone);
      return `${p.year}-${p.month}-${p.day}`;
    };
    const todayKey = `${today.year}-${today.month}-${today.day}`;
    const tomorrow = zonedParts(new Date(now.getTime() + 86_400_000), restaurant.timezone);
    const tomorrowKey = `${tomorrow.year}-${tomorrow.month}-${tomorrow.day}`;
    const time = new Intl.DateTimeFormat(INTL[locale], {
      timeZone: restaurant.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    const day = new Intl.DateTimeFormat(INTL[locale], {
      timeZone: restaurant.timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const map = new Map<string, { label: string; slots: { value: string; label: string }[] }>();
    for (const slot of slots) {
      const key = dayKey(slot);
      if (!map.has(key)) {
        map.set(key, {
          label:
            key === todayKey
              ? t('dayToday')
              : key === tomorrowKey
                ? t('dayTomorrow')
                : day.format(slot),
          slots: [],
        });
      }
      map.get(key)!.slots.push({ value: slot.toISOString(), label: time.format(slot) });
    }
    return [...map.values()];
  }, [slots, now, restaurant.timezone, locale, t]);

  const option = (kind: 'asap' | 'scheduled', label: string, disabled = false) => (
    <label className="relative flex-1">
      <input
        type="radio"
        name="when"
        value={kind}
        checked={value.kind === kind}
        disabled={disabled}
        onChange={() =>
          onChange(
            kind === 'asap'
              ? { kind: 'asap' }
              : { kind: 'scheduled', at: slots[0]?.toISOString() ?? '' },
          )
        }
        className="peer absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        className={cn(
          'text-muted flex min-h-11 items-center justify-center rounded-[9px] px-2 text-center text-sm font-semibold',
          'peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-[0_1px_4px_rgb(23_19_15/0.12)]',
          'peer-focus-visible:outline-ink peer-focus-visible:outline-3 peer-disabled:opacity-45',
        )}
      >
        {label}
      </span>
    </label>
  );

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1.5 text-sm font-semibold">{t('when')}</legend>
      <div className="bg-soft flex gap-1 rounded-md p-1">
        {option('asap', t('asapIn', { min: lead }), !accepting)}
        {option('scheduled', t('later'), slots.length === 0)}
      </div>
      {!available && value.kind === 'asap' && (
        <p className="text-danger text-sm font-semibold">{t('noSlots')}</p>
      )}
      {value.kind === 'scheduled' &&
        (slots.length === 0 ? (
          <p className="text-danger text-sm font-semibold">{t('noSlots')}</p>
        ) : (
          <label className="grid gap-1.5">
            <span className="sr-only">{t('pickTime')}</span>
            <select
              value={value.at}
              onChange={(e) => onChange({ kind: 'scheduled', at: e.target.value })}
              aria-invalid={error ? true : undefined}
              className="bg-soft focus:border-gold-text focus:bg-surface aria-invalid:border-danger min-h-12 w-full rounded-md border-[1.5px] border-transparent px-3.5 text-base focus:outline-none"
            >
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.slots.map((s) => (
                    <option key={s.value} value={s.value}>
                      {g.label} · {s.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        ))}
      {error && <p className="text-danger text-sm font-semibold">{error}</p>}
    </fieldset>
  );
}
