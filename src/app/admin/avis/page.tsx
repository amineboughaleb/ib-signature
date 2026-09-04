import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { listerAvis, type LigneAvis } from '@/lib/db';
import { biens } from '@/lib/biens';
import { enregistrerAvisAction, supprimerAvisAction } from '../actions';

export const dynamic = 'force-dynamic';

const PLATEFORMES = ['', 'Airbnb', 'Booking.com', 'Vrbo', 'Expedia', 'Agoda', 'TripAdvisor', 'Google', 'Direct'];

/**
 * Les avis.
 *
 * Tout est éditable sur place, sans page de détail : ouvrir une fiche pour
 * corriger un pays, revenir, en ouvrir une autre, c'est trois clics là où il en
 * faut zéro. Chaque ligne est son propre formulaire, et « Enregistrer » ne
 * touche que la sienne.
 *
 * Un avis dépublié n'est pas supprimé : il disparaît du site et reste ici. La
 * suppression, elle, est définitive - c'est pourquoi elle est le seul bouton
 * de la page à porter une couleur d'alerte.
 *
 * La liste des logements est proposée en suggestion sous le champ « slug » :
 * un avis rattaché à un slug qui n'existe pas s'affiche sans photo, et c'est la
 * première cause d'avis muet sur l'accueil.
 */
export default async function AdminAvis() {
  if (!(await connecte())) redirect('/admin');

  const liste = listerAvis(false);
  const catalogue = await biens();
  const slugs = catalogue.map((b) => ({ slug: b.slug, nom: b.nom }));
  const connus = new Set(slugs.map((s) => s.slug));
  /* Un avis dont le slug ne correspond à aucun logement s'affiche sans photo et
     sans lien. Ce n'est pas une panne - un bien peut être sorti du parc - mais
     c'est presque toujours un nom qui a changé chez Lodgify. Le signaler ici
     évite de le découvrir sur l'accueil. */
  const orphelins = liste.filter((a) => a.bien_slug && !connus.has(a.bien_slug)).length;

  return (
    <>
      <h1>Avis voyageurs</h1>
      <p className="muted" style={{ marginBottom: 30, maxWidth: '70ch' }}>
        {liste.length} avis, dont {liste.filter((a) => a.publie).length} publiés. Ils s’affichent sur l’accueil dans
        l’ordre du rang, du plus petit au plus grand.
      </p>

      <p className="avert">
        N’entrez ici que des commentaires réellement reçus. L’API de Lodgify n’expose aucun point d’entrée « avis » :
        ils ne peuvent pas être récupérés automatiquement, il faut les recopier depuis Airbnb, Booking ou votre moteur
        de réservation. Un témoignage inventé est une faute, et il se repère.
      </p>

      {orphelins > 0 && (
        <p className="avert">
          {orphelins} avis {orphelins > 1 ? 'portent' : 'porte'} un slug qui ne correspond à aucun logement du
          catalogue : {orphelins > 1 ? 'ils s’affichent' : 'il s’affiche'} sans photo et sans lien. Le champ « slug du
          logement » propose la liste de vos {slugs.length} logements : choisissez-y le bon, ou laissez le champ vide
          si le bien est sorti du parc. L’avis reste vrai dans les deux cas.
        </p>
      )}

      <h2 style={{ marginTop: 40 }}>Ajouter un avis</h2>
      <FicheAvis slugs={slugs} connus={connus} />

      <h2 style={{ marginTop: 56 }}>Les avis existants</h2>
      {liste.map((a) => (
        <FicheAvis key={a.id} a={a} slugs={slugs} connus={connus} />
      ))}
    </>
  );
}

function FicheAvis({
  a,
  slugs,
  connus,
}: {
  a?: LigneAvis;
  slugs: { slug: string; nom: string }[];
  connus: Set<string>;
}) {
  const nouveau = !a;
  const orphelin = !!a?.bien_slug && !connus.has(a.bien_slug);
  return (
    <form action={enregistrerAvisAction} className="fiche">
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="fiche-tete">
        <span className="fiche-titre">{a ? a.bien_nom || 'Sans logement' : 'Nouvel avis'}</span>
        <span className="fiche-meta">
          {a ? (a.publie ? 'publié' : 'masqué') : 'brouillon'}
          {orphelin && ' · logement introuvable'}
        </span>
      </div>

      <div className="grille-champs">
        <div className="field">
          <label htmlFor={`p${a?.id ?? 'n'}`}>Prénom</label>
          <input id={`p${a?.id ?? 'n'}`} name="prenom" type="text" defaultValue={a?.prenom ?? ''} placeholder="facultatif" />
        </div>
        <div className="field">
          <label htmlFor={`pf${a?.id ?? 'n'}`}>Provenance (FR)</label>
          <input id={`pf${a?.id ?? 'n'}`} name="pays_fr" type="text" defaultValue={a?.pays_fr ?? ''} placeholder="France" />
        </div>
        <div className="field">
          <label htmlFor={`pe${a?.id ?? 'n'}`}>Provenance (EN)</label>
          <input id={`pe${a?.id ?? 'n'}`} name="pays_en" type="text" defaultValue={a?.pays_en ?? ''} placeholder="France" />
        </div>
        <div className="field">
          <label htmlFor={`s${a?.id ?? 'n'}`}>Plateforme</label>
          <select id={`s${a?.id ?? 'n'}`} name="source" defaultValue={a?.source ?? ''}>
            {PLATEFORMES.map((p) => (
              <option key={p || 'aucune'} value={p}>
                {p || '-'}
              </option>
            ))}
          </select>
        </div>

        <div className="field large">
          <label htmlFor={`bn${a?.id ?? 'n'}`}>Nom du logement</label>
          <input id={`bn${a?.id ?? 'n'}`} name="bien_nom" type="text" defaultValue={a?.bien_nom ?? ''} />
        </div>
        <div className="field large">
          <label htmlFor={`bs${a?.id ?? 'n'}`}>
            Slug du logement{orphelin && ' - introuvable au catalogue'}
          </label>
          <input
            id={`bs${a?.id ?? 'n'}`}
            name="bien_slug"
            type="text"
            list="slugs-logements"
            defaultValue={a?.bien_slug ?? ''}
            placeholder="le-41-maarif"
          />
        </div>

        <div className="field pleine">
          <label htmlFor={`tf${a?.id ?? 'n'}`}>Commentaire (FR)</label>
          <textarea id={`tf${a?.id ?? 'n'}`} name="texte_fr" rows={3} defaultValue={a?.texte_fr ?? ''} />
        </div>
        <div className="field pleine">
          <label htmlFor={`te${a?.id ?? 'n'}`}>Commentaire (EN, vide = identique au français)</label>
          <textarea id={`te${a?.id ?? 'n'}`} name="texte_en" rows={2} defaultValue={a?.texte_en ?? ''} />
        </div>

        <div className="field">
          <label htmlFor={`r${a?.id ?? 'n'}`}>Rang</label>
          <input id={`r${a?.id ?? 'n'}`} name="rang" type="number" defaultValue={a?.rang ?? 100} />
        </div>
      </div>

      <datalist id="slugs-logements">
        {slugs.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.nom}
          </option>
        ))}
      </datalist>

      <div className="actions-ligne">
        <label className="bascule">
          <input type="checkbox" name="publie" defaultChecked={a ? !!a.publie : true} />
          Publié sur le site
        </label>
        <button type="submit" className="btn-mini">
          {nouveau ? 'Ajouter' : 'Enregistrer'}
        </button>
        {a && (
          <button type="submit" className="btn-mini danger" formAction={supprimerAvisAction}>
            Supprimer
          </button>
        )}
      </div>
    </form>
  );
}
