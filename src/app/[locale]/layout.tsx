import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import '../globals.css';
import { estLocale } from '@/lib/i18n';
import { Entete, Pied } from '@/components/Chrome';
import { jsonMaison, metaCommune } from '@/lib/seo';
import DonneesStructurees from '@/components/DonneesStructurees';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return metaCommune(
    locale,
    '',
    /* Le titre était en français quel que soit le visiteur : un anglophone
       arrivait sur « Conciergerie premium », mot qui ne lui dit rien et qui
       s'affiche tel quel dans sa page de résultats Google. */
    locale === 'en'
      ? 'IB Signature - Serviced apartments · Casablanca & Marrakech'
      : 'IB Signature - Conciergerie premium · Casablanca & Marrakech',
    locale === 'en'
      ? 'Serviced apartments run like a five-star hotel, in Casablanca and Marrakech.'
      : 'Des appartements tenus comme un hôtel cinq étoiles, à Casablanca et Marrakech.'
  );
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!estLocale(locale)) notFound();
  return (
    <html lang={locale}>
      <head>
        {/* La favicon reprend le logo blanc sur le nuit de la charte : dans une
            barre d'onglets, c'est la seule chose qui identifie le site. */}
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* La maison décrite une seconde fois, dans une forme qui ne se prête
            pas au malentendu : c'est ce qui permet à un moteur - et à un
            assistant - de répondre « IB Signature loue à Casablanca et
            Marrakech » plutôt que de paraphraser un paragraphe. */}
        <DonneesStructurees donnees={jsonMaison(locale)} />
      </head>
      <body>
        <Entete locale={locale} />
        <main>{children}</main>
        <Pied locale={locale} />
      </body>
    </html>
  );
}
