/**
 * Les coordonnées de la maison, en un seul endroit.
 *
 * Elles apparaissent au pied de page, aux mentions légales, dans la politique
 * de confidentialité et sur le courriel des demandes d'audit. Recopiées quatre
 * fois, elles finiraient par diverger - et c'est toujours celle qu'un
 * propriétaire lit qui serait la fausse.
 *
 * L'adresse est celle de Partners Hotels, telle qu'elle figure déjà au registre
 * et sur Staytle : une société n'a qu'un siège, et deux sites qui en annoncent
 * deux différents se contredisent devant le même lecteur.
 */
export const MARQUE = {
  nom: 'IB Signature',
  qualite: 'Conciergerie premium',
  societe: 'Partners Hotels SARL AU',
  adresse: '24 boulevard Rachidi, 20070 Casablanca',
  telephone: '+212 661 21 56 98',
  telephoneLien: '+212661215698',
  /* La boîte de la marque, et non plus celle de la société.
     C'est l'adresse que lisent le pied de page, les mentions légales, la
     politique de confidentialité et la page contact. Elle ne dit pas où le
     courrier arrive : les demandes d'audit partent vers AUDIT_TO et les envois
     se font sous MAIL_FROM, deux variables d'environnement à tenir d'accord
     avec cette ligne, faute de quoi le site annonce une adresse et écrit depuis
     une autre. */
  courriel: 'contact@ibsignature.com',
} as const;
