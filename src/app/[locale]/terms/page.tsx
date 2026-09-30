import { legalMetadata, LegalPageView } from '@/components/legal-page';
import type { Locale } from '@/lib/domain/i18n-text';

export async function generateMetadata({ params }: PageProps<'/[locale]/terms'>) {
  const { locale } = (await params) as { locale: Locale };
  return legalMetadata(locale, 'terms');
}

export default async function Page({ params }: PageProps<'/[locale]/terms'>) {
  const { locale } = (await params) as { locale: Locale };
  return <LegalPageView locale={locale} page="terms" />;
}
