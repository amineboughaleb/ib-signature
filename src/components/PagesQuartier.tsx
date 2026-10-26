import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getT } from '@/lib/i18n';
import type { Bien } from '@/lib/biens';
import { jsonFil, jsonListe, metaCommune } from '@/lib/seo';
import {
  cheminQuartier,
  cheminVille,
  paragraphes,
  type Langue,
} from '@/lib/quartiers';
import { etatDesPages, prixMinimum, type EtatQuartier, type EtatVille } from '@/lib/quartiers-serveur';
import CarteBien from './CarteBien';
import DonneesStructurees from './DonneesStructurees';

/**
 * Les pages ville et quartier (spécification du 26 octobre 2026).
 *
 * Une page par recherche : « location appartement Triangle d'Or Casablanca »,
 * à la nuit. Chacune a son texte, écrit pour elle, et la liste des logements
 * qui s'y trouvent, rendue sur le serveur : elle est dans le HTML que lit un
 * moteur, sans attendre le moindre script.
 *
 * Les routes ne font que dire dans quelle langue elles répondent :
 * `/fr/location-appartement/...` et `/en/apartments-for-rent/...` appellent les
 * mêmes fonctions. Une adresse demandée dans la mauvaise langue
 * (`/en/location-appartement/...`) n'existe pas.
 */

type Mots = {
  n: (n: number) => string;
  apd: (p: { prix: number; devise: string }) => string;
  h1Ville: (v: EtatVille) => string;
  h1Quartier: (q: EtatQuartier) => string;
  titreVille: (v: EtatVille) => string;
  titreQuartier: (v: EtatVille, q: EtatQuartier) => string;
  descVille: (v: EtatVille) => string;
  descQuartier: (v: EtatVille, q: EtatQuartier) => string;
  quartiers: string;
  tousVille: (v: EtatVille) => string;
  tousQuartier: (q: EtatQuartier) => string;
  autres: string;
  voir: string;
};

const MOTS: Record<Langue, Mots> = {
  fr: {
    n: (n) => `${n} appartement${n > 1 ? 's' : ''}`,
    apd: (p) => `à partir de ${p.prix.toLocaleString('fr-FR')} ${p.devise} la nuit`,
    h1Ville: (v) => `Location d'appartements ${v.ref.dans.fr}`,
    h1Quartier: (q) => `Appartements à louer ${q.ref.dans.fr}`,
    titreVille: (v) => `Location d'appartements ${v.ref.dans.fr}, courte durée · IB Signature`,
    titreQuartier: (v, q) => `Location d'appartement ${q.ref.dans.fr}, ${v.ref.nom.fr} · IB Signature`,
    descVille: (v) => {
      const p = prixMinimum(v.biens);
      return `${MOTS.fr.n(v.biens.length)} ${v.ref.dans.fr}${p ? `, ${MOTS.fr.apd(p)}` : ''}. Linge et ménage compris, réservation en ligne.`;
    },
    descQuartier: (v, q) => {
      const p = prixMinimum(q.biens);
      return `${MOTS.fr.n(q.biens.length)} ${q.ref.dans.fr}, ${v.ref.dans.fr}${p ? `, ${MOTS.fr.apd(p)}` : ''}. Linge et ménage compris, réservation en ligne.`;
    },
    quartiers: 'Les quartiers',
    tousVille: (v) => `Tous nos appartements ${v.ref.dans.fr}`,
    tousQuartier: (q) => `Nos appartements ${q.ref.dans.fr}`,
    autres: 'Les autres quartiers',
    voir: 'Voir le quartier',
  },
  en: {
    n: (n) => `${n} apartment${n > 1 ? 's' : ''}`,
    apd: (p) => `from ${p.prix.toLocaleString('en-GB')} ${p.devise} a night`,
    h1Ville: (v) => `Apartments for rent ${v.ref.dans.en}`,
    h1Quartier: (q) => `Apartments for rent ${q.ref.dans.en}`,
    titreVille: (v) => `Apartments for rent ${v.ref.dans.en}, short stays · IB Signature`,
    titreQuartier: (v, q) => `${q.ref.nom.en} apartments for rent, ${v.ref.nom.en} · IB Signature`,
    descVille: (v) => {
      const p = prixMinimum(v.biens);
      return `${MOTS.en.n(v.biens.length)} ${v.ref.dans.en}${p ? `, ${MOTS.en.apd(p)}` : ''}. Linen and cleaning included, book online.`;
    },
    descQuartier: (v, q) => {
      const p = prixMinimum(q.biens);
      return `${MOTS.en.n(q.biens.length)} ${q.ref.dans.en}, ${v.ref.nom.en}${p ? `, ${MOTS.en.apd(p)}` : ''}. Linen and cleaning included, book online.`;
    },
    quartiers: 'Neighbourhoods',
    tousVille: (v) => `All our apartments ${v.ref.dans.en}`,
    tousQuartier: (q) => `Our apartments ${q.ref.dans.en}`,
    autres: 'Other neighbourhoods',
    voir: 'See the neighbourhood',
  },
};

async function trouver(langue: Langue, villeCle: string, quartierCle?: string) {
  const etats = await etatDesPages();
  const ville = etats.find((v) => v.ref.cle === villeCle) || null;
  const quartier = quartierCle ? ville?.quartiers.find((q) => q.ref.cle === quartierCle) || null : null;
  return { etats, ville, quartier };
}

const chemins = (f: (l: Langue) => string) => ({ fr: f('fr'), en: f('en') });

/** Un logement apparaît-il dans une page indexable de cette langue ? Seules celles-là reçoivent des liens. */
export const indexable = (e: { statut: Record<Langue, string> }, l: Langue) => e.statut[l] === 'indexable';

export async function metaVille(langue: Langue, villeCle: string) {
  const { ville } = await trouver(langue, villeCle);
  if (!ville || ville.statut[langue] === 'absente') return {};
  const m = MOTS[langue];
  return metaCommune(
    langue,
    cheminVille(langue, villeCle),
    m.titreVille(ville),
    m.descVille(ville),
    ville.biens.find((b) => b.photos[0])?.photos[0],
    chemins((l) => cheminVille(l, villeCle)),
    ville.statut[langue] !== 'indexable'
  );
}

export async function metaQuartier(langue: Langue, villeCle: string, quartierCle: string) {
  const { ville, quartier } = await trouver(langue, villeCle, quartierCle);
  if (!ville || !quartier || quartier.statut[langue] === 'absente') return {};
  const m = MOTS[langue];
  return metaCommune(
    langue,
    cheminQuartier(langue, villeCle, quartierCle),
    m.titreQuartier(ville, quartier),
    m.descQuartier(ville, quartier),
    quartier.biens.find((b) => b.photos[0])?.photos[0],
    chemins((l) => cheminQuartier(l, villeCle, quartierCle)),
    quartier.statut[langue] !== 'indexable'
  );
}

function Fil({ langue, elements }: { langue: Langue; elements: { nom: string; chemin?: string }[] }) {
  return (
    <nav className="wrap fiche-fil quartier-fil" aria-label={langue === 'en' ? 'Breadcrumb' : "Fil d'Ariane"}>
      {elements.map((e, i) => (
        <span key={e.nom}>
          {i > 0 && <span aria-hidden="true"> › </span>}
          {e.chemin ? (
            <Link href={`/${langue}${e.chemin}`} className="lien">
              {e.nom}
            </Link>
          ) : (
            <span aria-current="page">{e.nom}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function Tete({ langue, h1, biens, texte }: { langue: Langue; h1: string; biens: Bien[]; texte: string[] }) {
  const m = MOTS[langue];
  const p = prixMinimum(biens);
  return (
    <section className="section-tight liste-tete quartier-tete">
      <div className="wrap">
        <hr className="filet-or" />
        <h1>{h1}</h1>
        <p className="surtitre quartier-chiffres">{[m.n(biens.length), p ? m.apd(p) : ''].filter(Boolean).join(' · ')}</p>
        <div className="quartier-texte">
          {texte.map((t) => (
            <p key={t.slice(0, 40)}>{t}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

function Grille({ langue, titre, biens }: { langue: Langue; titre: string; biens: Bien[] }) {
  return (
    <section className="wrap quartier-liste">
      <div className="liste-barre">
        <h2 className="quartier-sous-titre">{titre}</h2>
      </div>
      <div className="grid3 biens-grille">
        {biens.map((b) => (
          <CarteBien key={b.slug} b={b} locale={langue} />
        ))}
      </div>
    </section>
  );
}

function Quartiers({
  langue,
  ville,
  titre,
  sauf,
}: {
  langue: Langue;
  ville: EtatVille;
  titre: string;
  sauf?: string;
}) {
  const m = MOTS[langue];
  const liste = ville.quartiers.filter((q) => indexable(q, langue) && q.ref.cle !== sauf);
  if (!liste.length) return null;
  return (
    <section className="section section-alt quartier-autres">
      <div className="wrap">
        <hr className="filet-or" />
        <h2 style={{ marginBottom: 32 }}>{titre}</h2>
        <div className="quartiers-grille">
          {liste.map((q) => {
            const p = prixMinimum(q.biens);
            return (
              <Link key={q.ref.cle} href={`/${langue}${cheminQuartier(langue, ville.ref.cle, q.ref.cle)}`} className="card card-pad quartier-carte">
                <span className="quartier-carte-nom">{q.ref.nom[langue]}</span>
                <span className="quartier-carte-accroche">{q.ref.accroche[langue]}</span>
                <span className="small muted">{[m.n(q.biens.length), p ? m.apd(p) : ''].filter(Boolean).join(' · ')}</span>
                <span className="quartier-carte-lien">
                  {m.voir} <span aria-hidden="true">→</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export async function PageVille({ langue, villeCle }: { langue: Langue; villeCle: string }) {
  const { ville } = await trouver(langue, villeCle);
  if (!ville || ville.statut[langue] === 'absente') notFound();
  const t = getT(langue);
  const m = MOTS[langue];
  const filElements = [
    { nom: t('nav_appartements'), chemin: '/logements' },
    { nom: ville.ref.nom[langue], chemin: cheminVille(langue, villeCle) },
  ];
  return (
    <>
      <DonneesStructurees donnees={jsonFil(langue, filElements)} />
      <DonneesStructurees donnees={jsonListe(langue, m.h1Ville(ville), ville.biens)} />
      <Fil langue={langue} elements={[filElements[0], { nom: ville.ref.nom[langue] }]} />
      <Tete langue={langue} h1={m.h1Ville(ville)} biens={ville.biens} texte={paragraphes(ville.ref.texte[langue], ville.biens.length)} />
      <Quartiers langue={langue} ville={ville} titre={m.quartiers} />
      <div style={{ height: 64 }} />
      <Grille langue={langue} titre={m.tousVille(ville)} biens={ville.biens} />
      <div style={{ height: 96 }} />
    </>
  );
}

export async function PageQuartier({ langue, villeCle, quartierCle }: { langue: Langue; villeCle: string; quartierCle: string }) {
  const { ville, quartier } = await trouver(langue, villeCle, quartierCle);
  if (!ville || !quartier || quartier.statut[langue] === 'absente') notFound();
  const t = getT(langue);
  const m = MOTS[langue];
  const filElements = [
    { nom: t('nav_appartements'), chemin: '/logements' },
    { nom: ville.ref.nom[langue], chemin: cheminVille(langue, villeCle) },
    { nom: quartier.ref.nom[langue], chemin: cheminQuartier(langue, villeCle, quartierCle) },
  ];
  /* Le lien vers la page ville n'est affiché que si elle est publiée : un fil
     d'Ariane qui mène à une page absente est une impasse. */
  const villeVisible = indexable(ville, langue) || ville.statut[langue] === 'retiree';
  const filVisible = [
    filElements[0],
    villeVisible ? filElements[1] : { nom: ville.ref.nom[langue] },
    { nom: quartier.ref.nom[langue] },
  ];
  return (
    <>
      <DonneesStructurees donnees={jsonFil(langue, villeVisible ? filElements : [filElements[0], filElements[2]])} />
      <DonneesStructurees donnees={jsonListe(langue, m.h1Quartier(quartier), quartier.biens)} />
      <Fil langue={langue} elements={filVisible} />
      <Tete
        langue={langue}
        h1={m.h1Quartier(quartier)}
        biens={quartier.biens}
        texte={paragraphes(quartier.ref.texte[langue], quartier.biens.length)}
      />
      <Grille langue={langue} titre={m.tousQuartier(quartier)} biens={quartier.biens} />
      <div style={{ height: 96 }} />
      <Quartiers langue={langue} ville={ville} titre={m.autres} sauf={quartierCle} />
    </>
  );
}
