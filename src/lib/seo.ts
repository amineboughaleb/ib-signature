/**
 * Être trouvé.
 *
 * Trois publics, et ils ne lisent pas la même chose.
 *
 * Un moteur de recherche lit les balises de la page, suit un plan du site et
 * obéit à un fichier robots. Il faut donc les trois, et surtout qu'ils
 * s'accordent : un plan qui annonce des pages que les balises déclarent
 * ailleurs dessert plus qu'il ne sert.
 *
 * Un assistant - ChatGPT, Gemini, Claude - lit la page comme un lecteur, mais
 * cherche d'abord ce qui est structuré. Le JSON-LD est ce qui lui permet de
 * répondre « IB Signature loue des appartements à Casablanca et Marrakech, à
 * partir de tant » plutôt que de paraphraser un paragraphe. Ce n'est pas une
 * astuce de référencement : c'est la même information, écrite une seconde fois
 * dans une forme qui ne se prête pas au malentendu.
 *
 * Un être humain, enfin, lit le titre et la description dans la page de
 * résultats, et décide en deux secondes. C'est le seul des trois qui décide.
 *
 * Une règle traverse ce fichier : rien n'est déclaré qui ne soit vrai. Une
 * note moyenne inventée, un prix qui n'existe pas, un avis fabriqué -
 * Google les sanctionne, un assistant les répète, et c'est la maison qui
 * paraît menteuse. Ce qui n'est pas connu est simplement absent.
 */

import { MARQUE } from './marque';

/** L'adresse publique du site. Une seule, et elle vient de l'environnement. */
export function origine(): string {
  const brut = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://ibsignature.com';
  return brut.replace(/\/+$/, '');
}

export const LANGUES = ['fr', 'en'] as const;

/** Les pages fixes du site, hors fiches de logement. */
export const PAGES = ['', '/logements', '/proprietaires', '/qui-sommes-nous', '/contact', '/cgv', '/mentions', '/confidentialite'];

/**
 * Les balises communes à toutes les pages.
 *
 * `alternates` porte les deux langues et le lien canonique. Sans lui, Google
 * voit deux pages qui se ressemblent et en choisit une au hasard - souvent
 * l'anglaise, pour une clientèle qui cherche en français.
 */
/* L'image de partage par défaut.
 *
 * Un lien collé dans WhatsApp, LinkedIn ou une conversation Slack s'affiche
 * avec une photographie ou avec un rectangle gris. Pour une maison qui vend du
 * séjour, le rectangle gris est un aveu : c'est la première chose que voit
 * quelqu'un à qui l'on recommande l'adresse.
 *
 * Une fiche de logement met sa propre photo ; tout le reste retombe ici. */
const IMAGE_PARTAGE = '/accueil-sejour.jpg';

export function metaCommune(locale: string, chemin: string, titre: string, description: string, image?: string) {
  const base = origine();
  const url = `${base}/${locale}${chemin}`;
  /* Une adresse relative ne sert à rien dans une balise de partage : les
     réseaux ne savent pas d'où elle vient. On la rend absolue ici, une fois. */
  const brut = image || IMAGE_PARTAGE;
  const visuel = /^https?:\/\//i.test(brut) ? brut : `${base}${brut.startsWith('/') ? '' : '/'}${brut}`;
  return {
    metadataBase: new URL(base),
    title: titre,
    description,
    alternates: {
      canonical: url,
      languages: {
        ...Object.fromEntries(LANGUES.map((l) => [l, `${base}/${l}${chemin}`])),
        /* Pour un visiteur dont la langue n'est ni le français ni l'anglais,
           un moteur doit savoir quelle version servir. Sans `x-default`, il
           choisit - souvent l'anglaise, pour une clientèle qui cherche en
           français. */
        'x-default': `${base}/fr${chemin}`,
      },
    },
    openGraph: {
      type: 'website' as const,
      siteName: MARQUE.nom,
      locale: locale === 'en' ? 'en_GB' : 'fr_FR',
      url,
      title: titre,
      description,
      images: [{ url: visuel }],
    },
    twitter: { card: 'summary_large_image' as const, title: titre, description, images: [visuel] },
  };
}

/**
 * La maison, décrite une fois pour toutes.
 *
 * `LodgingBusiness` plutôt que `Organization` : c'est le type qu'un moteur
 * relie à une recherche d'hébergement, et il porte la ville - qui est
 * précisément ce qu'on cherche ici.
 */
export function jsonMaison(locale: string) {
  const base = origine();
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    '@id': `${base}/#maison`,
    name: MARQUE.nom,
    description:
      locale === 'en'
        ? 'Serviced apartments run like a five-star hotel, in Casablanca and Marrakech.'
        : 'Des appartements tenus comme un hôtel cinq étoiles, à Casablanca et Marrakech.',
    url: `${base}/${locale}`,
    telephone: MARQUE.telephone,
    email: MARQUE.courriel,
    address: {
      '@type': 'PostalAddress',
      streetAddress: '24 boulevard Rachidi',
      postalCode: '20070',
      addressLocality: 'Casablanca',
      addressCountry: 'MA',
    },
    areaServed: ['Casablanca', 'Marrakech'],
    parentOrganization: { '@type': 'Organization', name: MARQUE.societe },
    /* Aucune note, aucun nombre d'avis : ils seraient invérifiables. Une note
       agrégée déclarée sans source est exactement ce que Google sanctionne, et
       ce qu'un assistant répétera ensuite comme un fait. */
  };
}

export type BienSeo = {
  nom: string;
  slug: string;
  ville: string;
  quartier?: string;
  description?: string;
  photos: string[];
  chambres?: number;
  voyageurs?: number;
  surface?: number;
  latitude?: number;
  longitude?: number;
  prixDepuis?: number;
  devise?: string;
};

/**
 * Un logement, décrit pour être compris sans être lu.
 *
 * `Accommodation` / `Apartment` porte ce qui distingue un logement d'un autre :
 * la capacité, le nombre de chambres, la surface, la position. Un prix n'y
 * figure que s'il est connu, et il est alors annoncé pour ce qu'il est - un
 * prix d'appel, `lowPrice`, et non un tarif ferme. Annoncer un prix ferme qui
 * varie chaque semaine ferait paraître le site imprécis là où il est
 * simplement dynamique.
 */
export function jsonLogement(b: BienSeo, locale: string) {
  const base = origine();
  const url = `${base}/${locale}/logements/${b.slug}`;
  const images = b.photos.filter(Boolean).slice(0, 8).map((p) => (p.startsWith('http') ? p : `${base}${p}`));

  const noyau: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Apartment',
    '@id': `${url}#logement`,
    name: b.nom,
    url,
    address: {
      '@type': 'PostalAddress',
      addressLocality: b.ville,
      addressRegion: b.quartier || undefined,
      addressCountry: 'MA',
    },
    /* L'adresse exacte n'est jamais publiée : elle est communiquée à la
       confirmation. On donne le quartier, ce qui suffit à situer et ne livre
       pas la porte d'un logement occupé. */
  };

  if (b.description) noyau.description = b.description.slice(0, 900);
  if (images.length) noyau.photo = images;
  if (b.voyageurs) noyau.occupancy = { '@type': 'QuantitativeValue', maxValue: b.voyageurs };
  if (b.chambres) noyau.numberOfRooms = b.chambres;
  if (b.surface) noyau.floorSize = { '@type': 'QuantitativeValue', value: b.surface, unitCode: 'MTK' };
  if (b.latitude !== undefined && b.longitude !== undefined) {
    noyau.geo = { '@type': 'GeoCoordinates', latitude: b.latitude, longitude: b.longitude };
  }
  if (b.prixDepuis && b.devise) {
    noyau.offers = {
      '@type': 'AggregateOffer',
      lowPrice: b.prixDepuis,
      priceCurrency: b.devise,
      availability: 'https://schema.org/InStock',
      url,
    };
  }
  return noyau;
}

/** Le fil d'Ariane, qui donne à Google la place de la page dans le site. */
export function jsonFil(locale: string, elements: { nom: string; chemin: string }[]) {
  const base = origine();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: elements.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: e.nom,
      item: `${base}/${locale}${e.chemin}`,
    })),
  };
}

/** Les questions et réponses de la page Propriétaires, telles qu'elles y sont écrites. */
export function jsonFaq(qr: { q: string; r: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: qr.map((x) => ({
      '@type': 'Question',
      name: x.q,
      acceptedAnswer: { '@type': 'Answer', text: x.r },
    })),
  };
}
