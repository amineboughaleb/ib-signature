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

/* ---------- les fiches qui ont changé d'adresse ----------
 *
 * L'adresse d'une fiche se fabrique à partir du nom que Lodgify donne au
 * logement. Lodgify a traduit certains de ces noms tout seul - « The 501
 * Racine » est devenu « Le 501 Racine » - et l'adresse a suivi : l'ancienne a
 * cessé d'exister du jour au lendemain, sans erreur nulle part, sans que
 * personne l'ait demandé. Search Console l'a signalé trois semaines plus tard ;
 * entre-temps, tout lien déjà diffusé menait à une page introuvable.
 *
 * Cette table rattrape les adresses mortes. Elle ne guérit pas la cause : pour
 * cela il faut figer les adresses dans l'enrichissement, ce que prépare
 * `scripts/figer-slugs.mjs`. Une fois figées, cette table cessera de grandir.
 *
 * Les clefs sont des fragments d'adresse et non des chemins entiers : la langue
 * se lit à part, et une ligne par logement vaut mieux que deux. */
const ANCIENS_LOGEMENTS: Record<string, string> = {
  'the-501-racine': 'le-501-racine',
  'the-31-grand-theatre': 'le-31-grand-theatre',
  'the-23-princesses': 'le-23-princesses',
};

/**
 * Le chemin vers lequel cette fiche doit partir, ou `null` si elle reste.
 *
 * Rend un chemin et non une adresse complète, à dessein : c'est l'intergiciel
 * qui sait sous quel hôte il travaille, et une redirection qui changerait
 * d'hôte en chemin enverrait un visiteur d'un environnement dans l'autre.
 */
export function redirectionDeChemin(chemin: string): string | null {
  const m = /^\/(fr|en)\/logements\/([^/?#]+)\/?$/.exec(chemin);
  if (!m) return null;
  const neuf = ANCIENS_LOGEMENTS[m[2].toLowerCase()];
  return neuf ? `/${m[1]}/logements/${neuf}` : null;
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
