import type { Metadata } from 'next';
import { MenuManager } from '@/components/admin/menu/menu-manager';
import type { GroupRow } from '@/components/admin/menu/types';
import { requireStaff } from '@/lib/admin/auth';
import { serverEnv } from '@/lib/env.server';
import { serviceClient } from '@/lib/supabase/clients';
import { sessionClient } from '@/lib/supabase/session';

export const metadata: Metadata = { title: 'Menu' };
export const dynamic = 'force-dynamic';

export default async function AdminMenuPage() {
  const user = await requireStaff();
  const db = await sessionClient();
  const [categories, items, groups, links, settings, runs, integrations] = await Promise.all([
    db.from('categories').select('*').order('sort_order'),
    db.from('menu_items').select('*').order('sort_order'),
    db.from('modifier_groups').select('*, modifier_options(*)').order('sort_order'),
    db.from('item_modifier_groups').select('*'),
    db.from('restaurant_settings').select('menu_source').eq('id', 1).single(),
    db.from('sheet_sync_runs').select('*').order('started_at', { ascending: false }).limit(5),
    // Only whether a link exists, not the link itself (owner-only table).
    serviceClient().from('integration_settings').select('sheet_menu_csv_url').eq('id', 1).single(),
  ]);

  return (
    <MenuManager
      data={{
        categories: categories.data ?? [],
        items: items.data ?? [],
        groups: (groups.data ?? []) as GroupRow[],
        links: links.data ?? [],
        source: settings.data?.menu_source ?? 'sheet',
        runs: runs.data ?? [],
        isOwner: user.role === 'owner',
        sheetConfigured: Boolean(
          integrations.data?.sheet_menu_csv_url || serverEnv().SHEET_MENU_CSV_URL,
        ),
      }}
    />
  );
}
