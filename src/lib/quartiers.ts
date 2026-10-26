/**
 * Les pages ville et quartier : le référentiel, les textes, et la règle qui
 * range un logement dans sa page.
 *
 * Spécification du 26 octobre 2026 (pages quartier IB Signature v1). Une page
 * existe pour une recherche précise - « location appartement Triangle d'Or
 * Casablanca », à la nuit - et seulement si elle a quelque chose de propre à
 * dire : au moins trois logements, et un texte écrit pour elle. En dessous,
 * elle ne serait qu'une fiche sous un autre titre, et Google la traiterait
 * comme une page satellite.
 *
 * Les adresses ne bougent jamais : le slug d'un quartier est écrit ici une
 * fois pour toutes, et ne se recalcule pas depuis un nom. Renommer « Gauthier
 * et centre-ville » ne doit pas changer l'adresse d'une page indexée.
 *
 * Les textes ont été validés par Amine le 26 octobre 2026. Ils se modifient
 * ici, sur ses mots, et nulle part ailleurs.
 *
 * Module pur : ni base, ni réseau. Ce qui lit la base est dans
 * `quartiers-serveur.ts`.
 */

import { ZONES_CASABLANCA, zoneDuPoint } from './quartiers-carte';

export type Langue = 'fr' | 'en';
type Texte = Record<Langue, string>;

/** Le segment d'adresse, propre à chaque langue. Distinct de `/logements/[slug]`, avec lequel il entrerait en collision. */
export const SEGMENT: Record<Langue, string> = {
  fr: 'location-appartement',
  en: 'apartments-for-rent',
};

/** Sous ce nombre de logements en ligne, une page ville ou quartier n'existe pas (ou plus dans l'index). */
export const SEUIL = 3;

/** Le texte propre d'une page doit compter au moins ce nombre de mots, dans la langue de la page. */
export const MOTS_MIN = 80;

/** La date des textes, pour le plan du site : c'est la seule date de mise à jour que l'on connaisse vraiment. */
export const TEXTES_DU = '2026-10-26';

export type QuartierRef = {
  /** Le slug, figé. */
  cle: string;
  nom: Texte;
  /** « au Triangle d'Or », « in Triangle d'Or » : pour le titre et le H1. */
  dans: Texte;
  /** Les libellés de fiche qui désignent ce quartier, normalisés (voir `normaliser`). */
  alias: string[];
  /** Les zones de `quartiers-carte.ts` qui le composent. */
  zones: string[];
  accroche: Texte;
  /** Le texte de la page, paragraphe par paragraphe. */
  texte: Record<Langue, string[]>;
};

export type VilleRef = {
  cle: string;
  nom: Texte;
  dans: Texte;
  alias: string[];
  texte: Record<Langue, string[]>;
  quartiers: QuartierRef[];
};

export const VILLES: VilleRef[] = [
  {
    cle: 'casablanca',
    nom: { fr: 'Casablanca', en: 'Casablanca' },
    dans: { fr: 'à Casablanca', en: 'in Casablanca' },
    alias: ['casablanca', 'casa'],
    texte: {
      fr: [
        "Casablanca se vit mieux dans un appartement que dans une chambre d'hôtel : une vraie cuisine, un salon, souvent une terrasse, et l'impression d'habiter la ville plutôt que de la traverser. IB Signature y gère {n} appartements, du une-chambre pour un déplacement professionnel au grand quatre-chambres pour une famille.",
        "Ils sont regroupés dans les quartiers où l'on aime séjourner : le Triangle d'Or et Racine pour le calme et les belles adresses, le Maârif et ses voisins pour les commerces à pied, Gauthier et le centre-ville pour l'architecture Art déco et les soirées sans voiture.",
        'Chaque appartement est préparé avant votre arrivée, le linge et le ménage sont compris, et un contact local reste joignable pendant tout votre séjour. Pour quelques nuits de rendez-vous, un week-end ou des vacances, commencez par choisir votre quartier.',
      ],
      en: [
        'Casablanca is best lived from an apartment rather than a hotel room: a real kitchen, a living room, often a terrace, and the feeling of living in the city rather than passing through it. IB Signature manages {n} apartments here, from one-bedroom flats for business trips to large four-bedroom homes for families.',
        "They are grouped in the neighbourhoods where people like to stay: Triangle d'Or and Racine for quiet streets and fine addresses, Maarif and its neighbours for shops within walking distance, Gauthier and the city centre for Art Deco architecture and evenings without a car.",
        'Every apartment is prepared before you arrive, linen and cleaning are included, and a local contact is reachable throughout your stay. For a few nights of meetings, a weekend or a holiday, start by choosing your neighbourhood.',
      ],
    },
    quartiers: [
      {
        cle: 'triangle-d-or',
        nom: { fr: "Triangle d'Or", en: "Triangle d'Or" },
        dans: { fr: "au Triangle d'Or", en: "in Triangle d'Or" },
        alias: ['triangle d or', 'racine extension'],
        zones: ['racine-extension'],
        accroche: {
          fr: 'Le quartier des belles adresses, entre le centre et la Corniche.',
          en: 'The neighbourhood of fine addresses, between the city centre and the Corniche.',
        },
        texte: {
          fr: [
            "Entre le centre-ville et la Corniche, le Triangle d'Or est le quartier des belles adresses de Casablanca. Ses rues résidentielles alignent des immeubles récents de quelques étages, des boutiques de créateurs, des pâtisseries et des restaurants où l'on dîne tard. La plage, les clubs de la Corniche et la mosquée Hassan II sont à quelques minutes en taxi.",
            "C'est le quartier où IB Signature gère le plus d'appartements : du une-chambre pour un séjour d'affaires aux grands appartements de quatre chambres, dont certains avec terrasse. On y séjourne pour le calme du soir sans renoncer aux bonnes tables.",
            "À savoir : se garer dans la rue y est difficile. Quand un appartement dispose d'une place de parking, sa fiche l'indique.",
          ],
          en: [
            "Between the city centre and the Corniche, Triangle d'Or is where Casablanca keeps its finest addresses. Its residential streets are lined with modern low-rise buildings, designer boutiques, pastry shops and restaurants where dinner starts late. The beach, the Corniche beach clubs and the Hassan II Mosque are a few minutes away by taxi.",
            'This is the neighbourhood where IB Signature manages the most apartments: from one-bedroom flats for a business stay to large four-bedroom homes, some with a terrace. People stay here for quiet evenings without giving up good restaurants.',
            'Good to know: street parking is scarce. When an apartment comes with a parking space, its listing says so.',
          ],
        },
      },
      {
        cle: 'racine',
        nom: { fr: 'Racine', en: 'Racine' },
        dans: { fr: 'à Racine', en: 'in Racine' },
        alias: ['racine'],
        zones: ['racine'],
        accroche: {
          fr: 'Casablanca côté résidentiel : avenues arborées et cafés de quartier.',
          en: "Casablanca's residential side: tree-lined avenues and neighbourhood cafés.",
        },
        texte: {
          fr: [
            "Racine, c'est Casablanca côté résidentiel : des avenues arborées, des résidences soignées et des cafés de quartier où l'on prend son petit-déjeuner en terrasse. Le quartier touche le Triangle d'Or et le Maârif, et le boulevard d'Anfa le relie aussi bien au centre-ville qu'à la Corniche.",
            "Les appartements IB Signature de Racine comptent deux ou trois chambres, l'un d'eux avec terrasse et parking. Ils conviennent à une famille, à un séjour de plusieurs semaines ou à un déplacement professionnel où l'on tient à bien dormir.",
            "À savoir : Racine est un quartier d'habitation, plus tranquille que ses voisins. Les restaurants et la vie nocturne sont à quelques minutes, au Triangle d'Or ou à Gauthier.",
          ],
          en: [
            "Racine is Casablanca's residential side: tree-lined avenues, well-kept apartment buildings and neighbourhood cafés where breakfast is served outdoors. The district borders Triangle d'Or and Maarif, and Boulevard d'Anfa links it to both the city centre and the Corniche.",
            "IB Signature's apartments in Racine have two or three bedrooms, one of them with a terrace and parking. They suit families, stays of several weeks, or business trips where a good night's sleep matters.",
            "Good to know: Racine is a residential area, quieter than its neighbours. Restaurants and nightlife are a few minutes away, in Triangle d'Or or Gauthier.",
          ],
        },
      },
      {
        cle: 'maarif-palmier-princesses',
        nom: { fr: 'Maârif, Palmier et Princesses', en: 'Maarif, Palmier and Princesses' },
        dans: { fr: 'au Maârif, à Palmier et aux Princesses', en: 'in Maarif, Palmier and Princesses' },
        alias: ['maarif', 'maarif extension', 'palmier', 'palmiers', 'princesses', 'les princesses'],
        zones: ['maarif', 'palmiers', 'maarif-extension'],
        accroche: {
          fr: "Le Casablanca des commerces, où l'on trouve tout en marchant.",
          en: "Casablanca's shopping district, where everything is a short walk away.",
        },
        texte: {
          fr: [
            "C'est au Maârif que Casablanca fait ses courses, et les deux tours du Twin Center en sont le repère. Avec Palmier et les Princesses, ses voisins, il forme un ensemble de rues où l'on trouve tout en marchant : boutiques, supermarchés, pharmacies, salles de sport, et un café à chaque coin de rue.",
            'Les appartements IB Signature y comptent une ou deux chambres. C\'est le choix pratique pour un voyageur seul ou un couple qui veut tout avoir sous la main sans louer de voiture, et rejoindre en quelques minutes le centre, Racine ou la Corniche.',
            "À savoir : c'est le secteur le plus animé de notre sélection en journée. Pour plus de silence, Racine est tout près.",
          ],
          en: [
            'Maarif is where Casablanca goes shopping, and the twin towers of the Twin Center are its landmark. Together with its neighbours Palmier and Princesses, it forms a grid of streets where everything is a short walk away: shops, supermarkets, pharmacies, gyms, and a café on every corner.',
            "IB Signature's apartments here have one or two bedrooms. It is the practical choice for a solo traveller or a couple who want everything at hand without renting a car, and who can reach the city centre, Racine or the Corniche in a few minutes.",
            'Good to know: this is the busiest area in our selection during the day. For more quiet, Racine is just next door.',
          ],
        },
      },
      {
        cle: 'gauthier-centre',
        nom: { fr: 'Gauthier et centre-ville', en: 'Gauthier and city centre' },
        dans: { fr: 'à Gauthier et au centre-ville', en: 'in Gauthier and the city centre' },
        alias: ['gauthier', 'centre ville', 'centre', 'art deco', 'beaux arts', 'grand theatre'],
        zones: ['gauthier', 'centre'],
        accroche: {
          fr: "L'Art déco, les grands boulevards et les soirées à pied.",
          en: 'Art Deco, grand boulevards and evenings on foot.',
        },
        texte: {
          fr: [
            'Gauthier et le centre-ville montrent le Casablanca des années 1920 à 1950 : façades Art déco, balcons en fer forgé, larges boulevards plantés de palmiers. La place Mohammed V et le Grand Théâtre de Casablanca se rejoignent à pied, tout comme le parc de la Ligue arabe, l\'un des grands espaces verts de la ville.',
            "Gauthier ajoute à ce décor ses restaurants et ses cafés, qui en font le quartier le plus vivant le soir. On y loge pour découvrir la ville à pied et sortir dîner sans voiture. La gare de Casa-Voyageurs, d'où le train rejoint l'aéroport Mohammed V en une trentaine de minutes, est à quelques minutes en taxi. Les appartements IB Signature y comptent une ou deux chambres.",
            'À savoir : certaines rues restent animées tard dans la soirée.',
          ],
          en: [
            "Gauthier and the city centre show the Casablanca of the 1920s to 1950s: Art Deco façades, wrought-iron balconies, wide palm-lined boulevards. Place Mohammed V and the Grand Theatre of Casablanca are within walking distance, as is the Arab League Park, one of the city's largest green spaces.",
            "Gauthier adds its restaurants and cafés to this setting, making it the liveliest neighbourhood in the evening. People stay here to explore the city on foot and go out for dinner without a car. Casa-Voyageurs station, where the train reaches Mohammed V airport in about thirty minutes, is a few minutes away by taxi. IB Signature's apartments here have one or two bedrooms.",
            'Good to know: some streets stay lively until late in the evening.',
          ],
        },
      },
    ],
  },
];

/** Un libellé ramené à sa forme comparable : sans accent, sans casse, la ponctuation réduite à des espaces. */
export function normaliser(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function compterMots(paragraphes: string[]): number {
  return paragraphes.join(' ').split(/\s+/).filter((m) => /[\p{L}\p{N}]/u.test(m)).length;
}

export function villeParCle(cle: string): VilleRef | null {
  return VILLES.find((v) => v.cle === cle) || null;
}

export function villeDuLogement(b: { ville?: unknown }): VilleRef | null {
  const n = normaliser(b.ville);
  return VILLES.find((v) => v.alias.includes(n)) || null;
}

export function quartierParCle(ville: VilleRef, cle: string): QuartierRef | null {
  return ville.quartiers.find((q) => q.cle === cle) || null;
}

export function cheminVille(langue: Langue, ville: string): string {
  return `/${SEGMENT[langue]}/${ville}`;
}

export function cheminQuartier(langue: Langue, ville: string, quartier: string): string {
  return `${cheminVille(langue, ville)}/${quartier}`;
}

export type Situation = { ville?: unknown; quartier?: unknown; latitude?: unknown; longitude?: unknown };

export type Rattachement = {
  quartier: QuartierRef | null;
  /** Ce qui a décidé : le choix de l'équipe, le libellé de la fiche, ou la carte. */
  par: 'equipe' | 'libelle' | 'carte' | null;
  /** La zone de la carte où tombent les coordonnées, s'il y en a une : l'administration la montre quand elle contredit le libellé. */
  zone: string | null;
};

/**
 * La page quartier d'un logement.
 *
 * Trois sources, dans cet ordre :
 *
 * 1. Le choix de l'équipe, fait dans l'administration (« aucune » est un choix).
 * 2. Le quartier écrit sur la fiche. C'est lui que le voyageur lit sur la
 *    fiche et sur la carte de la page : une page « Triangle d'Or » qui
 *    listerait un logement présenté comme « Bourgogne » se contredirait sous
 *    ses yeux. Le libellé le plus long l'emporte (« racine extension » n'est
 *    pas « racine »).
 * 3. Les coordonnées, pour un libellé vide ou qui ne nomme aucun quartier
 *    (« Art-déco »). Un libellé qui nomme un quartier sans page (« Bourgogne »,
 *    « C.I.L ») ne passe pas à la carte : le logement n'a pas de page, plutôt
 *    qu'une page qui le dirait ailleurs.
 *
 * L'ordre diffère de la spécification, qui mettait la carte avant le libellé.
 * Raison : sur les coordonnées publiées au 26 octobre, la carte classe
 * Number 06 Bourgogne et The Nineteen Racine au Triangle d'Or, C202 Alcazar et
 * The 23 Princesses à Socrate - Val Fleuri. Les libellés, eux, sont écrits par
 * l'équipe, pour un seul exploitant ; ils sont plus sûrs qu'un relevé sur
 * image au bord d'un boulevard. L'administration signale chaque désaccord.
 */
export function rattacher(ville: VilleRef, b: Situation, force?: string): Rattachement {
  const zone = zoneDuPoint(b.latitude, b.longitude)?.cle ?? null;
  const f = normaliser(force).replace(/ /g, '-');
  if (f === 'aucune') return { quartier: null, par: 'equipe', zone };
  if (f) {
    const q = quartierParCle(ville, f);
    if (q) return { quartier: q, par: 'equipe', zone };
  }
  const nom = normaliser(b.quartier);
  if (nom) {
    let trouve: QuartierRef | null = null;
    let longueur = 0;
    for (const q of ville.quartiers) {
      for (const a of q.alias) {
        const correspond = nom === a || ` ${nom} `.includes(` ${a} `);
        if (correspond && a.length > longueur) {
          trouve = q;
          longueur = a.length;
        }
      }
    }
    if (trouve) return { quartier: trouve, par: 'libelle', zone };
  }
  if (nom && QUARTIERS_CONNUS.has(nom)) return { quartier: null, par: 'libelle', zone };
  if (zone) {
    const q = ville.quartiers.find((x) => x.zones.includes(zone));
    if (q) return { quartier: q, par: 'carte', zone };
  }
  return { quartier: null, par: null, zone };
}

/* Les noms de quartier que la carte connaît, sous leurs deux formes : un
   libellé de fiche qui en est un désigne un endroit précis, même sans page. */
const QUARTIERS_CONNUS = new Set(
  ZONES_CASABLANCA.flatMap((z) => [
    normaliser(z.cle),
    normaliser(z.nom),
    ...z.nom.split(/,| et | \(|\)/).map((x) => normaliser(x)),
  ]).filter((x) => x.length > 2)
);

/** La page quartier que la carte seule désignerait, pour signaler un désaccord. */
export function quartierDeLaCarte(ville: VilleRef, zone: string | null): QuartierRef | null {
  return zone ? ville.quartiers.find((q) => q.zones.includes(zone)) || null : null;
}

/** Le texte d'une page, `{n}` remplacé par le nombre de logements. */
export function paragraphes(t: string[], n: number): string[] {
  return t.map((p) => p.replace(/\{n\}/g, String(n)));
}

/** Les deux conditions d'une page indexable : assez de logements, et un texte à elle. */
export function remplitLesConditions(nombre: number, texte: string[]): boolean {
  return nombre >= SEUIL && compterMots(texte) >= MOTS_MIN;
}
