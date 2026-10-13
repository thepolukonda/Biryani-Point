'use client';

import { saveIntegrations, saveRestaurant } from '@/controllers/admin/settings.actions';
import { pickText } from '@/shared/domain/i18n-text';
import { Card, Check, FormMessage, inputClass, Labeled, SheetBadge, SubmitButton } from '../ui';
import { I18nInputs, sheetManaged, useForm, type SettingsData } from './shared';

export function RestaurantForm({ data }: { data: SettingsData }) {
  const [state, action, pending] = useForm(saveRestaurant);
  const s = data.settings;
  const signatureManaged = sheetManaged(data, 'signature_item_slugs');
  return (
    <Card title="Restaurant details">
      <form action={action} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Phone">
            <input name="phone" defaultValue={s.phone} className={inputClass} />
          </Labeled>
          <Labeled label="WhatsApp number" hint="With country code, digits only">
            <input
              name="whatsapp"
              defaultValue={s.whatsapp}
              inputMode="numeric"
              className={inputClass}
            />
          </Labeled>
          <Labeled label="Map latitude" hint="Right-click the restaurant in Google Maps to copy it">
            <input
              name="latitude"
              defaultValue={s.latitude}
              inputMode="decimal"
              className={inputClass}
            />
          </Labeled>
          <Labeled label="Map longitude">
            <input
              name="longitude"
              defaultValue={s.longitude}
              inputMode="decimal"
              className={inputClass}
            />
          </Labeled>
          <Labeled label="Google review link" className="sm:col-span-2">
            <input
              name="google_review_url"
              defaultValue={s.google_review_url ?? ''}
              placeholder="https://g.page/r/…/review"
              disabled={sheetManaged(data, 'google_review_url')}
              className={inputClass}
            />
          </Labeled>
        </div>
        <fieldset>
          <legend className="mb-1 flex items-center gap-2 text-sm font-bold">
            Signature dishes on the home page {signatureManaged && <SheetBadge />}
          </legend>
          <div className="grid gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.dishes.map((d) => (
              <Check
                key={d.slug}
                name="signature"
                value={d.slug}
                label={pickText(d.name, 'en')}
                defaultChecked={s.signature_item_slugs.includes(d.slug)}
                disabled={signatureManaged}
              />
            ))}
          </div>
        </fieldset>
        <Labeled label="Owner name (for the note on the home page)">
          <input
            name="owner_name"
            defaultValue={s.owner_name ?? ''}
            placeholder="e.g. Ravi, owner and cook"
            className={inputClass}
          />
        </Labeled>
        <I18nInputs
          base="owner_note"
          value={s.owner_note}
          label="A few words from the kitchen (leave empty to hide)"
        />
        <FormMessage state={state} />
        <SubmitButton pending={pending}>Save details</SubmitButton>
      </form>
    </Card>
  );
}

export function IntegrationsForm({ data }: { data: SettingsData }) {
  const [state, action, pending] = useForm(saveIntegrations);
  const i = data.integrations;
  const tabs = [
    ['menu', 'Menu (required)', i.sheet_menu_csv_url],
    ['categories', 'Categories', i.sheet_categories_csv_url],
    ['options', 'Options', i.sheet_options_csv_url],
    ['hours', 'Hours', i.sheet_hours_csv_url],
    ['settings', 'Settings', i.sheet_settings_csv_url],
  ] as const;
  return (
    <Card
      title="Google Sheet"
      description={
        <>
          In Google Sheets: File → Share → Publish to web → choose a tab → “Comma-separated values
          (.csv)” → Publish, and paste the link here. One link per tab.
        </>
      }
    >
      <form action={action} className="grid gap-3" id="sheet">
        <fieldset className="flex flex-wrap gap-x-6">
          <legend className="mb-1 text-sm font-bold">Where does the menu come from?</legend>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="menu_source"
              value="sheet"
              defaultChecked={data.settings.menu_source === 'sheet'}
              className="size-5"
            />{' '}
            Google Sheet
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="menu_source"
              value="admin"
              defaultChecked={data.settings.menu_source === 'admin'}
              className="size-5"
            />{' '}
            Edited here in the admin panel
          </label>
        </fieldset>
        {tabs.map(([tab, label, value]) => (
          <Labeled key={tab} label={`${label} tab link`}>
            <input
              name={`sheet_${tab}`}
              defaultValue={value ?? ''}
              placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?gid=…&single=true&output=csv"
              className={inputClass}
            />
          </Labeled>
        ))}
        <FormMessage state={state} />
        <SubmitButton pending={pending}>Save</SubmitButton>
      </form>
    </Card>
  );
}
