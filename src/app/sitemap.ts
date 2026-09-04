import type { MetadataRoute } from 'next';
import { biens } from '@/lib/biens';
import { LANGUES, PAGES, origine } from '@/lib/seo';

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
  const catalogue = await biens();

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

  return [...fixes, ...fiches];
}
