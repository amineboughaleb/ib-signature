/**
 * Effacer, en deux clics.
 *
 * Le premier ouvre, le second efface. Pas de fenêtre de confirmation du
 * navigateur : elle se valide d'un réflexe, et certains navigateurs proposent
 * de ne plus l'afficher. Ici le second bouton apparaît à côté du premier, avec
 * ce qui va disparaître écrit en toutes lettres.
 *
 * Tout tient dans un `details` : aucun script, donc rien qui puisse ne pas
 * charger.
 */
export default function Effacer({
  action,
  id,
  quoi,
}: {
  action: (form: FormData) => Promise<void>;
  id: number;
  quoi: string;
}) {
  return (
    <details className="effacer">
      <summary className="btn-mini danger">Effacer</summary>
      <form action={action} className="effacer-confirmer">
        <input type="hidden" name="id" value={id} />
        <span className="small muted">Effacer {quoi} ? C’est définitif.</span>
        <button type="submit" className="btn-mini danger">
          Oui, effacer
        </button>
      </form>
    </details>
  );
}
