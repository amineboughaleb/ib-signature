/**
 * L'invitation à laisser un avis.
 *
 * Elle part après le départ, jamais avant : on ne demande pas son avis à
 * quelqu'un qui est encore dans l'appartement, et encore moins à quelqu'un
 * qui n'y est pas entré.
 *
 * Deux sortes de séjours passent par ce site, et il ne sait pas la même chose
 * des deux.
 *
 * Un séjour payé par virement, il le connaît de bout en bout : vous avez
 * constaté l'argent et marqué la demande « reçue ». Celui-là est invité tout
 * seul, par la tâche de nuit.
 *
 * Un séjour payé par carte, il ne le connaît qu'à moitié. Le voyageur a laissé
 * son nom ici puis il est parti payer chez Lodgify, et le site ne sait pas
 * s'il est allé au bout. Inviter d'office quelqu'un qui a renoncé devant le
 * formulaire de carte lui demanderait son avis sur un logement où il n'a
 * jamais dormi. Celui-là ne part donc que sur votre clic, depuis
 * l'administration, une fois le séjour vérifié dans Lodgify.
 */

import crypto from 'node:crypto';
import {
  creerInvitation,
  invitations,
  marquerInvitationEnvoyee,
  sejoursTermines,
  type Invitation,
  type Virement,
} from './db';
import { envoyer, echapper } from './mail';
import { origine } from './seo';
import { MARQUE } from './marque';
import { formatDate } from './dates';

/** Au-delà, on n'invite plus d'office : un courriel trois semaines après le départ ressemble à une relance. */
export const DELAI_AUTO_JOURS = 14;

const aujourdhui = () => new Date().toISOString().slice(0, 10);

export function lienAvis(i: Invitation): string {
  return `${origine()}/${i.locale === 'en' ? 'en' : 'fr'}/avis/${i.jeton}`;
}

/**
 * Envoie l'invitation d'un séjour. Rend ce qui s'est passé, en clair.
 *
 * L'invitation est créée avant l'envoi et marquée « partie » seulement après :
 * un fournisseur de courriel qui refuse laisse une ligne qu'on voit dans
 * l'administration et qu'on peut renvoyer, au lieu d'un silence.
 */
export async function inviter(v: Virement): Promise<{ ok: boolean; detail: string }> {
  if (!v.email) return { ok: false, detail: 'pas de courriel' };
  if (!v.depart || v.depart > aujourdhui()) return { ok: false, detail: 'séjour non terminé' };

  const i = creerInvitation(v, crypto.randomBytes(20).toString('hex'));
  if (i.avis_id) return { ok: false, detail: 'avis déjà déposé' };

  const en = i.locale === 'en';
  const lien = lienAvis(i);
  const prenom = i.prenom ? ` ${echapper(i.prenom)}` : '';
  const sejour = `${formatDate(i.arrivee, i.locale)} - ${formatDate(i.depart, i.locale)}`;

  const res = await envoyer({
    to: i.email,
    replyTo: MARQUE.courriel,
    subject: en ? `How was your stay at ${i.bien_nom}?` : `Comment s'est passé votre séjour - ${i.bien_nom}`,
    html: en
      ? `<p>Hello${prenom},</p>
         <p>Thank you for staying at <b>${echapper(i.bien_nom)}</b> (${echapper(sejour)}).</p>
         <p>Would you take a minute to tell us how it went? A rating out of five and a few lines are enough. Your review helps the next travellers choose, and it tells us what to improve.</p>
         <p style="margin:22px 0"><a href="${lien}" style="background:#15120e;color:#f7f5f0;padding:13px 22px;text-decoration:none;border-radius:3px">Leave my review</a></p>
         <p style="color:#6d675e;font-size:13px">This link is personal and works once. If the button does not open, copy this address into your browser:<br>${lien}</p>
         <p style="color:#6d675e;font-size:13px">${MARQUE.nom} - ${MARQUE.telephone}</p>`
      : `<p>Bonjour${prenom},</p>
         <p>Merci d'avoir séjourné au <b>${echapper(i.bien_nom)}</b> (${echapper(sejour)}).</p>
         <p>Auriez-vous une minute pour nous dire comment cela s'est passé ? Une note sur cinq et quelques lignes suffisent. Votre avis aide les prochains voyageurs à choisir, et nous dit ce qu'il faut améliorer.</p>
         <p style="margin:22px 0"><a href="${lien}" style="background:#15120e;color:#f7f5f0;padding:13px 22px;text-decoration:none;border-radius:3px">Laisser mon avis</a></p>
         <p style="color:#6d675e;font-size:13px">Ce lien est personnel et ne sert qu'une fois. Si le bouton ne s'ouvre pas, recopiez cette adresse dans votre navigateur :<br>${lien}</p>
         <p style="color:#6d675e;font-size:13px">${MARQUE.nom} - ${MARQUE.telephone}</p>`,
  });

  if (res.ok) marquerInvitationEnvoyee(i.id);
  return { ok: res.ok, detail: res.detail };
}

/**
 * Les invitations qui partent toutes seules.
 *
 * Seulement les virements constatés, seulement à partir du lendemain du
 * départ, et seulement dans les quatorze jours qui suivent. Un séjour déjà
 * invité n'est jamais relancé : une demande d'avis est polie, deux sont une
 * insistance.
 */
export async function inviterLesSejoursTermines(): Promise<{ partis: number; echecs: number }> {
  const deja = invitations();
  const jour = aujourdhui();
  let partis = 0;
  let echecs = 0;
  for (const v of sejoursTermines(DELAI_AUTO_JOURS)) {
    if (v.statut !== 'recu') continue;
    if (v.depart >= jour) continue;
    const i = deja.get(v.id);
    if (i && (i.envoye_at || i.avis_id)) continue;
    const r = await inviter(v);
    if (r.ok) partis += 1;
    else echecs += 1;
  }
  return { partis, echecs };
}
