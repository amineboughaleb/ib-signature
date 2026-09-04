import { notFound } from 'next/navigation';
import { estLocale, getT } from '@/lib/i18n';
import { MARQUE } from '@/lib/marque';

import { metaCommune } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return metaCommune(
    locale,
    '/confidentialite',
    locale === 'en' ? 'Privacy · IB Signature' : 'Confidentialité · IB Signature',
    locale === 'en'
      ? 'What data IB Signature collects, why, how long it is kept and how to exercise your rights.'
      : 'Quelles données IB Signature recueille, pourquoi, combien de temps elles sont conservées et comment exercer vos droits.'
  );
}


/**
 * La politique de confidentialité.
 *
 * Elle est courte parce que le site collecte peu : il ne prend aucune
 * réservation et ne voit aucune carte. La seule donnée qu'il recueille est
 * celle d'un propriétaire qui demande un audit. Dire exactement cela vaut mieux
 * qu'un texte de trois pages promettant de protéger des données qu'on ne
 * détient pas - et c'est vérifiable, ce qu'un texte générique n'est jamais.
 */
export default async function Confidentialite({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!estLocale(locale)) notFound();
  const t = getT(locale);
  const fr = locale === 'fr';

  const blocs: Array<[string, string]> = fr
    ? [
        [
          'Ce que nous recueillons',
          'Uniquement ce que vous inscrivez dans le formulaire d’audit : votre nom, votre courriel, votre téléphone, la ville et le type de votre bien, et votre message. La navigation sur ce site ne dépose aucun traceur publicitaire et n’alimente aucune mesure d’audience.',
        ],
        [
          'Pourquoi',
          'Pour vous rappeler et établir l’estimation que vous demandez. Rien d’autre. Ces coordonnées ne sont ni vendues, ni louées, ni transmises à un tiers.',
        ],
        [
          'Combien de temps',
          'Vingt-quatre mois après le dernier échange, puis suppression. Si vous devenez client, la durée devient celle de la relation contractuelle et des obligations comptables qui la suivent.',
        ],
        [
          'La réservation',
          'Elle n’a pas lieu ici. Lorsque vous cliquez sur « Réserver », vous êtes conduit vers notre moteur de réservation, qui recueille alors ses propres données selon sa propre politique. Aucun numéro de carte ne transite par ce site, ni n’y est conservé.',
        ],
        [
          'Vos droits',
          `Accès, rectification, opposition et suppression, à tout moment, en écrivant à ${MARQUE.courriel}. Le traitement est déclaré auprès de la CNDP sous le récépissé [numéro], conformément à la loi 09-08.`,
        ],
      ]
    : [
        [
          'What we collect',
          'Only what you enter in the audit form: your name, email, phone, the city and type of your property, and your message. Browsing this site places no advertising tracker and feeds no analytics.',
        ],
        [
          'Why',
          'To call you back and prepare the estimate you asked for. Nothing else. These details are neither sold, nor rented, nor passed to a third party.',
        ],
        [
          'For how long',
          'Twenty-four months after our last exchange, then deletion. If you become a client, the period becomes that of the contract and the accounting obligations that follow it.',
        ],
        [
          'Booking',
          'It does not happen here. When you click “Book”, you are taken to our booking engine, which then collects its own data under its own policy. No card number passes through this site, nor is kept on it.',
        ],
        [
          'Your rights',
          `Access, correction, objection and deletion, at any time, by writing to ${MARQUE.courriel}. The processing is declared to the CNDP under receipt [number], under law 09-08.`,
        ],
      ];

  return (
    <section className="section">
      <div className="wrap narrow">
        <hr className="filet-or" />
        <h1>{t('pied_confidentialite')}</h1>
        {blocs.map(([titre, texte]) => (
          <div key={titre} className="fiche-bloc">
            <h3>{titre}</h3>
            <p className="muted">{texte}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
