/**
 * L'adresse du tunnel de paiement Lodgify.
 *
 * Ce fichier est minuscule et n'importe rien, et c'est délibéré : c'est la
 * dernière adresse que voit un voyageur avant de sortir sa carte. Une erreur
 * ici ne se rattrape pas - elle envoie quelqu'un qui allait payer sur une page
 * introuvable, ou pire, sur le mauvais appartement.
 *
 * Isolé de tout, il se vérifie sans navigateur, sans base et sans réseau. Le
 * jour où Lodgify changera la forme de ses adresses, tout ce qu'il y a à
 * relire tient sur un écran.
 *
 * La forme, telle qu'on l'a relevée sur un vrai paiement :
 *
 *     checkout.lodgify.com/fr/ibsignature/604830/contact?currency=EUR
 *       &arrival=2026-09-14&departure=2026-09-18&adults=2
 *
 * Le 604830 est l'identifiant du logement chez Lodgify - celui que l'API rend
 * pour chacun des vingt-quatre. C'est la découverte qui rend inutile la saisie
 * manuelle des vingt-quatre adresses : le site les connaît déjà toutes.
 *
 * Une remarque sur ce qui N'EST PAS dans cette adresse. Le nom, le courriel et
 * le téléphone n'y figurent pas, et ce n'est pas un oubli. Lodgify ne publie
 * aucun paramètre de pré-remplissage : les écrire les rendrait ignorés, tout
 * en publiant des données personnelles dans l'historique du navigateur, dans
 * les en-têtes de provenance et dans les journaux de tous les serveurs
 * traversés. Un pré-remplissage qui n'en est pas un, payé en données exposées.
 */

/** Les langues que le tunnel connaît. Toute autre valeur retombe en français. */
export const languesCheckout = ['fr', 'en'] as const;

export function langueCheckout(locale?: string): string {
  return locale === 'en' ? 'en' : 'fr';
}

/**
 * Construit l'adresse, ou rend `null` quand elle ne peut pas l'être.
 *
 * `null` n'est pas un échec : c'est le cas d'un logement de repli, qui n'a pas
 * d'identifiant Lodgify, ou d'un compte non renseigné. L'appelant retombe
 * alors sur la page « toutes les propriétés » - un détour vaut mieux qu'une
 * impasse, et une adresse devinée vaut moins que les deux.
 */
export function lienCheckout(opts: {
  base?: string;
  compte?: string;
  bienId: number;
  locale?: string;
  arrivee?: string;
  depart?: string;
  voyageurs?: number;
  devise?: string;
}): string | null {
  const compte = (opts.compte || '').trim();
  if (!compte) return null;
  if (!Number.isFinite(opts.bienId) || opts.bienId <= 0) return null;

  const base = (opts.base || 'https://checkout.lodgify.com').replace(/\/+$/, '');
  const chemin = `${base}/${langueCheckout(opts.locale)}/${encodeURIComponent(compte)}/${opts.bienId}/contact`;

  const p = new URLSearchParams();
  if (opts.devise && /^[A-Za-z]{3}$/.test(opts.devise)) p.set('currency', opts.devise.toUpperCase());
  if (opts.arrivee) p.set('arrival', opts.arrivee);
  if (opts.depart) p.set('departure', opts.depart);
  /* Le tunnel attend le détail des voyageurs, pas un total : c'est ce que
     porte son propre formulaire. */
  if (opts.voyageurs && opts.voyageurs > 0) {
    p.set('adults', String(Math.round(opts.voyageurs)));
    p.set('children', '0');
    p.set('infants', '0');
    p.set('pets', '0');
  }

  const q = p.toString();
  return q ? `${chemin}?${q}` : chemin;
}

/**
 * L'adresse collée vise-t-elle le tunnel, ou le site vitrine ?
 *
 * La distinction se lit sur le nom d'hôte et nulle part ailleurs. Le premier
 * essai cherchait « checkout. » n'importe où dans l'adresse, ce qui ne
 * marchait justement pas sur la seule forme qui compte - dans
 * `https://checkout.lodgify.com/…`, ce mot est précédé de deux barres et non
 * d'un point. Une adresse mal analysée est traitée comme une adresse vitrine :
 * l'échappatoire est alors muette, ce qui est la pire façon d'échouer pour un
 * mécanisme de secours.
 */
function viseLeTunnel(adresse: string): boolean {
  try {
    return new URL(adresse).hostname.toLowerCase().startsWith('checkout.');
  } catch {
    return false;
  }
}

/**
 * Pose les dates sur une adresse déjà connue, et corrige sa langue.
 *
 * Les adresses du site vitrine ont été collées depuis un navigateur en
 * français, et portent donc toutes `/fr/` : un visiteur anglophone lisait la
 * fiche en anglais, cliquait sur « Pay by card », et atterrissait sur une page
 * en français. On ne traduit rien - le segment de langue est le seul remplacé,
 * et seulement s'il est là.
 */
export function avecDates(
  adresse: string,
  arrivee?: string,
  depart?: string,
  voyageurs?: number,
  locale?: string
): string {
  let base = adresse.replace(/\?.*$/, '');
  if (locale === 'en') base = base.replace(/(https?:\/\/[^/]+)\/fr(\/|$)/i, '$1/en$2');

  const p = new URLSearchParams();
  if (arrivee) p.set('arrival', arrivee);
  if (depart) p.set('departure', depart);
  /* Le moteur attend le détail des voyageurs, pas un total : c'est ce que
     porte son propre formulaire de recherche. */
  if (voyageurs) {
    p.set('adults', String(voyageurs));
    p.set('children', '0');
    p.set('infants', '0');
    p.set('pets', '0');
  }
  const q = p.toString();
  return q ? `${base}${base.includes('?') ? '&' : '?'}${q}` : base;
}

/**
 * L'adresse où part le voyageur qui choisit la carte.
 *
 * L'ordre a changé, et c'est l'adresse collée à la main qui a reculé.
 *
 * Elle l'emportait, pour une bonne raison : elle est vérifiée par un humain.
 * Mais depuis qu'on sait construire l'adresse du tunnel, ce raisonnement se
 * retourne. Les vingt-quatre adresses collées visent le site VITRINE - une
 * seconde fiche du logement, avec ses photos et son propre bouton
 * « Réservez pour 229 € ». Or le voyageur en vient : il a lu la fiche sur IB
 * Signature, saisi son nom, choisi la carte. Le renvoyer sur une seconde fiche
 * pour qu'il reclique sur « Réserver », c'est lui refaire faire ce qu'il vient
 * de faire, au moment précis où il allait payer.
 *
 * Le tunnel, lui, ouvre directement l'étape des coordonnées. Il gagne donc, et
 * l'adresse collée devient ce qu'elle aurait toujours dû être : le repli.
 *
 * L'échappatoire reste entière. Une adresse collée qui vise déjà le tunnel -
 * `checkout.` dans le domaine - l'emporte sur tout : c'est ainsi qu'on
 * réparera sans redéployer le jour où Lodgify changera ses adresses.
 */
export function adresseReservation(opts: {
  /** L'adresse collée dans l'administration, s'il y en a une. */
  collee?: string;
  /** La page « toutes les propriétés », dernier recours. */
  repli: string;
  base?: string;
  compte?: string;
  bienId: number;
  devise?: string;
  locale?: string;
  arrivee?: string;
  depart?: string;
  voyageurs?: number;
}): string {
  const collee = (opts.collee || '').trim();
  if (collee && viseLeTunnel(collee)) {
    return avecDates(collee, opts.arrivee, opts.depart, opts.voyageurs, opts.locale);
  }

  const construit = lienCheckout(opts);
  if (construit) return construit;

  return avecDates(collee || opts.repli, opts.arrivee, opts.depart, opts.voyageurs, opts.locale);
}
