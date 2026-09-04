'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOCALES } from '@/lib/i18n';
import { navigation, courant } from '@/lib/navigation';
import Menu from './Menu';

/**
 * La barre de navigation, côté client.
 *
 * Elle a besoin du chemin courant pour deux choses, et le serveur ne le lui
 * donne pas depuis la mise en page : marquer l'entrée de la page où l'on se
 * trouve, et surtout faire que le sélecteur de langue reste sur la même page.
 * Passer de la page de contact française à l'anglaise renvoyait jusqu'ici à
 * l'accueil, ce qui est la meilleure façon de perdre un visiteur qui vient de
 * lire trois paragraphes.
 */
export default function Barre({ locale }: { locale: string }) {
  const complet = usePathname() || `/${locale}`;
  /* Le chemin sans son préfixe de langue : « /fr/contact » devient
     « /contact », et se recompose dans l'autre langue. */
  const path = complet.replace(new RegExp(`^/(${LOCALES.join('|')})`), '');

  return (
    <>
      <nav className="nav nav-large">
        {navigation(locale).map((x) => (
          <Link key={x.h} href={x.h} aria-current={courant(x, locale, path) ? 'page' : undefined}>
            {x.l}
          </Link>
        ))}
        <span className="switch">
          {LOCALES.map((l) => (
            <Link key={l} href={`/${l}${path}`} className={locale === l ? 'on' : ''} hrefLang={l}>
              {l.toUpperCase()}
            </Link>
          ))}
        </span>
      </nav>
      <Menu locale={locale} path={path} />
    </>
  );
}
