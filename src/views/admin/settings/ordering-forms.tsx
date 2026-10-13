'use client';

import { useState, useTransition } from 'react';
import {
  saveFees,
  saveKitchen,
  saveOrdering,
  setPaused,
  testNotifications,
  type FormState,
} from '@/controllers/admin/settings.actions';
import { cn } from '@/shared/cn';
import { formatAmount } from '@/shared/domain/money';
import { Card, Check, FormMessage, inputClass, Labeled, SheetBadge, SubmitButton } from '../ui';
import { I18nInputs, sheetManaged, useForm, type SettingsData } from './shared';

export function PauseBanner({ paused, managed }: { paused: boolean; managed: boolean }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<FormState>({});
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5',
        paused ? 'bg-danger text-white' : 'bg-ok-soft text-ok',
      )}
    >
      <p className="text-lg font-extrabold">
        {paused ? 'Online orders are paused' : 'Taking online orders'}
      </p>
      {managed ? (
        <SheetBadge />
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => setState(await setPaused(!paused)))}
          className={cn(
            'min-h-12 rounded-md px-5 font-bold',
            paused ? 'text-danger bg-white' : 'bg-danger text-white',
          )}
        >
          {pending ? 'Saving…' : paused ? 'Start taking orders' : 'Pause online orders'}
        </button>
      )}
      {state.error && <p className="w-full font-semibold">{state.error}</p>}
    </div>
  );
}

export function OrderingForm({ data }: { data: SettingsData }) {
  const [state, action, pending] = useForm(saveOrdering);
  const s = data.settings;
  return (
    <Card
      title="Online ordering"
      description="Pausing keeps the menu visible but nobody can check out."
    >
      <form action={action} className="grid gap-3">
        <Check
          name="orders_paused"
          label="Pause online orders"
          defaultChecked={s.orders_paused}
          disabled={sheetManaged(data, 'orders_paused')}
        />
        <Check
          name="delivery_enabled"
          label="Offer delivery"
          defaultChecked={s.delivery_enabled}
          disabled={sheetManaged(data, 'delivery_enabled')}
        />
        <Check
          name="pickup_enabled"
          label="Offer pickup"
          defaultChecked={s.pickup_enabled}
          disabled={sheetManaged(data, 'pickup_enabled')}
        />
        <I18nInputs
          base="pause_message"
          value={s.pause_message}
          label="Message while paused (optional)"
        />
        <FormMessage state={state} />
        <SubmitButton pending={pending}>Save</SubmitButton>
      </form>
    </Card>
  );
}

export function FeesForm({ data }: { data: SettingsData }) {
  const [state, action, pending] = useForm(saveFees);
  const s = data.settings;
  const managed = [
    'delivery_fee_tetri',
    'free_delivery_over_tetri',
    'min_delivery_order_tetri',
  ].some((f) => sheetManaged(data, f));
  return (
    <Card
      title="Delivery charges"
      description="Amounts in GEL. 0 = off. A delivery zone can override the fee and minimum."
      badge={managed ? <SheetBadge /> : undefined}
    >
      <form action={action} className="grid gap-3 sm:grid-cols-3">
        <Labeled label="Delivery fee">
          <input
            name="fee"
            defaultValue={formatAmount(s.delivery_fee_tetri)}
            inputMode="decimal"
            disabled={managed}
            className={inputClass}
          />
        </Labeled>
        <Labeled label="Free delivery over" hint="0 = never free">
          <input
            name="free"
            defaultValue={formatAmount(s.free_delivery_over_tetri)}
            inputMode="decimal"
            disabled={managed}
            className={inputClass}
          />
        </Labeled>
        <Labeled label="Minimum delivery order" hint="Pickup has no minimum">
          <input
            name="min"
            defaultValue={formatAmount(s.min_delivery_order_tetri)}
            inputMode="decimal"
            disabled={managed}
            className={inputClass}
          />
        </Labeled>
        <div className="grid gap-2 sm:col-span-3">
          <FormMessage state={state} />
          {!managed && <SubmitButton pending={pending}>Save charges</SubmitButton>}
        </div>
      </form>
    </Card>
  );
}

export function KitchenForm({ data }: { data: SettingsData }) {
  const [state, action, pending] = useForm(saveKitchen);
  const s = data.settings;
  return (
    <Card
      title="Kitchen times"
      description="Used for the estimated time customers see, and for scheduled order slots."
    >
      <form action={action} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Labeled label="Pickup ready in (min)">
          <input
            name="prep_minutes_pickup"
            type="number"
            min={5}
            max={240}
            defaultValue={s.prep_minutes_pickup}
            disabled={sheetManaged(data, 'prep_minutes_pickup')}
            className={inputClass}
          />
        </Labeled>
        <Labeled label="Delivery arrives in (min)">
          <input
            name="prep_minutes_delivery"
            type="number"
            min={5}
            max={240}
            defaultValue={s.prep_minutes_delivery}
            disabled={sheetManaged(data, 'prep_minutes_delivery')}
            className={inputClass}
          />
        </Labeled>
        <Labeled label="Time slots every (min)">
          <select
            name="slot_interval_minutes"
            defaultValue={s.slot_interval_minutes}
            className={inputClass}
          >
            {[5, 10, 15, 20, 30, 60].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Labeled>
        <Labeled label="Order ahead up to (days)" hint="0 = today only">
          <input
            name="schedule_days_ahead"
            type="number"
            min={0}
            max={14}
            defaultValue={s.schedule_days_ahead}
            className={inputClass}
          />
        </Labeled>
        <Labeled label="Last orders before closing (min)">
          <input
            name="last_order_minutes_before_close"
            type="number"
            min={0}
            max={120}
            defaultValue={s.last_order_minutes_before_close}
            className={inputClass}
          />
        </Labeled>
        <div className="grid gap-2 sm:col-span-2 lg:col-span-3">
          <FormMessage state={state} />
          <SubmitButton pending={pending}>Save kitchen times</SubmitButton>
        </div>
      </form>
    </Card>
  );
}

export function NotificationsCard({ data }: { data: SettingsData }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<FormState>({});
  const status = (on: boolean) =>
    on ? <b className="text-ok">on</b> : <b className="text-muted">off</b>;
  return (
    <Card
      title="New-order notifications"
      description="Set up in the hosting environment variables (see the README). The kitchen board also rings."
    >
      <ul className="mb-4 grid gap-1">
        <li>Telegram: {status(data.notifications.telegram)}</li>
        <li>Email: {status(data.notifications.email)}</li>
      </ul>
      <FormMessage state={state} />
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setState(await testNotifications()))}
        className="bg-soft mt-2 min-h-12 rounded-md px-5 font-semibold"
      >
        {pending ? 'Sending…' : 'Send a test message'}
      </button>
    </Card>
  );
}
