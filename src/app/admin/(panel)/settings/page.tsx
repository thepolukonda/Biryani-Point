import type { Metadata } from 'next';
import { settingsPage } from '@/controllers/admin/pages';
import { BillDetailsForm } from '@/views/admin/settings/bill-details-form';
import { BusinessProfileForm } from '@/views/admin/settings/business-profile-form';
import { ClosuresEditor, HoursEditor } from '@/views/admin/settings/hours-forms';
import {
  FeesForm,
  KitchenForm,
  NotificationsCard,
  OrderingForm,
  PauseBanner,
} from '@/views/admin/settings/ordering-forms';
import { IntegrationsForm, RestaurantForm } from '@/views/admin/settings/restaurant-forms';
import type { SettingsData } from '@/views/admin/settings/shared';
import { ZonesEditor } from '@/views/admin/settings/zones-form';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { print, ...rest } = await settingsPage();
  const data: SettingsData = rest;
  const pausedBySheet =
    data.settings.menu_source === 'sheet' &&
    data.settings.sheet_managed_fields.includes('orders_paused');

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-extrabold">Settings</h1>
      <PauseBanner paused={data.settings.orders_paused} managed={pausedBySheet} />
      {data.settings.menu_source === 'sheet' && data.settings.sheet_managed_fields.length > 0 && (
        <p className="bg-gold-soft text-gold-text rounded-lg px-4 py-3">
          Settings marked <b>From Google Sheet</b> are controlled by the Settings tab of your sheet.
          Delete a row there to manage it here instead.
        </p>
      )}
      <div className="grid gap-5 xl:grid-cols-2">
        <OrderingForm data={data} />
        <FeesForm data={data} />
        <KitchenForm data={data} />
        <NotificationsCard data={data} />
      </div>
      <HoursEditor data={data} />
      <ClosuresEditor data={data} />
      <ZonesEditor data={data} />
      <BusinessProfileForm data={data} />
      <RestaurantForm data={data} />
      <BillDetailsForm print={print} />
      <IntegrationsForm data={data} />
    </div>
  );
}
