import dynamique from 'next/dynamic';
import Link from 'next/link';
import { getT } from '@/lib/i18n';

/* Leaflet touche au document dès son chargement : il ne peut pas être rendu sur
   le serveur, et l'y forcer casserait la page entière plutôt que la seule
   carte. */
const CarteVue = dynamique(() => import('./CarteVue'));

/**
 * L'emplacement d'un logement.
 *
 * Un cercle de deux cent cinquante mètres, jamais une épingle. Le voyageur veut
 * savoir dans quel quartier il dormira, à quelle distance de la corniche ou du
 * bureau où il se rend ; il n'a pas besoin de la porte, et le propriétaire n'a
 * pas envie qu'elle soit publique - un logement dont l'adresse exacte circule
 * est un logement qu'on repère quand il est vide.
 *
 * Sans coordonnées, on n'affiche pas une carte pointée au hasard : le quartier
 * en toutes lettres dit déjà quelque chose de vrai, ce qu'une carte centrée sur
 * un centre-ville par défaut ne ferait pas.
 */
export default function Carte({
  lat,
  lng,
  quartier,
  ville,
  locale,
  rayonM = 250,
  rayonPlancherM = 120,
  liens,
}: {
  lat?: number;
  lng?: number;
  quartier?: string;
  ville?: string;
  locale: string;
  rayonM?: number;
  rayonPlancherM?: number;
  /* Les pages quartier et ville du logement, quand elles sont publiées : le
     nom devient alors un lien vers tous les appartements du même quartier. */
  liens?: { quartier?: string; ville?: string };
}) {
  const t = getT(locale);
  const lieu = [quartier, ville].filter(Boolean).join(', ');
  const nom = (texte: string | undefined, h: string | undefined) =>
    texte && h ? (
      <Link href={h} className="lien">
        {texte}
      </Link>
    ) : (
      texte
    );
  const lieuAffiche =
    liens?.quartier || liens?.ville ? (
      <>
        {nom(quartier, liens.quartier)}
        {quartier && ville ? ', ' : ''}
        {nom(ville, liens.ville)}
      </>
    ) : (
      lieu
    );

  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return lieu ? <p className="lead">{lieuAffiche}</p> : null;
  }

  const r = Math.max(80, Math.min(3000, Number(rayonM) || 250));
  const plancher = Math.max(40, Math.min(r, Number(rayonPlancherM) || 120));
  const complet = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`;

  return (
    <div className="carte-bloc">
      {lieu && <p className="lead" style={{ marginBottom: 16 }}>{lieuAffiche}</p>}
      <div className="carte">
        <CarteVue
          lat={lat}
          lng={lng}
          rayonM={r}
          rayonPlancherM={plancher}
          libelle={`${t('carte_titre')} — ${lieu}`}
          aide={t('carte_molette')}
        />
        <span className="carte-etiquette">{t('carte_rayon', { n: r })}</span>
      </div>
      <p className="small muted carte-pied">
        <span>{t('carte_note')}</span>
        <a href={complet} target="_blank" rel="noreferrer">
          {t('carte_ouvrir')}
        </a>
      </p>
    </div>
  );
}
