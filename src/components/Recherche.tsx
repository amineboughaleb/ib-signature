'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getT } from '@/lib/i18n';
import Calendrier from './Calendrier';

/**
 * La barre de recherche.
 *
 * Elle ne cherche rien elle-même : elle porte ses quatre valeurs dans
 * l'adresse de la page des appartements, qui filtre côté serveur. Un formulaire
 * qui se contente de composer une adresse fonctionne sans JavaScript, se
 * partage, se met en favori, et revient tel quel avec le bouton « précédent ».
 */
export default function Recherche({
  locale,
  villes,
  valeurs,
}: {
  locale: string;
  villes: string[];
  /* Sur la page de liste, la barre se rouvre remplie : rien n'est plus
     déroutant qu'un filtre appliqué que le formulaire n'affiche plus. */
  valeurs?: { ville?: string; arrivee?: string; depart?: string; voyageurs?: string };
}) {
  const t = getT(locale);
  const router = useRouter();
  const [ville, setVille] = useState(valeurs?.ville || '');
  const [arrivee, setArrivee] = useState(valeurs?.arrivee || '');
  const [depart, setDepart] = useState(valeurs?.depart || '');
  const [voyageurs, setVoyageurs] = useState(valeurs?.voyageurs || '2');

  function chercher(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (ville) p.set('ville', ville);
    if (arrivee) p.set('arrivee', arrivee);
    if (depart) p.set('depart', depart);
    if (voyageurs) p.set('voyageurs', voyageurs);
    router.push(`/${locale}/logements${p.toString() ? `?${p}` : ''}`);
  }

  return (
    <form className="recherche" onSubmit={chercher}>
      <div className="rech-seg">
        <label htmlFor="r-ville">{t('rech_ville')}</label>
        <select id="r-ville" value={ville} onChange={(e) => setVille(e.target.value)}>
          <option value="">{t('rech_toutes')}</option>
          {villes.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {/* Un seul segment pour les deux dates : on ne choisit pas une arrivée
          puis un départ, on choisit une période. */}
      <div className="rech-seg rech-seg-dates">
        <Calendrier
          locale={locale}
          arrivee={arrivee}
          depart={depart}
          onChange={(a, d) => {
            setArrivee(a);
            setDepart(d);
          }}
          libelles={{
            arrivee: t('rech_arrivee'),
            depart: t('rech_depart'),
            ajouter: t('rech_ajouter_date'),
            effacer: t('rech_effacer_dates'),
            nuits: (n) => t('liste_nuits', { n }),
          }}
        />
      </div>
      <div className="rech-seg rech-seg-court">
        <label htmlFor="r-voyageurs">{t('rech_voyageurs')}</label>
        <select id="r-voyageurs" value={voyageurs} onChange={(e) => setVoyageurs(e.target.value)}>
          {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn rech-btn">
        {t('rech_chercher')}
      </button>
    </form>
  );
}
