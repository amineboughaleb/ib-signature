import { notFound } from 'next/navigation';
import { PageVille, metaVille } from '@/components/PagesQuartier';

export const dynamic = 'force-dynamic';

/* La page ville, en anglais. L'autre langue a son propre segment d'adresse. */
const LANGUE = 'en' as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string; ville: string }> }) {
  const { locale, ville } = await params;
  if (locale !== LANGUE) return {};
  return metaVille(LANGUE, ville);
}

export default async function Ville({ params }: { params: Promise<{ locale: string; ville: string }> }) {
  const { locale, ville } = await params;
  if (locale !== LANGUE) notFound();
  return <PageVille langue={LANGUE} villeCle={ville} />;
}
