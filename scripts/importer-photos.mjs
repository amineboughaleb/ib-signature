/**
 * L'import des photographies et des adresses de réservation.
 *
 * L'API de Lodgify ne rend qu'une seule image par logement : la couverture.
 * Six points d'entrée ont été essayés pour obtenir les galeries, aucun n'a
 * répondu. Coller vingt adresses à la main pour vingt-quatre logements n'est
 * pas une solution, c'est une corvée déguisée en solution.
 *
 * Or ces photographies sont déjà publiées, au complet, sur votre propre moteur
 * de réservation. Ce script va donc les y chercher, comme le ferait un
 * visiteur : il ouvre chaque fiche dans un navigateur sans écran, déplie la
 * galerie, relève les adresses des images, et les écrit en base. Il en profite
 * pour relever l'adresse exacte de chaque fiche, ce qui remplit du même geste
 * l'autre champ que vous auriez eu à saisir.
 *
 * Un navigateur est nécessaire : la page de votre moteur est construite par du
 * JavaScript, un simple téléchargement du HTML ne montre rien.
 *
 * Rien n'est inventé ici. Si une fiche ne peut être rattachée avec certitude à
 * un logement de votre catalogue, elle est signalée et ignorée : mieux vaut un
 * logement sans galerie qu'un logement affichant les photos du voisin.
 *
 *   npm run photos              importe tout
 *   npm run photos -- --essai   montre ce qui serait écrit, sans rien écrire
 */

import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { chromium } from 'playwright';

const ESSAI = process.argv.includes('--essai');
const SONDE = process.argv.includes('--sonde');
const RACINE = process.cwd();

/* ---------- la clef, lue là où Next la lit ---------- */

function chargerEnv() {
  for (const nom of ['.env.local', '.env']) {
    const f = path.join(RACINE, nom);
    if (!fs.existsSync(f)) continue;
    for (const ligne of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const valeur = m[2].replace(/^["']|["']$/g, '');
      if (!process.env[m[1]]) process.env[m[1]] = valeur;
    }
  }
}
chargerEnv();

const CLEF = process.env.LODGIFY_API_KEY || '';
const MOTEUR = (process.env.LODGIFY_SITE || 'https://ibsignature.lodgify.com').replace(/\/$/, '');

/* ---------- le catalogue, côté API ---------- */

async function catalogue() {
  if (!CLEF) throw new Error('LODGIFY_API_KEY absente : renseignez-la dans .env.local.');
  const r = await fetch('https://api.lodgify.com/v2/properties?includeCount=false&size=100', {
    headers: { 'X-ApiKey': CLEF, accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`Lodgify a répondu ${r.status} sur /v2/properties.`);
  const corps = await r.json();
  const liste = Array.isArray(corps) ? corps : corps.items || [];
  return liste.map((p) => ({
    id: Number(p.id),
    nom: String(p.name || ''),
    couverture: String(p.image_url || ''),
  }));
}

/* ---------- rapprochements ---------- */

/** Deux adresses d'image sont la même si leur chemin l'est : seule la largeur change. */
const empreinte = (u) => {
  try {
    const a = new URL(u, MOTEUR);
    return `${a.host}${a.pathname}`.toLowerCase();
  } catch {
    return u.toLowerCase();
  }
};

/** « Number Six - Triangle d'Or » et « number-six-triangle-d-or » se ressemblent enfin. */
const aplati = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/* ---------- la moisson ---------- */

/* Les pages du moteur qui ne sont pas des logements. On compare le chemin
   entier, pas un morceau : la premiere version excluait tout chemin
   *contenant* « toutes-les-proprietes », ce qui condamnait les fiches elles-
   memes, puisqu'elles vivent sous cette adresse. Un filtre trop large ne
   protege de rien, il efface. */
const PAGES = [
  'toutes-les-proprietes', 'all-properties', 'qui-sommes-nous', 'contactez-nous',
  'about', 'about-us', 'contact', 'contact-us', 'cookie', 'cookies', 'terms',
  'privacy', 'conditions', 'blog', 'faq',
];

async function liensDesFiches(page) {
  await page.goto(`${MOTEUR}/fr/toutes-les-proprietes/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  /* La liste se peuple au fil du défilement : on descend jusqu'à ce que le
     nombre de liens cesse d'augmenter, plutôt que d'attendre un délai fixe. */
  let precedent = -1;
  for (let tour = 0; tour < 12 && precedent !== (await compter(page)); tour++) {
    precedent = await compter(page);
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(1200);
  }
  const host = new URL(MOTEUR).host;

  const tout = await page.evaluate(
    ([h, pages]) => {
      const vus = new Map();
      for (const a of document.querySelectorAll('a[href]')) {
        let u;
        try {
          u = new URL(a.href);
        } catch {
          continue;
        }
        if (u.host !== h) continue;
        const morceaux = u.pathname.split('/').filter(Boolean);
        if (!morceaux.length) continue;
        /* Le premier segment est parfois la langue. On l'ecarte pour juger du
           reste, sans exiger qu'il soit la : tous les moteurs ne prefixent
           pas. */
        const utiles = /^[a-z]{2}$/i.test(morceaux[0]) ? morceaux.slice(1) : morceaux;
        if (!utiles.length) continue;
        /* Une page connue est une page connue quand elle EST ce chemin, pas
           quand elle le contient. Une fiche sous /toutes-les-proprietes/x
           reste une fiche. */
        if (utiles.length === 1 && pages.includes(utiles[0].toLowerCase())) continue;
        vus.set(`${u.origin}${u.pathname}`, (a.textContent || '').trim().slice(0, 60));
      }
      return [...vus].map(([url, texte]) => ({ url, texte }));
    },
    [host, PAGES]
  );

  return tout;
}

const compter = (page) => page.evaluate(() => document.querySelectorAll('a[href]').length);

/** Ouvre la galerie si un bouton la propose, puis relève toutes les images. */
async function photosDe(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);

  /* Beaucoup de moteurs ne chargent la galerie complète qu'au clic. On essaie
     quelques ouvertures plausibles, sans s'arrêter si aucune n'existe. */
  const ouvertures = [
    'button:has-text("photo")',
    'button:has-text("Photos")',
    '[class*="gallery"] button',
    '[class*="galerie"] button',
    '[data-testid*="gallery"]',
  ];
  for (const s of ouvertures) {
    try {
      const b = page.locator(s).first();
      if (await b.isVisible({ timeout: 800 })) {
        await b.click({ timeout: 2000 });
        await page.waitForTimeout(1500);
        break;
      }
    } catch {
      /* ce bouton n'existe pas sur cette page, on passe au suivant */
    }
  }

  /* Puis on descend : le reste des vignettes est en chargement paresseux. */
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 2500);
    await page.waitForTimeout(500);
  }

  return page.evaluate(() => {
    const sorties = [];
    const garder = (u) => {
      if (!u || !/^https?:/i.test(u)) return;
      if (!/icdbcdn|lodgify/i.test(u)) return;
      if (/\.svg(\?|$)/i.test(u)) return;
      sorties.push(u);
    };
    for (const img of document.querySelectorAll('img')) {
      garder(img.currentSrc || img.src);
      /* Le srcset porte parfois la version pleine résolution que src n'a pas. */
      for (const part of (img.getAttribute('srcset') || '').split(',')) garder(part.trim().split(/\s+/)[0]);
    }
    for (const el of document.querySelectorAll('[style*="background-image"]')) {
      const m = /url\(["']?([^"')]+)/i.exec(el.getAttribute('style') || '');
      if (m) garder(m[1]);
    }
    return { titre: (document.querySelector('h1')?.textContent || '').trim(), images: sorties };
  });
}

/* ---------- le déroulé ---------- */

const journal = [];
const dire = (s) => {
  journal.push(s);
  console.log(s);
};

async function main() {
  const biens = await catalogue();
  dire(`${biens.length} logement(s) au catalogue Lodgify.`);

  /* Sur mon poste, le navigateur est à un endroit précis ; sur le vôtre, c'est
     Playwright qui sait où il a rangé le sien. On ne force le chemin que s'il
     existe, faute de quoi le script ne démarrerait que chez moi. */
  const chemin = '/opt/pw-browsers/chromium';
  const nav = await chromium.launch(fs.existsSync(chemin) ? { executablePath: chemin } : {});
  const contexte = await nav.newContext({ viewport: { width: 1400, height: 1000 } });
  const page = await contexte.newPage();

  let trouves = [];
  try {
    trouves = await liensDesFiches(page);
  } catch (e) {
    dire(`La page « toutes les propriétés » n'a pas pu être lue : ${e.message}`);
  }
  dire(`${trouves.length} fiche(s) repérée(s) sur ${MOTEUR}.`);

  /* Quand la moisson est vide, la question n'est plus « combien » mais « à
     quoi ressemble cette page ». On la décrit plutôt que d'en deviner la
     structure depuis l'autre bout du monde. */
  if (SONDE || trouves.length === 0) {
    const vue = await page.evaluate(() => ({
      titre: document.title,
      liens: [...document.querySelectorAll('a[href]')].length,
      images: [...document.querySelectorAll('img')].length,
      echantillon: [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))].slice(0, 60),
      texte: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
    }));
    dire('');
    dire('--- ce que la page montre ---');
    dire(`titre : ${vue.titre}`);
    dire(`${vue.liens} lien(s), ${vue.images} image(s)`);
    dire(`texte : ${vue.texte}`);
    dire('adresses présentes :');
    for (const h of vue.echantillon) dire(`  ${h}`);
    dire('--- fin ---');
    dire('');
  }

  const fiches = trouves.map((t) => t.url);

  /* On moissonne d'abord tout, on décide ensuite : une image présente sur
     plusieurs fiches est un élément d'habillage - un logo, une bannière - et
     non la photographie d'un logement. */
  const moissons = [];
  for (const url of fiches) {
    try {
      const r = await photosDe(page, url);
      moissons.push({ url, ...r });
      dire(`  ${url} → ${r.images.length} image(s) brute(s)${r.titre ? ` · ${r.titre}` : ''}`);
    } catch (e) {
      dire(`  ${url} → illisible (${e.message})`);
    }
  }

  const frequence = new Map();
  for (const m of moissons) for (const e of new Set(m.images.map(empreinte))) frequence.set(e, (frequence.get(e) || 0) + 1);
  const habillage = new Set([...frequence].filter(([, n]) => n >= 3).map(([e]) => e));

  /* Rapprochement. La couverture connue de l'API est la preuve la plus sûre :
     si elle est sur la page, la page est celle de ce logement. Le nom ne sert
     qu'en second recours. */
  const parCouverture = new Map(biens.filter((b) => b.couverture).map((b) => [empreinte(b.couverture), b]));
  const resultats = [];
  const orphelines = [];

  for (const m of moissons) {
    const vues = [...new Set(m.images.map((u) => (u.startsWith('//') ? `https:${u}` : u)))];
    const propres = vues.filter((u) => !habillage.has(empreinte(u)));
    let bien = null;
    for (const u of vues) {
      const trouve = parCouverture.get(empreinte(u));
      if (trouve) {
        bien = trouve;
        break;
      }
    }
    if (!bien) {
      const cle = aplati(m.titre) || aplati(m.url.split('/').pop());
      bien = biens.find((b) => cle && (aplati(b.nom).includes(cle) || cle.includes(aplati(b.nom)))) || null;
    }
    if (!bien) {
      orphelines.push(m);
      continue;
    }
    if (resultats.some((r) => r.bien.id === bien.id)) continue;
    resultats.push({ bien, url: m.url, photos: propres });
  }

  await nav.close();

  dire('');
  for (const r of resultats) dire(`${r.bien.nom} (${r.bien.id}) → ${r.photos.length} photo(s)`);
  for (const o of orphelines) dire(`Fiche non rattachée : ${o.url}${o.titre ? ` (${o.titre})` : ''}`);
  const manquants = biens.filter((b) => !resultats.some((r) => r.bien.id === b.id));
  for (const b of manquants) dire(`Sans fiche trouvée : ${b.nom} (${b.id})`);

  if (ESSAI) {
    dire('\nEssai : rien n’a été écrit.');
    return;
  }

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
    `INSERT INTO liens (bien_id, url, photos, updated_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(bien_id) DO UPDATE SET url = excluded.url, photos = excluded.photos, updated_at = datetime('now')`
  );
  base.transaction(() => {
    for (const r of resultats) ecrire.run(r.bien.id, r.url, r.photos.slice(0, 40).join('\n'));
  })();
  base.close();

  const total = resultats.reduce((n, r) => n + r.photos.length, 0);
  dire(`\n${resultats.length} logement(s) mis à jour, ${total} photographie(s) enregistrée(s).`);
  dire('Elles sont visibles immédiatement sur le site, et modifiables dans l’administration.');
}

main().catch((e) => {
  console.error(`\nL'import s'est arrêté : ${e.message}`);
  process.exitCode = 1;
});
