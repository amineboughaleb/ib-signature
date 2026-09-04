import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { listerImages, type LigneImage } from '@/lib/db';
import { biens } from '@/lib/biens';
import { enregistrerImageAction, supprimerImageAction } from '../actions';

export const dynamic = 'force-dynamic';

/**
 * Le diaporama de l'accueil.
 *
 * Une image est ici une adresse, pas un fichier téléversé : vos photographies
 * vivent déjà chez Lodgify, en haute définition et servies par leur réseau. Les
 * recopier ici en ferait une deuxième vérité, qui vieillirait mal le jour où
 * vous changez la photo d'un logement.
 *
 * D'où le tableau du bas : il liste les photos de couverture de vos logements
 * telles que Lodgify les sert aujourd'hui, prêtes à être copiées. Sans clé
 * Lodgify, ce tableau est vide - et c'est le premier symptôme à regarder quand
 * l'accueil n'affiche aucune photo.
 *
 * Tant qu'aucune image n'est active ici, l'accueil se rabat tout seul sur la
 * première photo de chaque logement mis en avant. Le diaporama n'est donc
 * jamais vide, même avant votre premier passage.
 */
export default async function AdminDiaporama() {
  if (!(await connecte())) redirect('/admin');

  const images = listerImages(false);
  const catalogue = await biens();
  const disponibles = catalogue.filter((b) => b.photos[0]).map((b) => ({ nom: b.nom, url: b.photos[0] }));

  return (
    <>
      <h1>Diaporama de l’accueil</h1>
      <p className="muted" style={{ marginBottom: 30, maxWidth: '70ch' }}>
        {images.length} image(s), dont {images.filter((i) => i.actif).length} active(s). Elles défilent dans l’ordre du
        rang. Six suffisent : au-delà, la dernière n’est jamais vue.
      </p>

      {!images.filter((i) => i.actif).length && (
        <p className="avert">
          Aucune image active : l’accueil utilise pour l’instant la première photo de chaque logement mis en avant. Ce
          repli fonctionne bien, vous n’avez à intervenir ici que si vous voulez choisir vous-même.
        </p>
      )}

      <h2 style={{ marginTop: 40 }}>Ajouter une image</h2>
      <FicheImage />

      <h2 style={{ marginTop: 56 }}>Les images du diaporama</h2>
      {images.map((i) => (
        <FicheImage key={i.id} i={i} />
      ))}

      <h2 style={{ marginTop: 64 }}>Photos disponibles chez Lodgify</h2>
      {disponibles.length ? (
        <>
          <p className="muted small" style={{ marginBottom: 22, maxWidth: '70ch' }}>
            La photo de couverture de chaque logement. Copiez une adresse et collez-la ci-dessus.
          </p>
          <div className="grid3" style={{ gap: 26 }}>
            {disponibles.map((d) => (
              <figure key={d.url} style={{ margin: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.url} alt={d.nom} className="vignette" style={{ width: '100%', height: 150 }} />
                <figcaption className="small muted" style={{ marginTop: 8 }}>
                  {d.nom}
                </figcaption>
                <input type="text" readOnly value={d.url} style={{ marginTop: 8, fontSize: 12 }} />
              </figure>
            ))}
          </div>
        </>
      ) : (
        <p className="avert">
          Aucune photo n’est disponible : la clé <code>LODGIFY_API_KEY</code> n’est pas renseignée, ou Lodgify n’a pas
          répondu. C’est aussi la raison pour laquelle l’accueil et les fiches n’affichent aucune image. L’onglet
          Lodgify montre exactement ce que l’API répond.
        </p>
      )}
    </>
  );
}

function FicheImage({ i }: { i?: LigneImage }) {
  return (
    <form action={enregistrerImageAction} className="fiche">
      {i && <input type="hidden" name="id" value={i.id} />}
      <div className="ligne-image">
        <div>
          {i?.url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={i.url} alt={i.alt_fr || ''} className="vignette" />
          ) : (
            <div className="vignette" />
          )}
        </div>
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="grille-champs">
            <div className="field pleine">
              <label htmlFor={`u${i?.id ?? 'n'}`}>Adresse de l’image</label>
              <input
                id={`u${i?.id ?? 'n'}`}
                name="url"
                type="text"
                defaultValue={i?.url ?? ''}
                placeholder="https://… ou /nom-du-fichier.jpg"
              />
            </div>
            <div className="field large">
              <label htmlFor={`af${i?.id ?? 'n'}`}>Description (FR)</label>
              <input id={`af${i?.id ?? 'n'}`} name="alt_fr" type="text" defaultValue={i?.alt_fr ?? ''} />
            </div>
            <div className="field">
              <label htmlFor={`ae${i?.id ?? 'n'}`}>Description (EN)</label>
              <input id={`ae${i?.id ?? 'n'}`} name="alt_en" type="text" defaultValue={i?.alt_en ?? ''} />
            </div>
            <div className="field">
              <label htmlFor={`ri${i?.id ?? 'n'}`}>Rang</label>
              <input id={`ri${i?.id ?? 'n'}`} name="rang" type="number" defaultValue={i?.rang ?? 100} />
            </div>
          </div>
          <div className="actions-ligne">
            <label className="bascule">
              <input type="checkbox" name="actif" defaultChecked={i ? !!i.actif : true} />
              Active
            </label>
            <button type="submit" className="btn-mini">
              {i ? 'Enregistrer' : 'Ajouter'}
            </button>
            {i && (
              <button type="submit" className="btn-mini danger" formAction={supprimerImageAction}>
                Supprimer
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
