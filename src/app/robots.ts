import type { MetadataRoute } from 'next';
import { origine } from '@/lib/seo';

export const dynamic = 'force-dynamic';

/**
 * Ce qu'on laisse lire, et ce qu'on ferme.
 *
 * L'administration et les routes internes n'ont rien à faire dans un index :
 * elles ne servent personne qui arrive de Google, et une page d'administration
 * référencée est une invitation à essayer des mots de passe. Le reste est
 * ouvert - c'est un site qui existe pour être trouvé.
 *
 * Les assistants ne sont pas écartés. Un site de location qui interdirait aux
 * modèles de le lire se priverait exactement du canal qu'il cherche à ouvrir :
 * on veut être cité quand quelqu'un demande où loger à Casablanca.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    /* `/media/` n'est plus interdit : les photographies des logements y sont
       servies, et les fermer privait Google des images de chaque fiche. */
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/admin/', '/api/'] }],
    sitemap: `${origine()}/sitemap.xml`,
    host: origine(),
  };
}
