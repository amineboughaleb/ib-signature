'use client';

import { useRef, useState } from 'react';

/**
 * L'ordre des logements sur le site, et ce qu'on montre.
 *
 * Trois décisions tiennent sur la même liste, parce qu'elles se prennent en même
 * temps : on range, on met en avant, on retire. Les séparer en trois écrans
 * obligerait à traverser trois pages pour préparer une saison.
 *
 * Deux gestes pour ranger, et ce n'est pas une redondance. Le glisser-déposer
 * est naturel à la souris et illisible au doigt ; les flèches marchent partout,
 * y compris au clavier et pour qui lit la page à voix haute. Chaque ligne porte
 * donc les deux, comme l'éditeur de galeries.
 *
 * Rien n'est enregistré tant que vous n'avez pas cliqué. On peut essayer un
 * ordre, en changer, revenir - et fermer la page sans rien avoir changé au site.
 *
 * Retirer n'est pas supprimer. Le logement quitte le site, reste chez Lodgify,
 * et revient d'un clic. C'est ce qu'on veut pour un appartement en travaux ou
 * repris quelques mois par son propriétaire - pas une suppression qu'il faudrait
 * défaire en ressaisissant des textes et des photographies.
 */

export type LigneVitrine = {
  id: number;
  nom: string;
  ville: string;
  quartier: string;
  photo?: string;
  avant: boolean;
  masque: boolean;
};

export default function OrdreLogements({
  initial,
  action,
}: {
  initial: LigneVitrine[];
  action: (form: FormData) => void;
}) {
  const [lignes, setLignes] = useState<LigneVitrine[]>(initial);
  const [touche, setTouche] = useState(false);
  const attrape = useRef<number | null>(null);

  function deplacer(de: number, vers: number) {
    if (de === vers || vers < 0 || vers >= lignes.length) return;
    const copie = [...lignes];
    const [x] = copie.splice(de, 1);
    copie.splice(vers, 0, x);
    setLignes(copie);
    setTouche(true);
  }

  function basculer(id: number, quoi: 'avant' | 'masque') {
    setLignes((l) => l.map((x) => (x.id === id ? { ...x, [quoi]: !x[quoi] } : x)));
    setTouche(true);
  }

  const visibles = lignes.filter((l) => !l.masque).length;

  return (
    <form action={action} className="ordre">
      {/* Les trois champs que lit le serveur. Le rang n'y figure pas : il se
          déduit de la position, et un rang envoyé par le navigateur serait un
          rang qu'on peut falsifier ou dupliquer. */}
      <input type="hidden" name="ordre" value={lignes.map((l) => l.id).join(',')} />
      <input
        type="hidden"
        name="avant"
        value={lignes.filter((l) => l.avant).map((l) => l.id).join(',')}
      />
      <input
        type="hidden"
        name="masques"
        value={lignes.filter((l) => l.masque).map((l) => l.id).join(',')}
      />

      <ol className="ordre-liste">
        {lignes.map((l, i) => (
          <li
            key={l.id}
            className={`ordre-ligne${l.masque ? ' ordre-masque' : ''}`}
            draggable
            onDragStart={() => {
              attrape.current = i;
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (attrape.current !== null) deplacer(attrape.current, i);
              attrape.current = null;
            }}
          >
            <span className="ordre-n" aria-hidden="true">
              {l.masque ? '—' : lignes.slice(0, i + 1).filter((x) => !x.masque).length}
            </span>

            {l.photo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img className="ordre-vignette" src={l.photo} alt="" loading="lazy" />
            ) : (
              <span className="ordre-vignette ordre-vignette-vide" aria-hidden="true" />
            )}

            <span className="ordre-nom">
              <strong>{l.nom}</strong>
              <span className="muted small">{[l.quartier, l.ville].filter(Boolean).join(', ')}</span>
            </span>

            <span className="ordre-marques">
              <label>
                <input type="checkbox" checked={l.avant} onChange={() => basculer(l.id, 'avant')} />
                En avant
              </label>
              <label>
                <input type="checkbox" checked={l.masque} onChange={() => basculer(l.id, 'masque')} />
                Retiré du site
              </label>
            </span>

            <span className="ordre-fleches">
              <button
                type="button"
                onClick={() => deplacer(i, i - 1)}
                disabled={i === 0}
                aria-label={`Monter ${l.nom}`}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => deplacer(i, i + 1)}
                disabled={i === lignes.length - 1}
                aria-label={`Descendre ${l.nom}`}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>

      <div className="ordre-pied">
        <span className="muted small">
          {visibles} logement(s) affiché(s) sur {lignes.length}
          {touche ? ' · modifications non enregistrées' : ''}
        </span>
        <button type="submit" className="btn" disabled={!touche}>
          Enregistrer l’ordre
        </button>
      </div>
    </form>
  );
}
