import Link from 'next/link';
import { notFound } from 'next/navigation';
import { estLocale, getT } from '@/lib/i18n';
import { bien } from '@/lib/biens';
import { optionsPaiement } from '@/lib/reservation';
import { connecte } from '@/lib/admin';
import { annulation, resumeAnnulation } from '@/lib/annulation';
import { reglages } from '@/lib/db';
import { formatDate } from '@/lib/dates';
import FormulaireReservation from '@/components/FormulaireReservation';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const b = await bien(slug);
  const t = getT(locale);
  /* Une page de réservation n'a rien à faire dans un moteur de recherche :
     elle ne décrit rien, elle porte les coordonnées d'un voyageur. */
  return b ? { title: `${t('res_titre')} - ${b.nom}`, robots: { index: false, follow: false } } : {};
}

/**
 * L'étape qui manquait, et sa forme définitive.
 *
 * Jusqu'ici, cliquer sur « Réserver » ouvrait Lodgify. C'était choisir la carte
 * bancaire à la place du voyageur, avant même de lui avoir proposé le virement
 * - donc payer une commission sur des réservations qui n'en avaient pas besoin.
 *
 * Puis cette page a demandé le moyen de paiement, mais rien d'autre : le
 * voyageur choisissait « carte », partait chez Lodgify, et s'il renonçait
 * devant le formulaire bancaire il ne restait de lui aucune trace. Une
 * intention de réserver perdue faute d'avoir demandé un nom.
 *
 * D'où cette disposition. À gauche, ce que le voyageur donne : qui il est, où
 * il réside, comment le joindre. À droite, ce qu'il reçoit : son séjour, son
 * prix, et les deux façons de payer. Le récapitulatif ne bouge pas pendant la
 * saisie - remplir six champs sans plus voir ce qu'on achète est une bonne
 * façon d'abandonner à mi-chemin.
 *
 * Le prix par carte n'est pas majoré ici : il est déjà celui de Lodgify, qui
 * porte la commission puisque c'est lui qui encaisse. Le virement est donc
 * présenté au voyageur pour ce qu'il est de son point de vue - une remise - et
 * non pour ce qu'il est du vôtre, une commission évitée.
 */
export default async function Reserver({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, slug } = await params;
  if (!estLocale(locale)) notFound();
  const t = getT(locale);
  const b = await bien(slug);
  if (!b) notFound();

  const q = await searchParams;
  const seul = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';
  const arrivee = seul(q.arrivee);
  const depart = seul(q.depart);
  const voyageurs = Number(seul(q.voyageurs)) || 0;

  const o = await optionsPaiement(b, arrivee, depart, voyageurs, locale);
  /* Connecté à l'administration dans ce navigateur ? Alors on explique. */
  const admin = await connecte();
  const v = o.virement;

  const argent = (n: number, devise: string) =>
    `${n.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${devise}`;

  /* Sans dates, il n'y a rien à récapituler et rien à chiffrer. Plutôt qu'un
     formulaire qui recueillerait des coordonnées pour un séjour indéfini, on
     renvoie choisir une période. */
  if (o.nuits <= 0) {
    return (
      <section className="section">
        <div className="wrap etape-paiement">
          <hr className="filet-or" />
          <h1 style={{ marginTop: 12 }}>{t('res_titre')}</h1>
          <p className="lead" style={{ marginTop: 14 }}>
            {t('fiche_choisir_dates')}
          </p>
          <p style={{ marginTop: 20 }}>
            <Link href={`/${locale}/logements/${b.slug}`} className="lien">
              <span aria-hidden="true">←</span> {t('res_retour')}
            </Link>
          </p>
        </div>
      </section>
    );
  }

  const devise = o.devis.devise || b.devise || 'EUR';

  /* Le récapitulatif est rendu ici, côté serveur, et passé au formulaire.
     Le prix ne traverse ainsi jamais le navigateur autrement que comme du
     texte à lire : il n'y a aucun champ qui le porte, donc rien à réécrire
     avant de l'envoyer. Il sera de toute façon recalculé à la réception. */
  const resume = (
    <div className="card card-pad reserver-resume">
      <span className="surtitre">{t('res_resume_titre')}</span>
      <h3 className="reserver-resume-nom">{b.nom}</h3>
      <p className="small muted">{[b.quartier, b.ville].filter(Boolean).join(' · ')}</p>

      <dl className="reserver-lignes">
        <div>
          <dt>{t('rech_arrivee')}</dt>
          <dd>{formatDate(arrivee, locale)}</dd>
        </div>
        <div>
          <dt>{t('rech_depart')}</dt>
          <dd>{formatDate(depart, locale)}</dd>
        </div>
        <div>
          <dt>{t('liste_nuits', { n: o.nuits })}</dt>
          <dd>{t(voyageurs > 1 ? 'fait_voyageurs' : 'fait_voyageur', { n: voyageurs || 1 })}</dd>
        </div>
      </dl>

      {/* Le total n'est affiché que si Lodgify l'a rendu. Ailleurs sur ce site
          le doute profite à l'affichage ; sur un prix, il profite au silence. */}
      {o.devis.connu && o.devis.total ? (
        <div className="reserver-total">
          <span>{t('res_total')}</span>
          <b>{argent(o.devis.total, devise)}</b>
        </div>
      ) : (
        <p className="hint" style={{ marginTop: 18 }}>
          {t('res_total_inconnu')}
        </p>
      )}
      <p className="hint" style={{ marginTop: 10 }}>
        {t('res_ttc')}
      </p>
    </div>
  );

  return (
    <section className="section">
      <div className="wrap etape-paiement">
        <p className="fiche-fil" style={{ padding: 0 }}>
          <Link
            href={`/${locale}/logements/${b.slug}?arrivee=${arrivee}&depart=${depart}&voyageurs=${voyageurs}`}
            className="lien"
          >
            <span aria-hidden="true">←</span> {t('res_retour')}
          </Link>
        </p>

        <hr className="filet-or" />
        <div className="eyebrow">{b.nom}</div>

        {/* Le titre est rendu par le formulaire, pas ici : il change avec
            l'etat. « Comment souhaitez-vous regler ? » reste affiche au-dessus
            d'une demande deja enregistree n'a plus de sens - le voyageur
            relisait une question a laquelle il venait de repondre. */}
        <FormulaireReservation
          titre={t('res_titre')}
          resumeAnnulation={resumeAnnulation(locale, annulation(locale, reglages()))}
          locale={locale}
          slug={b.slug}
          arrivee={arrivee}
          depart={depart}
          voyageurs={voyageurs || 1}
          virement={Boolean(v)}
          montantVirement={v ? argent(v.montant, v.devise) : undefined}
          montantCarte={o.devis.connu && o.devis.total ? argent(o.devis.total, devise) : undefined}
          noteVirement={v ? t('res_virement_eco', { m: argent(v.economie, v.devise) }) : undefined}
          mad={
            v && v.mad !== undefined
              ? `${t('res_mad', { m: v.mad.toLocaleString('fr-FR') })}${
                  v.tauxDate ? ` · ${t('res_mad_note', { date: v.tauxDate, d: v.devise })}` : ''
                }`
              : undefined
          }
          tenue={v ? t('res_virement_texte', { h: v.blocageHeures }) : undefined}
          heures={v?.reponseHeures ?? 12}
          heuresVirer={o.heuresVirer}
          heuresBlocage={o.heuresBlocage}
          resume={resume}
        />

        {/* Pourquoi le virement n'est pas proposé - pour vous seul.
         *
         * Sept conditions doivent tenir ensemble, et il suffit qu'une seule
         * manque pour que la carte reste seule. Le site savait laquelle depuis
         * le premier jour : `raison` est calculée à chaque refus. Elle
         * n'était affichée nulle part, et il fallait donc relire le code pour
         * répondre à une question que le site avait déjà résolue.
         *
         * Le voyageur ne la voit jamais - on ne lui doit pas le détail de nos
         * réglages, et « le virement est éteint dans les réglages » ne
         * l'aiderait en rien. Elle n'apparaît que si vous êtes connecté à
         * l'administration dans le même navigateur. */}
        {admin && o.raison && (
          <p className="avert" style={{ marginTop: 26 }}>
            <strong>Visible par vous seul :</strong> le virement n’est pas proposé parce que {o.raison}.
          </p>
        )}
      </div>
    </section>
  );
}
