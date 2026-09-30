import { legalMetadata, LegalPageView } from '@/components/legal-page';
import type { Locale } from '@/lib/domain/i18n-text';

export async function generateMetadata({ params }: PageProps<'/[locale]/privacy'>) {
  const { locale } = (await params) as { locale: Locale };
  return legalMetadata(locale, 'privacy');
}

export default async function Page({ params }: PageProps<'/[locale]/privacy'>) {
  const { locale } = (await params) as { locale: Locale };
  return <LegalPageView locale={locale} page="privacy" />;
}
