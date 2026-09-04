'use server';

import {
  enregistrerAudit,
  marquerEnvoye,
  enregistrerMessage,
  marquerMessageEnvoye,
  enregistrerVirement,
  marquerVirementEnvoye,
  reglages,
} from '@/lib/db';
import { envoyer, echapper } from '@/lib/mail';
import { getT } from '@/lib/i18n';
import { MARQUE } from '@/lib/marque';
import { bien } from '@/lib/biens';
import { echeance, optionsPaiement } from '@/lib/reservation';
import { nuitsEntre } from '@/lib/dates';

export type EtatAudit = { ok?: string; error?: string } | null;

const DESTINATAIRE = process.env.AUDIT_TO || MARQUE.courriel;

/**
 * La demande d'audit d'un propriétaire.
 *
 * L'ordre compte : on écrit en base, puis on tente le courriel. Un prospect qui
 * a laissé son numéro ne doit jamais dépendre d'un fournisseur d'envoi pour
 * exister quelque part. Si le courriel part, on le note ; s'il ne part pas, la
 * demande est là quand même et le visiteur voit un remerciement - lui dire
 * « erreur » alors que sa demande est bien arrivée le ferait recommencer, ou
 * partir.
 */
export async function demanderAuditAction(_prev: EtatAudit, form: FormData): Promise<EtatAudit> {
  const locale = String(form.get('locale') || 'fr');
  const t = getT(locale);

  const champ = (n: string, max = 300) => String(form.get(n) || '').trim().slice(0, max);
  const a = {
    nom: champ('nom', 120),
    email: champ('email', 160).toLowerCase(),
    telephone: champ('telephone', 60),
    ville: champ('ville', 80),
    type_bien: champ('type_bien', 80),
    message: champ('message', 2000),
    locale,
  };

  if (!a.nom || !a.telephone) return { error: t('po_erreur') };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email)) return { error: t('po_erreur') };

  const id = enregistrerAudit(a);

  const ligne = (l: string, v: string) =>
    v ? `<tr><td style="padding:6px 14px 6px 0;color:#6d747c">${echapper(l)}</td><td style="padding:6px 0"><b>${echapper(v)}</b></td></tr>` : '';

  const res = await envoyer({
    to: DESTINATAIRE,
    replyTo: a.email,
    subject: `Demande d'audit - ${a.nom}${a.ville ? ` (${a.ville})` : ''}`,
    html: `<p>Nouvelle demande d'audit déposée sur ibsignature.com.</p>
      <table>${ligne('Nom', a.nom)}${ligne('Courriel', a.email)}${ligne('Téléphone', a.telephone)}${ligne('Ville', a.ville)}${ligne('Type de bien', a.type_bien)}</table>
      ${a.message ? `<p style="margin-top:14px">${echapper(a.message)}</p>` : ''}
      <p style="color:#6d747c;font-size:13px;margin-top:18px">Demande n° ${id}. Répondre à ce message écrit directement au propriétaire.</p>`,
  });
  if (res.ok) marquerEnvoye(id);

  return { ok: t('po_merci') };
}

export type EtatMessage = { ok?: string; error?: string } | null;

/**
 * Le message d'un visiteur, depuis la page de contact.
 *
 * Même architecture que la demande d'audit, et pour la même raison : la base
 * d'abord, le courriel ensuite. Un voyageur qui pose une question la veille de
 * son arrivée ne doit pas disparaître parce qu'un fournisseur d'envoi a eu une
 * mauvaise minute.
 *
 * Le sujet est ramené à une liste connue avant d'être écrit : un champ libre
 * recopié tel quel dans l'objet d'un courriel est une porte ouverte à
 * l'injection d'en-tête.
 */
const SUJETS = ['sejour', 'bien', 'long', 'autre'] as const;

export async function envoyerMessageAction(_prev: EtatMessage, form: FormData): Promise<EtatMessage> {
  const locale = String(form.get('locale') || 'fr');
  const t = getT(locale);

  const champ = (n: string, max = 300) => String(form.get(n) || '').trim().slice(0, max);
  const sujetBrut = champ('sujet', 20);
  const m = {
    nom: champ('nom', 120),
    email: champ('email', 160).toLowerCase(),
    telephone: champ('telephone', 60),
    sujet: (SUJETS as readonly string[]).includes(sujetBrut) ? sujetBrut : 'autre',
    message: champ('message', 4000),
    locale,
  };

  if (!m.nom || !m.message) return { error: t('ct_erreur') };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email)) return { error: t('ct_erreur') };

  const id = enregistrerMessage(m);

  const libelle: Record<string, string> = {
    sejour: t('ct_sujet_sejour'),
    bien: t('ct_sujet_bien'),
    long: t('ct_sujet_long'),
    autre: t('ct_sujet_autre'),
  };
  const ligne = (l: string, v: string) =>
    v ? `<tr><td style="padding:6px 14px 6px 0;color:#6d747c">${echapper(l)}</td><td style="padding:6px 0"><b>${echapper(v)}</b></td></tr>` : '';

  const res = await envoyer({
    to: DESTINATAIRE,
    replyTo: m.email,
    subject: `Message site - ${m.nom} (${libelle[m.sujet]})`,
    html: `<p>Nouveau message déposé sur la page de contact d'ibsignature.com.</p>
      <table>${ligne('Nom', m.nom)}${ligne('Courriel', m.email)}${ligne('Téléphone', m.telephone)}${ligne('Sujet', libelle[m.sujet])}</table>
      <p style="margin-top:14px;white-space:pre-wrap">${echapper(m.message)}</p>
      <p style="color:#6d747c;font-size:13px;margin-top:18px">Message n° ${id}. Répondre à ce courriel écrit directement au visiteur.</p>`,
  });
  if (res.ok) marquerMessageEnvoye(id);

  return { ok: t('ct_merci') };
}

/* ---------- la réservation par virement ----------
   Une règle domine tout ce qui suit : le montant n'est jamais lu dans le
   formulaire. Il est recalculé ici, à partir du logement et des dates, comme
   il l'a été pour l'affichage. Un prix qui voyage dans un champ caché est un
   prix que n'importe qui peut réécrire avant de l'envoyer - et l'on
   confirmerait alors, poliment, une semaine à sept euros.

   Le voyageur peut en revanche mentir sur ses dates : c'est sans conséquence,
   puisque le prix est recalculé pour les dates qu'il annonce, et que ce sont
   ces dates-là qui seront tenues.

   L'ordre reste celui du reste du site : la base d'abord, les courriels
   ensuite. Une demande de réservation ne doit pas s'évaporer parce qu'un
   fournisseur d'envoi a eu une mauvaise minute. */

export type EtatVirement = {
  ok?: boolean;
  error?: string;
  reference?: string;
  montant?: string;
  rib?: string;
  beneficiaire?: string;
  heures?: number;
  /** Sur le chemin de la carte : l'adresse du moteur, que le navigateur suivra. */
  versLodgify?: string;
} | null;

export async function demanderVirementAction(_prev: EtatVirement, form: FormData): Promise<EtatVirement> {
  const locale = String(form.get('locale') || 'fr');
  const t = getT(locale);

  const champ = (n: string, max = 300) => String(form.get(n) || '').trim().slice(0, max);
  const slug = champ('slug', 120);
  const arrivee = champ('arrivee', 10);
  const depart = champ('depart', 10);
  const voyageurs = Number(champ('voyageurs', 3)) || 1;

  const nom = champ('nom', 120);
  const prenom = champ('prenom', 120);
  const nationalite = champ('nationalite', 80);
  const residence = champ('residence', 120);
  const email = champ('email', 160).toLowerCase();
  const telephone = champ('telephone', 60);
  const message = champ('message', 2000);
  /* Le moyen vient du bouton pressé - `<button name="moyen" value="…">` - et
     non d'un champ caché : il n'y a ainsi aucun état à synchroniser entre ce
     que le voyageur a cliqué et ce que le formulaire transporte. */
  const carte = champ('moyen', 20) === 'carte';

  if (!nom || !prenom || !telephone) return { error: t('res_erreur') };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: t('res_erreur') };
  /* Les conditions générales se cochent, et cela s'impose ici et pas seulement
     dans le navigateur : un formulaire se soumet sans navigateur. */
  if (!form.get('cgv')) return { error: t('res_cgv_erreur') };

  const b = await bien(slug);
  if (!b) return { error: t('res_perime') };

  /* On refait le chemin complet plutôt que de faire confiance à la page qui
     nous appelle : les réglages ont pu changer, les dates ont pu se remplir,
     et le délai de cinq jours a pu être franchi pendant que le formulaire
     restait ouvert. */
  const o = await optionsPaiement(b, arrivee, depart, voyageurs, locale);

  /* ---------- le chemin de la carte ----------

     Le voyageur part payer chez Lodgify. On enregistre d'abord ce qu'il a
     saisi : s'il abandonne devant le formulaire de carte - et beaucoup
     abandonnent -, ses coordonnées restent, et vous pouvez le rappeler. Sans
     cet enregistrement, une saisie complète disparaîtrait au premier écran de
     Lodgify sans laisser la moindre trace.

     Cette piste ne tient aucune date : rien n'est réservé tant que Lodgify
     n'a pas encaissé, et bloquer un calendrier sur une intention fermerait
     l'appartement à des voyageurs qui, eux, auraient payé.

     Ce qui est transmis à Lodgify se limite aux dates et au nombre de
     voyageurs. Le nom, le courriel et le téléphone ne partent PAS dans
     l'adresse : Lodgify ne publie aucun paramètre de pré-remplissage, ils
     seraient donc ignorés - et une donnée personnelle placée dans une adresse
     se retrouve dans l'historique du navigateur, dans les en-têtes de
     provenance et dans les journaux de tous les serveurs traversés. Écrire
     des paramètres qu'on sait ignorés donnerait l'illusion d'un
     pré-remplissage tout en publiant ces données pour rien. */
  if (carte) {
    enregistrerVirement({
      bien_id: b.id,
      bien_nom: b.nom,
      slug: b.slug,
      arrivee,
      depart,
      nuits: nuitsEntre(arrivee, depart),
      voyageurs,
      montant: o.devis.total ?? 0,
      devise: o.devis.devise || b.devise || 'EUR',
      montant_mad: 0,
      taux: 0,
      nom,
      prenom,
      nationalite,
      residence,
      email,
      telephone,
      message,
      locale,
      moyen: 'carte',
      expire_at: '',
    });
    return { ok: true, versLodgify: o.carteLien };
  }

  if (!o.virement) return { error: t('res_perime') };

  const r = reglages();
  const v = enregistrerVirement({
    bien_id: b.id,
    bien_nom: b.nom,
    slug: b.slug,
    arrivee,
    depart,
    nuits: nuitsEntre(arrivee, depart),
    voyageurs,
    montant: o.virement.montant,
    devise: o.virement.devise,
    montant_mad: o.virement.mad ?? 0,
    taux: o.virement.taux ?? 0,
    nom,
    prenom,
    nationalite,
    residence,
    email,
    telephone,
    message,
    locale,
    moyen: 'virement',
    expire_at: echeance(o.virement.blocageHeures),
  });

  const somme = `${o.virement.montant.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${o.virement.devise}`;

  const ligne = (l: string, x: string) =>
    x ? `<tr><td style="padding:6px 14px 6px 0;color:#6d747c">${echapper(l)}</td><td style="padding:6px 0"><b>${echapper(x)}</b></td></tr>` : '';

  /* À vous : tout ce qu'il faut pour bloquer les dates dans Lodgify sans
     rouvrir le site. L'échéance est dite en clair, parce que c'est elle qui
     détermine jusqu'à quand ces dates ne doivent être vendues à personne. */
  const pourVous = await envoyer({
    to: DESTINATAIRE,
    replyTo: email,
    subject: `Virement ${v.reference} - ${b.nom} - ${somme}`,
    html: `<p>Demande de réservation par virement déposée sur ibsignature.com.</p>
      <table>${ligne('Référence', v.reference)}${ligne('Logement', b.nom)}${ligne('Séjour', `${arrivee} → ${depart}`)}${ligne('Voyageurs', String(voyageurs))}${ligne('Montant à recevoir', somme)}${ligne('Prix par carte', `${o.virement.prixCarte.toFixed(2)} ${o.virement.devise}`)}${ligne('Voyageur', `${prenom} ${nom}`.trim())}${ligne('Nationalité', nationalite)}${ligne('Réside à', residence)}${ligne('Courriel', email)}${ligne('Téléphone', telephone)}</table>
      ${message ? `<p style="margin-top:14px;white-space:pre-wrap">${echapper(message)}</p>` : ''}
      <p style="margin-top:18px"><b>À faire maintenant :</b> bloquer ces dates dans Lodgify. La demande expire d'elle-même le ${echapper(v.expire_at)} si aucun virement n'est constaté.</p>`,
  });
  if (pourVous.ok) marquerVirementEnvoye(v.id);

  /* Au voyageur : les coordonnées bancaires et la référence. Ce sont les
     coordonnées de Partners Hotels, saisies dans l'administration pour être
     communiquées - il n'y a là aucun secret, seulement de quoi payer. */
  await envoyer({
    to: email,
    subject: locale === 'en' ? `Your booking request ${v.reference} - IB Signature` : `Votre demande de réservation ${v.reference} - IB Signature`,
    html: `<p>${locale === 'en' ? 'Thank you — here are the details for your transfer.' : 'Merci — voici les éléments de votre virement.'}</p>
      <table>${ligne(locale === 'en' ? 'Reference' : 'Référence', v.reference)}${ligne(locale === 'en' ? 'Home' : 'Logement', b.nom)}${ligne(locale === 'en' ? 'Stay' : 'Séjour', `${arrivee} → ${depart}`)}${ligne(locale === 'en' ? 'Amount' : 'Montant', somme)}${ligne(locale === 'en' ? 'Beneficiary' : 'Bénéficiaire', r.virement_beneficiaire)}</table>
      <p style="margin-top:14px;white-space:pre-wrap">${echapper(r.virement_rib)}</p>
      <p style="margin-top:14px">${locale === 'en' ? 'Please quote the reference on your transfer order, and send us the transfer advice once it has left.' : 'Portez la référence sur votre ordre de virement, et envoyez-nous l’avis de virement dès qu’il est parti.'}</p>
      <p style="margin-top:14px">${
        /* Les mêmes deux délais que la page de confirmation, dans les mêmes
           termes. Un courriel qui annoncerait autre chose que l'écran que le
           voyageur vient de quitter ferait douter des deux. */
        locale === 'en'
          ? `Please make your transfer within ${o.heuresVirer} hours. We close the calendar on your dates for ${o.heuresBlocage} hours: without a transfer received by then, they go back on sale.`
          : `Effectuez votre virement sous ${o.heuresVirer} heures. Nous fermons le calendrier sur vos dates pendant ${o.heuresBlocage} heures : sans virement constaté d’ici là, elles repartent à la vente.`
      }</p>`,
  });

  return {
    ok: true,
    reference: v.reference,
    montant: somme,
    rib: r.virement_rib,
    beneficiaire: r.virement_beneficiaire,
    heures: o.virement.reponseHeures,
  };
}
