import { notFound } from 'next/navigation';
import { estLocale, getT } from '@/lib/i18n';
import { MARQUE } from '@/lib/marque';

import { metaCommune } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return metaCommune(
    locale,
    '/mentions',
    locale === 'en' ? 'Legal notice · IB Signature' : 'Mentions légales · IB Signature',
    locale === 'en'
      ? 'Identity, registration and contact details of Partners Hotels SARL AU, publisher of the IB Signature website.'
      : 'Identité, immatriculation et coordonnées de Partners Hotels SARL AU, éditeur du site IB Signature.'
  );
}


/**
 * Les mentions obligatoires.
 *
 * L'article 29 2° de la loi 31-08 sur la protection du consommateur, l'article
 * 45 de la loi 5-96 et l'article 49 du code de commerce les imposent à tout
 * site marchand marocain. Elles ne se rédigent pas : elles se recopient depuis
 * le registre. Ce qui manque encore figure entre crochets, jamais en blanc -
 * un champ vide se remarque moins qu'un crochet, et finit par partir en ligne.
 */
export default async function Mentions({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!estLocale(locale)) notFound();
  const t = getT(locale);
  const fr = locale === 'fr';

  const lignes: Array<[string, string]> = [
    [fr ? 'Dénomination' : 'Company', 'Partners Hotels SARL AU'],
    [fr ? 'Enseigne' : 'Trading name', 'IB Signature'],
    [fr ? 'Forme juridique' : 'Legal form', fr ? 'SARL à associé unique' : 'Single-member limited company'],
    [fr ? 'Capital social' : 'Share capital', fr ? '1 450 000 dirhams' : 'MAD 1,450,000'],
    [fr ? 'Siège social' : 'Registered office', MARQUE.adresse],
    [fr ? 'Registre du commerce' : 'Commercial register', 'Casablanca n° 114465'],
    ['ICE', '000027671000074'],
    [fr ? 'Identifiant fiscal' : 'Tax identifier', '01087703'],
    [fr ? 'Gérant' : 'Manager', '[Nom du gérant]'],
    [fr ? 'Téléphone' : 'Telephone', MARQUE.telephone],
    [fr ? 'Courriel' : 'Email', MARQUE.courriel],
  ];

  return (
    <section className="section">
      <div className="wrap narrow">
        <hr className="filet-or" />
        <h1>{t('pied_mentions')}</h1>
        <table className="table-legal">
          <tbody>
            {lignes.map(([l, v]) => (
              <tr key={l}>
                <td>{l}</td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 30 }}>
          {fr
            ? 'Le moteur de réservation et l’encaissement sont opérés par Lodgify. Les conditions de réservation, d’annulation et de paiement vous sont présentées avant tout règlement.'
            : 'The booking engine and payment collection are operated by Lodgify. Booking, cancellation and payment terms are presented to you before any payment.'}
        </p>
      </div>
    </section>
  );
}
