import { getT } from '@/lib/i18n';
import { biens, photosAccroche } from '@/lib/biens';
import { avis } from '@/lib/avis';
import Recherche from '@/components/Recherche';
import Diaporama from '@/components/Diaporama';
import Avis from '@/components/Avis';

export const dynamic = 'force-dynamic';

/**
 * L'accueil, destiné au voyageur.
 *
 * Il suit l'ordre du moteur de réservation, que vos voyageurs connaissent déjà :
 *
 *   1. la photographie, en grand, sans texte par-dessus ;
 *   2. la barre de recherche, à cheval entre l'image et la suite ;
 *   3. le titre et la présentation, avec une photographie de séjour ;
 *   4. les trois services : à quelle heure j'entre, dans quel état je trouve
 *      les lieux, et le linge ;
 *   5. les avis.
 *
 * Et rien après. La vitrine de logements et la porte des propriétaires ont
 * leurs pages : les empiler ici allongeait la page sans rien décider de plus,
 * et l'accueil d'un site de réservation se juge à ce qu'on peut faire dessus,
 * pas à ce qu'on peut y lire.
 */
export default async function Accueil({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getT(locale);
  const tous = await biens();
  const photos = await photosAccroche();
  const lesAvis = await avis(locale, 6);
  const villes = [...new Set(tous.map((b) => b.ville))].sort();

  const services = [
    { t: t('svc_1_t'), p: t('svc_1_p'), i: 'clef' },
    { t: t('svc_2_t'), p: t('svc_2_p'), i: 'menage' },
    { t: t('svc_3_t'), p: t('svc_3_p'), i: 'linge' },
    { t: t('svc_4_t'), p: t('svc_4_p'), i: 'assistance' },
  ];

  return (
    <>
      {/* ---------- l'accroche ----------
          L'image seule. Aucun texte par-dessus : la promesse est dite juste en
          dessous, en pleine lumière, où elle se lit mieux que sur une
          photographie qui change toutes les six secondes.

          Sans photographie - Lodgify injoignable, ou clé absente - l'accroche
          se rétracte au lieu de laisser une bande vide de six cents points :
          la barre de recherche remonte alors sous l'en-tête, ce qui reste une
          page d'accueil valable. */}
      <section className={`accroche accroche-nue${photos.length ? '' : ' accroche-vide'}`}>
        <div className="accroche-fond" aria-hidden="true" />
        <Diaporama photos={photos} alt={t('diaporama_alt')} />
        <div className="wrap accroche-barre">
          <Recherche locale={locale} villes={villes} />
        </div>
      </section>

      {/* ---------- la présentation ----------
          Vos mots, à côté d'une photographie de séjour. Deux colonnes plutôt
          qu'un bloc centré : le texte garde une longueur de ligne lisible, et
          l'image a la place de montrer un intérieur. */}
      <section className="section" id="maison">
        <div className="wrap presentation">
          <div className="presentation-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/accueil-sejour.jpg"
              srcSet="/accueil-sejour-800.jpg 800w, /accueil-sejour.jpg 1600w"
              sizes="(max-width: 900px) 100vw, 52vw"
              alt={t('presentation_photo_alt')}
              width={1600}
              height={1067}
            />
          </div>
          <div className="presentation-texte">
            <hr className="filet-or" />
            <h1>{t('presentation_titre')}</h1>
            <p className="lead">{t('presentation_1')}</p>
            <p className="lead">{t('presentation_2')}</p>
          </div>
        </div>
      </section>

      {/* ---------- les services ----------
          Des icônes tracées à la main, à l'encre. Elles ne décorent pas :
          elles nomment ce qu'un voyageur vérifie avant de préférer un logement
          à une chambre d'hôtel. La quatrième - l'assistance - répond à la
          crainte propre à la location : personne à qui parler si quelque chose
          cloche à vingt-deux heures. */}
      <section className="section-tight services">
        <div className="wrap">
          <hr className="filet-or" />
          <div className="eyebrow" style={{ marginBottom: 40 }}>
            {t('svc_sur')}
          </div>
          <div className="grid4 services-grille">
            {services.map((s) => (
              <article key={s.i} className="service">
                <Icone nom={s.i} />
                <h3>{s.t}</h3>
                <p className="muted small">{s.p}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- les avis ---------- */}
      <Avis liste={lesAvis} locale={locale} />
    </>
  );
}

/**
 * Les pictogrammes, tracés en SVG plutôt qu'en émoji ou en police d'icônes :
 * un trait d'encre d'un point et demi, du même dessin que les filets de la
 * charte, et rien à télécharger.
 */
function Icone({ nom }: { nom: string }) {
  const commun = {
    width: 34,
    height: 34,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: 'service-icone',
  };
  if (nom === 'clef')
    return (
      /* Une clef : l'arrivée autonome, sans réception ni horaire. */
      <svg {...commun}>
        <circle cx="8" cy="8" r="4" />
        <path d="M11 11l9 9" />
        <path d="M17 17l2-2" />
        <path d="M20 20l1.5-1.5" />
      </svg>
    );
  if (nom === 'menage')
    return (
      /* Un flacon et son éclat : le ménage professionnel entre deux séjours. */
      <svg {...commun}>
        <path d="M9 3h4v3H9z" />
        <path d="M8 6h6l1.5 4v10a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V10z" />
        <path d="M7.5 13h7.5" />
        <path d="M19 4l.7 1.8L21.5 6.5 19.7 7.2 19 9l-.7-1.8L16.5 6.5l1.8-.7z" />
      </svg>
    );
  if (nom === 'linge')
    return (
      /* Du linge plié : le standard hôtelier, draps et serviettes. */
      <svg {...commun}>
        <rect x="3" y="6" width="18" height="5" rx="1" />
        <rect x="3" y="13" width="18" height="5" rx="1" />
        <path d="M8 6v5M8 13v5" />
        <path d="M16 6v5M16 13v5" />
      </svg>
    );
  return (
    /* Une bulle et ses trois points : quelqu'un répond. Un combiné aurait dit
       « appelez-nous », ce qui n'est pas la promesse - on écrit plus souvent
       qu'on n'appelle, et à toute heure. */
    <svg {...commun}>
      <path d="M20 4H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3v4l5-4h8a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z" />
      <path d="M8.5 10h.01" />
      <path d="M12 10h.01" />
      <path d="M15.5 10h.01" />
    </svg>
  );
}
