import { importerTous, fraicheurDesFlux } from '@/lib/flux';

export const dynamic = 'force-dynamic';

/**
 * Le rafraîchissement quotidien des calendriers.
 *
 * Jusqu'ici l'import ne partait que d'un bouton, dans l'administration. Rien
 * ne le lançait seul, et rien ne disait à la garde du virement que ses données
 * dataient de trois semaines : le site continuait de tenir des dates sur un
 * calendrier périmé, en silence, avec la même assurance que s'il était frais.
 *
 * Cette adresse est faite pour être appelée par un ordonnanceur - la tâche
 * planifiée de Railway - une fois par nuit. Elle ne fait rien d'autre que ce
 * que fait le bouton : lire les vingt-quatre flux et écrire ce qu'ils
 * annoncent.
 *
 * Trois décisions qui méritent d'être dites.
 *
 * Le secret passe par un en-tête et jamais par l'adresse. Une clef écrite dans
 * une URL se retrouve dans les journaux de tous les serveurs traversés, dans
 * l'historique, et dans les en-têtes de provenance ; un en-tête reste entre
 * l'ordonnanceur et nous.
 *
 * Sans secret configuré, l'adresse refuse au lieu de s'ouvrir. C'est l'inverse
 * du réflexe habituel - « pas de mot de passe, donc pas de contrôle » - et
 * c'est le bon sens ici : une adresse qui déclenche vingt-quatre appels
 * réseau, ouverte à qui la trouve, est une invitation à faire tomber le site.
 *
 * Et elle rend un compte rendu, pas un « OK ». Un ordonnanceur qui affiche
 * « 200 » sur un import où vingt calendriers ont échoué ne sert à rien : ce
 * qu'on veut lire au matin, c'est combien ont été relus et combien ont
 * résisté.
 */
export async function POST(requete: Request) {
  const attendu = (process.env.CRON_SECRET || '').trim();
  if (!attendu) {
    return Response.json(
      { ok: false, erreur: 'CRON_SECRET n’est pas configuré : cette adresse reste fermée.' },
      { status: 503 }
    );
  }

  const donne = (requete.headers.get('x-cron-secret') || '').trim();
  /* Comparaison de longueur constante : comparer deux chaînes avec `===` rend
     une réponse plus rapide quand les premiers caractères diffèrent, ce qui
     laisse deviner le secret un caractère à la fois. Le coût est nul, la
     précaution est gratuite. */
  if (!egales(donne, attendu)) {
    return Response.json({ ok: false, erreur: 'secret invalide' }, { status: 401 });
  }

  const debut = Date.now();
  const resultats = await importerTous();
  const relus = resultats.filter((r) => r.ok).length;
  const echecs = resultats.filter((r) => !r.ok);

  return Response.json({
    ok: echecs.length === 0,
    duree_ms: Date.now() - debut,
    flux: resultats.length,
    relus,
    echecs: echecs.length,
    /* Les adresses ne sont pas rendues : ce sont des exports de calendrier
       Lodgify, qui donnent accès aux réservations de la maison à qui les
       connaît. Le compte rendu dit quel logement a résisté, pas par quelle
       porte. */
    details: echecs.map((r) => ({ bien_id: r.bien_id, source: r.source, erreur: r.erreur })),
    fraicheur: fraicheurDesFlux(),
  });
}

/* Certains ordonnanceurs ne savent envoyer qu'un GET. On l'accepte, au même
   prix : le secret dans l'en-tête, et rien dans l'adresse. */
export async function GET(requete: Request) {
  return POST(requete);
}

function egales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
