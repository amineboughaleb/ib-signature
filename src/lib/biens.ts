/**
 * L'inventaire, et d'où il vient.
 *
 * Une seule source de vérité : Lodgify. C'est lui qui tient les prix, les
 * calendriers et la synchronisation avec Airbnb et Booking, et c'est là que
 * vous travaillez déjà. Rien ne se saisit ici une seconde fois - un second
 * catalogue finirait par mentir, et c'est toujours celui que le voyageur lit.
 *
 * Le site y ajoute seulement ce que Lodgify ne sait pas dire : un texte de
 * quartier, un ordre de présentation, une mise en avant. Cet enrichissement
 * vit dans `data/enrichissement.json`, à côté du code, et se rattache à un
 * bien par son identifiant Lodgify.
 *
 * Sans clé d'API - en développement, ou le jour où Lodgify est indisponible -
 * le site ne tombe pas : il sert le catalogue de repli ci-dessous, qui ne
 * porte que des noms et des quartiers, jamais de prix inventé. Un prix faux
 * est pire qu'un prix absent.
 */

import { adresseReservation } from './checkout';
import { listerBiens, type BienLodgify } from './lodgify';
import enrichissement from '../../data/enrichissement.json';
/* Les galeries issues de l'import, versionnées avec le code. Elles voyagent
   avec les fichiers d'images ; la base, elle, reste sur le serveur. */
import galeriesVersionnees from '../../data/galeries.json';
import { listerImages, liensReservation, galeries, descriptions, tousLesFaits, equipements } from './db';

export type Bien = {
  /** L'identifiant Lodgify. C'est la clef de tout le reste. */
  id: number;
  slug: string;
  nom: string;
  ville: string;
  quartier: string;
  /* Indéfini quand Lodgify ne le dit pas. Une capacité inventée écarterait des
     logements d'une recherche à laquelle ils répondent peut-être. */
  chambres?: number;
  voyageurs?: number;
  /** La description telle que Lodgify la porte. */
  description?: string;
  /** Celle saisie dans l'administration, langue par langue. Elle l'emporte. */
  descriptionSaisie?: { fr: string; en: string };
  /** Les coordonnées, quand Lodgify les porte. */
  latitude?: number;
  longitude?: number;
  /* Les caractéristiques affichées dans l'encadré. Indéfini veut dire
     « inconnu » : l'encadré n'en parle pas plutôt que d'avancer un chiffre. */
  lits?: number;
  /** Les canapés-lits, comptés à part des lits : ils ne se valent pas. */
  canapes?: number;
  /** Salles de bain (baignoire) et salles d'eau (douche, souvent avec WC). */
  bains?: number;
  eau?: number;
  surface?: number;
  sejourMin?: number;
  /** Les clefs d'équipements retenues, dans l'ordre du catalogue. */
  equipements?: string[];
  /** Prix d'appel par nuit, dans la devise du compte. Absent tant que Lodgify n'est pas joint. */
  prixDepuis?: number;
  devise?: string;
  photos: string[];
  /** Le paragraphe de quartier, écrit à la main, que Lodgify n'héberge pas. */
  quartierTexte?: { fr: string; en: string };
  /** Rang d'affichage. Les biens sans rang passent après, dans l'ordre de Lodgify. */
  rang?: number;
  enAvant?: boolean;
  /** L'adresse de réservation Lodgify de ce bien. */
  reservation?: string;
};

type Enrichissement = {
  base_reservation: string;
  /* Le tunnel de paiement Lodgify, qui s'adresse par identifiant numérique et
     non par slug. `checkout_compte` est le nom du compte tel qu'il apparaît
     dans l'adresse - pour IB Signature, « ibsignature ». Vide, aucune adresse
     n'est construite et l'on retombe sur `base_reservation` : mieux vaut le
     détour connu qu'une adresse devinée. */
  checkout_base?: string;
  checkout_compte?: string;
  /* Les photos de l'accroche, si l'on veut choisir. Vide, ce sont les
     premières photos des biens mis en avant qui servent - la vitrine se tient
     donc à jour d'elle-même quand un bien change de photo chez Lodgify. */
  diaporama?: string[];
  biens: Record<
    string,
    {
      slug?: string;
      rang?: number;
      enAvant?: boolean;
      quartier?: string;
      quartierTexte?: { fr: string; en: string };
      /* Des coordonnées écrites à la main, pour un logement que Lodgify ne
         géolocalise pas. Elles ne servent qu'en secours : ce que Lodgify sait
         passe toujours devant, sans quoi une correction faite là-bas resterait
         sans effet ici. */
      latitude?: number;
      longitude?: number;
    }
  >;
  repli: Array<{ slug: string; nom: string; ville: string; quartier: string; chambres: number; voyageurs: number }>;
};

const E = enrichissement as Enrichissement;

export const identifiant = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * L'adresse de réservation d'un logement chez Lodgify.
 *
 * Elle se fabrique, finalement - et c'était une bonne nouvelle inattendue.
 *
 * J'avais conclu l'inverse, et je m'étais trompé de page. L'ancien essai visait
 * le site vitrine du moteur, `ibsignature.lodgify.com`, dont les adresses sont
 * des slugs en français qu'aucun champ de l'API ne porte : une adresse
 * construite à partir d'un identifiant y rendait une page introuvable, au
 * moment précis où le voyageur allait payer. D'où les vingt-quatre adresses à
 * coller à la main.
 *
 * Mais le tunnel de paiement, lui, vit sur un autre domaine - `checkout` - et
 * s'adresse par identifiant numérique, pas par slug :
 *
 *     checkout.lodgify.com/{langue}/{compte}/{idLogement}/contact?arrival=…
 *
 * C'est exactement l'identifiant que l'API rend pour chaque logement. Les
 * vingt-quatre adresses n'ont donc plus à être saisies, et le voyageur qui
 * choisit la carte arrive droit sur l'étape « coordonnées » de SON
 * appartement, dates et voyageurs déjà remplis.
 *
 * Trois cas, dans cet ordre. Une adresse collée qui vise déjà le tunnel
 * l'emporte sur tout - c'est l'échappatoire, le moyen de réparer sans
 * redéployer le jour où Lodgify changera la forme de ses adresses. Sinon on
 * construit. Et en dernier recours seulement, l'adresse collée du site
 * vitrine, ou la page « toutes les propriétés » : un détour vaut mieux qu'une
 * impasse.
 */
export function lienReservation(
  b: Bien,
  arrivee?: string,
  depart?: string,
  voyageurs?: number,
  locale?: string
): string {
  /* Toute la règle vit dans `checkout.ts`, qui n'importe rien et se vérifie
     donc sans base ni navigateur. Ici, on ne fait que lui donner ce que le
     catalogue sait. */
  return adresseReservation({
    collee: b.reservation,
    repli: E.base_reservation,
    base: E.checkout_base,
    compte: E.checkout_compte,
    bienId: b.id,
    devise: b.devise,
    locale,
    arrivee,
    depart,
    voyageurs,
  });
}

function fusionner(l: BienLodgify): Bien {
  const e = E.biens[String(l.id)] || {};
  return {
    id: l.id,
    slug: e.slug || identifiant(l.nom),
    nom: l.nom,
    ville: l.ville || 'Casablanca',
    quartier: e.quartier || l.quartier || '',
    chambres: l.chambres,
    voyageurs: l.voyageurs,
    description: l.description,
    latitude: l.latitude ?? e.latitude,
    longitude: l.longitude ?? e.longitude,
    lits: l.lits,
    bains: l.bains,
    surface: l.surface,
    prixDepuis: l.prixDepuis,
    devise: l.devise,
    photos: l.photos || [],
    quartierTexte: e.quartierTexte,
    rang: e.rang,
    enAvant: e.enAvant,
  };
}

/** Le catalogue de repli : des noms et des quartiers, jamais un prix. */
function repli(): Bien[] {
  return E.repli.map((r, i) => {
    const e = Object.values(E.biens).find((x) => x.slug === r.slug) || {};
    return {
      id: -(i + 1),
      slug: r.slug,
      nom: r.nom,
      ville: r.ville,
      quartier: r.quartier,
      chambres: r.chambres,
      voyageurs: r.voyageurs,
      photos: [],
      latitude: (e as any).latitude,
      longitude: (e as any).longitude,
      quartierTexte: (e as any).quartierTexte,
      rang: (e as any).rang,
      enAvant: (e as any).enAvant,
    };
  });
}

const parRang = (a: Bien, b: Bien) => (a.rang ?? 999) - (b.rang ?? 999) || a.nom.localeCompare(b.nom, 'fr');

export async function biens(): Promise<Bien[]> {
  const bruts = await listerBiens();
  const liste = bruts.length ? bruts.map(fusionner) : repli();
  /* Les adresses de réservation exactes, collées une fois dans
     l'administration. Sans elles, chaque logement retombe sur la page
     « toutes les propriétés », qui existe toujours. */
  const liens = liensReservation();
  /* Les galeries en base viennent compléter la photo de couverture. L'API de
     Lodgify n'en expose qu'une par logement, et son moteur public est gardé par
     un contrôle anti-robot : les images viennent donc des photographies
     d'origine, déposées dans public/photos par le script d'import.
     Celles-là passent devant. Ce sont les tirages professionnels, servis
     depuis notre propre domaine, et le jour où IB Signature changera de moteur
     de réservation elles seront toujours là - alors qu'une adresse pointant
     vers le serveur d'images d'un tiers s'éteindra avec le contrat. La
     couverture Lodgify reste, mais derrière : mieux vaut une image de trop
     qu'une fiche vide. */
  const supplements = galeries();
  /* Le report : pour tout logement dont la base ne dit rien, on prend la liste
     versionnée. La base garde le dernier mot - ce que vous rangez dans
     l'administration passe devant ce fichier, sans quoi un déploiement
     défairait votre travail. */
  const reportees = galeriesVersionnees as Record<string, string[]>;
  const textes = descriptions();
  /* Ce qui a été saisi dans l'administration passe devant Lodgify : vous
     connaissez vos appartements mieux qu'une API, et un champ laissé à zéro
     n'efface rien - il rend simplement la main. */
  const saisis = tousLesFaits();
  const equipes = equipements();
  for (const b of liste) {
    const u = liens.get(b.id);
    if (u) b.reservation = u;
    const t = textes.get(b.id);
    if (t) b.descriptionSaisie = t;
    const f = saisis.get(b.id);
    if (f) {
      b.chambres = f.chambres || b.chambres;
      b.voyageurs = f.voyageurs || b.voyageurs;
      b.lits = f.lits || b.lits;
      b.canapes = f.canapes || undefined;
      b.bains = f.bains || b.bains;
      b.eau = f.eau || undefined;
      b.surface = f.surface || b.surface;
      b.sejourMin = f.sejour_min || undefined;
      b.quartier = f.quartier || b.quartier;
    }
    const eq = equipes.get(b.id);
    if (eq) b.equipements = eq;
    const sup = supplements.get(b.id) || reportees[String(b.id)];
    if (!sup) continue;
    const notres = sup.filter((x) => x.startsWith('/'));
    const ailleurs = sup.filter((x) => !x.startsWith('/'));
    b.photos = [
      ...notres,
      ...b.photos.filter((x) => !sup.includes(x)),
      ...ailleurs.filter((x) => !b.photos.includes(x)),
    ];
  }
  return liste.sort(parRang);
}

export async function bien(slug: string): Promise<Bien | undefined> {
  return (await biens()).find((b) => b.slug === slug);
}

/** Vrai quand le catalogue affiché vient d'un repli, donc sans prix ni calendrier. */
export async function catalogueDegrade(): Promise<boolean> {
  return (await listerBiens()).length === 0;
}

/**
 * Les photos de l'accroche.
 *
 * Quatre sources, dans cet ordre : les images actives du diaporama, celles que
 * vous rangez depuis l'administration - c'est le cas normal ; sinon la liste
 * figée de l'enrichissement, héritée d'avant l'administration ; sinon la
 * première photo de chaque logement mis en avant, ce qui garde la vitrine à
 * jour toute seule ; sinon rien, et la trame Art déco reste seule. Ce dernier
 * cas n'est pas un échec - une page d'accueil sans photographie tient debout,
 * une page d'accueil avec un cadre vide, non.
 */
export async function photosAccroche(max = 6): Promise<string[]> {
  const choisies = listerImages(true)
    .map((i) => i.url.trim())
    .filter(Boolean);
  if (choisies.length) return choisies.slice(0, max);
  if (E.diaporama?.length) return E.diaporama.slice(0, max);
  const liste = await biens();
  const enAvant = liste.filter((b) => b.enAvant);
  return [...(enAvant.length ? enAvant : liste)]
    .map((b) => b.photos[0])
    .filter((u): u is string => !!u)
    .slice(0, max);
}

/**
 * Le texte de présentation d'un logement, dans la langue demandée.
 *
 * Ce qui a été écrit dans l'administration passe avant ce que porte Lodgify -
 * dont les textes sont rédigés pour Airbnb et Booking, souvent en anglais
 * seulement, et parsemés de règles de maison qui n'ont pas leur place sur une
 * fiche. Une langue laissée vide retombe sur Lodgify plutôt que sur du blanc.
 */
export function descriptionAffichee(b: Bien, locale: string): string {
  const l = locale === 'en' ? 'en' : 'fr';
  return (b.descriptionSaisie?.[l] || '').trim() || (b.description || '').trim();
}
