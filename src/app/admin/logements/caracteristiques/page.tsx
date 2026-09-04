import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { biens } from '@/lib/biens';
import { tousLesFaits } from '@/lib/db';
import { enregistrerToutesCaracteristiquesAction } from '../../actions';

export const dynamic = 'force-dynamic';

type Colonne = { n: string; l: string; large?: boolean };

const COLONNES: Colonne[] = [
  { n: 'f_quartier', l: 'Quartier', large: true },
  { n: 'f_voyageurs', l: 'Voyageurs' },
  { n: 'f_chambres', l: 'Chambres' },
  { n: 'f_lits', l: 'Lits' },
  { n: 'f_canapes', l: 'Canapés-lits' },
  { n: 'f_bains', l: 'Salles de bain' },
  { n: 'f_eau', l: 'Salles d’eau / WC' },
  { n: 'f_surface', l: 'm²' },
  { n: 'f_sejour_min', l: 'Min. nuits' },
];

/**
 * Toutes les caractéristiques, sur une page.
 *
 * Lodgify annonce les chambres et la capacité. Il ne dit ni les lits, ni les
 * salles d'eau, ni la surface, ni même le quartier - « Casablanca » tout seul
 * ne dit rien à qui cherche le Triangle d'Or. Ces valeurs-là, personne d'autre
 * que vous ne les connaît, et l'encadré d'une fiche reste maigre tant qu'elles
 * manquent.
 *
 * Les saisir logement par logement ferait vingt-quatre pages à traverser. Elles
 * tiennent donc ici, en un tableau, avec un seul bouton. Chaque case vide
 * affiche en gris ce que Lodgify dit déjà : ce qui est en gris n'a pas besoin
 * d'être recopié.
 */
export default async function AdminCaracteristiques() {
  if (!(await connecte())) redirect('/admin');

  const catalogue = await biens();
  const faits = tousLesFaits();
  const complets = catalogue.filter((b) => b.lits && b.bains && b.surface).length;

  return (
    <>
      <p className="fil">
        <Link href="/admin/logements">Logements</Link> · Caractéristiques
      </p>
      <h1 style={{ marginTop: 6 }}>Caractéristiques</h1>
      <p className="muted" style={{ marginBottom: 26, maxWidth: '72ch' }}>
        {complets} logement(s) sur {catalogue.length} ont un encadré complet. Lodgify annonce les chambres et la
        capacité ; les lits, les pièces d’eau, la surface et le quartier n’existent que dans votre tête — et un
        encadré à une seule ligne ne donne envie de rien.
      </p>

      <p className="avert">
        Ce qui s’affiche en gris dans une case vient de Lodgify : inutile de le recopier. Ce que vous écrivez passe
        devant, et une case laissée vide rend simplement la main. Rien n’apparaît sur une fiche tant que personne ne
        l’a renseigné — mieux vaut une ligne manquante qu’une salle de bain inventée.
      </p>

      <p className="avert">
        Trois distinctions valent d’être tenues, parce qu’un voyageur les fait. Le <strong>canapé-lit</strong> se
        compte à part des lits : annoncer « 4 lits » quand deux sont dans le salon est exact et donne pourtant le
        sentiment d’avoir été trompé. La <strong>salle de bain</strong> a une baignoire ; la{' '}
        <strong>salle d’eau</strong> une douche, et souvent le WC. Promettre un bain à qui n’aura qu’une douche est
        la déception la plus banale de la location courte durée — et la plus évitable.
      </p>

      {catalogue.length === 0 && (
        <p className="avert">
          Aucun logement n’est chargé : la clé Lodgify n’est pas lue. L’onglet Lodgify vous dira pourquoi.
        </p>
      )}

      <form action={enregistrerToutesCaracteristiquesAction}>
        <div className="tableau-large">
          <table className="grille-saisie">
            <thead>
              <tr>
                <th>Logement</th>
                {COLONNES.map((c) => (
                  <th key={c.n}>{c.l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {catalogue.map((b) => {
                const f = faits.get(b.id);
                /* Ce que Lodgify dit, montré en gris dans la case vide : le
                   propriétaire voit d'un coup d'oeil ce qui reste à écrire. */
                const lu: Record<string, string | number | undefined> = {
                  f_quartier: b.quartier,
                  f_voyageurs: b.voyageurs,
                  f_chambres: b.chambres,
                  f_lits: b.lits,
                  f_canapes: undefined,
                  f_bains: b.bains,
                  f_eau: undefined,
                  f_surface: b.surface,
                  f_sejour_min: undefined,
                };
                return (
                  <tr key={b.id}>
                    <th scope="row">
                      <Link href={`/admin/logements/${b.id}`}>{b.nom}</Link>
                      <span className="small muted">{b.ville}</span>
                    </th>
                    {COLONNES.map((c) => (
                      <td key={c.n} className={c.large ? 'large' : undefined}>
                        <input
                          name={`${c.n}_${b.id}`}
                          type={c.large ? 'text' : 'number'}
                          min={0}
                          defaultValue={(f?.[c.n.slice(2) as keyof typeof f] as string | number) || ''}
                          placeholder={lu[c.n] ? String(lu[c.n]) : '—'}
                          aria-label={`${b.nom} — ${c.l}`}
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
    </>
  );
}
