/**
 * Deux langues, aux mêmes adresses à un préfixe près.
 *
 * Le français d'abord : la clientèle d'affaires de Casablanca, les
 * propriétaires marocains et le compte Lodgify actuel sont francophones.
 * L'anglais ensuite, parce qu'un cadre détaché arrive rarement en parlant
 * français, et qu'il cherche en anglais.
 */

export const LOCALES = ['fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const estLocale = (v: unknown): v is Locale => LOCALES.includes(v as Locale);

type Dico = Record<string, string>;

const fr: Dico = {
  nav_appartements: 'Nos logements',
  nav_proprietaires: 'Propriétaires',
  nav_contact: 'Contact',

  diaporama_alt: 'Un logement IB Signature',

  /* La voix de la maison, telle qu'elle se présente elle-même. Ce paragraphe
     n'est pas de la rédaction publicitaire : c'est ce que dit le fondateur, et
     c'est précisément ce qui le rend crédible. On n'y touche pas. */

  rech_ville: 'Ville',
  rech_arrivee: 'Arrivée',
  rech_depart: 'Départ',
  rech_voyageurs: 'Voyageurs',
  rech_chercher: 'Voir les disponibilités',
  rech_toutes: 'Toutes',



  biens_tous: 'Tous nos logements',
  bien_voir: 'Tarifs et disponibilités',
  bien_apd: 'À partir de',
  bien_nuit: '/ nuit',
  bien_total: 'Séjour de {n} nuit(s)',

  chiffre_1: 'propriétaires nous font confiance',
  chiffre_2: 'de note moyenne Airbnb voyageurs',
  chiffre_3: 'de support, sept jours sur sept',
  chiffre_4: 'villes, Casablanca et Marrakech',

  prop_sur: 'Vous possédez un bien',
  prop_cta: 'Demander un audit gratuit',

  pied_droits: 'Tous droits réservés.',
  pied_maison: 'IB Signature est une marque de Partners Hotels SARL AU, Casablanca.',
  pied_cgv: 'Conditions générales de vente',
  pied_mentions: 'Mentions légales',
  pied_confidentialite: 'Confidentialité',

  /* --- liste --- */
  liste_titre: 'Nos logements',
  liste_texte: 'Casablanca et Marrakech. Chaque logement est tenu par nos équipes, jamais sous-traité.',
  liste_capacite_inconnue:
    'La capacité d’accueil de certains logements n’est pas encore publiée : ils restent affichés, à vérifier sur leur fiche.',
  fiche_minimum: 'Séjour minimum sur cette période : {min} nuits.',
  fiche_trop_court:
    'Ce logement demande au moins {min} nuits sur cette période. Votre séjour est plus court : allongez-le d’une nuit ou deux, ou choisissez un autre logement.',
  liste_resultats: '{n} logement(s)',
  liste_resultats_libres: '{n} logement(s) disponible(s)',
  liste_aucun: 'Aucun logement ne correspond à cette recherche. Élargissez la ville ou le nombre de voyageurs.',
  liste_aucun_libre:
    'Aucun logement n’est disponible sur ces dates. Essayez une autre période, ou élargissez la ville.',
  liste_sejour_minimum:
    '{n} logement(s) écarté(s) : ils demandent au moins {min} nuits sur cette période.',
  liste_aucun_sejour:
    'Aucun logement n’accepte un séjour aussi court sur ces dates. Le plus souple en demande {min}. Essayez une période un peu plus longue.',
  rech_ajouter_date: 'Choisir',
  rech_effacer_dates: 'Effacer les dates',
  liste_dispo_inconnue: 'Les disponibilités n’ont pas pu être vérifiées à l’instant : elles seront confirmées à l’étape de réservation.',
  liste_dispo_partielle: 'La disponibilité de {n} logement(s) reste à confirmer : elle le sera à l’étape de réservation. Les autres sont bien libres sur ces dates.',
  liste_effacer: 'Effacer les filtres',
  liste_nuits: '{n} nuit(s)',
  liste_degrade: 'Les tarifs et les disponibilités s’affichent dès que la connexion au moteur de réservation est établie.',

  /* --- fiche --- */
  fiche_retour: 'Tous nos logements',
  fiche_reserver: 'Réserver ce logement',
  fiche_reserver_dates: 'Réserver du {a} au {d}',
  fiche_ou: 'Le paiement et la confirmation se font sur notre moteur de réservation.',
  fiche_ou_deux: 'Deux moyens de paiement : carte bancaire, ou virement sans supplément.',
  fiche_choisir_dates: 'Choisissez vos dates pour voir le prix et la disponibilité.',
  fiche_pris: 'Ce logement est déjà réservé du {a} au {d}. Choisissez d’autres dates.',
  fiche_autres_dates: 'Voir les logements disponibles',
  fiche_presentation_titre: 'Le logement',
  fait_voyageur: '{n} voyageur',
  fait_voyageurs: '{n} voyageurs',
  fait_chambre: '{n} chambre',
  fait_chambres: '{n} chambres',
  fait_lit: '{n} lit',
  fait_lits: '{n} lits',
  fait_canape: '{n} canapé-lit',
  fait_canapes: '{n} canapés-lits',
  fait_bain: '{n} salle de bain',
  fait_bains: '{n} salles de bain',
  fait_eau: '{n} salle d’eau / WC',
  fait_eaux: '{n} salles d’eau / WC',
  fait_minimum: 'Min. {n} nuits',
  fiche_equipements_titre: 'Les équipements',
  fiche_quartier_titre: 'Le quartier',
  carte_titre: 'Emplacement',
  carte_rayon: 'Dans un rayon de {n} m',
  carte_note: 'L’adresse exacte vous est communiquée à la confirmation de votre réservation.',
  carte_ouvrir: 'Ouvrir la carte',
  carte_molette: 'Cliquez sur la carte pour zoomer à la molette',
  fiche_compris_titre: 'Compris dans chaque séjour',
  fiche_horaires: 'Arrivée à partir de {a} · Départ avant {d}',
  fiche_c1: 'Ménage professionnel et blanchisserie avant votre arrivée',
  fiche_c2: 'Draps et linge de toilette fournis',
  fiche_c3: 'Wi-Fi haut débit et espace de travail',
  fiche_c4: 'Cuisine entièrement équipée',
  fiche_c5: 'Arrivée autonome à partir de {a}, à toute heure de la nuit',
  fiche_c6: 'Contact local joignable 7 j/7',
  fiche_autres: 'Nos autres adresses',

  /* --- propriétaires ---
     Le contenu vient de conciergerie.ibsignature.com, repris tel qu'il est
     écrit. Ce n'est pas de la rédaction à refaire : « ADR-first, pas
     occupation-first » est un positionnement, pas une formule, et il dit en
     quatre mots ce qui distingue la maison d'un gestionnaire ordinaire. */
  po_sur: 'Propriétaires',
  po_titre: 'Confiez votre bien à IB Signature',
  po_texte:
    'Hôtellerie privée, le prix de la nuit d’abord, transparence absolue. 24 propriétaires nous font déjà confiance à Casablanca et Marrakech pour valoriser leurs biens en courte et moyenne durée.',
  po_rassurance: 'Réponse sous 48h · Sans engagement · 100% gratuit',
  po_pb_titre: 'Si vous êtes propriétaire, vous le savez déjà…',
  po_nous_titre: 'Trois principes qui font la différence',
  po_parcours_titre: 'De votre demande à votre première réservation',
  po_parcours_p: 'Voici exactement comment nous travaillons - à chaque étape, vous savez ce qui se passe.',
  po_audit_sur: 'Audit gratuit & personnalisé',
  po_audit_titre: 'Prêt à valoriser votre bien à son juste potentiel ?',
  po_audit_p: 'Recevez votre audit gratuit et personnalisé. Aucun engagement, aucun frais.',
  po_audit_pied: 'Réponse sous 48h · Vos données restent strictement confidentielles.',
  po_cta: 'Demander mon audit gratuit',

  po_pb_sur: 'Le constat',
  po_pb1_t: 'Votre bien est sous-loué, sans savoir pourquoi',
  po_pb1_p:
    'Tarification figée, photos amateurs, gestion de réservations approximative. Les biens sous-exploités au Maroc plafonnent à 30-35% d’occupation alors que le marché en permet bien davantage.',
  po_pb2_t: 'Aucune visibilité claire sur ce que vous touchez',
  po_pb2_p:
    'Frais cachés, méthodologie opaque, reporting irrégulier. Vous signez et vous attendez que ça se passe bien, sans jamais vraiment savoir où va l’argent.',
  po_pb3_t: 'La gestion vous prend un temps précieux',
  po_pb3_p:
    'Demandes voyageurs à toute heure, problèmes de ménage, conflits d’avis, coordination des prestataires. Une charge mentale permanente pour des résultats incertains.',

  po_nous_sur: 'La différence IB Signature',
  po_n1_t: 'L’hôtellerie privée comme standard',
  po_n1_p:
    'Nous appliquons à des appartements privés les exigences d’un hôtel 5 étoiles : linge hôtelier, propreté irréprochable, accueil personnalisé, réactivité de 2 minutes plutôt que 2 heures.',
  /* Seule reformulation demandée : ADR est un sigle de métier, et un
     propriétaire qui doit le chercher a déjà cessé de lire. */
  po_n2_t: 'Le prix de la nuit d’abord, le remplissage ensuite',
  po_n2_p:
    'Nous protégeons d’abord la valeur de chaque nuitée par une stratégie de revenue management dynamique (PriceLabs), avant de jouer sur le volume. Votre marge nette est optimisée - pas une simple statistique d’occupation flatteuse.',
  po_n3_t: 'Transparence absolue',
  po_n3_p:
    'Aucun frais caché. Aucun chiffre invérifiable. Reporting mensuel détaillé, méthodologie explicite. Vous signez en connaissance de cause, vous suivez en temps réel, vous gardez le contrôle.',

  po_parcours_sur: 'Un processus clair, sans engagement',
  po_e1: 'Vous remplissez le formulaire',
  po_e1_d: '1 minute',
  po_e1_p: 'Vous nous indiquez les informations essentielles sur votre bien et vos coordonnées WhatsApp.',
  po_e2: 'Échange de qualification',
  po_e2_d: '30 min · sous 48h',
  po_e2_p: 'Amine, fondateur d’IB Signature, vous appelle pour comprendre votre bien, vos attentes et votre horizon.',
  po_e3: 'Votre rapport personnalisé',
  po_e3_d: 'sous 24h après l’appel',
  po_e3_p: 'Projection de revenus, scénarios d’occupation, benchmarks marché sourcés et conditions de gestion adaptées à votre bien.',
  po_e4: 'Visite, mandat & démarrage',
  po_e4_d: 'si projet validé',
  po_e4_p: 'Visite, signature du mandat, shooting photo professionnel, mise en ligne multi-plateformes. Première réservation typiquement sous 21 jours.',

  po_form_titre: 'Demander un audit gratuit',
  po_form_texte: 'Sans engagement. Nous vous rappelons sous 48 heures.',
  po_nom: 'Nom et prénom',
  po_email: 'Courriel',
  po_tel: 'Téléphone ou WhatsApp',
  po_ville: 'Où se trouve le bien',
  po_type: 'Type de bien',
  po_message: 'Ce que vous voulez nous dire',
  po_envoyer: 'Envoyer ma demande',
  po_merci: 'Votre demande est bien arrivée. Nous vous rappelons sous 48 heures.',
  po_erreur: 'Un champ manque, ou l’adresse est mal formée.',

  /* --- navigation refondue ---
     Cinq entrées, dans l'ordre où un visiteur se pose ses questions : où
     j'atterris, ce que vous avez, qui vous êtes, et - pour l'autre visiteur -
     ce que vous faites pour un propriétaire. « La maison » ne voulait rien
     dire ; « Qui sommes-nous » se comprend sans y réfléchir. */
  nav_accueil: 'Accueil',
  nav_qui: 'Qui sommes-nous',
  nav_contact_page: 'Contactez-nous',

  /* --- accueil : le bloc de presentation --- */
  presentation_titre: 'IB Signature - Votre meilleure alternative aux chambres d’hôtel',
  presentation_photo_alt: 'Un séjour dans un appartement IB Signature',
  presentation_1:
    'Nos logements sont de véritables alternatives aux chambres d’hôtel. Vous y trouverez un confort 5*, avec davantage de commodités et plus d’espace.',
  presentation_2:
    'Étant nous-mêmes des voyageurs exigeants, nous mettons tout en œuvre pour vous offrir un séjour sans accroc. Situés au cœur de la ville, les appartements IB Signature allient harmonieusement confort, charme et élégance.',

  /* --- accueil : les trois services --- */
  svc_sur: 'Compris dans chaque séjour',
  svc_1_t: 'Check-in autonome',
  svc_1_p: 'Vous entrez à l’heure de votre vol, pas à celle d’une réception.',
  svc_2_t: 'Ménage professionnel',
  svc_2_p: 'Le logement est remis à neuf avant vous, pas rangé après le précédent.',
  svc_3_t: 'Linge de maison qualité hôtelière',
  svc_3_p: 'Draps et linge de toilette d’hôtel, changés à chaque séjour.',

  /* --- accueil : les avis --- */
  avis_sur: 'Ils y ont dormi',
  avis_titre: 'Ce que les voyageurs disent',
  avis_texte:
    'Des commentaires laissés après le séjour, publiés tels quels. Chacun porte sur un logement précis.',
  avis_source: 'Avis déposés par des voyageurs sur les plateformes où nos logements sont commercialisés.',
  avis_plus: 'Lire la suite',
  avis_moins: 'Réduire',
  avis_a_propos: 'À propos de',

  /* --- qui sommes-nous --- */
  qs_sur: 'Notre approche',
  qs_menu: 'Sur cette page',

  /* --- contact --- */
  ct_sur: 'Nous joindre',
  ct_titre: 'Contactez-nous',
  ct_texte:
    'Une question sur un logement, une demande de séjour long, une facture : écrivez-nous, ou appelez. Nous répondons de huit heures à vingt-deux heures, sept jours sur sept.',
  ct_tel: 'Téléphone et WhatsApp',
  ct_courriel: 'Courriel',
  ct_adresse: 'Adresse',
  ct_horaires: 'Horaires',
  ct_horaires_v: '8 h - 22 h, sept jours sur sept',
  ct_form_titre: 'Nous écrire',
  ct_form_texte: 'Nous répondons le jour même, dans nos horaires.',
  ct_sujet: 'Sujet',
  ct_sujet_sejour: 'Une réservation ou un séjour',
  ct_sujet_bien: 'Un logement en particulier',
  ct_sujet_long: 'Un séjour de plusieurs mois',
  ct_sujet_autre: 'Autre chose',
  ct_envoyer: 'Envoyer le message',
  ct_merci: 'Votre message est bien arrivé. Nous vous répondons dans la journée.',
  ct_erreur: 'Un champ manque, ou l’adresse est mal formée.',
  ct_reserver: 'Pour réserver, passez plutôt par la page du logement : le calendrier et le tarif y sont à jour.',

  /* --- l'étape de paiement --- */
  res_titre: 'Comment souhaitez-vous régler ?',
  res_carte_bouton: 'Payer par carte',
  res_virement_eco: 'Vous économisez {m}',
  res_virement_texte: 'Le montant est celui du séjour, sans aucun supplément. Vous recevez nos coordonnées bancaires immédiatement, et nous fermons le calendrier sur vos dates pendant {h} heures.',
  res_virement_bouton: 'Réserver par virement',
  res_ttc: 'Taxes et frais compris',
  res_mad: 'environ {m} MAD',
  res_mad_note: 'Contre-valeur indicative, au taux du {date}. Seul le montant en {d} engage.',
  res_email: 'Adresse électronique',
  res_tel: 'Téléphone',
  res_message: 'Une précision sur votre séjour ?',
  res_frais: 'Les frais bancaires éventuels restent à la charge de l’émetteur : virez le montant exact indiqué ci-dessus.',
  res_merci_titre: 'Votre demande est enregistrée',
  res_merci_texte: 'Effectuez votre virement sous {v} heures. Nous fermons le calendrier sur vos dates pendant {h} heures : sans virement constaté d’ici là, elles repartent à la vente.',
  res_merci_h1: 'Votre demande de réservation',
  res_carte_h1: 'Vers le paiement par carte',
  res_ref: 'Votre référence',
  res_ref_note: 'Portez-la sur votre ordre de virement : c’est elle qui rattache le paiement à votre séjour.',
  res_erreur: 'Il manque un champ, ou l’adresse électronique est mal formée.',
  res_perime: 'Cette demande n’est plus valable. Reprenez depuis la page du logement.',
  res_retour: 'Revenir au logement',
  res_seule_carte: 'Pour ces dates, seul le paiement par carte est possible.',
  res_recap: 'Votre séjour',

  res_vous_titre: 'Vos coordonnées',
  res_vous_texte: 'Elles servent à établir votre réservation et, à votre arrivée, la fiche que la loi nous impose de tenir.',
  res_prenom: 'Prénom',
  res_nom_famille: 'Nom',
  res_nationalite: 'Nationalité',
  res_residence: 'Pays ou ville de résidence',
  res_resume_titre: 'Votre séjour',
  res_total: 'Total du séjour',
  res_total_inconnu: 'Le montant vous est confirmé avec notre réponse.',
  res_paiement_titre: 'Le règlement',
  res_cgv_avant: 'J’ai lu et j’accepte les ',
  res_cgv_lien: 'conditions générales de vente',
  res_cgv_apres: ', dont les conditions d’annulation.',
  res_cgv_erreur: 'Merci d’accepter les conditions générales de vente avant de poursuivre.',
  res_carte_route_titre: 'Nous vous conduisons au paiement',
  res_carte_route_texte:
    'Vos coordonnées sont enregistrées. Notre moteur de réservation prend le relais pour le paiement par carte : vos dates y sont déjà saisies.',
  res_carte_route_lien: 'Continuer maintenant',

};

const en: Dico = {
  nav_appartements: 'Our homes',
  nav_proprietaires: 'Owners',
  nav_contact: 'Contact',

  diaporama_alt: 'An IB Signature home',


  rech_ville: 'City',
  rech_arrivee: 'Check-in',
  rech_depart: 'Check-out',
  rech_voyageurs: 'Guests',
  rech_chercher: 'See availability',
  rech_toutes: 'All',



  biens_tous: 'All our homes',
  bien_voir: 'Rates and availability',
  bien_apd: 'From',
  bien_nuit: '/ night',
  bien_total: '{n}-night stay',

  chiffre_1: 'owners already trust us',
  chiffre_2: 'average guest rating on Airbnb',
  chiffre_3: 'of support, seven days a week',
  chiffre_4: 'cities, Casablanca and Marrakech',

  prop_sur: 'You own an apartment',
  prop_cta: 'Request a free audit',

  pied_droits: 'All rights reserved.',
  pied_maison: 'IB Signature is a brand of Partners Hotels SARL AU, Casablanca.',
  pied_cgv: 'Terms of sale',
  pied_mentions: 'Legal notice',
  pied_confidentialite: 'Privacy',

  liste_titre: 'Our homes',
  liste_texte: 'Casablanca and Marrakech. Every home is run by our own teams, never subcontracted.',
  liste_capacite_inconnue:
    'The capacity of some homes is not published yet: they stay listed, check their page.',
  fiche_minimum: 'Minimum stay over this period: {min} nights.',
  fiche_trop_court:
    'This home requires at least {min} nights over this period. Your stay is shorter: extend it by a night or two, or choose another home.',
  liste_resultats: '{n} home(s)',
  liste_resultats_libres: '{n} home(s) available',
  liste_aucun: 'No home matches this search. Try another city or a different number of guests.',
  liste_aucun_libre: 'No home is available on these dates. Try another period, or widen the city.',
  liste_sejour_minimum: '{n} home(s) set aside: they require at least {min} nights over this period.',
  liste_aucun_sejour:
    'No home accepts a stay this short on these dates. The most flexible one requires {min}. Try a slightly longer period.',
  rech_ajouter_date: 'Choose',
  rech_effacer_dates: 'Clear dates',
  liste_dispo_inconnue: 'Availability could not be checked just now: it will be confirmed at the booking step.',
  liste_dispo_partielle: 'Availability for {n} home(s) is still to be confirmed, and will be at the booking step. The others are free on these dates.',
  liste_effacer: 'Clear filters',
  liste_nuits: '{n} night(s)',
  liste_degrade: 'Rates and availability appear as soon as the connection to the booking engine is established.',

  fiche_retour: 'All our homes',
  fiche_reserver: 'Book this home',
  fiche_reserver_dates: 'Book from {a} to {d}',
  fiche_ou: 'Payment and confirmation take place on our booking engine.',
  fiche_ou_deux: 'Two ways to pay: credit card, or bank transfer with nothing added.',
  fiche_choisir_dates: 'Pick your dates to see the price and availability.',
  fiche_pris: 'This home is already booked from {a} to {d}. Please choose other dates.',
  fiche_autres_dates: 'See available homes',
  fiche_presentation_titre: 'The property',
  fait_voyageur: '{n} guest',
  fait_voyageurs: '{n} guests',
  fait_chambre: '{n} bedroom',
  fait_chambres: '{n} bedrooms',
  fait_lit: '{n} bed',
  fait_lits: '{n} beds',
  fait_canape: '{n} sofa bed',
  fait_canapes: '{n} sofa beds',
  fait_bain: '{n} bathroom',
  fait_bains: '{n} bathrooms',
  fait_eau: '{n} shower room / WC',
  fait_eaux: '{n} shower rooms / WC',
  fait_minimum: 'Min. {n} nights',
  fiche_equipements_titre: 'Amenities',
  fiche_quartier_titre: 'The neighbourhood',
  carte_titre: 'Location',
  carte_rayon: 'Within {n} m',
  carte_note: 'The exact address is sent to you once your booking is confirmed.',
  carte_ouvrir: 'Open the map',
  carte_molette: 'Click the map to zoom with the wheel',
  fiche_compris_titre: 'Included in every stay',
  fiche_horaires: 'Check-in from {a} · Check-out before {d}',
  fiche_c1: 'Professional cleaning and laundry before you arrive',
  fiche_c2: 'Bed linen and towels provided',
  fiche_c3: 'Fast Wi-Fi and a place to work',
  fiche_c4: 'Fully equipped kitchen',
  fiche_c5: 'Self check-in from {a}, at any hour of the night',
  fiche_c6: 'A local contact, seven days a week',
  fiche_autres: 'Our other addresses',

  po_sur: 'Owners',
  po_titre: 'Entrust your property to IB Signature',
  po_texte:
    'Private hospitality, the nightly rate first, absolute transparency. Twenty-four owners already trust us in Casablanca and Marrakech to make the most of their properties, short and medium term.',
  po_rassurance: 'Answer within 48h · No obligation · 100% free',
  po_pb_titre: 'If you own a property, you already know this…',
  po_nous_titre: 'Three principles that make the difference',
  po_parcours_titre: 'From your request to your first booking',
  po_parcours_p: 'This is exactly how we work - at every step, you know what is happening.',
  po_audit_sur: 'Free, personalised audit',
  po_audit_titre: 'Ready to bring your property to its true potential?',
  po_audit_p: 'Receive your free, personalised audit. No obligation, no fee.',
  po_audit_pied: 'Answer within 48h · Your data stays strictly confidential.',
  po_cta: 'Request my free audit',

  po_pb_sur: 'What we see',
  po_pb1_t: 'Your property under-earns, and you do not know why',
  po_pb1_p:
    'Frozen pricing, amateur photographs, loose booking management. Under-exploited properties in Morocco plateau at 30 to 35 % occupancy, where the market allows a great deal more.',
  po_pb2_t: 'No clear view of what you actually receive',
  po_pb2_p:
    'Hidden fees, opaque method, irregular reporting. You sign, then you hope it goes well, without ever really knowing where the money goes.',
  po_pb3_t: 'Managing it takes time you do not have',
  po_pb3_p:
    'Guest requests at all hours, cleaning problems, disputes over reviews, coordinating tradespeople. A permanent mental load, for uncertain results.',

  po_nous_sur: 'The IB Signature difference',
  po_n1_t: 'Private hospitality as the standard',
  po_n1_p:
    'We hold private flats to the standards of a five-star hotel: hotel linen, faultless cleanliness, a personal welcome, a two-minute response rather than two hours.',
  po_n2_t: 'The nightly rate first, occupancy second',
  po_n2_p:
    'We protect the value of each night through dynamic revenue management before playing on volume. What is optimised is your net margin, not a flattering occupancy figure.',
  po_n3_t: 'Absolute transparency',
  po_n3_p:
    'No hidden fee. No unverifiable figure. A detailed monthly report, an explicit method. You sign knowing what you sign, you follow in real time, you keep control.',

  po_parcours_sur: 'How it starts',
  po_e1: 'You fill in the form',
  po_e1_d: '1 minute',
  po_e1_p: 'Five fields. Nothing that sends you looking for a document.',
  po_e2: 'A qualification call with Amine',
  po_e2_d: '30 minutes, within 48 h',
  po_e2_p: 'A conversation with the founder, not a call centre.',
  po_e3: 'Your personalised report',
  po_e3_d: 'within 24 h of the call',
  po_e3_p: 'A revenue estimate on your own property, costed, free and without obligation.',
  po_e4: 'Visit, mandate and launch',
  po_e4_d: 'if the project goes ahead',
  po_e4_p: 'Photography, listings, calendar, first booking.',

  po_form_titre: 'Request a free audit',
  po_form_texte: 'No obligation. We call you back within 48 hours.',
  po_nom: 'Full name',
  po_email: 'Email',
  po_tel: 'Phone or WhatsApp',
  po_ville: 'Where the property is',
  po_type: 'Type of property',
  po_message: 'Anything you want to tell us',
  po_envoyer: 'Send my request',
  po_merci: 'Your request has arrived. We will call you back within 48 hours.',
  po_erreur: 'A field is missing, or the address is malformed.',

  nav_accueil: 'Home',
  nav_qui: 'About us',
  nav_contact_page: 'Contact us',

  presentation_titre: 'IB Signature - Your better alternative to a hotel room',
  presentation_photo_alt: 'A stay in an IB Signature home',
  presentation_1:
    'Our homes are true alternatives to hotel rooms. You will find five-star comfort there, with more amenities and more space.',
  presentation_2:
    'Demanding travellers ourselves, we do everything we can to give you a stay without a hitch. Set in the heart of the city, IB Signature apartments bring together comfort, charm and elegance.',

  svc_sur: 'Included in every stay',
  svc_1_t: 'Self check-in',
  svc_1_p: 'You come in at your flight’s hour, not a front desk’s.',
  svc_2_t: 'Professional cleaning',
  svc_2_p: 'The flat is made new before you arrive, not tidied after the last guest.',
  svc_3_t: 'Hotel-grade linen',
  svc_3_p: 'Hotel sheets and towels, changed for every stay.',

  avis_sur: 'They slept there',
  avis_titre: 'What travellers say',
  avis_texte: 'Comments left after the stay, published as written. Each one is about a specific apartment.',
  avis_source: 'Reviews left by travellers on the platforms where our homes are listed.',
  avis_plus: 'Read more',
  avis_moins: 'Show less',
  avis_a_propos: 'About',

  qs_sur: 'Our approach',
  qs_menu: 'On this page',

  ct_sur: 'Reach us',
  ct_titre: 'Contact us',
  ct_texte:
    'A question about an apartment, a request for a long stay, an invoice: write to us, or call. We answer from eight in the morning to ten at night, seven days a week.',
  ct_tel: 'Phone and WhatsApp',
  ct_courriel: 'Email',
  ct_adresse: 'Address',
  ct_horaires: 'Hours',
  ct_horaires_v: '8 am - 10 pm, seven days a week',
  ct_form_titre: 'Write to us',
  ct_form_texte: 'We answer the same day, within our hours.',
  ct_sujet: 'Subject',
  ct_sujet_sejour: 'A booking or a stay',
  ct_sujet_bien: 'One home in particular',
  ct_sujet_long: 'A stay of several months',
  ct_sujet_autre: 'Something else',
  ct_envoyer: 'Send the message',
  ct_merci: 'Your message has arrived. We will answer you today.',
  ct_erreur: 'A field is missing, or the address is malformed.',
  ct_reserver: 'To book, go through the apartment’s page instead: the calendar and the rate are up to date there.',

  /* --- the payment step --- */
  res_titre: 'How would you like to pay?',
  res_carte_bouton: 'Pay by card',
  res_virement_eco: 'You save {m}',
  res_virement_texte: 'The amount is the price of the stay, with nothing added. You get our bank details straight away, and we close the calendar on your dates for {h} hours.',
  res_virement_bouton: 'Book by bank transfer',
  res_ttc: 'Taxes and fees included',
  res_mad: 'about {m} MAD',
  res_mad_note: 'Indicative equivalent, at the rate of {date}. Only the amount in {d} is binding.',
  res_email: 'Email address',
  res_tel: 'Telephone',
  res_message: 'Anything we should know about your stay?',
  res_frais: 'Any bank charges remain with the sender: please transfer exactly the amount shown above.',
  res_merci_titre: 'Your request has been recorded',
  res_merci_texte: 'Please make your transfer within {v} hours. We close the calendar on your dates for {h} hours: without a transfer received by then, they go back on sale.',
  res_merci_h1: 'Your booking request',
  res_carte_h1: 'On to card payment',
  res_ref: 'Your reference',
  res_ref_note: 'Quote it on your transfer order: it is what ties the payment to your stay.',
  res_erreur: 'A field is missing, or the email address is malformed.',
  res_perime: 'This request is no longer valid. Please start again from the apartment’s page.',
  res_retour: 'Back to the apartment',
  res_seule_carte: 'For these dates, only card payment is available.',
  res_recap: 'Your stay',

  res_vous_titre: 'Your details',
  res_vous_texte: 'We use these to set up your booking and, on arrival, the guest record Moroccan law requires us to keep.',
  res_prenom: 'First name',
  res_nom_famille: 'Last name',
  res_nationalite: 'Nationality',
  res_residence: 'Country or city of residence',
  res_resume_titre: 'Your stay',
  res_total: 'Total for the stay',
  res_total_inconnu: 'We confirm the amount with our reply.',
  res_paiement_titre: 'Payment',
  res_cgv_avant: 'I have read and accept the ',
  res_cgv_lien: 'terms of sale',
  res_cgv_apres: ', including the cancellation policy.',
  res_cgv_erreur: 'Please accept the terms of sale before continuing.',
  res_carte_route_titre: 'Taking you to payment',
  res_carte_route_texte:
    'Your details are saved. Our booking engine takes over for card payment, with your dates already filled in.',
  res_carte_route_lien: 'Continue now',

};

const DICOS: Record<Locale, Dico> = { fr, en };

export function getT(locale: string) {
  const d = DICOS[estLocale(locale) ? locale : 'fr'];
  return (clef: string, vars?: Record<string, string | number>) => {
    let s = d[clef] ?? fr[clef] ?? clef;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}
