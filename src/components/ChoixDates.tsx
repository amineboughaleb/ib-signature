'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getT } from '@/lib/i18n';
import Calendrier from './Calendrier';

/**
 * Choisir ses dates sur la fiche d'un logement.
 *
 * Il manquait, et c'est le genre d'absence qu'on ne voit pas quand on arrive
 * toujours par la recherche : les dates ne pouvaient être saisies que sur la
 * barre de la page des logements, et se transmettaient ensuite par l'adresse.
 * Un voyageur qui arrive directement sur une fiche - depuis un moteur de
 * recherche, depuis un lien qu'on lui a envoyé - se trouvait donc devant un
 * appartement, un prix « à partir de », et aucun moyen de demander SES dates.
 * Il fallait qu'il remonte à la liste pour redescendre. Beaucoup ne remontent
 * pas.
 *
 * Le composant ne cherche rien lui-même : il repose les dates dans l'adresse
 * de la page où l'on est déjà, et c'est le serveur qui recalcule tout - le
 * prix du séjour, le séjour minimum, la disponibilité, et jusqu'au moyen de
 * paiement proposé. Une adresse qui porte les dates se partage, se met en
 * favori, et revient telle quelle avec le bouton « précédent ».
 */
export default function ChoixDates({
  locale,
  slug,
  arrivee: arriveeInitiale,
  depart: departInitial,
  voyageurs: voyageursInitiaux,
  libelle,
}: {
  locale: string;
  slug: string;
  arrivee: string;
  depart: string;
  voyageurs: number;
  libelle: string;
}) {
  const t = getT(locale);
  const router = useRouter();
  const [arrivee, setArrivee] = useState(arriveeInitiale);
  const [depart, setDepart] = useState(departInitial);
  const [voyageurs, setVoyageurs] = useState(String(voyageursInitiaux || 2));

  /* On ne part qu'avec une période complète. Une arrivée sans départ ne
     décrit aucun séjour, et recharger la page pour rien ferait clignoter un
     prix sans jamais le changer. */
  function voir(a: string, d: string, v: string) {
    if (!a || !d) return;
    const p = new URLSearchParams({ arrivee: a, depart: d, voyageurs: v });
    router.push(`/${locale}/logements/${slug}?${p}`);
  }

  return (
    <div className="reserver-dates-choix">
      <Calendrier
        locale={locale}
        arrivee={arrivee}
        depart={depart}
        onChange={(a, d) => {
          setArrivee(a);
          setDepart(d);
          voir(a, d, voyageurs);
        }}
        libelles={{
          arrivee: t('rech_arrivee'),
          depart: t('rech_depart'),
          ajouter: t('rech_ajouter_date'),
          effacer: t('rech_effacer_dates'),
          nuits: (n) => t('liste_nuits', { n }),
        }}
      />
      <div className="field">
        <label htmlFor="f-voyageurs">{t('rech_voyageurs')}</label>
        <select
          id="f-voyageurs"
          value={voyageurs}
          onChange={(e) => {
            setVoyageurs(e.target.value);
            voir(arrivee, depart, e.target.value);
          }}
        >
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      {/* Sans dates, rien n'est calculable : on le dit plutôt que d'afficher
          un bouton qui promet un prix qu'il n'a pas. */}
      {(!arrivee || !depart) && <p className="hint">{libelle}</p>}
    </div>
  );
}
