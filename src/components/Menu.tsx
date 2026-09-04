'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LOCALES } from '@/lib/i18n';
import { navigation } from '@/lib/navigation';
import { MARQUE } from '@/lib/marque';

/**
 * Le menu des petits écrans.
 *
 * Le nom, trois liens et le sélecteur de langue ne tiennent pas dans 390 points.
 * Rogner serait le mauvais réflexe : le lien qu'on sacrifierait en premier est
 * « Propriétaires », c'est-à-dire le visiteur le plus précieux du site. Un
 * propriétaire qui hésite consulte souvent depuis son téléphone.
 *
 * D'où un vrai dépliant : le bouton ouvre un panneau plein écran, la langue y
 * figure, et la touche Échap le referme. Sur grand écran, le composant ne rend
 * rien - la barre horizontale suffit et reste plus rapide d'un clic.
 */
export default function Menu({ locale, path = '' }: { locale: string; path?: string }) {
  const [ouvert, setOuvert] = useState(false);

  useEffect(() => {
    const echap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false);
    };
    /* Le fond ne défile pas derrière le panneau : rien n'est plus déroutant
       qu'une page qui bouge sous un menu ouvert. */
    document.body.style.overflow = ouvert ? 'hidden' : '';
    window.addEventListener('keydown', echap);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', echap);
    };
  }, [ouvert]);

  const liens = navigation(locale);

  return (
    <>
      <button
        type="button"
        className="menu-bouton"
        aria-expanded={ouvert}
        aria-label={ouvert ? 'Fermer' : 'Menu'}
        onClick={() => setOuvert((v) => !v)}
      >
        <span className={ouvert ? 'barres ouvertes' : 'barres'} aria-hidden="true">
          <i />
          <i />
        </span>
      </button>

      {ouvert && (
        <div className="menu-panneau" role="dialog" aria-modal="true">
          <nav>
            {liens.map((x) => (
              <Link key={x.h} href={x.h} onClick={() => setOuvert(false)}>
                {x.l}
              </Link>
            ))}
          </nav>
          <div className="menu-pied">
            <span className="switch">
              {LOCALES.map((l) => (
                <Link key={l} href={`/${l}${path}`} className={locale === l ? 'on' : ''} hrefLang={l} onClick={() => setOuvert(false)}>
                  {l.toUpperCase()}
                </Link>
              ))}
            </span>
            <a href={`tel:${MARQUE.telephoneLien}`} className="small muted">
              {MARQUE.telephone}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
