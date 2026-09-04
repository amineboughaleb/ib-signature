'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { demanderAuditAction, type EtatAudit } from '@/app/actions';
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
 * Le formulaire d'audit.
 *
 * Cinq champs, et deux seulement sont obligatoires avec le courriel : un
 * propriétaire qui hésite ne remplit pas quinze cases. Le reste se demandera
 * au téléphone, où l'on obtient de toute façon de meilleures réponses.
 *
 * Une fois la demande passée, le formulaire disparaît au profit du
 * remerciement : laisser les champs remplis à l'écran invite à renvoyer.
 */
export default function FormulaireAudit({ locale }: { locale: string }) {
  const t = getT(locale);
  const [etat, action] = useActionState<EtatAudit, FormData>(demanderAuditAction, null);

  if (etat?.ok) {
    return (
      <div className="card card-pad audit-merci">
        <hr className="filet-or" />
        <h3>{t('po_merci')}</h3>
        <p className="muted small" style={{ margin: 0 }}>
          {t('po_form_texte')}
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="card card-pad">
      <input type="hidden" name="locale" value={locale} />
      <hr className="filet-or" />
      <h3 style={{ marginBottom: 6 }}>{t('po_form_titre')}</h3>
      <p className="muted small" style={{ marginBottom: 24 }}>
        {t('po_form_texte')}
      </p>

      {etat?.error && <p className="audit-erreur">{etat.error}</p>}

      <div className="grid2">
        <div className="field">
          <label htmlFor="nom">{t('po_nom')} *</label>
          <input id="nom" name="nom" type="text" required />
        </div>
        <div className="field">
          <label htmlFor="telephone">{t('po_tel')} *</label>
          <input id="telephone" name="telephone" type="tel" required />
        </div>
      </div>
      <div className="field">
        <label htmlFor="email">{t('po_email')} *</label>
        <input id="email" name="email" type="email" required />
      </div>
      <div className="grid2" style={{ marginTop: 20 }}>
        <div className="field">
          <label htmlFor="ville">{t('po_ville')}</label>
          <input id="ville" name="ville" type="text" placeholder="Casablanca, Marrakech…" />
        </div>
        <div className="field">
          <label htmlFor="type_bien">{t('po_type')}</label>
          <select id="type_bien" name="type_bien" defaultValue="">
            <option value="">-</option>
            <option>Studio</option>
            <option>{locale === 'fr' ? '1 chambre' : '1 bedroom'}</option>
            <option>{locale === 'fr' ? '2 chambres' : '2 bedrooms'}</option>
            <option>{locale === 'fr' ? '3 chambres et plus' : '3 bedrooms or more'}</option>
            <option>{locale === 'fr' ? 'Villa' : 'Villa'}</option>
          </select>
        </div>
      </div>
      <div className="field" style={{ marginTop: 20 }}>
        <label htmlFor="message">{t('po_message')}</label>
        <textarea id="message" name="message" rows={4} />
      </div>

      <div style={{ marginTop: 24 }}>
        <Envoyer libelle={t('po_envoyer')} />
      </div>
    </form>
  );
}
