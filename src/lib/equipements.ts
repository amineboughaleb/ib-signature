/**
 * Les équipements d'un logement.
 *
 * Un catalogue fermé, pas du texte libre. Trois raisons.
 *
 * La traduction : « Wi-Fi » et « Wi-Fi » s'écrivent pareil, mais « Lave-linge »
 * et « Washing machine » non, et un site bilingue qui affiche une moitié de
 * page en français ne fait pas sérieux.
 *
 * La cohérence : saisis à la main, vingt-quatre logements donneraient « clim »,
 * « climatisation », « Climatisation réversible » et « A/C ». Le voyageur qui
 * compare deux fiches croirait à trois équipements différents.
 *
 * Le filtre : une liste fermée se filtre. Le jour où l'on voudra chercher les
 * logements avec piscine, la donnée sera déjà là et propre.
 *
 * Ce qui manque à cette liste s'y ajoute en une ligne. Ce qui n'y est pas ne
 * s'affiche pas : mieux vaut un équipement oublié qu'un équipement inventé.
 */

export type Equipement = {
  cle: string;
  fr: string;
  en: string;
  /* Le tracé de l'icône, dans un carré de 24. Volontairement simple : à
     dix-neuf pixels de côté, un dessin détaillé devient une tache. */
  d: string;
};

export const EQUIPEMENTS: Equipement[] = [
  { cle: 'wifi', fr: 'Wi-Fi', en: 'Wi-Fi', d: 'M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01' },
  {
    cle: 'clim',
    fr: 'Climatisation',
    en: 'Air conditioning',
    d: 'M12 3v18M12 8l4-3M12 8 8 5M12 16l4 3M12 16l-4 3M3.8 7.5l15.6 9M8.6 7.2 3.8 7.5l1 4.7M15.4 16.8l4.8-.3-1-4.7M20.2 7.5l-15.6 9M15.4 7.2l4.8.3-1 4.7M8.6 16.8l-4.8-.3 1-4.7',
  },
  { cle: 'chauffage', fr: 'Chauffage', en: 'Heating', d: 'M9 3v18M15 3v18M4 8h16M4 16h16' },
  { cle: 'cuisine', fr: 'Cuisine équipée', en: 'Equipped kitchen', d: 'M7 3v8a2 2 0 0 0 4 0V3M9 11v10M17 3c-1.5 2-2 3.5-2 6h4c0-2.5-.5-4-2-6ZM17 9v12' },
  { cle: 'lave_linge', fr: 'Lave-linge', en: 'Washing machine', d: 'M4 3h16v18H4zM4 7h16M8 5h.01M11 5h.01M16 14a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z' },
  { cle: 'lave_vaisselle', fr: 'Lave-vaisselle', en: 'Dishwasher', d: 'M4 3h16v18H4zM4 8h16M7 5.5h.01M10 5.5h.01M9 12c1.5 1 4.5 1 6 0M9 16c1.5 1 4.5 1 6 0' },
  { cle: 'tv', fr: 'Télévision', en: 'Television', d: 'M3 6h18v12H3zM8 21h8M12 18v3' },
  { cle: 'bureau', fr: 'Espace de travail', en: 'Workspace', d: 'M4 20V9l8-5 8 5v11M4 20h16M9 20v-6h6v6' },
  { cle: 'ascenseur', fr: 'Ascenseur', en: 'Lift', d: 'M5 3h14v18H5zM12 3v18M8.5 9 7 7 5.5 9M15.5 15 17 17l1.5-2' },
  { cle: 'parking', fr: 'Parking', en: 'Parking', d: 'M4 3h16v18H4zM9.5 17V7.5h3a3 3 0 0 1 0 6h-3' },
  { cle: 'securite', fr: 'Gardiennage 24 h', en: '24h security', d: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3ZM9 12l2 2 4-4' },
  { cle: 'piscine', fr: 'Piscine', en: 'Swimming pool', d: 'M2 17c2.5-2 4-2 6.5 0s4 2 6.5 0 4-2 6.5 0M2 21c2.5-2 4-2 6.5 0s4 2 6.5 0 4-2 6.5 0M8 14V4a2 2 0 1 1 4 0M16 14V4M12 8h4' },
  { cle: 'terrasse', fr: 'Terrasse', en: 'Terrace', d: 'M3 20h18M5 20v-7h14v7M3 13l9-8 9 8M9 20v-4h6v4' },
  { cle: 'vue_mer', fr: 'Vue sur mer', en: 'Sea view', d: 'M3 4h18v9H3zM3 17c2.5-2 4-2 6.5 0s4 2 6.5 0 4-2 5-1M7.5 8.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0M14 12l3-3 4 4' },
  { cle: 'jardin', fr: 'Jardin', en: 'Garden', d: 'M12 21V11M12 11c0-3 2-5 5-5 0 3-2 5-5 5ZM12 13c0-3-2-5-5-5 0 3 2 5 5 5ZM6 21h12' },
  { cle: 'sport', fr: 'Salle de sport', en: 'Gym', d: 'M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10' },
  { cle: 'linge', fr: 'Linge hôtelier', en: 'Hotel linen', d: 'M4 7l5-3 3 2 3-2 5 3-2 4h-1v9H7v-9H6z' },
  { cle: 'menage', fr: 'Ménage professionnel', en: 'Professional cleaning', d: 'M12 3v9M8 12h8l1 9H7zM10 16v3M14 16v3' },
  { cle: 'checkin', fr: 'Check-in autonome', en: 'Self check-in', d: 'M15 3h4v18h-4M11 8l4 4-4 4M15 12H3' },
  { cle: 'animaux', fr: 'Animaux acceptés', en: 'Pets allowed', d: 'M6.5 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17.5 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3.5 15a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM20.5 15a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6ZM12 20c-3 0-4.5-2-4.5-3.5S9 11 12 11s4.5 4 4.5 5.5S15 20 12 20Z' },
];

const PAR_CLE = new Map(EQUIPEMENTS.map((e) => [e.cle, e]));

/** Les équipements d'une liste de clefs, dans l'ordre du catalogue. */
export function equipementsDe(cles: string[]): Equipement[] {
  const voulus = new Set(cles);
  return EQUIPEMENTS.filter((e) => voulus.has(e.cle));
}

export function estEquipement(cle: string): boolean {
  return PAR_CLE.has(cle);
}

export function libelle(e: Equipement, locale: string): string {
  return locale === 'en' ? e.en : e.fr;
}
