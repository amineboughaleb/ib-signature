import Link from 'next/link';
import { notFound } from 'next/navigation';
import { estLocale, getT } from '@/lib/i18n';
import { MARQUE } from '@/lib/marque';
import FormulaireContact from '@/components/FormulaireContact';

import { metaCommune } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getT(locale);
  return metaCommune(locale, '/contact', `${t('ct_titre')} · IB Signature`, t('ct_texte'));
}

/**
 * Contactez-nous.
 *
 * Les coordonnées à gauche, le formulaire à droite, et le téléphone en premier :
 * un voyageur qui a un problème dans l'appartement à vingt-deux heures compose
 * un numéro, il ne remplit pas un formulaire. Le formulaire sert à celui qui
 * prépare son séjour, et lui peut attendre le lendemain.
 *
 * La ligne sur la réservation est là pour éviter une déception : ce site ne
 * prend pas le paiement, et quelqu'un qui écrirait ici pour réserver perdrait
 * deux jours.
 */
export default async function Contact({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!estLocale(locale)) notFound();
  const t = getT(locale);

  return (
    <>
      <section className="accroche accroche-courte">
        <div className="accroche-fond" aria-hidden="true" />
        <div className="wrap accroche-corps">
          <div className="eyebrow">{t('ct_sur')}</div>
          <h1>{t('ct_titre')}</h1>
          <p className="lead">{t('ct_texte')}</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap parcours-audit">
          <div>
            <hr className="filet-or" />
            <div className="eyebrow" style={{ marginBottom: 34 }}>
              {t('ct_sur')}
            </div>

            <dl className="coordonnees">
              <div>
                <dt>{t('ct_tel')}</dt>
                <dd>
                  <a href={`tel:${MARQUE.telephoneLien}`}>{MARQUE.telephone}</a>
                </dd>
              </div>
              <div>
                <dt>{t('ct_courriel')}</dt>
                <dd>
                  <a href={`mailto:${MARQUE.courriel}`}>{MARQUE.courriel}</a>
                </dd>
              </div>
              <div>
                <dt>{t('ct_horaires')}</dt>
                <dd>{t('ct_horaires_v')}</dd>
              </div>
              <div>
                <dt>{t('ct_adresse')}</dt>
                <dd>
                  {MARQUE.societe}
                  <br />
                  {MARQUE.adresse}
                </dd>
              </div>
            </dl>

            <p className="small muted" style={{ marginTop: 30, maxWidth: '46ch' }}>
              {t('ct_reserver')}
            </p>
            <div style={{ marginTop: 16 }}>
              <Link href={`/${locale}/logements`} className="lien">
                {t('biens_tous')} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>

          <div id="ecrire">
            <FormulaireContact locale={locale} />
          </div>
        </div>
      </section>
    </>
  );
}
