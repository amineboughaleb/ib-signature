'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { connexionAction, type Etat } from './actions';

function Bouton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-block-or" disabled={pending}>
      {pending ? '…' : 'Entrer'}
    </button>
  );
}

/**
 * Le formulaire de connexion.
 *
 * Un seul champ. Pas d'identifiant : il n'y a qu'une personne, et lui demander
 * de taper un nom d'utilisateur qu'elle est seule à porter ne protège rien.
 */
export default function Connexion({ configuree }: { configuree: boolean }) {
  const [etat, action] = useActionState<Etat, FormData>(connexionAction, null);

  return (
    <div className="connexion">
      <form action={action} className="card card-pad">
        <hr className="filet-or" />
        <h2 style={{ marginBottom: 6 }}>Administration</h2>
        <p className="muted small" style={{ marginBottom: 24 }}>
          IB Signature. Accès réservé.
        </p>

        {!configuree && (
          <p className="avert" style={{ marginBottom: 22 }}>
            Aucun mot de passe n’est défini. Ajoutez <code>ADMIN_PASSWORD</code> dans <code>.env.local</code> (et chez
            votre hébergeur pour le site en ligne), puis relancez le serveur.
          </p>
        )}
        {etat?.error && <p className="audit-erreur">{etat.error}</p>}

        <div className="field">
          <label htmlFor="mdp">Mot de passe</label>
          <input id="mdp" name="motdepasse" type="password" autoComplete="current-password" required />
        </div>

        <div style={{ marginTop: 24 }}>
          <Bouton />
        </div>
      </form>
    </div>
  );
}
