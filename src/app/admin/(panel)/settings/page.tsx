import type { Metadata } from 'next';
import { BillDetailsForm } from '@/components/admin/settings/bill-details-form';
import { BusinessProfileForm } from '@/components/admin/settings/business-profile-form';
import { ClosuresEditor, HoursEditor } from '@/components/admin/settings/hours-forms';
import {
  FeesForm,
  KitchenForm,
  NotificationsCard,
  OrderingForm,
  PauseBanner,
} from '@/components/admin/settings/ordering-forms';
import { IntegrationsForm, RestaurantForm } from '@/components/admin/settings/restaurant-forms';
import type { SettingsData } from '@/components/admin/settings/shared';
import { ZonesEditor } from '@/components/admin/settings/zones-form';
import { requireOwner } from '@/lib/admin/auth';
import type { I18nText } from '@/lib/domain/i18n-text';
import { notificationsConfigured } from '@/lib/notify';
import { loadPrintSettings } from '@/lib/print/ticket-data';
import { sessionClient } from '@/lib/supabase/session';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  await requireOwner();
  const db = await sessionClient();
  const [settings, integrations, hours, closures, zones, dishes, print] = await Promise.all([
    db.from('restaurant_settings').select('*').eq('id', 1).single(),
    db.from('integration_settings').select('*').eq('id', 1).single(),
    db.from('opening_hours').select('*').order('weekday').order('opens_at'),
    db.from('closures').select('*').order('starts_on'),
    db.from('delivery_zones').select('*').order('sort_order'),
    db.from('menu_items').select('slug, name').eq('is_visible', true).order('sort_order'),
    loadPrintSettings(),
  ]);
  if (!settings.data || !integrations.data) {
    return <p className="bg-danger-soft text-danger rounded-lg p-4">Could not load settings.</p>;
  }

  const data: SettingsData = {
    settings: settings.data,
    integrations: integrations.data,
    hours: hours.data ?? [],
    closures: closures.data ?? [],
    zones: zones.data ?? [],
    dishes: (dishes.data ?? []).map((d) => ({ slug: d.slug, name: d.name as I18nText })),
    notifications: notificationsConfigured(),
  };
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
