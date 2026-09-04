import type { ReactNode } from 'react';
import Link from 'next/link';
import { MenuFamilles, MenuPages } from './Menu';
import '../globals.css';
import './admin.css';
import { connecte } from '@/lib/admin';
import { courrielsEnAttente } from '@/lib/db';
import EtatCourriels from './Courriels';
import { deconnexionAction } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Administration - IB Signature', robots: { index: false, follow: false } };

/**
 * L'administration.
 *
 * Elle reprend la charte du site - même nuit, même laiton, mêmes filets -
 * plutôt qu'un thème d'outil interne. Vous y passerez quelques minutes par
 * semaine, autant qu'elles ressemblent à votre maison.
 *
 * Les onglets n'apparaissent qu'une fois connecté : montrer la carte des lieux
 * à qui n'est pas entré n'apporte rien.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ouvert = await connecte();

  return (
    <html lang="fr">
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body className="admin">
        <header className="admin-tete">
          <div className="wrap">
            <Link href="/admin" className="marque" aria-label="IB Signature">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-ib.png" alt="IB Signature" className="marque-logo" width={65} height={46} />
              <span className="marque-qualite">Administration</span>
            </Link>
            {ouvert && (
              <MenuFamilles
                deconnexion={
                  <form action={deconnexionAction}>
                    <button type="submit" className="lien-bouton">
                      Se déconnecter
                    </button>
                  </form>
                }
              />
            )}
          </div>
          {/* Le second rang sur sa propre bande, pleine largeur : il appartient
              à l'en-tête et non au contenu, et se distingue du premier sans
              avoir besoin d'un trait. */}
          {ouvert && (
            <div className="admin-sous-barre">
              <div className="wrap">
                <MenuPages />
              </div>
            </div>
          )}
        </header>
        <main className="wrap admin-corps">
          {/* L'état du courrier avant tout le reste : sans fournisseur, ni le
              voyageur ni vous n'êtes prévenus, et rien à l'écran ne le dit. */}
          {ouvert && <EtatCourriels enAttente={courrielsEnAttente()} />}
          {children}
        </main>
      </body>
    </html>
  );
}
