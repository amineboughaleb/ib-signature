import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { biens } from '@/lib/biens';
import { galeriesCompletes, galeriesReprenables } from '@/lib/db';
import { reprendreGaleriesAction } from '../actions';

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
export default async function AdminPhotos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await connecte())) redirect('/admin');

  const q = await searchParams;
  const reprises = Number(Array.isArray(q.reprises) ? q.reprises[0] : q.reprises) || 0;

  const catalogue = await biens();
  const galeries = galeriesCompletes();
  const avec = catalogue.filter((b) => (galeries.get(b.id)?.retenues.length || 0) > 0).length;
  const verrouilles = catalogue.filter((b) => galeries.get(b.id)?.verrou).length;
  const reprenables = galeriesReprenables();

  return (
    <>
      <h1>Logements</h1>

      {reprises > 0 && (
        <p className="avert" style={{ borderColor: 'var(--accent)' }}>
          <strong>{reprises} galerie(s) reprises.</strong> Elles affichent de nouveau ce que le dernier import a
          déposé. Ouvrez une fiche du site pour vérifier avant de passer à autre chose.
        </p>
      )}
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

      {/* Le geste d'après un import. Il n'a de sens qu'en ligne, et qu'une fois
          le déploiement passé : c'est là que la liste en base et les fichiers
          déposés cessent de correspondre. */}
      {reprenables > 0 && (
        <article className="boite" style={{ marginBottom: 26 }}>
          <div className="boite-tete">
            <span className="fiche-titre">Après un nouvel import de photographies</span>
            <span className="fiche-meta">{reprenables} galerie(s) concernées</span>
          </div>
          <p className="corps">
            Les listes de photographies vivent en base, et la base passe devant les images déposées avec le code —
            sans quoi un déploiement défairait ce que vous rangez ici. Mais après un import qui change les images,
            c’est l’inverse qu’il faut : la base montre encore l’ancienne liste, et pointe vers des fichiers qui
            n’existent plus.
          </p>
          <p className="hint" style={{ marginBottom: 14 }}>
            Rien n’est supprimé : les photographies sont sur le disque, la liste se recalcule à partir du dernier
            import. Les {verrouilles} galerie(s) que vous avez retouchées ne sont pas touchées.
          </p>
          <form action={reprendreGaleriesAction}>
            <button type="submit" className="btn btn-mini">
              Reprendre les galeries de l’import
            </button>
          </form>
        </article>
      )}

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
