import crypto from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * L'accès à l'administration.
 *
 * Un seul utilisateur, un seul mot de passe, tenu dans `ADMIN_PASSWORD`. Il n'y
 * a pas de compte à créer, pas de mot de passe stocké en base, et donc rien à
 * voler dans la base : c'est le bon compromis pour une interface que deux
 * personnes ouvriront.
 *
 * Le jeton est un cookie signé - « expiration.signature » - et non un
 * identifiant de session en table. La signature est vérifiée en temps constant,
 * pour ne pas laisser fuiter, octet par octet, la valeur attendue.
 *
 * Sans `ADMIN_PASSWORD` renseignée, l'administration se refuse à s'ouvrir
 * plutôt que d'accepter n'importe quoi. Une porte sans serrure vaut moins
 * qu'une porte murée.
 */

const NOM = 'ib_admin';
const DUREE = 12 * 60 * 60 * 1000; // douze heures : une journée de travail, pas plus

function secret(): string {
  return process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || '';
}

export function administrationConfiguree(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}

function signer(charge: string): string {
  return crypto.createHmac('sha256', secret()).update(charge).digest('hex');
}

function egales(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function fabriquerJeton(): string {
  const exp = String(Date.now() + DUREE);
  return `${exp}.${signer(exp)}`;
}

export function jetonValide(jeton: string | undefined): boolean {
  if (!jeton || !administrationConfiguree()) return false;
  const [exp, sig] = jeton.split('.');
  if (!exp || !sig) return false;
  if (Number(exp) < Date.now()) return false;
  try {
    return egales(sig, signer(exp));
  } catch {
    return false;
  }
}

/** Le mot de passe soumis, comparé en temps constant. */
export function motDePasseCorrect(saisi: string): boolean {
  const attendu = process.env.ADMIN_PASSWORD || '';
  if (!attendu) return false;
  /* Les deux valeurs sont hachées avant comparaison : timingSafeEqual exige des
     longueurs égales, et la longueur du mot de passe est elle-même une
     information. */
  const h = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
  return egales(h(saisi), h(attendu));
}

export const COOKIE = NOM;
export const DUREE_COOKIE = DUREE;

/** Vrai quand la requête courante porte une session d'administration valide. */
export async function connecte(): Promise<boolean> {
  const c = await cookies();
  return jetonValide(c.get(NOM)?.value);
}
