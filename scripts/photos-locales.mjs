/**
 * Les photographies, prises à leur source.
 *
 * La première tentative allait les chercher sur le moteur Lodgify. Cloudflare
 * y monte la garde et renvoie un contrôle anti-robot : cette porte est fermée,
 * et elle n'est pas à nous de l'ouvrir.
 *
 * Or il existe une meilleure source, et elle était là depuis le début : vos
 * propres photographies, un dossier par logement, dont plusieurs séries
 * professionnelles que Lodgify ne sert qu'en version réduite. Ce script les
 * lit, les redimensionne, et les dépose dans le site.
 *
 * Elles y gagnent trois choses. La qualité, d'abord - un fichier HDR de deux
 * mégaoctets vaut mieux qu'une vignette recompressée. L'indépendance, ensuite :
 * le jour où IB Signature changera de moteur de réservation, le site gardera
 * ses images. La vitesse, enfin, puisqu'elles sont servies depuis votre propre
 * domaine et non depuis le serveur d'images d'un tiers.
 *
 * Un dossier « Galerie site web » sous un appartement fait autorité : s'il
 * existe, lui seul est lu, et rien n'y est ajouté. C'est votre choix, pas une
 * suggestion à compléter. Numérotez les fichiers 01, 02, 03 et cet ordre sera
 * respecté à la lettre - la première image devient la couverture. Sans
 * numérotation, le classement par pièce ci-dessous prend le relais.
 *
 * Le rapprochement entre un logement et son dossier ne repose pas sur une
 * astuce : les noms diffèrent trop - « The Fifteen Triangle d'Or » chez
 * Lodgify, « The 15 Vertu Triangle d'Or » sur le disque - et une astuce qui
 * marche vingt fois sur vingt-quatre se trompe quatre fois en silence. La
 * table ci-dessous est donc écrite à la main, une ligne par logement. Ce qui
 * n'y figure pas n'est pas deviné, il est signalé.
 *
 *   npm run photos-locales              copie et enregistre
 *   npm run photos-locales -- --essai   montre ce qui serait fait, sans rien faire
 *   npm run photos-locales -- --forcer  écrase aussi les galeries retouchées
 *
 * Une galerie que vous avez retouchée dans l'administration n'est pas écrasée.
 * L'import range correctement, vous rangez justement, et la seconde l'emporte :
 * un outil qui défait le travail de son utilisateur n'est pas un outil.
 */

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import sharp from 'sharp';

const ESSAI = process.argv.includes('--essai');
const FORCER = process.argv.includes('--forcer');
const RACINE = process.cwd();

/* Combien de photographies par logement. Au-delà d'une vingtaine, un visiteur
   ne regarde plus, il fait défiler - et chaque image supplémentaire pèse sur
   le dépôt et sur le temps de chargement. */
const MAX_PHOTOS = 30;
/* 1400 points de large suffisent à un plein écran d'ordinateur portable. */
const LARGEUR = 1400;
const QUALITE = 78;

function chargerEnv() {
  for (const nom of ['.env.local', '.env']) {
    const f = path.join(RACINE, nom);
    if (!fs.existsSync(f)) continue;
    for (const ligne of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
chargerEnv();

const CLEF = process.env.LODGIFY_API_KEY || '';
const argSource = process.argv.find((a) => a.startsWith('--source='));
const SOURCE =
  (argSource && argSource.slice(9)) ||
  process.env.PHOTOS_SOURCE ||
  String.raw`C:\Users\Ali B\Documents\Airbnb\Appartements`;

/* ---------- la table ----------
   À gauche le nom exact du logement chez Lodgify, à droite le nom exact du
   dossier sur le disque. Quand un logement changera de nom chez Lodgify, cette
   ligne sera la seule à corriger. */
const DOSSIERS = {
  'The 26 Palmier': 'The Twenty-Six Palmier',
  'The 51 Hermitage': 'The 51 Hermitage',
  "Number Nine Triangle d'Or": "Number Nine Triangle d'or",
  'Gardenia CFC': 'Gardenia CFC',
  "Number Six Triangle d'Or": "Number Six Triangle d'Or",
  'The 23 Princesses': 'The 23 Princesses',
  'The 53 Gauthier': 'The 53 Gauthier',
  'One-Five Racine': 'One Five Racine',
  'The 31 Grand Theatre': 'The 31 Grand Theatre',
  'Number 06 Bourgogne': 'Number 6 Bourgogne',
  'Villa Dar Bassidi': 'Villa Dar Bassidi',
  'Summer house with swimming pool, sea and golf course': 'Bahia Golf Beach',
  'The 41 Maarif': 'The 41 Maarif',
  'The 501 Racine': 'The 501 Racine',
  "Number Twelve Triangle d'or": "Number Twelve Triangle d'Or",
  "The 28 Triangle d'Or": "The 28 Vertu Triangle d'Or",
  'Holiday home with sea and pool views in Tamaris': 'Tamaris 1',
  "The Fifteen Triangle d'Or": "The 15 Vertu Triangle d'Or",
  'The Nineteen Racine': 'The 19 Racine',
  'C202 Alcazar': 'C202 Alcazar',
  'The Twenty-four CIL': 'The 24 CIL',
  "The Sixteen Triangle d’Or": "The 16 Vertu Triangle d'or",
  'Number One Racine • 2BR • Terrace + parking': 'Number One Racine',
  'The 37 Gauthier - Large 1BR flat - wifi & parking': 'The 37 Gauthier',
};

/* Les sous-dossiers ne portent pas tous le même nom - « Photos Pros » ici,
   « Photos Asma - HR » là, « New » ailleurs, et parfois deux niveaux de
   profondeur. Une liste fermée de noms attendus laissait deux logements sans
   galerie alors que leurs photographies étaient bien là. On explore donc, et
   on classe : ce qui est annoncé comme professionnel ou haute résolution
   d'abord, le récent ensuite, l'ordinaire après, et ce qui est rangé comme
   ancien en dernier. */
/* Le dossier que vous composez vous-même. S'il existe, il fait loi : le
   classement automatique ci-dessous n'est qu'un pis-aller pour les logements
   dont personne n'a encore choisi les images. */
const CHOISI = /galerie\s*(du\s*)?site\s*web/i;

function rangDossier(nom) {
  const n = nom.toLowerCase();
  if (CHOISI.test(n)) return -1;
  if (/(^|[^a-z])(old|ancien|ancienne|archive|avant)([^a-z]|$)/.test(n)) return 9;
  if (/(^|[^a-z])(pros?|hr|hd|haute)([^a-z]|$)/.test(n)) return 0;
  if (/(^|[^a-z])(new|nouvelles?|recentes?|récentes?)([^a-z]|$)/.test(n)) return 1;
  if (n.includes('photo')) return 2;
  return 3;
}

/* Et à l'intérieur d'un dossier, l'ordre des pièces. Une fiche s'ouvre sur un
   séjour, pas sur une salle de bain : l'ordre alphabétique mettait « Bedroom »
   et « Cuisine » avant « LivingRoom », ce qu'aucun photographe ne ferait. */
function rangPiece(nom) {
  const n = nom.toLowerCase();
  if (/^couv|^cover/.test(n)) return 0;
  if (/living|salon|sejour|séjour|salle a manger|salle à manger|hall|entree|entrée/.test(n)) return 1;
  if (/terra|piscine|pool|vue|golf|plage|beach/.test(n)) return 2;
  if (/cuisine|kitchen/.test(n)) return 3;
  if (/master/.test(n)) return 4;
  if (/bedroom|chambre/.test(n)) return 5;
  if (/sdb|bath|douche|toilet|wc/.test(n)) return 7;
  return 6;
}

/* Le HEIC des iPhone est accepté : la bibliothèque d'images sait souvent le
   lire, et quand elle échoue le fichier est signalé plutôt qu'ignoré en
   silence - vous saurez lequel convertir. */
const IMAGE = /\.(jpe?g|png|webp|heic|heif)$/i;

/* Les noms voyagent mal : apostrophe droite ou typographique, espace simple ou
   insécable, majuscules changeantes. La table reste la référence, mais on la
   consulte à travers cette normalisation - sinon une apostrophe recopiée d'une
   façon plutôt que d'une autre ferait échouer un rapprochement pourtant écrit
   noir sur blanc. */
const cle = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const TABLE = new Map(Object.entries(DOSSIERS).map(([nom, dossier]) => [cle(nom), dossier]));

/** Le dossier d'un logement : par la table, puis par le nom réel sur le disque. */
function dossierDe(nom, surDisque) {
  const vise = TABLE.get(cle(nom));
  if (!vise) return null;
  if (surDisque.includes(vise)) return vise;
  return surDisque.find((d) => cle(d) === cle(vise)) || null;
}

/** Le slug, calculé exactement comme le site le calcule. */
const identifiant = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function catalogue() {
  if (!CLEF) throw new Error('LODGIFY_API_KEY absente : renseignez-la dans .env.local.');
  const r = await fetch('https://api.lodgify.com/v2/properties?includeCount=false&size=100', {
    headers: { 'X-ApiKey': CLEF, accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`Lodgify a répondu ${r.status} sur /v2/properties.`);
  const corps = await r.json();
  const liste = Array.isArray(corps) ? corps : corps.items || [];
  return liste.map((p) => ({ id: Number(p.id), nom: String(p.name || '') }));
}

/** Les dossiers d'images sous un logement, jusqu'à deux niveaux de profondeur. */
function dossiersImages(base, profondeur = 0) {
  let sorties = [];
  let entrees;
  try {
    entrees = fs.readdirSync(base, { withFileTypes: true });
  } catch {
    return sorties;
  }
  if (entrees.some((d) => d.isFile() && IMAGE.test(d.name))) sorties.push(base);
  if (profondeur < 2) {
    for (const d of entrees) if (d.isDirectory()) sorties = sorties.concat(dossiersImages(path.join(base, d.name), profondeur + 1));
  }
  return sorties;
}

/** Les fichiers d'un logement, dans l'ordre où ils méritent d'être vus. */
function fichiersDe(dossier) {
  const base = path.join(SOURCE, dossier);
  if (!fs.existsSync(base)) return null;

  let dossiers = dossiersImages(base).sort((a, b) => {
    const ra = a === base ? 4 : rangDossier(path.basename(a));
    const rb = b === base ? 4 : rangDossier(path.basename(b));
    return ra - rb || a.localeCompare(b, 'fr');
  });

  /* Si vous avez composé une galerie, on s'y tient : on ne va pas compléter
     avec des photographies que vous avez précisément écartées en ne les y
     mettant pas. Un dossier choisi est un choix, pas une suggestion. */
  const choisis = dossiers.filter((d) => d !== base && CHOISI.test(path.basename(d)));
  if (choisis.length) dossiers = choisis;

  const retenus = [];
  const vus = new Set();
  for (const rep of dossiers) {
    let entrees;
    try {
      entrees = fs.readdirSync(rep, { withFileTypes: true });
    } catch {
      continue;
    }
    const images = entrees.filter((d) => d.isFile() && IMAGE.test(d.name)).map((d) => d.name);
    /* Deux ordres possibles, et c'est le vôtre qui gagne quand il existe. Si la
       plupart des fichiers commencent par un nombre, vous les avez numérotés :
       on suit cette numérotation à la lettre, sans rien réarranger. Sinon on
       range par pièce, faute de mieux. */
    const numerotes = images.filter((n) => /^\d/.test(n)).length;
    if (numerotes >= Math.max(2, images.length * 0.6))
      images.sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
    else images.sort((a, b) => rangPiece(a) - rangPiece(b) || a.localeCompare(b, 'fr', { numeric: true }));
    for (const n of images) {
      /* Deux dossiers portent souvent la même photo sous le même nom. On ne la
         compte qu'une fois. */
      if (vus.has(n.toLowerCase())) continue;
      vus.add(n.toLowerCase());
      retenus.push(path.join(rep, n));
      if (retenus.length >= MAX_PHOTOS) return couvertureDevant(retenus);
    }
  }
  return couvertureDevant(retenus);
}

/* Un fichier que vous avez nommé « Couv » est la couverture que vous avez
   choisie. Elle ouvre la fiche, même si elle dort dans le second dossier.
   Mais si vous avez numéroté vos images, la première est déjà celle que vous
   vouliez en tête : on ne la déplace pas. */
function couvertureDevant(liste) {
  if (liste.length && /^\d/.test(path.basename(liste[0]))) return liste;
  const i = liste.findIndex((f) => /^couv|^cover/i.test(path.basename(f)));
  if (i <= 0) return liste;
  return [liste[i], ...liste.slice(0, i), ...liste.slice(i + 1)];
}

const journal = [];
const dire = (s) => {
  journal.push(s);
  console.log(s);
};

async function main() {
  if (!fs.existsSync(SOURCE)) throw new Error(`Dossier introuvable : ${SOURCE}`);
  const biens = await catalogue();
  dire(`${biens.length} logement(s) au catalogue, source : ${SOURCE}`);
  dire('');

  /* Les galeries retouchées à la main, qu'on ne touche pas. La table peut ne
     pas exister encore : un premier import a lieu avant toute retouche. */
  const verrouilles = new Set();
  if (!FORCER) {
    const f = process.env.DATABASE_PATH || path.join(RACINE, 'data', 'ibsignature.db');
    if (fs.existsSync(f)) {
      try {
        const b = new Database(f, { readonly: true });
        for (const l of b.prepare('SELECT bien_id FROM liens WHERE photos_verrou = 1').all()) verrouilles.add(l.bien_id);
        b.close();
      } catch {
        /* ni table ni colonne : rien n'a encore été retouché */
      }
    }
  }

  const resultats = [];
  const sans = [];
  const gardes = [];

  const surDisque = fs
    .readdirSync(SOURCE, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const b of biens) {
    if (verrouilles.has(b.id)) {
      gardes.push(`${b.nom} (${b.id})`);
      continue;
    }
    const dossier = dossierDe(b.nom, surDisque);
    if (!dossier) {
      sans.push(`${b.nom} (${b.id}) — ${TABLE.has(cle(b.nom)) ? 'dossier absent du disque' : 'aucune ligne dans la table'}`);
      continue;
    }
    const fichiers = fichiersDe(dossier);
    if (fichiers === null) {
      sans.push(`${b.nom} (${b.id}) — dossier « ${dossier} » introuvable`);
      continue;
    }
    if (!fichiers.length) {
      sans.push(`${b.nom} (${b.id}) — dossier « ${dossier} » sans photographie`);
      continue;
    }
    resultats.push({ bien: b, slug: identifiant(b.nom), dossier, fichiers });
  }

  for (const r of resultats) dire(`${r.bien.nom} → ${r.dossier} · ${r.fichiers.length} photo(s)`);
  if (sans.length) {
    dire('');
    for (const s of sans) dire(`Sans galerie : ${s}`);
  }
  if (gardes.length) {
    dire('');
    for (const g of gardes) dire(`Retouché à la main, laissé tel quel : ${g}`);
    dire('Pour les écraser malgré tout : npm run photos-locales -- --forcer');
  }

  if (ESSAI) {
    dire('');
    dire(`Essai : rien n’a été écrit. ${resultats.length} logement(s) prêts.`);
    return;
  }

  /* La conversion. Une image à la fois : traiter vingt-quatre logements en
     parallèle saturerait la mémoire pour ne rien gagner, le disque étant le
     goulot. */
  dire('');
  const sortieBase = path.join(RACINE, 'public', 'photos');
  const enBase = [];

  for (const r of resultats) {
    const sortie = path.join(sortieBase, r.slug);
    fs.rmSync(sortie, { recursive: true, force: true });
    fs.mkdirSync(sortie, { recursive: true });

    const adresses = [];
    let n = 0;
    for (const f of r.fichiers) {
      n += 1;
      const nom = `${String(n).padStart(2, '0')}.jpg`;
      try {
        await sharp(f)
          .rotate() /* respecte l'orientation EXIF : sans cela, des photos arrivent couchées */
          .resize({ width: LARGEUR, withoutEnlargement: true })
          .jpeg({ quality: QUALITE, progressive: true, mozjpeg: true })
          .toFile(path.join(sortie, nom));
        adresses.push(`/photos/${r.slug}/${nom}`);
      } catch (e) {
        n -= 1;
        dire(`  ${path.basename(f)} ignorée (${e.message})`);
      }
    }
    enBase.push({ id: r.bien.id, adresses });
    dire(`${r.bien.nom} → ${adresses.length} photo(s) dans public/photos/${r.slug}/`);
  }

  /* ---------- le report vers la production ----------
     Les fichiers d'images sont versionnés avec le code et suivent donc le
     déploiement. La liste qui les rattache à chaque logement, elle, vit en
     base - et la base de production est vide au premier jour. Sans ce
     fichier, le site en ligne s'afficherait sans photographies alors que les
     images y seraient bel et bien.

     On écrit donc aussi un JSON versionné, que le site lit pour tout logement
     dont la base ne dit rien. La base garde le dernier mot : ce que vous
     rangez dans l'administration passe toujours devant ce fichier. */
  const carte = Object.fromEntries(enBase.filter((e) => e.adresses.length).map((e) => [e.id, e.adresses]));
  const versionne = path.join(RACINE, 'data', 'galeries.json');
  /* Les logements absents de cet import gardent ce qu'ils avaient : un import
     partiel - un seul logement relancé - ne doit pas effacer les vingt-trois
     autres. */
  let ancien = {};
  try {
    ancien = JSON.parse(fs.readFileSync(versionne, 'utf8'));
  } catch {
    /* premier import, ou fichier illisible : on repart de rien */
  }
  fs.writeFileSync(versionne, `${JSON.stringify({ ...ancien, ...carte }, null, 2)}\n`, 'utf8');
  dire(`data/galeries.json mis à jour : ${Object.keys({ ...ancien, ...carte }).length} logement(s).`);

  const fichier = process.env.DATABASE_PATH || path.join(RACINE, 'data', 'ibsignature.db');
  fs.mkdirSync(path.dirname(fichier), { recursive: true });
  const base = new Database(fichier);
  base.pragma('journal_mode = WAL');
  base.exec(
    `CREATE TABLE IF NOT EXISTS liens (
       bien_id INTEGER PRIMARY KEY, url TEXT NOT NULL DEFAULT '',
       photos TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT (datetime('now')))`
  );
  try {
    base.exec("ALTER TABLE liens ADD COLUMN photos TEXT NOT NULL DEFAULT ''");
  } catch {
    /* colonne déjà présente */
  }
  const ecrire = base.prepare(
    `INSERT INTO liens (bien_id, photos, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(bien_id) DO UPDATE SET photos = excluded.photos, updated_at = datetime('now')`
  );
  base.transaction(() => {
    for (const e of enBase) ecrire.run(e.id, e.adresses.join('\n'));
  })();
  base.close();

  const total = enBase.reduce((s, e) => s + e.adresses.length, 0);
  const poids = enBase.reduce((s, e) => {
    for (const a of e.adresses) {
      try {
        s += fs.statSync(path.join(RACINE, 'public', a.replace('/photos/', 'photos/'))).size;
      } catch {
        /* fichier absent, on n'en tient pas compte */
      }
    }
    return s;
  }, 0);

  dire('');
  dire(`${enBase.length} logement(s), ${total} photographie(s), ${(poids / 1048576).toFixed(1)} Mo au total.`);
  dire('Elles sont visibles immédiatement sur le site, et modifiables dans l’administration.');
}

main().catch((e) => {
  console.error(`\nL'import s'est arrêté : ${e.message}`);
  process.exitCode = 1;
});
