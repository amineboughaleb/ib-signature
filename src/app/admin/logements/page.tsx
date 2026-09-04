import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { biens } from '@/lib/biens';
import { galeriesCompletes } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Les logements, vus de haut.
 *
 * Un onglet par dimension - les photos ici, les adresses là, les textes
 * ailleurs - obligeait à traverser trois pages pour s'occuper d'un seul
 * appartement. Or on ne travaille pas sur « les photographies », on travaille
 * sur Number Six. Tout ce qui concerne un logement tient donc sur sa page, et
 * cette grille ne sert qu'à choisir lequel.
 *
 * Vingt-quatre logements et dix-huit photographies chacun font quatre cent
 * trente-deux images : les afficher toutes ici rendrait la page lente pour
 * rien. Une couverture par logement suffit à reconnaître le sien.
 */
export default async function AdminPhotos() {
  if (!(await connecte())) redirect('/admin');

  const catalogue = await biens();
  const galeries = galeriesCompletes();
  const avec = catalogue.filter((b) => (galeries.get(b.id)?.retenues.length || 0) > 0).length;
  const verrouilles = catalogue.filter((b) => galeries.get(b.id)?.verrou).length;

  return (
    <>
      <h1>Logements</h1>
      <p className="muted" style={{ marginBottom: 30, maxWidth: '70ch' }}>
        Tout ce qui concerne un logement se trouve sur sa page : son texte de présentation, ses photographies et son
        adresse de réservation. {avec} logement(s) sur {catalogue.length} ont une galerie, {verrouilles} ont été
        retouchés à la main — un logement retouché n’est plus écrasé par un nouvel import.
      </p>

      <div className="actions-ligne" style={{ marginBottom: 26 }}>
        <Link className="btn-mini" href="/admin/calendriers">
          Voir l’état des calendriers
        </Link>
        <Link className="btn-mini" href="/admin/logements/caracteristiques">
          Renseigner toutes les caractéristiques
        </Link>
        <Link className="btn-mini" href="/admin/logements/equipements">
          Cocher tous les équipements
        </Link>
        <Link className="btn-mini" href="/admin/logements/adresses">
          Coller toutes les adresses de réservation
        </Link>
      </div>

      {catalogue.length === 0 && (
        <p className="avert">
          Aucun logement n’est chargé : la clé Lodgify n’est pas lue. L’onglet Lodgify vous dira pourquoi.
        </p>
      )}

      <div className="grille-logements">
        {catalogue.map((b) => {
          const g = galeries.get(b.id);
          const n = g?.retenues.length || 0;
          const couverture = g?.retenues[0] || b.photos[0];
          return (
            <Link key={b.id} href={`/admin/logements/${b.id}`} className="carte-logement">
              {couverture ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={couverture} alt="" loading="lazy" />
              ) : (
                <span className="sans-image">aucune photographie</span>
              )}
              <span className="carte-nom">{b.nom}</span>
              <span className="carte-meta">
                {n ? `${n} photo(s)` : 'galerie vide'}
                {g?.verrou ? ' · retouchée' : ''}
                {g?.ecartees.length ? ` · ${g.ecartees.length} écartée(s)` : ''}
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
