import { notFound } from 'next/navigation';
import { estLocale, getT } from '@/lib/i18n';
import { MARQUE } from '@/lib/marque';
import { annulation, phrasesAnnulation } from '@/lib/annulation';
import { reglages } from '@/lib/db';
import { metaCommune } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return metaCommune(
    locale,
    '/cgv',
    locale === 'en' ? 'Terms of sale · IB Signature' : 'Conditions générales de vente · IB Signature',
    locale === 'en'
      ? 'Cancellation policy, payment terms and booking conditions for stays booked with IB Signature.'
      : 'Conditions d’annulation, modalités de paiement et conditions de réservation des séjours IB Signature.'
  );
}

/**
 * Les conditions générales de vente.
 *
 * Elles étaient citées sans exister : la case à cocher de l'étape de paiement
 * demandait au voyageur d'accepter des conditions qu'aucun lien ne permettait
 * de lire. Faire accepter un texte introuvable n'est pas seulement discourtois,
 * c'est sans effet - une clause qu'on n'a pas pu consulter ne s'oppose pas à
 * celui qui l'a cochée, et c'est précisément la clause d'annulation qui
 * tomberait la première.
 *
 * Les conditions d'annulation sont EN TÊTE, avant l'identité du vendeur et
 * avant l'objet du contrat. L'ordre habituel des CGV commence par le vendeur ;
 * il est fait pour le juriste qui les rédige, pas pour le voyageur qui les
 * ouvre. Celui-ci vient chercher une seule chose - « si j'annule, que se
 * passe-t-il ? » - et la trouver au douzième paragraphe revient à ne pas la
 * lui donner.
 *
 * Elles viennent des réglages, pas du code : une politique d'annulation se
 * resserre en haute saison et s'assouplit quand les calendriers sont creux, et
 * personne ne redéploie un site pour passer de cinq jours à sept.
 *
 * Ce qui reste à décider par vous figure entre crochets, jamais en blanc : un
 * champ vide se remarque moins qu'un crochet, et finit par partir en ligne.
 */
export default async function CGV({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!estLocale(locale)) notFound();
  const t = getT(locale);
  const fr = locale === 'fr';
  const r = reglages();
  const a = annulation(locale, r);
  const phrases = phrasesAnnulation(locale, a);

  const arriveeH = r.sejour_checkin || '15:00';
  const departH = r.sejour_checkout || '11:00';
  const heuresVirer = Math.max(1, Math.round(Number(r.virement_virer_heures) || 24));
  const heuresBlocage = Math.max(1, Math.round(Number(r.virement_blocage_heures) || 48));

  const sections: Array<{ titre: string; corps: React.ReactNode }> = [
    {
      titre: fr ? 'Le vendeur' : 'The seller',
      corps: (
        <>
          <p>
            {fr
              ? 'Les séjours proposés sous l’enseigne IB Signature sont vendus par Partners Hotels SARL AU, société à associé unique au capital de 1 450 000 dirhams, dont le siège est au '
              : 'Stays offered under the IB Signature name are sold by Partners Hotels SARL AU, a single-member company with share capital of MAD 1,450,000, registered at '}
            {MARQUE.adresse}
            {fr
              ? ', immatriculée au registre du commerce de Casablanca sous le numéro 114465, ICE 000027671000074, identifiant fiscal 01087703.'
              : ', Casablanca commercial register no. 114465, ICE 000027671000074, tax identifier 01087703.'}
          </p>
          <p>
            {fr ? 'Contact : ' : 'Contact: '}
            {MARQUE.courriel} · {MARQUE.telephone}
          </p>
        </>
      ),
    },
    {
      titre: fr ? 'L’objet' : 'What is being sold',
      corps: (
        <p>
          {fr
            ? 'IB Signature met à disposition des appartements meublés pour des séjours de courte et moyenne durée, à Casablanca et à Marrakech. Chaque logement est tenu par les équipes de la maison. La réservation porte sur un logement désigné, pour des dates et un nombre de voyageurs déterminés : elle ne confère aucun droit sur un autre logement, et le nombre de voyageurs annoncé ne peut être dépassé sans accord écrit.'
            : 'IB Signature provides furnished apartments for short and medium-term stays in Casablanca and Marrakech. Every home is run by the house’s own teams. A booking covers one named apartment, for set dates and a set number of guests: it confers no right over any other apartment, and the stated number of guests may not be exceeded without written agreement.'}
        </p>
      ),
    },
    {
      titre: fr ? 'Le prix' : 'The price',
      corps: (
        <>
          <p>
            {fr
              ? 'Le prix affiché est celui du séjour entier, taxes et frais compris. Il comprend le ménage de fin de séjour, le linge de lit et de toilette, ainsi que les charges d’eau, d’électricité et d’accès à internet. Il est ferme dès qu’il est affiché pour des dates données : il ne peut être révisé après la confirmation de la réservation.'
              : 'The price shown is for the whole stay, taxes and fees included. It covers end-of-stay cleaning, bed and bath linen, and water, electricity and internet charges. It is firm once shown for given dates: it cannot be revised after the booking is confirmed.'}
          </p>
          <p>
            {fr
              ? 'La taxe de séjour due à la commune, lorsqu’elle n’est pas comprise dans le prix affiché, est indiquée avant le paiement.'
              : 'Where local tourist tax is not included in the displayed price, it is shown before payment.'}
          </p>
        </>
      ),
    },
    {
      titre: fr ? 'Le paiement' : 'Payment',
      corps: (
        <>
          <p>
            {fr
              ? 'Deux moyens de paiement sont proposés lorsque les deux sont possibles : la carte bancaire, ou le virement bancaire.'
              : 'Two means of payment are offered when both are available: bank card, or bank transfer.'}
          </p>
          <p>
            {fr
              ? 'Le paiement par carte est traité par le prestataire de paiement du moteur de réservation, sur ses propres pages sécurisées. IB Signature n’a à aucun moment connaissance des données de la carte : ni le site, ni ses équipes ne les voient, ne les enregistrent ni ne les conservent. La réservation est confirmée dès l’encaissement.'
              : 'Card payment is handled by the booking engine’s payment provider, on its own secure pages. IB Signature never sees card details: neither the site nor its staff view, record or store them. The booking is confirmed as soon as payment is taken.'}
          </p>
          <p>
            {fr
              ? `Le paiement par virement se déroule autrement. Le site enregistre la demande et communique immédiatement les coordonnées bancaires de Partners Hotels ainsi qu’une référence. Le virement doit être ordonné sous ${heuresVirer} heures. Les dates demandées sont retenues pendant ${heuresBlocage} heures : sans virement constaté dans ce délai, elles sont remises à la vente sans autre formalité. La réservation n’est confirmée qu’à réception effective des fonds. Les frais bancaires éventuels restent à la charge de l’émetteur : le montant exact indiqué doit parvenir sur le compte.`
              : `Bank transfer works differently. The site records the request and immediately provides Partners Hotels’ bank details together with a reference. The transfer must be ordered within ${heuresVirer} hours. The requested dates are held for ${heuresBlocage} hours: without a transfer received within that time, they go back on sale without further notice. The booking is confirmed only once funds are actually received. Any bank charges remain with the sender: the exact amount stated must reach the account.`}
          </p>
        </>
      ),
    },
    {
      titre: fr ? 'L’arrivée et le départ' : 'Arrival and departure',
      corps: (
        <>
          <p>
            {fr
              ? `L’adresse exacte du logement et les modalités d’accès sont communiquées après confirmation de la réservation. L’arrivée se fait à partir de ${arriveeH}, le départ avant ${departH}. Ces horaires sont les mêmes pour tous les logements et quelle que soit la durée du séjour. L’arrivée est autonome : il n’y a pas d’heure de fermeture, et l’on peut entrer à toute heure de la nuit passé ${arriveeH}. Un aménagement peut être accordé selon les réservations qui suivent ; il ne peut être considéré comme acquis avant confirmation écrite.`
              : `The exact address and access details are provided once the booking is confirmed. Check-in is from ${arriveeH}, check-out before ${departH}. These times are the same for every apartment and whatever the length of the stay. Check-in is self-service: there is no closing time, and you may let yourself in at any hour of the night after ${arriveeH}. Adjustments may be granted depending on the bookings that follow; they may not be assumed before written confirmation.`}
          </p>
          <p>
            {fr
              ? 'Une pièce d’identité est demandée à l’arrivée pour chaque voyageur majeur. Cette formalité n’est pas discrétionnaire : la réglementation marocaine impose à l’hébergeur de tenir un registre des personnes hébergées. Un voyageur qui la refuse ne peut être accueilli, et le séjour reste dû.'
              : 'Identity documents are required on arrival for every adult guest. This is not discretionary: Moroccan regulations require the host to keep a register of people accommodated. A guest who refuses cannot be admitted, and the stay remains payable.'}
          </p>
        </>
      ),
    },
    {
      titre: fr ? 'L’usage du logement' : 'Use of the apartment',
      corps: (
        <>
          <p>
            {fr
              ? 'Le logement est remis en bon état de propreté et de fonctionnement. Le voyageur en use raisonnablement et le restitue dans un état comparable, l’usure normale mise à part. Les fêtes, les soirées et l’accueil de personnes non déclarées ne sont pas admis ; il en va de même de toute activité contraire à la loi ou au règlement de copropriété.'
              : 'The apartment is handed over clean and in working order. Guests use it reasonably and return it in comparable condition, normal wear excepted. Parties, events and hosting undeclared people are not permitted, nor is any activity contrary to law or to the building’s rules.'}
          </p>
          <p>
            {fr
              ? 'Les dégradations constatées après le départ sont signalées au voyageur, pièces à l’appui, sous [délai] jours, et leur réparation lui est facturée à hauteur du coût réellement engagé. [Précisez ici si une caution ou une empreinte bancaire est demandée, son montant et son délai de restitution.]'
              : 'Damage found after departure is reported to the guest, with supporting evidence, within [period] days, and is charged at the cost actually incurred. [State here whether a deposit or card hold is taken, its amount and when it is released.]'}
          </p>
        </>
      ),
    },
    {
      titre: fr ? 'La responsabilité' : 'Liability',
      corps: (
        <p>
          {fr
            ? 'IB Signature répond des manquements qui lui sont imputables dans la mise à disposition du logement. Elle ne répond pas des vols, pertes ou dommages subis par les effets personnels des voyageurs, ni des faits de tiers ou de force majeure. Il est recommandé à chaque voyageur d’être couvert par une assurance de responsabilité civile pour la durée du séjour. [Indiquez ici votre propre couverture d’assurance et son assureur.]'
            : 'IB Signature is liable for its own failures in making the apartment available. It is not liable for theft, loss or damage to guests’ personal belongings, nor for the acts of third parties or events beyond its control. Guests are advised to hold personal liability insurance for the duration of the stay. [State your own insurance cover and insurer here.]'}
        </p>
      ),
    },
    {
      titre: fr ? 'Les données personnelles' : 'Personal data',
      corps: (
        <p>
          {fr
            ? 'Les informations demandées lors de la réservation servent à établir le séjour, à tenir le registre imposé par la réglementation et à joindre le voyageur. Elles ne sont ni vendues ni cédées. Leur traitement, leur durée de conservation et les moyens d’exercer vos droits sont détaillés dans la politique de confidentialité.'
            : 'The information requested when booking is used to set up the stay, to keep the register required by regulation, and to reach the guest. It is neither sold nor transferred. How it is processed, how long it is kept and how to exercise your rights are set out in the privacy policy.'}
        </p>
      ),
    },
    {
      titre: fr ? 'Les réclamations et le droit applicable' : 'Complaints and governing law',
      corps: (
        <p>
          {fr
            ? `Toute réclamation est adressée à ${MARQUE.courriel} et reçoit une réponse écrite. Les présentes conditions sont régies par le droit marocain. À défaut d’accord amiable, les tribunaux de Casablanca sont compétents.`
            : `Complaints should be sent to ${MARQUE.courriel} and receive a written reply. These terms are governed by Moroccan law. Failing an amicable settlement, the courts of Casablanca have jurisdiction.`}
        </p>
      ),
    },
  ];

  return (
    <section className="section">
      <div className="wrap narrow">
        <hr className="filet-or" />
        <h1>{t('pied_cgv')}</h1>
        <p className="lead" style={{ marginTop: 16 }}>
          {fr
            ? 'Ce qui suit s’applique à toute réservation faite sur ce site. Les conditions d’annulation viennent en premier : c’est l’information que l’on vient chercher.'
            : 'The following applies to every booking made on this site. The cancellation policy comes first: it is what people come here to find.'}
        </p>

        {/* L'encadré d'annulation, en tête et détaché du reste.
            Le voyageur qui ouvre cette page cherche une seule chose ; la lui
            faire chercher au douzième paragraphe revient à ne pas la lui
            donner. */}
        <div className="card card-pad cgv-annulation">
          <span className="surtitre">{fr ? 'Conditions d’annulation' : 'Cancellation policy'}</span>
          <ul className="cgv-liste">
            {phrases.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          <p className="hint" style={{ marginTop: 16 }}>
            {fr
              ? 'Une annulation se demande par écrit, à '
              : 'Cancellations must be requested in writing, to '}
            {MARQUE.courriel}
            {fr
              ? '. La date retenue est celle de réception de votre message.'
              : '. The date taken into account is when your message is received.'}
          </p>
        </div>

        {sections.map((s, i) => (
          <article key={s.titre} className="cgv-section">
            <h2>
              <span className="cgv-numero">{i + 1}</span> {s.titre}
            </h2>
            {s.corps}
          </article>
        ))}

        <p className="hint" style={{ marginTop: 40 }}>
          {fr ? 'Dernière mise à jour : ' : 'Last updated: '}
          {new Date().toISOString().slice(0, 10)}
        </p>
      </div>
    </section>
  );
}
