import fs from 'node:fs';
import { cheminMedia, typeDe } from '@/lib/media';

export const dynamic = 'force-dynamic';

/**
 * Les photographies déposées depuis l'administration.
 *
 * Elles vivent hors du dossier du code, sur le volume qui survit aux
 * déploiements ; le serveur de fichiers statiques ne les voit donc pas. Cette
 * route les lit et les rend, en public - ce sont des photographies de
 * logements à louer, elles n'ont rien de confidentiel.
 *
 * Elles sont immuables : un fichier déposé ne change jamais de contenu, puisque
 * chaque dépôt crée un nom neuf. On peut donc les faire garder longtemps par
 * les navigateurs, ce qui évite de relire le disque à chaque visite.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ chemin: string[] }> }) {
  const { chemin } = await params;
  const fichier = cheminMedia(chemin || []);
  if (!fichier || !fs.existsSync(fichier)) return new Response('introuvable', { status: 404 });

  const corps = await fs.promises.readFile(fichier);
  return new Response(new Uint8Array(corps), {
    headers: {
      'Content-Type': typeDe(fichier),
      'Content-Length': String(corps.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
