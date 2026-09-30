'use client';

import { createContext, useContext, type ReactNode } from 'react';

/** Business profile details the admin screens need (from the restaurant settings). */
export type AdminBrand = {
  brandName: string;
  monogram: string;
  orderPrefix: string;
  timezone: string;
};

const AdminBrandContext = createContext<AdminBrand | null>(null);

export function AdminBrandProvider({
  value,
  children,
}: {
  value: AdminBrand;
  children: ReactNode;
}) {
  return <AdminBrandContext.Provider value={value}>{children}</AdminBrandContext.Provider>;
}

export function useAdminBrand(): AdminBrand {
  const value = useContext(AdminBrandContext);
  if (!value) throw new Error('useAdminBrand must be used inside the admin panel layout');
  return value;
}
