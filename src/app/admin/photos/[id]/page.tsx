import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { biens } from '@/lib/biens';
import { galerieDe } from '@/lib/db';
import OrdreGalerie from '@/components/OrdreGalerie';
import { enregistrerGalerieAction, libererGalerieAction } from '../../actions';

export const dynamic = 'force-dynamic';

/**
 * La galerie d'un logement.
 *
 * Tout se fait ici sans quitter la page, et rien n'est écrit tant que le
 * bouton n'a pas été cliqué : on peut essayer un ordre, changer d'avis, et
 * partir sans rien enregistrer.
 */
export default async function AdminPhotosLogement({ params }: { params: Promise<{ id: string }> }) {
  if (!(await connecte())) redirect('/admin');

  const { id } = await params;
  const bienId = Number(id);
  const b = (await biens()).find((x) => x.id === bienId);
  if (!b) redirect('/admin/photos');

  const g = galerieDe(bienId);
  /* Un logement encore jamais retouché n'a rien en base propre : on part alors
     de ce que le site affiche aujourd'hui, sans quoi la page s'ouvrirait vide
     devant une fiche pourtant illustrée. */
  const retenues = g.retenues.length ? g.retenues : b.photos;

  return (
    <>
      <p className="fil">
        <Link href="/admin/photos">Photographies</Link> · {b.nom}
      </p>
      <h1 style={{ marginTop: 6 }}>{b.nom}</h1>

      <form action={enregistrerGalerieAction}>
        <input type="hidden" name="bien_id" value={b.id} />
        <OrdreGalerie retenues={retenues} ecartees={g.ecartees} />
        <div className="actions-ligne" style={{ marginTop: 26 }}>
          <button type="submit" className="btn-mini">
            Enregistrer cet ordre
          </button>
          <Link className="btn-mini" href={`/fr/logements/${b.slug}`} target="_blank" rel="noopener">
            Voir la fiche
          </Link>
        </div>
      </form>

      {g.verrou && (
        <form action={libererGalerieAction} style={{ marginTop: 30 }}>
          <input type="hidden" name="bien_id" value={b.id} />
          <p className="corps muted">
            Cette galerie est retouchée : le script d’import ne la touche plus. Rendez-lui la main si vous préférez
            repartir du rangement automatique — vos choix sur ce logement seront alors perdus au prochain import.
          </p>
          <button type="submit" className="btn-mini">
            Rendre la main à l’import
          </button>
        </form>
      )}
    </>
  );
}
