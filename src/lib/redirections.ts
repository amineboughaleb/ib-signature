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
 * L'adresse d'une fiche se fabriquait à partir du nom que Lodgify donne au
 * logement : renommer là-bas changeait l'adresse ici, sans erreur nulle part.
 * Ce défaut est réglé à sa source - `data/enrichissement.json` porte désormais
 * une adresse figée par logement, et le nom Lodgify ne commande plus rien.
 *
 * Cette table ne sert donc qu'aux changements voulus, et elle est vide. La
 * raison pour laquelle elle l'est se lit plus bas : elle a coûté assez cher
 * pour être racontée. */
const ANCIENS_LOGEMENTS: Record<string, string> = {
  /* Vide - et le récit de ce qui l'a remplie quelques heures mérite d'être
     gardé, parce que la faute était dans la méthode, pas dans le code.

     Le raisonnement était : Search Console signale `the-501-racine` en erreur,
     un serveur d'essai confirme qu'elle rend 404 et que `le-501-racine` répond,
     donc Lodgify a renommé le logement et il faut rediriger l'ancienne adresse
     vers la nouvelle. Trois lignes, et des fiches cassées en production.

     Le serveur d'essai ne pouvait pas joindre l'API de Lodgify. Dans ce cas,
     `biens()` bascule sans bruit sur le `repli` de ce même fichier - un
     catalogue écrit à la main, dont les adresses portent la forme française.
     Ce qui passait pour le catalogue réel était un catalogue de secours, et la
     « nouvelle adresse » n'existait que là.

     Les vraies adresses n'avaient jamais bougé. Les rediriger les a fait
     pointer vers des pages qui n'ont jamais existé.

     Deux leçons, et la seconde est la vraie. Un repli silencieux est un piège
     pour qui l'observe sans le savoir : il rend une réponse plausible là où une
     erreur aurait instruit. Et une redirection se vérifie sur le site en ligne,
     jamais sur une copie - c'est le seul endroit où l'adresse de départ et
     l'adresse d'arrivée sont celles que voit un visiteur.

     La table reste, vide, pour le jour où une adresse changera pour de vrai :
     un logement renommé, un slug corrigé à la main dans l'enrichissement. Ce
     jour-là, une ligne ici évitera une page d'erreur - après vérification en
     ligne des deux adresses, celle qu'on quitte et celle où l'on va. */
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
