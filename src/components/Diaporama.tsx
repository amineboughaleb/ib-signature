'use client';

import { useEffect, useState } from 'react';

/**
 * Le diaporama de l'accueil.
 *
 * Le fondu est piloté en JavaScript plutôt qu'en @keyframes : le rythme dépend
 * du nombre de photos, et une animation CSS demanderait un jeu d'images-clés
 * par cardinalité. Il s'arrête quand l'onglet passe en arrière-plan - une page
 * qu'on ne regarde pas n'a aucune raison de faire tourner un minuteur - et ne
 * tourne pas du tout si le visiteur a demandé moins d'animations.
 *
 * Sans photo, le composant ne rend rien : c'est la trame Art déco tracée en CSS
 * qui reste visible dessous. La page ne change pas de forme selon que Lodgify
 * répond ou non.
 */
export default function Diaporama({
  photos,
  alt,
  intervalMs = 6500,
}: {
  photos: string[];
  alt: string;
  intervalMs?: number;
}) {
  const [i, setI] = useState(0);
  const [immobile, setImmobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const appliquer = () => setImmobile(mq.matches);
    appliquer();
    mq.addEventListener('change', appliquer);
    return () => mq.removeEventListener('change', appliquer);
  }, []);

  useEffect(() => {
    if (immobile || photos.length < 2) return;
    let minuteur: ReturnType<typeof setInterval>;
    const suivante = () => setI((n) => (n + 1) % photos.length);
    const demarrer = () => {
      clearInterval(minuteur);
      minuteur = setInterval(suivante, intervalMs);
    };
    const visibilite = () => (document.hidden ? clearInterval(minuteur) : demarrer());

    demarrer();
    document.addEventListener('visibilitychange', visibilite);
    return () => {
      clearInterval(minuteur);
      document.removeEventListener('visibilitychange', visibilite);
    };
  }, [photos.length, intervalMs, immobile]);

  if (!photos.length) return null;

  return (
    <>
      {/* Les images sont décoratives : le texte de l'accroche dit déjà tout ce
          qu'un lecteur d'écran doit entendre. Les pastilles, elles, sont de
          vrais boutons, et restent donc hors de la zone masquée. */}
      <div className="diapo" aria-hidden="true">
        {photos.map((src, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src + k}
            src={src}
            alt={alt}
            className={k === i ? 'on' : ''}
            loading={k === 0 ? 'eager' : 'lazy'}
            fetchPriority={k === 0 ? 'high' : 'auto'}
          />
        ))}
      </div>

      {photos.length > 1 && (
        <div className="diapo-points">
          {photos.map((src, k) => (
            <button
              key={`p${src}${k}`}
              type="button"
              className={k === i ? 'on' : ''}
              aria-label={`Photo ${k + 1}`}
              aria-current={k === i}
              onClick={() => setI(k)}
            />
          ))}
        </div>
      )}
    </>
  );
}
