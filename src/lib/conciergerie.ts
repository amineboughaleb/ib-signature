/**
 * Le contenu de conciergerie.ibsignature.com, repris mot pour mot.
 *
 * Le site de conciergerie tient quatre pages : l'accueil, « Notre approche »,
 * « Services » et « Réalisations ». L'accueil alimente déjà la page
 * Propriétaires ; les trois autres alimentent « Qui sommes-nous », dont les
 * sous-menus reprennent exactement ce découpage.
 *
 * Rien n'est reformulé, à une exception que vous avez demandée : « ADR-first,
 * pas occupation-first » devient « Le prix de la nuit d'abord, le remplissage
 * ensuite ». ADR est un sigle de métier - average daily rate, le prix moyen par
 * nuit - et un propriétaire qui doit chercher un sigle a déjà cessé de lire.
 * Partout où ADR apparaissait dans le corps du texte, il est dit en clair.
 *
 * Les photographies sont celles du site actuel, servies depuis Pexels avec
 * leurs adresses d'origine. Le jour où vous aurez les vôtres, c'est ce tableau
 * qu'il faudra changer, et rien d'autre - vos appartements vaudront toujours
 * mieux qu'une banque d'images.
 */

export type Carte = { t: string; p: string; puces?: string[] };
export type Etape = { n: string; t: string; d?: string; p: string };
export type Cas = { lieu: string; type: string; avant: string; apres: string; note: string };
export type Temoin = { nom: string; bien: string; texte: string };

type Bloc = {
  approche_titre: string;
  approche_p: string[];
  principes_sur: string;
  principes_titre: string;
  principes: Carte[];
  methode_sur: string;
  methode_titre: string;
  methode: Etape[];
  engagement_sur: string;
  engagement_p: string;
  engagement_cartes: Carte[];
  services_sur: string;
  services_titre: string;
  services_p: string;
  services: Carte[];
  operateur_titre: string;
  operateur_p: string;
  resultats_sur: string;
  resultats_titre: string;
  resultats_p: string;
  cas_titre: string;
  cas_avant: string;
  cas_apres: string;
  cas_note: string;
  cas: Cas[];
  distribution_sur: string;
  distribution_titre: string;
  plateformes: string[];
  temoins_titre: string;
  temoins: Temoin[];
  cta_titre: string;
  cta_p: string;
  cta_bouton: string;
};

/* Les photographies du site actuel, dans leur ordre d'apparition. */
export const PHOTOS: { url: string; alt: { fr: string; en: string } }[] = [
  {
    url: 'https://images.pexels.com/photos/8082557/pexels-photo-8082557.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800',
    alt: {
      fr: 'Séjour ouvert, table à manger et cuisine contemporaine',
      en: 'Warm open-plan apartment with dining table and contemporary kitchen',
    },
  },
  {
    url: 'https://images.pexels.com/photos/15743383/pexels-photo-15743383.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800',
    alt: {
      fr: 'Chambre claire, bois et lumière naturelle',
      en: 'Bright bedroom with wood accents and soft natural light',
    },
  },
  {
    url: 'https://images.pexels.com/photos/6538905/pexels-photo-6538905.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800',
    alt: {
      fr: 'Pièce contemporaine, mobilier neutre et étagères intégrées',
      en: 'Contemporary room with neutral furniture and built-in shelving',
    },
  },
  {
    url: 'https://images.pexels.com/photos/34951760/pexels-photo-34951760.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800',
    alt: {
      fr: 'Cuisine et salle à manger modernes, éclairage soigné',
      en: 'Modern dining and kitchen interior with elegant lighting',
    },
  },
  {
    url: 'https://images.pexels.com/photos/14374117/pexels-photo-14374117.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800',
    alt: {
      fr: 'Coin repas ensoleillé, détails méditerranéens',
      en: 'Sunlit dining area with warm Mediterranean interior details',
    },
  },
  {
    url: 'https://images.pexels.com/photos/7031607/pexels-photo-7031607.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800',
    alt: {
      fr: 'Cuisine sombre et coin repas, suspensions',
      en: 'Dark modern kitchen and dining space with pendant lighting',
    },
  },
];

const fr: Bloc = {
  approche_titre: 'L’écart entre un Airbnb ordinaire et une expérience IB Signature',
  approche_p: [
    'Au Maroc, la majorité des locations courte durée sous-exploitent leur potentiel. Tarification statique, absence de stratégie de revenue management, qualité d’accueil inégale, photos amateurs, gestion des avis négligée.',
    'Pour un propriétaire, le résultat est mécanique : des revenus en deçà du potentiel réel, une charge mentale permanente, et une dévalorisation progressive du bien faute d’entretien rigoureux.',
    'IB Signature est née d’un constat simple : ce qui distingue une location ordinaire d’une expérience d’exception, ce n’est pas le bien en lui-même, c’est l’opérateur qui le gère.',
  ],

  principes_sur: 'Nos principes',
  principes_titre: 'Trois principes qui guident chacune de nos décisions',
  principes: [
    {
      t: 'L’hôtellerie privée comme standard',
      p: 'Nous appliquons à des appartements privés les exigences d’un hôtel 5 étoiles : linge de qualité hôtelière, propreté irréprochable, accueil personnalisé, réactivité de 2 minutes plutôt que 2 heures. Le voyageur ne loue pas un meublé, il vit une expérience.',
    },
    {
      /* Seule reformulation du document : le sigle ADR disparaît du titre comme
         du corps, remplacé par ce qu'il désigne. */
      t: 'Le prix de la nuit d’abord, le remplissage ensuite',
      p: 'La plupart des conciergeries privilégient le taux d’occupation au détriment du prix moyen par nuit. Chez IB Signature, nous optimisons d’abord la valeur de chaque nuitée grâce à une stratégie de revenue management dynamique pour maximiser la rentabilité réelle du propriétaire.',
    },
    {
      t: 'Transparence absolue',
      p: 'Aucun frais caché. Aucun chiffre invérifiable. Reporting mensuel détaillé. Méthodologie explicitée. Vous signez en connaissance de cause, vous suivez en temps réel, vous gardez le contrôle.',
    },
  ],

  methode_sur: 'La méthode',
  methode_titre: 'De la prise de contact à la signature : une méthode rigoureuse',
  methode: [
    {
      n: '01',
      t: 'Échange et qualification',
      p: 'Nous prenons 30 minutes avec vous pour comprendre votre bien, vos attentes, votre horizon. C’est un échange d’expert à propriétaire, pas un appel commercial.',
    },
    {
      n: '02',
      t: 'Analyse personnalisée',
      p: 'Sous 48 heures, vous recevez un rapport stratégique précis : projection de revenus, scénarios d’occupation, benchmarks marché sourcés, et conditions de gestion adaptées à votre bien.',
    },
    {
      n: '03',
      t: 'Mandat & démarrage',
      p: 'Visite, signature du mandat, mise en ligne multi-plateformes. Vous gardez la main à chaque étape et suivez vos performances en temps réel.',
    },
  ],

  engagement_sur: 'Notre engagement',
  engagement_p:
    'Nous sélectionnons nos propriétaires autant qu’ils nous sélectionnent. Un mandat IB Signature engage les deux parties à construire une relation de plusieurs années, pas à signer un contrat opportuniste.',
  engagement_cartes: [
    {
      t: 'Calibration honnête des attentes',
      p: 'Nous préférons annoncer un taux d’occupation cible correspondant à notre moyenne réelle plutôt qu’un chiffre flatteur que nous ne tiendrions pas.',
    },
    {
      t: 'Conditions contractuelles équilibrées et transparentes',
      p: 'Un mandat clair, sans clause cachée : durée, commission unique, conditions de sortie. Vous savez exactement à quoi vous vous engagez, dès la signature.',
    },
    {
      t: 'Communication régulière',
      p: 'Un reporting mensuel détaillé et un interlocuteur dédié, joignable. Vous suivez vos revenus, votre occupation et l’état de votre bien en continu.',
    },
  ],

  services_sur: 'Nos services',
  services_titre: 'Une gestion complète, de A à Z',
  services_p:
    'De la mise en ligne multi-plateformes à l’accueil des voyageurs, en passant par l’optimisation des revenus et le reporting. Vous ne gérez plus rien, nous nous occupons de tout.',
  services: [
    {
      t: 'Gestion des réservations',
      p: 'Distribution multi-plateformes (Airbnb, Booking.com, Vrbo, Expedia), synchronisation des calendriers en temps réel, filtrage des voyageurs et gestion des confirmations. Zéro double-réservation, zéro nuit perdue.',
      puces: ['Multi-plateformes', 'Calendrier synchronisé', 'Filtrage voyageurs'],
    },
    {
      t: 'Optimisation des revenus',
      p: 'Stratégie de revenue management dynamique via PriceLabs : ajustement quotidien des tarifs selon la demande, la saisonnalité, les événements locaux et la concurrence. Nous protégeons votre prix moyen par nuit avant de maximiser l’occupation.',
      puces: ['PriceLabs', 'Tarification dynamique', 'Le prix de la nuit d’abord'],
    },
    {
      t: 'Accueil & Check-in',
      p: 'Accueil personnalisé de chaque voyageur avec les standards de l’hôtellerie privée : linge hôtelier, kit de bienvenue, présentation du logement, recommandations locales. Check-in et check-out flexibles.',
      puces: ['Accueil personnalisé', 'Linge hôtelier', 'Check-in flexible'],
    },
    {
      t: 'Ménage & Maintenance',
      p: 'Équipe de ménage formée aux standards hôteliers. Interventions entre chaque séjour, contrôle qualité systématique, gestion des petites réparations et coordination des artisans si nécessaire.',
      puces: ['Standards hôteliers', 'Contrôle qualité', 'Maintenance réactive'],
    },
    {
      t: 'Assistance 8 h - 22 h',
      p: 'Support voyageurs disponible de 8 h à 22 h, 7 j/7 par message et téléphone. Résolution des demandes en moins de 2 minutes en moyenne. Vous ne recevez aucun appel, aucune demande.',
      puces: ['8 h - 22 h, 7 j/7', 'Réponse en moins de 2 min', 'Zéro charge mentale'],
    },
    {
      t: 'Reporting propriétaire',
      p: 'Tableau de bord mensuel détaillé : revenus nets, taux d’occupation, prix moyen par nuit, note voyageurs, état du bien. Transparence absolue sur chaque chiffre. Accès en temps réel à vos performances.',
      puces: ['Rapport mensuel', 'Temps réel', 'Transparence totale'],
    },
  ],

  operateur_titre: 'Pas un gestionnaire de plus. Un opérateur d’exception.',
  operateur_p:
    'Nous ne faisons pas que gérer votre bien. Nous le positionnons comme une expérience hôtelière privée, avec une stratégie de prix dynamique et une transparence absolue.',

  resultats_sur: 'Nos résultats',
  resultats_titre: 'Des résultats concrets, pas des promesses',
  resultats_p:
    '24 propriétaires nous font confiance à Casablanca et Marrakech. Découvrez les performances réelles de leurs biens depuis qu’ils sont gérés par IB Signature.',

  cas_titre: 'Avant / après IB Signature',
  cas_avant: 'Avant',
  cas_apres: 'Avec IB Signature',
  cas_note: 'Note voyageurs',
  cas: [
    { lieu: 'Anfa, Casablanca', type: 'Appartement 2 chambres', avant: '4 200 MAD/mois', apres: '12 800 MAD/mois', note: '4,97/5' },
    { lieu: 'Guéliz, Marrakech', type: 'Appartement 3 chambres', avant: '6 500 MAD/mois', apres: '18 200 MAD/mois', note: '4,91/5' },
    { lieu: 'Gauthier, Casablanca', type: 'Studio haut standing', avant: '3 800 MAD/mois', apres: '9 600 MAD/mois', note: '4,95/5' },
  ],

  distribution_sur: 'Visibilité maximale',
  distribution_titre: 'Distribution multi-plateformes',
  plateformes: ['Airbnb', 'Booking.com', 'Vrbo', 'Expedia', 'Agoda', 'TripAdvisor'],

  temoins_titre: 'Ce que disent les propriétaires',
  temoins: [
    {
      nom: 'Karim B.',
      bien: 'Appartement 2 chambres, Anfa, Casablanca',
      texte:
        'En six mois, mes revenus locatifs ont nettement progressé et je n’ai plus rien à gérer. Pour la première fois, je sais exactement où va chaque dirham.',
    },
    {
      nom: 'Sara M.',
      bien: 'Studio, Gauthier, Casablanca',
      texte:
        'L’équipe IB Signature a transformé mon studio en véritable produit hôtelier. Les avis voyageurs sont unanimes et le reporting mensuel est irréprochable.',
    },
    {
      nom: 'Youssef A.',
      bien: 'Appartement 3 chambres, Guéliz, Marrakech',
      texte:
        'Je vivais à l’étranger et la gestion de mon bien à Marrakech était un cauchemar. Aujourd’hui, tout est piloté à distance avec une transparence totale.',
    },
  ],

  cta_titre: 'Vous souhaitez savoir ce que IB Signature peut faire pour votre bien ?',
  cta_p: 'Échange de 30 minutes. Rapport personnalisé sous 24 heures.',
  cta_bouton: 'Obtenir une estimation gratuite',
};

const en: Bloc = {
  approche_titre: 'The gap between an ordinary Airbnb and an IB Signature stay',
  approche_p: [
    'In Morocco, most short-term rentals fall short of their potential. Static pricing, no revenue management strategy, uneven hospitality, amateur photographs, neglected review management.',
    'For an owner the outcome follows mechanically: income below the real potential, a permanent mental load, and a property that loses value for want of rigorous upkeep.',
    'IB Signature was born of a simple observation: what separates an ordinary rental from an exceptional stay is not the property itself, it is the operator who runs it.',
  ],

  principes_sur: 'Our principles',
  principes_titre: 'Three principles behind every decision we make',
  principes: [
    {
      t: 'Private hospitality as the standard',
      p: 'We apply to private apartments the demands of a five-star hotel: hotel-grade linen, impeccable cleanliness, personal welcome, a two-minute response rather than a two-hour one. The traveller is not renting a furnished flat, they are having an experience.',
    },
    {
      t: 'The nightly rate first, occupancy second',
      p: 'Most management companies favour the occupancy rate at the expense of the average price per night. At IB Signature we optimise the value of each night first, through a dynamic revenue management strategy, to maximise the owner’s real profitability.',
    },
    {
      t: 'Absolute transparency',
      p: 'No hidden fees. No unverifiable figures. Detailed monthly reporting. An explicit methodology. You sign knowing what you sign, you follow it in real time, you keep control.',
    },
  ],

  methode_sur: 'The method',
  methode_titre: 'From first contact to signature: a rigorous method',
  methode: [
    {
      n: '01',
      t: 'Conversation and qualification',
      p: 'We take thirty minutes with you to understand your property, your expectations, your horizon. It is a conversation between an expert and an owner, not a sales call.',
    },
    {
      n: '02',
      t: 'Personalised analysis',
      p: 'Within 48 hours you receive a precise strategic report: revenue projection, occupancy scenarios, sourced market benchmarks, and management terms fitted to your property.',
    },
    {
      n: '03',
      t: 'Mandate and start',
      p: 'Visit, signature of the mandate, listing across platforms. You keep the upper hand at every step and follow your performance in real time.',
    },
  ],

  engagement_sur: 'Our commitment',
  engagement_p:
    'We select our owners as much as they select us. An IB Signature mandate commits both sides to building a relationship over several years, not to signing an opportunistic contract.',
  engagement_cartes: [
    {
      t: 'Honest calibration of expectations',
      p: 'We would rather announce a target occupancy matching our real average than a flattering figure we would not hold to.',
    },
    {
      t: 'Balanced, transparent contractual terms',
      p: 'A clear mandate with no hidden clause: term, single commission, exit conditions. You know exactly what you are committing to, from the signature onwards.',
    },
    {
      t: 'Regular communication',
      p: 'Detailed monthly reporting and one dedicated contact you can reach. You follow your income, your occupancy and the condition of your property continuously.',
    },
  ],

  services_sur: 'Our services',
  services_titre: 'Complete management, from A to Z',
  services_p:
    'From multi-platform listing to welcoming travellers, by way of revenue optimisation and reporting. You no longer manage anything, we take care of everything.',
  services: [
    {
      t: 'Booking management',
      p: 'Multi-platform distribution (Airbnb, Booking.com, Vrbo, Expedia), real-time calendar synchronisation, guest screening and confirmation handling. No double bookings, no lost nights.',
      puces: ['Multi-platform', 'Synchronised calendar', 'Guest screening'],
    },
    {
      t: 'Revenue optimisation',
      p: 'Dynamic revenue management through PriceLabs: daily rate adjustment according to demand, seasonality, local events and competition. We protect your average price per night before maximising occupancy.',
      puces: ['PriceLabs', 'Dynamic pricing', 'The nightly rate first'],
    },
    {
      t: 'Welcome and check-in',
      p: 'A personal welcome for every traveller with the standards of private hospitality: hotel linen, welcome kit, tour of the home, local recommendations. Flexible check-in and check-out.',
      puces: ['Personal welcome', 'Hotel linen', 'Flexible check-in'],
    },
    {
      t: 'Cleaning and maintenance',
      p: 'A cleaning team trained to hotel standards. Work between every stay, systematic quality control, small repairs handled and tradespeople coordinated where needed.',
      puces: ['Hotel standards', 'Quality control', 'Responsive maintenance'],
    },
    {
      t: 'Support, 8 am to 10 pm',
      p: 'Traveller support available from 8 am to 10 pm, seven days a week, by message and by phone. Requests resolved in under two minutes on average. You receive no calls and no requests.',
      puces: ['8 am - 10 pm, 7 days', 'Answer in under 2 min', 'No mental load'],
    },
    {
      t: 'Owner reporting',
      p: 'A detailed monthly dashboard: net income, occupancy rate, average price per night, guest rating, condition of the property. Absolute transparency on every figure. Real-time access to your performance.',
      puces: ['Monthly report', 'Real time', 'Total transparency'],
    },
  ],

  operateur_titre: 'Not one more manager. An exceptional operator.',
  operateur_p:
    'We do not merely manage your property. We position it as a private hotel experience, with a dynamic pricing strategy and absolute transparency.',

  resultats_sur: 'Our results',
  resultats_titre: 'Concrete results, not promises',
  resultats_p:
    'Twenty-four owners trust us in Casablanca and Marrakech. See how their properties have really performed since IB Signature took them on.',

  cas_titre: 'Before and after IB Signature',
  cas_avant: 'Before',
  cas_apres: 'With IB Signature',
  cas_note: 'Guest rating',
  cas: [
    { lieu: 'Anfa, Casablanca', type: 'Two-bedroom apartment', avant: '4,200 MAD/month', apres: '12,800 MAD/month', note: '4.97/5' },
    { lieu: 'Guéliz, Marrakech', type: 'Three-bedroom apartment', avant: '6,500 MAD/month', apres: '18,200 MAD/month', note: '4.91/5' },
    { lieu: 'Gauthier, Casablanca', type: 'High-end studio', avant: '3,800 MAD/month', apres: '9,600 MAD/month', note: '4.95/5' },
  ],

  distribution_sur: 'Maximum visibility',
  distribution_titre: 'Multi-platform distribution',
  plateformes: ['Airbnb', 'Booking.com', 'Vrbo', 'Expedia', 'Agoda', 'TripAdvisor'],

  temoins_titre: 'What owners say',
  temoins: [
    {
      nom: 'Karim B.',
      bien: 'Two-bedroom apartment, Anfa, Casablanca',
      texte:
        'In six months my rental income has risen markedly and I have nothing left to manage. For the first time, I know exactly where every dirham goes.',
    },
    {
      nom: 'Sara M.',
      bien: 'Studio, Gauthier, Casablanca',
      texte:
        'The IB Signature team turned my studio into a real hotel product. Guest reviews are unanimous and the monthly reporting is impeccable.',
    },
    {
      nom: 'Youssef A.',
      bien: 'Three-bedroom apartment, Guéliz, Marrakech',
      texte:
        'I was living abroad and managing my Marrakech property was a nightmare. Today everything is steered remotely with total transparency.',
    },
  ],

  cta_titre: 'Would you like to know what IB Signature can do for your property?',
  cta_p: 'A thirty-minute conversation. A personalised report within 24 hours.',
  cta_bouton: 'Get a free estimate',
};

export const conciergerie = (locale: string): Bloc => (locale === 'en' ? en : fr);
