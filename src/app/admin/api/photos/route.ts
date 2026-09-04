import path from 'node:path';
import sharp from 'sharp';
import { connecte } from '@/lib/admin';
import { biens } from '@/lib/biens';
import { dossierDe, nomNeuf } from '@/lib/media';

export const dynamic = 'force-dynamic';

/* Une photographie de téléphone fait couramment cinq mégaoctets ; au-delà de
   vingt-cinq, ce n'est plus une photographie de logement. */
const POIDS_MAX = 25 * 1024 * 1024;
const PAR_ENVOI = 12;
/* Les mêmes réglages que l'import : une galerie doit être homogène, et une
   image deux fois plus lourde que ses voisines se voit au chargement. */
const LARGEUR = 1400;
const QUALITE = 78;

/**
 * Le dépôt de photographies.
 *
 * Rien n'est recopié tel quel. Chaque fichier est relu par la bibliothèque
 * d'images, pivoté selon son orientation - les téléphones enregistrent souvent
 * l'image couchée avec une consigne de rotation à côté -, redimensionné, puis
 * réécrit en JPEG sous un nom que nous choisissons. Ce dernier point n'est pas
 * un détail : accepter le nom de fichier d'un visiteur, c'est accepter qu'il
 * contienne des « .. » et désigne un fichier ailleurs sur le serveur.
 *
 * Un fichier qui n'est pas une image échoue à la relecture et n'est pas écrit.
 * On ne se fie donc pas au type déclaré par le navigateur, qui se falsifie en
 * une ligne, mais au contenu réel.
 */
export async function POST(req: Request) {
  if (!(await connecte())) return Response.json({ erreur: 'non autorisé' }, { status: 401 });

  const form = await req.formData();
  const bienId = Number(form.get('bien_id'));
  const b = (await biens()).find((x) => x.id === bienId);
  if (!b) return Response.json({ erreur: 'logement inconnu' }, { status: 400 });

  const fichiers = form.getAll('fichiers').filter((f): f is File => f instanceof File);
  if (!fichiers.length) return Response.json({ erreur: 'aucun fichier' }, { status: 400 });

  const rep = dossierDe(b.slug);
  const ajoutees: string[] = [];
  const refusees: string[] = [];

  for (const f of fichiers.slice(0, PAR_ENVOI)) {
    if (f.size > POIDS_MAX) {
      refusees.push(`${f.name} — trop lourde (${Math.round(f.size / 1048576)} Mo)`);
      continue;
    }
    try {
      const nom = nomNeuf();
      await sharp(Buffer.from(await f.arrayBuffer()))
        .rotate()
        .resize({ width: LARGEUR, withoutEnlargement: true })
        .jpeg({ quality: QUALITE, progressive: true, mozjpeg: true })
        .toFile(path.join(rep, nom));
      ajoutees.push(`/media/${path.basename(rep)}/${nom}`);
    } catch {
      refusees.push(`${f.name} — illisible comme image`);
    }
  }

  return Response.json({ ajoutees, refusees });
}
