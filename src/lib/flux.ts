/**
 * L'importation du calendrier de chaque logement.
 *
 * UNE adresse par logement, et c'est celle de Lodgify. Ce n'est pas une
 * économie de moyens, c'est la seule qui soit juste.
 *
 * Lodgify est le gestionnaire de canaux : Airbnb, Booking et Vrbo y déversent
 * leurs réservations, et les séjours vendus hors plateforme y sont saisis. Son
 * calendrier est donc le seul qui contienne TOUT. Importer celui d'Airbnb à
 * côté n'ajouterait rien - ces nuits-là y sont déjà - et s'y fier à sa place
 * serait un recul : le flux d'Airbnb ignore les réservations directes, et
 * afficher libre une semaine vendue au téléphone est exactement la faute qu'on
 * cherche à éviter.
 *
 * Reste à dire pourquoi lire ce calendrier alors que l'API de Lodgify répond
 * déjà. Parce qu'elle ne répond pas toujours de la même façon : le chemin des
 * disponibilités n'est pas documenté, il change d'une offre à l'autre, et le
 * site en essaie plusieurs sans garantie. L'export iCal, lui, est une adresse
 * stable que Lodgify publie pour être lue. C'est la même vérité par une porte
 * plus sûre.
 *
 * Une règle gouverne tout ce fichier : en cas de doute, on bloque. C'est
 * l'inverse de ce qui vaut pour l'affichage du catalogue, où le doute profite
 * à la visibilité - montrer un logement peut-être pris coûte un clic. Ici le
 * doute porte sur des dates qu'on s'apprête à vendre, et se tromper coûte deux
 * voyageurs dans le même appartement.
 */

import { analyserIcal, croise, fusionner, nuitsDe, type Periode } from './ical';
import { fluxActifs, majFlux, type LigneFlux } from './db';
import { disponibilites } from './lodgify';

export type ResultatFlux = {
  id: number;
  bien_id: number;
  source: string;
  url: string;
  ok: boolean;
  erreur?: string;
  periodes: number;
  nuits: number;
  evenements: number;
  /* Ce qui a été lu. C'est `importerTous` qui l'écrit en base - lui seul - et
     les pages n'en font rien : elles lisent la base. */
  periodesLues?: Periode[];
};

/* La provenance se lit dans l'adresse plutôt que de se saisir. On attend celle
   de Lodgify ; les autres restent reconnues, parce qu'une adresse collée de
   travers doit s'annoncer pour ce qu'elle est plutôt que de passer pour le
   calendrier complet qu'elle n'est pas. */
const SOURCES: { motif: RegExp; nom: string }[] = [
  { motif: /lodgify\.com/i, nom: 'Lodgify' },
  { motif: /airbnb\./i, nom: 'Airbnb' },
  { motif: /booking\.com|admin\.booking/i, nom: 'Booking' },
  { motif: /vrbo|homeaway|expedia/i, nom: 'Vrbo' },
  { motif: /google\.com\/calendar|calendar\.google/i, nom: 'Google' },
];

/** Vrai quand l'adresse est bien celle du gestionnaire de canaux, seule à tout porter. */
export const estLodgify = (url: string) => /lodgify\.com/i.test(url);

export function sourceDe(url: string): string {
  return SOURCES.find((s) => s.motif.test(url))?.nom || 'Autre';
}

/**
 * Une adresse de flux acceptable.
 *
 * Le site va télécharger ce qu'on lui donne, depuis son propre serveur. Une
 * adresse pointant sur le réseau interne de l'hébergeur ferait de cette page
 * un moyen d'aller lire ce que le serveur seul peut voir - c'est une faute
 * classique, et elle se ferme ici plutôt qu'après coup.
 *
 * La boucle locale reste ouverte hors production, et seulement là : c'est ce
 * qui permet à la vérification automatique de servir un calendrier d'essai
 * depuis la même machine. En production, cette porte n'existe pas.
 */
export function adresseAcceptable(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(u.hostname);
  if (u.protocol === 'http:' && local && process.env.NODE_ENV !== 'production') return true;
  if (u.protocol !== 'https:') return false;
  /* Les adresses privées et les noms qui n'en sont pas : rien de tout cela
     n'héberge un calendrier de location. */
  if (local) return false;
  if (/^(10|127)\./.test(u.hostname)) return false;
  if (/^192\.168\./.test(u.hostname)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname)) return false;
  if (/^169\.254\./.test(u.hostname)) return false;
  if (!u.hostname.includes('.')) return false;
  return true;
}

const TAILLE_MAX = 4 * 1024 * 1024;

/* Le temps accordé à un calendrier, et celui accordé à l'ensemble.

   Ces deux nombres ne sont pas des réglages de confort. L'importation est une
   action serveur : le navigateur attend une réponse, et au-delà d'une certaine
   attente il abandonne la requête - « Failed to fetch », sans que rien
   n'explique pourquoi. Le travail, lui, continue côté serveur, et l'on se
   retrouve devant une page qui semble en panne alors qu'elle travaille.

   On préfère donc rendre la main à temps, en disant ce qui n'a pas pu être lu.
   Vingt-quatre calendriers par paquets de huit, douze secondes chacun : trente-
   six secondes dans le pire des cas, et une réponse toujours. Ce qui n'a pas
   été relu garde ce qu'on savait de lui et sera relu au prochain clic. */
const DELAI_FLUX = 12000;
const BUDGET = 45000;
const PAQUET = 8;

/**
 * Télécharge et lit un flux.
 *
 * Les webcal: sont des https: déguisés - c'est la même adresse avec un autre
 * mot devant, et refuser celles-là ferait échouer la moitié des copier-coller
 * venus d'Airbnb.
 */
export async function lireFlux(f: LigneFlux): Promise<ResultatFlux> {
  const base = { id: f.id, bien_id: f.bien_id, source: f.source, url: f.url };
  const url = f.url.replace(/^webcal:/i, 'https:');

  if (!adresseAcceptable(url)) {
    return { ...base, ok: false, erreur: 'adresse refusée', periodes: 0, nuits: 0, evenements: 0 };
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: 'text/calendar, text/plain, */*', 'User-Agent': 'IBSignature/1.0 (+https://ibsignature.com)' },
      signal: AbortSignal.timeout(DELAI_FLUX),
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!res.ok) {
      return { ...base, ok: false, erreur: `HTTP ${res.status}`, periodes: 0, nuits: 0, evenements: 0 };
    }
    const texte = (await res.text()).slice(0, TAILLE_MAX);
    const lu = analyserIcal(texte);
    if (!lu.vus && lu.ecartes.length) {
      return { ...base, ok: false, erreur: lu.ecartes[0], periodes: 0, nuits: 0, evenements: 0 };
    }
    return {
      ...base,
      ok: true,
      periodes: lu.periodes.length,
      nuits: nuitsDe(lu.periodes),
      evenements: lu.vus,
      periodesLues: lu.periodes,
    };
  } catch (e: any) {
    const m = String(e?.message || 'erreur inconnue');
    return {
      ...base,
      ok: false,
      erreur: /timeout|abort/i.test(m) ? 'délai dépassé' : m.slice(0, 200),
      periodes: 0,
      nuits: 0,
      evenements: 0,
    };
  }
}

/**
 * Importe tous les flux actifs.
 *
 * Par paquets, et sous un budget de temps. Les deux ont leur raison.
 *
 * Les paquets, parce que vingt-quatre téléchargements lancés d'un seul coup
 * ressembleraient à une attaque du point de vue du serveur d'en face, et l'on
 * n'est pas pressé de quelques secondes.
 *
 * Le budget, parce que le navigateur attend cette réponse. Passé une certaine
 * durée il abandonne la requête et affiche « Failed to fetch », sans que rien
 * n'explique pourquoi - et la page paraît en panne alors qu'elle travaillait.
 * Mieux vaut rendre la main en disant ce qui n'a pas pu être lu : ces
 * calendriers-là gardent ce qu'on savait d'eux, et le prochain clic les
 * reprendra.
 */
export async function importerTous(): Promise<ResultatFlux[]> {
  const liste = fluxActifs();
  const out: ResultatFlux[] = [];
  const debut = Date.now();

  for (let i = 0; i < liste.length; i += PAQUET) {
    if (Date.now() - debut > BUDGET) {
      /* On le dit plutôt que de s'arrêter en silence : un calendrier qu'on
         croit relu et qui ne l'est pas est pire qu'un calendrier dont on sait
         qu'il attend. */
      for (const reste of liste.slice(i)) {
        out.push({
          id: reste.id,
          bien_id: reste.bien_id,
          source: reste.source,
          url: reste.url,
          ok: false,
          erreur: 'pas relu cette fois : cliquez à nouveau',
          periodes: 0,
          nuits: 0,
          evenements: 0,
        });
      }
      break;
    }

    const lot = await Promise.all(liste.slice(i, i + PAQUET).map(lireFlux));
    for (const r of lot) {
      const periodes = r.periodesLues || [];
      majFlux(r.id, {
        ok: r.ok,
        erreur: r.erreur || '',
        periodes: JSON.stringify(periodes),
        nb: periodes.length,
      });
      out.push(r);
    }
  }
  return out;
}

/* ---------- le filet ----------
 *
 * L'ordonnanceur est le mécanisme principal, et il suffit tant qu'il tourne.
 * Mais une tâche planifiée s'oublie : on la désactive un jour pour un essai,
 * on migre d'hébergeur, le secret change. Rien ne le signale - le site
 * continue de répondre, simplement sur des données qui vieillissent.
 *
 * D'où ce filet, qui reprend le principe du catalogue : quand une page
 * constate que les calendriers sont périmés, elle sert ce qu'elle a et lance
 * la relecture derrière. Le visiteur n'attend pas ; le calendrier se répare.
 *
 * Il ne remplace pas l'ordonnanceur - un site sans visite ne se rafraîchit
 * jamais, et c'est très bien : sans visite, personne ne réserve. */
let relecture: Promise<unknown> | null = null;
let dernierEssai = 0;
const ECART_MIN_MS = 60 * 60 * 1000;

/**
 * Relance l'import si les calendriers ont vieilli. Ne bloque jamais.
 *
 * Une seule relecture à la fois, et une par heure au plus : dix visiteurs
 * simultanés sur des calendriers périmés lanceraient sinon dix imports, soit
 * deux cent quarante téléchargements, et Lodgify nous fermerait la porte.
 */
export function veillerAuxFlux(): void {
  /* Une porte de sortie, pour le développement et la vérification automatique.
     Là, les adresses de calendrier sont fictives : chacune met douze secondes
     à ne pas répondre, et vingt-quatre téléchargements morts concourent avec
     les pages qu'on est en train de mesurer. Ce n'est pas un cas de
     production - en ligne, les flux répondent en une seconde - mais un banc
     d'essai qui se perturbe lui-même ne mesure plus rien. */
  if (process.env.FLUX_VEILLE === '0') return;
  if (relecture) return;
  if (Date.now() - dernierEssai < ECART_MIN_MS) return;

  const f = fraicheurDesFlux();
  if (!f.total) return;
  if (f.perimes === 0 && f.jamaisLus === 0) return;

  dernierEssai = Date.now();
  /* Cinq secondes de retard, et ce n'est pas de la superstition.
     Lancer vingt-quatre téléchargements dans le tick où la page se rend, c'est
     les faire concourir avec elle : le visiteur qui a déclenché la relecture
     est le seul à en payer le prix, et il attend une page qui, elle, était
     prête. On laisse la réponse partir d'abord. */
  relecture = new Promise((resoudre) => {
    const t = setTimeout(() => resoudre(importerTous()), 5000);
    /* La minuterie ne doit pas retenir le processus à l'arrêt : un serveur qui
       refuse de s'éteindre parce qu'un import est prévu dans cinq secondes se
       fait tuer de force, et l'hébergeur compte cela comme un incident. */
    if (typeof t === 'object' && t && 'unref' in t) (t as { unref: () => void }).unref();
  }).finally(() => {
    relecture = null;
  });
  /* Personne n'attend cette promesse : son échec ne doit tomber nulle part.
     Les calendriers restent périmés, ce qui est exactement le comportement
     voulu quand on n'arrive pas à les relire. */
  relecture.catch(() => {});
}

/** Les périodes occupées connues, logement par logement, tous canaux fondus. */
export function occupationParBien(): Map<number, Periode[]> {
  const out = new Map<number, Periode[]>();
  for (const f of fluxActifs()) {
    let p: Periode[] = [];
    try {
      const brut = JSON.parse(f.periodes || '[]');
      if (Array.isArray(brut)) p = brut.filter((x) => x && typeof x.d === 'string' && typeof x.f === 'string');
    } catch {
      /* Une colonne illisible ne doit pas faire tomber une page : on l'ignore,
         et le flux paraîtra simplement vide jusqu'à la prochaine lecture. */
    }
    if (!p.length) continue;
    out.set(f.bien_id, [...(out.get(f.bien_id) || []), ...p]);
  }
  for (const [id, p] of out) out.set(id, fusionner(p));
  return out;
}

/* ---------- la péremption ----------
 *
 * Un calendrier importé n'a pas de date de péremption naturelle, et c'est
 * précisément ce qui le rend dangereux. Il ne se vide pas, il ne se signale
 * pas : il continue de répondre « rien à signaler » avec exactement la même
 * assurance le jour de son import et trois semaines plus tard.
 *
 * Or c'est sur lui que repose la garde du virement - la seule règle de ce site
 * dont la violation coûte de l'argent réel : encaisser un virement sur une
 * semaine déjà vendue ailleurs, c'est rembourser ET perdre le client.
 *
 * Passé ce délai, on cesse donc de faire confiance. Le site ne dit pas
 * « libre », il dit « je ne sais pas » - et l'appelant retombe sur l'API
 * Lodgify, qui répond en direct. Un doute annoncé vaut mieux qu'une certitude
 * périmée.
 */
const PEREMPTION_H = 36;

/** L'âge du calendrier d'un logement, en heures. `null` s'il n'a jamais été lu. */
export function ageDuFlux(bienId: number): number | null {
  let plusRecent = 0;
  for (const f of fluxActifs()) {
    if (f.bien_id !== bienId || !f.dernier_ok) continue;
    /* SQLite écrit `datetime('now')` en UTC sans marqueur de fuseau. Le lire
       sans le dire fait croire à une heure locale, et le calendrier paraît
       vieux d'une heure de plus ou de moins selon le serveur. */
    const t = Date.parse(`${f.dernier_ok.replace(' ', 'T')}Z`);
    if (Number.isFinite(t) && t > plusRecent) plusRecent = t;
  }
  if (!plusRecent) return null;
  return (Date.now() - plusRecent) / 3600000;
}

/** Vrai quand le calendrier de ce logement est trop vieux pour engager. */
export function fluxPerime(bienId: number): boolean {
  const age = ageDuFlux(bienId);
  return age !== null && age > PEREMPTION_H;
}

/**
 * Combien de calendriers sont périmés, et depuis quand pour le pire d'entre eux.
 * Pour l'administration : un site qui ralentit sans dire pourquoi inquiète
 * moins qu'un site qui annonce « mes calendriers datent de trois jours ».
 */
export function fraicheurDesFlux(): { total: number; perimes: number; jamaisLus: number; pireAgeH: number | null } {
  const ids = new Set(fluxActifs().map((f) => f.bien_id));
  let perimes = 0;
  let jamaisLus = 0;
  let pire: number | null = null;
  for (const id of ids) {
    const age = ageDuFlux(id);
    if (age === null) {
      jamaisLus += 1;
      continue;
    }
    if (age > PEREMPTION_H) perimes += 1;
    if (pire === null || age > pire) pire = age;
  }
  return { total: ids.size, perimes, jamaisLus, pireAgeH: pire };
}

/**
 * Un logement est-il pris sur ces dates, d'après ses propres flux ?
 *
 * Rend la période en cause plutôt qu'un simple oui : savoir QUELLE réservation
 * bloque est ce qui permet de comprendre, quand Lodgify dit le contraire.
 * Rend `null` quand aucun flux n'est déclaré pour ce logement - ne rien savoir
 * n'est pas savoir que c'est libre, et l'appelant doit pouvoir faire la
 * différence.
 *
 * Rend `null` AUSSI quand le calendrier est périmé, et pour la même raison.
 * C'était le défaut le plus sérieux de cette fonction : elle répondait « rien
 * à signaler » sur des données vieilles de trois semaines, sans que rien ne le
 * signale. Un calendrier trop vieux n'est pas un calendrier vide.
 */
export function conflit(bienId: number, arrivee: string, depart: string): Periode | null {
  if (fluxPerime(bienId)) return null;
  const p = occupationParBien().get(bienId);
  if (!p || !p.length) return null;
  return croise(p, arrivee, depart);
}

/**
 * L'état de chaque calendrier sur les mois à venir.
 *
 * Tout vient des flux, et de rien d'autre. C'est le calendrier de Lodgify,
 * donc celui qui porte Airbnb, Booking, Vrbo et les réservations directes : il
 * n'y a pas de seconde source à consulter, et prétendre en croiser deux
 * donnerait une assurance que rien ne justifie.
 *
 * Une précision sur ce qui n'est pas ici : la portée du calendrier. Un flux
 * iCal ne liste que les réservations, jamais les jours libres. Un logement
 * sans réservation au-delà de deux mois rend donc exactement le même flux
 * qu'un logement dont la connexion serait tombée, et rien ne permet de les
 * distinguer. On ne prétend donc pas le faire.
 */
export type EtatFlux = {
  bien_id: number;
  connu: boolean;
  erreur: string;
  luLe: string;
  source: string;
  url: string;
  /** Nuits prises à l'intérieur de la période observée. */
  occupes: number;
  /** Jours de la période observée. */
  total: number;
  /** Séjours distincts à l'intérieur de la période. */
  sejours: number;
  /** Première nuit prise à venir. */
  prochaine?: string;
  /** La réservation connue la plus lointaine, toutes périodes confondues. */
  derniere?: string;
};

export function etatDesFlux(mois = 12): { debut: string; fin: string; lignes: EtatFlux[] } {
  const d = new Date();
  const debut = d.toISOString().slice(0, 10);
  const f = new Date(d);
  f.setMonth(f.getMonth() + Math.max(1, Math.min(24, Math.round(mois))));
  const fin = f.toISOString().slice(0, 10);
  const total = Math.max(1, Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86400000));

  const occupation = occupationParBien();

  return {
    debut,
    fin,
    lignes: fluxActifs().map((f2) => {
      const p = occupation.get(f2.bien_id) || [];
      /* On ne compte que ce qui tombe dans la fenêtre observée : une
         réservation de l'an prochain ne doit pas gonfler le taux des douze
         mois qui viennent. */
      let occupes = 0;
      let sejours = 0;
      let prochaine: string | undefined;
      for (const x of p) {
        const d1 = x.d > debut ? x.d : debut;
        const d2 = x.f < fin ? x.f : fin;
        if (d1 > d2) continue;
        const n = Math.round((Date.parse(`${d2}T00:00:00Z`) - Date.parse(`${d1}T00:00:00Z`)) / 86400000) + 1;
        occupes += n;
        sejours += 1;
        if (!prochaine || d1 < prochaine) prochaine = d1;
      }
      return {
        bien_id: f2.bien_id,
        connu: Boolean(f2.dernier_ok) && !f2.erreur,
        erreur: f2.erreur,
        luLe: f2.dernier_ok,
        source: f2.source,
        url: f2.url,
        occupes,
        total,
        sejours,
        prochaine,
        derniere: p.length ? p[p.length - 1].f : undefined,
      };
    }),
  };
}

/**
 * Les logements réellement pris entre deux dates.
 *
 * Deux sources, et une hiérarchie claire entre elles.
 *
 * Le calendrier iCal d'abord, pour tout logement dont le flux a déjà été lu
 * une fois. C'est le calendrier de Lodgify, donc celui qui porte Airbnb,
 * Booking, Vrbo et les réservations directes : il n'y a rien au-dessus. Et un
 * flux lu qui ne porte aucune réservation sur la période est une réponse
 * positive - le logement est libre -, pas une absence de réponse.
 *
 * L'API de Lodgify ensuite, et seulement pour les logements sans flux. C'est
 * l'ordre inverse de celui qu'on croirait : une API paraît plus moderne qu'un
 * fichier de calendrier. Mais le chemin des disponibilités n'est pas documenté,
 * il change d'une offre à l'autre, et le site en essaie plusieurs sans
 * garantie ; l'export iCal est une adresse stable que Lodgify publie pour être
 * lue. La modernité n'est pas la fiabilité.
 *
 * Et si ni l'un ni l'autre ne répond, le logement est rendu comme « inconnu »
 * plutôt qu'écarté. Cacher un logement libre parce qu'une lecture a échoué
 * coûte une réservation ; le montrer alors qu'il est pris coûte un clic. Pour
 * l'affichage, le doute profite donc à la visibilité - c'est exactement
 * l'inverse de la règle qui gouverne la vente, où le doute bloque.
 */
export type DisponibiliteReelle = {
  /** Logements dont un calendrier dit qu'ils sont pris sur la période. */
  pris: Set<number>;
  /** Logements sur lesquels aucune source n'a rien dit. Ils restent affichés. */
  inconnus: Set<number>;
  /** Combien ont été tranchés par leur propre calendrier iCal. */
  parIcal: number;
  /** Vrai si l'API a servi pour le reste. */
  parApi: boolean;
};

export async function disponibiliteReelle(
  arrivee: string,
  depart: string,
  ids: number[]
): Promise<DisponibiliteReelle> {
  const pris = new Set<number>();
  const inconnus = new Set<number>();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivee) || !/^\d{4}-\d{2}-\d{2}$/.test(depart) || depart <= arrivee) {
    return { pris, inconnus, parIcal: 0, parApi: false };
  }

  /* Un flux qui a réussi au moins une fois vaut réponse, même s'il a échoué
     depuis : ses dates d'hier valent mieux que rien, et une réservation ne
     s'annule pas parce qu'un serveur a eu une mauvaise minute. */
  const lus = new Set(fluxActifs().filter((f) => f.dernier_ok).map((f) => f.bien_id));
  const occupation = occupationParBien();

  const restants: number[] = [];
  for (const id of ids) {
    if (!lus.has(id)) {
      restants.push(id);
      continue;
    }
    if (croise(occupation.get(id) || [], arrivee, depart)) pris.add(id);
  }

  let parApi = false;
  if (restants.length) {
    const api = await disponibilites(arrivee, depart);
    if (api.connu) {
      parApi = true;
      for (const id of restants) if (!api.libres.has(id)) pris.add(id);
    } else {
      for (const id of restants) inconnus.add(id);
    }
  }

  return { pris, inconnus, parIcal: ids.length - restants.length, parApi };
}
