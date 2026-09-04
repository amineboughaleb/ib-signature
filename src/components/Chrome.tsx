import Link from 'next/link';
import { getT } from '@/lib/i18n';
import Barre from './Barre';
import { MARQUE } from '@/lib/marque';

/**
 * L'en-tête et le pied.
 *
 * L'en-tête tient en deux parties : le logo, rendu ici côté serveur parce qu'il
 * ne dépend de rien, et la barre de navigation, rendue côté client parce
 * qu'elle a besoin du chemin courant. Le pied reprend les mêmes entrées et les
 * coordonnées, toutes lues dans `marque.ts`.
 */
export function Entete({ locale }: { locale: string }) {
  const t = getT(locale);
  return (
    <header className="site-header">
      <div className="wrap">
        {/* Le logo remplace le nom composé : c'est la signature manuscrite de
            la maison, et elle vaut mieux qu'une police, si bien choisie
            soit-elle. Encre sur transparence, elle se pose sur le papier sans
            rectangle. La version blanche reste dans public/, sous
            logo-ib-blanc.png, pour un fond sombre. */}
        <Link href={`/${locale}`} className="marque" aria-label={MARQUE.nom}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-ib.png"
            srcSet="/logo-ib.png 1x, /logo-ib@2x.png 2x"
            alt={MARQUE.nom}
            className="marque-logo"
            width={65}
            height={46}
          />
          <span className="marque-qualite">{MARQUE.qualite}</span>
        </Link>
        <Barre locale={locale} />
      </div>
    </header>
  );
}

export function Pied({ locale }: { locale: string }) {
  const t = getT(locale);
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="pied-haut">
          <div>
            {/* Au pied, le logo a la place de respirer : à cette taille, le
                mot « Signature » et ses deux filets se lisent vraiment. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-ib@2x.png"
              alt={MARQUE.nom}
              className="marque-logo-pied"
              width={210}
              height={148}
            />
            <div className="surtitre" style={{ marginTop: 14 }}>
              Casablanca · Marrakech
            </div>
            <p className="small muted" style={{ marginTop: 18, maxWidth: 380 }}>
              {t('pied_maison')}
            </p>
          </div>
          <div className="pied-cols">
            <div>
              <div className="surtitre">{t('nav_appartements')}</div>
              <Link href={`/${locale}/logements`}>{t('biens_tous')}</Link>
              <Link href={`/${locale}/qui-sommes-nous`}>{t('nav_qui')}</Link>
            </div>
            <div>
              <div className="surtitre">{t('nav_proprietaires')}</div>
              <Link href={`/${locale}/proprietaires`}>{t('prop_cta')}</Link>
              <Link href={`/${locale}/contact`}>{t('nav_contact_page')}</Link>
            </div>
            <div>
              <div className="surtitre">{t('nav_contact')}</div>
              <a href={`tel:${MARQUE.telephoneLien}`}>{MARQUE.telephone}</a>
              <a href={`mailto:${MARQUE.courriel}`}>{MARQUE.courriel}</a>
              <span className="small muted" style={{ display: 'block', marginTop: 6 }}>
                {MARQUE.adresse}
              </span>
            </div>
          </div>
        </div>
        <hr className="rule" />
        <div className="pied-bas small">
          <span>© {new Date().getFullYear()} IB Signature. {t('pied_droits')}</span>
          <span className="pied-liens">
            <Link href={`/${locale}/cgv`}>{t('pied_cgv')}</Link>
            <Link href={`/${locale}/mentions`}>{t('pied_mentions')}</Link>
            <Link href={`/${locale}/confidentialite`}>{t('pied_confidentialite')}</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
