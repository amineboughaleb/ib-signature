'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Le calendrier d'arrivée et de départ.
 *
 * Il remplace deux champs `type="date"`. Ceux-ci ont l'air de champs de saisie
 * libre, et ils le sont : le navigateur y impose son propre format, si bien
 * qu'un visiteur français voyait « mm/dd/yyyy » sur un site français. Ils ne
 * montrent pas non plus la relation entre les deux dates, alors que réserver
 * c'est choisir une période, pas deux nombres.
 *
 * D'où un vrai calendrier : deux mois côte à côte, un premier clic pose
 * l'arrivée, un second le départ, et la traînée entre les deux se colore. Un
 * clic après une période déjà choisie recommence une nouvelle sélection - c'est
 * ce que fait le visiteur neuf fois sur dix quand il change d'avis, et lui
 * demander d'effacer d'abord serait une politesse inutile.
 *
 * Ce qui est impossible n'est pas cliquable : le passé, et tout ce qui précède
 * l'arrivée pendant qu'on choisit le départ. Une nuit se compte d'un jour au
 * suivant, donc un départ le jour même de l'arrivée n'existe pas.
 *
 * Les valeurs restent au format ISO dans deux champs cachés : le reste du site,
 * l'adresse de la page et Lodgify parlent tous cette langue. Seul l'affichage
 * est traduit.
 */

const MOIS = {
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
/* La semaine commence le lundi : c'est l'usage au Maroc comme en Europe, et
   décaler d'un jour fait manquer un week-end à la lecture. */
const JOURS = {
  fr: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const depuisIso = (s: string) => {
  const [a, m, j] = s.split('-').map(Number);
  return a && m && j ? new Date(a, m - 1, j) : null;
};

/** « 12 sept. » - court, sans l'année tant qu'elle est celle en cours. */
function bref(s: string, locale: string): string {
  const d = depuisIso(s);
  if (!d) return '';
  const nom = MOIS[locale === 'en' ? 'en' : 'fr'][d.getMonth()];
  const abrege = locale === 'en' ? nom.slice(0, 3) : nom.length > 4 ? `${nom.slice(0, 4)}.` : nom;
  const annee = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()} ${abrege}${annee}`;
}

function grille(annee: number, mois: number): (Date | null)[] {
  const premier = new Date(annee, mois, 1);
  /* getDay() rend 0 pour dimanche : on décale pour que lundi vaille 0. */
  const decalage = (premier.getDay() + 6) % 7;
  const jours = new Date(annee, mois + 1, 0).getDate();
  const cases: (Date | null)[] = Array(decalage).fill(null);
  for (let j = 1; j <= jours; j++) cases.push(new Date(annee, mois, j));
  return cases;
}

export default function Calendrier({
  locale,
  arrivee,
  depart,
  onChange,
  libelles,
}: {
  locale: string;
  arrivee: string;
  depart: string;
  onChange: (arrivee: string, depart: string) => void;
  libelles: { arrivee: string; depart: string; ajouter: string; effacer: string; nuits: (n: number) => string };
}) {
  const [ouvert, setOuvert] = useState(false);
  /* Le mois affiché à gauche. On ouvre sur le mois de l'arrivée déjà choisie,
     sinon sur le mois courant. */
  const [curseur, setCurseur] = useState(() => {
    const d = depuisIso(arrivee) || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [survol, setSurvol] = useState('');
  const boite = useRef<HTMLDivElement>(null);

  const aujourdhui = useMemo(() => iso(new Date()), []);
  const lang = locale === 'en' ? 'en' : 'fr';

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && setOuvert(false);
    document.addEventListener('mousedown', dehors);
    window.addEventListener('keydown', echap);
    return () => {
      document.removeEventListener('mousedown', dehors);
      window.removeEventListener('keydown', echap);
    };
  }, [ouvert]);

  function choisir(j: string) {
    /* Aucune arrivée, ou une période déjà complète : on recommence. */
    if (!arrivee || depart) {
      onChange(j, '');
      setSurvol('');
      return;
    }
    if (j <= arrivee) {
      onChange(j, '');
      return;
    }
    onChange(arrivee, j);
    /* La période est complète : on referme, le visiteur a fini ici. */
    setOuvert(false);
  }

  const fin = depart || survol;
  const nuits =
    arrivee && depart
      ? Math.round((depuisIso(depart)!.getTime() - depuisIso(arrivee)!.getTime()) / 86400000)
      : 0;

  const mois = [curseur, new Date(curseur.getFullYear(), curseur.getMonth() + 1, 1)];

  return (
    <div className="cal" ref={boite}>
      <input type="hidden" name="arrivee" value={arrivee} />
      <input type="hidden" name="depart" value={depart} />

      <button type="button" className="cal-champ" onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}>
        <span className="cal-etiquettes">
          <span>{libelles.arrivee}</span>
          <span>{libelles.depart}</span>
        </span>
        <span className="cal-valeurs">
          <span className={arrivee ? '' : 'cal-vide'}>{arrivee ? bref(arrivee, locale) : libelles.ajouter}</span>
          <span aria-hidden="true" className="cal-fleche">
            →
          </span>
          <span className={depart ? '' : 'cal-vide'}>{depart ? bref(depart, locale) : libelles.ajouter}</span>
        </span>
      </button>

      {ouvert && (
        <div className="cal-panneau" role="dialog" aria-label={`${libelles.arrivee} / ${libelles.depart}`}>
          <div className="cal-tete">
            <button
              type="button"
              className="cal-nav"
              aria-label="Mois précédent"
              onClick={() => setCurseur(new Date(curseur.getFullYear(), curseur.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <span className="cal-compte">{nuits > 0 ? libelles.nuits(nuits) : ''}</span>
            <button
              type="button"
              className="cal-nav"
              aria-label="Mois suivant"
              onClick={() => setCurseur(new Date(curseur.getFullYear(), curseur.getMonth() + 1, 1))}
            >
              ›
            </button>
          </div>

          <div className="cal-mois">
            {mois.map((m, k) => (
              <div key={k} className={k === 1 ? 'cal-second' : undefined}>
                <div className="cal-titre">
                  {MOIS[lang][m.getMonth()]} {m.getFullYear()}
                </div>
                <div className="cal-jours" aria-hidden="true">
                  {JOURS[lang].map((j, i) => (
                    <span key={i}>{j}</span>
                  ))}
                </div>
                <div className="cal-grille">
                  {grille(m.getFullYear(), m.getMonth()).map((d, i) => {
                    if (!d) return <span key={i} />;
                    const v = iso(d);
                    /* Le passé n'est pas réservable, et pendant le choix du
                       départ tout ce qui précède l'arrivée non plus. */
                    const interdit = v < aujourdhui || (!!arrivee && !depart && v <= arrivee);
                    const debut = v === arrivee;
                    const arrivant = v === depart;
                    const entre = !!arrivee && !!fin && v > arrivee && v < fin;
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={interdit}
                        className={[
                          'cal-jour',
                          debut ? 'cal-debut' : '',
                          arrivant ? 'cal-fin' : '',
                          entre ? 'cal-entre' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onMouseEnter={() => arrivee && !depart && setSurvol(v)}
                        onClick={() => choisir(v)}
                        aria-label={`${d.getDate()} ${MOIS[lang][d.getMonth()]} ${d.getFullYear()}`}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {(arrivee || depart) && (
            <div className="cal-pied">
              <button
                type="button"
                className="cal-effacer"
                onClick={() => {
                  onChange('', '');
                  setSurvol('');
                }}
              >
                {libelles.effacer}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
