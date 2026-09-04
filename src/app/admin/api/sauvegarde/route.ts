import { connecte } from '@/lib/admin';
import { sauvegarder } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Le téléchargement de la base.
 *
 * Une route et non une action serveur : ce qu'on veut ici est un fichier qui
 * descend dans le dossier des téléchargements, et une action serveur rend du
 * texte, pas un fichier.
 *
 * La garde d'abord, sans exception. Ce fichier porte les noms, les téléphones
 * et les courriels des voyageurs, ainsi que les coordonnées bancaires de la
 * maison. Une adresse qui le rendrait sans vérifier la session serait la pire
 * fuite possible de ce site - et elle serait silencieuse, puisque personne ne
 * regarde les journaux d'un site qui marche.
 */
export async function GET() {
  if (!(await connecte())) {
    /* 404 plutôt que 401 : à qui n'est pas connecté, cette adresse n'a pas à
       exister. Répondre « non autorisé » revient à confirmer qu'il y a
       quelque chose à cet endroit. */
    return new Response('introuvable', { status: 404 });
  }

  const contenu = sauvegarder();
  const jour = new Date().toISOString().slice(0, 10);

  return new Response(new Uint8Array(contenu), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="ibsignature-${jour}.db"`,
      'Content-Length': String(contenu.length),
      /* Jamais en cache, nulle part : ni le navigateur ni un intermédiaire ne
         doivent garder une copie de ce fichier. */
      'Cache-Control': 'no-store, private',
    },
  });
}
