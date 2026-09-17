/**
 * Figer l'adresse de chaque logement, une fois pour toutes.
 *
 * Le défaut qu'il répare est de ceux qui ne font aucun bruit. L'adresse d'une
 * fiche - `/fr/logements/le-501-racine` - est fabriquée à partir du nom que
 * Lodgify donne au logement. Tant que ce nom ne bouge pas, tout va bien. Le
 * jour où Lodgify le traduit tout seul, « The 501 Racine » devient « Le 501
 * Racine », l'adresse suit, et l'ancienne meurt : pas d'erreur dans les
 * journaux, pas d'alerte, rien. On l'apprend en lisant Search Console des
 * semaines plus tard, quand les liens déjà diffusés mènent depuis longtemps à
 * une page introuvable.
 *
 * Le code prévoit déjà l'antidote : dans `data/enrichissement.json`, chaque
 * logement peut porter un champ `slug` qui l'emporte sur le nom. Il n'était
 * simplement renseigné pour aucun. Ce script le renseigne pour tous.
 *
 * Une fois cela fait, Lodgify peut renommer, traduire, mettre en majuscules :
 * l'adresse ne bougera plus, parce qu'elle ne sera plus déduite de rien.
 *
 * ---------------------------------------------------------------------------
 *
 * À LANCER CHEZ VOUS, depuis le dossier du site :
 *
 *     node scripts/figer-slugs.mjs            (montre ce qu'il ferait)
 *     node scripts/figer-slugs.mjs --ecrire   (écrit le fichier)
 *
 * La clef d'API est lue dans `.env.local` et ne sort pas de votre machine.
 *
 * Le premier passage n'écrit rien : il imprime la correspondance et vous laisse
 * la lire. C'est volontaire - ce fichier décide des adresses publiques du site,
 * et un script qui modifie d'abord et montre ensuite n'est pas un outil, c'est
 * un pari.
 */

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';

const BASE = 'https://api.lodgify.com';
const FICHIER = 'data/enrichissement.json';
const ECRIRE = process.argv.includes('--ecrire');

/** La même fabrication d'adresse que le site, à la lettre près. */
const identifiant = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * La clef, lue dans `.env.local`.
 *
 * Sans dépendance : une ligne `CLEF=valeur`, les commentaires et les guillemets
 * écartés. Importer un chargeur d'environnement pour trois lignes ajouterait
 * une dépendance à un script qu'on lance deux fois dans sa vie.
 */
function clef() {
  if (process.env.LODGIFY_API_KEY) return process.env.LODGIFY_API_KEY.trim();
  if (!existsSync('.env.local')) return '';
  for (const ligne of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*LODGIFY_API_KEY\s*=\s*(.*)$/.exec(ligne);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return '';
}

async function main() {
  const k = clef();
  if (!k) {
    console.error('Clef absente. Attendue dans .env.local sous LODGIFY_API_KEY.');
    process.exit(1);
  }

  const res = await fetch(`${BASE}/v2/properties?includeCount=false&size=100`, {
    headers: { 'X-ApiKey': k, Accept: 'application/json' },
  });
  if (!res.ok) {
    console.error(`Lodgify a répondu ${res.status}. Rien n'a été écrit.`);
    process.exit(1);
  }

  const data = await res.json();
  const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  const logements = items
    .filter((p) => p && p.id && String(p.name || '').trim())
    .map((p) => ({ id: String(p.id), nom: String(p.name).trim() }));

  if (!logements.length) {
    console.error('Aucun logement rendu par Lodgify. Rien n’a été écrit.');
    process.exit(1);
  }

  const fichier = JSON.parse(readFileSync(FICHIER, 'utf8'));
  fichier.biens = fichier.biens || {};

  const nouveaux = [];
  const deja = [];
  /* Le cas qui compte : une adresse déjà figée que le nom ne produirait plus.
     C'est la preuve que Lodgify a renommé depuis, et c'est exactement ce qu'on
     veut empêcher - donc on ne touche à rien et on le dit. */
  const divergents = [];

  for (const l of logements) {
    const calcule = identifiant(l.nom);
    const fige = fichier.biens[l.id]?.slug;
    if (!fige) {
      fichier.biens[l.id] = { ...(fichier.biens[l.id] || {}), slug: calcule };
      nouveaux.push({ ...l, slug: calcule });
    } else if (fige !== calcule) {
      divergents.push({ ...l, fige, calcule });
    } else {
      deja.push({ ...l, slug: fige });
    }
  }

  const col = (s, n) => String(s).padEnd(n).slice(0, n);
  console.log(`\n${logements.length} logement(s) chez Lodgify.\n`);

  if (nouveaux.length) {
    console.log(`À FIGER (${nouveaux.length}) :`);
    for (const n of nouveaux) console.log(`  ${col(n.id, 10)} ${col(n.nom, 34)} -> ${n.slug}`);
    console.log();
  }
  if (deja.length) console.log(`Déjà figés et inchangés : ${deja.length}\n`);
  if (divergents.length) {
    console.log(`DÉJÀ RENOMMÉS CHEZ LODGIFY (${divergents.length}) - l’adresse figée est conservée :`);
    for (const d of divergents) {
      console.log(`  ${col(d.id, 10)} ${col(d.nom, 34)} adresse ${d.fige}  (le nom donnerait ${d.calcule})`);
    }
    console.log();
  }

  if (!nouveaux.length) {
    console.log('Rien à écrire.\n');
    return;
  }
  if (!ECRIRE) {
    console.log('Rien n’a été écrit. Relancez avec --ecrire pour appliquer.\n');
    return;
  }

  /* Une copie de sauvegarde avant d'écrire. Ce fichier porte aussi le repli du
     catalogue et les adresses du tunnel de paiement : le perdre coûterait plus
     cher que les trois lignes qui l'évitent. */
  copyFileSync(FICHIER, `${FICHIER}.avant-figeage`);
  writeFileSync(FICHIER, `${JSON.stringify(fichier, null, 2)}\n`, 'utf8');
  console.log(`Écrit. Sauvegarde : ${FICHIER}.avant-figeage`);
  console.log('Relisez le fichier, puis commitez-le.\n');
}

main().catch((e) => {
  console.error('Échec :', e?.message || e);
  process.exit(1);
});
