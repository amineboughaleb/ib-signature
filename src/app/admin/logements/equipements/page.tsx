import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { biens } from '@/lib/biens';
import { equipements } from '@/lib/db';
import { EQUIPEMENTS } from '@/lib/equipements';
import { enregistrerTousEquipementsAction } from '../../actions';

export const dynamic = 'force-dynamic';

/**
 * Les équipements, tous logements confondus.
 *
 * Vingt-quatre logements et vingt équipements font quatre cent quatre-vingts
 * cases. Cela paraît beaucoup, mais c'est la forme la plus rapide : la
 * plupart des colonnes se remplissent d'un bloc - le Wi-Fi et le ménage
 * professionnel sont partout - et l'oeil repère instantanément le trou dans
 * une colonne autrement pleine.
 *
 * D'où le bouton en tête de chaque colonne, qui coche ou décoche tout : le
 * Wi-Fi de vingt-quatre appartements se règle en un clic plutôt qu'en
 * vingt-quatre.
 */
export default async function AdminEquipements() {
  if (!(await connecte())) redirect('/admin');

  const catalogue = await biens();
  const choisis = equipements();
  const equipes = catalogue.filter((b) => (choisis.get(b.id) || []).length).length;

  return (
    <>
      <p className="fil">
        <Link href="/admin/logements">Logements</Link> · Équipements
      </p>
      <h1 style={{ marginTop: 6 }}>Équipements</h1>
      <p className="muted" style={{ marginBottom: 26, maxWidth: '72ch' }}>
        {equipes} logement(s) sur {catalogue.length} en déclarent. Lodgify ne publie pas cette information : elle
        n’existe que dans votre tête, et c’est pourtant la première chose qu’un voyageur cherche après le prix.
      </p>

      <p className="avert">
        Le titre d’une colonne coche ou décoche tout le monde : le Wi-Fi de vingt-quatre appartements se règle en un
        clic. Rien n’est enregistré tant que vous n’avez pas validé en bas de page. Un équipement absent de cette
        liste s’y ajoute en une ligne de code — dites-le-moi.
      </p>

      {catalogue.length === 0 && (
        <p className="avert">
          Aucun logement n’est chargé : la clé Lodgify n’est pas lue. L’onglet Lodgify vous dira pourquoi.
        </p>
      )}

      <form action={enregistrerTousEquipementsAction}>
        <div className="tableau-large">
          <table className="grille-cases">
            <thead>
              <tr>
                <th>Logement</th>
                {EQUIPEMENTS.map((e) => (
                  <th key={e.cle}>
                    {/* Le libellé pivoté : vingt colonnes de texte horizontal
                        feraient une page trois fois trop large. */}
                    <button type="button" className="colonne-bascule" data-eq={e.cle} title={`Tout cocher — ${e.fr}`}>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d={e.d} />
                      </svg>
                      <span>{e.fr}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catalogue.map((b) => {
                const actifs = new Set(choisis.get(b.id) || []);
                return (
                  <tr key={b.id}>
                    <th scope="row">
                      <input type="hidden" name="ligne" value={b.id} />
                      <Link href={`/admin/logements/${b.id}`}>{b.nom}</Link>
                    </th>
                    {EQUIPEMENTS.map((e) => (
                      <td key={e.cle}>
                        <input
                          type="checkbox"
                          name={`eq_${b.id}`}
                          value={e.cle}
                          data-eq={e.cle}
                          defaultChecked={actifs.has(e.cle)}
                          aria-label={`${b.nom} — ${e.fr}`}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="actions-ligne" style={{ marginTop: 22 }}>
          <button type="submit" className="btn-mini">
            Enregistrer les {catalogue.length} logements
          </button>
        </div>
      </form>

      {/* Une bascule par colonne, sans composant client : trois lignes de
          script valent mieux qu'un fichier de plus, et la page reste
          entièrement rendue par le serveur. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.querySelectorAll('.colonne-bascule').forEach((b) => {
            b.addEventListener('click', () => {
              const cases = document.querySelectorAll('td input[data-eq="' + b.dataset.eq + '"]');
              const tout = [...cases].every((c) => c.checked);
              cases.forEach((c) => { c.checked = !tout; });
            });
          });`,
        }}
      />
    </>
  );
}
