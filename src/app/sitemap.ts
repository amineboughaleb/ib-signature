import type { MetadataRoute } from 'next';
import { vitrine } from '@/lib/biens';
import { LANGUES, PAGES, origine } from '@/lib/seo';
import { TEXTES_DU, cheminQuartier, cheminVille, type Langue } from '@/lib/quartiers';
import { etatDesPages } from '@/lib/quartiers-serveur';

export const dynamic = 'force-dynamic';

/**
 * Le plan du site, dans les deux langues.
 *
 * Il est construit à partir du catalogue réel plutôt que d'une liste écrite à
 * la main : un logement ajouté chez Lodgify apparaît ici sans que personne y
 * pense, et un logement retiré en disparaît. Un plan tenu à la main finit
 * toujours par annoncer des pages mortes, ce qui est pire que de ne pas les
 * annoncer du tout.
 *
 * Chaque adresse porte ses alternatives de langue : c'est ce qui évite que
 * Google choisisse l'anglaise pour une recherche faite en français.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = origine();
  const catalogue = await vitrine();

  const alternatives = (chemin: string) => ({
    languages: Object.fromEntries(LANGUES.map((l) => [l, `${base}/${l}${chemin}`])),
  });

  const fixes = LANGUES.flatMap((l) =>
    PAGES.map((chemin) => ({
      url: `${base}/${l}${chemin}`,
      changeFrequency: (chemin === '' || chemin === '/logements' ? 'daily' : 'monthly') as 'daily' | 'monthly',
      priority: chemin === '' ? 1 : chemin === '/logements' ? 0.9 : 0.5,
      alternates: alternatives(chemin),
    }))
  );

  const fiches = LANGUES.flatMap((l) =>
    catalogue.map((b) => ({
      url: `${base}/${l}/logements/${b.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      alternates: alternatives(`/logements/${b.slug}`),
    }))
  );

  /* Les pages ville et quartier, seulement quand elles sont indexables. Leur
     adresse change d'une langue à l'autre : chaque entrée porte donc la sienne
     dans chaque langue où la page est publiée. La date est celle des textes,
     la seule qu'on connaisse vraiment. */
  const etats = await etatDesPages();
  const quartiers = etats.flatMap((v) => {
    const pages = [
      { statut: v.statut, chemin: (l: Langue) => cheminVille(l, v.ref.cle), priorite: 0.85 },
      ...v.quartiers.map((q) => ({
        statut: q.statut,
        chemin: (l: Langue) => cheminQuartier(l, v.ref.cle, q.ref.cle),
        priorite: 0.8,
      })),
    ];
    return pages.flatMap((p) => {
      const langues = (LANGUES as readonly Langue[]).filter((l) => p.statut[l] === 'indexable');
      const alternates = { languages: Object.fromEntries(langues.map((l) => [l, `${base}/${l}${p.chemin(l)}`])) };
      return langues.map((l) => ({
        url: `${base}/${l}${p.chemin(l)}`,
        lastModified: TEXTES_DU,
        changeFrequency: 'weekly' as const,
        priority: p.priorite,
        alternates,
      }));
    });
  });

  return [...fixes, ...fiches, ...quartiers];
}
