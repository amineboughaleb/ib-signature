'use client';

import { useRef, useState } from 'react';

/**
 * Les photographies dans la vignette d'un logement.
 *
 * Une seule image par carte obligeait à ouvrir la fiche pour savoir de quoi
 * l'on parle, puis à revenir. Sur une liste de vingt-quatre logements, cela
 * fait quarante-huit pages chargées pour en retenir trois.
 *
 * Le défilement est natif : une bande qui glisse horizontalement, avec un
 * accrochage par image. Le doigt fonctionne donc sans une ligne de code, sur
 * un téléphone comme sur un pavé tactile, et le lien qui entoure la carte
 * reste cliquable - un glissement n'est pas un clic.
 *
 * Les flèches, elles, doivent arrêter net l'événement : un clic sur « suivant »
 * à l'intérieur d'un lien ouvrirait la fiche, ce qui est exactement ce qu'on
 * cherchait à éviter.
 */
export default function VignettePhotos({ photos, nom }: { photos: string[]; nom: string }) {
  const [i, setI] = useState(0);
  const bande = useRef<HTMLDivElement>(null);

  /* Six au plus : au-delà, la vignette devient une fiche, et la fiche n'a plus
     de raison d'être. */
  const liste = photos.slice(0, 6);
  const n = liste.length;

  function aller(e: React.MouseEvent, vers: number) {
    e.preventDefault();
    e.stopPropagation();
    const k = (vers + n) % n;
    setI(k);
    const b = bande.current;
    if (b) b.scrollTo({ left: b.clientWidth * k, behavior: 'smooth' });
  }

  return (
    <div className="bien-image">
      <div
        className="bien-bande"
        ref={bande}
        onScroll={(e) => {
          const b = e.currentTarget;
          const k = Math.round(b.scrollLeft / Math.max(1, b.clientWidth));
          if (k !== i) setI(k);
        }}
      >
        {liste.map((u, k) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img key={u} src={u} alt={k === 0 ? nom : ''} loading={k === 0 ? 'lazy' : 'lazy'} />
        ))}
      </div>

      {n > 1 && (
        <>
          <button type="button" className="bien-nav bien-avant" onClick={(e) => aller(e, i - 1)} aria-label="Précédente">
            ‹
          </button>
          <button type="button" className="bien-nav bien-apres" onClick={(e) => aller(e, i + 1)} aria-label="Suivante">
            ›
          </button>
          <span className="bien-points" aria-hidden="true">
            {liste.map((u, k) => (
              <i key={u} className={k === i ? 'on' : undefined} />
            ))}
          </span>
        </>
      )}
    </div>
  );
}
