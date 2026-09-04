/**
 * Les conditions d'annulation, écrites une seule fois.
 *
 * Elles apparaissent à trois endroits : en tête des conditions générales, sous
 * la case à cocher de l'étape de paiement, et dans le courriel de
 * confirmation. Trois endroits, une seule source - sans quoi elles finissent
 * par dire trois choses différentes, et une clause d'annulation qui se
 * contredit ne se règle pas par un correctif, elle se règle devant un juge.
 *
 * C'est aussi la raison pour laquelle ce fichier n'importe RIEN. Les réglages
 * lui sont passés, ils ne sont pas lus ici. Un fichier sans dépendance se
 * relit d'un trait et se vérifie sans base ni navigateur - et c'est le genre
 * de texte qu'on relit le jour où quelqu'un le conteste.
 */

export type Annulation = {
  /** Jours avant l'arrivée pendant lesquels l'annulation reste gratuite. */
  jours: number;
  /** Pourcentage du séjour retenu au-delà de ce délai. */
  retenu: number;
  /** Sous combien de jours le remboursement est effectué. */
  rembours: number;
  /** La clause libre ajoutée par la maison, dans la langue demandée. */
  note: string;
};

const nb = (v: string) => {
  const n = Number(String(v || '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

export function annulation(locale: string, r: Record<string, string>): Annulation {
  const jours = nb(r.annul_jours);
  const retenu = nb(r.annul_retenu_pct);
  const rembours = nb(r.annul_rembours_jours);
  return {
    /* Les valeurs de repli sont celles en vigueur, pas des zéros. Un réglage
       effacé par mégarde ne doit pas transformer « cinq jours » en « aucune
       annulation gratuite » : le site continuerait de vendre, en annonçant
       une politique que la maison n'a jamais décidée. */
    jours: Number.isFinite(jours) ? Math.round(jours) : 5,
    retenu: Number.isFinite(retenu) ? Math.min(100, Math.round(retenu)) : 100,
    rembours: Number.isFinite(rembours) && rembours > 0 ? Math.round(rembours) : 14,
    note: (locale === 'en' ? r.annul_note_en : r.annul_note_fr) || '',
  };
}

/**
 * Les conditions en trois phrases, prêtes à lire.
 *
 * Écrites au présent et à la deuxième personne : ce sont des conséquences qui
 * concernent le lecteur, pas des dispositions qui le concernent. « Vous êtes
 * remboursé intégralement » se comprend du premier coup ; « le voyageur
 * bénéficiera d'un remboursement intégral » se relit deux fois.
 */
export function phrasesAnnulation(locale: string, a: Annulation): string[] {
  const fr = locale !== 'en';
  const out: string[] = [];

  if (a.jours <= 0) {
    out.push(
      fr
        ? 'Cette réservation n’est pas annulable : une fois confirmée, le montant du séjour reste dû.'
        : 'This booking cannot be cancelled: once confirmed, the full amount remains due.'
    );
  } else {
    out.push(
      fr
        ? `Annulation gratuite jusqu’à ${a.jours} jour${a.jours > 1 ? 's' : ''} avant votre arrivée. Vous êtes remboursé de l’intégralité de ce que vous avez versé.`
        : `Free cancellation up to ${a.jours} day${a.jours > 1 ? 's' : ''} before your arrival. You are refunded everything you paid.`
    );
    /* Le cas de la retenue nulle existe : une maison peut rembourser toujours.
       L'écrire « 0 % est retenu » serait un charabia administratif. */
    if (a.retenu >= 100) {
      out.push(
        fr
          ? `Passé ce délai, le montant du séjour reste dû en totalité.`
          : `After that, the full amount of the stay remains due.`
      );
    } else if (a.retenu > 0) {
      out.push(
        fr
          ? `Passé ce délai, ${a.retenu} % du montant du séjour reste dû ; le reste vous est remboursé.`
          : `After that, ${a.retenu}% of the stay remains due; the rest is refunded to you.`
      );
    } else {
      out.push(
        fr
          ? `Passé ce délai également, vous êtes remboursé intégralement.`
          : `After that, you are still refunded in full.`
      );
    }
  }

  out.push(
    fr
      ? `Les remboursements sont effectués sous ${a.rembours} jours, par le moyen qui a servi au paiement.`
      : `Refunds are made within ${a.rembours} days, by the means used for payment.`
  );

  if (a.note.trim()) out.push(a.note.trim());
  return out;
}

/** La phrase courte, celle qui tient sous une case à cocher. */
export function resumeAnnulation(locale: string, a: Annulation): string {
  const fr = locale !== 'en';
  if (a.jours <= 0) return fr ? 'Réservation non annulable' : 'Non-refundable booking';
  return fr
    ? `Annulation gratuite jusqu’à ${a.jours} jour${a.jours > 1 ? 's' : ''} avant l’arrivée`
    : `Free cancellation up to ${a.jours} day${a.jours > 1 ? 's' : ''} before arrival`;
}
