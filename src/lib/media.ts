import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Les fichiers déposés depuis l'administration.
 *
 * Deux origines de photographies, et deux endroits, pour une bonne raison.
 *
 * Celles de l'import viennent de votre disque, sont versionnées avec le code
 * et se retrouvent identiques à chaque déploiement : leur place est dans
 * `public/photos`. Celles que vous ajoutez depuis un téléphone, elles,
 * arrivent après le déploiement - si on les écrivait au même endroit, elles
 * disparaîtraient à la mise en ligne suivante, car un serveur reconstruit son
 * dossier d'application à chaque fois.
 *
 * Elles vont donc dans un dossier de données, séparé du code, monté sur un
 * volume qui survit aux déploiements - le même que celui de la base. C'est
 * exactement le raisonnement qui vaut pour vos avis et vos réglages : ce que
 * vous saisissez ne doit jamais vivre dans le dossier du code.
 *
 * Ces fichiers ne sont pas servis par le serveur de fichiers statiques, qui ne
 * regarde que `public`. Une route les lit et les rend, sous /media.
 */

/** Le dossier des données : la base, et les photographies déposées. */
export function dossierDonnees(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data');
}

export function dossierMedia(): string {
  return path.join(dossierDonnees(), 'media');
}

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export function typeDe(fichier: string): string {
  return TYPES[path.extname(fichier).toLowerCase()] || 'application/octet-stream';
}

/**
 * Résout une adresse /media/... en chemin de fichier, ou rend null.
 *
 * Le contrôle n'est pas une formalité : sans lui, une adresse contenant « .. »
 * permettrait de lire n'importe quel fichier du serveur, à commencer par celui
 * qui contient les clés. On résout donc le chemin en absolu et l'on vérifie
 * qu'il tombe bien à l'intérieur du dossier des médias.
 */
export function cheminMedia(morceaux: string[]): string | null {
  const base = path.resolve(dossierMedia());
  const vise = path.resolve(base, ...morceaux);
  if (vise !== base && !vise.startsWith(base + path.sep)) return null;
  if (!TYPES[path.extname(vise).toLowerCase()]) return null;
  return vise;
}

/** Un nom de fichier que personne n'a choisi : celui du visiteur n'entre pas ici. */
export function nomNeuf(): string {
  return `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.jpg`;
}

/** Le dossier d'un logement, créé au besoin. Le slug est nettoyé, jamais recopié tel quel. */
export function dossierDe(slug: string): string {
  const propre = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'divers';
  const rep = path.join(dossierMedia(), propre);
  fs.mkdirSync(rep, { recursive: true });
  return rep;
}
