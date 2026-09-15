/**
 * Les anciennes adresses, et où elles mènent désormais.
 *
 * Le site de la conciergerie a vécu de juin à septembre sur son propre
 * sous-domaine, hébergé ailleurs. Depuis que `ibsignature.com` porte les mêmes
 * informations sous « Qui sommes-nous » et « Propriétaires », les deux adresses
 * servaient le même contenu - ce qu'un moteur de recherche appelle du contenu
 * dupliqué, et ce qu'il sanctionne en répartissant ses signaux entre deux
 * hôtes au lieu d'en classer un seul.
 *
 * Effacer l'ancien sous-domaine aurait réglé le doublon en jetant trois mois
 * d'existence : tous ceux à qui l'adresse a été donnée - un propriétaire
 * démarché, un message, une signature de courriel - seraient tombés sur une
 * page d'erreur. Une redirection permanente fait mieux : elle transfère ce qui
 * a été accumulé et transforme chaque ancien lien en une visite utile.
 *
 * **Tout part vers une seule page, et non vers son équivalent.** Il n'y a rien
 * à préserver du chemin d'origine : l'ancien site tenait sur quelques écrans
 * dont le contenu est aujourd'hui regroupé. Rediriger `/tarifs` vers un
 * `/tarifs` qui n'existe pas produirait une page introuvable au bout d'une
 * redirection, ce qui est pire qu'une redirection franche.
 *
 * Ce module ne connaît ni Next ni la requête : il répond à « cet hôte doit-il
 * partir ailleurs, et où », et il se teste sans rien démarrer.
 */

/** Vers quoi pointe désormais l'ancien site de la conciergerie. */
export const DESTINATION_CONCIERGERIE = 'https://ibsignature.com/fr/qui-sommes-nous';

/** Les hôtes qui ne servent plus rien et qui partent ailleurs. */
const ANCIENS_HOTES: Record<string, string> = {
  'conciergerie.ibsignature.com': DESTINATION_CONCIERGERIE,
  /* Le www n'a jamais été annoncé, mais il se tape et se colle. Le laisser
     tomber en erreur pour une lettre serait dommage. */
  'www.conciergerie.ibsignature.com': DESTINATION_CONCIERGERIE,
};

/**
 * Le nom d'hôte de la requête, en minuscules et sans port.
 *
 * `x-forwarded-host` d'abord : derrière le routeur de l'hébergeur, c'est lui
 * qui porte le nom demandé par le visiteur, tandis que `host` peut porter
 * celui du conteneur. Prendre le second en premier ferait échouer la
 * comparaison en production sans qu'elle échoue en local, ce qui est la pire
 * façon de se tromper.
 */
export function hote(entetes: { get(nom: string): string | null }): string {
  const brut = entetes.get('x-forwarded-host') || entetes.get('host') || '';
  /* Le port ne fait pas partie du nom. Un `:3000` en développement, un
     `:443` que certains mandataires ajoutent, et la comparaison tombe à
     côté. Les crochets d'une adresse IPv6 ne nous concernent pas ici. */
  return brut.trim().toLowerCase().split(',')[0].trim().split(':')[0];
}

/**
 * L'adresse vers laquelle cet hôte doit partir, ou `null` s'il reste chez lui.
 *
 * `null` est le cas de tous les visiteurs du site : la fonction doit être
 * bon marché et ne rien faire d'autre qu'une lecture de table.
 */
export function redirectionDeHote(nomDHote: string): string | null {
  return ANCIENS_HOTES[nomDHote] ?? null;
}
