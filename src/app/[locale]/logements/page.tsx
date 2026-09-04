import Link from 'next/link';
import { notFound } from 'next/navigation';
import { estLocale, getT } from '@/lib/i18n';
import { biens, catalogueDegrade } from '@/lib/biens';
import { sejoursMinimums, devisMultiples } from '@/lib/lodgify';
import { disponibiliteReelle, veillerAuxFlux } from '@/lib/flux';
import { metaCommune } from '@/lib/seo';
import { nuitsEntre } from '@/lib/dates';
import Recherche from '@/components/Recherche';
import CarteBien from '@/components/CarteBien';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return metaCommune(
    locale,
    '/logements',
    locale === 'en' ? 'Our apartments · Casablanca & Marrakech · IB Signature' : 'Nos logements · Casablanca & Marrakech · IB Signature',
    locale === 'en'
      ? 'Serviced apartments in Casablanca and Marrakech, each run by our own teams — never subcontracted. Pick your dates to see what is free.'
      : 'Des appartements à Casablanca et Marrakech, chacun tenu par nos équipes et jamais sous-traité. Choisissez vos dates pour voir ce qui est libre.'
  );
}

/**
 * La liste, filtrée par ce que porte l'adresse.
 *
 * Les critères vivent dans l'URL, pas dans un état de composant : la page se
 * partage, se met en favori, revient telle quelle avec le bouton « précédent »,
 * et le filtrage se fait côté serveur. Un voyageur qui envoie « regarde ça » à
 * quelqu'un envoie ce qu'il voit, pas une page d'accueil.
 *
 * Les dates filtrent maintenant l'inventaire : quand les deux sont saisies, on
 * interroge le calendrier de Lodgify et l'on n'affiche que les logements libres
 * sur toute la période.
 *
 * Avec une réserve qui prime sur tout : quand la disponibilité est INCONNUE -
 * pas de clé, Lodgify muet, réponse non reconnue - on n'écarte personne et l'on
 * dit au voyageur que la disponibilité sera confirmée à l'étape suivante.
 * Masquer un logement libre parce qu'une API a eu une mauvaise seconde coûte
 * une réservation ; en afficher un déjà pris coûte un clic. Le doute profite
 * donc toujours à l'affichage.
 */
export default async function Liste({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!estLocale(locale)) notFound();
  const t = getT(locale);
  const q = await searchParams;

  const seul = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';
  const ville = seul(q.ville);
  const arrivee = seul(q.arrivee);
  const depart = seul(q.depart);
  const voyageurs = Number(seul(q.voyageurs)) || 0;

  /* Les calendriers ont-ils vieilli ? Si oui, on lance la relecture derrière
     et l'on sert quand même : le filet de la tâche planifiée, pour le jour où
     celle-ci sera désactivée par mégarde. */
  veillerAuxFlux();

  const tous = await biens();
  const villes = [...new Set(tous.map((b) => b.ville))].sort();
  const degrade = await catalogueDegrade();

  /* Le filtre par nombre de voyageurs n'écarte que ce qu'il sait trop petit.
     Un logement dont Lodgify ne publie pas la capacité reste affiché : le
     supprimer d'une recherche à laquelle il répond peut-être coûte une
     réservation, l'afficher coûte un clic. */
  const critères = tous.filter(
    (b) =>
      (!ville || b.ville === ville) &&
      (!voyageurs || b.voyageurs === undefined || b.voyageurs >= voyageurs)
  );

  /* Le calendrier n'est interrogé que si les deux dates sont là : sans période,
     la question n'a pas de sens et l'appel serait gaspillé. */
  const nuits = nuitsEntre(arrivee, depart);
  /* Le calendrier iCal de chaque logement d'abord - celui de Lodgify, donc
     celui qui porte Airbnb, Booking et les réservations directes - et l'API
     seulement pour les logements qui n'en ont pas encore. C'est l'ordre
     inverse de celui qu'on croirait, et c'est le bon : le chemin des
     disponibilités de l'API n'est pas documenté et change d'une offre à
     l'autre, l'export iCal est une adresse stable publiée pour être lue.

     Ce dont aucune source ne dit rien reste affiché. Cacher un logement libre
     parce qu'une lecture a échoué coûte une réservation ; le montrer alors
     qu'il est pris coûte un clic. */
  const dispos =
    arrivee && depart
      ? await disponibiliteReelle(arrivee, depart, critères.map((b) => b.id))
      : { pris: new Set<number>(), inconnus: new Set<number>(), parIcal: 0, parApi: false };
  const su = dispos.parIcal > 0 || dispos.parApi;
  const liste = critères.filter((b) => !dispos.pris.has(b.id));

  /* Un filtre qui n'écarte rien a l'air cassé. S'il reste des logements dont
     la capacité n'est pas publiée, on le dit plutôt que de laisser croire
     qu'ils accueillent le nombre demandé. */
  const capaciteInconnue = !!voyageurs && liste.some((b) => b.voyageurs === undefined);

  /* Le séjour minimum. Un logement qui n'accepte pas la durée demandée est
     écarté ici plutôt que de renvoyer le voyageur vers un moteur qui lui
     répondra « aucun résultat » sans lui dire pourquoi. */
  /* Les deux questions restantes - « quelle durée minimum ? » et « quel prix
     pour ces dates ? » - partent ensemble.

     Elles s'enchaînaient, et c'était la deuxième moitié d'une page à quatre
     minutes : le séjour minimum interrogeait Lodgify vingt-quatre fois, puis
     les devis recommençaient. Rien ne l'imposait. Le prix se demande pour les
     logements libres, la durée minimum aussi, et aucune des deux réponses
     n'a besoin de l'autre.

     Le devis est demandé sur `liste` et non sur la liste finale : attendre le
     séjour minimum pour savoir quels prix demander, c'était précisément
     remettre les deux à la file. Quelques devis inutiles coûtent moins qu'une
     attente en série. */
  const [minimums, prix] =
    nuits > 0
      ? await Promise.all([
          sejoursMinimums(arrivee, depart),
          devisMultiples(liste.map((b) => b.id), arrivee, depart, voyageurs || 1),
        ])
      : [new Map<number, number>(), new Map<number, { total: number; devise?: string }>()];
  const tropCourts = nuits > 0 ? liste.filter((b) => (minimums.get(b.id) ?? 0) > nuits) : [];
  const finale = tropCourts.length ? liste.filter((b) => !tropCourts.includes(b)) : liste;
  /* La plus petite durée qui rouvrirait des logements : c'est l'information
     utile, bien plus qu'un simple « rien ne correspond ». */
  const minUtile = tropCourts.length ? Math.min(...tropCourts.map((b) => minimums.get(b.id)!)) : 0;

  const filtre = !!(ville || voyageurs || arrivee || depart);

  return (
    <>
      <section className="section-tight liste-tete">
        <div className="wrap">
          <hr className="filet-or" />
          <h1>{t('liste_titre')}</h1>
          <p className="lead" style={{ marginTop: 16 }}>
            {t('liste_texte')}
          </p>
        </div>
      </section>

      <div className="wrap" style={{ marginBottom: 44 }}>
        <Recherche locale={locale} villes={villes} valeurs={{ ville, arrivee, depart, voyageurs: String(voyageurs || 2) }} />
      </div>

      <section className="wrap" style={{ paddingBottom: 96 }}>
        <div className="liste-barre">
          <span className="surtitre">
            {t(su ? 'liste_resultats_libres' : 'liste_resultats', { n: finale.length })}
            {nuits > 0 ? ` · ${t('liste_nuits', { n: nuits })}` : ''}
          </span>
          {filtre && (
            <Link href={`/${locale}/logements`} className="small muted liste-effacer">
              {t('liste_effacer')}
            </Link>
          )}
        </div>

        {degrade && <p className="hint liste-degrade">{t('liste_degrade')}</p>}
        {/* On ne dit plus « les disponibilités n'ont pas pu être vérifiées »
            en bloc : depuis que chaque logement a son propre calendrier, la
            réponse peut être sûre pour vingt et douteuse pour quatre. On
            annonce donc ce qui reste à confirmer, et rien de plus. */}
        {arrivee && depart && !degrade && dispos.inconnus.size > 0 && (
          <p className="hint liste-degrade">
            {t(su ? 'liste_dispo_partielle' : 'liste_dispo_inconnue', { n: dispos.inconnus.size })}
          </p>
        )}
        {capaciteInconnue && !degrade && <p className="hint liste-degrade">{t('liste_capacite_inconnue')}</p>}
        {tropCourts.length > 0 && (
          <p className="hint liste-degrade">
            {t('liste_sejour_minimum', { n: tropCourts.length, min: minUtile })}
          </p>
        )}

        {finale.length === 0 ? (
          <p className="lead">
            {tropCourts.length > 0
              ? t('liste_aucun_sejour', { min: minUtile })
              : t(su ? 'liste_aucun_libre' : 'liste_aucun')}
          </p>
        ) : (
          <div className="grid3 biens-grille">
            {finale.map((b) => (
              <CarteBien
                key={b.slug}
                b={b}
                locale={locale}
                arrivee={arrivee}
                depart={depart}
                voyageurs={voyageurs}
                sejour={prix.get(b.id)}
                nuits={nuits}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
