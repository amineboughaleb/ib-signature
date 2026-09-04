/**
 * Comment on réserve, et à quelles conditions.
 *
 * Jusqu'ici le site n'avait rien à décider : le bouton « Réserver » passait la
 * main à Lodgify, et c'est Lodgify qui posait la question du paiement. Cela
 * revenait à imposer la carte bancaire avant même d'avoir proposé le virement -
 * c'est-à-dire à payer une commission sur des réservations qui n'en auraient
 * pas eu besoin.
 *
 * L'ordre est donc rétabli : on demande d'abord comment le voyageur veut
 * payer, et l'on ne passe chez Lodgify que si la réponse est « par carte ».
 *
 * Reste que le virement ne peut pas toujours être proposé. Sept conditions
 * doivent tenir ensemble, et il suffit qu'une seule manque pour que la carte
 * redevienne le seul chemin. Elles sont réunies ici, en un seul endroit, parce
 * qu'une règle de ce genre éparpillée dans trois composants finit par être
 * vraie dans deux d'entre eux.
 *
 * Une remarque sur le sens de la majoration, qui n'est pas intuitive. Ce n'est
 * pas le site qui majore : ce sont vos tarifs Lodgify qui portent déjà la
 * commission, puisque c'est Lodgify qui encaisse. Le site fait le chemin
 * inverse - du prix affiché vers ce que vous touchez - et c'est ce montant-là
 * qu'il propose de virer. Le voyageur ne voit donc pas une majoration, il voit
 * une remise. Et cette remise est plus petite que la majoration : retirer
 * 6,33 % d'un prix majoré rend 5,95 %. Retirer une majoration n'est pas
 * l'opération inverse de l'ajouter.
 */

import type { Bien } from './biens';
import { lienReservation } from './biens';
import { devis, type Devis } from './lodgify';
import { net, sansPlan, reglages, virementsEnAttente } from './db';
import { conflit } from './flux';
import { nuitsEntre } from './dates';

export type Virement = {
  /** Le montant à virer, ferme, dans la devise des prix. C'est lui qui engage. */
  montant: number;
  devise: string;
  /** La contre-valeur en dirhams, indicative, et le taux qui l'a produite. */
  mad?: number;
  taux?: number;
  tauxDate?: string;
  /** Ce que le voyageur économise par rapport au prix par carte. */
  economie: number;
  economiePct: number;
  /** Le prix par carte, pour la comparaison. */
  prixCarte: number;
  /** Heures pendant lesquelles les dates sont tenues. */
  blocageHeures: number;
  /** Heures sous lesquelles vous vous engagez à répondre. */
  reponseHeures: number;
};

export type Options = {
  /** Toujours présente : le lien Lodgify, dates comprises. */
  carteLien: string;
  /** Le prix du séjour tel que Lodgify le facturerait, quand il est connu. */
  devis: Devis;
  /** Présent seulement si toutes les conditions du virement sont réunies. */
  virement?: Virement;
  /** Pourquoi le virement n'est pas proposé. Pour l'administration, jamais pour le voyageur. */
  raison?: string;
  nuits: number;
  /* Les deux délais annoncés au voyageur une fois la demande déposée. Ils sont
     ici plutôt que dans `virement` parce que la page de confirmation les
     affiche APRÈS l'enregistrement, à un moment où `virement` a justement
     disparu : la demande vient de rendre ces dates « déjà tenues ». */
  heuresVirer: number;
  heuresBlocage: number;
};

const nb = (v: string) => Number(String(v || '0').replace(',', '.')) || 0;

/** Le nombre de jours pleins entre aujourd'hui et une date, en UTC. */
export function joursAvant(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return -1;
  const jour = 24 * 60 * 60 * 1000;
  const cible = Date.parse(`${date}T00:00:00Z`);
  const now = new Date();
  const aujourdhui = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (!Number.isFinite(cible)) return -1;
  return Math.floor((cible - aujourdhui) / jour);
}

/**
 * Les deux chemins possibles pour un séjour donné.
 *
 * Le virement n'est proposé que si TOUT tient : il est activé, les
 * coordonnées bancaires sont saisies, la commission est connue - sans quoi il
 * n'y a pas d'écart calculable -, les dates sont là, l'arrivée est assez
 * lointaine, Lodgify a rendu un prix, et personne d'autre ne tient déjà ces
 * dates. À la moindre lacune, la carte reste seule, sans explication au
 * voyageur : on ne lui doit pas le détail de nos réglages.
 */
export async function optionsPaiement(
  b: Bien,
  arrivee: string,
  depart: string,
  voyageurs: number,
  locale?: string
): Promise<Options> {
  const nuits = nuitsEntre(arrivee, depart);
  const carteLien = lienReservation(
    b,
    nuits ? arrivee : undefined,
    nuits ? depart : undefined,
    voyageurs || undefined,
    locale
  );
  const r = reglages();

  const heuresVirer = Math.max(1, Math.round(nb(r.virement_virer_heures)) || 24);
  const heuresBlocage = Math.max(1, Math.round(nb(r.virement_blocage_heures)) || 48);

  const rendre = (raison: string, d: Devis = { connu: false }): Options => ({
    carteLien,
    devis: d,
    raison,
    nuits,
    heuresVirer,
    heuresBlocage,
  });

  if (r.virement_actif !== '1') return rendre('le virement est éteint dans les réglages');
  if (!r.virement_rib.trim()) return rendre('aucune coordonnée bancaire n’est saisie');
  if (!nb(r.commission_pct)) return rendre('la commission n’est pas renseignée : l’écart de prix serait inventé');
  if (!nuits) return rendre('aucune date n’est demandée');

  const delai = Math.max(0, Math.round(nb(r.virement_delai_jours)));
  const jours = joursAvant(arrivee);
  if (jours < delai) {
    return rendre(`l’arrivée est dans ${jours} jour(s), le virement demande ${delai} jour(s)`);
  }

  const d = await devis(b.id, arrivee, depart, voyageurs || 1);
  if (!d.connu || !d.total) return rendre(`Lodgify n’a pas rendu de prix (${d.detail || 'sans détail'})`, d);

  /* Les dates déjà tenues par une autre demande en attente. Le site ne peut pas
     bloquer un calendrier chez Lodgify - la clé ne l'autorise pas toujours -
     mais il peut au moins ne pas vendre deux fois la même semaine par sa
     propre porte. Le chevauchement se lit sur les dates : deux séjours se
     croisent dès que l'un commence avant que l'autre finisse. */
  const tenu = virementsEnAttente().some(
    (v) => v.bien_id === b.id && v.arrivee < depart && arrivee < v.depart
  );
  if (tenu) return rendre('ces dates sont déjà tenues par une demande en attente', d);

  /* Et ce que disent les calendriers importés directement d'Airbnb, de Booking
     et de Lodgify. C'est la garde la plus utile de toute cette fonction : elle
     attrape précisément le cas où Lodgify n'a pas encore repris une
     réservation faite ailleurs, et où son API annonce donc libre une semaine
     qui ne l'est pas. Prendre un virement sur ces dates-là, c'est promettre un
     appartement déjà occupé - et il faudrait rembourser en plus de perdre le
     client.

     Un logement sans flux déclaré rend `null` : on ne sait rien, et l'on ne
     bloque donc rien. Ne pas savoir n'est pas savoir que c'est pris. */
  const pris = conflit(b.id, arrivee, depart);
  if (pris) return rendre(`un calendrier importé annonce ces dates prises (${pris.d} → ${pris.f})`, d);

  /* Le montant à virer.
   *
   * Deux chemins, et le premier est le bon depuis que Lodgify majore lui-même.
   * Quand le taux du plan tarifaire est renseigné, on retire exactement la
   * ligne « frais de transaction » que le voyageur a sous les yeux chez
   * Lodgify : le montant qu'on lui demande correspond alors à quelque chose
   * qu'il peut voir et vérifier.
   *
   * Sinon on retombe sur l'ancien calcul - ce que Payyo prélèverait. Le
   * résultat est très proche, mais il ne correspond à aucune ligne affichée
   * nulle part, et un montant qu'on ne peut rattacher à rien se discute. */
  const montant = sansPlan(d.total, r) ?? net(d.total, r);
  if (!montant) return rendre('le montant net n’est pas calculable', d);

  const arrondi = Math.round(montant * 100) / 100;
  const taux = nb(r.taux_mad);
  const mad = taux > 0 ? Math.round(arrondi * taux) : undefined;
  const economie = Math.round((d.total - arrondi) * 100) / 100;

  return {
    carteLien,
    devis: d,
    nuits,
    heuresVirer,
    heuresBlocage,
    virement: {
      montant: arrondi,
      devise: d.devise || b.devise || 'EUR',
      mad,
      taux: taux > 0 ? taux : undefined,
      tauxDate: taux > 0 ? r.taux_mad_date : undefined,
      economie,
      economiePct: Math.round((economie / d.total) * 1000) / 10,
      prixCarte: d.total,
      blocageHeures: Math.max(1, Math.round(nb(r.virement_blocage_heures)) || 48),
      reponseHeures: Math.max(1, Math.round(nb(r.virement_reponse_heures)) || 12),
    },
  };
}

/**
 * L'échéance d'une demande, au format que SQLite compare.
 *
 * Un blocage qui ne s'éteint pas finit par geler un calendrier entier : chaque
 * demande naît donc avec sa date de péremption, et personne n'a à y penser.
 */
export function echeance(heures: number): string {
  const d = new Date(Date.now() + heures * 60 * 60 * 1000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
