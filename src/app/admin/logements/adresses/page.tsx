import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { biens } from '@/lib/biens';
import { liensReservation } from '@/lib/db';
import { enregistrerAdressesAction } from '../../actions';

export const dynamic = 'force-dynamic';

/**
 * Les adresses de réservation, toutes ensemble.
 *
 * Chaque logement a la sienne sur sa propre page, et c'est là qu'on la corrige
 * au fil de l'eau. Mais les renseigner pour la première fois est un autre
 * geste : on ouvre son moteur dans un onglet, on descend la liste, et l'on
 * colle vingt-quatre fois. Faire ce travail-là en changeant de page à chaque
 * ligne serait une punition.
 *
 * D'où cette page : les vingt-quatre champs à la suite, un seul bouton. Elle
 * ne remplace pas la page d'un logement, elle sert le jour où l'on remplit
 * tout d'un coup.
 *
 * L'API de Lodgify ne porte aucun identifiant d'adresse - ni slug, ni url, ni
 * nom lisible - le diagnostic l'a établi champ par champ. Ces adresses ne
 * peuvent donc pas être construites. Elles se copient, une fois, et le bouton
 * « Réserver » mène ensuite droit au bon logement.
 */
export default async function AdminAdresses() {
  if (!(await connecte())) redirect('/admin');

  const catalogue = await biens();
  const liens = liensReservation();
  const faits = catalogue.filter((b) => liens.get(b.id)).length;

  return (
    <>
      <p className="fil">
        <Link href="/admin/logements">Logements</Link> · Adresses de réservation
      </p>
      <h1 style={{ marginTop: 6 }}>Adresses de réservation</h1>
      <p className="muted" style={{ marginBottom: 26, maxWidth: '70ch' }}>
        {faits} sur {catalogue.length} renseignées — et elles ne servent presque plus. Le site construit désormais
        lui-même l’adresse du tunnel de paiement à partir de l’identifiant Lodgify du logement, et le voyageur
        arrive droit sur l’étape « coordonnées » du bon appartement. Ces champs ne servent qu’en dernier recours :
        pour un logement sans identifiant Lodgify, ou le jour où Lodgify changera la forme de ses adresses.
      </p>

      <p className="avert">
        Vous pouvez laisser ces champs vides — c’est même préférable. Une adresse du site vitrine
        (<code>ibsignature.lodgify.com</code>) mène à une seconde fiche du logement, avec son propre bouton
        « Réservez » : le voyageur doit recliquer sur ce qu’il venait de choisir, au moment précis où il allait
        payer. Le tunnel construit lui épargne ce détour. Une adresse collée ne reprend la main que si elle vise
        elle-même <code>checkout.lodgify.com</code>.
      </p>

      <form action={enregistrerAdressesAction}>
        <article className="boite">
          <div className="grille-champs">
            {catalogue.map((b) => {
              const url = liens.get(b.id) || '';
              return (
                <div className="field pleine" key={b.id}>
                  <label htmlFor={`a${b.id}`}>
                    {b.nom}
                    {url ? '' : ' — sans adresse'}
                  </label>
                  <input
                    id={`a${b.id}`}
                    name={`url_${b.id}`}
                    type="text"
                    defaultValue={url}
                    placeholder="https://ibsignature.lodgify.com/fr/…"
                  />
                </div>
              );
            })}
          </div>
          <div className="actions-ligne" style={{ marginTop: 20 }}>
            <button type="submit" className="btn-mini">
              Enregistrer les adresses
            </button>
            <a
              className="btn-mini"
              href="https://ibsignature.lodgify.com/fr/toutes-les-proprietes/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ouvrir le moteur
            </a>
          </div>
        </article>
      </form>
    </>
  );
}
