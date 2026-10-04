import Link from 'next/link';
import { notFound } from 'next/navigation';
import { estLocale, getT } from '@/lib/i18n';
import { invitationParJeton } from '@/lib/db';
import { formatDate } from '@/lib/dates';
import FormulaireAvis from '@/components/FormulaireAvis';

export const dynamic = 'force-dynamic';

/* Une page personnelle, atteinte par un lien reçu en courriel. Elle n'a rien à
   faire dans un moteur de recherche, et son adresse contient le jeton : on
   demande explicitement qu'elle ne soit ni indexée ni suivie. */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return {
    title: `${getT(locale)('da_titre')} · IB Signature`,
    robots: { index: false, follow: false },
    referrer: 'no-referrer' as const,
  };
}

/**
 * Laisser un avis.
 *
 * On n'arrive ici qu'avec le lien de son courriel. Un jeton inconnu rend une
 * page introuvable, sans autre explication : dire « ce lien a existé » ou « ce
 * lien n'existe pas » renseignerait quelqu'un qui en essaie au hasard.
 *
 * Le logement et les dates sont affichés, pas demandés. Le voyageur vérifie
 * d'un regard qu'on lui parle bien de son séjour, et il n'a rien à ressaisir.
 */
export default async function LaisserUnAvis({ params }: { params: Promise<{ locale: string; jeton: string }> }) {
  const { locale, jeton } = await params;
  if (!estLocale(locale)) notFound();
  const inv = invitationParJeton(jeton);
  if (!inv) notFound();
  const t = getT(locale);

  return (
    <section className="section">
      <div className="wrap avis-depot">
        <div>
          <hr className="filet-or" />
          <div className="eyebrow">{t('da_sur')}</div>
          <h1 style={{ marginTop: 14 }}>{t('da_titre')}</h1>
          <p className="lead">{t('da_texte')}</p>
          <p className="avis-depot-sejour">
            <b>{inv.bien_nom}</b>
            <br />
            <span className="muted">
              {t('da_sejour', { a: formatDate(inv.arrivee, locale), d: formatDate(inv.depart, locale) })}
            </span>
          </p>
        </div>

        {inv.avis_id ? (
          <div className="card card-pad audit-merci">
            <hr className="filet-or" />
            <h3>{t('da_deja')}</h3>
            <p className="muted small" style={{ margin: 0 }}>
              {t('da_deja_texte')} <Link href={`/${locale}/contact`}>{t('nav_contact')}</Link>
            </p>
          </div>
        ) : (
          <FormulaireAvis locale={locale} jeton={inv.jeton} prenom={inv.prenom} pays={inv.residence} />
        )}
      </div>
    </section>
  );
}
