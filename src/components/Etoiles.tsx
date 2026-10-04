/**
 * Cinq étoiles, pleines ou creuses.
 *
 * Dessinées à l'encre, comme le reste : la charte n'a pas de couleur d'accent
 * et une rangée d'étoiles jaunes aurait été la seule tache de couleur du site
 * qui ne vienne pas d'une photographie.
 *
 * Le texte lu par un lecteur d'écran est la note, pas « étoile étoile
 * étoile » : les cinq dessins sont masqués et l'étiquette dit le chiffre.
 */
export default function Etoiles({ note, libelle, taille = 15 }: { note: number; libelle: string; taille?: number }) {
  const pleines = Math.max(0, Math.min(5, Math.round(note)));
  return (
    <span className="etoiles" role="img" aria-label={libelle}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 24 24"
          width={taille}
          height={taille}
          aria-hidden="true"
          className={n <= pleines ? 'etoile pleine' : 'etoile'}
        >
          <path d="M12 2.6l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.2 1.2-6.6L2.5 9.6l6.6-.9z" />
        </svg>
      ))}
    </span>
  );
}
