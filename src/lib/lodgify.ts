/**
 * Lecture du compte Lodgify.
 *
 * En lecture seule, et volontairement : Lodgify reste le maître des prix, des
 * calendriers et de la distribution vers Airbnb et Booking. Ce site ne fait
 * qu'y puiser pour présenter, puis rend la main au moment de payer. Rien n'est
 * écrit chez Lodgify depuis ici, et il n'y a donc aucun risque qu'un défaut de
 * ce site abîme un calendrier dont dépendent trois plateformes.
 *
 * La clé vit UNIQUEMENT dans la variable d'environnement LODGIFY_API_KEY.
 * Elle n'est jamais écrite sur disque, jamais renvoyée au navigateur, jamais
 * consignée dans un journal. Sans elle, chaque fonction rend une liste vide et
 * le site sert son catalogue de repli plutôt que d'afficher une erreur au
 * visiteur.
 */

import { compterRefus, delaiApresRefus, encadrer, freiner } from './limite';

const BASE = 'https://api.lodgify.com';
/* Le pare-feu applicatif de Lodgify écarte les clients sans en-tête de
   navigateur. Modifiable par l'environnement, pour n'avoir pas à toucher au
   code le jour où le filtre change. */
const UA = process.env.LODGIFY_USER_AGENT || 'IBSignature/1.0 (+https://ibsignature.com)';

export type BienLodgify = {
  id: number;
  nom: string;
  ville: string;
  quartier: string;
  /* Facultatifs : la version 2 de l'API ne porte pas toujours ces valeurs au
     niveau du logement, et une valeur inventée est pire qu'une valeur absente.
     Indéfini veut dire « on ne sait pas », et le filtre n'écarte alors rien. */
  chambres?: number;
  voyageurs?: number;
  prixDepuis?: number;
  devise?: string;
  photos: string[];
  /* La description telle que Lodgify la porte, nettoyée de son HTML. Absente
     quand le compte n'en publie pas : une description inventée serait pire
     qu'un silence, puisqu'elle décrirait un logement que personne n'a vu. */
  description?: string;
  /* Les coordonnées, quand Lodgify les porte. Absentes, la fiche montre le
     quartier en toutes lettres plutôt qu'une carte pointée au hasard. */
  latitude?: number;
  longitude?: number;
  /* Les caractéristiques que Lodgify veut bien dire. Toutes facultatives :
     l'encadré n'affiche que ce qui est connu, et rien n'y est deviné. */
  lits?: number;
  bains?: number;
  surface?: number;
};

/** Une coordonnée n'est valable que dans ses bornes : hors d'elles, elle
    place une épingle dans l'océan plutôt que de ne rien montrer. */
function coordonnee(v: any): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return undefined;
  return Math.abs(n) <= 180 ? n : undefined;
}

/* ---------- les caractéristiques ----------
   Lits, salles de bain, surface : ces trois-là ne sont pas au même endroit
   selon les comptes, ni sous le même nom. On regarde donc partout où c'est
   plausible - au niveau du logement, puis dans ses chambres - et l'on somme
   les lits, qui se comptent par pièce, quand on additionne ce qui doit l'être.

   Ce qui n'est pas trouvé reste indéfini, et l'encadré n'en parle pas. Un
   « 1 salle de bain » posé par défaut sur un quatre-pièces serait faux la
   moitié du temps, et c'est le genre d'erreur qu'un voyageur découvre sur
   place. */
function nombreDe(src: any, noms: string[]): number | undefined {
  if (!src || typeof src !== 'object') return undefined;
  for (const n of noms) {
    const v = nombre(src[n]);
    if (v !== undefined && v > 0) return v;
  }
  return undefined;
}

const chambresDe = (p: any) => p?.rooms?.items ?? p?.rooms ?? p?.items ?? (Array.isArray(p) ? p : []);

export function extraireLits(p: any): number | undefined {
  const direct = nombreDe(p, ['beds', 'bed_count', 'bedCount', 'nb_beds', 'total_beds']);
  if (direct) return direct;
  const pieces = chambresDe(p);
  if (!Array.isArray(pieces) || !pieces.length) return undefined;
  /* Les lits se comptent par pièce : ici l'on somme, contrairement à la
     capacité où l'on prend le maximum. */
  const total = pieces.reduce((n: number, r: any) => n + (nombreDe(r, ['beds', 'bed_count', 'nb_beds']) || 0), 0);
  return total > 0 ? total : undefined;
}

export function extraireBains(p: any): number | undefined {
  const direct = nombreDe(p, ['bathrooms', 'bathroom_count', 'bathroomCount', 'nb_bathrooms', 'baths']);
  if (direct) return direct;
  const pieces = chambresDe(p);
  if (!Array.isArray(pieces) || !pieces.length) return undefined;
  const total = pieces.reduce((n: number, r: any) => n + (nombreDe(r, ['bathrooms', 'baths']) || 0), 0);
  return total > 0 ? total : undefined;
}

export function extraireSurface(p: any): number | undefined {
  const v = nombreDe(p, ['area', 'surface', 'size', 'sqm', 'square_meters', 'squareMeters', 'living_area']);
  /* Un logement de trois mètres carrés ou de trois mille n'existe pas : au-delà
     de ces bornes, la valeur trouvée mesure autre chose. */
  return v && v >= 10 && v <= 2000 ? Math.round(v) : undefined;
}

/* ---------- les descriptions ----------
   Lodgify ne range pas le texte d'un logement à un seul endroit, ni sous une
   seule forme : parfois une chaîne, parfois un objet par langue, parfois un
   tableau d'objets { language, text }. Et le champ change de nom selon
   l'ancienneté du compte. On regarde donc partout où c'est plausible, dans
   l'ordre du plus complet au plus court, et l'on prend le premier texte qui a
   vraiment quelque chose à dire.

   Rien n'est fabriqué : si aucun champ ne répond, la description reste
   absente, et la fiche montre ce qu'elle sait plutôt qu'un paragraphe
   inventé. */
const CHAMPS_DESCRIPTION = [
  'description',
  'long_description',
  'longDescription',
  'property_description',
  'summary',
  'short_description',
  'shortDescription',
  'space',
  'notes',
  'in_out',
];

/** Le HTML de Lodgify devient du texte : ce site a sa propre typographie. */
function enTexte(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Déplie une valeur qui peut être une chaîne, un dictionnaire de langues, ou une liste. */
function texteDe(v: any, langue = 'fr'): string {
  if (!v) return '';
  if (typeof v === 'string') return enTexte(v);
  if (Array.isArray(v)) {
    /* Une liste de traductions : on cherche la nôtre, sinon la première. */
    const parLangue = v.find(
      (x) => x && typeof x === 'object' && String(x.language || x.locale || x.lang || '').toLowerCase().startsWith(langue)
    );
    const choisi = parLangue || v[0];
    if (typeof choisi === 'string') return enTexte(choisi);
    if (choisi && typeof choisi === 'object')
      return texteDe(choisi.text ?? choisi.value ?? choisi.description ?? choisi.content, langue);
    return '';
  }
  if (typeof v === 'object') {
    const direct = v[langue] ?? v[langue.toUpperCase()] ?? v.fr ?? v.en ?? v.text ?? v.value;
    if (direct) return texteDe(direct, langue);
  }
  return '';
}

export function extraireDescription(p: any, langue = 'fr'): string | undefined {
  if (!p || typeof p !== 'object') return undefined;
  const sources = [p, p.property, ...(Array.isArray(p.rooms) ? p.rooms : [])];
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const champ of CHAMPS_DESCRIPTION) {
      const t = texteDe(src[champ], langue);
      /* Deux phrases au moins : un champ qui ne contient que « Apartment »
         n'est pas une description, c'est une étiquette. */
      if (t && t.length >= 60) return t;
    }
  }
  return undefined;
}

/**
 * Les champs qui pourraient désigner un logement sur le moteur de réservation.
 *
 * L'adresse d'une fiche chez Lodgify est en clair - /fr/number-six-triangle-or -
 * et non à base d'identifiants. Si l'API porte quelque part ce morceau
 * d'adresse, les vingt-quatre liens se construisent au lieu de se coller un
 * par un. On montre donc les champs courts qui ressemblent à un slug ou à une
 * adresse, avec leur valeur : c'est la valeur qui tranche, pas le nom.
 */
export function pistesAdresse(p: any): string[] {
  if (!p || typeof p !== 'object') return [];
  const sorties: string[] = [];
  for (const [k, v] of Object.entries(p)) {
    if (typeof v !== 'string' || !v || v.length > 120) continue;
    /* Deux familles de faux positifs, écartées d'emblée : les adresses
       d'images, qui sont des adresses mais pas celles d'une fiche, et les
       dates, dont la forme 0001-01-01 imite à s'y méprendre un identifiant
       lisible. Un diagnostic qui crie au loup ne sert plus à rien. */
    if (/image|photo|picture|thumb|logo|icon/i.test(k)) continue;
    if (/^\d{4}-\d{2}-\d{2}/.test(v) || /date|_at$/i.test(k)) continue;
    const nomParlant = /slug|url|link|permalink|friendly|path|handle|seo|web/i.test(k);
    const valeurParlante = /^https?:\/\//i.test(v) || /^[a-z]+(-[a-z0-9]+){2,}$/.test(v);
    if (nomParlant || valeurParlante) sorties.push(`${k} = ${v}`);
  }
  return sorties.sort();
}

/** Les champs textuels d'une fiche, pour le diagnostic. */
export function champsTexte(p: any): string[] {
  if (!p || typeof p !== 'object') return [];
  return Object.entries(p)
    .filter(([, v]) => typeof v === 'string' && v.length > 40)
    .map(([k, v]) => `${k} (${(v as string).length})`)
    .sort();
}

/* Le catalogue change rarement dans la journée : on le garde en mémoire cinq
   minutes plutôt que d'appeler Lodgify à chaque visiteur. Une page d'accueil
   qui attend une API distante est une page d'accueil lente. */
/* Les formes de chemin susceptibles de rendre une galerie complète. {p} est
   l'identifiant du logement. La version 1 de l'API est la plus généreuse. */
const CHEMINS_GALERIE = [
  '/v1/properties/{p}',
  '/v1/properties',
  '/v2/properties/{p}/rooms',
  '/v2/properties/{p}?includeImages=true',
  '/v1/properties/{p}/images',
  '/v2/properties/{p}/images',
];
let cheminGalerie: string | null = null;
/* Vrai quand tous les chemins de galerie ont échoué : inutile de recommencer. */
let galerieAbandonnee = false;

let cache: { a: number; v: BienLodgify[] } | null = null;
const TTL = 5 * 60 * 1000;

/* Le rafraîchissement en cours, s'il y en a un.
 *
 * Reconstruire le catalogue coûte une cinquantaine d'appels : la liste, puis
 * les chambres de chaque logement, puis les fiches manquantes. À trois appels
 * de front, c'est une trentaine de secondes. Tant que ce travail se faisait
 * DANS la requête d'un visiteur, ce visiteur attendait une demi-minute - et
 * comme le cache expire toutes les cinq minutes, c'était un visiteur sur
 * plusieurs, au hasard, sans que rien ne l'explique.
 *
 * Désormais le catalogue périmé est servi tel quel et le rafraîchissement part
 * derrière. Le visiteur voit des données vieilles de cinq minutes - un nom, une
 * photo, une capacité, rien qui bouge à cette échelle - au lieu d'attendre des
 * données fraîches. Seul le tout premier visiteur, sur un serveur qui vient de
 * démarrer, paie le prix plein : il n'y a rien à lui servir.
 */
let rafraichissement: Promise<BienLodgify[]> | null = null;

/**
 * L'appel, encadré.
 *
 * Tout passe par ici, et c'est le point de ce fichier qui a coûté le plus cher
 * à comprendre. Lodgify refuse les rafales : la page de diagnostic tirait
 * plusieurs centaines de requêtes en quelques secondes, recevait des 429, et
 * les rendait comme des absences. « Aucun chemin n'a répondu » voulait dire
 * « tous ont répondu : trop vite ». On cherche alors du côté de l'offre
 * Lodgify un défaut qui est chez soi.
 *
 * Un refus n'est donc pas un échec : c'est une demande d'attendre, et on
 * l'écoute. Trois tentatives, en freinant tout le monde entre deux - c'est la
 * clé qui est refusée, pas la requête.
 */
async function appelBrut(
  chemin: string,
  options?: { methode?: string; corps?: string; delai?: number; fond?: boolean }
): Promise<{ statut: number | null; texte: string }> {
  const clef = process.env.LODGIFY_API_KEY;
  if (!clef) return { statut: null, texte: 'clé absente' };

  for (let essai = 0; essai < 3; essai += 1) {
    const r = await encadrer(async () => {
      try {
        const res = await fetch(`${BASE}${chemin}`, {
          method: options?.methode || 'GET',
          headers: {
            'X-ApiKey': clef.trim(),
            Accept: 'application/json',
            'User-Agent': UA,
            ...(options?.corps ? { 'Content-Type': 'application/json' } : {}),
          },
          body: options?.corps,
          /* Une API distante qui traîne ne doit pas retenir la page : au-delà
             du délai on abandonne et le repli prend le relais. */
          signal: AbortSignal.timeout(options?.delai ?? 12000),
          cache: 'no-store',
        });
        return { statut: res.status, texte: await res.text(), attendre: res.headers.get('retry-after') };
      } catch (e: any) {
        return { statut: null, texte: e?.message || 'erreur inconnue', attendre: null };
      }
    }, { fond: options?.fond });

    /* La file a renoncé : elle a attendu son plafond sans obtenir de créneau.
       C'est un silence de plus, et il se traite comme les autres. */
    if (r === null) return { statut: null, texte: 'file d’attente saturée' };
    if (r.statut !== 429) return { statut: r.statut, texte: r.texte };

    /* Refusé pour cause de débit. On note, on freine tout le monde, on
       recommence - sauf au dernier essai, où l'on rend le 429 tel quel pour
       que le diagnostic puisse le dire au lieu de le déguiser en silence. */
    compterRefus();
    freiner(delaiApresRefus(r.attendre, essai));
    if (essai === 2) return { statut: 429, texte: r.texte };
  }
  return { statut: null, texte: 'inatteignable' };
}

/** Comme `appel`, mais rend le statut : le diagnostic en a besoin, pas le site.
    Toujours en voie de fond : le diagnostic sonde tout, et ses sondes ne
    doivent jamais passer devant un voyageur qui demande un prix. */
async function appelDetaille(chemin: string): Promise<{ statut: number | null; corps: string }> {
  const r = await appelBrut(chemin, { fond: true });
  return { statut: r.statut, corps: r.texte.slice(0, 220) };
}

async function appel(chemin: string, options?: { fond?: boolean }): Promise<any | null> {
  const r = await appelBrut(chemin, { delai: 8000, fond: options?.fond });
  if (r.statut === null || r.statut < 200 || r.statut >= 300) return null;
  try {
    return JSON.parse(r.texte);
  } catch {
    return null;
  }
}

/**
 * Les photographies d'un logement, où qu'elles se trouvent.
 *
 * Lodgify ne les range pas au même endroit selon la version de l'API et selon
 * que le bien a des chambres déclarées : tantôt `image_url` seul, tantôt un
 * tableau `images`, tantôt les images portées par chaque chambre. Chercher à un
 * seul endroit, c'est afficher une page sans photo alors que l'API en renvoie -
 * et c'est exactement ce qui s'est produit.
 *
 * Les adresses de Lodgify sont souvent relatives au protocole (« //l.icdn… ») :
 * telles quelles, elles ne chargent pas sur une page servie en HTTPS.
 */
function extrairePhotos(p: any): string[] {
  const brutes: unknown[] = [];
  const pousser = (x: any) => {
    if (!x) return;
    if (typeof x === 'string') brutes.push(x);
    else if (Array.isArray(x)) x.forEach(pousser);
    else if (typeof x === 'object') pousser(x.url ?? x.image_url ?? x.original_url ?? x.thumbnail_url ?? x.src);
  };

  pousser(p.image_url);
  pousser(p.images);
  pousser(p.photos);
  pousser(p.main_image_url);
  if (Array.isArray(p.rooms)) p.rooms.forEach((r: any) => { pousser(r?.image_url); pousser(r?.images); pousser(r?.photos); });

  const vues = new Set<string>();
  return brutes
    .map((u) => String(u || '').trim())
    .filter(Boolean)
    .map((u) => (u.startsWith('//') ? `https:${u}` : u))
    .filter((u) => /^https?:\/\//i.test(u))
    .filter((u) => (vues.has(u) ? false : (vues.add(u), true)));
}

/**
 * La capacité d'accueil, où qu'elle se trouve.
 *
 * Elle n'est pas toujours portée par le logement lui-même : chez Lodgify, un
 * bien loué en entier est souvent décrit par un seul « room type », et c'est
 * lui qui porte le nombre de voyageurs. Ne chercher qu'au premier niveau
 * ramenait donc une capacité par défaut pour tout le monde, et un voyageur qui
 * demandait cinq personnes ne voyait plus rien.
 *
 * On prend le maximum des unités plutôt que leur somme : additionner les
 * capacités de deux logements distincts annoncerait un accueil qui n'existe
 * pas. Et faute de valeur, on rend `undefined` - pas une valeur plausible.
 */
function extraireVoyageurs(p: any): number | undefined {
  /* Le point d'entrée des chambres rend un tableau nu : on l'accepte tel quel
     plutôt que d'obliger l'appelant à l'emballer. */
  if (Array.isArray(p)) return extraireVoyageurs({ rooms: p });
  if (Array.isArray(p?.items)) return extraireVoyageurs({ rooms: p.items });
  const direct = nombre(p?.max_people ?? p?.maxPeople ?? p?.people ?? p?.max_guests ?? p?.maxGuests ?? p?.sleeps);
  if (direct) return direct;
  const unites: any[] = Array.isArray(p?.rooms) ? p.rooms : [];
  const capacites = unites
    .map((r) => nombre(r?.max_people ?? r?.maxPeople ?? r?.people ?? r?.max_guests ?? r?.sleeps))
    .filter((n): n is number => !!n);
  return capacites.length ? Math.max(...capacites) : undefined;
}

/**
 * Le nombre de chambres. Même prudence : `rooms` chez Lodgify désigne des
 * unités louables, pas des chambres, et compter ses éléments annoncerait « 1
 * chambre » pour un quatre pièces. On ne retient donc qu'un champ qui dit
 * explicitement « bedrooms ».
 */
function extraireChambres(p: any): number | undefined {
  if (Array.isArray(p)) return extraireChambres({ rooms: p });
  if (Array.isArray(p?.items)) return extraireChambres({ rooms: p.items });
  const direct = nombre(p?.bedrooms ?? p?.n_bedrooms ?? p?.nbBedrooms ?? p?.bedroom_count);
  if (direct) return direct;
  const unites: any[] = Array.isArray(p?.rooms) ? p.rooms : [];
  const n = unites
    .map((r) => nombre(r?.bedrooms ?? r?.n_bedrooms ?? r?.bedroom_count))
    .filter((x): x is number => !!x);
  return n.length ? Math.max(...n) : undefined;
}

const nombre = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : undefined);

export async function listerBiens(): Promise<BienLodgify[]> {
  if (cache && Date.now() - cache.a < TTL) return cache.v;

  /* Périmé mais présent : on le sert, et l'on renouvelle derrière. Un seul
     rafraîchissement à la fois - dix visiteurs simultanés sur un cache expiré
     lanceraient sinon dix reconstructions, soit cinq cents appels, et Lodgify
     nous bloquerait pour de bon. */
  if (cache) {
    if (!rafraichissement) {
      /* Renouvellement : personne ne l'attend, il passe donc en voie de fond
         et cède le passage à tout visiteur. */
      rafraichissement = construireCatalogue(true).finally(() => {
        rafraichissement = null;
      });
      /* Personne n'attend cette promesse : son échec ne doit donc tomber
         nulle part. Le catalogue périmé reste servi, ce qui est exactement le
         comportement voulu quand Lodgify ne répond pas. */
      rafraichissement.catch(() => {});
    }
    return cache.v;
  }

  /* Rien en mémoire : il faut bien attendre. Mais une seule fois, et pas une
     fois par visiteur arrivé pendant la construction. */
  if (!rafraichissement) {
    /* Première construction : un visiteur l'attend vraiment, elle prend donc
       la voie normale. C'est le seul cas où le catalogue passe devant. */
    rafraichissement = construireCatalogue(false).finally(() => {
      rafraichissement = null;
    });
  }
  try {
    return await rafraichissement;
  } catch {
    return [];
  }
}

async function construireCatalogue(fond: boolean): Promise<BienLodgify[]> {
  const voie = { fond };
  const data = await appel('/v2/properties?includeCount=false&size=100', voie);
  const items: any[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];

  const v: BienLodgify[] = items
    .filter((p) => p && p.id)
    .map((p) => ({
      id: Number(p.id),
      nom: String(p.name || '').trim(),
      ville: String(p.city || p.address?.city || 'Casablanca').trim(),
      quartier: String(p.subdivision || p.address?.subdivision || '').trim(),
      chambres: extraireChambres(p),
      voyageurs: extraireVoyageurs(p),
      prixDepuis: nombre(p.min_price ?? p.minPrice ?? p.price),
      devise: p.currency_code || p.currencyCode || undefined,
      photos: extrairePhotos(p),
      description: extraireDescription(p),
      latitude: coordonnee(p.latitude ?? p.lat),
      longitude: coordonnee(p.longitude ?? p.lng ?? p.lon),
      lits: extraireLits(p),
      bains: extraireBains(p),
      surface: extraireSurface(p),
    }))
    .filter((p) => p.nom);

  /* La liste ne porte pas tout. Chez Lodgify, /v2/properties rend un résumé :
     le nom, l'adresse, parfois une image, mais pas toujours les « rooms », et
     c'est là que vit la capacité d'accueil d'un bien loué en entier. Sans ce
     complément, tous les logements se retrouvaient sans capacité, le filtre
     « voyageurs » n'écartait plus rien, et demander cinq personnes renvoyait
     des studios pour deux.

     On ne complète donc que ce qui manque, une fois par cycle de cache : au
     pire vingt-quatre appels toutes les cinq minutes, ce qui est sans commune
     mesure avec un appel par visiteur. */
  const parId = new Map(v.map((b) => [b.id, b]));

  /* La capacité se cache derrière un troisième point d'entrée.
     `/v2/properties` ne rend qu'un résumé. `/v2/properties/{id}` ajoute
     l'adresse, les tarifs et un tableau `rooms` - mais ses éléments n'y
     portent que `id` et `name`. C'est `/v2/properties/{id}/rooms` qui donne
     enfin le nombre de personnes. Trois niveaux pour une donnée, ce n'est pas
     élégant, mais c'est ainsi que l'API est faite.

     On n'appelle que pour les logements dont la capacité manque encore, une
     fois par cycle de cache de cinq minutes. */
  const sansCapacite = v.filter((b) => !b.voyageurs).map((b) => b.id);
  if (sansCapacite.length) {
    const chambres = await Promise.all(
      sansCapacite.slice(0, 60).map(async (id) => ({ id, d: await appel(`/v2/properties/${id}/rooms`, voie) }))
    );
    for (const { id, d } of chambres) {
      const b = parId.get(id);
      if (!b || !d) continue;
      /* Cet appel porte déjà l'identifiant de chambre dont le devis et le
         calendrier des tarifs ont besoin. On le note au passage.

         Sans cela, `premiereChambre` refaisait exactement le même appel, un
         par logement, la première fois qu'un voyageur saisissait des dates :
         vingt-quatre requêtes déjà faites une minute plus tôt, dans la file
         d'attente, devant un visiteur qui regardait une page blanche. */
      noterChambre(id, d);
      b.voyageurs = b.voyageurs ?? extraireVoyageurs(d);
      b.chambres = b.chambres ?? extraireChambres(d);
      const galerie = extrairePhotos(d).filter((u) => !b.photos.includes(u));
      if (galerie.length) b.photos = [...b.photos, ...galerie];
    }
  }

  /* ---------- la galerie ----------
     La version 2 de l'API est avare en images : la liste et la fiche détaillée
     n'exposent qu'un `image_url`, une seule photo de couverture, et les
     chambres n'en portent pas. Une fiche de logement avec une seule
     photographie ne donne pas envie de réserver.

     La version 1, elle, rend un tableau `images` complet, et elle reste
     servie. On l'interroge donc pour compléter, en essayant plusieurs formes
     de chemin puisque la documentation ne les publie pas. La première qui
     rapporte des images est retenue et mémorisée pour les suivantes. */
  /* ---------- la fiche détaillée ----------
     Ni la description ni les coordonnées ne sont dans le résumé. On va donc
     chercher la fiche, une seule fois par cycle de cache, et seulement pour
     les logements auxquels il manque encore l'une ou l'autre. */
  const sansTexte = v.filter((b) => !b.description || b.latitude === undefined).map((b) => b.id);
  if (sansTexte.length) {
    const fiches = await Promise.all(
      sansTexte.slice(0, 60).map(async (id) => ({ id, d: await appel(`/v2/properties/${id}`, voie) }))
    );
    for (const { id, d } of fiches) {
      const b = parId.get(id);
      if (!b || !d) continue;
      b.description = b.description ?? extraireDescription(d);
      b.latitude = b.latitude ?? coordonnee(d.latitude ?? d.lat);
      b.longitude = b.longitude ?? coordonnee(d.longitude ?? d.lng ?? d.lon);
      b.lits = b.lits ?? extraireLits(d);
      b.bains = b.bains ?? extraireBains(d);
      b.surface = b.surface ?? extraireSurface(d);
      b.voyageurs = b.voyageurs ?? extraireVoyageurs(d);
      b.chambres = b.chambres ?? extraireChambres(d);
      const galerie = extrairePhotos(d).filter((u) => !b.photos.includes(u));
      if (galerie.length) b.photos = [...b.photos, ...galerie];
    }
  }

  const sansGalerie = galerieAbandonnee ? [] : v.filter((b) => b.photos.length < 2).map((b) => b.id);
  if (sansGalerie.length) {
    const candidats = cheminGalerie ? [cheminGalerie, ...CHEMINS_GALERIE] : CHEMINS_GALERIE;
    for (const modele of candidats) {
      const essais = await Promise.all(
        sansGalerie.slice(0, 60).map(async (id) => ({ id, d: await appel(modele.replace('{p}', String(id)), voie) }))
      );
      let trouve = 0;
      for (const { id, d } of essais) {
        const b = parId.get(id);
        if (!b || !d) continue;
        const sup = extrairePhotos(d).filter((u) => !b.photos.includes(u));
        if (sup.length) {
          b.photos = [...b.photos, ...sup];
          trouve++;
        }
        b.voyageurs = b.voyageurs ?? extraireVoyageurs(d);
        b.chambres = b.chambres ?? extraireChambres(d);
      }
      if (trouve) {
        cheminGalerie = modele;
        break;
      }
    }
    /* Aucun chemin n'a rien rendu : on cesse d'essayer. Six chemins pour
       vingt-quatre logements font cent quarante-quatre appels, toutes les cinq
       minutes, pour un résultat qu'on sait vide - les galeries viennent
       désormais des photographies d'origine, déposées dans public/photos. Le
       diagnostic, lui, réessaie explicitement. */
    if (!cheminGalerie) galerieAbandonnee = true;
  }

  if (v.length) cache = { a: Date.now(), v };
  return v;
}

/** Vrai quand une clé est configurée. Sert à expliquer un catalogue dégradé. */
export const lodgifyConfigure = () => !!process.env.LODGIFY_API_KEY;

/* ---------- le diagnostic ----------
   Le client au-dessus avale toutes les pannes en silence : c'est ce qu'il faut
   pour un visiteur, qui n'a pas à voir une erreur d'API, mais c'est intenable
   pour vous - vous ne savez pas si la clé est absente, refusée, ou si Lodgify
   ne répond pas. Cette fonction fait le même appel et rend ce qu'elle voit,
   pour l'administration seulement.

   La clé n'est jamais renvoyée, ni journalisée. On rend sa longueur et ce qui
   cloche autour d'elle - guillemets recopiés, espace de fin, retour chariot -
   parce que c'est là que se cachent la plupart des 401. */

export type Diagnostic = {
  configuree: boolean;
  longueur: number;
  anomalies: string[];
  url: string;
  statut: number | null;
  duree: number;
  extrait: string;
  nbBiens: number | null;
  /* Ce que porte réellement le premier bien : sans cela, une réponse 200 sans
     photo reste une énigme. */
  champs: string[];
  champsPhoto: string[];
  nbPhotos: number | null;
  /* Combien de logements portent une capacité lisible, et dans quels champs. */
  nbCapacites: number | null;
  champsCapacite: string[];
  /* Combien en portent une une fois le catalogue construit - c'est-à-dire
     après que le site est allé la chercher au troisième niveau.

     Ce chiffre-là a longtemps manqué, et son absence était trompeuse :
     l'écran annonçait « 0 sur 24 » en gros, puis expliquait en petit que la
     lecture fonctionnait. Le chiffre disait la liste, le texte disait le
     catalogue, et c'est le catalogue qui filtre les voyageurs. */
  capacitesCatalogue: number | null;
  /* Vrai quand la liste seule ne suffisait pas et qu'il a fallu ouvrir la
     fiche de chaque logement. */
  detailNecessaire: boolean;
  detailStatut: number | null;
  champsDetail: string[];
  /* Les champs de texte de la fiche détaillée, avec leur longueur : c'est là
     que se cache la description quand on ne la trouve pas. */
  champsTexteDetail: string[];
  descriptionLue: number | null;
  /* Les champs qui pourraient porter l'adresse du logement sur le moteur de
     réservation : un slug, une URL, un nom court. Si l'un d'eux existe, les
     vingt-quatre adresses se construisent au lieu de se coller. */
  pistesAdresse: string[];
  /* Le troisième niveau : /v2/properties/{id}/rooms, seul à porter la
     capacité d'accueil. */
  chambresStatut: number | null;
  champsChambres: string[];
  capaciteLue: number | null;
  /* La galerie : quel chemin la rapporte, et combien d'images au total. */
  cheminGalerie: string | null;
  nbGalerie: number | null;
  cheminsGalerieEssayes: string[];
};

export async function diagnostic(): Promise<Diagnostic> {
  const brute = process.env.LODGIFY_API_KEY;
  const chemin = '/v2/properties?includeCount=false&size=100';
  const d: Diagnostic = {
    configuree: !!brute,
    longueur: (brute || '').length,
    anomalies: [],
    url: `${BASE}${chemin}`,
    statut: null,
    duree: 0,
    extrait: '',
    nbBiens: null,
    champs: [],
    champsPhoto: [],
    nbPhotos: null,
    nbCapacites: null,
    champsCapacite: [],
    detailNecessaire: false,
    detailStatut: null,
    champsDetail: [],
    champsTexteDetail: [],
    descriptionLue: null,
    pistesAdresse: [],
    chambresStatut: null,
    champsChambres: [],
    capaciteLue: null,
    capacitesCatalogue: null,
    cheminGalerie: null,
    nbGalerie: null,
    cheminsGalerieEssayes: CHEMINS_GALERIE,
  };
  if (!brute) return d;

  if (brute !== brute.trim()) d.anomalies.push('espace ou saut de ligne au début ou à la fin');
  if (/^["'].*["']$/.test(brute)) d.anomalies.push('la clé est entourée de guillemets : retirez-les');
  if (/\s/.test(brute.trim())) d.anomalies.push('la clé contient un espace en son milieu');
  if (/^Bearer\s/i.test(brute)) d.anomalies.push('la clé commence par « Bearer » : ne mettez que la clé');

  const t0 = Date.now();
  try {
    const res = await fetch(d.url, {
      headers: { 'X-ApiKey': brute.trim(), Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(12000),
      cache: 'no-store',
    });
    d.statut = res.status;
    const corps = await res.text();
    d.extrait = corps.slice(0, 600);
    if (res.ok) {
      try {
        const j = JSON.parse(corps);
        const items = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
        d.nbBiens = items.length;
        const un = items[0];
        if (un && typeof un === 'object') {
          d.champs = Object.keys(un).sort();
          d.champsPhoto = d.champs.filter((c) => /image|photo|picture|media|thumb/i.test(c));
          if (Array.isArray(un.rooms) && un.rooms[0] && typeof un.rooms[0] === 'object')
            d.champsPhoto.push(
              ...Object.keys(un.rooms[0]).filter((c) => /image|photo|picture|media|thumb/i.test(c)).map((c) => `rooms[].${c}`)
            );
          d.nbPhotos = items.reduce((n: number, x: any) => n + extrairePhotos(x).length, 0);
          d.nbCapacites = items.filter((x: any) => extraireVoyageurs(x)).length;
          const capacite = /people|guest|sleep|occupan|bedroom|chambre/i;
          d.champsCapacite = d.champs.filter((c) => capacite.test(c));
          if (Array.isArray(un.rooms) && un.rooms[0] && typeof un.rooms[0] === 'object')
            d.champsCapacite.push(...Object.keys(un.rooms[0]).filter((c) => capacite.test(c)).map((c) => `rooms[].${c}`));

          /* La fiche détaillée s'ouvre toujours, et non plus seulement quand la
             capacité manque. Elle porte les descriptions, et peut-être
             l'identifiant d'adresse du moteur : n'aller la voir qu'en cas de
             problème revenait à cacher ces informations dès que tout allait
             bien. */
          d.pistesAdresse = pistesAdresse(un);
          if (un.id) {
            d.detailNecessaire = !extraireVoyageurs(un);
            try {
              const res2 = await fetch(`${BASE}/v2/properties/${un.id}`, {
                headers: { 'X-ApiKey': brute.trim(), Accept: 'application/json', 'User-Agent': UA },
                signal: AbortSignal.timeout(12000),
                cache: 'no-store',
              });
              d.detailStatut = res2.status;
              if (res2.ok) {
                const fiche = await res2.json();
                d.champsDetail = Object.keys(fiche || {}).sort();
                d.champsTexteDetail = champsTexte(fiche);
                d.descriptionLue = (extraireDescription(fiche) || '').length || null;
                for (const piste of pistesAdresse(fiche))
                  if (!d.pistesAdresse.includes(piste)) d.pistesAdresse.push(piste);
                if (Array.isArray(fiche?.rooms) && fiche.rooms[0])
                  d.champsDetail.push(...Object.keys(fiche.rooms[0]).map((c) => `rooms[].${c}`));
                if (extraireVoyageurs(fiche)) d.nbCapacites = -1; // le détail suffit
              }

              const res3 = await fetch(`${BASE}/v2/properties/${un.id}/rooms`, {
                headers: { 'X-ApiKey': brute.trim(), Accept: 'application/json', 'User-Agent': UA },
                signal: AbortSignal.timeout(12000),
                cache: 'no-store',
              });
              d.chambresStatut = res3.status;
              if (res3.ok) {
                const ch = await res3.json();
                const liste = Array.isArray(ch) ? ch : Array.isArray(ch?.items) ? ch.items : [];
                if (liste[0] && typeof liste[0] === 'object') d.champsChambres = Object.keys(liste[0]).sort();
                d.capaciteLue = extraireVoyageurs(ch) ?? null;
              }
            } catch {
              /* Le diagnostic ne doit jamais faire tomber la page. */
            }
          }
        }
      } catch {
        d.anomalies.push('réponse 200 mais illisible : ce n’est pas du JSON');
      }
    }
  } catch (e: any) {
    d.extrait = `Appel impossible : ${e?.message || 'erreur inconnue'}`;
  }

  /* Ce que le catalogue sait vraiment, une fois tous les niveaux consultés.
     C'est ce chiffre que le filtre « voyageurs » emploie. */
  try {
    const catalogue = await listerBiens();
    if (catalogue.length) d.capacitesCatalogue = catalogue.filter((b) => !!b.voyageurs).length;
  } catch {
    /* Le diagnostic ne doit jamais faire tomber la page. */
  }

  d.duree = Date.now() - t0;
  return d;
}

/** Vide le cache mémoire, pour revoir l'effet d'un changement sans redémarrer. */
export function viderCache() {
  cache = null;
}

/* ==========================================================================
   Les disponibilités.

   Jusqu'ici le site ne les connaissait pas : les dates saisies étaient
   simplement transmises à Lodgify au moment de réserver, et c'est lui qui
   tranchait. C'était honnête mais frustrant - on pouvait parcourir six
   logements avant d'apprendre qu'aucun n'était libre.

   Le chemin exact du point d'entrée n'est pas publié dans la documentation
   accessible. On en essaie donc plusieurs, du plus large au plus étroit, et le
   premier qui répond est retenu et mémorisé. La page de diagnostic affiche
   lequel a fonctionné : le jour où Lodgify change quelque chose, cela se voit
   en un coup d'oeil au lieu de se deviner.

   Règle de prudence, et elle prime sur tout le reste : quand la disponibilité
   est INCONNUE, on ne filtre pas. Masquer un logement libre parce qu'une API
   n'a pas répondu coûte une réservation ; l'afficher alors qu'il est pris coûte
   un clic. Le doute profite donc à l'affichage, jamais l'inverse.
   ========================================================================== */

/** Ce que le site sait des disponibilités pour une période. */
export type Dispos = {
  /** Vrai si l'on a pu interroger Lodgify. Faux : on ne sait pas, on ne filtre pas. */
  connu: boolean;
  /** Identifiants des logements libres sur toute la période. */
  libres: Set<number>;
  /** Le chemin qui a répondu, pour le diagnostic. */
  chemin?: string;
};

const INCONNU: Dispos = { connu: false, libres: new Set() };

/* Les formes de chemin connues, dans l'ordre où on les essaie. {p} est
   l'identifiant du logement, {d} la date d'arrivée, {f} la date de départ. */
const CHEMINS_DISPO = [
  '/v2/availability?start={d}&end={f}',
  '/v2/availability?periodStart={d}&periodEnd={f}',
  '/v2/availability/{p}?start={d}&end={f}',
  '/v1/availability/{p}?periodStart={d}&periodEnd={f}',
];

let cheminRetenu: string | null = null;
let cacheDispo: { clef: string; a: number; v: Dispos } | null = null;
const TTL_DISPO = 60 * 1000; // une minute : un calendrier bouge, un catalogue non

/**
 * Un jour est-il libre ? Lodgify n'emploie pas partout le même mot, et le
 * même sens : tantôt `available` (1 ou 0), tantôt `is_available`, tantôt un
 * `status` textuel. On les reconnaît tous, et devant l'inconnu on considère le
 * jour comme pris - un faux « libre » est bien plus coûteux qu'un faux « pris ».
 */
function jourLibre(x: any): boolean {
  if (x == null) return false;
  if (typeof x.available === 'boolean') return x.available;
  if (typeof x.available === 'number') return x.available > 0;
  if (typeof x.is_available === 'boolean') return x.is_available;
  if (typeof x.isAvailable === 'boolean') return x.isAvailable;
  if (typeof x.status === 'string') return /^(available|open|free)$/i.test(x.status);
  return false;
}

/** L'identifiant de logement porté par une entrée, quel que soit son nom. */
function idDe(x: any): number | null {
  const v = x?.property_id ?? x?.propertyId ?? x?.house_id ?? x?.houseId ?? x?.id;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Lit une réponse de calendrier, quelle que soit sa forme, et rend les
 * identifiants des logements libres sur TOUTE la période. Un seul jour pris
 * suffit à écarter un logement : un voyageur qui réserve du 12 au 19 ne veut
 * pas d'un logement libre six nuits sur sept.
 */
function lireDispos(data: any, idParDefaut?: number): Set<number> | null {
  const libres = new Set<number>();
  const entrees: any[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : data ? [data] : [];
  if (!entrees.length) return null;

  let compris = false;
  for (const e of entrees) {
    const id = idDe(e) ?? idParDefaut ?? null;
    const jours: any[] = Array.isArray(e?.periods)
      ? e.periods
      : Array.isArray(e?.days)
        ? e.days
        : Array.isArray(e?.calendar)
          ? e.calendar
          : Array.isArray(e?.availability)
            ? e.availability
            : [];
    if (!jours.length) {
      /* Certaines réponses portent la disponibilité au niveau du logement,
         sans détail par jour. */
      if (id && (typeof e?.available !== 'undefined' || typeof e?.is_available !== 'undefined')) {
        compris = true;
        if (jourLibre(e)) libres.add(id);
      }
      continue;
    }
    compris = true;
    if (id && jours.every(jourLibre)) libres.add(id);
  }
  return compris ? libres : null;
}

/**
 * Les logements libres entre deux dates.
 *
 * Rend `connu: false` dès qu'un doute existe - pas de clé, réseau muet, forme
 * de réponse non reconnue - et l'appelant ne filtre alors rien.
 */
export async function disponibilites(arrivee: string, depart: string): Promise<Dispos> {
  if (!process.env.LODGIFY_API_KEY) return INCONNU;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivee) || !/^\d{4}-\d{2}-\d{2}$/.test(depart)) return INCONNU;
  if (depart <= arrivee) return INCONNU;

  const clef = `${arrivee}|${depart}`;
  if (cacheDispo && cacheDispo.clef === clef && Date.now() - cacheDispo.a < TTL_DISPO) return cacheDispo.v;

  const catalogue = await listerBiens();
  const ids = catalogue.map((b) => b.id).filter((n) => n > 0);
  const candidats = cheminRetenu ? [cheminRetenu, ...CHEMINS_DISPO.filter((c) => c !== cheminRetenu)] : CHEMINS_DISPO;

  for (const modele of candidats) {
    const parLogement = modele.includes('{p}');
    let libres: Set<number> | null = null;

    if (!parLogement) {
      const data = await appel(modele.replace('{d}', arrivee).replace('{f}', depart));
      libres = data ? lireDispos(data) : null;
    } else if (ids.length) {
      /* Un appel par logement : on limite la casse en s'arrêtant au premier
         échec, et on ne lance pas vingt-quatre requêtes pour rien. */
      const premier = await appel(modele.replace('{p}', String(ids[0])).replace('{d}', arrivee).replace('{f}', depart));
      if (premier && lireDispos(premier, ids[0])) {
        const paquets = await Promise.all(
          ids.map(async (id) => {
            const d = await appel(modele.replace('{p}', String(id)).replace('{d}', arrivee).replace('{f}', depart));
            return { id, libres: d ? lireDispos(d, id) : null };
          })
        );
        libres = new Set<number>();
        for (const q of paquets) if (q.libres?.has(q.id)) libres.add(q.id);
      }
    }

    if (libres) {
      cheminRetenu = modele;
      const v: Dispos = { connu: true, libres, chemin: modele };
      cacheDispo = { clef, a: Date.now(), v };
      return v;
    }
  }

  cacheDispo = { clef, a: Date.now(), v: INCONNU };
  return INCONNU;
}

/** Pour le diagnostic : essaie les disponibilités sur une période courte. */
/** Pour le diagnostic : combien d'images le catalogue porte-t-il, et par où. */
export async function diagnosticGalerie(): Promise<{
  chemin: string | null;
  total: number;
  max: number;
  essais: { chemin: string; statut: number | null; images: number; corps: string }[];
}> {
  cache = null;
  cheminGalerie = null;
  /* Le diagnostic est là pour réessayer : on lève l'abandon, sans quoi cette
     page répondrait toujours ce qu'elle a répondu la première fois. */
  galerieAbandonnee = false;
  const liste = await listerBiens();
  const unId = liste.find((b) => b.id > 0)?.id;

  /* On refait chaque essai en gardant le statut : « aucun n'a marché » ne dit
     pas s'il s'agit d'un 404, d'un 401 ou d'une réponse vide, et c'est
     précisément ce qu'il faut demander au support. */
  const essais = unId
    ? await Promise.all(
        CHEMINS_GALERIE.map(async (modele) => {
          const chemin = modele.replace('{p}', String(unId));
          const r = await appelDetaille(chemin);
          let images = 0;
          if (r.statut === 200) {
            try {
              images = extrairePhotos(JSON.parse(r.corps.length < 220 ? r.corps : '{}')).length;
            } catch {
              images = 0;
            }
          }
          return { chemin, statut: r.statut, images, corps: r.corps };
        })
      )
    : [];

  return {
    chemin: cheminGalerie,
    total: liste.reduce((n, b) => n + b.photos.length, 0),
    max: liste.reduce((n, b) => Math.max(n, b.photos.length), 0),
    essais,
  };
}

export async function diagnosticDispos(): Promise<{ connu: boolean; chemin?: string; nbLibres: number; essayes: string[] }> {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  const f = new Date(d);
  f.setDate(f.getDate() + 3);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  cacheDispo = null;
  const r = await disponibilites(iso(d), iso(f));
  return { connu: r.connu, chemin: r.chemin, nbLibres: r.libres.size, essayes: CHEMINS_DISPO };
}


/* ==========================================================================
   Le séjour minimum.

   Un logement peut n'accepter que des séjours de trois nuits. Le site
   l'ignorait : il proposait deux nuits, envoyait le voyageur sur le moteur, et
   celui-ci répondait « aucun résultat ». Le voyageur en conclut que rien n'est
   libre, alors que c'est sa durée qui ne convient pas. C'est la pire des
   impasses, parce qu'elle est muette.

   La donnée vit dans le calendrier des tarifs, pas dans la fiche du logement.
   Le chemin exact n'étant pas publié, on en essaie plusieurs et l'on retient
   celui qui répond, comme pour le reste.
   ========================================================================== */

/* {p} le logement, {r} la chambre, {d} et {f} les dates.

   Le premier jet omettait {r}, et Lodgify répondait 400 « All fields are
   required » - une phrase qu'on lit comme un défaut d'offre alors qu'elle dit
   simplement qu'il manque un paramètre. Le calendrier des tarifs se demande
   par chambre, pas par logement : chez Lodgify, un tarif s'attache à un type
   de chambre, et un appartement loué en entier est un type de chambre à lui
   seul. D'où RoomTypeId, obligatoire, et d'où l'identifiant qu'on tient déjà
   pour le devis. */
const CHEMINS_TARIFS = [
  '/v2/rates/calendar?RoomTypeId={r}&HouseId={p}&StartDate={d}&EndDate={f}',
  '/v1/rates/calendar?HouseId={p}&RoomTypeId={r}&StartDate={d}&EndDate={f}',
  '/v2/rates/calendar?propertyId={p}&roomTypeId={r}&start={d}&end={f}',
  '/v2/properties/{p}/rates?start={d}&end={f}',
];
let cheminTarifs: string | null = null;
/* L'instant jusqu'auquel on renonce à chercher le chemin des tarifs.
 *
 * La découverte essaie chaque forme sur un logement. Quand aucune ne répond -
 * ce qui est le cas des offres Lodgify qui n'exposent pas le calendrier des
 * tarifs - rien ne le mémorisait : la page recommençait les quatre appels à
 * CHAQUE visite, pour un échec déjà constaté mille fois. Quatre appels dans
 * une file qui n'en laisse passer que trois de front, devant un visiteur qui
 * attend.
 *
 * Un quart d'heure de silence, donc. Assez pour qu'une page ne paie jamais la
 * recherche deux fois ; assez court pour qu'activer l'option chez Lodgify se
 * voie le jour même, sans redémarrer le serveur. */
let tarifsAbandonnesJusqua = 0;
const REPIT_TARIFS = 15 * 60 * 1000;

/** Remplit un modèle de chemin. Une seule fonction, pour que le diagnostic et
    la lecture réelle interrogent exactement la même adresse - sans quoi le
    diagnostic dirait « ça répond » d'un chemin que le site n'emprunte pas. */
function garnir(modele: string, bien: number, chambre: number | null, d: string, f: string): string {
  return modele
    .replace('{p}', String(bien))
    .replace('{r}', chambre ? String(chambre) : '')
    .replace('{d}', d)
    .replace('{f}', f);
}

/** Le séjour minimum d'un logement sur une période, en nuits. */
function lireSejourMinimum(data: any): number | undefined {
  const jours: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.calendar_items)
        ? data.calendar_items
        : Array.isArray(data?.days)
          ? data.days
          : [];
  const valeurs = jours
    .map((j) => nombre(j?.min_stay ?? j?.minimum_stay ?? j?.minStay ?? j?.min_nights))
    .filter((n): n is number => !!n && n > 0);
  /* Le maximum sur la période : si une seule nuit du séjour en exige trois,
     le séjour entier en exige trois. */
  return valeurs.length ? Math.max(...valeurs) : undefined;
}

const cacheMin = new Map<string, number | undefined>();

/**
 * Le séjour minimum de chaque logement sur une période.
 *
 * Rend une carte vide quand rien n'est lisible - et l'appelant n'écarte alors
 * personne, comme partout ailleurs ici.
 */
export async function sejoursMinimums(arrivee: string, depart: string): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (!process.env.LODGIFY_API_KEY) return out;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivee) || !/^\d{4}-\d{2}-\d{2}$/.test(depart)) return out;

  if (!cheminTarifs && Date.now() < tarifsAbandonnesJusqua) return out;

  const clef = `${arrivee}|${depart}`;
  const catalogue = await listerBiens();
  const ids = catalogue.map((b) => b.id).filter((n) => n > 0);
  if (!ids.length) return out;

  /* On cherche d'abord QUEL chemin répond, sur un seul logement.
     Interroger les vingt-quatre pour chacun des trois chemins faisait
     soixante-douze appels rien que pour découvrir l'adresse - et Lodgify
     refusait la rafale, ce qui se lisait ensuite comme « aucun chemin ne
     répond ». Trois appels suffisent à trancher. */
  const candidats = cheminTarifs ? [cheminTarifs, ...CHEMINS_TARIFS.filter((c) => c !== cheminTarifs)] : CHEMINS_TARIFS;
  const chambreTemoin = await premiereChambre(ids[0]);
  let modele: string | null = null;
  for (const essai of candidats) {
    /* Un chemin qui réclame une chambre sans qu'on en ait une ne peut pas
       répondre : l'essayer quand même ferait porter au chemin le défaut de
       l'identifiant. */
    if (essai.includes('{r}') && !chambreTemoin) continue;
    const d = await appel(garnir(essai, ids[0], chambreTemoin, arrivee, depart));
    if (d && lireSejourMinimum(d) !== undefined) {
      modele = essai;
      break;
    }
  }
  if (!modele) {
    tarifsAbandonnesJusqua = Date.now() + REPIT_TARIFS;
    return out;
  }
  cheminTarifs = modele;

  /* Le chemin trouvé, on déploie - et seulement alors. */
  const essais = await Promise.all(
    ids.slice(0, 60).map(async (id) => {
      const memo = cacheMin.get(`${clef}|${id}|${modele}`);
      if (memo !== undefined) return { id, min: memo };
      const chambre = modele!.includes('{r}') ? await premiereChambre(id) : null;
      if (modele!.includes('{r}') && !chambre) return { id, min: undefined };
      const d = await appel(garnir(modele!, id, chambre, arrivee, depart));
      const min = d ? lireSejourMinimum(d) : undefined;
      cacheMin.set(`${clef}|${id}|${modele}`, min);
      return { id, min };
    })
  );
  for (const e of essais) if (e.min) out.set(e.id, e.min);
  return out;
}

/** Pour le diagnostic : les chemins essayés pour le séjour minimum. */
export async function diagnosticTarifs(): Promise<{ chemin: string | null; lus: number; essais: { chemin: string; statut: number | null; corps: string }[] }> {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  const f = new Date(d);
  f.setDate(f.getDate() + 5);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const catalogue = await listerBiens();
  const unId = catalogue.find((b) => b.id > 0)?.id;
  /* Le diagnostic, lui, réessaie toujours : c'est sa raison d'être. Il lève
     donc le répit avant de chercher. */
  cheminTarifs = null;
  tarifsAbandonnesJusqua = 0;
  cacheMin.clear();
  const mins = await sejoursMinimums(iso(d), iso(f));
  const chambre = unId ? await premiereChambre(unId) : null;
  const essais = unId
    ? await Promise.all(
        CHEMINS_TARIFS.map(async (modele) => {
          const chemin = garnir(modele, unId, chambre, iso(d), iso(f));
          const r = await appelDetaille(chemin);
          return { chemin, statut: r.statut, corps: r.corps };
        })
      )
    : [];
  return { chemin: cheminTarifs, lus: mins.size, essais };
}

/* ---------- la clef écrit-elle ? ----------
   Réserver par virement suppose de bloquer les dates pendant que le virement
   chemine, sans quoi la même semaine peut être vendue deux fois. Reste à
   savoir si votre clef en a le droit : la documentation publique de Lodgify
   décrit surtout la lecture, et le reste dépend de votre offre.

   On ne le devine pas, on le demande. Chaque point d'entrée d'écriture est
   appelé avec un corps volontairement vide : aucune réservation ne peut naître
   d'une requête sans dates ni voyageur. Seule la nature du refus nous
   intéresse.

     401 ou 403  la clef n'écrit pas
     400 ou 422  la clef écrit, mais ces données-là sont refusées - c'est ce
                 que nous voulons lire
     404 ou 405  ce point d'entrée n'existe pas sur votre offre */

const CHEMINS_ECRITURE = [
  { quoi: 'Créer une réservation', methode: 'POST', chemin: '/v2/reservations/booking' },
  { quoi: 'Créer une réservation (v1)', methode: 'POST', chemin: '/v1/reservation' },
  { quoi: 'Bloquer des dates', methode: 'POST', chemin: '/v1/availability/{p}' },
  { quoi: 'Bloquer des dates (v2)', methode: 'PUT', chemin: '/v2/properties/{p}/availability' },
];

export type EssaiEcriture = {
  quoi: string;
  methode: string;
  chemin: string;
  statut: number | null;
  corps: string;
  lecture: 'autorisée' | 'refusée' | 'inexistante' | 'indéterminée';
};

export async function diagnosticEcriture(): Promise<EssaiEcriture[]> {
  if (!process.env.LODGIFY_API_KEY) return [];
  const catalogue = await listerBiens();
  const unId = catalogue.find((b) => b.id > 0)?.id;

  return Promise.all(
    CHEMINS_ECRITURE.map(async (e) => {
      const chemin = e.chemin.replace('{p}', String(unId ?? 0));
      /* Par la même file que le reste : sans elle, ces quatre appels partaient
         en rafale après tous les autres et récoltaient quatre 429 - lus comme
         « indéterminé », alors que la question posée était simple. */
      const r = await appelBrut(chemin, { methode: e.methode, corps: '{}' });
      const statut = r.statut;
      const corps = r.texte.slice(0, 220);

      const lecture: EssaiEcriture['lecture'] =
        statut === 429
          ? 'indéterminée'
          : statut === 401 || statut === 403
          ? 'refusée'
          : statut === 400 || statut === 422 || (statut !== null && statut >= 200 && statut < 300)
            ? 'autorisée'
            : statut === 404 || statut === 405
              ? 'inexistante'
              : 'indéterminée';

      return { quoi: e.quoi, methode: e.methode, chemin, statut, corps, lecture };
    })
  );
}

/* ==========================================================================
   Le devis d'un séjour.

   Jusqu'ici le site n'affichait qu'un prix d'appel - « à partir de », qui ne
   vaut jamais pour les dates réellement demandées. Cela suffisait tant que
   Lodgify concluait la vente. Ce n'est plus le cas : proposer un virement,
   c'est annoncer un montant à virer, et un montant annoncé engage.

   Deux principes gouvernent tout ce qui suit.

   Le premier : on ne calcule jamais un total soi-même. Multiplier un tarif de
   nuit par un nombre de nuits ignore les remises longue durée, les frais de
   ménage, la taxe de séjour et les tarifs de saison - et donne un montant faux
   avec l'assurance d'un montant juste. C'est Lodgify qui tient ces règles, et
   c'est donc lui qu'on interroge.

   Le second : dans le doute, pas de virement. Ailleurs sur ce site, le doute
   profite à l'affichage - mieux vaut montrer un logement peut-être pris que le
   cacher à tort. Ici la règle s'inverse, parce que l'enjeu s'inverse : un
   logement affiché à tort coûte un clic, un montant annoncé à tort coûte un
   litige. Sans devis lisible, le virement n'est pas proposé et la carte
   reprend seule la main.
   ========================================================================== */

/** Ce que le site sait du prix d'un séjour précis. */
export type Devis = {
  /** Vrai seulement si Lodgify a rendu un total exploitable. */
  connu: boolean;
  /** Le total à payer, toutes taxes et frais compris, dans la devise du compte. */
  total?: number;
  devise?: string;
  /** Le chemin qui a répondu, pour le diagnostic. */
  chemin?: string;
  /** Ce qui a empêché de conclure, quand rien n'a abouti. */
  detail?: string;
};

const SANS_DEVIS: Devis = { connu: false };

/* Les formes connues du point d'entrée « devis ». {p} le logement, {d} et {f}
   les dates, {r} l'identifiant de la chambre, {n} le nombre de voyageurs. */
const CHEMINS_DEVIS = [
  '/v2/quote/{p}?arrival={d}&departure={f}&roomTypes[0].Id={r}&roomTypes[0].People={n}',
  '/v2/quote/{p}?arrival={d}&departure={f}&roomTypes[0].People={n}',
  '/v1/reservation/quote/{p}?arrival={d}&departure={f}&people={n}',
];
let cheminDevis: string | null = null;

/* L'identifiant de chambre de chaque logement : le devis v2 l'exige. On le
   tient d'un appel déjà connu, /v2/properties/{id}/rooms, et on le garde -
   il ne change pas d'une réservation à l'autre. */
const chambreParBien = new Map<number, number | null>();

/** Retient l'identifiant de chambre porté par une réponse déjà obtenue. */
function noterChambre(bienId: number, data: unknown): void {
  const liste = chambresDe(data);
  const id = Array.isArray(liste) ? Number(liste[0]?.id) : NaN;
  if (Number.isFinite(id) && id > 0) chambreParBien.set(bienId, id);
}

async function premiereChambre(bienId: number): Promise<number | null> {
  if (chambreParBien.has(bienId)) return chambreParBien.get(bienId)!;
  const d = await appel(`/v2/properties/${bienId}/rooms`);
  const liste = chambresDe(d);
  const id = Array.isArray(liste) ? Number(liste[0]?.id) : NaN;
  const v = Number.isFinite(id) && id > 0 ? id : null;
  chambreParBien.set(bienId, v);
  return v;
}

/* Les noms sous lesquels Lodgify écrit un total, du plus explicite au plus
   vague. L'ordre compte : `total_including_vat` est le montant qu'un voyageur
   paie, `total` peut être un sous-total hors taxes. Se tromper de clef, c'est
   annoncer un prix sans la taxe de séjour. */
const CLEFS_TOTAL = [
  'total_including_vat',
  'total_incl_vat',
  'totalIncludingVat',
  'total_gross',
  'grand_total',
  'total_amount',
  'totalAmount',
  'total',
];

/**
 * Le total porté par une réponse, quelle que soit sa profondeur.
 *
 * On parcourt en largeur et l'on retient la première clef trouvée dans l'ordre
 * ci-dessus, au niveau le plus haut où elle apparaît : un devis porte souvent
 * le même mot à plusieurs étages - le total du séjour, puis celui de chaque
 * ligne - et c'est toujours le plus haut qui est le bon.
 */
function lireTotal(data: any): { total: number; devise?: string } | null {
  const file: any[] = [data];
  let devise: string | undefined;
  while (file.length) {
    const niveau = file.splice(0, file.length);
    for (const n of niveau) {
      if (!n || typeof n !== 'object') continue;
      if (!devise) {
        const c = n.currency_code ?? n.currencyCode ?? n.currency;
        if (typeof c === 'string' && /^[A-Za-z]{3}$/.test(c)) devise = c.toUpperCase();
      }
    }
    for (const clef of CLEFS_TOTAL) {
      for (const n of niveau) {
        if (!n || typeof n !== 'object') continue;
        const v = nombre((n as any)[clef]);
        if (v && v > 0) return { total: v, devise };
      }
    }
    for (const n of niveau) {
      if (!n || typeof n !== 'object') continue;
      for (const v of Object.values(n)) if (v && typeof v === 'object') file.push(v);
    }
  }
  return null;
}

const cacheDevis = new Map<string, Devis>();
const TTL_DEVIS = 5 * 60 * 1000;
const horodateDevis = new Map<string, number>();

/**
 * Le prix d'un séjour, tel que Lodgify le facturerait.
 *
 * Rend `connu: false` à la moindre incertitude - pas de clé, dates
 * incohérentes, aucun chemin qui réponde, total illisible. L'appelant ne
 * propose alors pas le virement.
 */
export async function devis(
  bienId: number,
  arrivee: string,
  depart: string,
  voyageurs: number
): Promise<Devis> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivee) || !/^\d{4}-\d{2}-\d{2}$/.test(depart)) {
    return { connu: false, detail: 'dates absentes' };
  }
  if (depart <= arrivee) return { connu: false, detail: 'dates incohérentes' };

  /* Le prix d'essai.

     Tout le parcours de réservation dépend d'un prix venu de Lodgify. Sans clé
     - sur une machine de développement, dans une vérification automatique - ce
     parcours serait donc intestable, c'est-à-dire livré sans jamais avoir été
     parcouru une seule fois. C'est exactement le genre de code qui casse le
     jour de la première vraie réservation.

     D'où cette ouverture, et ses trois verrous : elle exige une variable
     d'environnement qui n'existe nulle part par défaut, elle refuse de
     fonctionner en production quoi qu'on y mette, et le diagnostic Lodgify
     l'annonce en clair dès qu'elle est active. Un prix d'essai qui
     s'afficherait à un vrai voyageur serait la pire faute possible de ce
     fichier : il vaut mieux trois verrous qu'un remords. */
  const essai = Number(String(process.env.LODGIFY_DEVIS_ESSAI || '').replace(',', '.'));
  if (process.env.NODE_ENV !== 'production' && Number.isFinite(essai) && essai > 0) {
    return { connu: true, total: essai, devise: 'EUR', chemin: 'prix d’essai (LODGIFY_DEVIS_ESSAI)' };
  }

  if (!process.env.LODGIFY_API_KEY) return { connu: false, detail: 'clé absente' };
  if (bienId <= 0) return { connu: false, detail: 'logement de repli' };

  const n = Math.max(1, Math.min(20, Math.round(voyageurs || 1)));
  const clef = `${bienId}|${arrivee}|${depart}|${n}`;
  const vu = horodateDevis.get(clef);
  if (vu && Date.now() - vu < TTL_DEVIS && cacheDevis.has(clef)) return cacheDevis.get(clef)!;

  const chambre = await premiereChambre(bienId);
  const candidats = cheminDevis ? [cheminDevis, ...CHEMINS_DEVIS.filter((c) => c !== cheminDevis)] : CHEMINS_DEVIS;

  let dernier = 'aucun chemin n’a répondu';
  for (const modele of candidats) {
    if (modele.includes('{r}') && !chambre) continue;
    const chemin = modele
      .replace('{p}', String(bienId))
      .replace('{d}', arrivee)
      .replace('{f}', depart)
      .replace('{r}', String(chambre ?? 0))
      .replace('{n}', String(n));
    const data = await appel(chemin);
    if (!data) {
      dernier = 'refus ou silence de Lodgify';
      continue;
    }
    const lu = lireTotal(data);
    if (!lu) {
      dernier = 'réponse sans total lisible';
      continue;
    }
    cheminDevis = modele;
    const d: Devis = { connu: true, total: lu.total, devise: lu.devise, chemin };
    cacheDevis.set(clef, d);
    horodateDevis.set(clef, Date.now());
    return d;
  }

  const echec: Devis = { connu: false, detail: dernier };
  cacheDevis.set(clef, echec);
  horodateDevis.set(clef, Date.now());
  return echec;
}

/* Le budget de la liste. Un devis par logement, et la page attend le dernier.
   Vingt-quatre logements à une seconde chacun feraient une page à vingt-quatre
   secondes, c'est-à-dire une page que personne ne voit.

   Passé ce délai, on rend ce qui est arrivé et l'on n'attend plus le reste :
   une carte sans total retombe sur son prix par nuit, ce qu'elle affichait
   déjà hier. Un prix manquant est un moindre mal ; une liste qui ne s'affiche
   pas n'en est pas un. */
const BUDGET_DEVIS = 12000;

/**
 * Le prix du séjour pour plusieurs logements à la fois.
 *
 * C'est ce qui manquait à la liste : le voyageur saisissait ses dates, voyait
 * les logements libres, et lisait sous chacun un prix « à partir de » qui ne
 * répondait pas à sa question. Il devait ouvrir les neuf fiches pour comparer
 * neuf montants. Comparer est pourtant tout ce qu'on fait devant une liste.
 *
 * Rend une carte des seuls totaux obtenus. Un logement absent de la carte
 * n'est pas un logement sans prix : c'est un prix qui n'est pas revenu à
 * temps, et la carte du logement le dira à sa manière.
 */
export async function devisMultiples(
  ids: number[],
  arrivee: string,
  depart: string,
  voyageurs: number
): Promise<Map<number, { total: number; devise?: string }>> {
  const out = new Map<number, { total: number; devise?: string }>();
  if (!ids.length) return out;

  /* On ne filtre pas les identifiants ici. Savoir si un logement peut être
     chiffré - clé absente, logement de repli, dates incohérentes, prix
     d'essai - est la responsabilité de `devis`, et elle seule. Refaire ce tri
     ici, c'était le refaire à moitié : la liste écartait les logements de
     repli avant même que `devis` puisse rendre son prix d'essai, et tout le
     parcours devenait invérifiable sur une machine de développement. Un
     appel écarté ne coûte rien - `devis` rend sans réseau dans tous ces cas. */
  const fin = Date.now() + BUDGET_DEVIS;
  await Promise.all(
    ids.map(async (id) => {
      /* Chaque devis court sa propre course contre le budget commun. La file
         d'attente en laisse passer trois de front : les derniers partent donc
         tard, et ce sont eux que le budget rattrape. */
      const reste = fin - Date.now();
      if (reste <= 0) return;
      const d = await Promise.race([
        devis(id, arrivee, depart, voyageurs),
        new Promise<Devis>((r) => setTimeout(() => r({ connu: false, detail: 'budget dépassé' }), reste)),
      ]);
      if (d.connu && d.total) out.set(id, { total: d.total, devise: d.devise });
    })
  );
  return out;
}

/** Pour le diagnostic : ce que chaque chemin de devis répond, sur un cas réel. */
export async function diagnosticDevis(): Promise<{
  chemin: string | null;
  resultat: Devis;
  essais: { chemin: string; statut: number | null; corps: string }[];
}> {
  const d = new Date();
  d.setDate(d.getDate() + 45);
  const f = new Date(d);
  f.setDate(f.getDate() + 4);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const catalogue = await listerBiens();
  const un = catalogue.find((b) => b.id > 0);
  if (!un) return { chemin: null, resultat: { connu: false, detail: 'aucun logement' }, essais: [] };

  cheminDevis = null;
  cacheDevis.clear();
  horodateDevis.clear();
  const resultat = await devis(un.id, iso(d), iso(f), 2);
  const chambre = await premiereChambre(un.id);
  const essais = await Promise.all(
    CHEMINS_DEVIS.map(async (modele) => {
      const chemin = modele
        .replace('{p}', String(un.id))
        .replace('{d}', iso(d))
        .replace('{f}', iso(f))
        .replace('{r}', String(chambre ?? 0))
        .replace('{n}', '2');
      const r = await appelDetaille(chemin);
      return { chemin, statut: r.statut, corps: r.corps };
    })
  );
  return { chemin: cheminDevis, resultat, essais };
}

/** Vrai quand un prix d'essai est actif. L'administration doit pouvoir le dire. */
export function prixEssaiActif(): string | null {
  const v = String(process.env.LODGIFY_DEVIS_ESSAI || '').trim();
  if (!v || process.env.NODE_ENV === 'production') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? v : null;
}
