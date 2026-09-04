import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { db } from '@/lib/db';
import { restaurerAction } from '../actions';

export const dynamic = 'force-dynamic';

/**
 * Emporter la base, et la reposer.
 *
 * Deux usages, et le second est celui qui compte à long terme.
 *
 * Le premier est la mise en ligne : tout ce qui a été saisi en local -
 * vingt-quatre logements équipés, les calendriers, le RIB, les conditions -
 * doit se retrouver en production sans être ressaisi. Une heure de travail
 * évitée, et surtout aucune faute de recopie sur un RIB.
 *
 * Le second est la sauvegarde. Cette base est un fichier unique sur un volume
 * unique : pas de serveur à administrer, pas de mot de passe de plus, et
 * aucune redondance. Un volume perdu et tout est perdu. Une sauvegarde qu'on
 * prend en un clic est une sauvegarde qu'on prend ; celle qui demande une
 * ligne de commande ne se prend jamais.
 */
export default async function AdminSauvegarde({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await connecte())) redirect('/admin');
  const q = await searchParams;
  const seul = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';
  const erreur = seul(q.erreur);
  const repose = seul(q.repose) === '1';

  const compte = (t: string) => {
    try {
      return (db().prepare(`SELECT COUNT(*) n FROM ${t}`).get() as { n: number }).n;
    } catch {
      return 0;
    }
  };

  const lignes: Array<[string, number]> = [
    ['Logements renseignés', compte('liens')],
    ['Calendriers déclarés', compte('flux')],
    ['Réglages', compte('reglages')],
    ['Avis', compte('avis')],
    ['Images du diaporama', compte('diaporama')],
    ['Demandes de virement', compte('virements')],
    ['Demandes de propriétaires', compte('audits')],
    ['Messages reçus', compte('messages')],
  ];

  return (
    <>
      <h1>Sauvegarde</h1>

      {repose && (
        <p className="avert" style={{ borderColor: 'var(--accent)' }}>
          <strong>La base a été reposée.</strong> Vérifiez la liste ci-dessous : elle doit correspondre à ce que vous
          attendiez. L’ancienne base est gardée à côté, datée, sur le même volume.
        </p>
      )}
      {erreur && (
        <p className="avert">
          <strong>Rien n’a été remplacé.</strong>{' '}
          {erreur === 'confirmation'
            ? 'Le mot de confirmation ne correspond pas.'
            : erreur === 'fichier'
              ? 'Aucun fichier n’a été déposé.'
              : erreur === 'taille'
                ? 'Le fichier dépasse cent mégaoctets : ce n’est pas une base de ce site.'
                : erreur}
        </p>
      )}
      <p className="muted" style={{ marginBottom: 26, maxWidth: '70ch' }}>
        Tout ce que ce site détient tient dans un seul fichier, sur un seul volume. C’est ce qui le rend simple à
        héberger, et c’est ce qui le rend fragile.
      </p>

      <article className="boite">
        <div className="boite-tete">
          <span className="fiche-titre">Ce que contient la base</span>
          <span className="fiche-meta">{lignes.reduce((n, [, v]) => n + v, 0)} enregistrement(s)</span>
        </div>
        <table className="table-legal">
          <tbody>
            {lignes.map(([nom, n]) => (
              <tr key={nom}>
                <td>{nom}</td>
                <td>{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="boite">
        <div className="boite-tete">
          <span className="fiche-titre">Emporter une copie</span>
        </div>
        <p className="corps">
          Le fichier est reversé avant d’être copié — ce détail n’en est pas un. SQLite écrit d’abord dans un fichier
          d’attente et ne le reverse dans le fichier principal que de temps en temps : copier le fichier à la main,
          depuis l’explorateur, donne une base amputée de tout ce qui est récent, <strong>sans la moindre erreur pour
          le signaler</strong>. Passez toujours par ce bouton.
        </p>
        <p className="avert">
          Cette copie porte les noms, téléphones et courriels de vos voyageurs, ainsi que vos coordonnées bancaires.
          Elle se range comme un document comptable, pas comme un fichier de travail.
        </p>
        <p style={{ marginTop: 18 }}>
          <a className="btn btn-mini" href="/admin/api/sauvegarde">
            Télécharger la base
          </a>
        </p>
      </article>

      <article className="boite">
        <div className="boite-tete">
          <span className="fiche-titre">Reposer une base</span>
          <span className="fiche-meta">irréversible</span>
        </div>
        <p className="corps">
          Le fichier déposé <strong>remplace</strong> la base actuelle. C’est ce qui permet de porter en ligne ce qui a
          été saisi sur votre machine, sans rien ressaisir. La base remplacée n’est pas effacée pour autant : elle est
          gardée à côté, datée, sur le même volume.
        </p>
        <form action={restaurerAction} encType="multipart/form-data">
          <div className="grille-champs">
            <div className="field pleine">
              <label htmlFor="fichier">Le fichier .db à reposer</label>
              <input id="fichier" name="fichier" type="file" accept=".db,application/octet-stream" required />
            </div>
            <div className="field pleine">
              <label htmlFor="confirmation">
                Écrivez <code>REMPLACER</code> pour confirmer
              </label>
              <input id="confirmation" name="confirmation" type="text" autoComplete="off" required />
            </div>
          </div>
          <p className="hint" style={{ marginBottom: 14 }}>
            Le mot à recopier n’est pas une formalité : c’est le seul geste de cette administration qui efface d’un
            coup tout ce qui a été saisi, et un bouton seul se clique par mégarde.
          </p>
          <button type="submit" className="btn btn-mini">
            Reposer cette base
          </button>
        </form>
      </article>
    </>
  );
}
