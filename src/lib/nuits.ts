/**
 * Ce qui, dans un calendrier, peut être cliqué.
 *
 * Le calendrier de la fiche ne grisait qu'une chose : le passé. Toutes les
 * nuits vendues restaient offertes, et le refus n'arrivait qu'après le choix -
 * « ce logement est déjà réservé du 7 août au 30 septembre, choisissez d'autres
 * dates ». Le site ne promettait rien qu'il ne puisse tenir, mais il faisait
 * espérer, ce qui est une autre façon de perdre un voyageur.
 *
 * La règle est écrite ici, à part, sans React ni base de données, pour la même
 * raison que `calendrier.ts` : une règle enfouie dans un composant d'affichage
 * ne se vérifie pas. Celle-ci décide de dates réelles, elle doit pouvoir être
 * mise à l'épreuve sans navigateur.
 *
 * Tout tient à la convention hôtelière, et c'est le seul endroit où l'on se
 * trompe. Une période occupée est donnée en NUITS : `d` est la première nuit
 * prise, `f` la dernière. Le lendemain de `f` est le jour du départ - il est
 * libre, et c'est le jour où le voyageur suivant arrive. Compter ce jour-là
 * comme pris ferait perdre une nuit à chaque enchaînement, ce qui ne se voit
 * qu'en fin de mois, sur le relevé du propriétaire.
 *
 * D'où l'asymétrie entre les deux bouts du séjour, qui surprend toujours :
 * une nuit prise interdit d'ARRIVER ce jour-là, mais n'interdit pas d'en
 * PARTIR. On part le matin, avant que la nuit ne commence.
 */

/** Une période occupée, en nuits pleines, bornes incluses. */
export type Nuit = { d: string; f: string };

/** Cette nuit-là est-elle vendue ? */
export function nuitPrise(prises: Nuit[], jour: string): boolean {
  return prises.some((p) => p.d <= jour && jour <= p.f);
}

/**
 * Le départ le plus lointain possible pour une arrivée donnée.
 *
 * C'est la première nuit prise qui suit l'arrivée : on occupe tout ce qui la
 * précède, et l'on rend les clefs le matin de ce jour-là. `null` quand plus
 * rien n'est vendu ensuite - le séjour n'a alors d'autre limite que celle du
 * logement.
 *
 * Une arrivée posée sur une nuit déjà vendue ne vaut rien : plutôt que de
 * chercher une borne qui n'a pas de sens, on rend l'arrivée elle-même, ce qui
 * ne laisse aucun départ valable. L'appelant doit alors proposer de choisir
 * une autre arrivée, pas un autre départ.
 */
export function borneDepart(prises: Nuit[], arrivee: string): string | null {
  if (nuitPrise(prises, arrivee)) return arrivee;
  let borne: string | null = null;
  for (const p of prises) {
    if (p.d <= arrivee) continue;
    if (borne === null || p.d < borne) borne = p.d;
  }
  return borne;
}

/** Peut-on arriver ce jour-là ? */
export function arriveePossible(prises: Nuit[], jour: string, aujourdhui: string): boolean {
  if (jour < aujourdhui) return false;
  return !nuitPrise(prises, jour);
}

/** Peut-on partir ce jour-là, étant arrivé le jour dit ? */
export function departPossible(prises: Nuit[], arrivee: string, jour: string): boolean {
  if (jour <= arrivee) return false;
  const borne = borneDepart(prises, arrivee);
  return borne === null || jour <= borne;
}
