/**
 * Reprendre ce qui est déjà saisi ailleurs.
 *
 * Les mêmes vingt-quatre appartements sont décrits dans l'administration de
 * Staytle, avec leur identifiant Lodgify et l'adresse de leur calendrier. Les
 * ressaisir ici serait vingt-quatre occasions de se tromper d'une ligne - et
 * une adresse de calendrier attribuée au mauvais appartement ne se voit pas :
 * elle bloque simplement les mauvaises dates, en silence, jusqu'au jour où un
 * voyageur trouve porte close.
 *
 * D'où ce lecteur, écrit pour accepter ce qu'on lui donnera plutôt que
 * d'exiger un format. On ne sait pas ce que le presse-papier contiendra : un
 * tableau copié depuis une page web arrive en colonnes séparées par des
 * tabulations, un export en points-virgules, un copier-coller à la main en
 * lignes libres. Tout cela se ramène à la même question, posée ligne par
 * ligne : quel appartement, quelle adresse.
 *
 * Le principe qui gouverne le reste : on ne devine pas. Une ligne dont
 * l'appartement n'est pas identifié avec certitude est rendue telle quelle, à
 * vous de trancher. Rattacher une adresse au mauvais logement est plus coûteux
 * que de ne pas la rattacher du tout, parce que la première erreur est muette
 * et la seconde visible.
 */

export type BienConnu = { id: number; nom: string; ville?: string };

export type LigneCollage = {
  /** La ligne entière, telle qu'elle a été collée. C'est elle que l'écriture relira. */
  brut: string;
  /* La même, raccourcie pour l'affichage. Deux champs et non un seul, parce
     que tronquer ce qui sera relu ferait écrire une adresse coupée - donc
     autre chose que ce que l'aperçu a montré. Une page qui sert à regarder
     avant d'agir ne peut pas se permettre cet écart. */
  apercu: string;
  url?: string;
  bienId?: number;
  nom?: string;
  /** Comment l'appartement a été reconnu, ou pourquoi il ne l'a pas été. */
  par: 'identifiant' | 'nom' | 'aucun';
  probleme?: string;
};

export type Collage = {
  lignes: LigneCollage[];
  /** Les lignes prêtes à être écrites : un appartement, une adresse, sans doublon. */
  retenues: LigneCollage[];
};

/** Sans accents, sans casse, sans ponctuation : deux façons d'écrire un nom se rejoignent. */
export function aplatir(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const URL_MOTIF = /(?:https?|webcal):\/\/[^\s"'<>,;)\]]+/i;

/**
 * Lit un collage et propose une correspondance ligne par ligne.
 *
 * Deux façons de reconnaître un appartement, dans cet ordre. L'identifiant
 * Lodgify d'abord : c'est un nombre, il ne se confond avec rien, et c'est la
 * même clef des deux côtés. Le nom ensuite, à la rigueur, parce qu'un
 * propriétaire qui colle un tableau sans identifiant ne doit pas se retrouver
 * devant vingt-quatre lignes refusées.
 *
 * Le nom le plus long l'emporte quand plusieurs conviennent : entre
 * « Number One » et « Number One Racine », une ligne qui contient le second
 * parle du second. Prendre le premier venu attribuerait une adresse au
 * voisin.
 */
export function analyserCollage(texte: string, biens: BienConnu[]): Collage {
  const parId = new Map(biens.map((b) => [b.id, b]));
  /* Les noms du plus long au plus court, aplatis une fois pour toutes. */
  const parNom = biens
    .map((b) => ({ b, plat: aplatir(b.nom) }))
    .filter((x) => x.plat.length >= 4)
    .sort((x, y) => y.plat.length - x.plat.length);

  const lignes: LigneCollage[] = [];

  for (const brute of String(texte || '').split(/\r?\n/)) {
    const brut = brute.trim();
    if (!brut) continue;
    /* Une ligne d'en-tête de tableau ne porte ni adresse ni identifiant : elle
       sera simplement écartée par la suite, sans bruit. */

    const url = URL_MOTIF.exec(brut)?.[0];
    const plat = aplatir(brut);

    /* L'identifiant : tous les nombres de la ligne, adresse comprise -
       l'export iCal de Lodgify porte souvent l'identifiant du logement dans son
       adresse, et c'est alors la reconnaissance la plus sûre qui soit.

       Seuls les nombres positifs sont lus. Le site numérote en négatif les
       logements de son catalogue de repli, celui qui sert quand Lodgify n'est
       pas joint ; les reconnaître ici obligerait à accepter un signe moins, et
       une date collée dans la même ligne - 2026-11-01 - livrerait alors « -11 »
       comme un identifiant. Un rapprochement faux vaut moins que pas de
       rapprochement, puisqu'il est muet. */
    let bien: BienConnu | undefined;
    let par: LigneCollage['par'] = 'aucun';
    for (const n of brut.match(/\d{2,10}/g) || []) {
      const trouve = parId.get(Number(n));
      if (trouve) {
        bien = trouve;
        par = 'identifiant';
        break;
      }
    }

    if (!bien) {
      /* Le nom, à défaut. On cherche dans la ligne SANS son adresse : une
         adresse contient parfois des mots qui ressemblent à un nom de
         logement, et l'on attribuerait alors la ligne au hasard. */
      const sansUrl = aplatir(url ? brut.replace(url, ' ') : brut);
      const trouve = parNom.find((x) => sansUrl.includes(x.plat));
      if (trouve) {
        bien = trouve.b;
        par = 'nom';
      }
    }

    if (!bien && !url) continue;

    lignes.push({
      brut,
      apercu: brut.length > 160 ? `${brut.slice(0, 160)}…` : brut,
      url,
      bienId: bien?.id,
      nom: bien?.nom,
      par,
      probleme: !bien
        ? 'appartement non reconnu'
        : !url
          ? 'aucune adresse sur cette ligne'
          : !/^(https?|webcal):\/\//i.test(url)
            ? 'adresse illisible'
            : undefined,
    });
  }

  /* Un même appartement cité deux fois : on garde la première ligne et l'on
     signale les suivantes plutôt que d'écraser en silence. Deux adresses pour
     un logement veut dire qu'une des deux lignes parle d'autre chose, et c'est
     à vous de dire laquelle. */
  const vus = new Set<number>();
  const retenues: LigneCollage[] = [];
  for (const l of lignes) {
    if (l.probleme || !l.bienId || !l.url) continue;
    if (vus.has(l.bienId)) {
      l.probleme = 'cet appartement apparaît déjà plus haut';
      continue;
    }
    vus.add(l.bienId);
    retenues.push(l);
  }

  return { lignes, retenues };
}
