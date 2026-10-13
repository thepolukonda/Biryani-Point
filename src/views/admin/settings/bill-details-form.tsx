'use client';

import Link from 'next/link';
import { saveBillDetails } from '@/controllers/admin/printing.actions';
import type { Database } from '@/models/db/database.types';
import { Card, Check, FormMessage, inputClass, Labeled, SubmitButton } from '../ui';
import { I18nInputs, useForm } from './shared';

type PrintSettings = Database['public']['Tables']['print_settings']['Row'];

export function BillDetailsForm({ print }: { print: PrintSettings }) {
  const [state, action, pending] = useForm(saveBillDetails);
  return (
    <Card
      title="Bill details"
      description={
        <>
          Printed at the top of every customer bill. Printer options are on the{' '}
          <Link href="/admin/printers" className="text-gold-text font-semibold underline">
            Printers
          </Link>{' '}
          page.
        </>
      }
    >
      <form action={action} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled
            label="Registered business name"
            hint="e.g. the company or Individual Entrepreneur name"
          >
            <input
              name="legal_name"
              defaultValue={print.legal_name ?? ''}
              maxLength={120}
              className={inputClass}
            />
          </Labeled>
          <Labeled label="ID code (საიდენტიფიკაციო კოდი)" hint="Tax / company ID number">
            <input
              name="tax_id"
              defaultValue={print.tax_id ?? ''}
              maxLength={40}
              inputMode="numeric"
              className={inputClass}
            />
          </Labeled>
          <Labeled label="Address on the bill" className="sm:col-span-2">
            <input
              name="legal_address"
              defaultValue={print.legal_address ?? ''}
              maxLength={200}
              placeholder="Street and number, city"
              className={inputClass}
            />
          </Labeled>
        </div>
        <Check
          name="vat_registered"
          defaultChecked={print.vat_registered}
          label={
            <span>
              VAT registered: show the 18% VAT included in the total
              <span className="text-muted block text-sm">
                Leave off if you are not a VAT payer. Ask your accountant.
              </span>
            </span>
          }
        />
        <I18nInputs
          base="bill_footer"
          value={print.bill_footer}
          label="Extra line at the bottom of the bill (optional, e.g. an offer or Wi-Fi password)"
        />
        <FormMessage state={state} />
        <SubmitButton pending={pending}>Save bill details</SubmitButton>
      </form>
    </Card>
  );
}
