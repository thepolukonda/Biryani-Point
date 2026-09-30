'use client';

import { useActionState } from 'react';
import type { FormState } from '@/app/admin/_actions/settings';
import type { I18nText } from '@/lib/domain/i18n-text';
import type { Database } from '@/lib/supabase/database.types';
import { inputClass, Labeled } from '../ui';

export type Tables = Database['public']['Tables'];
export type SettingsData = {
  settings: Tables['restaurant_settings']['Row'];
  integrations: Tables['integration_settings']['Row'];
  hours: Tables['opening_hours']['Row'][];
  closures: Tables['closures']['Row'][];
  zones: Tables['delivery_zones']['Row'][];
  dishes: { slug: string; name: I18nText }[];
  notifications: { telegram: boolean; email: boolean };
};

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function useForm(action: (prev: FormState, form: FormData) => Promise<FormState>) {
  return useActionState<FormState, FormData>(action, {});
}

export function sheetManaged(data: SettingsData, field: string) {
  return (
    data.settings.menu_source === 'sheet' && data.settings.sheet_managed_fields.includes(field)
  );
}

export function I18nInputs({
  base,
  value,
  label,
  rows,
  maxLength,
  hint,
}: {
  base: string;
  value: unknown;
  label: string;
  /** Show text areas with this many rows instead of one-line inputs. */
  rows?: number;
  maxLength?: number;
  hint?: string;
}) {
  const v = (value ?? {}) as Record<string, string | string[]>;
  // Lists (e.g. highlights) are edited one item per line.
  const text = (l: string) => {
    const x = v[l];
    return Array.isArray(x) ? x.join('\n') : (x ?? '');
  };
  return (
    <fieldset className="grid gap-2 sm:grid-cols-3">
      <legend className="mb-1 text-sm font-bold">{label}</legend>
      {(['en', 'ka', 'ru'] as const).map((l) => (
        <Labeled key={l} label={{ en: 'English', ka: 'Georgian', ru: 'Russian' }[l]}>
          {rows ? (
            <textarea
              name={`${base}_${l}`}
              defaultValue={text(l)}
              lang={l}
              rows={rows}
              maxLength={maxLength}
              className={inputClass}
            />
          ) : (
            <input
              name={`${base}_${l}`}
              defaultValue={text(l)}
              lang={l}
              maxLength={maxLength}
              className={inputClass}
            />
          )}
        </Labeled>
      ))}
      {hint && <p className="text-muted text-sm sm:col-span-3">{hint}</p>}
    </fieldset>
  );
}
