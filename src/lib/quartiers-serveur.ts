/**
 * Les pages ville et quartier, vues du serveur : ce que la base en sait, et
 * l'état de chaque page à partir du catalogue en ligne.
 *
 * Deux choses vivent en base, à côté du reste de ce que l'équipe saisit :
 *
 * - le choix de page quartier d'un logement, quand l'équipe veut corriger le
 *   rattachement (colonne `q_page` de la table `liens`, comme les autres
 *   réglages d'un logement) ;
 * - la mémoire des pages déjà publiées (`pages_publiees`). Une page qui a été
 *   indexable et redescend sous le seuil répond toujours, en `noindex`, et
 *   sort du plan du site : jamais de 404 sur une adresse connue des moteurs.
 *   Une page qui ne l'a jamais été n'existe pas.
 */

import { db } from './db';
import { biens as tousLesBiens, vitrine, type Bien } from './biens';
import {
  VILLES,
  paragraphes,
  quartierDeLaCarte,
  rattacher,
  remplitLesConditions,
  villeDuLogement,
  type Langue,
  type QuartierRef,
  type Rattachement,
  type VilleRef,
} from './quartiers';

let migre = false;
function migrer() {
  if (migre) return;
  try {
    db().exec("ALTER TABLE liens ADD COLUMN q_page TEXT NOT NULL DEFAULT ''");
  } catch {
    /* colonne déjà présente */
  }
  db().exec(`CREATE TABLE IF NOT EXISTS pages_publiees (
    cle    TEXT PRIMARY KEY,
    depuis TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  migre = true;
}

/** Les choix de page quartier faits dans l'administration, par logement. Vide veut dire « laisser faire ». */
export function choixDePage(): Map<number, string> {
  migrer();
  const lignes = db().prepare("SELECT bien_id, q_page FROM liens WHERE q_page <> ''").all() as {
    bien_id: number;
    q_page: string;
  }[];
  return new Map(lignes.map((l) => [Number(l.bien_id), l.q_page]));
}

export function ecrireChoixDePage(bienId: number, valeur: string) {
  if (!bienId) return;
  migrer();
  db()
    .prepare(
      `INSERT INTO liens (bien_id, q_page, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(bien_id) DO UPDATE SET q_page = excluded.q_page, updated_at = datetime('now')`
    )
    .run(bienId, valeur.slice(0, 60));
}

function publiees(): Set<string> {
  migrer();
  return new Set((db().prepare('SELECT cle FROM pages_publiees').all() as { cle: string }[]).map((l) => l.cle));
}

function noterPubliees(cles: string[]) {
  if (!cles.length) return;
  migrer();
  const ins = db().prepare('INSERT OR IGNORE INTO pages_publiees (cle) VALUES (?)');
  for (const c of cles) ins.run(c);
}

export type Statut = 'indexable' | 'retiree' | 'absente';

export type EtatQuartier = {
  ref: QuartierRef;
  biens: Bien[];
  /** Par langue : une page sans texte dans une langue n'est pas indexable dans cette langue. */
  statut: Record<Langue, Statut>;
};

export type EtatVille = {
  ref: VilleRef;
  biens: Bien[];
  statut: Record<Langue, Statut>;
  quartiers: EtatQuartier[];
};

function statut(nombre: number, texte: Record<Langue, string[]>, cle: string, deja: Set<string>): Record<Langue, Statut> {
  const un = (l: Langue): Statut => (remplitLesConditions(nombre, texte[l]) ? 'indexable' : deja.has(`${l}:${cle}`) ? 'retiree' : 'absente');
  return { fr: un('fr'), en: un('en') };
}

/**
 * L'état de toutes les pages, à partir du catalogue public.
 *
 * Calculé à chaque appel, depuis `vitrine()` qui garde le catalogue en
 * mémoire : un logement publié ou retiré chez Lodgify fait franchir le seuil
 * à sa page sans que personne y touche. Les pages indexables sont notées au
 * passage, une fois pour toutes.
 */
export async function etatDesPages(): Promise<EtatVille[]> {
  const catalogue = await vitrine();
  const forces = choixDePage();
  const deja = publiees();
  const nouvelles: string[] = [];

  const etats = VILLES.map((ville) => {
    const biensVille = catalogue.filter((b) => villeDuLogement(b)?.cle === ville.cle);
    const quartiers = ville.quartiers.map((q) => {
      const biens = biensVille.filter((b) => rattacher(ville, b, forces.get(b.id)).quartier?.cle === q.cle);
      return { ref: q, biens, statut: statut(biens.length, q.texte, `${ville.cle}/${q.cle}`, deja) };
    });
    const e: EtatVille = {
      ref: ville,
      biens: biensVille,
      statut: statut(biensVille.length, ville.texte, ville.cle, deja),
      quartiers,
    };
    for (const l of ['fr', 'en'] as Langue[]) {
      if (e.statut[l] === 'indexable' && !deja.has(`${l}:${ville.cle}`)) nouvelles.push(`${l}:${ville.cle}`);
      for (const q of quartiers) {
        const cle = `${l}:${ville.cle}/${q.ref.cle}`;
        if (q.statut[l] === 'indexable' && !deja.has(cle)) nouvelles.push(cle);
      }
    }
    return e;
  });

  noterPubliees(nouvelles);
  return etats;
}

/** La page quartier indexable d'un logement, dans une langue, s'il en a une : pour le lien de sa fiche. */
export async function pagesDuLogement(
  b: Bien,
  langue: Langue
): Promise<{ ville: EtatVille | null; quartier: EtatQuartier | null }> {
  const etats = await etatDesPages();
  const ville = etats.find((v) => v.biens.some((x) => x.id === b.id)) || null;
  const quartier = ville?.quartiers.find((q) => q.biens.some((x) => x.id === b.id)) || null;
  return {
    ville: ville && ville.statut[langue] === 'indexable' ? ville : null,
    quartier: quartier && quartier.statut[langue] === 'indexable' ? quartier : null,
  };
}

/** Le plus petit prix d'appel d'une liste, avec sa devise, s'il est connu. */
export function prixMinimum(biens: Bien[]): { prix: number; devise: string } | null {
  const avec = biens.filter((b) => b.prixDepuis && b.devise);
  if (!avec.length) return null;
  const min = avec.reduce((a, b) => ((b.prixDepuis as number) < (a.prixDepuis as number) ? b : a));
  return { prix: min.prixDepuis as number, devise: min.devise as string };
}

/** Le rattachement de chaque logement, pour l'administration : où il est rangé, pourquoi, et ce que dirait la carte. */
export async function rattachements(): Promise<
  Map<number, Rattachement & { ville: VilleRef | null; carte: QuartierRef | null; choix: string }>
> {
  const tous = await tousLesBiens();
  const forces = choixDePage();
  const out = new Map<number, Rattachement & { ville: VilleRef | null; carte: QuartierRef | null; choix: string }>();
  for (const b of tous) {
    const ville = villeDuLogement(b);
    if (!ville) {
      out.set(b.id, { quartier: null, par: null, zone: null, ville: null, carte: null, choix: forces.get(b.id) || '' });
      continue;
    }
    const r = rattacher(ville, b, forces.get(b.id));
    out.set(b.id, { ...r, ville, carte: quartierDeLaCarte(ville, r.zone), choix: forces.get(b.id) || '' });
  }
  return out;
}

export { paragraphes };
