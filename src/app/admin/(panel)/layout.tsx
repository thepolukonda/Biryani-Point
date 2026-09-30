import type { ReactNode } from 'react';
import { requireStaff } from '@/lib/admin/auth';
import { AdminBrandProvider } from '@/components/admin/admin-brand';
import { AdminNav } from '@/components/admin/admin-nav';
import { getRestaurant } from '@/lib/data/restaurant';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const [user, { profile, timezone }] = await Promise.all([requireStaff(), getRestaurant()]);
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
