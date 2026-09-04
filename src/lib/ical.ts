/**
 * La lecture d'un calendrier iCal.
 *
 * Distinction qui change tout, et que j'avais manquée : on ne peut pas
 * demander à Lodgify de relancer SES importations, mais rien n'empêche ce
 * site de faire les siennes. Un flux iCal est une adresse publique qu'Airbnb,
 * Booking ou Lodgify publient pour chaque logement ; la télécharger et la lire
 * ne demande la permission de personne. C'est exactement ce que fait Staytle.
 *
 * L'intérêt n'est pas de doubler Lodgify pour le plaisir. Il est de pouvoir le
 * contredire. Si le flux d'Airbnb annonce une semaine prise et que Lodgify
 * l'annonce libre, c'est que la synchronisation n'a pas suivi - et c'est
 * précisément la panne qui produit une double réservation, celle qu'aucun
 * bouton « importer » ne signale puisqu'il se contente de relancer.
 *
 * Le format est ancien et négligemment respecté. Ce lecteur est donc écrit
 * pour survivre à ce qu'il rencontrera plutôt que pour valider la norme : ce
 * qu'il ne comprend pas, il l'ignore ; ce qu'il comprend à moitié, il le
 * rejette. Un événement mal lu vaut mieux qu'un événement inventé, parce qu'il
 * finirait par bloquer ou libérer des dates réelles.
 */

export type Periode = {
  /** Première nuit occupée, incluse. */
  d: string;
  /** Dernière nuit occupée, incluse. */
  f: string;
  /** Le libellé de l'événement, tel quel : « Reserved », « Airbnb (Not available) »… */
  r: string;
};

export type LectureIcal = {
  periodes: Periode[];
  /** Événements vus, y compris ceux qu'on a écartés. */
  vus: number;
  /** Ce qui a fait écarter un événement, pour le diagnostic. */
  ecartes: string[];
};

/**
 * Déplie les lignes repliées.
 *
 * La norme coupe les longues lignes et marque la suite par une espace ou une
 * tabulation en tête. Ne pas les recoller, c'est perdre la moitié d'une
 * adresse ou d'un libellé - et parfois couper une date en deux.
 */
function deplier(texte: string): string[] {
  const lignes: string[] = [];
  for (const brute of texte.split(/\r\n|\n|\r/)) {
    if (/^[ \t]/.test(brute) && lignes.length) lignes[lignes.length - 1] += brute.slice(1);
    else lignes.push(brute);
  }
  return lignes;
}

/** Les échappements du format : \n, \, \; \, — appliqués aux textes seulement. */
const desechapper = (s: string) =>
  s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1').replace(/\s+/g, ' ').trim();

/**
 * Une date iCal en date simple.
 *
 * Deux formes : `20260901` pour un jour entier, `20260901T140000Z` pour un
 * instant. On ne garde que le jour dans les deux cas - une réservation se
 * compte en nuits, et l'heure d'arrivée n'y change rien.
 *
 * Le fuseau est délibérément ignoré. Un séjour du 1er au 5 septembre est le
 * même à Casablanca et à Paris ; convertir en heure locale ferait basculer
 * certaines réservations d'un jour, ce qui est bien pire que de ne pas
 * convertir du tout.
 */
function dateDe(valeur: string): string | null {
  const v = valeur.trim();
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v);
  if (!m) return null;
  const [, a, mo, j] = m;
  const iso = `${a}-${mo}-${j}`;
  /* Une date que le calendrier grégorien refuse n'est pas une date : le 31
     février d'un flux mal formé ne doit pas devenir le 3 mars. */
  const t = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== iso) return null;
  return iso;
}

const veille = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
};

/* Les statuts qui annulent un événement. Un séjour annulé qui bloquerait
   encore des dates coûterait des nuits vides, sans que personne comprenne
   pourquoi le logement ne se loue pas. */
const ANNULE = /^(CANCELLED|CANCELED|DECLINED)$/i;

/**
 * Lit un flux iCal et rend les périodes occupées.
 *
 * La convention du format veut que DTEND soit exclusif : un séjour
 * `DTSTART:20260901 DTEND:20260905` occupe les nuits du 1 au 4, et le 5 est
 * libre pour l'arrivée suivante. C'est le jour de rotation, et le compter
 * comme pris ferait perdre une nuit sur deux réservations - une erreur
 * discrète et coûteuse, qu'on ne voit qu'en fin de mois.
 */
export function analyserIcal(texte: string): LectureIcal {
  const periodes: Periode[] = [];
  const ecartes: string[] = [];
  let vus = 0;

  if (!/BEGIN:VCALENDAR/i.test(texte)) {
    return { periodes, vus: 0, ecartes: ['ce n’est pas un calendrier iCal'] };
  }

  let dans = false;
  let debut: string | null = null;
  let fin: string | null = null;
  let finExclusive = true;
  let resume = '';
  let statut = '';

  for (const ligne of deplier(texte)) {
    const hausse = ligne.toUpperCase();

    if (hausse.startsWith('BEGIN:VEVENT')) {
      dans = true;
      debut = fin = null;
      finExclusive = true;
      resume = '';
      statut = '';
      continue;
    }
    if (!dans) continue;

    if (hausse.startsWith('END:VEVENT')) {
      dans = false;
      vus += 1;
      if (ANNULE.test(statut)) {
        ecartes.push(`annulé : ${resume || 'sans libellé'}`);
        continue;
      }
      if (!debut) {
        ecartes.push(`sans date de début : ${resume || 'sans libellé'}`);
        continue;
      }
      /* Sans DTEND, la norme dit qu'un événement d'un jour entier dure ce
         jour-là. Une seule nuit, donc. */
      const derniere = fin ? (finExclusive ? veille(fin) : fin) : debut;
      if (derniere < debut) {
        ecartes.push(`dates inversées : ${resume || 'sans libellé'}`);
        continue;
      }
      periodes.push({ d: debut, f: derniere, r: resume });
      continue;
    }

    const sep = ligne.indexOf(':');
    if (sep < 0) continue;
    const nom = ligne.slice(0, sep).toUpperCase();
    const valeur = ligne.slice(sep + 1);

    if (nom.startsWith('DTSTART')) {
      debut = dateDe(valeur);
    } else if (nom.startsWith('DTEND')) {
      fin = dateDe(valeur);
      /* Une fin donnée en instant précis - 20260905T110000Z - désigne l'heure
         du départ, donc la nuit précédente est la dernière occupée : la borne
         reste exclusive au sens des nuits. */
      finExclusive = true;
    } else if (nom.startsWith('DURATION')) {
      /* Une durée en jours, la seule qu'on rencontre en pratique. */
      const j = /^P(\d+)D$/i.exec(valeur.trim());
      if (j && debut) {
        const t = new Date(`${debut}T00:00:00Z`);
        t.setUTCDate(t.getUTCDate() + Number(j[1]));
        fin = t.toISOString().slice(0, 10);
        finExclusive = true;
      }
    } else if (nom.startsWith('SUMMARY')) {
      resume = desechapper(valeur).slice(0, 120);
    } else if (nom.startsWith('STATUS')) {
      statut = valeur.trim();
    }
  }

  return { periodes: fusionner(periodes), vus, ecartes };
}

/**
 * Réunit les périodes qui se touchent ou se chevauchent.
 *
 * Un flux annonce parfois deux fois la même réservation, ou deux séjours
 * consécutifs. Les garder séparés fausserait le compte des séjours sans rien
 * changer aux nuits ; les fondre donne une lecture juste des deux.
 */
export function fusionner(liste: Periode[]): Periode[] {
  const triees = [...liste].sort((a, b) => a.d.localeCompare(b.d) || a.f.localeCompare(b.f));
  const out: Periode[] = [];
  for (const p of triees) {
    const der = out[out.length - 1];
    if (der && p.d <= lendemain(der.f)) {
      if (p.f > der.f) der.f = p.f;
      if (p.r && !der.r.includes(p.r)) der.r = der.r ? `${der.r} · ${p.r}` : p.r;
      continue;
    }
    out.push({ ...p });
  }
  return out;
}

const lendemain = (d: string) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};

/**
 * Un séjour croise-t-il une période occupée ?
 *
 * L'arrivée et le départ suivent la convention hôtelière : on occupe les nuits
 * de `arrivee` à `depart - 1`. Un départ le jour même d'une arrivée n'est donc
 * pas un conflit, c'est une rotation - et l'interdire coûterait une nuit à
 * chaque enchaînement.
 */
export function croise(periodes: Periode[], arrivee: string, depart: string): Periode | null {
  const derniere = veille(depart);
  if (derniere < arrivee) return null;
  return periodes.find((p) => p.d <= derniere && arrivee <= p.f) || null;
}

/** Le nombre de nuits couvertes par une liste de périodes déjà fusionnées. */
export function nuitsDe(periodes: Periode[]): number {
  return periodes.reduce((n, p) => {
    const a = Date.parse(`${p.d}T00:00:00Z`);
    const b = Date.parse(`${p.f}T00:00:00Z`);
    return n + (Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86400000) + 1 : 0);
  }, 0);
}
