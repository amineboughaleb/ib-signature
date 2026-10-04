'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { deposerAvisAction, type EtatAvis } from '@/app/actions';
import { getT } from '@/lib/i18n';

function Envoyer({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-block-or" disabled={pending}>
      {pending ? '…' : libelle}
    </button>
  );
}

/**
 * Le formulaire d'avis.
 *
 * Une note, un commentaire, et la signature. Rien d'autre : chaque champ de
 * plus fait perdre des réponses, et un avis qu'on ne reçoit pas ne vaut rien,
 * si détaillé qu'on l'ait voulu.
 *
 * Les étoiles sont de vrais boutons radio. Elles se parcourent au clavier, un
 * lecteur d'écran les annonce « 4 sur 5 », et le formulaire part avec la note
 * même si le script n'a pas chargé.
 *
 * Aucune note n'est cochée d'avance. Cinq étoiles présélectionnées
 * fabriqueraient des cinq étoiles, et une moyenne qui ne dirait plus rien.
 */
export default function FormulaireAvis({
  locale,
  jeton,
  prenom,
  pays,
}: {
  locale: string;
  jeton: string;
  prenom: string;
  pays: string;
}) {
  const t = getT(locale);
  const [etat, action] = useActionState<EtatAvis, FormData>(deposerAvisAction, null);
  const [note, setNote] = useState(0);
  const [survol, setSurvol] = useState(0);

  if (etat?.ok) {
    return (
      <div className="card card-pad audit-merci">
        <hr className="filet-or" />
        <h3>{etat.ok}</h3>
        <p className="muted small" style={{ margin: 0 }}>
          {t('da_merci_texte')}
        </p>
      </div>
    );
  }

  const allumees = survol || note;

  return (
    <form action={action} className="card card-pad">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="jeton" value={jeton} />
      <hr className="filet-or" />

      {etat?.error && <p className="audit-erreur">{etat.error}</p>}

      <fieldset className="note-choix" onMouseLeave={() => setSurvol(0)}>
        <legend>{t('da_note')} *</legend>
        <div className="note-etoiles">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={n <= allumees ? 'allumee' : ''} onMouseEnter={() => setSurvol(n)}>
              <input
                type="radio"
                name="note"
                value={n}
                required
                checked={note === n}
                onChange={() => setNote(n)}
                aria-label={t('da_etoile', { n })}
              />
              <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true">
                <path d="M12 2.6l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6l-5.9 3.2 1.2-6.6L2.5 9.6l6.6-.9z" />
              </svg>
            </label>
          ))}
          <span className="note-dite small muted" aria-hidden="true">
            {allumees ? t('da_etoile', { n: allumees }) : ''}
          </span>
        </div>
      </fieldset>

      <div className="field" style={{ marginTop: 22 }}>
        <label htmlFor="a_texte">{t('da_commentaire')} *</label>
        <textarea
          id="a_texte"
          name="texte"
          rows={6}
          required
          minLength={10}
          maxLength={2000}
          placeholder={t('da_commentaire_aide')}
        />
      </div>

      <div className="grid2" style={{ marginTop: 20 }}>
        <div className="field">
          <label htmlFor="a_prenom">{t('da_prenom')}</label>
          <input id="a_prenom" name="prenom" type="text" defaultValue={prenom} maxLength={60} />
        </div>
        <div className="field">
          <label htmlFor="a_pays">{t('da_pays')}</label>
          <input id="a_pays" name="pays" type="text" defaultValue={pays} maxLength={60} />
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Envoyer libelle={t('da_envoyer')} />
      </div>
    </form>
  );
}
