import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { biens } from '@/lib/biens';
import { fluxTous } from '@/lib/db';
import { estLodgify, etatDesFlux, fraicheurDesFlux } from '@/lib/flux';
import { ETATS_ICAL, etatIcal, parGraviteIcal, type EtatIcal } from '@/lib/calendrier';
import { enregistrerFluxAction, importerFluxAction } from '../actions';
import CollageFlux from '@/components/CollageFlux';

export const dynamic = 'force-dynamic';

/**
 * Les calendriers, en un geste.
 *
 * Un seul calendrier par logement, et c'est celui de Lodgify. Ce n'est pas une
 * économie de moyens : c'est la seule source qui soit complète. Lodgify est le
 * gestionnaire de canaux - Airbnb, Booking et Vrbo y déversent leurs
 * réservations, et les séjours vendus hors plateforme y sont saisis. Importer
 * le calendrier d'Airbnb à côté n'ajouterait rien, et s'y fier à sa place
 * serait un recul : il ignore les réservations directes, et afficher libre une
 * semaine vendue au téléphone est précisément la faute qu'on cherche à éviter.
 *
 * Deux choses à ne pas confondre. Cette page ne peut pas demander à Lodgify de
 * relancer SES importations depuis Airbnb - son API n'expose rien pour cela, et
 * un bouton qui le prétendrait ferait croire qu'on a agi. Elle lit le résultat
 * de ces importations, ce qui est autre chose et suffit : c'est ce résultat qui
 * décide si le site peut vendre une semaine.
 *
 * Reste à dire pourquoi lire ce calendrier alors que l'API de Lodgify répond
 * déjà. Parce qu'elle ne répond pas toujours de la même façon : le chemin des
 * disponibilités n'est pas documenté et change d'une offre à l'autre. L'export
 * iCal, lui, est une adresse stable que Lodgify publie pour être lue. C'est la
 * même vérité par une porte plus sûre.
 */
export default async function AdminCalendriers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await connecte())) redirect('/admin');

  const q = await searchParams;
  const seul = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';
  const mois = Math.min(24, Number(seul(q.mois)) || 12);

  const catalogue = await biens();
  const flux = fluxTous();
  const parBien = new Map(flux.map((f) => [f.bien_id, f]));
  const { debut, fin, lignes: brutes } = etatDesFlux(mois);
  const noms = new Map(catalogue.map((b) => [b.id, b]));

  const lignes = brutes
    .map((l) => {
      const b = noms.get(l.bien_id);
      return { ...l, nom: b?.nom || `Logement ${l.bien_id}`, ville: b?.ville || '', etat: etatIcal(l) };
    })
    .sort(parGraviteIcal);

  const jour = (s?: string) => (s ? new Date(`${s}T00:00:00Z`).toLocaleDateString('fr-FR') : '—');
  const quand = (s: string) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString('fr-FR') : 'jamais');

  const compte = (e: EtatIcal) => lignes.filter((l) => l.etat === e).length;
  const derniereLecture = flux.map((f) => f.dernier_ok).filter(Boolean).sort().pop() || '';
  const sansAdresse = catalogue.filter((b) => !parBien.has(b.id));
  const horsLodgify = flux.filter((f) => !estLodgify(f.url));
  const fraicheur = fraicheurDesFlux();

  return (
    <>
      <p className="fil">
        <Link href="/admin/logements">Logements</Link> · Calendriers
      </p>
      <h1 style={{ marginTop: 6 }}>Calendriers</h1>
      <p className="muted" style={{ marginBottom: 26, maxWidth: '72ch' }}>
        Un calendrier par logement, celui de Lodgify, relu chaque nuit à 3 h — et en un geste quand vous le
        souhaitez.
      </p>

      {/* La fraîcheur avant tout le reste.

          Un calendrier importé ne se signale jamais périmé : il continue de
          répondre « rien à signaler » avec la même assurance le jour de son
          import et trois semaines plus tard. Or c'est sur lui que repose la
          garde du virement, la seule règle de ce site dont la violation coûte
          de l'argent réel. Cette ligne est donc la première de la page. */}
      {(fraicheur.perimes > 0 || fraicheur.jamaisLus > 0) && (
        <p className="avert">
          <strong>
            {fraicheur.perimes > 0
              ? `${fraicheur.perimes} calendrier(s) datent de plus de 36 heures`
              : `${fraicheur.jamaisLus} calendrier(s) n’ont jamais été lus`}
            .
          </strong>{' '}
          Le site cesse de s’y fier : sur ces logements, il ne dit plus « libre », il dit « je ne sais pas », et le
          virement n’est plus proposé plutôt que d’être proposé sur une semaine peut-être déjà vendue. La
          tâche planifiée de 3 h n’a peut-être pas tourné — ou la variable <code>CRON_SECRET</code> n’est pas
          renseignée. Le bouton ci-dessous répare tout de suite.
        </p>
      )}
      {fraicheur.perimes === 0 && fraicheur.jamaisLus === 0 && fraicheur.pireAgeH !== null && (
        <p className="hint" style={{ marginBottom: 20 }}>
          Tous les calendriers ont moins de {Math.max(1, Math.ceil(fraicheur.pireAgeH))} heure(s).
        </p>
      )}

      <p className="avert">
        <strong>Une seule adresse par logement, et c’est celle de Lodgify.</strong> Votre gestionnaire de canaux
        reçoit Airbnb, Booking et Vrbo, et vous y saisissez les séjours vendus hors plateforme : son calendrier est
        donc le seul qui contienne tout. Celui d’Airbnb n’ajouterait rien — ces nuits y sont déjà — et s’y fier à sa
        place serait un recul, puisqu’il ignore vos réservations directes.
      </p>
      <p className="avert">
        À ne pas confondre : cette page ne demande pas à Lodgify de relancer <em>ses</em> importations depuis Airbnb —
        son API n’expose rien pour cela. Elle en lit le résultat, ce qui est autre chose et suffit : c’est ce résultat
        qui décide si le site peut vendre une semaine. Un séjour trouvé ici bloque immédiatement le virement sur ces
        dates.
      </p>

      {/* ---------- le bouton maître ---------- */}
      <article className="boite">
        <div className="boite-tete">
          <span className="fiche-titre">Relire les calendriers</span>
          <span className="fiche-meta">
            {flux.length ? `${flux.length} sur ${catalogue.length} · ${quand(derniereLecture)}` : 'aucune adresse'}
          </span>
        </div>

        {flux.length === 0 ? (
          <p className="corps">
            Aucune adresse n’est encore déclarée. Dans Lodgify, ouvrez la propriété, puis Calendrier →
            Synchronisation → export iCal, et collez l’adresse dans le tableau plus bas. Une par logement.
          </p>
        ) : (
          <>
            <p className="corps">
              {flux.length} logement(s) sur {catalogue.length} ont leur calendrier.
              {sansAdresse.length > 0 && (
                <>
                  {' '}
                  <strong>{sansAdresse.length} n’en ont pas</strong> — pour ceux-là le site ne sait rien, et comme ne
                  rien savoir n’est pas savoir que c’est libre, il ne bloque rien non plus. C’est le seul endroit du
                  site où une case laissée vide vous coûte quelque chose.
                </>
              )}
            </p>
            <form action={importerFluxAction}>
              <button type="submit" className="btn-mini">
                Relire les {flux.length} calendriers maintenant
              </button>
            </form>
            <p className="hint" style={{ marginTop: 12 }}>
              Comptez une dizaine de secondes, davantage si un calendrier traîne. Au-delà de quarante-cinq secondes la
              page rend la main et indique ce qui n’a pas été relu : ces calendriers-là gardent ce qu’on savait
              d’eux, et un second clic les reprend. Si le navigateur affiche « Failed to fetch », rechargez la page
              (Ctrl+F5) et recommencez — c’est ce qui arrive quand la page a été ouverte avant le dernier
              redémarrage du serveur.
            </p>
          </>
        )}
      </article>

      {horsLodgify.length > 0 && (
        <p className="avert">
          {horsLodgify.length} adresse(s) ne viennent pas de Lodgify (
          {[...new Set(horsLodgify.map((f) => f.source))].join(', ')}). Elles fonctionnent, mais elles sont
          incomplètes : le calendrier d’une plateforme ignore ce qui a été vendu ailleurs, à commencer par vos
          réservations directes. Remplacez-les par l’export Lodgify du même logement.
        </p>
      )}

      {/* ---------- l'état, lu dans les calendriers ---------- */}
      {lignes.length > 0 && (
        <>
          <div className="actions-ligne" style={{ margin: '34px 0 16px' }}>
            {[3, 6, 12, 18].map((m) => (
              <Link
                key={m}
                className={`btn-mini${m === mois ? ' btn-mini-actif' : ''}`}
                href={`/admin/calendriers?mois=${m}`}
              >
                {m} mois
              </Link>
            ))}
          </div>

          <p className="corps" style={{ maxWidth: '72ch' }}>
            Du {jour(debut)} au {jour(fin)}. {compte('muet')} calendrier(s) muet(s), {compte('vide')} sans aucune
            réservation, {compte('plein')} complet(s).
          </p>

          <div className="tableau-large" style={{ marginTop: 20 }}>
            <table className="grille-saisie">
              <thead>
                <tr>
                  <th>Logement</th>
                  <th>État</th>
                  <th>Nuits prises</th>
                  <th>Taux</th>
                  <th>Séjours</th>
                  <th>Prochaine nuit prise</th>
                  <th>Réservation la plus lointaine</th>
                  <th>Lu le</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.bien_id}>
                    <th scope="row">
                      <Link href={`/admin/logements/${l.bien_id}`}>{l.nom}</Link>
                      <span className="small muted">{l.ville}</span>
                    </th>
                    <td>
                      <span className={`pastille pastille-${l.etat}`}>{ETATS_ICAL[l.etat].mot}</span>
                    </td>
                    <td>{l.connu ? `${l.occupes} / ${l.total}` : '—'}</td>
                    <td>{l.connu && l.total ? `${Math.round((l.occupes / l.total) * 100)} %` : '—'}</td>
                    <td>{l.connu ? l.sejours : '—'}</td>
                    <td>{jour(l.prochaine)}</td>
                    <td>{jour(l.derniere)}</td>
                    <td>{l.erreur ? <span className="pastille pastille-muet">{l.erreur}</span> : quand(l.luLe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="legende">
            {(Object.keys(ETATS_ICAL) as EtatIcal[])
              .filter((e) => ETATS_ICAL[e].quoi)
              .map((e) => (
                <div key={e}>
                  <dt>
                    <span className={`pastille pastille-${e}`}>{ETATS_ICAL[e].mot}</span>
                  </dt>
                  <dd>{ETATS_ICAL[e].quoi}</dd>
                </div>
              ))}
          </dl>

          <p className="muted small" style={{ maxWidth: '72ch', marginTop: 22 }}>
            Un flux iCal ne liste que les réservations, jamais les jours libres. Un logement sans réservation au-delà
            de deux mois rend donc exactement le même calendrier qu’un logement dont la connexion serait tombée, et
            rien ne permet de les distinguer : cette page ne prétend donc pas le faire. « Aucune réservation » se lit
            par comparaison — un logement vide au milieu de vingt-trois calendriers remplis mérite qu’on ouvre
            Lodgify ; en janvier, cela ne veut peut-être rien dire.
          </p>
        </>
      )}

      {/* ---------- les adresses ---------- */}
      <h2 style={{ marginTop: 48 }}>Les adresses des calendriers</h2>
      <p className="muted" style={{ maxWidth: '72ch', marginBottom: 20 }}>
        Une adresse par logement. Dans Lodgify : la propriété, puis Calendrier → Synchronisation → export iCal. Les{' '}
        <code>webcal:</code> sont acceptés tels quels, c’est ce que met le bouton « copier ». Vider une case efface le
        calendrier de ce logement, et le site cesse alors de bloquer quoi que ce soit pour lui.
      </p>

      {/* Les mêmes appartements sont déjà décrits dans l'administration de
          Staytle, identifiant Lodgify et adresse iCal compris. Les ressaisir
          ici serait vingt-quatre occasions de se tromper d'une ligne. */}
      <CollageFlux />

      <h3 style={{ marginTop: 40 }}>Ou une adresse à la fois</h3>

      <form action={enregistrerFluxAction}>
        <div className="tableau-large">
          <table className="grille-saisie">
            <thead>
              <tr>
                <th>Logement</th>
                <th>Adresse du calendrier Lodgify</th>
                <th>Provenance</th>
              </tr>
            </thead>
            <tbody>
              {catalogue.map((b) => {
                const f = parBien.get(b.id);
                return (
                  <tr key={b.id}>
                    <th scope="row">
                      <Link href={`/admin/logements/${b.id}`}>{b.nom}</Link>
                      <span className="small muted">{b.ville}</span>
                    </th>
                    <td className="large">
                      <input
                        name={`flux_${b.id}`}
                        type="text"
                        spellCheck={false}
                        defaultValue={f?.url || ''}
                        placeholder="https://…lodgify.com/…/calendar.ics"
                        aria-label={`Calendrier de ${b.nom}`}
                      />
                    </td>
                    <td>
                      {f ? (
                        <span className={`pastille ${estLodgify(f.url) ? 'pastille-ok' : 'pastille-muet'}`}>
                          {f.source}
                        </span>
                      ) : (
                        <span className="muted small">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="actions-ligne" style={{ marginTop: 22 }}>
          <button type="submit" className="btn-mini">
            Enregistrer les adresses
          </button>
        </div>
      </form>
    </>
  );
}
