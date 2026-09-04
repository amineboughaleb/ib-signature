import Link from 'next/link';
import { getT } from '@/lib/i18n';
import { signature, type Avis as UnAvis } from '@/lib/avis';
import AvisDefilant from './AvisDefilant';
import TexteReplie from './TexteReplie';

/**
 * Les avis voyageurs.
 *
 * Une carte par avis : la photo de couverture de l'appartement, le commentaire,
 * puis la signature. La photo vient en premier parce qu'un témoignage sur un
 * logement qu'on voit vaut plus qu'un témoignage flottant - le lecteur relie
 * immédiatement la phrase à une pièce.
 *
 * Quand un avis porte sur un logement sorti du parc, il n'y a ni photo ni lien,
 * et le nom reste en texte. On ne le supprime pas pour autant : il a été laissé
 * par quelqu'un, et il reste vrai.
 *
 * Ils défilent plutôt que de tenir en grille. Trois cartes alignées montraient
 * trois avis et cachaient les six autres : le lecteur ne savait même pas qu'ils
 * existaient. Une bande qui glisse dit le contraire - il y en a d'autres, et il
 * y en a beaucoup.
 *
 * Le composant ne rend rien si la liste est vide, plutôt qu'un titre suivi d'un
 * blanc.
 */
export default function Avis({ liste, locale }: { liste: UnAvis[]; locale: string }) {
  if (!liste.length) return null;
  const t = getT(locale);

  return (
    <section className="section section-alt" id="avis">
      <div className="wrap">
        <div className="duo">
          <div>
            <hr className="filet-or" />
            <div className="eyebrow">{t('avis_sur')}</div>
            <h2 style={{ marginTop: 14 }}>{t('avis_titre')}</h2>
          </div>
          <p className="lead" style={{ margin: 0 }}>
            {t('avis_texte')}
          </p>
        </div>

        <AvisDefilant
          enfants={liste.map((a) => (
            <figure key={a.id} className="avis-carte">
              <div className="avis-image">
                {a.photo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={a.photo} alt={a.bienNom} loading="lazy" />
                ) : (
                  <div className="avis-trame" aria-hidden="true" />
                )}
              </div>
              <TexteReplie texte={a.texte} plus={t('avis_plus')} moins={t('avis_moins')} />
              <figcaption>
                <span className="avis-qui">
                  {signature(a)}
                  {/* La plateforme, quand elle est connue : un avis Airbnb et un
                      avis Booking ne pèsent pas la même chose pour tout le
                      monde, et le lecteur a le droit de savoir d'où il vient. */}
                  {a.source && <span className="avis-source">{a.source}</span>}
                </span>
                <span className="avis-bien small muted">
                  {t('avis_a_propos')}{' '}
                  {a.bienSlug ? (
                    <Link href={`/${locale}/logements/${a.bienSlug}`}>{a.bienNom}</Link>
                  ) : (
                    a.bienNom
                  )}
                </span>
              </figcaption>
            </figure>
          ))}
        />

        <p className="small muted" style={{ marginTop: 30 }}>
          {t('avis_source')}
        </p>
      </div>
    </section>
  );
}
