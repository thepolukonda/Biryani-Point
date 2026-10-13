import type { ReactNode } from 'react';
import { requireStaff } from '@/controllers/admin/guard';
import { AdminBrandProvider } from '@/views/admin/admin-brand';
import { AdminNav } from '@/views/admin/admin-nav';
import { loadRestaurant } from '@/controllers/site/shop';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const [user, { profile, timezone }] = await Promise.all([requireStaff(), loadRestaurant()]);
  return (
    <AdminBrandProvider
      value={{
        brandName: profile.brandName,
        monogram: profile.monogram,
        orderPrefix: profile.orderPrefix,
        timezone,
      }}
    >
      <div className="min-h-dvh">
        <AdminNav role={user.role} name={user.displayName} monogram={profile.monogram} />
        <main id="main" className="px-3 py-5 lg:px-6">
          {children}
        </main>
      </div>
    </AdminBrandProvider>
  );
}
