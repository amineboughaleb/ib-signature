import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { auditsRecents, messagesRecents } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Audit = {
  id: number; nom: string; email: string; telephone: string; ville: string;
  type_bien: string; message: string; courriel_envoye: number; created_at: string;
};
type Message = {
  id: number; nom: string; email: string; telephone: string; sujet: string;
  message: string; courriel_envoye: number; created_at: string;
};

const SUJETS: Record<string, string> = {
  sejour: 'Réservation ou séjour',
  bien: 'Un logement en particulier',
  long: 'Séjour de plusieurs mois',
  autre: 'Autre',
};

/**
 * La boîte de réception.
 *
 * En lecture seule, et c'est volontaire : ces lignes sont la trace de ce qu'un
 * visiteur a écrit, et une trace ne se corrige pas. Vous répondez depuis votre
 * messagerie, où la conversation continue.
 *
 * La mention « courriel non parti » n'est pas une erreur d'affichage : la
 * demande a bien été enregistrée, c'est l'envoi qui a échoué - clé Resend
 * absente, ou fournisseur en défaut. Elle est là pour que vous sachiez qu'il
 * faut rappeler cette personne à la main.
 */
export default async function Demandes() {
  if (!(await connecte())) redirect('/admin');

  const audits = auditsRecents(100) as Audit[];
  const messages = messagesRecents(100) as Message[];
  const quand = (s: string) => new Date(s.replace(' ', 'T') + 'Z').toLocaleString('fr-FR');

  return (
    <>
      <h1>Demandes et messages</h1>
      <p className="muted" style={{ marginBottom: 40, maxWidth: '70ch' }}>
        {audits.length} demande(s) d’audit et {messages.length} message(s). Tout est écrit en base avant l’envoi du
        courriel : rien ne se perd si l’envoi échoue.
      </p>

      <h2>Demandes d’audit</h2>
      {audits.length === 0 && <p className="muted small">Aucune demande pour l’instant.</p>}
      {audits.map((a) => (
        <article key={a.id} className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">{a.nom}</span>
            <span className="fiche-meta">
              {quand(a.created_at)}
              {!a.courriel_envoye && ' · courriel non parti'}
            </span>
          </div>
          <dl>
            <div>
              <dt>Courriel</dt>
              <dd>
                <a href={`mailto:${a.email}`}>{a.email}</a>
              </dd>
            </div>
            <div>
              <dt>Téléphone</dt>
              <dd>
                <a href={`tel:${a.telephone.replace(/\s/g, '')}`}>{a.telephone}</a>
              </dd>
            </div>
            {a.ville && (
              <div>
                <dt>Ville</dt>
                <dd>{a.ville}</dd>
              </div>
            )}
            {a.type_bien && (
              <div>
                <dt>Type</dt>
                <dd>{a.type_bien}</dd>
              </div>
            )}
          </dl>
          {a.message && <p className="corps">{a.message}</p>}
        </article>
      ))}

      <h2 style={{ marginTop: 64 }}>Messages depuis la page contact</h2>
      {messages.length === 0 && <p className="muted small">Aucun message pour l’instant.</p>}
      {messages.map((m) => (
        <article key={m.id} className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">{m.nom}</span>
            <span className="fiche-meta">
              {quand(m.created_at)}
              {!m.courriel_envoye && ' · courriel non parti'}
            </span>
          </div>
          <dl>
            <div>
              <dt>Courriel</dt>
              <dd>
                <a href={`mailto:${m.email}`}>{m.email}</a>
              </dd>
            </div>
            {m.telephone && (
              <div>
                <dt>Téléphone</dt>
                <dd>{m.telephone}</dd>
              </div>
            )}
            <div>
              <dt>Sujet</dt>
              <dd>{SUJETS[m.sujet] || m.sujet}</dd>
            </div>
          </dl>
          <p className="corps">{m.message}</p>
        </article>
      ))}
    </>
  );
}
