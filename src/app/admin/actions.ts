'use server';

import { cookies } from 'next/headers';
import { estEquipement } from '@/lib/equipements';
import { importerTous, sourceDe } from '@/lib/flux';
import { analyserCollage, type Collage } from '@/lib/collage';
import { biens } from '@/lib/biens';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { COOKIE, DUREE_COOKIE, administrationConfiguree, connecte, fabriquerJeton, motDePasseCorrect } from '@/lib/admin';
import {
  ecrireAvis,
  supprimerAvis,
  ecrireImage,
  supprimerImage,
  ecrireLien,
  ecrireGalerie,
  ecrireGalerieChoisie,
  libererGalerie,
  ecrireDescription,
  ecrireFaits,
  ecrireEquipements,
  ecrireReglages,
  reglages,
  changerStatutVirement,
  ecrireFluxDeBien,
  restaurer,
} from '@/lib/db';

export type Etat = { error?: string } | null;

/**
 * Les actions de l'administration.
 *
 * Chacune commence par vérifier la session, sans exception. Un composant de
 * page protégé ne protège que l'affichage : une action serveur est une adresse
 * publique, et qui connaît son identifiant peut l'appeler sans jamais voir la
 * page. La garde est donc ici, dans l'action, et pas seulement à l'entrée.
 */
async function garde() {
  if (!(await connecte())) throw new Error('non autorisé');
}

export async function connexionAction(_p: Etat, form: FormData): Promise<Etat> {
  if (!administrationConfiguree())
    return { error: 'L’administration n’est pas configurée : renseignez ADMIN_PASSWORD.' };

  const saisi = String(form.get('motdepasse') || '');
  /* Une seconde d'attente sur échec : cela ne gêne pas une personne qui se
     trompe une fois, et rend une attaque par essais successifs sans intérêt. */
  if (!motDePasseCorrect(saisi)) {
    await new Promise((r) => setTimeout(r, 1000));
    return { error: 'Mot de passe incorrect.' };
  }

  const c = await cookies();
  c.set(COOKIE, fabriquerJeton(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DUREE_COOKIE / 1000,
  });
  redirect('/admin/avis');
}

export async function deconnexionAction() {
  const c = await cookies();
  c.delete(COOKIE);
  redirect('/admin');
}

/* ---------- les avis ---------- */

function champ(form: FormData, n: string, max = 2000) {
  return String(form.get(n) || '').trim().slice(0, max);
}

export async function enregistrerAvisAction(form: FormData) {
  await garde();
  const id = Number(form.get('id')) || null;
  const texteFr = champ(form, 'texte_fr');
  /* Un avis sans texte n'est pas un avis. On refuse plutôt que d'écrire une
     carte vide qui apparaîtrait sur l'accueil. */
  if (!texteFr) return;

  ecrireAvis(id, {
    prenom: champ(form, 'prenom', 60),
    pays_fr: champ(form, 'pays_fr', 60),
    pays_en: champ(form, 'pays_en', 60) || champ(form, 'pays_fr', 60),
    bien_slug: champ(form, 'bien_slug', 120),
    bien_nom: champ(form, 'bien_nom', 160),
    texte_fr: texteFr,
    texte_en: champ(form, 'texte_en') || texteFr,
    source: champ(form, 'source', 40),
    rang: Number(form.get('rang')) || 100,
    publie: form.get('publie') ? 1 : 0,
  });
  revalidatePath('/admin/avis');
  revalidatePath('/', 'layout');
}

export async function supprimerAvisAction(form: FormData) {
  await garde();
  const id = Number(form.get('id'));
  if (id) supprimerAvis(id);
  revalidatePath('/admin/avis');
  revalidatePath('/', 'layout');
}

/* ---------- le diaporama ---------- */

export async function enregistrerImageAction(form: FormData) {
  await garde();
  const id = Number(form.get('id')) || null;
  const url = champ(form, 'url', 600);
  /* Seules les adresses http(s) sont acceptées : une adresse `javascript:` ou
     `data:` dans un attribut src est une porte ouverte. */
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) return;

  ecrireImage(id, {
    url,
    alt_fr: champ(form, 'alt_fr', 200),
    alt_en: champ(form, 'alt_en', 200) || champ(form, 'alt_fr', 200),
    rang: Number(form.get('rang')) || 100,
    actif: form.get('actif') ? 1 : 0,
  });
  revalidatePath('/admin/diaporama');
  revalidatePath('/', 'layout');
}

export async function supprimerImageAction(form: FormData) {
  await garde();
  const id = Number(form.get('id'));
  if (id) supprimerImage(id);
  revalidatePath('/admin/diaporama');
  revalidatePath('/', 'layout');
}


/* ---------- les adresses de réservation ---------- */

export async function enregistrerLienAction(form: FormData) {
  await garde();
  const bienId = Number(form.get('bien_id'));
  const url = champ(form, 'url', 600);
  /* Vide, on efface : le logement retombe alors sur la page « toutes les
     propriétés », ce qui est un repli sûr et non une panne. Sinon, seules les
     adresses http(s) sont acceptées. */
  if (url && !/^https?:\/\//i.test(url)) return;
  ecrireLien(bienId, url);

  /* Les photographies ne se saisissent plus à la main : elles viennent de
     l'import et se rangent dans l'éditeur de galerie. Ce formulaire ne les
     touche donc que si le champ existe encore - un champ absent n'est pas un
     champ vide, et confondre les deux effacerait dix-huit photographies pour
     l'enregistrement d'une adresse. */
  const brut = form.get('photos');
  if (brut !== null) {
    const photos = String(brut)
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith('/') || /^https?:\/\//i.test(u))
      .slice(0, 40)
      .join('\n');
    ecrireGalerie(bienId, photos);
  }

  revalidatePath('/admin/reservation');
  revalidatePath('/', 'layout');
}

/* ---------- les réglages de paiement ---------- */

export async function enregistrerReglagesAction(form: FormData) {
  await garde();

  /* La commission accepte la virgule : personne n'écrit « 4.9 » en français. */
  const nombre = (n: string) => champ(form, n, 12).replace(',', '.').replace(/[^0-9.]/g, '');

  /* Une heure au format HH:MM, bornée à des valeurs qui existent. Une saisie
     illisible retombe sur la valeur en vigueur plutôt que d'écrire n'importe
     quoi : ces heures partent dans les conditions générales, et « 47:88 » y
     serait imprimé tel quel. */
  const heure = (n: string, defaut: string) => {
    const brut = champ(form, n, 5).replace('h', ':').replace(/[^0-9:]/g, '');
    const m = brut.match(/^(\d{1,2}):?(\d{2})$/);
    if (!m) return defaut;
    const h = Number(m[1]);
    const mn = Number(m[2]);
    if (h > 23 || mn > 59) return defaut;
    return `${String(h).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
  };

  const pct = nombre('commission_pct');
  /* On n'allume pas le virement sans commission connue : le prix par carte se
     calcule à partir d'elle, et un prix calculé sur une supposition serait un
     prix inventé. La case cochée sans commission est donc ignorée, pas
     obéie. */
  const actif = form.get('virement_actif') && pct ? '1' : '0';

  /* Le taux dirham n'engage rien - le montant en euros fait foi - mais il
     s'affiche au voyageur, et un taux aberrant saisi d'un doigt qui glisse
     afficherait une contre-valeur ridicule sous un prix juste. On borne donc
     à des valeurs plausibles plutôt que d'accepter n'importe quel nombre. */
  const tauxBrut = Number(nombre('taux_mad'));
  const taux = Number.isFinite(tauxBrut) && tauxBrut >= 1 && tauxBrut <= 100 ? String(tauxBrut) : '';

  /* La date du taux n'est jamais saisie : elle est celle du jour où le chiffre
     a changé. Et elle ne bouge que s'il change vraiment - enregistrer la
     commission ne doit pas rajeunir un taux vieux de six mois, sans quoi la
     date finirait par certifier une valeur qu'elle ne connaît pas. */
  const avant = reglages();
  const dateTaux = !taux ? '' : taux === avant.taux_mad && avant.taux_mad_date
    ? avant.taux_mad_date
    : new Date().toISOString().slice(0, 10);

  ecrireReglages({
    commission_pct: pct,
    commission_fixe: nombre('commission_fixe'),
    conversion_pct: nombre('conversion_pct'),
    plan_majoration_pct: nombre('plan_majoration_pct'),
    virement_virer_heures: nombre('virement_virer_heures'),
    annul_jours: nombre('annul_jours'),
    annul_retenu_pct: nombre('annul_retenu_pct'),
    annul_rembours_jours: nombre('annul_rembours_jours'),
    annul_note_fr: champ(form, 'annul_note_fr', 1200),
    annul_note_en: champ(form, 'annul_note_en', 1200),
    /* Une heure, et rien d'autre. Un champ libre finirait par contenir
       « vers 15h » ou « 3 pm », et deux formats dans deux langues sur la même
       page se lisent comme deux horaires différents. */
    sejour_checkin: heure('sejour_checkin', '15:00'),
    sejour_checkout: heure('sejour_checkout', '11:00'),
    virement_actif: actif,
    virement_delai_jours: nombre('virement_delai_jours') || '5',
    virement_blocage_heures: nombre('virement_blocage_heures') || '48',
    virement_devise: champ(form, 'virement_devise', 8) || 'MAD',
    virement_beneficiaire: champ(form, 'virement_beneficiaire', 120),
    virement_rib: champ(form, 'virement_rib', 400),
    virement_frais: champ(form, 'virement_frais', 20) || 'client',
    virement_part: champ(form, 'virement_part', 20) || 'totalite',
    virement_reponse_heures: nombre('virement_reponse_heures') || '12',
    taux_mad: taux,
    taux_mad_date: dateTaux,
  });

  revalidatePath('/admin/paiement');
  revalidatePath('/', 'layout');
}

/* ---------- les demandes de virement ---------- */

export async function changerStatutVirementAction(form: FormData) {
  await garde();
  const id = Number(champ(form, 'id', 12));
  const statut = champ(form, 'statut', 12);
  if (id > 0) changerStatutVirement(id, statut);
  revalidatePath('/admin/virements');
  revalidatePath('/', 'layout');
}

/* ---------- l'ordre des photographies ---------- */

/** Une adresse d'image acceptable : la nôtre, ou une adresse http(s). */
const imageValable = (u: string) => u.startsWith('/') || /^https?:\/\//i.test(u);

function listeImages(form: FormData, nom: string): string[] {
  return String(form.get(nom) || '')
    .split(/\r?\n/)
    .map((u) => u.trim())
    .filter((u) => u && imageValable(u))
    .slice(0, 200);
}

export async function enregistrerGalerieAction(form: FormData) {
  await garde();
  const bienId = Number(form.get('bien_id'));
  if (!bienId) return;

  const retenues = listeImages(form, 'retenues');
  const ecartees = listeImages(form, 'ecartees').filter((u) => !retenues.includes(u));
  ecrireGalerieChoisie(bienId, retenues, ecartees);

  revalidatePath('/admin/photos');
  revalidatePath(`/admin/photos/${bienId}`);
  revalidatePath('/', 'layout');
}

export async function libererGalerieAction(form: FormData) {
  await garde();
  const bienId = Number(form.get('bien_id'));
  if (bienId) libererGalerie(bienId);
  revalidatePath('/admin/photos');
  revalidatePath(`/admin/photos/${bienId}`);
}

/* ---------- la présentation d'un logement ---------- */

export async function enregistrerDescriptionAction(form: FormData) {
  await garde();
  const bienId = Number(form.get('bien_id'));
  if (!bienId) return;

  /* Pas de limite serrée : une présentation de logement fait volontiers deux
     mille signes, et tronquer au milieu d'une phrase serait pire que tout. */
  ecrireDescription(bienId, {
    fr: champ(form, 'description_fr', 6000),
    en: champ(form, 'description_en', 6000),
  });

  revalidatePath(`/admin/logements/${bienId}`);
  revalidatePath('/', 'layout');
}

/* ---------- toutes les adresses d'un coup ---------- */

export async function enregistrerAdressesAction(form: FormData) {
  await garde();

  /* On ne parcourt pas un catalogue ici : les champs présents dans le
     formulaire font foi. Un logement retiré de Lodgify entre l'affichage de la
     page et son enregistrement n'a donc pas de champ, et rien ne le concernant
     n'est écrit - plutôt que de lever une erreur au visage de l'utilisateur. */
  for (const [nom, valeur] of form.entries()) {
    const m = /^url_(\d+)$/.exec(nom);
    if (!m) continue;
    const url = String(valeur || '').trim().slice(0, 600);
    /* Vide, on efface : le logement retombe sur la page « toutes les
       propriétés », ce qui est un repli sûr et non une panne. */
    if (url && !/^https?:\/\//i.test(url)) continue;
    ecrireLien(Number(m[1]), url);
  }

  revalidatePath('/admin/logements');
  revalidatePath('/admin/logements/adresses');
  revalidatePath('/', 'layout');
}

/* ---------- les caractéristiques d'un logement ---------- */

export async function enregistrerFaitsAction(form: FormData) {
  await garde();
  const bienId = Number(form.get('bien_id'));
  if (!bienId) return;

  /* Zéro veut dire « non renseigné », pas « aucun » : c'est la seule
     convention qui permette de laisser un champ vide sans affirmer qu'un
     logement n'a pas de salle de bain. Les valeurs aberrantes sont ramenées à
     zéro plutôt que refusées - un formulaire qui rejette sans expliquer est
     plus pénible qu'un champ ignoré. */
  const entier = (n: string, max: number) => {
    const v = Math.round(Number(String(form.get(n) || '').replace(',', '.')));
    return Number.isFinite(v) && v > 0 && v <= max ? v : 0;
  };

  ecrireFaits(bienId, {
    chambres: entier('f_chambres', 20),
    lits: entier('f_lits', 40),
    canapes: entier('f_canapes', 20),
    bains: entier('f_bains', 20),
    eau: entier('f_eau', 20),
    surface: entier('f_surface', 2000),
    voyageurs: entier('f_voyageurs', 40),
    sejour_min: entier('f_sejour_min', 365),
    quartier: champ(form, 'f_quartier', 80),
  });

  revalidatePath(`/admin/logements/${bienId}`);
  revalidatePath('/', 'layout');
}

/* ---------- toutes les caractéristiques d'un coup ----------
   Vingt-quatre logements et sept champs chacun font cent soixante-huit
   saisies. Les faire page par page serait une punition ; on les prend donc
   toutes ensemble, et l'on n'écrit que les logements dont un champ a
   réellement changé - inutile de toucher vingt-trois lignes pour en corriger
   une. */

export async function enregistrerToutesCaracteristiquesAction(form: FormData) {
  await garde();

  const ids = new Set<number>();
  for (const nom of form.keys()) {
    /* Le signe compte : le catalogue de repli - celui qui sert quand Lodgify
       n'est pas joint - numérote ses logements en négatif, et une expression
       qui ne lit que des chiffres les ignorait tous en silence. */
    const m = /^f_[a-z_]+_(-?\d+)$/.exec(nom);
    if (m) ids.add(Number(m[1]));
  }

  for (const id of ids) {
    if (!id) continue;
    const entier = (n: string, max: number) => {
      const v = Math.round(Number(String(form.get(`${n}_${id}`) || '').replace(',', '.')));
      return Number.isFinite(v) && v > 0 && v <= max ? v : 0;
    };
    ecrireFaits(id, {
      chambres: entier('f_chambres', 20),
      lits: entier('f_lits', 40),
      canapes: entier('f_canapes', 20),
      bains: entier('f_bains', 20),
      eau: entier('f_eau', 20),
      surface: entier('f_surface', 2000),
      voyageurs: entier('f_voyageurs', 40),
      sejour_min: entier('f_sejour_min', 365),
      quartier: String(form.get(`f_quartier_${id}`) || '').trim().slice(0, 80),
    });
  }

  revalidatePath('/admin/logements/caracteristiques');
  revalidatePath('/', 'layout');
}

/* ---------- les équipements ----------
   Les clefs viennent d'un catalogue fermé : une valeur qui n'en fait pas
   partie n'entre pas en base. Ce n'est pas de la méfiance envers vous, c'est
   la garantie qu'une fiche n'affichera jamais une ligne sans libellé ni
   traduction. */

function clesCochees(form: FormData, prefixe: string): string[] {
  const out: string[] = [];
  for (const [nom, v] of form.entries()) {
    if (nom !== prefixe || typeof v !== 'string') continue;
    if (estEquipement(v) && !out.includes(v)) out.push(v);
  }
  return out;
}

export async function enregistrerEquipementsAction(form: FormData) {
  await garde();
  const bienId = Number(form.get('bien_id'));
  if (!bienId) return;
  ecrireEquipements(bienId, clesCochees(form, 'eq'));
  revalidatePath(`/admin/logements/${bienId}`);
  revalidatePath('/', 'layout');
}

export async function enregistrerTousEquipementsAction(form: FormData) {
  await garde();

  /* Les logements présents dans le formulaire font foi : un champ caché par
     ligne, pour qu'un logement dont on décoche tout soit bien vidé au lieu
     d'être ignoré faute de case cochée. */
  for (const [nom, v] of form.entries()) {
    if (nom !== 'ligne' || typeof v !== 'string') continue;
    const id = Number(v);
    if (!id) continue;
    ecrireEquipements(id, clesCochees(form, `eq_${id}`));
  }

  revalidatePath('/admin/logements/equipements');
  revalidatePath('/', 'layout');
}

/* ---------- les calendriers iCal ----------
   Une adresse par logement, et c'est celle de Lodgify. Votre gestionnaire de
   canaux reçoit Airbnb, Booking et Vrbo, et vous y saisissez les séjours
   vendus hors plateforme : son calendrier est le seul qui contienne tout.
   Celui d'Airbnb n'ajouterait rien, et s'y fier à sa place serait un recul.

   La provenance ne se demande pas : elle se lit dans l'adresse. C'est ce qui
   permet de signaler qu'une adresse collée de travers n'est pas celle qu'on
   croit, plutôt que de la laisser passer pour le calendrier complet qu'elle
   n'est pas.

   Une adresse inchangée garde son identifiant en base, et donc tout ce qu'on
   avait déjà lu d'elle : corriger une ligne ne doit pas faire oublier les
   réservations des autres. */

export async function enregistrerFluxAction(form: FormData) {
  await garde();

  for (const nom of form.keys()) {
    const m = /^flux_(-?\d+)$/.exec(nom);
    if (!m) continue;
    const id = Number(m[1]);
    if (!id) continue;

    const url = champ(form, nom, 600);
    /* On accepte le webcal: tel quel : c'est ce que le bouton « copier » met
       dans le presse-papier, et le refuser ferait échouer un collage sur deux.
       Il devient https: au moment du téléchargement. */
    const valable = /^(https?|webcal):\/\//i.test(url);
    ecrireFluxDeBien(id, valable ? [{ url, source: sourceDe(url) }] : []);
  }

  revalidatePath('/admin/calendriers');
  revalidatePath('/', 'layout');
}

/** Le bouton maître : tous les calendriers, en un geste. */
export async function importerFluxAction() {
  await garde();
  await importerTous();
  revalidatePath('/admin/calendriers');
  revalidatePath('/', 'layout');
}

/* ---------- reprendre ce qui est saisi ailleurs ----------
   Les mêmes appartements sont déjà décrits dans l'administration de Staytle,
   avec leur identifiant Lodgify et l'adresse de leur calendrier. Les ressaisir
   ici serait vingt-quatre occasions de se tromper d'une ligne - et une adresse
   attribuée au mauvais logement ne se voit pas : elle bloque les mauvaises
   dates, en silence, jusqu'au jour où un voyageur trouve porte close.

   Deux temps, et le premier n'écrit rien. On lit le collage, on montre ce
   qu'on a compris, et l'on n'écrit qu'après votre accord. Un import en un
   clic sur vingt-quatre logements est précisément le genre de geste qu'il
   faut pouvoir regarder avant de le faire. */

export type EtatCollage = { collage?: Collage; ecrites?: number; error?: string } | null;

export async function analyserCollageAction(_prev: EtatCollage, form: FormData): Promise<EtatCollage> {
  await garde();
  const texte = String(form.get('colle') || '').slice(0, 200000);
  if (!texte.trim()) return { error: 'Rien à lire : collez le tableau de Staytle ci-dessus.' };
  const catalogue = (await biens()).map((b) => ({ id: b.id, nom: b.nom, ville: b.ville }));
  return { collage: analyserCollage(texte, catalogue) };
}

export async function appliquerCollageAction(_prev: EtatCollage, form: FormData): Promise<EtatCollage> {
  await garde();
  const texte = String(form.get('colle') || '').slice(0, 200000);
  const catalogue = (await biens()).map((b) => ({ id: b.id, nom: b.nom, ville: b.ville }));
  /* On relit plutôt que de faire confiance à ce que la page nous renvoie :
     entre l'aperçu et la validation, le catalogue a pu changer, et c'est le
     texte collé qui fait foi - pas une liste de correspondances qui aurait
     voyagé par le navigateur. */
  const collage = analyserCollage(texte, catalogue);
  if (!collage.retenues.length) return { collage, error: 'Aucune ligne exploitable : rien n’a été écrit.' };

  for (const l of collage.retenues) {
    if (!l.bienId || !l.url) continue;
    ecrireFluxDeBien(l.bienId, [{ url: l.url, source: sourceDe(l.url) }]);
  }

  revalidatePath('/admin/calendriers');
  revalidatePath('/', 'layout');
  return { collage, ecrites: collage.retenues.length };
}


/* ---------- reposer une base ---------- */

/**
 * Remplace la base par un fichier déposé.
 *
 * Le geste le plus irréversible de cette administration, et il sert deux fois :
 * pour porter en ligne ce qui a été saisi en local, et le jour où un volume se
 * perd. Trois gardes, dans l'ordre où elles coûtent le moins cher :
 * la session, le mot recopié, puis la validité du fichier lui-même.
 */
export async function restaurerAction(form: FormData) {
  await garde();

  /* Un bouton seul se clique par mégarde, et il n'y a rien derrière celui-ci.
     Recopier un mot demande de lire ce qu'on est en train de faire. */
  if (champ(form, 'confirmation', 20).toUpperCase() !== 'REMPLACER') {
    redirect('/admin/sauvegarde?erreur=confirmation');
  }

  const fichier = form.get('fichier');
  if (!(fichier instanceof File) || fichier.size === 0) {
    redirect('/admin/sauvegarde?erreur=fichier');
  }
  /* Cent mégaoctets : très au-delà de ce que cette base atteindra jamais, et
     bien en deçà de ce qui remplirait un volume par accident. */
  if (fichier.size > 100 * 1024 * 1024) {
    redirect('/admin/sauvegarde?erreur=taille');
  }

  const r = restaurer(Buffer.from(await fichier.arrayBuffer()));

  /* Tout revalider : le catalogue, les réglages, les calendriers - tout vient
     de changer d'un coup. */
  revalidatePath('/', 'layout');
  revalidatePath('/admin', 'layout');

  redirect(r.ok ? '/admin/sauvegarde?repose=1' : `/admin/sauvegarde?erreur=${encodeURIComponent(r.detail)}`);
}
