import { Fragment } from 'react';

/**
 * Un texte saisi, rendu tel qu'il a été écrit.
 *
 * Le HTML ignore les sauts de ligne : un texte tapé sur cinq paragraphes
 * arrivait à l'écran en un seul bloc compact. C'est le genre de trahison qui
 * décourage d'écrire - on soigne sa mise en page, et le site l'aplatit.
 *
 * Deux règles, celles que tout le monde a en tête sans les formuler : une ligne
 * vide sépare deux paragraphes, un simple retour à la ligne reste un retour à
 * la ligne. C'est ainsi qu'on écrit dans un courriel, et c'est donc ainsi qu'on
 * écrit dans un champ de saisie.
 *
 * Le texte n'est jamais interprété comme du HTML. Il vient de
 * l'administration ou de Lodgify - deux sources de confiance, mais la
 * confiance n'est pas une raison d'ouvrir une porte : une balise collée dans un
 * champ de texte doit s'afficher comme du texte, pas s'exécuter.
 */
export default function Texte({ contenu, className = 'lead' }: { contenu: string; className?: string }) {
  const paragraphes = contenu
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (!paragraphes.length) return null;

  return (
    <>
      {paragraphes.map((p, i) => (
        <p className={className} key={i}>
          {p.split(/\r?\n/).map((ligne, k, tout) => (
            <Fragment key={k}>
              {ligne}
              {k < tout.length - 1 && <br />}
            </Fragment>
          ))}
        </p>
      ))}
    </>
  );
}
