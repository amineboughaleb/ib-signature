import { notFound } from 'next/navigation';
import { PageQuartier, metaQuartier } from '@/components/PagesQuartier';

export const dynamic = 'force-dynamic';

/* La page quartier, en anglais. L'autre langue a son propre segment d'adresse. */
const LANGUE = 'en' as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; ville: string; quartier: string }>;
}) {
  const { locale, ville, quartier } = await params;
  if (locale !== LANGUE) return {};
  return metaQuartier(LANGUE, ville, quartier);
}

export default async function Quartier({
  params,
}: {
  params: Promise<{ locale: string; ville: string; quartier: string }>;
}) {
  const { locale, ville, quartier } = await params;
  if (locale !== LANGUE) notFound();
  return <PageQuartier langue={LANGUE} villeCle={ville} quartierCle={quartier} />;
}
