/**
 * Les avis voyageurs.
 *
 * Ils ne viennent pas de Lodgify, et ce n'est pas un choix : l'API publique de
 * Lodgify n'expose aucun point d'entrée « avis ». Ses groupes sont Global,
 * Channels, Properties, Add-ons & Payments, Rates, Webhooks, Reservations et
 * Quotes - rien sur les commentaires. Ils vivent donc chez nous.
 *
 * Ils vivent en base, et non plus dans un fichier : un fichier ne se modifie
 * pas depuis une interface une fois le site déployé, et vous devez pouvoir
 * publier un avis sans toucher au code. `data/avis.json` ne sert plus qu'à
 * amorcer la table la première fois, avec les avis déjà recopiés depuis le
 * moteur de réservation.
 *
 * Un avis n'est jamais inventé. N'entrez ici que des commentaires réellement
 * reçus : un faux témoignage est une faute, et il se repère.
 *
 * Le rattachement à un logement se fait par slug. Quand le logement est au
 * catalogue, sa photo de couverture illustre l'avis et son nom devient un
 * lien ; sinon - un bien sorti du parc, par exemple - seul le nom subsiste.
 * Un avis vrai sur un logement disparu reste un avis vrai.
 */

import { biens, type Bien } from './biens';
import { amorcerAvis, listerAvis, type LigneAvis } from './db';
import graine from '../../data/avis.json';

export type Avis = {
  id: number;
  /** Le prénom quand il est connu. Lodgify ne publie que le pays. */
  prenom: string;
  pays: string;
  texte: string;
  /** La plateforme d'origine : Airbnb, Booking.com, Vrbo… Vide, elle ne s'affiche pas. */
  source: string;
  bienNom: string;
  /** Renseignés seulement si le logement est encore au catalogue. */
  bienSlug?: string;
  photo?: string;
};

type Brut = {
  prenom?: string;
  pays: { fr: string; en: string };
  bien: string;
  bien_nom: string;
  source?: string;
  texte: { fr: string; en: string };
};

let amorce = false;
function amorcerUneFois() {
  if (amorce) return;
  amorce = true;
  const liste = (graine as { avis: Brut[] }).avis.map((a, i) => ({
    prenom: a.prenom || '',
    pays_fr: a.pays.fr,
    pays_en: a.pays.en,
    bien_slug: a.bien,
    bien_nom: a.bien_nom,
    texte_fr: a.texte.fr,
    texte_en: a.texte.en,
    source: a.source || '',
    rang: (i + 1) * 10,
    publie: 1,
  }));
  amorcerAvis(liste);
}

/**
 * La signature d'un avis : « Fatima, France » quand le prénom est connu,
 * « France » sinon. Jamais « Anonyme », qui affaiblit un vrai témoignage.
 */
export function signature(a: Avis): string {
  return a.prenom ? `${a.prenom}, ${a.pays}` : a.pays;
}

function habiller(l: LigneAvis, locale: string, parSlug: Map<string, Bien>): Avis {
  const b = parSlug.get(l.bien_slug);
  return {
    id: l.id,
    prenom: (l.prenom || '').trim(),
    pays: locale === 'en' ? l.pays_en || l.pays_fr : l.pays_fr,
    texte: locale === 'en' ? l.texte_en || l.texte_fr : l.texte_fr,
    source: l.source || '',
    bienNom: b?.nom || l.bien_nom,
    bienSlug: b?.slug,
    photo: b?.photos[0],
  };
}

export async function avis(locale: string, max = 6): Promise<Avis[]> {
  amorcerUneFois();
  const catalogue = await biens();
  const parSlug = new Map<string, Bien>(catalogue.map((b) => [b.slug, b]));
  return listerAvis(true).slice(0, max).map((l) => habiller(l, locale, parSlug));
}
