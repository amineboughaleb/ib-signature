import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { reglages, virementsRecents } from '@/lib/db';
import { changerStatutVirementAction } from '../actions';

export const dynamic = 'force-dynamic';

const ETAT: Record<string, { mot: string; note: string }> = {
  attente: { mot: 'En attente', note: 'les dates sont tenues' },
  recu: { mot: 'Virement reçu', note: 'séjour confirmé' },
  annule: { mot: 'Annulée', note: 'dates rendues' },
  expire: { mot: 'Expirée', note: 'délai dépassé, dates rendues' },
  /* Une piste n'est pas une demande : le voyageur a saisi ses coordonnées puis
     est parti payer par carte chez Lodgify. Elle ne tient aucune date - la
     réservation, si elle a eu lieu, est dans Lodgify et nulle part ailleurs.
     Elle est ici pour une seule raison : pouvoir rappeler quelqu'un qui a
     renoncé devant le formulaire bancaire. */
  piste: { mot: 'Parti payer par carte', note: 'aucune date tenue' },
};

/**
 * Les réservations par virement.
 *
 * C'est la seule page de l'administration qui demande une action de votre part
 * dans un délai. Une demande en attente signifie que des dates sont tenues
 * pour quelqu'un : tant qu'elles le sont, elles ne doivent être vendues à
 * personne d'autre - et c'est vous qui devez les bloquer dans Lodgify, parce
 * que le site n'a pas le droit d'écrire dans votre calendrier.
 *
 * D'où l'ordre d'affichage : les demandes en attente d'abord, quel que soit
 * leur âge, puis le reste par ordre d'arrivée. Ce qui appelle une action passe
 * devant ce qui n'en appelle plus.
 *
 * Les demandes dont l'échéance est passée basculent d'elles-mêmes en
 * « expirée » à la lecture de cette page. Un blocage qui ne s'éteint pas finit
 * par geler un calendrier entier, et personne ne pense à faire le ménage.
 */
export default async function AdminVirements() {
  if (!(await connecte())) redirect('/admin');

  const liste = virementsRecents(200);
  const r = reglages();
  const attente = liste.filter((v) => v.statut === 'attente');
  const reste = liste.filter((v) => v.statut !== 'attente');
  const quand = (s: string) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString('fr-FR') : '—');
  const somme = (n: number, d: string) =>
    `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${d}`;

  const carte = (v: (typeof liste)[number]) => (
    <article key={v.id} className="boite">
      <div className="boite-tete">
        <span className="fiche-titre">
          {v.reference} · {v.bien_nom}
        </span>
        <span className="fiche-meta">
          {ETAT[v.statut]?.mot || v.statut} — {ETAT[v.statut]?.note || ''}
          {!v.courriel_envoye && ' · courriel non parti'}
        </span>
      </div>

      <dl className="coordonnees">
        <div>
          <dt>Séjour</dt>
          <dd>
            {v.arrivee} → {v.depart} · {v.nuits} nuit(s) · {v.voyageurs} voyageur(s)
          </dd>
        </div>
        <div>
          <dt>{v.moyen === 'carte' ? 'Prix du séjour' : 'Montant à recevoir'}</dt>
          <dd>
            {somme(v.montant, v.devise)}
            {v.montant_mad ? ` · environ ${Math.round(v.montant_mad).toLocaleString('fr-FR')} MAD au taux de ${v.taux}` : ''}
          </dd>
        </div>
        <div>
          <dt>Voyageur</dt>
          <dd>
            {[v.prenom, v.nom].filter(Boolean).join(' ')} · <a href={`mailto:${v.email}`}>{v.email}</a> ·{' '}
            <a href={`tel:${v.telephone}`}>{v.telephone}</a>
            {(v.nationalite || v.residence) && (
              <>
                <br />
                <span className="muted">
                  {[v.nationalite, v.residence && `réside à ${v.residence}`].filter(Boolean).join(' · ')}
                </span>
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>Déposée le</dt>
          <dd>
            {quand(v.created_at)}
            {v.statut === 'attente' && v.expire_at ? ` · dates tenues jusqu’au ${quand(v.expire_at)}` : ''}
          </dd>
        </div>
      </dl>

      {v.message && (
        <p className="corps" style={{ whiteSpace: 'pre-wrap' }}>
          {v.message}
        </p>
      )}

      <div className="actions-ligne">
        {v.statut !== 'recu' && (
          <form action={changerStatutVirementAction}>
            <input type="hidden" name="id" value={v.id} />
            <input type="hidden" name="statut" value="recu" />
            <button type="submit" className="btn-mini">
              Virement reçu
            </button>
          </form>
        )}
        {v.statut === 'attente' && (
          <form action={changerStatutVirementAction}>
            <input type="hidden" name="id" value={v.id} />
            <input type="hidden" name="statut" value="annule" />
            <button type="submit" className="btn-mini">
              Annuler et rendre les dates
            </button>
          </form>
        )}
        <Link className="btn-mini" href={`/fr/logements/${v.slug}`} target="_blank" rel="noopener">
          Voir le logement
        </Link>
      </div>
    </article>
  );

  return (
    <>
      <h1>Virements</h1>
      <p className="muted" style={{ marginBottom: 26, maxWidth: '72ch' }}>
        {attente.length} demande(s) en attente sur {liste.length} au total. Une demande en attente tient des dates :
        bloquez-les dans Lodgify dès sa réception, et marquez-la « reçue » quand le virement est constaté sur le
        compte de {r.virement_beneficiaire || 'Partners Hotels'}.
      </p>

      {r.virement_actif !== '1' && (
        <p className="avert">
          Le virement est éteint dans les réglages : le site ne le propose à personne en ce moment. Cette page ne
          montre donc que l’historique.{' '}
          <Link href="/admin/paiement">L’allumer depuis la page Paiement</Link>.
        </p>
      )}

      {attente.length > 0 && <h2>En attente — à traiter</h2>}
      {attente.map(carte)}

      {reste.length > 0 && <h2 style={{ marginTop: 40 }}>Historique</h2>}
      {reste.map(carte)}

      {liste.length === 0 && (
        <p className="muted small">
          Aucune demande pour l’instant. Elles apparaîtront ici dès qu’un voyageur choisira le virement sur la page de
          paiement.
        </p>
      )}
    </>
  );
}
