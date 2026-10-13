import type { Database } from '@/models/db/database.types';

type Tables = Database['public']['Tables'];
export type CategoryRow = Tables['categories']['Row'];
export type ItemRow = Tables['menu_items']['Row'];
export type GroupRow = Tables['modifier_groups']['Row'] & {
  modifier_options: Tables['modifier_options']['Row'][];
};
export type LinkRow = Tables['item_modifier_groups']['Row'];
export type SyncRun = Tables['sheet_sync_runs']['Row'];

export type MenuAdminData = {
  categories: CategoryRow[];
  items: ItemRow[];
  groups: GroupRow[];
  links: LinkRow[];
  source: 'sheet' | 'admin';
  runs: SyncRun[];
  isOwner: boolean;
  sheetConfigured: boolean;
};
