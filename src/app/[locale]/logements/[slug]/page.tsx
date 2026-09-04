import Link from 'next/link';
import { notFound } from 'next/navigation';
import { estLocale, getT } from '@/lib/i18n';
import { bien, biens, descriptionAffichee } from '@/lib/biens';
import { optionsPaiement } from '@/lib/reservation';
import { reglages } from '@/lib/db';
import { conflit } from '@/lib/flux';
import ChoixDates from '@/components/ChoixDates';
import { sejoursMinimums } from '@/lib/lodgify';
import { formatDate, nuitsEntre } from '@/lib/dates';
import CarteBien from '@/components/CarteBien';
import Mosaique from '@/components/Mosaique';
import Carte from '@/components/Carte';
import Faits from '@/components/Faits';
import Texte from '@/components/Texte';
import { equipementsDe, libelle } from '@/lib/equipements';
import { jsonFil, jsonLogement, metaCommune } from '@/lib/seo';
import DonneesStructurees from '@/components/DonneesStructurees';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const b = await bien(slug);
  if (!b) return {};

  /* La description vient du texte du logement, coupée net à la fin d'une
     phrase plutôt qu'au milieu d'un mot. Ce qui s'affiche dans une page de
     résultats est ce qui décide du clic : une phrase tronquée à « app… » y
     ressemble à une négligence. */
  const texte = descriptionAffichee(b, locale).replace(/\s+/g, ' ').trim();
  const coupe = texte.length > 155 ? `${texte.slice(0, 155).replace(/[\s,;:.]+\S*$/, '')}…` : texte;
  const lieu = [b.quartier, b.ville].filter(Boolean).join(', ');
  const defaut =
    locale === 'en'
      ? `${b.nom}, a serviced apartment in ${lieu}, run like a five-star hotel by IB Signature.`
      : `${b.nom}, appartement tenu comme un hôtel cinq étoiles par IB Signature, à ${lieu}.`;

  return metaCommune(
    locale,
    `/logements/${b.slug}`,
    `${b.nom} - ${lieu} · IB Signature`,
    coupe || defaut,
    b.photos[0]
  );
}

/**
 * La fiche d'un appartement.
 *
 * Tout ce qui précède la décision est ici : les photographies, le quartier, ce
 * qui est compris dans le séjour. Le bouton, lui, ne passe plus
 * systématiquement la main à Lodgify - il mène d'abord à notre propre étape de
 * paiement quand il y a un choix à offrir, et directement au moteur quand il
 * n'y en a pas.
 *
 * La frontière avec Lodgify n'a pas bougé pour autant : c'est toujours lui qui
 * tient les prix, les calendriers et l'encaissement par carte, et rien de ce
 * site ne doit pouvoir les abîmer. Ce qui a changé, c'est l'ordre des
 * questions. Envoyer un voyageur chez Lodgify avant de lui avoir proposé le
 * virement, c'était choisir la carte à sa place - et payer une commission sur
 * des réservations qui n'en avaient pas besoin.
 */
export default async function Fiche({
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
  const nuits = nuitsEntre(arrivee, depart);
  const presentation = descriptionAffichee(b, locale);
  const equipes = equipementsDe(b.equipements || []);

  /* Ces dates sont-elles prises ? La réponse vient du calendrier importé -
     celui de Lodgify, donc celui qui porte Airbnb, Booking et les
     réservations directes. Un logement qu'on laisserait réserver alors qu'il
     est occupé promet un appartement qu'on ne pourra pas livrer, et cela se
     découvre après que le voyageur a choisi. */
  const pris = nuits > 0 ? conflit(b.id, arrivee, depart) : null;

  const options = await optionsPaiement(b, arrivee, depart, voyageurs, locale);
  /* On passe toujours par notre propre étape, même quand seule la carte est
     possible.

     Ce n'était pas le cas : sans virement proposable, la fiche envoyait
     directement sur Lodgify. Le raisonnement se tenait tant que cette étape
     ne servait qu'à choisir un moyen de paiement - une étape qui ne propose
     qu'une chose n'est pas une étape, c'est un clic de plus. Elle demande
     maintenant qui est le voyageur, et cette question vaut d'être posée dans
     les deux cas : celui qui renonce devant le formulaire de carte de Lodgify
     laisse au moins un nom et un numéro. Sans cela, il s'évapore. */
  const lien = `/${locale}/reserver/${b.slug}?arrivee=${arrivee}&depart=${depart}&voyageurs=${voyageurs}`;

  /* Le séjour minimum du logement sur la période demandée. Sans lui, le site
     proposait « Réserver du 31 août au 2 septembre » pour un logement qui n'en
     accepte pas moins de trois : le moteur répondait « aucun résultat », et le
     voyageur en concluait que rien n'était libre. */
  const minimum = nuits > 0 ? (await sejoursMinimums(arrivee, depart)).get(b.id) : undefined;
  const tropCourt = !!minimum && nuits > 0 && nuits < minimum;

  /* Les horaires, les mêmes pour les vingt-quatre logements.

     « Arrivée autonome, à toute heure » disait le contraire de ce que disent
     les conditions : un voyageur pouvait lire qu'il entrait quand il voulait,
     et se présenter à onze heures devant une porte fermée. La formule reste
     vraie sur ce qu'elle voulait dire - il n'y a pas d'heure de fermeture de
     réception, on entre à trois heures du matin si l'on veut - mais elle
     commence désormais par l'heure à partir de laquelle c'est vrai. */
  const rg = reglages();
  const arriveeH = rg.sejour_checkin || '15:00';
  const departH = rg.sejour_checkout || '11:00';
  const compris = [
    t('fiche_c1'),
    t('fiche_c2'),
    t('fiche_c3'),
    t('fiche_c4'),
    t('fiche_c5', { a: arriveeH }),
    t('fiche_c6'),
  ];
  const autres = (await biens()).filter((x) => x.slug !== b.slug).slice(0, 3);

  return (
    <>
      {/* Le logement décrit pour être compris sans être lu : capacité,
          chambres, surface, position, prix d'appel. Rien qui ne soit connu -
          un chiffre inventé ici serait répété par un assistant comme un fait. */}
      <DonneesStructurees donnees={jsonLogement(b, locale)} />
      <DonneesStructurees
        donnees={jsonFil(locale, [
          { nom: t('nav_appartements'), chemin: '/logements' },
          { nom: b.nom, chemin: `/logements/${b.slug}` },
        ])}
      />

      <div className="wrap fiche-fil">
        <Link href={`/${locale}/logements`} className="lien">
          <span aria-hidden="true">←</span> {t('fiche_retour')}
        </Link>
      </div>

      <section className="wrap fiche-tete">
        <div>
          <div className="eyebrow">{[b.quartier, b.ville].filter(Boolean).join(' · ')}</div>
          {/* La taille du titre se règle sur sa longueur : « Number One Racine
              2BR Terrace + parking » ne peut pas s'afficher au même corps que
              « Tamaris ». On passe le nombre de caractères à la feuille de
              style, qui en déduit un corps tenant sur une ligne. */}
          <h1 className="fiche-nom" style={{ marginTop: 14, ['--n' as string]: b.nom.length }}>
            {b.nom}
          </h1>
        </div>
      </section>

      {/* Cinq photographies en tête, comme partout ailleurs : une grande et
          quatre autour. Le composant s'adapte au nombre réel plutôt que de
          laisser des cadres vides, et sans aucune photographie il ne rend rien
          - la trame géométrique tient alors la place, seule. */}
      {b.photos.length > 0 ? (
        <Mosaique photos={b.photos} nom={b.nom} />
      ) : (
        <section className="wrap galerie galerie-vide">
          <figure className="galerie-grande">
            <div className="bien-trame" aria-hidden="true">
              <span>{b.chambres ?? ''}</span>
            </div>
          </figure>
        </section>
      )}

      <section className="wrap fiche-corps">
        <div className="fiche-gauche">
          {/* L'encadré des caractéristiques, comme sur Staytle. Le quartier et
              la capacité sur le fond de la page, ce qui se compte dans un
              panneau bordé - et seulement ce qui est connu. */}
          <Faits b={b} locale={locale} sejourMin={minimum} />

          {presentation && (
            <div className="fiche-bloc">
              <hr className="filet-or" />
              <h2>{t('fiche_presentation_titre')}</h2>
              {/* Une ligne vide sépare deux paragraphes, un simple retour à la
                  ligne reste un retour à la ligne : c'est ainsi qu'on écrit
                  dans un courriel, et donc dans un champ de saisie. Le texte
                  n'est jamais interprété comme du HTML. */}
              <Texte contenu={presentation} />
            </div>
          )}

          {/* Les équipements propres à ce logement, avant ce qui est compris
              dans tous les séjours : le voyageur cherche d'abord ce qui
              distingue cet appartement des autres. */}
          {equipes.length > 0 && (
            <div className="fiche-bloc">
              <hr className="filet-or" />
              <h2>{t('fiche_equipements_titre')}</h2>
              <ul className="equipements">
                {equipes.map((e) => (
                  <li key={e.cle}>
                    <svg className="fait-ic" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={e.d} />
                    </svg>
                    {libelle(e, locale)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="fiche-bloc">
            <hr className="filet-or" />
            <h2>{t('fiche_compris_titre')}</h2>
            {/* Les horaires en tête de cette liste et non perdus au milieu :
                c'est la seule ligne dont dépend l'organisation d'un voyage -
                un vol qui atterrit à sept heures du matin ne se planifie pas
                de la même façon selon qu'on entre à midi ou à quinze heures. */}
            <p className="compris-horaires">{t('fiche_horaires', { a: arriveeH, d: departH })}</p>
            <ul className="compris">
              {compris.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>

          {/* Le quartier, dit puis montré. Le texte porte ce qu'une carte ne
              dira jamais - l'ambiance d'une rue, ce qu'on y trouve le soir - et
              la carte porte ce qu'aucun texte ne remplace : la distance. */}
          {(b.quartierTexte || (b.latitude !== undefined && b.longitude !== undefined)) && (
            <div className="fiche-bloc">
              <hr className="filet-or" />
              <h2>{t('fiche_quartier_titre')}</h2>
              {b.quartierTexte && <Texte contenu={b.quartierTexte[locale === 'fr' ? 'fr' : 'en']} />}
              <Carte
                lat={b.latitude}
                lng={b.longitude}
                quartier={b.quartier}
                ville={b.ville}
                locale={locale}
              />
            </div>
          )}
        </div>

        {/* Le passage de main. Collé en haut de la colonne, il reste visible
            pendant qu'on lit le reste : c'est la seule décision de la page. */}
        <aside className="reserver">
          <div className="card card-pad">
            {/* Les dates se choisissent ici, sur la fiche. Un voyageur qui
                arrive par un lien ou par un moteur de recherche n'a pas vu la
                barre de la page des logements, et devait remonter pour
                redescendre. Beaucoup ne remontent pas. */}
            <ChoixDates
              locale={locale}
              slug={b.slug}
              arrivee={arrivee}
              depart={depart}
              voyageurs={voyageurs}
              libelle={t('fiche_choisir_dates')}
            />

            {/* Le prix du séjour, quand il est connu.

                La liste l'affichait déjà et la fiche retombait sur « à partir
                de X / nuit » : le voyageur cliquait sur « 225 EUR » et lisait
                « 60 EUR ». Deux montants justes, dont le rapprochement ne
                voulait rien dire - et c'est exactement au moment de décider
                qu'on lui retirait le seul chiffre qui l'intéresse. */}
            {options.devis.connu && options.devis.total ? (
              <div className="reserver-prix">
                <span className="surtitre">{nuits > 0 ? t('bien_total', { n: nuits }) : t('bien_apd')}</span>
                <b>
                  {options.devis.total.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
                    maximumFractionDigits: 0,
                  })}{' '}
                  {options.devis.devise || b.devise || ''}
                </b>
              </div>
            ) : b.prixDepuis ? (
              <div className="reserver-prix">
                <span className="surtitre">{t('bien_apd')}</span>
                <b>
                  {b.prixDepuis.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB')} {b.devise || ''}
                </b>
                <span className="small muted">{t('bien_nuit')}</span>
              </div>
            ) : (
              <div className="surtitre" style={{ marginBottom: 18 }}>
                {t('bien_voir')}
              </div>
            )}

            {nuits > 0 && (
              <p className="small muted reserver-dates">
                {formatDate(arrivee, locale)} → {formatDate(depart, locale)} · {t('liste_nuits', { n: nuits })}
              </p>
            )}

            {minimum && (
              <p className={`small reserver-minimum${tropCourt ? ' reserver-alerte' : ' muted'}`}>
                {tropCourt ? t('fiche_trop_court', { min: minimum }) : t('fiche_minimum', { min: minimum })}
              </p>
            )}

            {/* Quand la durée demandée est trop courte, le bouton cesse de
                promettre une réservation : il propose de voir les
                disponibilités, ce qui est la seule chose qu'il puisse tenir. */}
            {/* Des dates prises : le bouton cesse de promettre une
                réservation. Le proposer quand même renverrait le voyageur vers
                un moteur qui lui dirait non, sans lui dire pourquoi. */}
            {pris ? (
              <>
                <p className="avert reserver-pris">
                  {t('fiche_pris', {
                    a: formatDate(pris.d, locale),
                    d: formatDate(pris.f, locale),
                  })}
                </p>
                <Link className="btn btn-block-or" href={`/${locale}/logements`}>
                  {t('fiche_autres_dates')}
                </Link>
              </>
            ) : (
              <>
                {/* Un lien qui reste sur le site ne s'ouvre pas dans un onglet
                    neuf : c'est la suite du parcours, pas une sortie. */}
                <a
                  className="btn btn-block-or"
                  href={lien}
                >
                  {tropCourt
                    ? t('fiche_reserver')
                    : nuits > 0
                      ? t('fiche_reserver_dates', { a: formatDate(arrivee, locale), d: formatDate(depart, locale) })
                      : t('fiche_reserver')}
                </a>
                <p className="hint" style={{ marginTop: 14 }}>
                  {/* La promesse tient au virement, pas au chemin : à moins de
                      cinq jours de l'arrivée il n'est plus proposable, et
                      annoncer deux moyens serait alors faux. */}
                  {options.virement ? t('fiche_ou_deux') : t('fiche_ou')}
                </p>
              </>
            )}
          </div>
        </aside>
      </section>

      {autres.length > 0 && (
        <section className="section section-alt">
          <div className="wrap">
            <hr className="filet-or" />
            <h2 style={{ marginBottom: 40 }}>{t('fiche_autres')}</h2>
            <div className="grid3 biens-grille">
              {autres.map((x) => (
                <CarteBien key={x.slug} b={x} locale={locale} arrivee={arrivee} depart={depart} voyageurs={voyageurs} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
