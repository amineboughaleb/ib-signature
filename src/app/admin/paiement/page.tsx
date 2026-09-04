import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { majoration, reglages } from '@/lib/db';
import { enregistrerReglagesAction } from '../actions';

export const dynamic = 'force-dynamic';

/**
 * Les deux paiements.
 *
 * Un voyageur paiera par carte, via votre moteur, et la commission du
 * prestataire sera portée par le prix. Ou il virera la somme à Partners
 * Hotels, et il ne portera rien : c'est votre décision, et elle est nette.
 *
 * Deux moyens, donc deux prix - il n'y a pas d'échappatoire à cette
 * arithmétique. Reste à choisir de quel côté on la présente. Un supplément
 * pour paiement par carte est interdit en Europe sur les cartes de
 * particuliers ; une remise pour virement ne l'est nulle part. Le site
 * affichera donc le prix par carte comme prix du logement, et le virement
 * comme ce qu'il est pour le voyageur : une économie.
 *
 * Cette page ne calcule rien tant que la commission réelle n'est pas connue,
 * et le virement reste éteint. Un second prix fondé sur une commission
 * supposée serait un prix inventé, et un prix engage.
 */
export default async function AdminPaiement() {
  if (!(await connecte())) redirect('/admin');
  const r = reglages();

  /* Un exemple vaut mieux qu'une formule : cinq cents euros nets - l'ordre de
     grandeur d'un séjour - et ce qu'il faut encaisser pour les toucher
     vraiment. Tout se calcule dans la devise de vos prix ; seul le virement
     s'exprime en dirhams. */
  const exemple = 500;
  const brut = majoration(exemple, r);
  const ecart = brut ? ((brut - exemple) / exemple) * 100 : null;
  const connue = Boolean(r.commission_pct);
  /* Ce que le prestataire retient au total : sa commission, plus la conversion
     de devise s'il y en a une. C'est ce total que la majoration doit couvrir. */
  const nb = (v: string) => Number(String(v || '0').replace(',', '.')) || 0;
  const retenu = String(nb(r.commission_pct) + nb(r.conversion_pct)).replace('.', ',');

  return (
    <>
      <h1>Paiement</h1>
      <p className="muted" style={{ marginBottom: 30, maxWidth: '70ch' }}>
        Deux moyens de paiement, deux prix. Le prix par carte porte la commission de votre prestataire ; le virement à
        Partners Hotels ne porte rien. Le site présentera le prix par carte comme le prix du logement, et le virement
        comme une remise — c’est la seule présentation qui soit à la fois juste et vendeuse.
      </p>

      {!connue && (
        <p className="avert">
          La commission réelle n’est pas encore renseignée. Tant qu’elle ne l’est pas, le site n’affiche qu’un seul
          prix et ne propose pas le virement. C’est volontaire : un second prix calculé sur une commission supposée
          serait un prix inventé, et un prix affiché engage.
        </p>
      )}

      <form action={enregistrerReglagesAction}>
        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">La commission du prestataire</span>
            <span className="fiche-meta">{connue ? `${r.commission_pct} %` : 'inconnue'}</span>
          </div>
          <p className="corps">
            Reprenez les conditions de votre prestataire de paiement, telles qu’elles y sont écrites. S’il facture un
            pourcentage et un montant fixe par transaction, renseignez les deux : le fixe pèse lourd sur une nuit,
            peu sur une semaine.
          </p>
          <div className="grille-champs">
            <div className="field">
              <label htmlFor="cp">Pourcentage prélevé sur l’encaissement</label>
              <input id="cp" name="commission_pct" type="text" inputMode="decimal" defaultValue={r.commission_pct} placeholder="3,9" />
            </div>
            <div className="field">
              <label htmlFor="cf">Montant fixe par transaction, dans la devise de vos prix</label>
              <input id="cf" name="commission_fixe" type="text" inputMode="decimal" defaultValue={r.commission_fixe} placeholder="0,28" />
            </div>
            <div className="field">
              <label htmlFor="cc">Frais de conversion de devise</label>
              <input id="cc" name="conversion_pct" type="text" inputMode="decimal" defaultValue={r.conversion_pct} placeholder="2" />
            </div>
          </div>
          <p className="corps">
            La conversion mérite sa propre ligne. Le voyageur paie en euros, Partners Hotels est réglée en{' '}
            {r.virement_devise || 'dirhams'}, et Payyo a confirmé facturer cette conversion : <strong>2 %</strong>,
            au titre de l’article 11.2 de ses conditions. Ce n’est pas une commission de carte, mais cela sort de la
            même poche — une majoration qui l’oublie laisse un trou à chaque réservation. La case ne se vide que le
            jour où l’encaissement et le versement se feront dans la même devise ; c’est la seule façon connue de
            supprimer cette ligne, et elle vaut deux points sur chaque réservation par carte.
          </p>
          <p className="corps">
            {brut && ecart !== null ? (
              <>
                Un séjour à <strong>{exemple.toLocaleString('fr-FR')} €</strong> nets pour vous doit être encaissé à{' '}
                <strong>{brut.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €</strong> par carte, soit une
                majoration de <strong>{ecart.toFixed(2).replace('.', ',')} %</strong> — et non de {retenu} %.
                Prélever {retenu} % de ce qui est encaissé n’est pas la même chose que prendre {retenu} % de ce que
                vous voulez toucher.
              </>
            ) : (
              <>La majoration sera calculée ici dès que la commission sera renseignée.</>
            )}
          </p>
        </article>

        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Le plan tarifaire posé chez Lodgify</span>
            <span className="fiche-meta">
              {r.plan_majoration_pct ? `${r.plan_majoration_pct} %` : 'non renseigné'}
            </span>
          </div>
          <p className="corps">
            Depuis que Lodgify ajoute lui-même une ligne « frais de transaction », le prix qu’il rend n’est plus le
            prix nu du séjour : il porte déjà la majoration. Renseignez ici le taux du plan, tel qu’il est posé dans
            Lodgify, et le montant à virer devient exactement <strong>le prix moins cette ligne</strong> — celle que
            le voyageur a sous les yeux. On peut alors lui dire une phrase vérifiable : « vous ne payez pas les frais
            de transaction ». Champ vide, le site retombe sur son propre calcul : très proche, mais rattaché à aucune
            ligne visible, donc discutable.
          </p>
          <div className="grille-champs">
            <div className="field">
              <label htmlFor="pm">Taux du plan tarifaire Lodgify</label>
              <input
                id="pm"
                name="plan_majoration_pct"
                type="text"
                inputMode="decimal"
                defaultValue={r.plan_majoration_pct}
                placeholder="6,33"
              />
            </div>
          </div>
          <p className="avert">
            Une vérification à faire dans Lodgify, et elle coûte de l’argent tous les jours où elle est fausse :
            <strong> sur quelle assiette le plan s’applique-t-il ?</strong> Payyo prélève sur le montant total débité
            de la carte — hébergement, ménage et taxes compris. Un plan qui ne majore que l’hébergement laisse le
            ménage sans couverture, et vous recevez moins que prévu à chaque réservation, sans que rien ne le signale.
          </p>
        </article>

        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">L’arrivée et le départ</span>
            <span className="fiche-meta">
              {(r.sejour_checkin || '15:00')} → {(r.sejour_checkout || '11:00')}
            </span>
          </div>
          <p className="corps">
            Les mêmes pour les vingt-quatre logements et quelle que soit la durée du séjour. Ils s’écrivent ici une
            seule fois et se lisent partout : sur la fiche de chaque logement, dans les conditions générales, et dans
            le courriel de confirmation. Trois textes qui annonceraient trois heures différentes ne se règlent pas
            par un correctif — ils se règlent devant une porte fermée, avec des valises.
          </p>
          <div className="grille-champs">
            <div className="field">
              <label htmlFor="ci">Arrivée à partir de</label>
              <input id="ci" name="sejour_checkin" type="text" inputMode="numeric" defaultValue={r.sejour_checkin} placeholder="15:00" />
            </div>
            <div className="field">
              <label htmlFor="co">Départ avant</label>
              <input id="co" name="sejour_checkout" type="text" inputMode="numeric" defaultValue={r.sejour_checkout} placeholder="11:00" />
            </div>
          </div>
          <p className="hint">
            Une saisie illisible retombe sur l’heure en vigueur plutôt que d’écrire n’importe quoi : ces heures
            partent dans les conditions générales, et « 47:88 » y serait imprimé tel quel.
          </p>
        </article>

        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Les conditions d’annulation</span>
            <span className="fiche-meta">
              {Number(r.annul_jours) > 0 ? `${r.annul_jours} jour(s) avant l’arrivée` : 'non annulable'}
            </span>
          </div>
          <p className="corps">
            Elles s’affichent <strong>en tête</strong> des conditions générales de vente, et non au douzième
            paragraphe : un voyageur qui ouvre cette page vient chercher une seule chose, et la lui faire chercher
            revient à ne pas la lui donner. Elles sont écrites ici une seule fois et lues partout — la page des
            conditions, l’étape de paiement, le courriel de confirmation. Trois textes qui divergeraient sur une
            clause d’annulation ne se règlent pas par un correctif.
          </p>
          <div className="grille-champs">
            <div className="field">
              <label htmlFor="aj">Annulation gratuite jusqu’à … jours avant l’arrivée</label>
              <input id="aj" name="annul_jours" type="text" inputMode="numeric" defaultValue={r.annul_jours} placeholder="5" />
            </div>
            <div className="field">
              <label htmlFor="ar">Retenu au-delà, en % du séjour</label>
              <input id="ar" name="annul_retenu_pct" type="text" inputMode="numeric" defaultValue={r.annul_retenu_pct} placeholder="100" />
            </div>
            <div className="field">
              <label htmlFor="arj">Remboursement effectué sous … jours</label>
              <input id="arj" name="annul_rembours_jours" type="text" inputMode="numeric" defaultValue={r.annul_rembours_jours} placeholder="14" />
            </div>
          </div>
          <p className="corps">
            Zéro jour est une valeur licite : elle veut dire « aucune annulation gratuite », et la page l’écrit alors
            en toutes lettres plutôt que d’annoncer un délai de zéro jour, qui ne veut rien dire.
          </p>
          <div className="grille-champs">
            <div className="field pleine">
              <label htmlFor="anf">Une clause de votre main, ajoutée sous les conditions (français)</label>
              <textarea id="anf" name="annul_note_fr" rows={3} defaultValue={r.annul_note_fr} />
            </div>
            <div className="field pleine">
              <label htmlFor="ane">La même en anglais</label>
              <textarea id="ane" name="annul_note_en" rows={3} defaultValue={r.annul_note_en} />
            </div>
          </div>
          <p className="hint">
            Laissez ces deux champs vides et rien ne s’affiche : une section vide vaut moins que pas de section.
          </p>
        </article>

        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Le virement à Partners Hotels</span>
            <span className="fiche-meta">{r.virement_actif === '1' ? 'proposé aux voyageurs' : 'éteint'}</span>
          </div>
          <p className="corps">
            Le montant à virer est annoncé <strong>en euros</strong>, c’est-à-dire dans la devise du prix que le
            voyageur vient de lire. C’est le seul montant qui engage, et le seul qu’il puisse effectivement ordonner à
            sa banque : personne ne sait envoyer une somme de façon qu’il en arrive un nombre rond de dirhams à
            l’autre bout. Le compte de Partners Hotels reçoit bien des dirhams — c’est sa banque qui convertit.
          </p>
          <p className="corps">
            Deux délais, et l’écart entre eux n’est pas une négligence : le voyageur dispose de{' '}
            <strong>{r.virement_virer_heures || '24'} heures</strong> pour ordonner son virement, mais le calendrier
            reste fermé <strong>{r.virement_blocage_heures || '48'} heures</strong>. C’est la marge — un virement parti
            le dernier jour met encore une nuit à arriver, et annoncer le même chiffre pour les deux ferait perdre des
            réservations parties à l’heure.
          </p>
          <p className="corps">
            La contre-valeur en dirhams est affichée en dessous, présentée comme indicative et datée du jour où vous
            avez saisi le taux. Laissez le champ vide et rien ne s’affiche : mieux vaut ne rien dire qu’annoncer une
            contre-valeur d’il y a un an. Les frais bancaires restent à la charge de l’émetteur, et la page le dit —
            faute de quoi vous recevriez moins que le prix convenu, et le « sans majoration » deviendrait une
            minoration.
          </p>
          <div className="grille-champs">
            <div className="field">
              <label htmlFor="vd">Proposé si l’arrivée est à plus de … jours</label>
              <input id="vd" name="virement_delai_jours" type="text" inputMode="numeric" defaultValue={r.virement_delai_jours} />
            </div>
            <div className="field">
              <label htmlFor="vv">Le voyageur a … heures pour virer</label>
              <input id="vv" name="virement_virer_heures" type="text" inputMode="numeric" defaultValue={r.virement_virer_heures} placeholder="24" />
            </div>
            <div className="field">
              <label htmlFor="vb">Dates bloquées pendant … heures</label>
              <input id="vb" name="virement_blocage_heures" type="text" inputMode="numeric" defaultValue={r.virement_blocage_heures} />
            </div>
            <div className="field">
              <label htmlFor="vdev">Devise du compte</label>
              <input id="vdev" name="virement_devise" type="text" defaultValue={r.virement_devise} />
            </div>
            <div className="field">
              <label htmlFor="vrh">Vous répondez sous … heures</label>
              <input id="vrh" name="virement_reponse_heures" type="text" inputMode="numeric" defaultValue={r.virement_reponse_heures} />
            </div>
            <div className="field">
              <label htmlFor="tm">
                1 {r.virement_devise === 'MAD' ? '€' : 'unité'} = … dirhams
                {r.taux_mad_date ? ` — saisi le ${r.taux_mad_date}` : ''}
              </label>
              <input id="tm" name="taux_mad" type="text" inputMode="decimal" defaultValue={r.taux_mad} placeholder="10,8" />
            </div>
            <div className="field">
              <label htmlFor="vben">Bénéficiaire</label>
              <input id="vben" name="virement_beneficiaire" type="text" defaultValue={r.virement_beneficiaire} />
            </div>
            <div className="field pleine">
              <label htmlFor="vrib">Coordonnées bancaires communiquées au voyageur</label>
              <textarea id="vrib" name="virement_rib" rows={4} defaultValue={r.virement_rib} placeholder="Banque, RIB, IBAN, SWIFT" />
            </div>
          </div>
          <input type="hidden" name="virement_frais" value="client" />
          <input type="hidden" name="virement_part" value="totalite" />
          <label className="bascule">
            <input type="checkbox" name="virement_actif" defaultChecked={r.virement_actif === '1'} />
            Proposer le virement bancaire aux voyageurs
          </label>
        </article>

        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Quand l’argent arrive vraiment</span>
          </div>
          <p className="corps">
            Ce n’est pas la même chose de gagner une réservation et d’en disposer. Par carte, les versements sont
            mensuels, le 5, et calculés sur la <strong>date de séjour</strong> et non sur la date de réservation : une
            semaine de juillet vendue en février n’est versée qu’au début du mois d’août. Les trois premiers mois,
            10 % du volume sont en outre retenus en réserve. À cela s’ajoutent 5 € par versement, le Maroc étant
            hors zone SEPA, et le report du versement tant que le seuil de 50 USD n’est pas atteint.
          </p>
          <p className="corps">
            Le virement, lui, arrive sur le compte de Partners Hotels avant l’arrivée du voyageur. L’écart entre les
            deux moyens de paiement n’est donc pas seulement de quelques pour cent : c’est aussi plusieurs mois de
            trésorerie, et un risque de rétrofacturation qui n’existe pas sur un virement. Cela mérite d’être pesé
            avant de fixer le seuil de {r.virement_delai_jours} jours.
          </p>
        </article>

        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Ce qui reste manuel, et pourquoi</span>
          </div>
          <p className="corps">
            Un virement met de quelques heures à quelques jours à arriver, et davantage depuis l’étranger. Pendant ce
            temps, la semaine ne doit être vendue à personne d’autre : les dates sont donc bloquées{' '}
            {r.virement_blocage_heures} heures, le temps que vous receviez l’avis de virement. Passé ce délai sans
            avis, elles se libèrent d’elles-mêmes — un blocage qui ne s’éteint pas finit par geler un calendrier
            entier.
          </p>
          <p className="corps">
            C’est aussi pourquoi le virement n’est proposé qu’au-delà de {r.virement_delai_jours} jours avant
            l’arrivée. En deçà, seul le paiement par carte tient la promesse faite au voyageur.
          </p>
        </article>

        <div className="actions-ligne">
          <button type="submit" className="btn-mini">
            Enregistrer
          </button>
        </div>
      </form>
    </>
  );
}
