'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { envoyerMessageAction, type EtatMessage } from '@/app/actions';
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
 * Le formulaire de contact.
 *
 * Quatre champs et un sujet. Le téléphone reste facultatif : un voyageur
 * étranger n'a pas toujours de numéro joignable au Maroc, et l'exiger ferait
 * partir des questions légitimes.
 *
 * Le sujet n'est pas là pour trier des courriels - il y en aura peu - mais
 * pour dire au visiteur ce qu'on traite ici, et lui indiquer, s'il vient pour
 * réserver, que le calendrier est ailleurs.
 */
export default function FormulaireContact({ locale }: { locale: string }) {
  const t = getT(locale);
  const [etat, action] = useActionState<EtatMessage, FormData>(envoyerMessageAction, null);

  if (etat?.ok) {
    return (
      <div className="card card-pad audit-merci">
        <hr className="filet-or" />
        <h3>{etat.ok}</h3>
        <p className="muted small" style={{ margin: 0 }}>
          {t('ct_form_texte')}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="card card-pad">
      <input type="hidden" name="locale" value={locale} />
      <hr className="filet-or" />
      <h3 style={{ marginBottom: 6 }}>{t('ct_form_titre')}</h3>
      <p className="muted small" style={{ marginBottom: 24 }}>
        {t('ct_form_texte')}
      </p>

      {etat?.error && <p className="audit-erreur">{etat.error}</p>}

      <div className="grid2">
        <div className="field">
          <label htmlFor="c_nom">{t('po_nom')} *</label>
          <input id="c_nom" name="nom" type="text" required />
        </div>
        <div className="field">
          <label htmlFor="c_tel">{t('po_tel')}</label>
          <input id="c_tel" name="telephone" type="tel" />
        </div>
      </div>
      <div className="field" style={{ marginTop: 20 }}>
        <label htmlFor="c_email">{t('po_email')} *</label>
        <input id="c_email" name="email" type="email" required />
      </div>
      <div className="field" style={{ marginTop: 20 }}>
        <label htmlFor="c_sujet">{t('ct_sujet')}</label>
        <select id="c_sujet" name="sujet" defaultValue="sejour">
          <option value="sejour">{t('ct_sujet_sejour')}</option>
          <option value="bien">{t('ct_sujet_bien')}</option>
          <option value="long">{t('ct_sujet_long')}</option>
          <option value="autre">{t('ct_sujet_autre')}</option>
        </select>
      </div>
      <div className="field" style={{ marginTop: 20 }}>
        <label htmlFor="c_message">{t('po_message')} *</label>
        <textarea id="c_message" name="message" rows={5} required />
      </div>

      <div style={{ marginTop: 24 }}>
        <Envoyer libelle={t('ct_envoyer')} />
      </div>
    </form>
  );
}
