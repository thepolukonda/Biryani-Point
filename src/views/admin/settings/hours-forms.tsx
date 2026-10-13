'use client';

import { useState, useTransition } from 'react';
import {
  addClosure,
  deleteClosure,
  saveHours,
  type FormState,
} from '@/controllers/admin/settings.actions';
import { cn } from '@/shared/cn';
import { pickText, type I18nText } from '@/shared/domain/i18n-text';
import { Card, FormMessage, inputClass, Labeled, SheetBadge, SubmitButton } from '../ui';
import { DAYS, useForm, type SettingsData } from './shared';

export function HoursEditor({ data }: { data: SettingsData }) {
  const fromSheet =
    data.settings.menu_source === 'sheet' && data.hours.some((h) => h.source === 'sheet');
  const first = data.hours[0];
  const [opens, setOpens] = useState(first?.opens_at.slice(0, 5) ?? '12:00');
  const [closes, setCloses] = useState(first?.closes_at.slice(0, 5) ?? '23:00');
  // Hours saved earlier (or from the Sheet) may differ by day; saving here makes them equal.
  const differs =
    data.hours.length !== 7 ||
    data.hours.some((h) => h.opens_at !== first?.opens_at || h.closes_at !== first?.closes_at);
  const [pending, start] = useTransition();
  const [state, setState] = useState<FormState>({});
  const save = () =>
    start(async () =>
      setState(await saveHours(DAYS.map((_, i) => ({ weekday: i + 1, opens, closes })))),
    );

  return (
    <Card
      title="Opening hours"
      description="The same hours every day. Closing after midnight is fine: 18:00 → 01:00 means open until 1 am. For a day off, add a holiday closure below."
      badge={fromSheet ? <SheetBadge /> : undefined}
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Labeled label="Opens">
            <input
              type="time"
              value={opens}
              disabled={fromSheet}
              onChange={(e) => setOpens(e.target.value)}
              className={cn(inputClass, 'w-36')}
            />
          </Labeled>
          <span aria-hidden className="pb-3">
            →
          </span>
          <Labeled label="Closes">
            <input
              type="time"
              value={closes}
              disabled={fromSheet}
              onChange={(e) => setCloses(e.target.value)}
              className={cn(inputClass, 'w-36')}
            />
          </Labeled>
          {closes <= opens && (
            <span className="text-gold-text pb-3 text-sm font-semibold">until the next day</span>
          )}
        </div>
        {differs && data.hours.length > 0 && !fromSheet && (
          <p className="bg-gold-soft text-gold-text rounded-lg px-4 py-3 text-sm">
            Some days currently have different hours. Saving sets these hours for every day.
          </p>
        )}
        <FormMessage state={state} />
        {!fromSheet && (
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="bg-ink min-h-12 justify-self-start rounded-md px-5 font-semibold text-white disabled:opacity-60"
          >
            {pending ? 'Saving…' : 'Save opening hours'}
          </button>
        )}
      </div>
    </Card>
  );
}

export function ClosuresEditor({ data }: { data: SettingsData }) {
  const [state, action, pending] = useForm(addClosure);
  const [removing, start] = useTransition();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: data.settings.timezone });
  const upcoming = data.closures.filter((c) => c.ends_on >= today);
  return (
    <Card
      title="Holiday closures"
      description="Whole days when you are closed. Customers can’t order for these days."
    >
      <ul className="mb-4 grid gap-2">
        {upcoming.length === 0 && <li className="text-muted">No closures planned.</li>}
        {upcoming.map((c) => (
          <li
            key={c.id}
            className="bg-soft flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-2"
          >
            <span>
              <b>{c.starts_on === c.ends_on ? c.starts_on : `${c.starts_on} → ${c.ends_on}`}</b>
              {pickText(c.note as I18nText, 'en') && (
                <span className="text-muted"> · {pickText(c.note as I18nText, 'en')}</span>
              )}
            </span>
            {c.source === 'sheet' ? (
              <SheetBadge />
            ) : (
              <button
                type="button"
                disabled={removing}
                onClick={() => start(async () => void (await deleteClosure(c.id)))}
                className="text-danger min-h-11 rounded-md px-3 text-sm font-semibold"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
        <Labeled label="First day">
          <input type="date" name="starts_on" required min={today} className={inputClass} />
        </Labeled>
        <Labeled label="Last day">
          <input type="date" name="ends_on" min={today} className={inputClass} />
        </Labeled>
        <Labeled label="Note (optional)">
          <input name="note" maxLength={120} placeholder="e.g. New Year" className={inputClass} />
        </Labeled>
        <SubmitButton pending={pending}>Add</SubmitButton>
        <div className="sm:col-span-4">
          <FormMessage state={state} />
        </div>
      </form>
    </Card>
  );
}
