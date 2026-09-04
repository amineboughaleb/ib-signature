'use client';

import { useEffect } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { demanderVirementAction, type EtatVirement } from '@/app/actions';
import { getT } from '@/lib/i18n';

/**
 * L'étape où le voyageur se présente, et choisit comment il paie.
 *
 * Un seul formulaire pour les deux chemins, et c'est le bouton pressé qui
 * décide - `<button name="moyen" value="carte">` transporte sa propre valeur.
 * Deux formulaires distincts obligeraient à saisir deux fois les mêmes
 * coordonnées, ou à les recopier de l'un dans l'autre ; un champ caché
 * synchronisé au clic ajouterait un état de plus à tenir juste.
 *
 * Les coordonnées sont demandées AVANT le choix du moyen, et c'est délibéré :
 * elles sont enregistrées dans les deux cas. Un voyageur qui part chez Lodgify
 * et renonce devant le formulaire de carte laisse ainsi un nom et un numéro,
 * au lieu de disparaître. C'est la moitié silencieuse de cette page.
 */

function Boutons({
  virement,
  libelleVirement,
  libelleCarte,
  montantVirement,
  montantCarte,
  noteVirement,
  mad,
  tenue,
}: {
  virement: boolean;
  libelleVirement: string;
  libelleCarte: string;
  montantVirement?: string;
  montantCarte?: string;
  noteVirement?: string;
  mad?: string;
  tenue?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <div className="paiement-boutons">
      {/* Le virement d'abord quand il est possible : c'est le moins cher pour
          le voyageur et le plus sûr pour la maison. */}
      {virement && (
        <button type="submit" name="moyen" value="virement" className="btn btn-block-or" disabled={pending}>
          {pending ? '…' : libelleVirement}
          {montantVirement && <span className="paiement-bouton-prix">{montantVirement}</span>}
        </button>
      )}
      {/* La contre-valeur en dirhams est indicative, et le dit. Seul le
          montant en euros engage : un voyageur qui virerait le chiffre en
          dirhams d'un taux d'hier paierait autre chose que ce qui est dû. */}
      {virement && mad && <p className="hint paiement-mad">{mad}</p>}
      {virement && noteVirement && <p className="hint paiement-eco">{noteVirement}</p>}
      {virement && tenue && <p className="hint paiement-tenue">{tenue}</p>}
      <button
        type="submit"
        name="moyen"
        value="carte"
        /* Quand le virement est proposé, la carte prend la forme discrète :
           les deux restent au même endroit et de la même taille, mais l'œil
           voit lequel la maison recommande. Quand le virement n'est pas
           possible, la carte redevient le bouton principal - un bouton
           d'apparence secondaire qui est le seul chemin ferait douter. */
        className={`btn btn-block-or${virement ? ' btn-ghost' : ''}`}
        disabled={pending}
      >
        {pending ? '…' : libelleCarte}
        {montantCarte && <span className="paiement-bouton-prix">{montantCarte}</span>}
      </button>
    </div>
  );
}

export default function FormulaireReservation({
  locale,
  slug,
  arrivee,
  depart,
  voyageurs,
  virement,
  montantVirement,
  montantCarte,
  noteVirement,
  mad,
  tenue,
  heures,
  heuresVirer,
  heuresBlocage,
  titre,
  resumeAnnulation,
  resume,
}: {
  locale: string;
  slug: string;
  arrivee: string;
  depart: string;
  voyageurs: number;
  /** Vrai quand les sept conditions du virement sont réunies. */
  virement: boolean;
  montantVirement?: string;
  montantCarte?: string;
  noteVirement?: string;
  /** La contre-valeur en dirhams, avec le taux et sa date. Indicative. */
  mad?: string;
  /** Combien de temps les dates sont tenues, une fois la demande déposée. */
  tenue?: string;
  heures: number;
  /** Heures dont dispose le voyageur pour virer, et heures de calendrier fermé. */
  heuresVirer: number;
  heuresBlocage: number;
  /** Le titre de la page. Il vit ici parce que lui aussi change d'état :
      « Comment souhaitez-vous régler ? » n'a plus de sens une fois qu'on a
      choisi, et le voyageur relisait une question déjà répondue. */
  titre: string;
  /** Les conditions d'annulation en une ligne, sous la case a cocher. */
  resumeAnnulation?: string;
  /** Le récapitulatif, rendu par le serveur : il porte le prix, donc il reste là-bas. */
  resume: React.ReactNode;
}) {
  const t = getT(locale);
  const [etat, action] = useActionState<EtatVirement, FormData>(demanderVirementAction, null);

  /* Le départ vers Lodgify.
     La navigation se fait ici et non par une redirection du serveur : le
     voyageur voit d'abord que sa demande est prise, puis part. Une redirection
     immédiate donnerait l'impression que le formulaire n'a rien fait. */
  useEffect(() => {
    if (etat?.versLodgify) {
      /* Deux secondes : assez pour lire la ligne qui explique où l'on va -
         partir sans prévenir sur un site qui ne porte pas le même nom se lit
         comme une erreur -, trop peu pour donner envie d'attendre. Le lien
         reste là pour qui veut y aller tout de suite. */
      const t = setTimeout(() => {
        window.location.href = etat.versLodgify!;
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [etat?.versLodgify]);

  if (etat?.versLodgify) {
    return (
      <>
      <h1 className="etape-titre">{t('res_carte_h1')}</h1>
      <div className="card card-pad virement-merci">
        <hr className="filet-or" />
        <h3 style={{ marginBottom: 8 }}>{t('res_carte_route_titre')}</h3>
        <p className="muted">{t('res_carte_route_texte')}</p>
        <p style={{ marginTop: 20 }}>
          <a className="lien" href={etat.versLodgify}>
            {t('res_carte_route_lien')}
          </a>
        </p>
      </div>
      </>
    );
  }

  /* La confirmation du virement passe avant tout le reste.

     Enregistrer la demande rend aussitôt ces dates « déjà tenues » - par le
     voyageur lui-même. Une page qui se reconstruirait sur cette nouvelle
     réalité effacerait la confirmation à la seconde où elle s'affiche, et le
     voyageur verrait son formulaire disparaître sans savoir si sa demande est
     partie. C'est arrivé. */
  if (etat?.ok) {
    return (
      <>
      <h1 className="etape-titre">{t('res_merci_h1')}</h1>
      <div className="card card-pad virement-merci">
        <hr className="filet-or" />
        <h3 style={{ marginBottom: 8 }}>{t('res_merci_titre')}</h3>
        {/* Les coordonnees bancaires sont sous les yeux du voyageur : lui
            annoncer qu'on va les lui « adresser sous douze heures » etait un
            texte d'avant, quand elles arrivaient par courriel. Ce qu'il a
            besoin de savoir maintenant, c'est le temps dont il dispose. */}
        <p className="muted" style={{ marginBottom: 24 }}>
          {t('res_merci_texte', { v: heuresVirer, h: heuresBlocage })}
        </p>

        <div className="virement-ref">
          <span className="surtitre">{t('res_ref')}</span>
          <b>{etat.reference}</b>
        </div>
        <p className="hint" style={{ marginTop: 10 }}>
          {t('res_ref_note')}
        </p>

        <dl className="coordonnees" style={{ marginTop: 26 }}>
          <div>
            <dt>{t('res_recap')}</dt>
            <dd>{etat.montant}</dd>
          </div>
          {etat.beneficiaire && (
            <div>
              <dt>{locale === 'en' ? 'Beneficiary' : 'Bénéficiaire'}</dt>
              <dd>{etat.beneficiaire}</dd>
            </div>
          )}
        </dl>

        {/* Les coordonnées bancaires telles qu'elles ont été saisies : un RIB
            se recopie chiffre par chiffre, et la moindre reformulation
            automatique en ferait un RIB faux. */}
        {etat.rib && <pre className="virement-rib">{etat.rib}</pre>}
      </div>
      </>
    );
  }

  return (
    <>
    <h1 className="etape-titre">{titre}</h1>
    <form action={action} className="reserver-grille">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="arrivee" value={arrivee} />
      <input type="hidden" name="depart" value={depart} />
      <input type="hidden" name="voyageurs" value={voyageurs} />

      <div className="card card-pad reserver-coordonnees">
        <hr className="filet-or" />
        <h2 style={{ marginBottom: 6 }}>{t('res_vous_titre')}</h2>
        <p className="muted small" style={{ marginBottom: 26 }}>
          {t('res_vous_texte')}
        </p>

        <div className="champs-paire">
          <div className="field">
            <label htmlFor="r_prenom">{t('res_prenom')}</label>
            <input id="r_prenom" name="prenom" type="text" required autoComplete="given-name" />
          </div>
          <div className="field">
            <label htmlFor="r_nom">{t('res_nom_famille')}</label>
            <input id="r_nom" name="nom" type="text" required autoComplete="family-name" />
          </div>
        </div>

        {/* Nationalité et résidence sont deux choses différentes, et la
            confusion coûte cher au moment de la fiche de police : on peut
            résider à Casablanca avec un passeport français. Deux champs
            libres, sans liste imposée - une liste de nationalités est toujours
            fausse pour quelqu'un. */}
        <div className="champs-paire">
          <div className="field">
            <label htmlFor="r_nat">{t('res_nationalite')}</label>
            <input id="r_nat" name="nationalite" type="text" autoComplete="country-name" />
          </div>
          <div className="field">
            <label htmlFor="r_res">{t('res_residence')}</label>
            <input id="r_res" name="residence" type="text" autoComplete="address-level2" />
          </div>
        </div>

        <div className="champs-paire">
          <div className="field">
            <label htmlFor="r_email">{t('res_email')}</label>
            <input id="r_email" name="email" type="email" required autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="r_tel">{t('res_tel')}</label>
            <input id="r_tel" name="telephone" type="tel" required autoComplete="tel" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="r_msg">{t('res_message')}</label>
          <textarea id="r_msg" name="message" rows={3} />
        </div>
      </div>

      <aside className="reserver-colonne">
        {resume}

        <div className="card card-pad reserver-paiement">
          <span className="surtitre">{t('res_paiement_titre')}</span>

          <label className="cgv">
            <input type="checkbox" name="cgv" value="1" required />
            {/* Le milieu de la phrase est un lien, et il s'ouvre dans un
                onglet neuf : quitter la page perdrait six champs deja saisis,
                et un voyageur qui doit tout retaper pour avoir ose lire les
                conditions ne les lit plus. */}
            <span>
              {t('res_cgv_avant')}
              <a href={`/${locale}/cgv`} target="_blank" rel="noopener noreferrer">
                {t('res_cgv_lien')}
              </a>
              {t('res_cgv_apres')}
            </span>
          </label>

          {/* Le point qui compte, en clair sous la case. Renvoyer a un lien
              pour la seule information que le voyageur cherche vraiment, c'est
              la lui cacher poliment. */}
          {resumeAnnulation && <p className="hint cgv-resume">{resumeAnnulation}</p>}

          {etat?.error && <p className="avert" style={{ marginTop: 16 }}>{etat.error}</p>}

          <Boutons
            virement={virement}
            libelleVirement={t('res_virement_bouton')}
            libelleCarte={t('res_carte_bouton')}
            montantVirement={montantVirement}
            montantCarte={montantCarte}
            noteVirement={noteVirement}
            mad={mad}
            tenue={tenue}
          />

          <p className="hint" style={{ marginTop: 16 }}>
            {virement ? t('res_frais') : t('res_seule_carte')}
          </p>
        </div>
      </aside>
    </form>
    </>
  );
}
