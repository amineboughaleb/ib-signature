'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Le défilement des avis voyageurs.
 *
 * Une grille de trois cartes montrait trois avis et cachait les six autres :
 * le lecteur ne savait même pas qu'ils existaient. Une bande qui défile dit le
 * contraire - il y en a d'autres, et l'on en a beaucoup.
 *
 * Le mouvement est lent, six secondes par avis. Un témoignage se lit, il ne se
 * feuillette pas : un carrousel rapide donne l'impression qu'on cherche à
 * masquer le contenu plutôt qu'à le montrer.
 *
 * Trois choses l'arrêtent, et c'est voulu. Le survol de la souris, parce qu'on
 * survole ce qu'on lit. Le focus du clavier, parce qu'un texte qui s'échappe
 * pendant qu'on le parcourt à la tabulation est intenable. Et le premier geste
 * manuel, définitivement : dès que le lecteur prend la main, la reprendre
 * serait la lui arracher.
 *
 * Enfin, rien ne bouge pour qui a demandé à son système de réduire les
 * animations. Ce réglage n'est pas une préférence esthétique - il est là pour
 * des gens que le mouvement gêne réellement.
 */
export default function AvisDefilant({ enfants }: { enfants: ReactNode[] }) {
  const n = enfants.length;
  const [i, setI] = useState(0);
  const [manuel, setManuel] = useState(false);
  const [pause, setPause] = useState(false);
  const bande = useRef<HTMLDivElement>(null);

  /* Combien de cartes tiennent de front. On le mesure plutôt que de le
     supposer : la largeur d'une carte est fixée par la feuille de style, et
     dupliquer ici les points de rupture serait s'exposer à ce que les deux
     divergent un jour. */
  const parEcran = () => {
    const b = bande.current;
    if (!b || !b.firstElementChild) return 1;
    return Math.max(1, Math.round(b.clientWidth / (b.firstElementChild as HTMLElement).clientWidth));
  };

  const aller = (k: number) => {
    const b = bande.current;
    if (!b || !b.firstElementChild) return;
    const pas = (b.firstElementChild as HTMLElement).clientWidth;
    const dernier = Math.max(0, n - parEcran());
    const cible = k > dernier ? 0 : k < 0 ? dernier : k;
    b.scrollTo({ left: pas * cible, behavior: 'smooth' });
  };

  useEffect(() => {
    if (manuel || pause) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const h = setInterval(() => aller(i + 1), 6000);
    return () => clearInterval(h);
  }, [i, manuel, pause, n]);

  const main = (k: number) => {
    setManuel(true);
    aller(k);
  };

  return (
    <div
      className="avis-defilant"
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
      onFocus={() => setPause(true)}
      onBlur={() => setPause(false)}
    >
      <div
        className="avis-bande"
        ref={bande}
        onScroll={(e) => {
          const b = e.currentTarget;
          const pas = (b.firstElementChild as HTMLElement)?.clientWidth || 1;
          const k = Math.round(b.scrollLeft / pas);
          if (k !== i) setI(k);
        }}
      >
        {enfants.map((e, k) => (
          <div className="avis-case" key={k}>
            {e}
          </div>
        ))}
      </div>

      {n > 1 && (
        <div className="avis-commandes">
          <button type="button" onClick={() => main(i - 1)} aria-label="Avis précédent">
            ‹
          </button>
          <span className="avis-points" aria-hidden="true">
            {enfants.map((_, k) => (
              <i key={k} className={k === i ? 'on' : undefined} />
            ))}
          </span>
          <button type="button" onClick={() => main(i + 1)} aria-label="Avis suivant">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
