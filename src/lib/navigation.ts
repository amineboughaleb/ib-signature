import { getT } from './i18n';

/**
 * Les cinq entrées du menu, définies une seule fois.
 *
 * L'en-tête et le dépliant mobile lisaient chacun leur propre liste, et elles
 * avaient déjà divergé. Une seule source, donc : ajouter une page se fait ici,
 * et les deux menus la portent.
 *
 * L'ordre suit les questions d'un visiteur : où j'atterris, ce que vous avez,
 * qui vous êtes, ce que vous faites pour un propriétaire, comment vous joindre.
 * « Accueil » figure explicitement, même si le logo y mène : sur un téléphone,
 * le logo n'a pas l'air d'un bouton.
 */
export function navigation(locale: string) {
  const t = getT(locale);
  return [
    { h: `/${locale}`, l: t('nav_accueil'), exact: true },
    { h: `/${locale}/logements`, l: t('nav_appartements'), exact: false },
    { h: `/${locale}/qui-sommes-nous`, l: t('nav_qui'), exact: false },
    { h: `/${locale}/proprietaires`, l: t('nav_proprietaires'), exact: false },
    { h: `/${locale}/contact`, l: t('nav_contact_page'), exact: false },
  ];
}

/** Vrai quand l'entrée correspond au chemin courant (sans le préfixe de langue). */
export function courant(entree: { h: string; exact: boolean }, locale: string, path: string): boolean {
  const cible = entree.h.replace(`/${locale}`, '') || '/';
  const ici = path || '/';
  return entree.exact ? ici === cible : ici.startsWith(cible);
}
