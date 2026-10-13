import type { Metadata } from 'next';
import { menuEditorPage } from '@/controllers/admin/pages';
import { MenuManager } from '@/views/admin/menu/menu-manager';

export const metadata: Metadata = { title: 'Menu' };
export const dynamic = 'force-dynamic';

export default async function AdminMenuPage() {
  return <MenuManager data={await menuEditorPage()} />;
}
