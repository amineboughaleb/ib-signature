import Link from 'next/link';

/**
 * L'état du courrier, dit en haut de chaque page d'administration.
 *
 * Sans fournisseur configuré, les courriels ne partent pas : ils s'écrivent
 * dans le journal du serveur. Le site continue de fonctionner - une demande de
 * virement est écrite en base AVANT tout envoi, elle n'est donc jamais perdue -
 * mais personne n'est prévenu. Ni le voyageur, qui attend ses coordonnées
 * bancaires ; ni vous, qui ne savez pas qu'une demande vient d'arriver.
 *
 * C'est la panne la plus coûteuse qu'un site de réservation puisse avoir, et
 * la plus silencieuse : tout paraît marcher. D'où ce bandeau, présent partout
 * plutôt que sur une page de réglages qu'on ouvre une fois par mois.
 *
 * Il ne s'affiche que lorsqu'il y a quelque chose à dire. Un bandeau permanent
 * cesse d'être lu au bout de trois jours.
 */
export default function EtatCourriels({ enAttente }: { enAttente: number }) {
  const configure = Boolean(process.env.RESEND_API_KEY);
  const expediteur = process.env.MAIL_FROM || '';
  /* L'adresse d'essai de Resend n'écrit qu'au titulaire du compte. Elle
     fonctionne, ce qui la rend trompeuse : on croit le courrier en place, et
     aucun voyageur ne reçoit jamais rien. */
  const essai = !expediteur || /resend\.dev/i.test(expediteur);

  if (configure && !essai && !enAttente) return null;

  return (
    <div className="courriels-etat">
      {!configure && (
        <p className="avert">
          <strong>Les courriels ne partent pas.</strong> La clef du fournisseur d’envoi (<code>RESEND_API_KEY</code>)
          n’est pas renseignée : les messages sont écrits dans le journal du serveur et personne ne les reçoit — ni le
          voyageur qui attend vos coordonnées bancaires, ni vous. Rien n’est perdu pour autant : toute demande est
          écrite en base avant le moindre envoi, et se retrouve dans{' '}
          <Link href="/admin/virements">Séjours et virements</Link> et{' '}
          <Link href="/admin/demandes">Propriétaires et messages</Link>.
        </p>
      )}

      {configure && essai && (
        <p className="avert">
          <strong>L’expéditeur est encore celui d’essai.</strong> <code>MAIL_FROM</code> vaut{' '}
          <code>{expediteur || 'onboarding@resend.dev'}</code>, une adresse qui n’écrit qu’au titulaire du compte
          Resend. Elle fonctionne, ce qui la rend trompeuse : vos courriels partent, et aucun voyageur n’en reçoit
          jamais. Il faut un domaine vérifié et une adresse à vous.
        </p>
      )}

      {enAttente > 0 && (
        <p className="avert">
          <strong>{enAttente} courriel(s) ne sont jamais partis.</strong> Les demandes, elles, sont bien enregistrées :
          elles portent la mention « courriel non parti » dans{' '}
          <Link href="/admin/virements">Séjours et virements</Link> et{' '}
          <Link href="/admin/demandes">Propriétaires et messages</Link>. Personne n’a été prévenu, ni le demandeur ni
          vous — écrivez-leur directement. Une demande de virement classée « annulée » sort de ce décompte.
        </p>
      )}
    </div>
  );
}
