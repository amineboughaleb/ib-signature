/**
 * Ne pas se faire jeter par Lodgify.
 *
 * Le diagnostic disait « aucun chemin n'a répondu », et ce n'était pas vrai :
 * les chemins répondaient, mais 429 - trop de requêtes. Vingt-quatre logements
 * multipliés par quatre chemins de disponibilité, trois de tarif, plus une
 * fiche et une liste de chambres chacun : la page en tirait plusieurs centaines
 * en quelques secondes. Lodgify annonce sept cent cinquante appels par minute,
 * mais coupe bien avant sur une rafale, et bloque l'adresse au-delà.
 *
 * Le plus coûteux n'était pas le refus lui-même : c'est qu'il ressemblait à une
 * absence. Un point d'entrée qui n'existe pas et un point d'entrée qu'on
 * interroge trop vite rendent la même chose - rien - et l'on cherche pendant
 * des jours du côté de l'offre Lodgify un défaut qui est de notre côté.
 *
 * D'où cette file. Trois appels de front au plus, un intervalle minimum entre
 * deux départs, et surtout : quand Lodgify dit d'attendre, TOUT attend. Un
 * refus ne concerne pas la requête qui l'a reçu, il concerne la clé - continuer
 * à en lancer d'autres pendant qu'on est refusé est le meilleur moyen de se
 * faire bloquer pour de bon.
 */

/* Douze appels par seconde seraient dans les clous annoncés. On en fait huit :
   la marge coûte quelques secondes sur une page d'administration, et elle
   évite le blocage d'adresse qui, lui, coûte une journée. */
const MAX_DE_FRONT = 3;
const ECART_MS = 120;

let enCours = 0;
let prochainDepart = 0;

/* Combien d'appels de visiteur patientent en ce moment.
 *
 * La file était équitable, et c'était le défaut. Ouvrir la page de diagnostic
 * y jetait une cinquantaine de sondes ; pendant les deux minutes suivantes,
 * un voyageur qui demandait un prix passait derrière elles. Le journal l'a
 * montré sans ambiguïté : un dépôt de virement à vingt-six secondes, une page
 * d'avis à trente-cinq, alors que ni l'une ni l'autre n'attendait grand-chose
 * de Lodgify. Elles attendaient une place.
 *
 * Deux voies, donc. Celle du visiteur passe toujours devant ; celle du fond -
 * diagnostic, reconstruction du catalogue - ne prend un créneau que lorsque
 * plus personne n'attend devant. Un administrateur qui patiente le sait et
 * l'accepte ; un voyageur qui patiente s'en va.
 */
let visiteursEnAttente = 0;
/* L'instant avant lequel plus rien ne part. Posé par un 429, il vaut pour
   toutes les requêtes à la fois - c'est la clé qui est refusée, pas l'adresse. */
let pauseJusqua = 0;

const attendre = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

/** Fait patienter tout le monde. Appelé quand Lodgify répond « trop vite ». */
export function freiner(ms: number) {
  const cible = Date.now() + Math.min(30000, Math.max(500, ms));
  if (cible > pauseJusqua) pauseJusqua = cible;
}

/** Vrai si l'on est en train de purger une pause imposée par Lodgify. */
export const freine = () => Date.now() < pauseJusqua;

/* Le temps maximum qu'une requête acceptera de patienter dans la file.

   Sans ce plafond, une page pouvait attendre indéfiniment : chaque refus
   repousse la pause, et une rafale de refus la repousse en cascade. Le
   navigateur, lui, finit par abandonner sans rien expliquer - « network
   error », et l'on cherche du côté du réseau une file qui n'en finissait pas.

   Mieux vaut rendre la main : la page affiche ce qu'elle sait, dit que le
   moteur n'a pas répondu, et reste utilisable. Une page lente est un défaut,
   une page qui ne répond jamais est une panne. */
const ATTENTE_MAX = 20000;
/* Le fond patiente cinq fois plus : personne ne le regarde. */
const ATTENTE_MAX_FOND = 100000;

/**
 * Prend un créneau, exécute, et le rend.
 *
 * La file est volontairement simple : une boucle d'attente plutôt qu'une
 * structure de tâches. Le nombre d'appels en jeu se compte en dizaines, et une
 * file élaborée serait plus difficile à relire qu'utile - or c'est du code qui
 * ne se relit que le jour où quelque chose ne marche plus.
 */
export async function encadrer<T>(
  travail: () => Promise<T>,
  options?: { fond?: boolean }
): Promise<T | null> {
  const fond = options?.fond === true;
  /* Le travail de fond attend plus longtemps sans se plaindre : personne ne
     regarde un écran en l'attendant. Rendre la main trop tôt le ferait
     échouer chaque fois qu'un visiteur passe, et le catalogue ne se
     reconstruirait jamais aux heures de fréquentation - précisément celles où
     il en a besoin. */
  const limite = Date.now() + (fond ? ATTENTE_MAX_FOND : ATTENTE_MAX);
  if (!fond) visiteursEnAttente += 1;
  try {
    for (;;) {
      const maintenant = Date.now();
      const placeLibre = enCours < MAX_DE_FRONT && maintenant >= pauseJusqua && maintenant >= prochainDepart;
      /* Le fond cède le passage tant qu'un visiteur attend. */
      if (placeLibre && (!fond || visiteursEnAttente === 0)) break;
      /* On a assez attendu : on renonce à cet appel plutôt que de retenir la
         page. L'appelant traitera ce `null` comme n'importe quel silence de
         Lodgify - c'en est un. */
      if (maintenant > limite) return null;
      await attendre(Math.max(20, Math.min(Math.min(pauseJusqua, prochainDepart) - maintenant, 500)));
    }
  } finally {
    if (!fond) visiteursEnAttente -= 1;
  }
  enCours += 1;
  prochainDepart = Date.now() + ECART_MS;
  try {
    return await travail();
  } finally {
    enCours -= 1;
  }
}

/**
 * Combien de temps attendre après un refus.
 *
 * L'en-tête `Retry-After` fait foi quand il est là - c'est le serveur qui sait.
 * Sinon on double à chaque fois : une seconde, trois, huit. Réessayer aussitôt
 * après un refus, c'est demander à être bloqué.
 */
export function delaiApresRefus(entete: string | null, essai: number): number {
  const dit = Number(entete);
  if (Number.isFinite(dit) && dit > 0) return Math.min(30000, dit * 1000);
  return [1000, 3000, 8000][Math.min(essai, 2)];
}

/* Le compte des refus, pour que le diagnostic puisse le dire. Un site qui va
   lentement sans expliquer pourquoi est plus inquiétant qu'un site qui
   annonce « Lodgify m'a demandé d'attendre ». */
let refus = 0;
export const compterRefus = () => { refus += 1; };
export const refusVus = () => refus;
export const oublierRefus = () => { refus = 0; };
