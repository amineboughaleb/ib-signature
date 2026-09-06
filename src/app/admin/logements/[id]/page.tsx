import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { biens } from '@/lib/biens';
import { descriptionDe, equipementsDeBien, faitsDe, galerieDe, liensReservation } from '@/lib/db';
import { EQUIPEMENTS } from '@/lib/equipements';
import OrdreGalerie from '@/components/OrdreGalerie';
import {
  enregistrerDescriptionAction,
  enregistrerEquipementsAction,
  enregistrerFaitsAction,
  enregistrerGalerieAction,
  enregistrerLienAction,
  libererGalerieAction,
} from '../../actions';

export const dynamic = 'force-dynamic';

/**
 * Un logement, tout entier.
 *
 * Trois sections, dans l'ordre où l'on s'en occupe : ce qu'on en dit, ce qu'on
 * en montre, et où l'on envoie réserver. Trois formulaires distincts, aussi -
 * enregistrer une description ne doit pas obliger à re-valider un ordre de
 * photographies auquel on n'a pas touché.
 */
export default async function AdminLogement({ params }: { params: Promise<{ id: string }> }) {
  if (!(await connecte())) redirect('/admin/logements');

  const { id } = await params;
  const bienId = Number(id);
  const b = (await biens()).find((x) => x.id === bienId);
  if (!b) redirect('/admin/logements');

  const g = galerieDe(bienId);
  /* Un logement encore jamais retouché n'a rien en base propre : on part alors
     de ce que le site affiche aujourd'hui, sans quoi la page s'ouvrirait vide
     devant une fiche pourtant illustrée. */
  const retenues = g.retenues.length ? g.retenues : b.photos;
  const d = descriptionDe(bienId);
  const url = liensReservation().get(bienId) || '';
  const f = faitsDe(bienId);
  const eq = new Set(equipementsDeBien(bienId));

  return (
    <>
      <p className="fil">
        <Link href="/admin/logements">Logements</Link> · {b.nom}
      </p>
      <h1 style={{ marginTop: 6 }}>{b.nom}</h1>
      <p className="muted" style={{ marginBottom: 30 }}>
        {b.ville}
        {b.quartier ? ` · ${b.quartier}` : ''} · identifiant Lodgify {b.id}
      </p>

      {/* ---------- la présentation ---------- */}
      <form action={enregistrerDescriptionAction}>
        <input type="hidden" name="bien_id" value={b.id} />
        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Présentation</span>
            <span className="fiche-meta">{d.fr || d.en ? 'écrite ici' : 'reprise de Lodgify'}</span>
          </div>
          <p className="corps">
            Ce que vous écrivez ici passe devant le texte de Lodgify, qui est rédigé pour Airbnb et Booking — souvent
            en anglais seulement, et parsemé de règles de maison qui n’ont pas leur place sur une fiche. Laisser une
            langue vide n’efface rien : Lodgify reprend la main pour celle-là.
          </p>
          {b.description ? (
            <details className="repli">
              <summary>Voir le texte de Lodgify ({b.description.length} caractères)</summary>
              <p className="corps" style={{ whiteSpace: 'pre-wrap' }}>
                {b.description}
              </p>
            </details>
          ) : (
            <p className="avert">
              Lodgify ne publie aucune description pour ce logement, ou l’API ne l’expose pas. L’onglet Lodgify vous
              dira quels champs de texte sa fiche contient réellement.
            </p>
          )}
          <div className="grille-champs">
            <div className="field pleine">
              <label htmlFor="dfr">Présentation en français</label>
              <textarea id="dfr" name="description_fr" rows={9} defaultValue={d.fr} />
            </div>
            <div className="field pleine">
              <label htmlFor="den">Presentation in English</label>
              <textarea id="den" name="description_en" rows={9} defaultValue={d.en} />
            </div>
          </div>
          <div className="actions-ligne">
            <button type="submit" className="btn-mini">
              Enregistrer la présentation
            </button>
          </div>
        </article>
      </form>

      {/* ---------- les caractéristiques ---------- */}
      <form action={enregistrerFaitsAction}>
        <input type="hidden" name="bien_id" value={b.id} />
        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Caractéristiques</span>
            <span className="fiche-meta">
              {[b.chambres && `${b.chambres} ch.`, b.voyageurs && `${b.voyageurs} pers.`, b.surface && `${b.surface} m²`]
                .filter(Boolean)
                .join(' · ') || 'rien de connu'}
            </span>
          </div>
          <p className="corps">
            Lodgify annonce le nombre de chambres et la capacité ; il dit rarement les lits, jamais les canapés-lits,
            presque jamais les pièces d’eau ou la surface. La salle de bain a une baignoire, la salle d’eau une douche
            et souvent le WC : la distinction paraît menue, mais c’est celle qu’un voyageur déçu vous rappellera. Ce qui manque se saisit ici, une fois, et ce qui est saisi passe devant — vous
            connaissez vos appartements mieux qu’une API. Un champ laissé vide n’efface rien : il rend la main à
            Lodgify, et ce que personne ne renseigne n’apparaît simplement pas sur la fiche.
          </p>
          <div className="grille-champs">
            {[
              { n: 'f_chambres', l: 'Chambres', v: f.chambres, lu: b.chambres },
              { n: 'f_lits', l: 'Lits', v: f.lits, lu: b.lits },
              { n: 'f_canapes', l: 'Canapés-lits', v: f.canapes, lu: undefined },
              { n: 'f_bains', l: 'Salles de bain', v: f.bains, lu: b.bains },
              { n: 'f_eau', l: 'Salles d’eau / WC', v: f.eau, lu: undefined },
              { n: 'f_surface', l: 'Surface en m²', v: f.surface, lu: b.surface },
              { n: 'f_voyageurs', l: 'Voyageurs', v: f.voyageurs, lu: b.voyageurs },
              { n: 'f_sejour_min', l: 'Séjour minimum, en nuits', v: f.sejour_min, lu: undefined },
            ].map((c) => (
              <div className="field" key={c.n}>
                <label htmlFor={c.n}>
                  {c.l}
                  {c.lu ? ` — Lodgify dit ${c.lu}` : ''}
                </label>
                <input
                  id={c.n}
                  name={c.n}
                  type="number"
                  min={0}
                  defaultValue={c.v || ''}
                  placeholder={c.lu ? String(c.lu) : '—'}
                />
              </div>
            ))}
            <div className="field pleine">
              <label htmlFor="f_quartier">
                Quartier{b.quartier ? ` — actuellement « ${b.quartier} »` : ''}
              </label>
              <input
                id="f_quartier"
                name="f_quartier"
                type="text"
                defaultValue={f.quartier}
                placeholder="Triangle d’Or"
              />
            </div>
          </div>
          <div className="actions-ligne">
            <button type="submit" className="btn-mini">
              Enregistrer les caractéristiques
            </button>
          </div>
        </article>
      </form>

      {/* ---------- les équipements ---------- */}
      <form action={enregistrerEquipementsAction}>
        <input type="hidden" name="bien_id" value={b.id} />
        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Équipements</span>
            <span className="fiche-meta">{eq.size ? `${eq.size} coché(s)` : 'aucun'}</span>
          </div>
          <p className="corps">
            C’est la première chose qu’un voyageur cherche après le prix, et Lodgify ne la publie pas. La liste est
            fermée à dessein : elle garantit une traduction anglaise et une écriture identique d’une fiche à l’autre —
            saisis à la main, vingt-quatre logements donneraient « clim », « climatisation » et « A/C ».{' '}
            <Link href="/admin/logements/equipements">Les cocher pour tous les logements d’un coup</Link> est plus
            rapide si vous partez de zéro.
          </p>
          <div className="cases-equipements">
            {EQUIPEMENTS.map((e) => (
              <label key={e.cle} className="case-eq">
                <input type="checkbox" name="eq" value={e.cle} defaultChecked={eq.has(e.cle)} />
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={e.d} />
                </svg>
                {e.fr}
              </label>
            ))}
          </div>
          <div className="actions-ligne">
            <button type="submit" className="btn-mini">
              Enregistrer les équipements
            </button>
          </div>
        </article>
      </form>

      {/* ---------- les photographies ---------- */}
      <form action={enregistrerGalerieAction}>
        <input type="hidden" name="bien_id" value={b.id} />
        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Photographies</span>
            <span className="fiche-meta">{g.verrou ? 'retouchée à la main' : 'rangement automatique'}</span>
          </div>
          <OrdreGalerie bienId={b.id} retenues={retenues} ecartees={g.ecartees} />
          <div className="actions-ligne" style={{ marginTop: 22 }}>
            <button type="submit" className="btn-mini">
              Enregistrer cette galerie
            </button>
          </div>
        </article>
      </form>

      {g.verrou && (
        <form action={libererGalerieAction}>
          <input type="hidden" name="bien_id" value={b.id} />
          <p className="corps muted">
            Cette galerie est retouchée : le script d’import ne la touche plus. Rendez-lui la main si vous préférez
            repartir du rangement automatique — vos choix sur ce logement seront alors perdus au prochain import.
          </p>
          <button type="submit" className="btn-mini">
            Rendre la main à l’import
          </button>
        </form>
      )}

      {/* ---------- la réservation ---------- */}
      <form action={enregistrerLienAction}>
        <input type="hidden" name="bien_id" value={b.id} />
        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Adresse de réservation</span>
            <span className="fiche-meta">{url ? 'renseignée' : 'absente'}</span>
          </div>
          <p className="corps">
            Ouvrez votre moteur, cliquez sur ce logement, copiez l’adresse de la barre du navigateur et retirez ce qui
            suit le point d’interrogation : le site ajoute lui-même les dates et les voyageurs. Sans adresse, le
            bouton « Réserver » renvoie à la page « toutes les propriétés », qui existe toujours — un détour vaut mieux
            qu’une impasse.
          </p>
          <div className="grille-champs">
            <div className="field pleine">
              <label htmlFor="url">Adresse du logement sur votre moteur</label>
              <input id="url" name="url" type="text" defaultValue={url} placeholder="https://ibsignature.lodgify.com/fr/…" />
            </div>
          </div>
          <div className="actions-ligne">
            <button type="submit" className="btn-mini">
              Enregistrer l’adresse
            </button>
            {url && (
              <a className="btn-mini" href={url} target="_blank" rel="noopener noreferrer">
                Ouvrir pour vérifier
              </a>
            )}
            <Link className="btn-mini" href={`/fr/logements/${b.slug}`} target="_blank" rel="noopener">
              Voir la fiche publique
            </Link>
          </div>
        </article>
      </form>
    </>
  );
}
