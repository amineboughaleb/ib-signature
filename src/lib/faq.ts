/**
 * Les questions que se pose un propriétaire avant d'écrire.
 *
 * Elles ferment la page qui lui est destinée, et ce n'est pas un remplissage :
 * un propriétaire qui hésite a quatre ou cinq questions en tête - le coût, la
 * durée, l'éligibilité, le délai - et tant qu'elles restent sans réponse, il
 * ne remplit pas le formulaire. Y répondre avant qu'il ne demande, c'est lui
 * épargner un courriel et nous épargner une relance.
 *
 * Aucune de ces réponses n'invente d'engagement. Les quatre premières viennent
 * de vous ; les suivantes ne disent que ce que le site affirme déjà ailleurs -
 * les plateformes de distribution, les prestations comprises dans chaque
 * séjour, l'absence d'engagement à l'audit. Une réponse que je ne pourrais pas
 * fonder n'est pas ici, elle vous attend en question.
 */

export type Question = { q: string; r: string };

export const FAQ: Record<'fr' | 'en', { sur: string; titre: string; questions: Question[] }> = {
  fr: {
    sur: 'Avant de nous contacter',
    titre: 'Questions fréquentes',
    questions: [
      {
        q: 'Combien coûte la gestion IB Signature ?',
        r: 'Notre commission est un pourcentage unique du revenu généré, sans frais cachés. Le taux exact dépend du type de bien et vous est communiqué dès l’audit.',
      },
      {
        q: 'Quelle durée de mandat ?',
        r: 'Nous proposons un mandat d’un an renouvelable, avec des conditions de sortie claires et équilibrées. Aucun engagement piège.',
      },
      {
        q: 'Mon bien est-il éligible ?',
        r: 'Nous gérons des appartements, des studios et des villas à Casablanca et à Marrakech. L’éligibilité est confirmée lors de l’échange de qualification.',
      },
      {
        q: 'Combien de temps avant la première réservation ?',
        r: 'Typiquement sous 21 jours après la signature du mandat et la mise en ligne multi-plateformes.',
      },
      {
        q: 'Sur quelles plateformes mon bien sera-t-il visible ?',
        r: 'Airbnb, Booking.com, Vrbo, Expedia, Agoda et TripAdvisor, ainsi que notre propre moteur de réservation directe. Les calendriers sont synchronisés entre eux : une réservation sur l’un ferme la date partout ailleurs.',
      },
      {
        q: 'Qui s’occupe du ménage et du linge ?',
        r: 'Nous. Chaque séjour comprend un ménage professionnel et du linge de maison de qualité hôtelière. Le voyageur entre en autonomie, à l’heure qui lui convient.',
      },
      {
        q: 'Puis-je occuper mon logement quand je le souhaite ?',
        r: 'Oui. Le bien reste le vôtre et son calendrier aussi : vous bloquez les dates qui vous conviennent, pour vous ou vos proches. Prévenez-nous simplement avant qu’elles ne soient réservées — une date déjà vendue à un voyageur ne peut plus être reprise.',
      },
      {
        q: 'Puis-je suivre l’occupation de mon bien ?',
        r: 'Oui, en temps réel. Chaque propriétaire reçoit un accès à son calendrier depuis notre application : vous voyez les séjours à venir et l’occupation de votre bien au moment où vous vous posez la question, sans avoir à nous écrire.',
      },
      {
        q: 'Quand et comment suis-je payé ?',
        r: 'Le rapport d’activité du mois écoulé vous parvient le 1er du mois suivant, et le versement intervient avant le 5. Un mois, un rapport, un virement : vous savez toujours ce que vous avez gagné et quand vous le recevrez.',
      },
      {
        q: 'L’audit m’engage-t-il à quelque chose ?',
        r: 'Non. L’audit est gratuit et sans engagement : il vous rend une estimation de revenus et un diagnostic de votre bien. Vous restez libre de ne pas donner suite, et nous restons libres de ne pas proposer de mandat — nous sélectionnons nos propriétaires autant qu’ils nous sélectionnent.',
      },
    ],
  },
  en: {
    sur: 'Before you get in touch',
    titre: 'Frequently asked questions',
    questions: [
      {
        q: 'How much does IB Signature management cost?',
        r: 'Our fee is a single percentage of the revenue generated, with no hidden charges. The exact rate depends on the property and is given to you at the audit stage.',
      },
      {
        q: 'How long is the mandate?',
        r: 'A one-year renewable mandate, with clear and balanced exit terms. No hidden commitment.',
      },
      {
        q: 'Is my property eligible?',
        r: 'We manage apartments, studios and villas in Casablanca and Marrakech. Eligibility is confirmed during the qualification call.',
      },
      {
        q: 'How long until the first booking?',
        r: 'Typically within 21 days of signing the mandate and going live across platforms.',
      },
      {
        q: 'Which platforms will my property appear on?',
        r: 'Airbnb, Booking.com, Vrbo, Expedia, Agoda and TripAdvisor, alongside our own direct booking engine. Calendars are synchronised: a booking on one closes the date everywhere else.',
      },
      {
        q: 'Who handles cleaning and linen?',
        r: 'We do. Every stay includes professional cleaning and hotel-quality linen. Guests check themselves in, at a time that suits them.',
      },
      {
        q: 'Can I use my property whenever I want?',
        r: 'Yes. The property is yours and so is its calendar: you block the dates that suit you, for yourself or for family. Just let us know before they are booked — a date already sold to a guest cannot be taken back.',
      },
      {
        q: 'Can I follow how my property is doing?',
        r: 'Yes, in real time. Every owner gets access to their calendar through our app: you can see upcoming stays and current occupancy the moment you wonder about it, without having to write to us.',
      },
      {
        q: 'When and how am I paid?',
        r: 'The activity report for the past month reaches you on the 1st of the following month, and payment is made before the 5th. One month, one report, one transfer: you always know what you earned and when it arrives.',
      },
      {
        q: 'Does the audit commit me to anything?',
        r: 'No. The audit is free and without obligation: it gives you a revenue estimate and an assessment of your property. You remain free to go no further, and so do we — we select our owners as much as they select us.',
      },
    ],
  },
};
