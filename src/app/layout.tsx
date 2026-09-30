import type { ReactNode } from 'react';
import './globals.css';

// The <html> element lives in app/[locale]/layout.tsx (customer pages, one per language)
// and app/admin/layout.tsx (kitchen dashboard), so each can set its own lang attribute.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
