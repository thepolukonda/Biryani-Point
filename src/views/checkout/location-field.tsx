'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useShop } from '@/views/providers/shop-provider';
import { LocateIcon } from '@/views/ui/icons';
import { cn } from '@/shared/cn';
import { findDeliveryZone } from '@/shared/domain/zones';

export type Location = { lat: number; lng: number };

/** "Share my location" with an instant delivery-zone check (the server checks again). */
export function LocationField({
  value,
  onChange,
}: {
  value: Location | null;
  onChange: (value: Location | null) => void;
}) {
  const t = useTranslations('checkout');
  const { restaurant } = useShop();
  const [state, setState] = useState<'idle' | 'locating' | 'error'>('idle');

  const zone =
    value && restaurant.zones.length > 0
      ? findDeliveryZone(value, restaurant.location, restaurant.zones)
      : undefined;

  const locate = () => {
    if (!navigator.geolocation) {
      setState('error');
      return;
    }
    setState('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onChange({
          lat: Number(p.coords.latitude.toFixed(6)),
          lng: Number(p.coords.longitude.toFixed(6)),
        });
        setState('idle');
      },
      () => {
        onChange(null);
        setState('error');
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={locate}
          disabled={state === 'locating'}
          className="bg-soft hover:bg-soft-2 [&_svg]:text-chili inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold disabled:opacity-60 [&_svg]:size-4"
        >
          <LocateIcon />
          {state === 'locating' ? t('locating') : t('locate')}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-muted min-h-11 text-sm underline"
          >
            {t('locationRemove')}
          </button>
        )}
      </div>
      <p
        role="status"
        className={cn(
          'text-sm',
          state === 'error' || zone === null
            ? 'text-danger font-semibold'
            : value
              ? 'text-ok font-semibold'
              : 'text-muted',
        )}
      >
        {state === 'error'
          ? t('locationError')
          : value
            ? zone === null
              ? t('zoneOutside')
              : zone
                ? `${t('located')} ${t('zoneOk', { km: zone.distanceKm.toFixed(1) })}`
                : t('located')
            : t('locationHint')}
      </p>
    </div>
  );
}
