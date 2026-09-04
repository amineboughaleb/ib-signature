/**
 * Ce qui, dans un calendrier, doit vous faire ouvrir Lodgify.
 *
 * Cette règle est écrite à part, et sans aucune dépendance, pour une raison
 * précise : c'est la seule chose qui compte vraiment dans la page des
 * calendriers, et une règle enfouie dans un composant d'affichage ne se
 * vérifie pas. Ici, elle se vérifie - le contrôle automatique appelle
 * directement ces fonctions, avec des calendriers fabriqués pour l'occasion,
 * sans navigateur ni clé d'API.
 *
 * Trois verdicts seulement, et l'absence d'un quatrième est le point qui
 * mérite le plus d'attention.
 *
 * Un calendrier de disponibilité, interrogé par une API, parle de CHAQUE jour :
 * on voit donc jusqu'où il va, et l'on peut signaler celui qui s'arrête dans
 * six semaines quand les autres vont jusqu'à l'an prochain. Un flux iCal ne dit
 * rien de tel : il ne liste que les réservations. Un logement sans réservation
 * au-delà de deux mois rend exactement le même flux qu'un logement dont la
 * connexion serait tombée, et rien ne permet de les distinguer. « S'arrête
 * tôt » n'a donc pas de sens ici, et le garder ferait sonner l'alarme sur des
 * logements qui vont bien. Un signal qui ne peut rien signifier vaut moins que
 * pas de signal du tout.
 *
 * Le jugement restant est prudent, pour la même raison : à force d'envoyer
 * vérifier des logements qui vont bien, la page finirait par ne plus être
 * ouverte, et le jour où un calendrier tombe vraiment, personne ne le verrait.
 * « Aucune réservation » n'est donc pas présenté comme une panne mais comme
 * une chose à regarder - un logement neuf, ou retiré de la location, l'est
 * légitimement.
 */

export type EtatIcal = 'muet' | 'vide' | 'plein' | 'ok';

export const ETATS_ICAL: Record<EtatIcal, { mot: string; rang: number; quoi: string }> = {
  muet: { mot: 'Muet', rang: 0, quoi: 'Le calendrier n’a pas répondu à la dernière lecture.' },
  vide: { mot: 'Aucune réservation', rang: 1, quoi: 'Le flux répond, mais ne porte aucune nuit sur la période.' },
  plein: { mot: 'Complet', rang: 2, quoi: 'Presque aucune nuit libre sur la période.' },
  ok: { mot: 'Normal', rang: 3, quoi: '' },
};

/** Presque plus une nuit libre : le calendrier est bloqué plutôt que vendu. */
export const SEUIL_PLEIN = 0.95;

export type LigneIcal = { connu: boolean; occupes: number; total: number };

/**
 * Le verdict sur un calendrier.
 *
 * L'ordre des tests est l'ordre de gravité, et il n'est pas indifférent : un
 * calendrier muet ne porte aucune nuit, et l'annoncer « sans réservation »
 * ferait chercher une réservation manquante là où c'est la lecture qui a
 * échoué. Ne pas savoir et savoir qu'il n'y a rien sont deux nouvelles
 * différentes.
 */
export function etatIcal(l: LigneIcal): EtatIcal {
  if (!l.connu) return 'muet';
  if (l.occupes === 0) return 'vide';
  if (l.total > 0 && l.occupes / l.total > SEUIL_PLEIN) return 'plein';
  return 'ok';
}

/** Les anomalies d'abord : cette page se lit du haut, et ce qui appelle une action passe devant. */
export function parGraviteIcal<T extends { etat: EtatIcal; nom: string }>(a: T, b: T): number {
  return ETATS_ICAL[a.etat].rang - ETATS_ICAL[b.etat].rang || a.nom.localeCompare(b.nom, 'fr');
}
