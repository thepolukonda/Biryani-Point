'use client';

import { useState } from 'react';
import { savePrinterSettings } from '@/app/admin/_actions/printing';
import { useForm } from '@/components/admin/settings/shared';
import { printUrl, setPrintDevice, usePrintDevice } from '@/lib/admin/printing';
import { cn } from '@/lib/cn';
import type { Database } from '@/lib/supabase/database.types';
import { Card, Check, FormMessage, inputClass, Labeled, SubmitButton } from '../ui';

type PrintSettings = Database['public']['Tables']['print_settings']['Row'];

const LANGUAGES = [
  ['en', 'English'],
  ['ka', 'Georgian (ქართული)'],
  ['ru', 'Russian (Русский)'],
] as const;

export function ThisDeviceCard() {
  const on = usePrintDevice();
  const [busy, setBusy] = useState(false);
  const test = async (kind: 'kot' | 'bill') => {
    setBusy(true);
    await printUrl(`/admin/print/sample/${kind}?print=1`);
    setBusy(false);
  };
  return (
    <Card
      title="This device"
      description="Turn this on only on the tablet or computer connected to the kitchen printer. Other devices can still print with the Print buttons on each order."
    >
      <div className="grid gap-4">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => setPrintDevice(!on)}
          className={cn(
            'flex min-h-14 items-center justify-between gap-4 rounded-xl border-2 px-4 text-left font-bold',
            on ? 'border-ok bg-ok-soft text-ok' : 'border-line bg-soft',
          )}
        >
          <span>
            {on ? 'Auto-printing on this device' : 'Auto-printing is off on this device'}
            <span className="text-muted block text-sm font-normal">
              {on
                ? 'KOTs and bills print here automatically while the Orders page is open.'
                : 'Tap to make this the printing device.'}
            </span>
          </span>
          <span
            aria-hidden
            className={cn(
              'relative h-8 w-14 shrink-0 rounded-full transition-colors',
              on ? 'bg-ok' : 'bg-line-strong',
            )}
          >
            <span
              className={cn(
                'absolute top-1 size-6 rounded-full bg-white transition-[left]',
                on ? 'left-7' : 'left-1',
              )}
            />
          </span>
        </button>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void test('kot')}
            className="bg-soft hover:bg-soft-2 min-h-12 rounded-full px-5 font-semibold disabled:opacity-50"
          >
            Print a test KOT
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void test('bill')}
            className="bg-soft hover:bg-soft-2 min-h-12 rounded-full px-5 font-semibold disabled:opacity-50"
          >
            Print a test bill
          </button>
        </div>
      </div>
    </Card>
  );
}

export function PrinterSettingsForm({
  print,
  canEdit,
}: {
  print: PrintSettings;
  canEdit: boolean;
}) {
  const [state, action, pending] = useForm(savePrinterSettings);
  return (
    <Card
      title="Printer settings"
      description={canEdit ? 'Shared by every device.' : 'Only the owner can change these.'}
    >
      <form action={action} className="grid gap-5">
        <fieldset disabled={!canEdit} className="grid gap-5">
          <fieldset className="flex flex-wrap gap-x-6">
            <legend className="mb-1 text-sm font-bold">Paper width</legend>
            {[80, 58].map((w) => (
              <label key={w} className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name="paper_width_mm"
                  value={w}
                  defaultChecked={print.paper_width_mm === w}
                  className="size-5"
                />
                {w} mm {w === 80 ? '(most kitchen printers)' : '(small printers)'}
              </label>
            ))}
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="KOT language" hint="Dish names and labels on the kitchen ticket">
              <select name="kot_language" defaultValue={print.kot_language} className={inputClass}>
                {LANGUAGES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="Bill language" hint="Language of the customer bill">
              <select
                name="bill_language"
                defaultValue={print.bill_language}
                className={inputClass}
              >
                <option value="customer">The customer&apos;s language (recommended)</option>
                {LANGUAGES.map(([v, l]) => (
                  <option key={v} value={v}>
                    Always {l}
                  </option>
                ))}
              </select>
            </Labeled>
          </div>

          <fieldset className="grid gap-1">
            <legend className="mb-1 text-sm font-bold">Print automatically</legend>
            <Check
              name="auto_print_kot"
              defaultChecked={print.auto_print_kot}
              label="KOT when an order is accepted"
            />
            <Check
              name="auto_print_bill"
              defaultChecked={print.auto_print_bill}
              label="Bill when an order is ready for pickup or out for delivery"
            />
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="KOT copies">
              <select
                name="kot_copies"
                defaultValue={String(print.kot_copies)}
                className={inputClass}
              >
                {[1, 2, 3].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Labeled>
            <Labeled label="Bill copies">
              <select
                name="bill_copies"
                defaultValue={String(print.bill_copies)}
                className={inputClass}
              >
                {[1, 2, 3].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Labeled>
          </div>

          <fieldset className="grid gap-1">
            <legend className="mb-1 text-sm font-bold">On the bill</legend>
            <Check
              name="bill_show_phone"
              defaultChecked={print.bill_show_phone}
              label="Customer's phone number"
            />
            <Check
              name="bill_show_qr"
              defaultChecked={print.bill_show_qr}
              label="QR code to the order tracking page"
            />
          </fieldset>
        </fieldset>
        {canEdit && (
          <>
            <FormMessage state={state} />
            <SubmitButton pending={pending}>Save printer settings</SubmitButton>
          </>
        )}
      </form>
    </Card>
  );
}
