'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { analyserCollageAction, appliquerCollageAction, type EtatCollage } from '@/app/admin/actions';

function Bouton({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-mini" disabled={pending}>
      {pending ? '…' : libelle}
    </button>
  );
}

/**
 * Reprendre le tableau de Staytle.
 *
 * Les mêmes appartements y sont déjà décrits, avec leur identifiant Lodgify et
 * l'adresse de leur calendrier. Les ressaisir ici serait vingt-quatre
 * occasions de se tromper d'une ligne - et une adresse attribuée au mauvais
 * logement ne se voit pas : elle bloque les mauvaises dates, en silence,
 * jusqu'au jour où un voyageur trouve porte close.
 *
 * Deux temps, et le premier n'écrit rien. On montre ce qu'on a compris, ligne
 * par ligne, et l'on n'écrit qu'après votre accord. Un geste qui touche
 * vingt-quatre logements d'un coup est précisément celui qu'il faut pouvoir
 * regarder avant de le faire.
 *
 * L'aperçu et l'écriture lisent le même texte collé, jamais une liste de
 * correspondances qui aurait voyagé par le navigateur : ce que vous avez sous
 * les yeux et ce qui sera écrit viennent de la même lecture.
 */
export default function CollageFlux() {
  const [etat, action] = useActionState<EtatCollage, FormData>(analyserCollageAction, null);
  const [applique, appliquer] = useActionState<EtatCollage, FormData>(appliquerCollageAction, null);

  const vu = applique?.collage || etat?.collage;
  const retenues = vu?.retenues.length || 0;
  const ecarts = vu ? vu.lignes.filter((l) => l.probleme) : [];

  return (
    <article className="boite">
      <div className="boite-tete">
        <span className="fiche-titre">Reprendre le tableau de Staytle</span>
        <span className="fiche-meta">{vu ? `${retenues} correspondance(s)` : 'coller et vérifier'}</span>
      </div>

      <p className="corps">
        Sélectionnez le tableau dans l’administration de Staytle — identifiant Lodgify et adresse iCal — et collez-le
        ici tel quel. Peu importe la forme : colonnes, points-virgules, lignes libres. Chaque ligne est rattachée à
        son appartement par son <strong>identifiant Lodgify</strong>, et à défaut par son nom. Rien n’est écrit tant
        que vous n’avez pas vu ce qui a été compris.
      </p>

      <form action={action}>
        <div className="field pleine">
          <label htmlFor="colle">Le tableau, collé tel quel</label>
          <textarea
            id="colle"
            name="colle"
            rows={7}
            spellCheck={false}
            className="zone-collage"
            defaultValue={''}
            placeholder={'603177\tC202 Alcazar\thttps://…lodgify.com/…/calendar.ics'}
          />
        </div>
        <div className="actions-ligne">
          <Bouton libelle="Vérifier ce collage" />
        </div>
      </form>

      {etat?.error && <p className="avert">{etat.error}</p>}
      {applique?.error && <p className="avert">{applique.error}</p>}

      {applique?.ecrites ? (
        <p className="avert">
          <strong>{applique.ecrites} adresse(s) enregistrée(s).</strong> Le tableau ci-dessous s’est mis à jour —
          vérifiez-le, puis lancez « Relire les calendriers » pour aller chercher les réservations.
        </p>
      ) : null}

      {vu && vu.lignes.length > 0 && (
        <>
          <div className="tableau-large" style={{ marginTop: 18, maxHeight: '46vh' }}>
            <table className="grille-saisie">
              <thead>
                <tr>
                  <th>Ligne collée</th>
                  <th>Appartement</th>
                  <th>Reconnu par</th>
                  <th>Adresse</th>
                </tr>
              </thead>
              <tbody>
                {vu.lignes.map((l, i) => (
                  <tr key={i}>
                    <th scope="row" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>
                      {l.apercu}
                    </th>
                    <td>
                      {l.nom || <span className="pastille pastille-muet">non reconnu</span>}
                      {l.probleme && (
                        <span className="small muted" style={{ display: 'block' }}>
                          {l.probleme}
                        </span>
                      )}
                    </td>
                    <td>
                      {l.par === 'identifiant' ? (
                        <span className="pastille pastille-ok">identifiant {l.bienId}</span>
                      ) : l.par === 'nom' ? (
                        <span className="pastille pastille-complet">nom</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, wordBreak: 'break-all' }}>
                      {l.url || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {ecarts.length > 0 && (
            <p className="avert" style={{ marginTop: 16 }}>
              {ecarts.length} ligne(s) ne seront pas écrites. Une ligne dont l’appartement n’est pas identifié avec
              certitude est laissée telle quelle : rattacher une adresse au mauvais logement est plus coûteux que de
              ne pas la rattacher du tout, parce que la première erreur est muette et la seconde visible. Corrigez-les
              à la main dans le tableau plus bas.
            </p>
          )}

          {retenues > 0 && !applique?.ecrites && (
            <form action={appliquer} style={{ marginTop: 16 }}>
              {/* Le texte repart tel quel : l'écriture le relit plutôt que de
                  faire confiance aux correspondances affichées. */}
              <input type="hidden" name="colle" value={rassembler(vu.lignes)} />
              <Bouton libelle={`Écrire les ${retenues} adresses reconnues`} />
              <p className="hint" style={{ marginTop: 10 }}>
                Les adresses déjà saisies pour ces appartements seront remplacées. Les autres logements ne sont pas
                touchés.
              </p>
            </form>
          )}
        </>
      )}
    </article>
  );
}

/* Les lignes entières, non celles raccourcies pour l'affichage : c'est ce
   texte que l'écriture relira. On ne renvoie pas les correspondances déjà
   calculées - un aperçu qui dirait une chose et une écriture qui en ferait une
   autre serait la pire des trahisons pour une page qui sert justement à
   regarder avant d'agir. */
function rassembler(lignes: { brut: string }[]): string {
  return lignes.map((l) => l.brut).join('\n');
}
