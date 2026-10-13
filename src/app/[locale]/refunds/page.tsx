import { legalMetadata, LegalPageView } from '@/views/legal-page';
import type { Locale } from '@/shared/domain/i18n-text';

export async function generateMetadata({ params }: PageProps<'/[locale]/refunds'>) {
  const { locale } = (await params) as { locale: Locale };
  return legalMetadata(locale, 'refunds');
}

export default async function Page({ params }: PageProps<'/[locale]/refunds'>) {
  const { locale } = (await params) as { locale: Locale };
  return <LegalPageView locale={locale} page="refunds" />;
}
