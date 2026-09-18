import Link from 'next/link';
import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { biens, catalogueDegrade } from '@/lib/biens';
import OrdreLogements, { type LigneVitrine } from '@/components/OrdreLogements';
import { enregistrerVitrineAction } from '../../actions';

export const dynamic = 'force-dynamic';

/**
 * Ranger la vitrine.
 *
 * L'ordre des appartements existait déjà, mais il vivait dans un fichier du
 * code : le changer demandait un commit et un déploiement. Ce n'était donc pas
 * une administration, c'était une intervention. Il rejoint ici les textes, les
 * photographies et les équipements - tout ce qui se décide en regardant le
 * site, et non en regardant le code.
 *
 * `biens()` et non `vitrine()` : cette page doit voir les logements retirés,
 * puisque c'est ici qu'on les remet. Une liste d'où le retiré disparaîtrait
 * serait une porte qui se verrouille derrière soi.
 */
export default async function AdminOrdre() {
  if (!(await connecte())) redirect('/admin');

  const catalogue = await biens();
  /* Sans Lodgify, le catalogue vient d'un repli dont les logements portent des
     identifiants de circonstance. Ranger sur ces identifiants-là n'écrirait
     rien d'utile : on montre la liste, on explique, et on ne propose pas un
     bouton qui ne ferait rien. */
  const degrade = await catalogueDegrade();
  const lignes: LigneVitrine[] = catalogue.map((b) => ({
    id: b.id,
    nom: b.nom,
    ville: b.ville,
    quartier: b.quartier || '',
    photo: b.photos[0],
    avant: Boolean(b.enAvant),
    masque: Boolean(b.masque),
  }));

  return (
    <>
      <p className="fil">
        <Link href="/admin/logements">Logements</Link> · Ordre
      </p>
      <h1 style={{ marginTop: 6 }}>Ordre d’affichage</h1>
      <p className="muted" style={{ marginBottom: 26, maxWidth: '72ch' }}>
        L’ordre de cette liste est celui de la page « Nos logements » et des suggestions en bas de chaque fiche.
        Glissez une ligne, ou utilisez les flèches. Rien n’est enregistré avant le bouton.
      </p>

      <p className="avert" style={{ maxWidth: '72ch' }}>
        <strong>En avant</strong> désigne les logements dont la première photographie alimente le diaporama de
        l’accueil, tant qu’aucune image n’est choisie dans <Link href="/admin/diaporama">Diaporama</Link>.{' '}
        <strong>Retiré du site</strong> sort le logement du catalogue, du plan du site et des suggestions : son
        adresse rend une page introuvable. Il reste chez Lodgify, il reste ici, et il revient d’un clic.
      </p>

      {lignes.length === 0 ? (
        <p className="avert">
          Aucun logement à ranger. Le catalogue est vide, ce qui arrive quand Lodgify n’est pas joignable.
        </p>
      ) : degrade ? (
        <>
          <p className="avert" style={{ borderColor: 'var(--accent)' }}>
            <strong>Lodgify n’est pas joignable en ce moment.</strong> Le site sert un catalogue de secours, dont
            les logements ne portent pas leurs vrais identifiants : ranger maintenant n’enregistrerait rien.
            Revenez quand la connexion sera rétablie - l’ordre déjà enregistré, lui, reste en place.
          </p>
          <ol className="ordre-liste">
            {lignes.map((l) => (
              <li key={l.id} className={`ordre-ligne${l.masque ? ' ordre-masque' : ''}`}>
                <span className="ordre-n" aria-hidden="true">
                  ·
                </span>
                <span className="ordre-vignette ordre-vignette-vide" aria-hidden="true" />
                <span className="ordre-nom">
                  <strong>{l.nom}</strong>
                  <span className="muted small">{[l.quartier, l.ville].filter(Boolean).join(', ')}</span>
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <OrdreLogements initial={lignes} action={enregistrerVitrineAction} />
      )}
    </>
  );
}
