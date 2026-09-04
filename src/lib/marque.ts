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
  /* Tant qu'aucune boîte @ibsignature.com n'existe, c'est celle de la société
     qui reçoit. Le jour où vous en créez une, cette ligne suffit à basculer :
     rien d'autre dans le code ne porte d'adresse. */
  courriel: 'contact@partnershotels.ma',
} as const;
