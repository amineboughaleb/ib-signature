/**
 * Les notes des voyageurs, logement par logement.
 *
 * Une moyenne ne vaut que par ce qu'elle compte. Celle-ci ne compte que les
 * avis publiés qui portent une note, c'est-à-dire ceux qu'un voyageur a
 * déposés lui-même après son séjour. Les commentaires recopiés d'Airbnb ou de
 * Booking n'en ont pas : leur en prêter une reviendrait à inventer un chiffre.
 *
 * Ce fichier ne lit que la base. Il ne touche ni au catalogue ni à Lodgify,
 * pour qu'une carte de logement puisse afficher sa note sans attendre
 * personne.
 */

import { listerAvis } from './db';

export type Note = { moyenne: number; nombre: number };

export function notesParBien(): Map<string, Note> {
  const sommes = new Map<string, { total: number; nombre: number }>();
  for (const a of listerAvis(true)) {
    if (!a.bien_slug || !(a.note >= 1 && a.note <= 5)) continue;
    const s = sommes.get(a.bien_slug) || { total: 0, nombre: 0 };
    s.total += a.note;
    s.nombre += 1;
    sommes.set(a.bien_slug, s);
  }
  const notes = new Map<string, Note>();
  for (const [slug, s] of sommes) notes.set(slug, { moyenne: s.total / s.nombre, nombre: s.nombre });
  return notes;
}

export function noteDuBien(slug: string): Note | undefined {
  return notesParBien().get(slug);
}

/** « 4,8 » en français, « 4.8 » en anglais. Toujours une décimale : 5 s'écrit 5,0. */
export function ecrireNote(moyenne: number, locale: string): string {
  return moyenne.toLocaleString(locale === 'en' ? 'en-GB' : 'fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}
