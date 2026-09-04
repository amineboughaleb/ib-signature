'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Un avis coupé à quatre lignes, dépliable.
 *
 * Les commentaires de voyageurs sont de longueurs très inégales : trois mots
 * chez l'un, quinze lignes chez l'autre. Alignées, ces cartes prenaient la
 * hauteur du plus bavard, et l'oeil ne voyait plus qu'un mur de texte.
 *
 * Quatre lignes suffisent à donner le ton et à décider si l'on veut la suite.
 *
 * Le bouton n'apparaît que si le texte est réellement coupé. C'est tout
 * l'intérêt de le mesurer plutôt que de compter les caractères : une phrase de
 * deux cents signes tient en trois lignes sur un grand écran et en six sur un
 * téléphone, et proposer « lire la suite » sous un texte entièrement visible
 * est le genre de détail qui décrédibilise le reste de la page.
 *
 * La mesure se refait au redimensionnement, pour la même raison.
 */
export default function TexteReplie({
  texte,
  plus,
  moins,
}: {
  texte: string;
  plus: string;
  moins: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [coupe, setCoupe] = useState(false);
  const bloc = useRef<HTMLQuoteElement>(null);

  useEffect(() => {
    const mesurer = () => {
      const e = bloc.current;
      if (!e) return;
      /* On mesure toujours à l'état replié : une fois déplié, le texte tient
         forcément, et la question n'est plus de savoir s'il débordait. */
      if (ouvert) return;
      setCoupe(e.scrollHeight > e.clientHeight + 2);
    };
    mesurer();
    window.addEventListener('resize', mesurer);
    return () => window.removeEventListener('resize', mesurer);
  }, [texte, ouvert]);

  return (
    <>
      <blockquote ref={bloc} className={ouvert ? 'avis-texte ouvert' : 'avis-texte'}>
        {texte}
      </blockquote>
      {(coupe || ouvert) && (
        <button type="button" className="avis-plus" onClick={() => setOuvert((v) => !v)}>
          {ouvert ? `− ${moins}` : `+ ${plus}`}
        </button>
      )}
    </>
  );
}
