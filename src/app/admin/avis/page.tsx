import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { invitations, listerAvis, sejoursTermines, type LigneAvis } from '@/lib/db';
import { DELAI_AUTO_JOURS } from '@/lib/invitations';
import { biens } from '@/lib/biens';
import {
  ecarterAvisAction,
  enregistrerAvisAction,
  inviterAvisAction,
  publierAvisAction,
  supprimerAvisAction,
} from '../actions';

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

  /* Les avis déposés par les voyageurs et pas encore tranchés. Ils viennent en
     tête de page : c'est la seule chose ici qui attende quelqu'un. */
  const attente = liste.filter((a) => a.etat === 'attente');
  const reste = liste.filter((a) => a.etat !== 'attente');

  /* Les séjours terminés que le site connaît, avec l'état de leur invitation. */
  const sejours = sejoursTermines(90);
  const invites = invitations();
  const jour = new Date().toISOString().slice(0, 10);
  const limite = new Date(Date.now() - DELAI_AUTO_JOURS * 86400000).toISOString().slice(0, 10);
  const quand = (s: string) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR') : '');

  return (
    <>
      <h1>Avis voyageurs</h1>
      <p className="muted" style={{ marginBottom: 30, maxWidth: '70ch' }}>
        {liste.length} avis, dont {liste.filter((a) => a.publie).length} publiés. Ils s’affichent sur l’accueil dans
        l’ordre du rang, du plus petit au plus grand : les six premiers seulement. Un avis déposé par un voyageur
        arrive avec le rang 5, donc en tête ; changez son rang pour le déplacer.
      </p>

      <p className="avert">
        N’entrez ici que des commentaires réellement reçus. Les avis des voyageurs qui ont réservé sur ce site
        arrivent tout seuls, plus bas dans « À valider ». Ceux d’Airbnb ou de Booking ne peuvent pas être récupérés
        automatiquement : il faut les recopier. Un témoignage inventé est une faute, et il se repère.
      </p>

      {orphelins > 0 && (
        <p className="avert">
          {orphelins} avis {orphelins > 1 ? 'portent' : 'porte'} un slug qui ne correspond à aucun logement du
          catalogue : {orphelins > 1 ? 'ils s’affichent' : 'il s’affiche'} sans photo et sans lien. Le champ « slug du
          logement » propose la liste de vos {slugs.length} logements : choisissez-y le bon, ou laissez le champ vide
          si le bien est sorti du parc. L’avis reste vrai dans les deux cas.
        </p>
      )}

      <h2 style={{ marginTop: 40 }}>À valider</h2>
      {attente.length === 0 ? (
        <p className="muted" style={{ maxWidth: '70ch' }}>
          Aucun avis en attente. Quand un voyageur dépose un avis depuis le lien de son courriel, il arrive ici et vous
          recevez un message. Rien n’est en ligne tant que vous n’avez pas cliqué sur « Publier ».
        </p>
      ) : (
        <>
          <p className="muted" style={{ maxWidth: '70ch' }}>
            {attente.length} avis déposé{attente.length > 1 ? 's' : ''} par {attente.length > 1 ? 'des voyageurs' : 'un voyageur'}.
            Vous pouvez corriger une faute, traduire, répondre. La note, elle, ne se modifie pas : c’est la sienne.
          </p>
          {attente.map((a) => (
            <FicheAvis key={a.id} a={a} slugs={slugs} connus={connus} />
          ))}
        </>
      )}

      <h2 style={{ marginTop: 56 }}>Invitations à laisser un avis</h2>
      <p className="muted" style={{ maxWidth: '70ch' }}>
        Les séjours terminés depuis moins de 90 jours. Un séjour payé par virement et marqué « reçu » est invité tout
        seul, le lendemain du départ, par la tâche de nuit - et pendant {DELAI_AUTO_JOURS} jours seulement. Un séjour
        parti payer par carte ne l’est jamais d’office : le site ne sait pas si le paiement a abouti chez Lodgify.
        Vérifiez-le là-bas, puis cliquez sur « Inviter ».
      </p>
      {sejours.length === 0 ? (
        <p className="muted">Aucun séjour terminé pour l’instant.</p>
      ) : (
        sejours.map((v) => {
          const i = invites.get(v.id);
          const etat = i?.avis_id
            ? 'avis déposé'
            : i?.envoye_at
              ? `invité le ${quand(i.envoye_at)}`
              : i
                ? 'courriel non parti'
                : v.statut === 'recu'
                  ? v.depart >= jour
                    ? 'invitation la nuit prochaine'
                    : v.depart < limite
                      ? 'délai dépassé, à inviter à la main'
                      : 'invitation à la prochaine tâche de nuit'
                  : 'à vérifier dans Lodgify';
          return (
            <article key={v.id} className="boite">
              <div className="boite-tete">
                <span className="fiche-titre">
                  {[v.prenom, v.nom].filter(Boolean).join(' ') || v.email} · {v.bien_nom}
                </span>
                <span className="fiche-meta">
                  {v.statut === 'recu' ? 'virement reçu' : 'carte, non confirmé'} · {etat}
                </span>
              </div>
              <dl>
                <div>
                  <dt className="muted">Séjour</dt>
                  <dd style={{ margin: 0 }}>
                    {v.arrivee} → {v.depart}
                  </dd>
                </div>
                <div>
                  <dt className="muted">Courriel</dt>
                  <dd style={{ margin: 0 }}>{v.email}</dd>
                </div>
                <div>
                  <dt className="muted">Référence</dt>
                  <dd style={{ margin: 0 }}>{v.reference}</dd>
                </div>
              </dl>
              {!i?.avis_id && (
                <form action={inviterAvisAction} className="actions-ligne" style={{ marginTop: 14 }}>
                  <input type="hidden" name="id" value={v.id} />
                  <button type="submit" className="btn-mini">
                    {i?.envoye_at ? 'Renvoyer l’invitation' : 'Inviter'}
                  </button>
                </form>
              )}
            </article>
          );
        })
      )}

      <h2 style={{ marginTop: 56 }}>Ajouter un avis</h2>
      <FicheAvis slugs={slugs} connus={connus} />

      <h2 style={{ marginTop: 56 }}>Les avis existants</h2>
      {reste.map((a) => (
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
  const duVoyageur = a?.origine === 'voyageur';
  const enAttente = a?.etat === 'attente';
  const orphelin = !!a?.bien_slug && !connus.has(a.bien_slug);
  return (
    <form action={enregistrerAvisAction} className="fiche">
      {a && <input type="hidden" name="id" value={a.id} />}
      <div className="fiche-tete">
        <span className="fiche-titre">{a ? a.bien_nom || 'Sans logement' : 'Nouvel avis'}</span>
        <span className="fiche-meta">
          {a ? (enAttente ? 'en attente de votre décision' : a.publie ? 'publié' : 'masqué') : 'brouillon'}
          {duVoyageur && ` · déposé par le voyageur · ${a!.note}/5`}
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

        <div className="field pleine">
          <label htmlFor={`rf${a?.id ?? 'n'}`}>Votre réponse publique (FR, facultative)</label>
          <textarea id={`rf${a?.id ?? 'n'}`} name="reponse_fr" rows={2} defaultValue={a?.reponse_fr ?? ''} />
        </div>
        <div className="field pleine">
          <label htmlFor={`re${a?.id ?? 'n'}`}>Votre réponse publique (EN, vide = identique au français)</label>
          <textarea id={`re${a?.id ?? 'n'}`} name="reponse_en" rows={2} defaultValue={a?.reponse_en ?? ''} />
        </div>

        {/* La note et le mois du séjour d'un avis déposé par le voyageur ne se
            modifient pas : ils sont affichés dans l'en-tête, pas dans un champ. */}
        {!duVoyageur && (
          <>
            <div className="field">
              <label htmlFor={`n${a?.id ?? 'n'}`}>Note sur 5 (0 = sans note)</label>
              <input id={`n${a?.id ?? 'n'}`} name="note" type="number" min={0} max={5} defaultValue={a?.note ?? 0} />
            </div>
            <div className="field">
              <label htmlFor={`sj${a?.id ?? 'n'}`}>Mois du séjour</label>
              <input id={`sj${a?.id ?? 'n'}`} name="sejour" type="text" defaultValue={a?.sejour ?? ''} placeholder="2026-10" />
            </div>
          </>
        )}
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
        {enAttente ? (
          <>
            <button type="submit" formAction={publierAvisAction} className="btn-mini btn-mini-actif">
              Publier
            </button>
            <button type="submit" formAction={ecarterAvisAction} className="btn-mini">
              Ne pas publier
            </button>
          </>
        ) : (
          <>
            <label className="bascule">
              <input type="checkbox" name="publie" defaultChecked={a ? !!a.publie : true} />
              Publié sur le site
            </label>
            <button type="submit" className="btn-mini">
              {nouveau ? 'Ajouter' : 'Enregistrer'}
            </button>
          </>
        )}
        {a && (
          <button type="submit" className="btn-mini danger" formAction={supprimerAvisAction}>
            Supprimer
          </button>
        )}
      </div>
    </form>
  );
}
