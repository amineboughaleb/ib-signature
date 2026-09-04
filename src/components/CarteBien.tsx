import Link from 'next/link';
import { getT } from '@/lib/i18n';
import type { Bien } from '@/lib/biens';
import VignettePhotos from './VignettePhotos';

/**
 * La carte d'un appartement.
 *
 * Deux états, et le second n'est pas un accident : tant que Lodgify n'est pas
 * joint, il n'y a ni photo ni prix. Plutôt qu'un cadre vide ou un prix inventé,
 * la carte porte alors un motif géométrique tracé en CSS - une trame Art déco
 * qui reprend le laiton de la charte. Elle a l'air voulue, parce qu'elle l'est,
 * et la photographie prendra sa place sans que rien ne bouge autour.
 */
export default function CarteBien({
  b,
  locale,
  arrivee,
  depart,
  voyageurs,
  sejour,
  nuits,
}: {
  b: Bien;
  locale: string;
  /* Les dates suivent le visiteur jusqu'à la fiche, puis jusqu'à Lodgify :
     on ne redemande jamais ce qui a déjà été saisi. */
  arrivee?: string;
  depart?: string;
  voyageurs?: number;
  /* Le prix du séjour demandé, quand Lodgify l'a rendu. Absent, la carte
     retombe sur le prix par nuit - jamais sur un total calculé ici : un total
     obtenu en multipliant un tarif de nuit par un nombre de nuits ignore les
     remises longue durée, le ménage et la taxe de séjour. Il aurait l'exacte
     apparence d'un prix ferme, et serait faux. */
  sejour?: { total: number; devise?: string };
  nuits?: number;
}) {
  const t = getT(locale);
  const photo = b.photos[0];
  const p = new URLSearchParams();
  if (arrivee) p.set('arrivee', arrivee);
  if (depart) p.set('depart', depart);
  if (voyageurs) p.set('voyageurs', String(voyageurs));
  const suite = p.toString() ? `?${p}` : '';

  return (
    <Link href={`/${locale}/logements/${b.slug}${suite}`} className="bien-carte">
      {photo ? (
        <VignettePhotos photos={b.photos} nom={b.nom} />
      ) : (
        <div className="bien-image">
          <div className="bien-trame" aria-hidden="true">
            <span>{b.chambres ?? ''}</span>
          </div>
        </div>
      )}
      {b.enAvant && <span className="badge badge-or bien-etiquette">Signature</span>}
      <div className="bien-corps">
        <h3>{b.nom}</h3>
        <div className="small muted">
          {[
            [b.quartier, b.ville].filter(Boolean).join(' · '),
            b.chambres ? `${b.chambres} ch.` : '',
            b.voyageurs ? `${b.voyageurs} pers.` : '',
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
        <div className="bien-pied">
          {/* Trois états, du plus utile au moins utile. Le total du séjour
              répond à la question posée - « combien pour MES dates » - et
              c'est le seul montant qui se compare d'une carte à l'autre. Le
              prix par nuit ne vient qu'à défaut, et il ne se déguise pas en
              total. */}
          {sejour ? (
            <span className="bien-prix">
              <span className="surtitre">{nuits ? t('bien_total', { n: nuits }) : t('bien_apd')}</span>
              <b>
                {sejour.total.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB', {
                  maximumFractionDigits: 0,
                })}{' '}
                {sejour.devise || b.devise || ''}
              </b>
            </span>
          ) : b.prixDepuis ? (
            <span className="bien-prix">
              <span className="surtitre">{t('bien_apd')}</span>
              <b>
                {b.prixDepuis.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-GB')} {b.devise || ''}
              </b>
              <span className="small muted">{t('bien_nuit')}</span>
            </span>
          ) : (
            <span className="small muted">{t('bien_voir')}</span>
          )}
          <span className="bien-fleche" aria-hidden="true">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
