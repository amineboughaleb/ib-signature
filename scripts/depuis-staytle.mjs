/**
 * Sortir de Staytle le tableau à coller ici.
 *
 * Les mêmes appartements y sont déjà décrits, mais les deux informations dont
 * ce site a besoin n'y vivent pas sur la même page : l'identifiant Lodgify est
 * dans « Channel manager », l'adresse iCal dans la fiche de chaque logement.
 * Les rassembler à la main demanderait d'ouvrir vingt-quatre fiches - et de
 * recopier vingt-quatre adresses sans en intervertir deux.
 *
 * Ce script lit la base de Staytle EN LECTURE SEULE et imprime le tableau
 * qu'attend la page Calendriers : un logement par ligne, identifiant, nom,
 * adresse. Vous le sélectionnez dans PowerShell, vous le collez, vous vérifiez.
 *
 * Trois précautions valent d'être dites.
 *
 * La base est ouverte en lecture seule, sans exception : rien de ce qui touche
 * à Staytle ne doit pouvoir être abîmé par un utilitaire de confort.
 *
 * Les noms de colonnes ne sont pas supposés mais cherchés. Une base évolue, et
 * un script qui exige `ical_url` s'arrêtera net le jour où la colonne
 * s'appellera autrement - alors qu'il lui suffisait de regarder.
 *
 * Enfin, rien n'est envoyé nulle part. Ce qui s'affiche reste sur votre écran,
 * et va de votre presse-papier à votre administration sans autre détour.
 *
 *   node scripts/depuis-staytle.mjs
 *   node scripts/depuis-staytle.mjs "D:\\ailleurs\\staytle.db"
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import Database from 'better-sqlite3';

/* Les emplacements où la base se trouve d'ordinaire. On les essaie dans
   l'ordre plutôt que d'exiger un chemin : neuf fois sur dix il n'y a rien à
   taper. */
const PISTES = [
  process.argv[2],
  path.join(os.homedir(), 'Documents', 'Mid-Term Rental', 'MVP', 'MVP by Claude', 'staytle', 'data', 'staytle.db'),
  path.join(os.homedir(), 'Documents', 'Mid-Term Rental', 'MVP', 'MVP by Claude', 'data', 'staytle.db'),
].filter(Boolean);

const fichier = PISTES.find((p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
});

if (!fichier) {
  console.error('Base de Staytle introuvable. Essayé :');
  for (const p of PISTES) console.error(`  ${p}`);
  console.error('\nDonnez le chemin en argument :');
  console.error('  node scripts/depuis-staytle.mjs "C:\\chemin\\vers\\staytle.db"');
  process.exit(1);
}

const db = new Database(fichier, { readonly: true, fileMustExist: true });

/** La première colonne existante parmi celles proposées. */
const colonne = (colonnes, candidats) =>
  candidats.find((c) => colonnes.some((x) => x.toLowerCase() === c.toLowerCase()));

/* La table des logements, quel que soit son nom. */
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
  .all()
  .map((t) => t.name);

const table = ['listings', 'logements', 'properties', 'biens'].find((t) =>
  tables.some((x) => x.toLowerCase() === t.toLowerCase())
);

if (!table) {
  console.error(`Aucune table de logements dans ${path.basename(fichier)}. Tables présentes : ${tables.join(', ')}`);
  process.exit(1);
}

const colonnes = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);

const cId = colonne(colonnes, ['channel_property_id', 'lodgify_id', 'lodgifyId', 'property_id', 'external_id']);
const cIcal = colonne(colonnes, ['ical_url', 'icalUrl', 'ical', 'calendar_url', 'feed_url']);
const cNom = colonne(colonnes, ['title', 'name', 'nom', 'slug']);

if (!cId && !cNom) {
  console.error(`Ni identifiant ni nom dans « ${table} ». Colonnes : ${colonnes.join(', ')}`);
  process.exit(1);
}
if (!cIcal) {
  console.error(`Aucune colonne d'adresse iCal dans « ${table} ». Colonnes : ${colonnes.join(', ')}`);
  process.exit(1);
}

const champs = [cId, cNom, cIcal].filter(Boolean);
const lignes = db.prepare(`SELECT ${champs.map((c) => `"${c}"`).join(', ')} FROM ${table}`).all();

/* Une ligne sans adresse ne sert à rien ici : elle serait recopiée pour être
   écartée, et ferait douter du reste du collage. */
const utiles = lignes.filter((l) => String(l[cIcal] || '').trim());

console.log(`# ${utiles.length} logement(s) avec une adresse iCal, sur ${lignes.length} dans Staytle.`);
console.log('# Sélectionnez les lignes ci-dessous, copiez-les, et collez-les dans');
console.log('# IB Signature → Administration → Calendriers → « Reprendre le tableau de Staytle ».');
console.log('');

for (const l of utiles) {
  console.log([cId ? l[cId] : '', cNom ? l[cNom] : '', l[cIcal]].filter((x) => String(x || '').trim()).join('\t'));
}

const muets = lignes.length - utiles.length;
if (muets > 0) {
  console.log('');
  console.log(`# ${muets} logement(s) de Staytle n'ont pas d'adresse iCal : ils ne sont pas dans la liste.`);
}

db.close();
