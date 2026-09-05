import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Le filtre des actions de serveur.
 *
 * Quelques heures après la mise en ligne, le journal du serveur s'est rempli
 * de la même erreur, des milliers de fois :
 *
 *     The Server Reference ID did not match the expected format.
 *     Received "x" / "0" / "1" / "action"
 *
 * Ce ne sont pas des visiteurs. C'est un robot qui balaie le web à la
 * recherche de sites en Next.js, et qui envoie au hasard un en-tête
 * `Next-Action` contenant « x », « 0 », « 1 », « action » - la même série,
 * en boucle. Il cherche une faille connue dans la façon dont Next résout les
 * actions de serveur. Il n'y en a pas ici : la requête échoue, rien n'est
 * exécuté, rien n'est écrit.
 *
 * Mais échouer coûte. Chaque tentative traverse le routeur, atteint la page,
 * lève une exception et laisse une trace. À raison de plusieurs par seconde,
 * cela suffit à saturer la mémoire d'un petit conteneur - et l'hébergeur
 * finit par le redémarrer, ce qui est très exactement le symptôme observé :
 * des courriels « Deploy Crashed » en série, sur un site qui n'a pourtant
 * aucun défaut.
 *
 * On arrête donc ces requêtes avant qu'elles n'entrent. Un identifiant
 * d'action légitime est une empreinte : quarante-deux caractères
 * hexadécimaux, générés à la construction. Tout ce qui n'a pas cette forme
 * n'a pas pu être fabriqué par ce site, et se voit refusé en une ligne, sans
 * exception, sans trace, sans coût.
 *
 * Le contrôle est volontairement grossier - une longueur et un alphabet. Il
 * n'a pas à savoir quelles actions existent : cela, Next le vérifie ensuite,
 * et mieux que nous. Il n'écarte que ce qui ne ressemble à rien.
 */

/* Les identifiants produits par la construction font quarante-deux caractères
   hexadécimaux. La fourchette est large à dessein : une version de Next qui
   changerait la longueur de son empreinte ne doit pas mettre le site à terre
   du jour au lendemain. */
const EMPREINTE = /^[0-9a-f]{20,128}$/i;

export function middleware(requete: NextRequest) {
  const action = requete.headers.get('next-action');
  /* Absence d'en-tête : une navigation ordinaire, on ne s'en mêle pas. */
  if (action === null) return NextResponse.next();
  if (EMPREINTE.test(action.trim())) return NextResponse.next();
  /* 400 et rien d'autre : pas de page d'erreur à composer, pas de corps à
     écrire. Un robot n'a pas besoin d'explication, et lui en donner une
     coûterait précisément ce qu'on cherche à économiser. */
  return new NextResponse(null, { status: 400 });
}

/* Inutile de filtrer ce qui ne peut pas porter d'action de serveur : les
   fichiers statiques, les photographies, les images déposées. */
export const config = {
  matcher: ['/((?!_next/static|_next/image|photos/|media/|favicon.ico|robots.txt|sitemap.xml).*)'],
};
