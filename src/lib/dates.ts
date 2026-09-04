/** Les dates, au format ISO et rien d'autre. */
export const estISO = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/**
 * Le nombre de nuits entre deux dates.
 *
 * Zéro quand l'une manque, quand elles sont mal formées, ou quand le départ ne
 * suit pas l'arrivée : on préfère ne rien afficher qu'afficher un nombre faux,
 * et surtout qu'un nombre négatif.
 */
export function nuitsEntre(arrivee: string, depart: string): number {
  if (!estISO(arrivee) || !estISO(depart)) return 0;
  const a = Date.parse(`${arrivee}T00:00:00Z`);
  const d = Date.parse(`${depart}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(d) || d <= a) return 0;
  return Math.round((d - a) / 86400000);
}

/** Une date lisible, dans la langue de la page. */
export function formatDate(iso: string, locale: string): string {
  if (!estISO(iso)) return '';
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
