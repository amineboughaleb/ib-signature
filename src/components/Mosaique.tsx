'use client';

import { useEffect, useState } from 'react';

/**
 * Les photographies en tête d'une fiche.
 *
 * Cinq images visibles d'emblée : une grande à gauche, quatre autour. C'est la
 * disposition qu'un voyageur connaît par coeur pour l'avoir vue partout, et ce
 * n'est pas une raison de s'en écarter - une page de logement n'est pas
 * l'endroit où surprendre. La grande porte la promesse, les quatre autres
 * disent qu'il y a autre chose à voir.
 *
 * Elle s'adapte au nombre réel de photographies plutôt que de laisser des
 * cadres vides : un rectangle gris au milieu d'une mosaïque ressemble à une
 * panne, jamais à un choix. À une seule image, elle occupe toute la largeur ;
 * à deux, elles se partagent l'espace ; au-delà, la mosaïque se remplit.
 *
 * Un clic ouvre la visionneuse, où l'on parcourt la galerie entière au clavier
 * comme au doigt. Sur téléphone, la mosaïque n'a pas de sens - cinq images sur
 * 390 points ne se regardent pas - et laisse la place à un défilement.
 */
export default function Mosaique({ photos, nom }: { photos: string[]; nom: string }) {
  const [ouvert, setOuvert] = useState<number | null>(null);
  const n = photos.length;

  useEffect(() => {
    if (ouvert === null) return;
    const touche = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(null);
      if (e.key === 'ArrowRight') setOuvert((i) => (i === null ? null : (i + 1) % n));
      if (e.key === 'ArrowLeft') setOuvert((i) => (i === null ? null : (i - 1 + n) % n));
    };
    /* La page ne défile pas derrière la visionneuse : rien n'est plus
       déroutant qu'un fond qui bouge sous une image qu'on regarde. */
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', touche);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', touche);
    };
  }, [ouvert, n]);

  if (!n) return null;

  const visibles = photos.slice(0, 5);

  return (
    <>
      <section className={`wrap mosaique mosaique-${Math.min(n, 5)}`}>
        {visibles.map((u, i) => (
          <button
            key={u}
            type="button"
            className={i === 0 ? 'mosaique-grande' : undefined}
            onClick={() => setOuvert(i)}
            aria-label={`${nom} — photographie ${i + 1} sur ${n}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" loading={i === 0 ? 'eager' : 'lazy'} />
          </button>
        ))}
        {n > 1 && (
          <button type="button" className="mosaique-toutes" onClick={() => setOuvert(0)}>
            {n} photographies
          </button>
        )}
      </section>

      {ouvert !== null && (
        <div className="visionneuse" role="dialog" aria-modal="true" aria-label={nom}>
          <button type="button" className="vis-fermer" onClick={() => setOuvert(null)} aria-label="Fermer">
            ✕
          </button>
          <span className="vis-compte">
            {ouvert + 1} / {n}
          </span>
          <button
            type="button"
            className="vis-nav vis-avant"
            onClick={() => setOuvert((i) => (i === null ? null : (i - 1 + n) % n))}
            aria-label="Photographie précédente"
          >
            ‹
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[ouvert]} alt={`${nom} — ${ouvert + 1}`} />
          <button
            type="button"
            className="vis-nav vis-apres"
            onClick={() => setOuvert((i) => (i === null ? null : (i + 1) % n))}
            aria-label="Photographie suivante"
          >
            ›
          </button>
          {/* Le fond ferme la visionneuse : c'est le geste qu'on tente
              d'instinct, et le refuser oblige à chercher la croix. */}
          <button type="button" className="vis-fond" onClick={() => setOuvert(null)} aria-hidden="true" tabIndex={-1} />
        </div>
      )}
    </>
  );
}
