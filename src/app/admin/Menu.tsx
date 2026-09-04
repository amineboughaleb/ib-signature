'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Le menu de l'administration, sur deux rangs.
 *
 * Il en avait huit d'affilée, et huit boutons de même poids ne se lisent pas :
 * on les parcourt un par un, à chaque fois, parce que rien ne dit lequel
 * concerne ce qu'on est en train de faire. Le regroupement ne sert pas à faire
 * joli - il sert à ce que la moitié du menu cesse d'être lue quand on cherche
 * une seule chose.
 *
 * Deux rangs plutôt qu'un menu déroulant, et c'est délibéré. Un menu déroulant
 * cache : il faut savoir où l'on va avant d'y aller, et sur un écran tactile il
 * se déclenche mal. Deux rangs montrent la famille où l'on se trouve et ce
 * qu'elle contient, en permanence. On sait donc toujours où l'on est - ce qui
 * est précisément ce qu'un menu doit dire.
 *
 * Les familles suivent ce qu'on est en train de FAIRE, pas la nature des
 * données. « Réservations » réunit ce qui attend une réponse aujourd'hui ;
 * « Logements » l'inventaire ; « Vitrine » ce que voit le visiteur ;
 * « Réglages » ce qu'on pose une fois. C'est le classement qui correspond à
 * une journée de travail, pas à un schéma de base.
 *
 * Aucune adresse ne change. C'est ce qui rend cette modification sans risque :
 * un lien mis en favori continue de fonctionner, et rien de ce que voit un
 * voyageur n'est touché.
 */

type Lien = { href: string; nom: string };
type Famille = { nom: string; liens: Lien[] };

const FAMILLES: Famille[] = [
  {
    nom: 'Réservations',
    liens: [
      { href: '/admin/virements', nom: 'Séjours et virements' },
      { href: '/admin/demandes', nom: 'Propriétaires et messages' },
    ],
  },
  {
    /* Cinq entrées, et c'est la famille qui en avait le plus besoin : trois de
       ces pages ne s'atteignaient qu'en passant par la liste des logements.
       Or c'est entre elles qu'on fait des allers-retours le jour où l'on
       saisit vingt-quatre appartements. */
    nom: 'Logements',
    liens: [
      { href: '/admin/logements', nom: 'Tous les logements' },
      { href: '/admin/logements/caracteristiques', nom: 'Caractéristiques' },
      { href: '/admin/logements/equipements', nom: 'Équipements' },
      { href: '/admin/calendriers', nom: 'Calendriers' },
      { href: '/admin/logements/adresses', nom: 'Adresses de réservation' },
    ],
  },
  {
    nom: 'Vitrine',
    liens: [
      { href: '/admin/diaporama', nom: 'Diaporama' },
      { href: '/admin/avis', nom: 'Avis' },
      { href: '/admin/photos', nom: 'Photographies' },
    ],
  },
  {
    nom: 'Réglages',
    liens: [
      { href: '/admin/paiement', nom: 'Paiement et conditions' },
      { href: '/admin/lodgify', nom: 'Connexion Lodgify' },
      { href: '/admin/sauvegarde', nom: 'Sauvegarde' },
    ],
  },
];

/**
 * Quelle famille contient l'adresse courante.
 *
 * On retient le lien le plus long qui corresponde, et non le premier : sinon
 * `/admin/logements` gagnerait contre `/admin/logements/equipements`, et l'on
 * se croirait toujours sur la liste des logements.
 */
function familleDe(chemin: string): Famille {
  let meilleure = FAMILLES[0];
  let longueur = -1;
  for (const f of FAMILLES) {
    for (const l of f.liens) {
      if ((chemin === l.href || chemin.startsWith(`${l.href}/`)) && l.href.length > longueur) {
        longueur = l.href.length;
        meilleure = f;
      }
    }
  }
  return meilleure;
}

/**
 * Le premier rang : les quatre familles, et les commandes de session.
 */
export function MenuFamilles({ deconnexion }: { deconnexion: React.ReactNode }) {
  const chemin = usePathname() || '';
  const active = familleDe(chemin);

  return (
    <nav className="admin-familles" aria-label="Sections">
      {FAMILLES.map((f) => (
        /* Le premier lien de la famille sert de porte d'entrée : cliquer sur
           « Logements » doit mener quelque part, pas seulement déplier. */
        <Link
          key={f.nom}
          href={f.liens[0].href}
          className={f === active ? 'admin-famille est-active' : 'admin-famille'}
          aria-current={f === active ? 'page' : undefined}
        >
          {f.nom}
        </Link>
      ))}
      <span className="admin-menu-fin">
        <Link href="/fr" target="_blank" rel="noopener">
          Voir le site
        </Link>
        {deconnexion}
      </span>
    </nav>
  );
}

/**
 * Le second rang : ce que contient la famille où l'on se trouve.
 *
 * Toujours affiché, jamais déplié : on sait donc où l'on est sans avoir à
 * chercher, et la page voisine est à un clic plutôt qu'à deux.
 */
export function MenuPages() {
  const chemin = usePathname() || '';
  const active = familleDe(chemin);

  /* Le plus long lien qui corresponde, et lui seul.
   *
   * Le même piège que pour les familles, et je l'avais laissé passer ici :
   * `/admin/logements` correspond aussi à `/admin/logements/equipements`, donc
   * DEUX entrées se marquaient actives sur la même page. Un menu qui montre
   * deux positions à la fois n'en montre aucune - il est même pire que muet,
   * puisqu'il affirme. */
  let courant = '';
  for (const l of active.liens) {
    if ((chemin === l.href || chemin.startsWith(`${l.href}/`)) && l.href.length > courant.length) {
      courant = l.href;
    }
  }
  const estActif = (href: string) => href === courant;

  return (
    <nav className="admin-pages" aria-label={active.nom}>
      {active.liens.map((l) => (
        <Link key={l.href} href={l.href} className={estActif(l.href) ? 'est-active' : undefined}>
          {l.nom}
        </Link>
      ))}
    </nav>
  );
}
