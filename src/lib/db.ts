import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Ce que ce site écrit.
 *
 * Il ne détient ni catalogue, ni prix, ni calendrier - tout cela vit chez
 * Lodgify. Il ne détient que ce que Lodgify ne connaît pas : les propriétaires
 * qui demandent un audit, et les visiteurs qui écrivent depuis la page de
 * contact. Deux tables, donc, et c'est bien ainsi : moins ce site possède de
 * vérités, moins il peut en abîmer.
 *
 * Une demande d'audit doit survivre à tout. C'est un prospect qui a laissé son
 * numéro : la perdre parce qu'un courriel n'est pas parti serait la pire
 * défaillance possible de cette page. Elle est donc écrite en base D'ABORD,
 * l'envoi du courriel ne venant qu'ensuite et pouvant échouer sans rien perdre.
 */

let _db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS audits (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nom        TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  telephone  TEXT NOT NULL DEFAULT '',
  ville      TEXT NOT NULL DEFAULT '',
  type_bien  TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL DEFAULT '',
  locale     TEXT NOT NULL DEFAULT 'fr',
  courriel_envoye INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS avis (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  prenom     TEXT NOT NULL DEFAULT '',
  pays_fr    TEXT NOT NULL DEFAULT '',
  pays_en    TEXT NOT NULL DEFAULT '',
  bien_slug  TEXT NOT NULL DEFAULT '',
  bien_nom   TEXT NOT NULL DEFAULT '',
  texte_fr   TEXT NOT NULL DEFAULT '',
  texte_en   TEXT NOT NULL DEFAULT '',
  source     TEXT NOT NULL DEFAULT '',
  rang       INTEGER NOT NULL DEFAULT 100,
  publie     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS liens (
  bien_id    INTEGER PRIMARY KEY,
  url        TEXT NOT NULL DEFAULT '',
  photos     TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS diaporama (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  url        TEXT NOT NULL DEFAULT '',
  alt_fr     TEXT NOT NULL DEFAULT '',
  alt_en     TEXT NOT NULL DEFAULT '',
  rang       INTEGER NOT NULL DEFAULT 100,
  actif      INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nom        TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  telephone  TEXT NOT NULL DEFAULT '',
  sujet      TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL DEFAULT '',
  locale     TEXT NOT NULL DEFAULT 'fr',
  courriel_envoye INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function db(): Database.Database {
  if (_db) return _db;
  /* Le même dossier que les photographies déposées : ce que vous saisissez -
     avis, galeries, réglages, textes - ne doit jamais vivre dans le dossier du
     code, qui est reconstruit à chaque mise en ligne. En local, c'est ./data ;
     en production, le volume monté sur DATA_DIR. */
  const fichier =
    process.env.DATABASE_PATH || path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'ibsignature.db');
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  _db = new Database(fichier);
  _db.pragma('journal_mode = WAL');
  _db.exec(SCHEMA);
  return _db;
}

/* ---------- emporter la base, et la reposer ----------
 *
 * Cette base est un fichier unique sur un volume unique. C'est ce qui la rend
 * simple - pas de serveur à administrer, pas de mot de passe de plus - et
 * c'est ce qui la rend fragile : un volume perdu, et l'on perd vingt-quatre
 * logements équipés, seize calendriers, un RIB et des demandes de voyageurs.
 *
 * D'où ces deux fonctions. Elles servent d'abord à la mise en ligne - emporter
 * ce qui a été saisi en local plutôt que de tout ressaisir - mais elles
 * servent surtout après : une sauvegarde qu'on peut prendre en un clic est une
 * sauvegarde qu'on prend.
 */

/**
 * Le fichier de la base, complet et cohérent.
 *
 * Le point qui compte tient en une ligne : `wal_checkpoint`. En mode WAL,
 * SQLite écrit d'abord dans un fichier d'attente - `.db-wal` - et ne le
 * reverse dans le fichier principal que de temps en temps. Copier le seul
 * `.db` donne donc une base amputée de tout ce qui est récent, sans la moindre
 * erreur pour le signaler.
 *
 * C'est exactement ce qui s'était produit en inspectant la base de
 * développement : cinquante-sept kilo-octets de fichier principal, un
 * mégahuit d'attente, et trois jours de travail invisibles. Une sauvegarde qui
 * perd les trois derniers jours est pire que pas de sauvegarde : on lui fait
 * confiance.
 */
export function sauvegarder(): Buffer {
  const base = db();
  base.pragma('wal_checkpoint(TRUNCATE)');
  return fs.readFileSync(cheminBase());
}

function cheminBase(): string {
  return (
    process.env.DATABASE_PATH || path.join(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'ibsignature.db')
  );
}

/**
 * Repose une base venue d'ailleurs, à la place de celle-ci.
 *
 * Trois précautions, et aucune n'est du zèle.
 *
 * On vérifie d'abord que le fichier EST une base de ce site : un fichier
 * quelconque déposé par erreur remplacerait tout par rien, et l'on ne s'en
 * apercevrait qu'en ouvrant une page vide.
 *
 * On garde ensuite l'ancienne à côté, datée. Une restauration est le geste le
 * plus irréversible de cette administration ; pouvoir revenir en arrière coûte
 * un fichier.
 *
 * On ferme enfin la connexion avant d'écrire. Remplacer sous les pieds de
 * SQLite un fichier qu'il tient ouvert donne une base à moitié l'une et à
 * moitié l'autre - et c'est le genre de dégât qui ne se voit qu'au premier
 * client.
 */
export function restaurer(contenu: Buffer): { ok: boolean; detail: string } {
  if (contenu.length < 512 || contenu.subarray(0, 15).toString('utf8') !== 'SQLite format 3') {
    return { ok: false, detail: 'ce fichier n’est pas une base SQLite' };
  }

  const dossier = path.dirname(cheminBase());
  const essai = path.join(dossier, `entrant-${Date.now()}.db`);
  fs.writeFileSync(essai, contenu);
  try {
    const candidate = new Database(essai, { readonly: true });
    const tables = candidate
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((r: any) => String(r.name));
    candidate.close();
    /* Deux tables suffisent à reconnaître ce site : `liens` porte les
       logements, `reglages` les décisions de la maison. Un fichier SQLite
       venu d'ailleurs n'aura ni l'une ni l'autre. */
    if (!tables.includes('liens') || !tables.includes('reglages')) {
      fs.unlinkSync(essai);
      return { ok: false, detail: 'base SQLite valide, mais ce n’est pas celle d’IB Signature' };
    }
  } catch (e: any) {
    try { fs.unlinkSync(essai); } catch {}
    return { ok: false, detail: `fichier illisible : ${e?.message || 'erreur inconnue'}` };
  }

  try {
    if (_db) {
      _db.pragma('wal_checkpoint(TRUNCATE)');
      _db.close();
      _db = null;
    }
    const horodate = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    for (const suffixe of ['', '-wal', '-shm']) {
      const f = `${cheminBase()}${suffixe}`;
      if (fs.existsSync(f)) fs.renameSync(f, `${dossier}/avant-restauration-${horodate}.db${suffixe}`);
    }
    fs.renameSync(essai, cheminBase());
    /* On rouvre tout de suite : si quelque chose cloche dans le fichier
       reposé, autant le savoir maintenant que devant un visiteur. */
    const n = (db().prepare('SELECT COUNT(*) n FROM liens').get() as { n: number }).n;
    return { ok: true, detail: `base reposée, ${n} logement(s) retrouvé(s)` };
  } catch (e: any) {
    return { ok: false, detail: `remplacement impossible : ${e?.message || 'erreur inconnue'}` };
  }
}

export type Audit = {
  nom: string;
  email: string;
  telephone: string;
  ville: string;
  type_bien: string;
  message: string;
  locale: string;
};

export function enregistrerAudit(a: Audit): number {
  const info = db()
    .prepare(
      `INSERT INTO audits (nom, email, telephone, ville, type_bien, message, locale)
       VALUES (@nom, @email, @telephone, @ville, @type_bien, @message, @locale)`
    )
    .run(a);
  return Number(info.lastInsertRowid);
}

export function marquerEnvoye(id: number) {
  db().prepare('UPDATE audits SET courriel_envoye = 1 WHERE id = ?').run(id);
}

export type Message = {
  nom: string;
  email: string;
  telephone: string;
  sujet: string;
  message: string;
  locale: string;
};

/* Même règle que pour un audit : on écrit d'abord, on envoie ensuite. Un
   voyageur qui pose une question sur une réservation ne doit pas dépendre d'un
   fournisseur de courriel pour être entendu. */
export function enregistrerMessage(m: Message): number {
  const info = db()
    .prepare(
      `INSERT INTO messages (nom, email, telephone, sujet, message, locale)
       VALUES (@nom, @email, @telephone, @sujet, @message, @locale)`
    )
    .run(m);
  return Number(info.lastInsertRowid);
}

export function marquerMessageEnvoye(id: number) {
  db().prepare('UPDATE messages SET courriel_envoye = 1 WHERE id = ?').run(id);
}

export function messagesRecents(n = 100) {
  return db().prepare('SELECT * FROM messages ORDER BY id DESC LIMIT ?').all(n);
}

export function auditsRecents(n = 100) {
  return db().prepare('SELECT * FROM audits ORDER BY id DESC LIMIT ?').all(n);
}


/* ---------- les avis ----------
   Ils vivaient dans data/avis.json. Un fichier n'est pas modifiable depuis une
   interface une fois le site déployé : les avis passent donc en base, et le
   JSON ne sert plus qu'à amorcer la table la première fois. Vos avis existants
   ne sont pas perdus, ils sont simplement recopiés. */

export type LigneAvis = {
  id: number;
  prenom: string;
  pays_fr: string;
  pays_en: string;
  bien_slug: string;
  bien_nom: string;
  texte_fr: string;
  texte_en: string;
  source: string;
  rang: number;
  publie: number;
};

const CHAMPS_AVIS = ['prenom', 'pays_fr', 'pays_en', 'bien_slug', 'bien_nom', 'texte_fr', 'texte_en', 'source', 'rang', 'publie'] as const;

export function amorcerAvis(graine: Omit<LigneAvis, 'id'>[]) {
  const n = db().prepare('SELECT COUNT(*) c FROM avis').get() as { c: number };
  if (n.c > 0) return;
  const ins = db().prepare(
    `INSERT INTO avis (prenom, pays_fr, pays_en, bien_slug, bien_nom, texte_fr, texte_en, source, rang, publie)
     VALUES (@prenom, @pays_fr, @pays_en, @bien_slug, @bien_nom, @texte_fr, @texte_en, @source, @rang, @publie)`
  );
  db().transaction((liste: Omit<LigneAvis, 'id'>[]) => liste.forEach((a) => ins.run(a)))(graine);
}

export function listerAvis(seulementPublies = true): LigneAvis[] {
  const where = seulementPublies ? 'WHERE publie = 1' : '';
  return db().prepare(`SELECT * FROM avis ${where} ORDER BY rang, id`).all() as LigneAvis[];
}

export function unAvis(id: number): LigneAvis | undefined {
  return db().prepare('SELECT * FROM avis WHERE id = ?').get(id) as LigneAvis | undefined;
}

/* Écriture par liste blanche de colonnes : une clef inconnue venant d'un
   formulaire ne doit jamais atteindre la requête. */
export function ecrireAvis(id: number | null, v: Record<string, string | number>): number {
  const cols = CHAMPS_AVIS.filter((c) => c in v);
  if (!cols.length) return id ?? 0;
  if (id) {
    db().prepare(`UPDATE avis SET ${cols.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @id`).run({ ...v, id });
    return id;
  }
  const info = db()
    .prepare(`INSERT INTO avis (${cols.join(', ')}) VALUES (${cols.map((c) => '@' + c).join(', ')})`)
    .run(v);
  return Number(info.lastInsertRowid);
}

export function supprimerAvis(id: number) {
  db().prepare('DELETE FROM avis WHERE id = ?').run(id);
}

/* ---------- le diaporama ---------- */

export type LigneImage = { id: number; url: string; alt_fr: string; alt_en: string; rang: number; actif: number };

const CHAMPS_IMAGE = ['url', 'alt_fr', 'alt_en', 'rang', 'actif'] as const;

export function listerImages(seulementActives = true): LigneImage[] {
  const where = seulementActives ? 'WHERE actif = 1' : '';
  return db().prepare(`SELECT * FROM diaporama ${where} ORDER BY rang, id`).all() as LigneImage[];
}

export function ecrireImage(id: number | null, v: Record<string, string | number>): number {
  const cols = CHAMPS_IMAGE.filter((c) => c in v);
  if (!cols.length) return id ?? 0;
  if (id) {
    db().prepare(`UPDATE diaporama SET ${cols.map((c) => `${c} = @${c}`).join(', ')} WHERE id = @id`).run({ ...v, id });
    return id;
  }
  const info = db()
    .prepare(`INSERT INTO diaporama (${cols.join(', ')}) VALUES (${cols.map((c) => '@' + c).join(', ')})`)
    .run(v);
  return Number(info.lastInsertRowid);
}

export function supprimerImage(id: number) {
  db().prepare('DELETE FROM diaporama WHERE id = ?').run(id);
}


/* ---------- les liens de réservation ----------
   Le moteur Lodgify de chaque compte a sa propre structure d'adresses. Celle
   d'IB Signature est en français et à base de slugs, pas d'identifiants : une
   adresse fabriquée à partir de l'identifiant du bien menait à une page
   introuvable, au pire moment possible pour un voyageur.

   On ne fabrique donc plus rien. L'adresse exacte de chaque logement se colle
   ici une fois, depuis l'administration, et le site s'y tient. */

/* La colonne « photos » est arrivée après la table : sur une base déjà créée,
   il faut l'ajouter à la main. SQLite n'a pas d'`ADD COLUMN IF NOT EXISTS`, on
   essaie donc et on ignore l'erreur si elle est déjà là. */
function migrerLiens() {
  for (const col of [
    "photos TEXT NOT NULL DEFAULT ''",
    "photos_ecartees TEXT NOT NULL DEFAULT ''",
    'photos_verrou INTEGER NOT NULL DEFAULT 0',
    "description_fr TEXT NOT NULL DEFAULT ''",
    "description_en TEXT NOT NULL DEFAULT ''",
    'f_chambres INTEGER NOT NULL DEFAULT 0',
    'f_lits INTEGER NOT NULL DEFAULT 0',
    'f_bains INTEGER NOT NULL DEFAULT 0',
    'f_eau INTEGER NOT NULL DEFAULT 0',
    'f_canapes INTEGER NOT NULL DEFAULT 0',
    'f_surface INTEGER NOT NULL DEFAULT 0',
    'f_voyageurs INTEGER NOT NULL DEFAULT 0',
    'f_sejour_min INTEGER NOT NULL DEFAULT 0',
    "f_quartier TEXT NOT NULL DEFAULT ''",
    "equipements TEXT NOT NULL DEFAULT ''",
  ]) {
    try {
      db().exec(`ALTER TABLE liens ADD COLUMN ${col}`);
    } catch {
      /* colonne déjà présente */
    }
  }
}

export function liensReservation(): Map<number, string> {
  migrerLiens();
  const lignes = db().prepare('SELECT bien_id, url FROM liens').all() as { bien_id: number; url: string }[];
  return new Map(lignes.filter((l) => l.url).map((l) => [l.bien_id, l.url]));
}

export function ecrireLien(bienId: number, url: string) {
  if (!bienId) return;
  db()
    .prepare(
      `INSERT INTO liens (bien_id, url, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(bien_id) DO UPDATE SET url = excluded.url, updated_at = datetime('now')`
    )
    .run(bienId, url);
}

/* ---------- les galeries tenues à la main ----------
   L'API de Lodgify n'expose qu'une photo de couverture par logement. Tant
   qu'un point d'entrée n'aura pas été trouvé pour les autres, les adresses se
   collent ici, une par ligne. Elles viennent s'ajouter à la couverture, elles
   ne la remplacent pas. */

export function galeries(): Map<number, string[]> {
  migrerLiens();
  const lignes = db().prepare('SELECT bien_id, photos FROM liens').all() as { bien_id: number; photos: string }[];
  return new Map(
    lignes
      .map((l) => [l.bien_id, (l.photos || '').split(/\r?\n/).map((u) => u.trim()).filter(Boolean)] as [number, string[]])
      .filter(([, u]) => u.length)
  );
}

export function ecrireGalerie(bienId: number, photos: string) {
  if (!bienId) return;
  migrerLiens();
  db()
    .prepare(
      `INSERT INTO liens (bien_id, photos, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(bien_id) DO UPDATE SET photos = excluded.photos, updated_at = datetime('now')`
    )
    .run(bienId, photos);
}

/* ---------- les réglages ----------
   Deux moyens de paiement, deux prix. Le prix par carte porte la commission du
   prestataire ; le prix par virement ne porte rien du tout. L'écart entre les
   deux n'est donc pas une décision de design, c'est une conséquence
   arithmétique - et une conséquence ne se code pas en dur.

   Une règle vaut d'être dite : tant que la commission réelle n'est pas
   renseignée, le virement reste éteint et le site n'affiche qu'un prix. Un
   second prix calculé sur une commission supposée serait un prix inventé, et
   un prix inventé engage. */

const DEFAUTS: Record<string, string> = {
  commission_pct: '',
  commission_fixe: '',
  conversion_pct: '',
  /* Le taux du plan tarifaire posé chez Lodgify, qui ajoute une ligne « frais
     de transaction » au séjour. Vide, le site retombe sur son propre calcul.

     Ce réglage a une raison d'être précise : depuis que Lodgify majore
     lui-même, le prix qu'il rend n'est plus le prix nu du séjour, il porte
     déjà les frais. Le montant à virer n'est donc plus « le prix moins ce que
     Payyo prendrait » - une soustraction juste mais invisible pour le
     voyageur - c'est « le prix moins la ligne qu'il a sous les yeux ». Le même
     montant à quelques centimes près, et une phrase qu'on peut dire :
     « vous ne payez pas les frais de transaction ». */
  plan_majoration_pct: '',
  virement_actif: '0',
  virement_delai_jours: '5',
  virement_blocage_heures: '48',
  /* Le temps dont dispose le voyageur pour ordonner son virement.
     Distinct du blocage, et plus court : la maison ferme le calendrier
     quarante-huit heures, mais demande le virement sous vingt-quatre. Cet
     ecart n'est pas une negligence, c'est la marge - un virement parti le
     dernier jour met encore une nuit a arriver. Annoncer le meme chiffre pour
     les deux ferait perdre des reservations parties a l'heure. */
  virement_virer_heures: '24',
  virement_devise: 'MAD',
  virement_beneficiaire: 'Partners Hotels SARL AU',
  virement_rib: '',
  virement_frais: 'client',
  virement_part: 'totalite',
  /* Le taux servant à afficher la contre-valeur en dirhams, à titre indicatif.
     Il n'engage rien - c'est le montant en euros qui fait foi - mais il est
     daté, parce qu'un taux sans date finit par mentir sans qu'on s'en aperçoive.
     Laissé vide, aucun montant en dirhams n'est affiché : mieux vaut ne rien
     dire qu'annoncer une contre-valeur d'il y a un an. */
  taux_mad: '',
  taux_mad_date: '',
  /* Le délai sous lequel vous vous engagez à répondre à une demande de
     virement. Il est écrit au voyageur, donc il vous engage. */
  virement_reponse_heures: '12',

  /* ---------- les conditions d'annulation ----------
   *
   * Elles vivent en réglage et non dans le code pour une raison simple : elles
   * changent. Une politique d'annulation se resserre en haute saison et
   * s'assouplit quand les calendriers sont creux, et personne ne va redéployer
   * un site pour passer de cinq jours à sept.
   *
   * Elles sont écrites en un seul endroit et lues partout - la page des
   * conditions, l'étape de paiement, le courriel de confirmation. C'est la
   * seule façon d'éviter qu'elles finissent par dire trois choses différentes
   * à trois endroits, ce qui, sur une clause d'annulation, se règle devant un
   * juge et non par un correctif.
   *
   * Zéro jour est une valeur licite : elle veut dire « aucune annulation
   * gratuite », et la page l'écrit alors en toutes lettres plutôt que
   * d'annoncer un délai de zéro jour, qui ne veut rien dire. */
  annul_jours: '5',
  /* Ce qui est retenu au-delà du délai, en pourcentage du séjour. */
  annul_retenu_pct: '100',
  /* Le délai, en jours, sous lequel le remboursement est effectué. */
  annul_rembours_jours: '14',
  /* Une clause supplémentaire, écrite par vous, ajoutée sous les conditions.
     Vide, rien ne s'affiche - une section vide vaut moins que pas de section. */
  annul_note_fr: '',
  annul_note_en: '',

  /* ---------- les horaires du séjour ----------
   *
   * Les mêmes pour les vingt-quatre logements et quelle que soit la durée. Ils
   * sont en réglage plutôt qu'en dur pour la raison qui vaut pour tout le
   * reste ici : ce sont des chiffres qui bougent - une haute saison, un
   * prestataire de ménage qui change d'horaires - et personne ne redéploie un
   * site pour avancer un départ d'une heure.
   *
   * Ils s'écrivent en un seul endroit et se lisent partout : la fiche du
   * logement, les conditions générales, et le courriel de confirmation. Trois
   * textes qui annonceraient trois heures différentes se règlent devant une
   * porte fermée, un jour de canicule, avec des valises. */
  sejour_checkin: '15:00',
  sejour_checkout: '11:00',
};

function migrerReglages() {
  db().exec(
    `CREATE TABLE IF NOT EXISTS reglages (
       cle TEXT PRIMARY KEY,
       valeur TEXT NOT NULL DEFAULT '',
       updated_at TEXT NOT NULL DEFAULT (datetime('now')))`
  );
}

export function reglages(): Record<string, string> {
  migrerReglages();
  const lignes = db().prepare('SELECT cle, valeur FROM reglages').all() as { cle: string; valeur: string }[];
  const out = { ...DEFAUTS };
  for (const l of lignes) if (l.cle in DEFAUTS) out[l.cle] = l.valeur;
  return out;
}

/* Liste blanche, comme partout ailleurs : une clef inconnue venue d'un
   formulaire n'entre pas en base. */
export function ecrireReglages(v: Record<string, string>) {
  migrerReglages();
  const ins = db().prepare(
    `INSERT INTO reglages (cle, valeur, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur, updated_at = datetime('now')`
  );
  db().transaction(() => {
    for (const cle of Object.keys(DEFAUTS)) if (cle in v) ins.run(cle, String(v[cle] ?? ''));
  })();
}

/**
 * La majoration qui compense ce que le prestataire retient.
 *
 * Elle n'est pas égale à la commission, pour deux raisons.
 *
 * La première est arithmétique : prélever 5 % de ce qui est encaissé n'est pas
 * la même chose que prendre 5 % de ce qu'on veut toucher. Pour toucher 100 net
 * d'une commission de 5 %, il faut encaisser 100 / 0,95, soit 105,26 - la
 * majoration est donc de 5,26 % et non de 5 %.
 *
 * La seconde est contractuelle : le voyageur paie en euros, Partners Hotels
 * est réglée en dirhams, et les conditions de Payyo autorisent jusqu'à 2 % sur
 * les transactions qui demandent une conversion. Ces deux pour cent ne sont
 * pas une commission de carte, mais ils sortent de la même poche, et une
 * majoration qui les oublie laisse un trou à chaque réservation.
 *
 * Rend `null` tant que la commission n'est pas connue : mieux vaut un seul
 * prix qu'un second prix faux.
 */
/**
 * Le prix nu, une fois retirée la ligne que Lodgify ajoute lui-même.
 *
 * Lodgify facture désormais `sous-total × (1 + taux)`. Retirer cette ligne est
 * donc une division, pas une soustraction de pourcentage - une erreur qui
 * paraît anodine et ne l'est pas : retirer 6,33 % de 310,07 € rend 290,44 €,
 * alors que le sous-total est 291,50 €. Un euro par réservation, dans le
 * mauvais sens, sans que rien ne le signale.
 *
 * Rend `null` tant que le taux n'est pas renseigné : le site ne devine pas ce
 * qui a été posé chez Lodgify.
 */
export function sansPlan(brut: number, r = reglages()): number | null {
  const nombre = (v: string) => Number(String(v || '0').replace(',', '.')) || 0;
  const pct = nombre(r.plan_majoration_pct);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  if (!Number.isFinite(brut) || brut <= 0) return null;
  const v = brut / (1 + pct / 100);
  return v > 0 ? v : null;
}

export function majoration(net: number, r = reglages()): number | null {
  const nombre = (v: string) => Number(String(v || '0').replace(',', '.')) || 0;
  const pct = nombre(r.commission_pct);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  const retenu = pct + nombre(r.conversion_pct);
  if (retenu >= 100) return null;
  const fixe = nombre(r.commission_fixe);
  if (!Number.isFinite(net) || net <= 0) return null;
  return (net + fixe) / (1 - retenu / 100);
}

/**
 * L'opération inverse : ce qui reste d'un prix encaissé par carte.
 *
 * Le site ne fixe pas les prix - c'est Lodgify qui les tient, et c'est lui qui
 * encaisse la carte. Ce que le site connaît d'un séjour, c'est donc le prix
 * affiché, majoration comprise. Pour proposer le virement il lui faut le
 * chemin d'à côté : de ce prix affiché vers ce que vous touchez réellement,
 * qui est exactement le montant à virer.
 *
 * Ces deux fonctions doivent se composer sans dérive : net(majoration(x)) = x.
 * C'est vérifié, parce qu'une arithmétique de prix qui dérive d'un centime à
 * chaque passage finit par dériver d'un euro.
 *
 * Rend `null` dans les mêmes cas que `majoration` : sans commission connue, il
 * n'y a pas de second prix à annoncer.
 */
export function net(brut: number, r = reglages()): number | null {
  const nombre = (v: string) => Number(String(v || '0').replace(',', '.')) || 0;
  const pct = nombre(r.commission_pct);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  const retenu = pct + nombre(r.conversion_pct);
  if (retenu >= 100) return null;
  const fixe = nombre(r.commission_fixe);
  if (!Number.isFinite(brut) || brut <= 0) return null;
  const v = brut * (1 - retenu / 100) - fixe;
  return v > 0 ? v : null;
}

/* ---------- l'ordre des photographies ----------
   Le script d'import range les photos par pièce et par qualité, ce qui donne
   un ordre correct. Correct n'est pas choisi : vous seul savez quelle image
   fait vendre un logement, et laquelle montre un mur.

   D'où trois notions distinctes. Les retenues, dans l'ordre exact d'affichage,
   la première servant de couverture. Les écartées, qui ne s'affichent plus
   mais restent là - une photo retirée un jour se remet un autre jour, et la
   supprimer pour de bon obligerait à relancer tout l'import pour la
   retrouver. Et le verrou : dès que vous avez touché une galerie, un nouvel
   import ne l'écrase plus. Un outil qui défait le travail de son utilisateur
   n'est pas un outil, c'est un piège. */

export type Galerie = { retenues: string[]; ecartees: string[]; verrou: boolean };

const lignes = (t: string) =>
  (t || '')
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter(Boolean);

export function galerieDe(bienId: number): Galerie {
  migrerLiens();
  const l = db()
    .prepare('SELECT photos, photos_ecartees, photos_verrou FROM liens WHERE bien_id = ?')
    .get(bienId) as { photos: string; photos_ecartees: string; photos_verrou: number } | undefined;
  return {
    retenues: lignes(l?.photos || ''),
    ecartees: lignes(l?.photos_ecartees || ''),
    verrou: Boolean(l?.photos_verrou),
  };
}

export function galeriesCompletes(): Map<number, Galerie> {
  migrerLiens();
  const rows = db()
    .prepare('SELECT bien_id, photos, photos_ecartees, photos_verrou FROM liens')
    .all() as { bien_id: number; photos: string; photos_ecartees: string; photos_verrou: number }[];
  return new Map(
    rows.map((l) => [
      l.bien_id,
      { retenues: lignes(l.photos), ecartees: lignes(l.photos_ecartees), verrou: Boolean(l.photos_verrou) },
    ])
  );
}

/** Écriture depuis l'administration : elle pose le verrou, par définition. */
export function ecrireGalerieChoisie(bienId: number, retenues: string[], ecartees: string[]) {
  if (!bienId) return;
  migrerLiens();
  db()
    .prepare(
      `INSERT INTO liens (bien_id, photos, photos_ecartees, photos_verrou, updated_at)
       VALUES (?, ?, ?, 1, datetime('now'))
       ON CONFLICT(bien_id) DO UPDATE SET photos = excluded.photos,
         photos_ecartees = excluded.photos_ecartees, photos_verrou = 1, updated_at = datetime('now')`
    )
    .run(bienId, retenues.join('\n'), ecartees.join('\n'));
}

/** Rendre la main au script d'import pour ce logement. */
export function libererGalerie(bienId: number) {
  migrerLiens();
  db().prepare('UPDATE liens SET photos_verrou = 0, updated_at = datetime(\'now\') WHERE bien_id = ?').run(bienId);
}

/* ---------- les descriptions ----------
   Lodgify porte un texte par logement, écrit pour Airbnb et Booking : il y
   parle de plateformes, de règles de maison, parfois en anglais seulement. Ce
   site n'a pas les mêmes lecteurs.

   La description saisie ici l'emporte donc sur celle de Lodgify, langue par
   langue. Laisser un champ vide n'efface rien : c'est Lodgify qui reprend la
   main, ce qui est le comportement voulu quand on n'a rien à ajouter. */

export type Descriptions = { fr: string; en: string };

export function descriptions(): Map<number, Descriptions> {
  migrerLiens();
  const rows = db()
    .prepare('SELECT bien_id, description_fr, description_en FROM liens')
    .all() as { bien_id: number; description_fr: string; description_en: string }[];
  return new Map(
    rows
      .map((l) => [l.bien_id, { fr: l.description_fr || '', en: l.description_en || '' }] as [number, Descriptions])
      .filter(([, d]) => d.fr || d.en)
  );
}

export function descriptionDe(bienId: number): Descriptions {
  migrerLiens();
  const l = db()
    .prepare('SELECT description_fr, description_en FROM liens WHERE bien_id = ?')
    .get(bienId) as { description_fr: string; description_en: string } | undefined;
  return { fr: l?.description_fr || '', en: l?.description_en || '' };
}

export function ecrireDescription(bienId: number, d: Descriptions) {
  if (!bienId) return;
  migrerLiens();
  db()
    .prepare(
      `INSERT INTO liens (bien_id, description_fr, description_en, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(bien_id) DO UPDATE SET description_fr = excluded.description_fr,
         description_en = excluded.description_en, updated_at = datetime('now')`
    )
    .run(bienId, d.fr, d.en);
}

/* ---------- les caractéristiques d'un logement ----------
   Lodgify dit le nombre de chambres et la capacité, rarement les lits, presque
   jamais les salles de bain ou la surface. Ce qui manque se saisit ici, une
   fois, et ce qui est saisi passe devant : vous connaissez vos appartements
   mieux qu'une API.

   Zéro veut dire « non renseigné », pas « aucun ». C'est la seule convention
   qui permette de laisser un champ vide sans affirmer qu'un logement n'a pas
   de salle de bain. */

export type Faits = {
  chambres: number;
  lits: number;
  /* Le canapé-lit se compte à part des lits, et il le faut : un voyageur qui
     lit « 4 lits » et découvre qu'il y en a deux dans le salon a le sentiment
     d'avoir été trompé, même si le compte était exact. */
  canapes: number;
  /* Trois pièces d'eau distinctes, parce que les trois ne valent pas la même
     chose. Une salle de bain a une baignoire ; une salle d'eau, une douche et
     souvent le WC ; et confondre les deux, c'est promettre un bain à qui
     n'aura qu'une douche. */
  bains: number;
  eau: number;
  surface: number;
  voyageurs: number;
  sejour_min: number;
  /* Le quartier n'est pas un nombre, mais il se saisit au même endroit et pour
     la même raison : Lodgify ne le publie pas, et « Casablanca » tout seul ne
     dit rien à qui cherche le Triangle d'Or. */
  quartier: string;
};

const CHAMPS_NOMBRES = ['chambres', 'lits', 'canapes', 'bains', 'eau', 'surface', 'voyageurs', 'sejour_min'] as const;
const CHAMPS_FAITS = [...CHAMPS_NOMBRES, 'quartier'] as const;
const FAITS_VIDES: Faits = { chambres: 0, lits: 0, canapes: 0, bains: 0, eau: 0, surface: 0, voyageurs: 0, sejour_min: 0, quartier: '' };

function ligneEnFaits(l: Record<string, any> | undefined): Faits {
  if (!l) return { ...FAITS_VIDES };
  const out = { ...FAITS_VIDES };
  for (const c of CHAMPS_NOMBRES) out[c] = Number(l[`f_${c}`]) || 0;
  out.quartier = String(l.f_quartier || '');
  return out;
}

export function faitsDe(bienId: number): Faits {
  migrerLiens();
  const l = db()
    .prepare(`SELECT ${CHAMPS_FAITS.map((c) => `f_${c}`).join(', ')} FROM liens WHERE bien_id = ?`)
    .get(bienId) as Record<string, any> | undefined;
  return ligneEnFaits(l);
}

export function tousLesFaits(): Map<number, Faits> {
  migrerLiens();
  const rows = db()
    .prepare(`SELECT bien_id, ${CHAMPS_FAITS.map((c) => `f_${c}`).join(', ')} FROM liens`)
    .all() as Record<string, any>[];
  return new Map(rows.map((l) => [Number(l.bien_id), ligneEnFaits(l)]));
}

export function ecrireFaits(bienId: number, f: Partial<Faits>) {
  if (!bienId) return;
  migrerLiens();
  const v = { ...FAITS_VIDES, ...f };
  db()
    .prepare(
      `INSERT INTO liens (bien_id, ${CHAMPS_FAITS.map((c) => `f_${c}`).join(', ')}, updated_at)
       VALUES (@bien_id, ${CHAMPS_FAITS.map((c) => `@${c}`).join(', ')}, datetime('now'))
       ON CONFLICT(bien_id) DO UPDATE SET
         ${CHAMPS_FAITS.map((c) => `f_${c} = excluded.f_${c}`).join(', ')}, updated_at = datetime('now')`
    )
    .run({ ...v, bien_id: bienId });
}

/* ---------- les équipements ----------
   Une liste de clefs séparées par des virgules, choisies dans un catalogue
   fermé. Le contrôle de validité se fait à l'écriture, pas à la lecture : une
   clef inconnue entrée un jour ne doit pas faire disparaître la fiche tous les
   jours suivants. */

const enListe = (t: string) =>
  (t || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);

export function equipements(): Map<number, string[]> {
  migrerLiens();
  const rows = db().prepare('SELECT bien_id, equipements FROM liens').all() as {
    bien_id: number;
    equipements: string;
  }[];
  return new Map(rows.map((l) => [Number(l.bien_id), enListe(l.equipements)]).filter(([, v]) => (v as string[]).length) as [number, string[]][]);
}

export function equipementsDeBien(bienId: number): string[] {
  migrerLiens();
  const l = db().prepare('SELECT equipements FROM liens WHERE bien_id = ?').get(bienId) as
    | { equipements: string }
    | undefined;
  return enListe(l?.equipements || '');
}

export function ecrireEquipements(bienId: number, cles: string[]) {
  if (!bienId) return;
  migrerLiens();
  db()
    .prepare(
      `INSERT INTO liens (bien_id, equipements, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(bien_id) DO UPDATE SET equipements = excluded.equipements, updated_at = datetime('now')`
    )
    .run(bienId, cles.join(','));
}

/* ---------- les demandes de virement ----------
   Une réservation par virement n'est pas une réservation instantanée, et le
   prétendre serait mentir. Elle se déroule en trois temps : le voyageur
   s'engage sur un montant, l'argent chemine, vous constatez l'arrivée. Entre
   le premier et le troisième, les dates doivent être tenues pour lui sans être
   vendues à un autre - c'est tout l'objet de cette table.

   Elle porte le montant tel qu'il a été annoncé, et non tel qu'on le
   recalculerait aujourd'hui. Un tarif Lodgify peut changer entre la demande et
   le virement ; ce qui engage est ce que le voyageur a lu, pas ce que l'API
   dirait maintenant. C'est la raison d'être de ces colonnes figées.

   Elle porte aussi une échéance. Un blocage qui ne s'éteint pas finit par
   geler un calendrier entier, et personne ne pense à faire le ménage. */

function migrerVirements() {
  db().exec(
    `CREATE TABLE IF NOT EXISTS virements (
       id         INTEGER PRIMARY KEY AUTOINCREMENT,
       reference  TEXT NOT NULL UNIQUE,
       bien_id    INTEGER NOT NULL,
       bien_nom   TEXT NOT NULL DEFAULT '',
       slug       TEXT NOT NULL DEFAULT '',
       arrivee    TEXT NOT NULL DEFAULT '',
       depart     TEXT NOT NULL DEFAULT '',
       nuits      INTEGER NOT NULL DEFAULT 0,
       voyageurs  INTEGER NOT NULL DEFAULT 0,
       montant    REAL NOT NULL DEFAULT 0,
       devise     TEXT NOT NULL DEFAULT 'EUR',
       montant_mad REAL NOT NULL DEFAULT 0,
       taux       REAL NOT NULL DEFAULT 0,
       nom        TEXT NOT NULL DEFAULT '',
       email      TEXT NOT NULL DEFAULT '',
       telephone  TEXT NOT NULL DEFAULT '',
       message    TEXT NOT NULL DEFAULT '',
       locale     TEXT NOT NULL DEFAULT 'fr',
       statut     TEXT NOT NULL DEFAULT 'attente',
       expire_at  TEXT NOT NULL DEFAULT '',
       courriel_envoye INTEGER NOT NULL DEFAULT 0,
       created_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  );

  /* Ce que le voyageur saisit désormais avant de choisir son moyen de
     paiement. Ajouté après coup, donc en colonnes séparées plutôt qu'en
     refondant la table : les demandes déjà reçues doivent rester lisibles.

     `nom` portait le nom complet ; il porte maintenant le nom de famille, et
     `prenom` le reste. Les anciennes lignes gardent leur nom complet dans
     `nom` et un prénom vide - ce qui s'affiche correctement sans conversion.

     `moyen` distingue les deux chemins. Il compte plus qu'il n'en a l'air :
     une piste partie chez Lodgify ne doit JAMAIS bloquer de dates - elle n'a
     rien réservé, elle est seulement passée par ici. */
  for (const col of [
    "prenom      TEXT NOT NULL DEFAULT ''",
    "nationalite TEXT NOT NULL DEFAULT ''",
    "residence   TEXT NOT NULL DEFAULT ''",
    "moyen       TEXT NOT NULL DEFAULT 'virement'",
  ]) {
    try {
      db().exec(`ALTER TABLE virements ADD COLUMN ${col}`);
    } catch {
      /* colonne déjà présente */
    }
  }
}

export type Virement = {
  id: number;
  reference: string;
  bien_id: number;
  bien_nom: string;
  slug: string;
  arrivee: string;
  depart: string;
  nuits: number;
  voyageurs: number;
  montant: number;
  devise: string;
  montant_mad: number;
  taux: number;
  /** Le nom de famille. Les demandes d'avant la refonte y portent le nom complet. */
  nom: string;
  prenom: string;
  nationalite: string;
  /** Le lieu de résidence, tel que le voyageur l'écrit. Aucune liste imposée. */
  residence: string;
  email: string;
  telephone: string;
  message: string;
  locale: string;
  /** Le chemin choisi. Une piste `carte` n'a rien réservé : elle ne tient aucune date. */
  moyen: 'virement' | 'carte';
  /* `piste` est le statut d'une réservation partie chez Lodgify : elle est
     enregistrée pour que le contact ne soit pas perdu si le voyageur
     abandonne devant le formulaire de carte, mais elle ne bloque rien. */
  statut: 'attente' | 'recu' | 'annule' | 'expire' | 'piste';
  expire_at: string;
  courriel_envoye: number;
  created_at: string;
};

/* Une référence que le voyageur recopiera sur son ordre de virement, et que
   vous lirez sur votre relevé. Elle doit donc se dicter au téléphone : pas de
   O ni de I, qui se confondent avec 0 et 1 sur un relevé bancaire. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function nouvelleReference(): string {
  const d = new Date();
  const mois = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
  let tirage = '';
  for (let i = 0; i < 4; i += 1) tirage += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `IB-${mois}-${tirage}`;
}

export function enregistrerVirement(
  v: Omit<Virement, 'id' | 'reference' | 'statut' | 'courriel_envoye' | 'created_at'>
): Virement {
  migrerVirements();
  /* Le statut découle du moyen, il ne se passe pas en paramètre. Une piste
     partie chez Lodgify enregistrée par erreur en « attente » tiendrait les
     dates d'une réservation qui n'a jamais eu lieu, et fermerait le
     calendrier à tout le monde jusqu'à son expiration. */
  const statut = v.moyen === 'carte' ? 'piste' : 'attente';
  /* Une collision de référence est improbable, pas impossible. On réessaie
     plutôt que d'échouer devant un voyageur qui vient de saisir ses
     coordonnées. */
  for (let essai = 0; essai < 12; essai += 1) {
    const reference = nouvelleReference();
    try {
      const info = db()
        .prepare(
          `INSERT INTO virements (reference, bien_id, bien_nom, slug, arrivee, depart, nuits, voyageurs,
                                  montant, devise, montant_mad, taux, nom, prenom, nationalite, residence,
                                  email, telephone, message, locale, moyen, statut, expire_at)
           VALUES (@reference, @bien_id, @bien_nom, @slug, @arrivee, @depart, @nuits, @voyageurs,
                   @montant, @devise, @montant_mad, @taux, @nom, @prenom, @nationalite, @residence,
                   @email, @telephone, @message, @locale, @moyen, @statut, @expire_at)`
        )
        .run({ ...v, reference, statut });
      return unVirement(Number(info.lastInsertRowid))!;
    } catch (e: any) {
      if (!/UNIQUE/i.test(String(e?.message))) throw e;
    }
  }
  throw new Error('référence introuvable');
}

export function unVirement(id: number): Virement | undefined {
  migrerVirements();
  return db().prepare('SELECT * FROM virements WHERE id = ?').get(id) as Virement | undefined;
}

export function virementParReference(reference: string): Virement | undefined {
  migrerVirements();
  return db().prepare('SELECT * FROM virements WHERE reference = ?').get(reference) as Virement | undefined;
}

/**
 * Les demandes, la plus récente d'abord.
 *
 * Au passage, celles dont l'échéance est dépassée sans virement constaté
 * passent d'elles-mêmes en « expirée ». C'est fait ici plutôt que par une
 * tâche de fond : sans serveur qui tourne en continu, un ménage programmé est
 * un ménage qu'on croit fait. Le faire à la lecture garantit qu'il a lieu.
 */
export function virementsRecents(n = 200): Virement[] {
  migrerVirements();
  db()
    .prepare(
      `UPDATE virements SET statut = 'expire'
       WHERE statut = 'attente' AND expire_at <> '' AND expire_at < datetime('now')`
    )
    .run();
  return db().prepare('SELECT * FROM virements ORDER BY id DESC LIMIT ?').all(n) as Virement[];
}

/** Les demandes qui tiennent encore des dates : celles-là bloquent un calendrier. */
export function virementsEnAttente(): Virement[] {
  return virementsRecents(500).filter((v) => v.statut === 'attente');
}

const STATUTS = new Set(['attente', 'recu', 'annule', 'expire']);

export function changerStatutVirement(id: number, statut: string) {
  migrerVirements();
  if (!STATUTS.has(statut)) return;
  db().prepare('UPDATE virements SET statut = ? WHERE id = ?').run(statut, id);
}

/**
 * Combien de courriels ne sont jamais partis, toutes tables confondues.
 *
 * Une demande est écrite en base AVANT tout envoi : elle n'est donc jamais
 * perdue. Mais personne n'est prévenu, et c'est la panne la plus silencieuse
 * qu'un site de réservation puisse avoir - tout paraît marcher. Ce compte
 * existe pour qu'elle cesse d'être silencieuse.
 */
export function courrielsEnAttente(): number {
  migrerVirements();
  const un = (sql: string) => {
    try {
      return (db().prepare(sql).get() as { n: number }).n || 0;
    } catch {
      /* Une table pas encore créée n'est pas une anomalie : elle vaut zéro. */
      return 0;
    }
  };
  return (
    un("SELECT COUNT(*) n FROM virements WHERE courriel_envoye = 0 AND statut <> 'annule'") +
    un('SELECT COUNT(*) n FROM audits WHERE courriel_envoye = 0') +
    un('SELECT COUNT(*) n FROM messages WHERE courriel_envoye = 0')
  );
}

export function marquerVirementEnvoye(id: number) {
  migrerVirements();
  db().prepare('UPDATE virements SET courriel_envoye = 1 WHERE id = ?').run(id);
}

/* ---------- les flux iCal ----------
   Chaque logement publie, chez Airbnb, chez Booking et chez Lodgify, un
   calendrier à une adresse publique. Ce site les télécharge pour son compte -
   c'est ce que fait Staytle, et cela ne demande la permission de personne.

   L'intérêt n'est pas de doubler Lodgify pour le plaisir, mais de pouvoir le
   contredire : un flux Airbnb qui annonce une semaine prise quand Lodgify
   l'annonce libre, c'est la synchronisation qui n'a pas suivi, et c'est
   exactement la panne qui produit une double réservation.

   Ce qui est lu est conservé tel quel, en base, avec l'heure de lecture. Un
   flux injoignable ne doit pas effacer ce qu'on savait de lui : mieux vaut des
   dates d'hier qu'aucune date, puisqu'une réservation ne s'efface pas parce
   qu'un serveur a eu une mauvaise minute. */

function migrerFlux() {
  db().exec(
    `CREATE TABLE IF NOT EXISTS flux (
       id            INTEGER PRIMARY KEY AUTOINCREMENT,
       bien_id       INTEGER NOT NULL,
       source        TEXT NOT NULL DEFAULT 'autre',
       url           TEXT NOT NULL,
       actif         INTEGER NOT NULL DEFAULT 1,
       dernier_essai TEXT NOT NULL DEFAULT '',
       dernier_ok    TEXT NOT NULL DEFAULT '',
       erreur        TEXT NOT NULL DEFAULT '',
       periodes      TEXT NOT NULL DEFAULT '[]',
       nb            INTEGER NOT NULL DEFAULT 0,
       created_at    TEXT NOT NULL DEFAULT (datetime('now')),
       UNIQUE (bien_id, url)
     )`
  );
}

export type LigneFlux = {
  id: number;
  bien_id: number;
  source: string;
  url: string;
  actif: number;
  dernier_essai: string;
  dernier_ok: string;
  erreur: string;
  periodes: string;
  nb: number;
  created_at: string;
};

export function fluxTous(): LigneFlux[] {
  migrerFlux();
  return db().prepare('SELECT * FROM flux ORDER BY bien_id, source, id').all() as LigneFlux[];
}

export function fluxActifs(): LigneFlux[] {
  return fluxTous().filter((f) => f.actif);
}

/**
 * Remplace la liste des flux d'un logement.
 *
 * Les adresses inchangées gardent leur identifiant, et donc tout ce qu'on
 * avait déjà lu d'elles. Récrire la table entière à chaque enregistrement
 * jetterait des périodes valables pour la seule raison qu'on a corrigé une
 * faute de frappe sur une autre ligne.
 */
export function ecrireFluxDeBien(bienId: number, entrees: { url: string; source: string }[]) {
  if (!bienId) return;
  migrerFlux();
  const voulues = new Set(entrees.map((e) => e.url));
  const existants = db().prepare('SELECT id, url FROM flux WHERE bien_id = ?').all(bienId) as { id: number; url: string }[];

  const sup = db().prepare('DELETE FROM flux WHERE id = ?');
  const ins = db().prepare('INSERT OR IGNORE INTO flux (bien_id, source, url) VALUES (?, ?, ?)');
  const maj = db().prepare('UPDATE flux SET source = ? WHERE bien_id = ? AND url = ?');

  db().transaction(() => {
    for (const e of existants) if (!voulues.has(e.url)) sup.run(e.id);
    for (const e of entrees) {
      ins.run(bienId, e.source, e.url);
      maj.run(e.source, bienId, e.url);
    }
  })();
}

export function majFlux(
  id: number,
  v: { ok: boolean; erreur: string; periodes?: string; nb?: number }
) {
  migrerFlux();
  if (v.ok) {
    db()
      .prepare(
        `UPDATE flux SET dernier_essai = datetime('now'), dernier_ok = datetime('now'),
         erreur = '', periodes = ?, nb = ? WHERE id = ?`
      )
      .run(v.periodes ?? '[]', v.nb ?? 0, id);
    return;
  }
  /* En cas d'échec, on note l'erreur et l'heure de l'essai - mais on ne touche
     ni aux périodes ni à la date de dernière réussite. Ce qu'on savait hier
     reste vrai aujourd'hui : une réservation ne s'annule pas parce qu'un
     serveur n'a pas répondu. */
  db()
    .prepare(`UPDATE flux SET dernier_essai = datetime('now'), erreur = ? WHERE id = ?`)
    .run(String(v.erreur || 'erreur inconnue').slice(0, 300), id);
}
