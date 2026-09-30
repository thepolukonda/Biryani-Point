import { notFound } from 'next/navigation';

// Any unknown path under /en, /ka or /ru shows the translated 404 page.
export default function CatchAll() {
  notFound();
}
