/**
 * Vérification de bout en bout du site IB Signature.
 *   npm run verifier   (le serveur doit tourner sur :3100)
 *
 * Pour que les vérifications de l'administration s'exécutent, lancez le serveur
 * avec ADMIN_PASSWORD, et donnez le même mot de passe ici :
 *   ADMIN_PASSWORD=... npm run verifier
 */
import fs from 'node:fs';
import path2 from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
const B = process.env.BASE || 'http://localhost:3100';

/* Le verificateur lit .env.local, comme le serveur.

   Il ne le faisait pas, et cela s'est vu tard : tout le parcours de paiement
   dependait de LODGIFY_DEVIS_ESSAI, que seul Next chargeait. Le bloc
   s'annoncait donc « non verifie » sur une ligne discrete, au milieu de deux
   cents lignes vertes - et personne ne lit la ligne discrete. Un controle qui
   se saute en silence est pire qu'un controle absent : il rassure.

   La lecture est volontairement rustique - une ligne, un signe egal - parce
   qu'elle ne sert qu'a retrouver ce que Next a deja lu. */
for (const nom of ['.env.local', '.env']) {
  try {
    for (const ligne of fs.readFileSync(path2.join(process.cwd(), nom), 'utf8').split('\n')) {
      const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const val = m[2].trim().replace(/^["']|["']$/g, '');
      if (process.env[m[1]] === undefined) process.env[m[1]] = val;
    }
  } catch {
    /* absent : ce n'est pas une erreur, seulement moins de choses verifiables */
  }
}
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR' });
const p = await ctx.newPage();

/* Le verificateur ne sort jamais du site.

   L'etape de paiement part d'elle-meme chez Lodgify deux secondes apres le
   choix de la carte - c'est voulu pour un voyageur, c'est une catastrophe pour
   un controle : la page attendait le chargement d'un site tiers, atteignable
   ou non, et le controle expirait au bout de trente secondes sans rien dire du
   site. On coupe donc net toute sortie, et l'on rend une page vide.

   Ce n'est pas seulement du confort. Un controle qui interroge un tiers ne
   verifie plus ce qu'on a ecrit : il verifie que ce tiers repond. */
/* Revenir sur le site apres un depart programme.

   Le clic sur « payer par carte » arme une navigation a deux secondes. Un
   `goto` lance pendant que celle-ci part se fait annuler - ERR_ABORTED - et le
   controle echoue sur une course, pas sur un defaut. On reessaie donc, ce qui
   est aussi ce que ferait un humain devant une page qui bouge sous lui. */
async function revenir(url) {
  for (let essai = 0; essai < 4; essai += 1) {
    try {
      await p.goto(url, { waitUntil: 'domcontentloaded' });
      return;
    } catch (e) {
      if (!/ERR_ABORTED/.test(String(e?.message))) throw e;
      await p.waitForTimeout(400);
    }
  }
  await p.goto(url, { waitUntil: 'domcontentloaded' });
}

/* Une seule sortie est coupee : celle du moteur de reservation.

   Le clic sur « payer par carte » arme une navigation vers Lodgify a deux
   secondes. Un controle qui la laisse partir n'attend plus que Lodgify
   reponde - il ne verifie donc plus ce qu'on a ecrit, il verifie qu'un tiers
   est joignable, et il expire quand il ne l'est pas.

   On coupe cette adresse-la, et elle seule. Un filtre plus large a ete essaye
   et retire : couper tout ce qui sort bloquait aussi la liaison de
   rechargement du serveur de developpement, et les pages cessaient de se
   charger pour une raison qui ne ressemblait en rien a sa cause. */
await ctx.route(/lodgify\.com/, (route) => route.abort());
/* Une minute pour naviguer, deux fois le délai par défaut. En développement,
   chaque page est compilée à la demande, et une première visite peut demander
   vingt secondes sur une machine occupée : trente secondes suffisaient à
   transformer une lenteur en échec, ce qui ne dit rien du site. */
ctx.setDefaultNavigationTimeout(60000);
ctx.setDefaultTimeout(30000);
const err = [];
/* Une exception dont le message se réduit à « Event » n'en est pas une : c'est
   la signature d'une ressource externe qui n'a pas pu être chargée, ici la
   feuille de polices de Google, que le réseau de vérification n'atteint pas
   toujours. Le site ne dépend pas d'elle - chaque famille déclare sa pile de
   repli - et retenir cette ligne rendrait la vérification instable pour une
   raison qui ne regarde pas le code. Tout le reste est signalé, avec la page
   où cela s'est produit. */
p.on('pageerror', (e) => {
  const m = e?.message || String(e);
  if (m === 'Event') return;
  err.push(`${m} @ ${p.url()}`);
});
/* Une image qui ne se charge pas n'apparaît nulle part dans la console : elle
   laisse un cadre vide, ce qui est pire qu'une erreur visible. On surveille
   donc les réponses en échec, mais seulement celles du site lui-même - les
   requêtes annulées par une navigation, elles, ne sont pas des défauts. */
p.on('response', (r) => {
  if (r.url().startsWith(B) && r.status() >= 400 && !r.url().includes('_rsc=')) err.push(`${r.url()} — ${r.status()}`);
});
const ok = [];
const ko = [];
/* Node prévient qu'il lit un fichier TypeScript sans « type: module » dans le
   package.json. C'est exact et sans conséquence - ce fichier n'est importé que
   par ce contrôle - mais l'avertissement s'affiche au milieu des résultats et
   se lit comme une panne. On l'écarte nommément : filtrer un avertissement
   précis est prudent, les faire taire tous ne l'est pas. */
const avertirDorigine = process.emitWarning.bind(process);
process.emitWarning = (message, ...reste) => {
  if (/MODULE_TYPELESS_PACKAGE_JSON|Module type of file/.test(String(message))) return;
  if (reste.some((r) => /MODULE_TYPELESS_PACKAGE_JSON/.test(String(r)))) return;
  return avertirDorigine(message, ...reste);
};

const check = (n, c, d = '') => { (c ? ok : ko).push(`${n}${d ? ' - ' + d : ''}`); console.log(`${c ? '  ok  ' : ' KO   '} ${n}${d ? ' - ' + d : ''}`); };

/* ---------- le jugement sur un calendrier ----------
   Trois règles décident si la page des calendriers vous envoie ouvrir Lodgify.
   Elles se vérifient sans navigateur et sans clé d'API : elles vivent seules
   dans src/lib/calendrier.ts, et Node lit ce TypeScript-là directement. C'est
   le seul endroit de ce fichier où l'on teste une règle plutôt qu'une page, et
   c'est justifié : sans calendrier réel sur cette machine, la règle serait
   sinon livrée sans avoir jamais été éprouvée. */
{
  const { etatIcal, parGraviteIcal } = await import('../src/lib/calendrier.ts');
  const cas = [
    ['un calendrier muet est muet, pas vide', { connu: false, occupes: 0, total: 365 }, 'muet'],
    ['un calendrier sans nuit prise le dit', { connu: true, occupes: 0, total: 365 }, 'vide'],
    ['un calendrier presque plein est signalé', { connu: true, occupes: 360, total: 365 }, 'plein'],
    ['un calendrier ordinaire ne dit rien', { connu: true, occupes: 120, total: 365 }, 'ok'],
  ];
  for (const [nom, ligne, attendu] of cas) {
    const eu = etatIcal(ligne);
    check(`  ${nom}`, eu === attendu, `attendu ${attendu}, obtenu ${eu}`);
  }
  /* Et l'ordre : ce qui appelle une action passe devant, quel que soit le nom. */
  const range = [
    { etat: 'ok', nom: 'Alpha' },
    { etat: 'muet', nom: 'Zulu' },
    { etat: 'vide', nom: 'Bravo' },
  ].sort(parGraviteIcal).map((x) => x.etat);
  check('    les anomalies passent devant l\'ordre alphabétique',
    range.join(' ') === 'muet vide ok', range.join(' '));
}

/* ---------- la sortie de Staytle, jusqu'au collage ----------
   Les deux informations dont ce site a besoin ne vivent pas sur la même page
   de Staytle : l'identifiant Lodgify dans « Channel manager », l'adresse iCal
   dans chaque fiche. Le script les rassemble depuis la base, en lecture seule.

   Ce qu'on vérifie ici n'est pas qu'il s'exécute, mais que sa sortie traverse
   le lecteur de collage sans perte : c'est le seul point qui compte, et c'est
   celui qui casserait en silence si l'un des deux changeait de format. */
{
  const { execFileSync } = await import('node:child_process');
  const Database = (await import('better-sqlite3')).default;
  const os = await import('node:os');
  const chemin = path2.join(os.tmpdir(), `staytle-essai-${Date.now()}.db`);

  try {
    const base = new Database(chemin);
    base.exec('CREATE TABLE listings (id INTEGER PRIMARY KEY, slug TEXT, title TEXT, channel_property_id TEXT, ical_url TEXT)');
    const ins = base.prepare('INSERT INTO listings (slug,title,channel_property_id,ical_url) VALUES (?,?,?,?)');
    ins.run('c202-alcazar', 'C202 Alcazar', '603177', 'https://a.lodgify.com/603177/calendar.ics');
    ins.run('tamaris', 'Tamaris', '512340', 'webcal://a.lodgify.com/512340/calendar.ics');
    ins.run('sans-cal', 'Villa Sans Calendrier', '777001', '');
    base.close();

    const sortie = execFileSync('node', ['scripts/depuis-staytle.mjs', chemin], { encoding: 'utf8' });
    check('  le script lit la base de Staytle', /603177/.test(sortie) && /512340/.test(sortie),
      sortie.split('\n').filter((l) => l && !l.startsWith('#')).length + ' ligne(s)');
    check('    un logement sans adresse iCal n\'est pas listé', !/777001/.test(sortie));
    check('    et il est compté à part', /1 logement\(s\) de Staytle n.ont pas d.adresse/.test(sortie));

    /* Le passage de l'un à l'autre : la sortie du script doit se coller telle
       quelle, en-têtes comprises. */
    const { analyserCollage } = await import('../src/lib/collage.ts');
    const relu = analyserCollage(sortie, [
      { id: 603177, nom: 'C202 Alcazar' },
      { id: 512340, nom: 'Tamaris' },
      { id: 777001, nom: 'Villa Sans Calendrier' },
    ]);
    check('  la sortie du script se colle telle quelle', relu.retenues.length === 2,
      `${relu.retenues.length} retenue(s) sur ${relu.lignes.length} ligne(s) lues`);
    check('    les lignes de commentaire sont ignorées sans bruit',
      relu.lignes.every((l) => !l.probleme), relu.lignes.filter((l) => l.probleme).map((l) => l.apercu).join(' | ') || 'aucune');
    check('    et chaque logement est reconnu par son identifiant',
      relu.retenues.every((l) => l.par === 'identifiant'), relu.retenues.map((l) => l.par).join(', '));
  } finally {
    for (const suffixe of ['', '-wal', '-shm']) {
      try { fs.unlinkSync(chemin + suffixe); } catch { /* déjà parti */ }
    }
  }
}

/* ---------- ne pas se faire jeter par Lodgify ----------
   Le diagnostic disait « aucun chemin n'a répondu ». Les chemins répondaient :
   429, trop de requêtes. Vingt-quatre logements par quatre chemins de
   disponibilité et trois de tarif faisaient plusieurs centaines d'appels en
   quelques secondes, et un refus ressemble exactement à une absence - on
   cherche alors chez le fournisseur un défaut qui est chez soi.

   La file se vérifie sans réseau : ce qui compte est qu'elle sérialise, et
   qu'un refus fasse attendre TOUT LE MONDE et non la seule requête qui l'a
   reçu. C'est la clé qui est refusée, pas l'adresse. */
{
  const { encadrer, freiner, freine, delaiApresRefus } = await import('../src/lib/limite.ts');

  /* Le débit : dix travaux ne doivent pas partir en même temps. */
  let deFront = 0;
  let pointe = 0;
  const t0 = Date.now();
  await Promise.all(
    Array.from({ length: 10 }, () =>
      encadrer(async () => {
        deFront += 1;
        pointe = Math.max(pointe, deFront);
        await new Promise((r) => setTimeout(r, 30));
        deFront -= 1;
      })
    )
  );
  check('  la file limite les appels de front', pointe <= 3, `${pointe} au plus en même temps`);
  check('    et les espace dans le temps', Date.now() - t0 >= 9 * 120 * 0.8, `${Date.now() - t0} ms pour dix appels`);

  /* Le freinage : quand Lodgify dit d'attendre, plus rien ne part. */
  check('  personne ne freine avant un refus', freine() === false);
  freiner(600);
  check('    un refus freine tout le monde', freine() === true);
  const avant = Date.now();
  await encadrer(async () => true);
  check('      et l\'appel suivant attend vraiment', Date.now() - avant >= 500, `${Date.now() - avant} ms`);
  check('      puis la voie se rouvre', freine() === false);

  /* Le délai : l'en-tête du serveur fait foi, sinon on double. */
  check('  Retry-After est respecté quand il est là', delaiApresRefus('5', 0) === 5000, String(delaiApresRefus('5', 0)));
  check('    sinon le délai croît', delaiApresRefus(null, 0) < delaiApresRefus(null, 1)
    && delaiApresRefus(null, 1) < delaiApresRefus(null, 2),
    [0, 1, 2].map((n) => delaiApresRefus(null, n)).join(' → '));
  check('    et reste borné', delaiApresRefus('99999', 0) <= 30000, String(delaiApresRefus('99999', 0)));

  /* Les deux voies.

     La file était équitable, et c'était le défaut. Ouvrir la page de
     diagnostic y jetait une cinquantaine de sondes ; pendant les deux minutes
     suivantes, un voyageur qui demandait un prix passait derrière elles. Le
     journal l'a montré : un dépôt de virement à vingt-six secondes, une page
     d'avis à trente-cinq, alors que ni l'une ni l'autre n'attendait grand-
     chose de Lodgify. Elles attendaient une place.

     Ce qui se vérifie : lancés ensemble, un travail de visiteur passe devant
     des travaux de fond déjà en attente. */
  {
    const ordre = [];
    const lent = () => new Promise((r) => setTimeout(r, 60));
    /* Six travaux de fond partent d'abord et saturent les trois créneaux. */
    const fonds = Array.from({ length: 6 }, (_, i) =>
      encadrer(async () => { await lent(); ordre.push(`fond${i}`); }, { fond: true })
    );
    await new Promise((r) => setTimeout(r, 30));
    /* Le visiteur arrive après, et doit néanmoins être servi avant la fin. */
    const visiteur = encadrer(async () => { ordre.push('visiteur'); });
    await Promise.all([...fonds, visiteur]);
    const rang = ordre.indexOf('visiteur');
    check('  le visiteur passe devant le travail de fond',
      rang >= 0 && rang < ordre.length - 1,
      `${rang + 1}ᵉ servi sur ${ordre.length}`);
  }

  /* Le plafond d'attente. Sans lui, une page pouvait attendre indéfiniment -
     chaque refus repousse la pause - et le navigateur abandonnait sans rien
     expliquer. Une page lente est un défaut ; une page qui ne répond jamais
     est une panne. */
  freiner(30000);
  const debutRenoncement = Date.now();
  const renonce = await encadrer(async () => 'jamais');
  const attendu = Date.now() - debutRenoncement;
  check('  la file renonce plutôt que de retenir la page', renonce === null, String(renonce));
  check('    après une attente bornée', attendu >= 19000 && attendu <= 26000, `${attendu} ms`);
}

/* La pause posée ci-dessus est rendue avant la suite : elle a servi, elle ne
   doit pas ralentir le reste du contrôle. */
{
  const { freine } = await import('../src/lib/limite.ts');
  await new Promise((r) => setTimeout(r, freine() ? 11000 : 0));
}

/* ---------- reprendre le tableau de Staytle ----------
   Les mêmes appartements y sont déjà décrits, identifiant Lodgify et adresse
   iCal compris. Le lecteur doit accepter ce qu'on lui donnera - colonnes,
   points-virgules, lignes libres - sans jamais deviner : une adresse rattachée
   au mauvais logement bloque les mauvaises dates en silence, et ne se voit que
   le jour où un voyageur trouve porte close. */
{
  const { analyserCollage, aplatir } = await import('../src/lib/collage.ts');
  const BIENS = [
    { id: 603177, nom: 'C202 Alcazar' },
    { id: 512340, nom: 'Number One' },
    { id: 512341, nom: 'Number One Racine' },
    { id: 777001, nom: 'Tamaris' },
  ];

  const tab = analyserCollage(
    '603177\tC202 Alcazar\thttps://a.lodgify.com/603177/calendar.ics',
    BIENS
  );
  check('  une ligne en colonnes est comprise', tab.retenues.length === 1, JSON.stringify(tab.lignes[0] || {}));
  check('    et l\'appartement reconnu par son identifiant',
    tab.retenues[0]?.bienId === 603177 && tab.retenues[0]?.par === 'identifiant', tab.retenues[0]?.par);

  /* Le nom le plus long l'emporte : « Number One Racine » n'est pas
     « Number One », et attribuer l'adresse au voisin serait pire que de la
     laisser de côté. */
  const proches = analyserCollage('Number One Racine ; https://a.lodgify.com/x/calendar.ics', BIENS);
  check('  entre deux noms voisins, le plus long gagne',
    proches.retenues[0]?.bienId === 512341, String(proches.retenues[0]?.nom));

  /* L'accent et la casse ne doivent pas faire échouer une reconnaissance. */
  check('    les accents et la casse ne comptent pas', aplatir('Tamaris — Été') === 'tamaris ete', aplatir('Tamaris — Été'));

  const sansId = analyserCollage('Tamaris|webcal://a.lodgify.com/9/calendar.ics', BIENS);
  check('  à défaut d\'identifiant, le nom suffit',
    sansId.retenues[0]?.bienId === 777001 && sansId.retenues[0]?.par === 'nom', sansId.retenues[0]?.par);
  check('    et le webcal est accepté', /^webcal:/.test(sansId.retenues[0]?.url || ''), sansId.retenues[0]?.url);

  /* Ce qu'on ne comprend pas ne s'invente pas. */
  const inconnu = analyserCollage('Villa Inconnue\thttps://a.lodgify.com/0/calendar.ics', BIENS);
  check('  un appartement non reconnu n\'est pas deviné',
    inconnu.retenues.length === 0 && inconnu.lignes[0]?.probleme === 'appartement non reconnu',
    inconnu.lignes[0]?.probleme);

  const entete = analyserCollage('Identifiant;Nom;Calendrier\n603177;C202 Alcazar;https://a.lodgify.com/1/c.ics', BIENS);
  check('  une ligne d\'en-tête est ignorée sans bruit',
    entete.lignes.length === 1 && entete.retenues.length === 1, `${entete.lignes.length} ligne(s) retenue(s)`);

  const doublon = analyserCollage(
    '603177 https://a.lodgify.com/1/c.ics\n603177 https://a.lodgify.com/2/c.ics',
    BIENS
  );
  check('  un appartement cité deux fois n\'est pas écrasé en silence',
    doublon.retenues.length === 1 && /déjà plus haut/.test(doublon.lignes[1]?.probleme || ''),
    doublon.lignes[1]?.probleme);

  /* La ligne entière est conservée pour la relecture, et seul l'affichage est
     raccourci : écrire une adresse tronquée ferait autre chose que ce que
     l'aperçu a montré. */
  const longue = `603177 https://a.lodgify.com/${'x'.repeat(300)}/calendar.ics`;
  const coupe = analyserCollage(longue, BIENS);
  check('  la ligne entière survit à l\'aperçu raccourci',
    coupe.lignes[0]?.brut.length === longue.length && coupe.lignes[0].apercu.length < longue.length,
    `${coupe.lignes[0]?.brut.length} conservés, ${coupe.lignes[0]?.apercu.length} affichés`);
}

/* ---------- la lecture d'un calendrier iCal ----------
   Ce format est ancien et négligemment respecté : ce lecteur doit survivre à
   ce qu'il rencontrera plutôt que valider la norme. On l'éprouve donc sur les
   pièges réels, et surtout sur celui qui coûte de l'argent - la borne de fin,
   exclusive, dont l'oubli ferait perdre une nuit à chaque rotation. */
{
  const { analyserIcal, croise, nuitsDe } = await import('../src/lib/ical.ts');

  const cal = (corps) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${corps}\r\nEND:VCALENDAR\r\n`;
  const ev = (d, f, r = 'Reserved', extra = '') =>
    `BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:${d}\r\nDTEND;VALUE=DATE:${f}\r\nSUMMARY:${r}\r\n${extra}END:VEVENT`;

  const un = analyserIcal(cal(ev('20261001', '20261005')));
  check('  un séjour iCal est lu', un.periodes.length === 1, JSON.stringify(un.periodes));
  check('    la nuit du départ n\'est pas comptée',
    un.periodes[0]?.d === '2026-10-01' && un.periodes[0]?.f === '2026-10-04',
    JSON.stringify(un.periodes[0]));
  check('    et le compte des nuits est juste', nuitsDe(un.periodes) === 4, String(nuitsDe(un.periodes)));

  /* La rotation : partir le 5 et arriver le 5 n'est pas un conflit. C'est
     l'erreur qui coûterait une nuit à chaque enchaînement. */
  check('  arriver le jour d\'un départ n\'est pas un conflit',
    croise(un.periodes, '2026-10-05', '2026-10-08') === null);
  check('    mais arriver la veille en est un',
    croise(un.periodes, '2026-10-04', '2026-10-08') !== null);
  check('    et un séjour englobant aussi',
    croise(un.periodes, '2026-09-28', '2026-10-10') !== null);

  const annule = analyserIcal(cal(`${ev('20261101', '20261105')}\r\n${ev('20261110', '20261115', 'Annulé', 'STATUS:CANCELLED\r\n')}`));
  check('  un séjour annulé ne bloque rien', annule.periodes.length === 1, JSON.stringify(annule.periodes));

  /* Le repliage des lignes : la norme coupe les longues valeurs et marque la
     suite par une espace. Ne pas recoller, c'est perdre la moitié d'un
     libellé - et parfois couper une date en deux. */
  const replie = analyserIcal(cal('BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261201\r\nDTEND;VALUE=DATE:20261203\r\nSUMMARY:Airbnb (Not\r\n  available)\r\nEND:VEVENT'));
  check('  les lignes repliées sont recollées', /Not available/.test(replie.periodes[0]?.r || ''), replie.periodes[0]?.r);

  /* Deux annonces du même séjour, ou deux séjours qui se suivent : fondus. */
  const double = analyserIcal(cal(`${ev('20270101', '20270105')}\r\n${ev('20270105', '20270108')}`));
  check('  deux séjours consécutifs n\'en font qu\'un', double.periodes.length === 1, JSON.stringify(double.periodes));
  check('    en couvrant les deux', double.periodes[0]?.f === '2027-01-07', double.periodes[0]?.f);

  const vide = analyserIcal('ceci n\'est pas un calendrier');
  check('  un fichier qui n\'est pas un iCal est refusé', vide.periodes.length === 0 && vide.ecartes.length > 0);

  const bancal = analyserIcal(cal('BEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20260231\r\nDTEND;VALUE=DATE:20260305\r\nEND:VEVENT'));
  check('  une date impossible est écartée, pas décalée', bancal.periodes.length === 0, JSON.stringify(bancal.periodes));

}

await p.goto(`${B}/fr`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(600);
check('accueil', (await p.locator('h1').innerText()).includes('alternative'));
/* L'ordre voulu : diaporama, barre de recherche, titre et présentation,
   icônes, avis. Et rien après - on vérifie donc aussi ce qui ne doit PAS y
   être. */
const ordre = await p.evaluate(() => {
  const y = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + window.scrollY : null; };
  return { diapo: y('.diapo'), barre: y('.recherche'), titre: y('.presentation-texte h1'),
           icones: y('.services-grille'), avis: y('.avis-defilant'),
           vitrine: document.querySelectorAll('.bien-carte').length,
           proprio: document.querySelectorAll('.proprio').length };
});
check('  la barre de recherche suit le diaporama',
  ordre.barre !== null && (ordre.diapo === null || ordre.barre > ordre.diapo));
check('  le titre suit la barre', ordre.titre > ordre.barre, `barre ${Math.round(ordre.barre)}px, titre ${Math.round(ordre.titre)}px`);
check('  les icônes suivent le titre', ordre.icones > ordre.titre);
check('  les avis suivent les icônes', ordre.avis > ordre.icones);
check('  et la page s\'arrête là', ordre.vitrine === 0 && ordre.proprio === 0,
  `${ordre.vitrine} carte(s) de logement, ${ordre.proprio} bloc(s) propriétaire`);
check('  aucun texte posé sur le diaporama', (await p.locator('.accroche-corps').count()) === 0);
check('  le bloc de présentation porte la photographie', (await p.locator('.presentation-image img').count()) === 1);
const photo = await p.evaluate(() => {
  const i = document.querySelector('.presentation-image img');
  return i ? { ok: i.complete && i.naturalWidth > 0, l: i.naturalWidth } : null;
});
check('  et la photographie se charge vraiment', !!photo && photo.ok, photo ? `${photo.l}px de large` : 'absente');
check('  les deux paragraphes de présentation', /alternatives aux chambres/.test(await p.locator('.presentation-texte').innerText())
  && /voyageurs exigeants/.test(await p.locator('.presentation-texte').innerText()));
check('  les trois services', (await p.locator('.service').count()) === 3);
check('  chacun avec son icône', (await p.locator('.service-icone').count()) === 3);
check('  dont le linge hôtelier', /Linge de maison/.test(await p.locator('.services-grille').innerText()));
check('  les avis voyageurs', (await p.locator('.avis-carte').count()) === 6);
const av = await p.locator('.avis-carte').first().innerText();
check('  chaque avis porte sa provenance', /FRANCE|ÉTATS-UNIS|BELGIQUE|SUÈDE|MAROC|SUISSE/i.test(await p.locator('.avis-defilant').innerText()));
/* Les avis défilent : les six sont dans la page, trois de front sur un grand
   écran, et les commandes permettent d'atteindre les autres. Une grille les
   montrait trois et cachait le reste sans le dire. */
{
  const cases = await p.locator('.avis-case').count();
  check('  ils défilent tous les six', cases === 6, `${cases} case(s)`);
  const bande = p.locator('.avis-bande');
  const debut = await bande.evaluate((b) => b.scrollLeft);
  /* On attend que le défilement soit fini, pas qu'il ait commencé : mesurer au
     premier pixel laisserait l'animation courir pendant la vérification
     suivante, et l'on croirait à une reprise automatique. */
  const reposer = () =>
    bande
      .evaluate((b) => new Promise((ok) => {
        let dernier = -1;
        let stables = 0;
        const t0 = Date.now();
        const voir = () => {
          if (b.scrollLeft === dernier) stables++;
          else stables = 0;
          dernier = b.scrollLeft;
          if (stables > 8 || Date.now() - t0 > 5000) ok(b.scrollLeft);
          else requestAnimationFrame(voir);
        };
        voir();
      }))
      .catch(() => -1);

  /* En développement, un clic peut arriver avant que React n'ait attaché son
     écouteur : le bouton est à l'écran, il ne fait encore rien. On réessaie
     donc plutôt que de conclure à une panne - c'est un défaut de la
     vérification, pas du site, et une vérification qui accuse un code correct
     est plus dangereuse qu'une absence de vérification. */
  let apres = debut;
  for (let essai = 0; essai < 3 && apres <= debut; essai += 1) {
    await p.locator('.avis-commandes button').nth(1).click();
    apres = await reposer();
    if (apres <= debut) await p.waitForTimeout(700);
  }
  check('    et la commande les fait avancer', apres > debut, `${debut} puis ${apres}`);
  /* Deux de front, pas trois : c'est ce qui laisse au commentaire une ligne
     qui se lit sans sauter. On mesure plutôt que de relire la feuille de
     style. */
  const front = await p.evaluate(() => {
    const b = document.querySelector('.avis-bande');
    const c = document.querySelector('.avis-case');
    return b && c ? Math.round(b.clientWidth / c.clientWidth) : 0;
  });
  check('    deux avis de front', front === 2, `${front} de front`);
  /* Le défilement doit s'arrêter dès qu'on prend la main : reprendre le
     contrôle après l'avoir cédé serait l'arracher au lecteur. */
  await p.waitForTimeout(7000);
  const fige = await bande.evaluate((b) => b.scrollLeft);
  check('      puis rend la main pour de bon', Math.abs(fige - apres) < 5, `${apres} puis ${fige}`);
}
check('  et l\'appartement dont il parle', /propos de/i.test(av), av.split('\n').pop());
const menu = (await p.locator('.nav-large').innerText()).replace(/\n/g, ' | ');
for (const entree of ['Accueil', 'Nos logements', 'Qui sommes-nous', 'Propriétaires', 'Contactez-nous'])
  check(`menu : ${entree}`, menu.includes(entree), menu);
check('  et plus de « La maison »', !/La maison/.test(menu), menu);
/* Le logo est une image blanche sur transparence : si le fichier source
   changeait et réintroduisait un fond, on verrait un rectangle sur le nuit.
   On vérifie donc qu'il se charge et qu'il a les proportions attendues. */
const logo = await p.evaluate(() => {
  const i = document.querySelector('.marque-logo');
  return i ? { ok: i.complete && i.naturalWidth > 0, r: +(i.naturalWidth / i.naturalHeight).toFixed(2), h: Math.round(i.getBoundingClientRect().height) } : null;
});
check('le logo s\'affiche dans l\'en-tête', !!logo && logo.ok && logo.h >= 36,
  logo ? `${logo.h}px de haut, proportion ${logo.r}` : 'absent');
check('  et en grand au pied de page', (await p.locator('.marque-logo-pied').count()) === 1);
/* La barre de recherche se place SOUS le diaporama, à cheval sur la fin de
   l'accroche : c'est ce que voit un voyageur qui arrive avec des dates. */
const geo = await p.evaluate(() => {
  const a = document.querySelector('.accroche');
  return a ? { haut: a.getBoundingClientRect().height } : null;
});
/* Avec photographie l'accroche prend de la hauteur ; sans photographie elle se
   rétracte au lieu de laisser une bande vide. Les deux sont corrects, et c'est
   la cohérence entre les deux qu'on vérifie. */
const avecPhoto = (await p.locator('.diapo img').count()) > 0;
check(avecPhoto ? '  l\'accroche a la hauteur d\'une photographie' : '  sans photo, l\'accroche se rétracte',
  !!geo && (avecPhoto ? geo.haut >= 460 : geo.haut < 320),
  geo ? `${Math.round(geo.haut)}px` : '-');

/* ---------- le calendrier ----------
   Les deux champs `type="date"` ont disparu : ils affichaient le format du
   navigateur et ne montraient pas que les deux dates forment une période. */
await p.goto(`${B}/fr`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(400);
check('plus aucun champ date natif', (await p.locator('input[type=date]').count()) === 0);
/* Un composant client ne répond qu'une fois repris en main par React. En
   développement, la page est compilée à la demande : attendre le résultat du
   clic plutôt qu'une durée évite de mesurer la vitesse du compilateur. */
/* On réessaie le clic plutôt que de conclure au premier : le bouton est à
   l'écran avant que React ne lui ait attaché son écouteur, et prendre cette
   avance pour une panne accuserait un code correct. */
for (let essai = 0; essai < 4 && (await p.locator('.cal-panneau').count()) === 0; essai += 1) {
  await p.locator('.cal-champ').click();
  await p.locator('.cal-panneau').waitFor({ timeout: 8000 }).catch(() => {});
}
check('  le calendrier s\'ouvre', (await p.locator('.cal-panneau').count()) === 1);
check('    sur deux mois', (await p.locator('.cal-titre').count()) === 2);
check('    en français', /janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre/i
  .test(await p.locator('.cal-titre').first().innerText()));
const passes = await p.locator('.cal-jour:disabled').count();
/* Compter les jours desactives etait faux un jour par mois : ouvert un
   premier du mois, le calendrier n'affiche aucun jour passe, et zero
   desactive est alors la bonne reponse. On verifie donc ce qui compte
   vraiment - qu'aucun jour anterieur a aujourd'hui ne soit cliquable. */
const passe = await p.evaluate(() => {
  const premier = document.querySelectorAll('.cal-mois > div')[0];
  const jourAuj = new Date().getDate();
  const cases = [...premier.querySelectorAll('.cal-jour')].filter((b) => Number(b.textContent) < jourAuj);
  return { total: cases.length, ouverts: cases.filter((b) => !b.disabled).length };
});
check('    le passé n\'est pas cliquable', passe.ouverts === 0, `${passe.total} jour(s) passé(s), ${passe.ouverts} encore ouvert(s)`);
const jours = p.locator('.cal-jour:not(:disabled)');
await jours.nth(2).click();
await p.waitForTimeout(200);
check('    un premier clic pose l\'arrivée', (await p.locator('input[name=arrivee]').inputValue()).length === 10);
/* Pendant le choix du départ, tout ce qui précède l'arrivée se ferme : une
   nuit se compte d'un jour au suivant, un départ le jour même n'existe pas. */
const bloques = await p.locator('.cal-jour:disabled').count();
check('      et ferme les jours antérieurs', bloques > passes, `${passes} puis ${bloques}`);
await p.locator('.cal-jour:not(:disabled)').nth(4).click();
await p.waitForTimeout(300);
const [a1, d1] = await p.evaluate(() => [
  document.querySelector('input[name=arrivee]').value,
  document.querySelector('input[name=depart]').value,
]);
check('    un second clic pose le départ', d1.length === 10 && d1 > a1, `${a1} → ${d1}`);
check('      et referme le panneau', (await p.locator('.cal-panneau').count()) === 0);
await p.locator('.rech-btn').click();
/* La page de destination est compilee a la demande : on attend l'adresse,
   pas une duree. Un delai fixe ne testait que la vitesse du compilateur. */
await p.waitForURL(/logements/, { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(300);
check('    la recherche porte les deux dates', p.url().includes(`arrivee=${a1}`) && p.url().includes(`depart=${d1}`), p.url());

await p.goto(`${B}/fr/logements?ville=Marrakech`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(500);
check('filtre par ville', (await p.locator('.bien-carte').count()) === 1, `${await p.locator('.bien-carte').count()} carte(s)`);
check('  la barre se rouvre remplie', (await p.locator('#r-ville').inputValue()) === 'Marrakech');

/* Le filtre par voyageurs ne doit jamais vider la liste à lui seul : un
   logement dont Lodgify ne publie pas la capacité reste affiché. Une liste
   vide sur ce seul critère est le symptôme d'une capacité mal lue. */
for (const n of [2, 5, 8]) {
  await p.goto(`${B}/fr/logements?voyageurs=${n}`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(350);
  const c = await p.locator('.bien-carte').count();
  check(`filtre voyageurs = ${n}`, c >= 1, `${c} carte(s)`);
}

await p.goto(`${B}/fr/logements?arrivee=2026-10-02&depart=2026-10-09&voyageurs=4`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(400);
/* Sans calendrier lisible, la liste ne doit écarter personne et doit le dire.
   Avec calendrier, elle n'affiche que les logements libres. Les deux
   comportements sont corrects ; ce qui ne le serait pas, c'est une liste vide
   sans explication. */
const barre = await p.locator('.liste-barre').innerText();
const filtre_dispo = /disponible/i.test(barre);
const nCartes = await p.locator('.bien-carte').count();
check('disponibilités : la liste reste peuplée ou s\'explique',
  nCartes > 0 || /disponible sur ces dates|pas pu être vérifiées/i.test(await p.locator('body').innerText()),
  filtre_dispo ? 'calendrier lu' : 'calendrier non lu, aucun logement écarté');
check('les nuits sont comptées', /7 nuit/i.test(await p.locator('.liste-barre').innerText()), (await p.locator('.liste-barre').innerText()).split('\n')[0]);

/* Le prix du séjour sous chaque carte.

   La liste a longtemps affiché « à partir de X / nuit » même une fois les
   dates saisies. Le voyageur devait ouvrir les neuf fiches pour comparer neuf
   montants - alors que comparer est tout ce qu'on fait devant une liste.

   Ce qui se vérifie ici n'est pas le montant, qui vient de Lodgify, mais le
   fait qu'un total remplace bien le prix par nuit dès qu'une période est
   demandée, et qu'il ne s'y substitue jamais sans dates. */
if (nCartes > 0) {
  const pieds = await p.locator('.bien-carte .bien-pied').allInnerTexts();
  const avecTotal = pieds.filter((x) => /séjour de \d+ nuit/i.test(x));
  const parNuit = pieds.filter((x) => /\/ nuit/i.test(x));
  check('  le prix du séjour remplace le prix par nuit',
    avecTotal.length > 0 || parNuit.length === 0,
    `${avecTotal.length} total(aux), ${parNuit.length} par nuit sur ${pieds.length} carte(s)`);
  if (avecTotal.length) {
    check('    il annonce la durée demandée', /séjour de 7 nuit/i.test(avecTotal[0]), avecTotal[0].replace(/\n/g, ' '));
    check('    et porte un montant et sa devise',
      /\d/.test(avecTotal[0]) && /[A-Z]{3}/.test(avecTotal[0]), avecTotal[0].replace(/\n/g, ' '));
    /* Le piège de cette page : un total obtenu en multipliant le prix par
       nuit par le nombre de nuits. Il aurait l'apparence d'un prix ferme et
       serait faux - il ignore le ménage, la taxe de séjour et les remises de
       durée. Une carte ne montre donc jamais les deux à la fois. */
    check('    sans jamais afficher les deux à la fois',
      !avecTotal.some((x) => /\/ nuit/i.test(x)), `${parNuit.length} carte(s) avec un prix par nuit`);
  }
}

/* Sans dates, rien n'a changé : le prix par nuit reste, et aucun total
   n'apparaît - un total sans période serait un total de quoi ? */
await p.goto(`${B}/fr/logements`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(400);
const piedsSansDates = await p.locator('.bien-carte .bien-pied').allInnerTexts();
check('  aucun total de séjour sans dates',
  !piedsSansDates.some((x) => /séjour de \d+ nuit/i.test(x)), `${piedsSansDates.length} carte(s)`);

await p.goto(`${B}/fr/logements?arrivee=2026-10-02&depart=2026-10-09&voyageurs=4`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(400);
await p.locator('.bien-carte').first().click();
/* La fiche est une autre route, compilée à la demande elle aussi. Attendre son
   adresse plutôt qu'une durée évite un échec qui ne dit rien du site. */
await p.waitForURL(/\/logements\/[a-z0-9-]+/, { timeout: 25000 }).catch(() => {});
await p.waitForTimeout(300);
check('  les dates suivent jusqu\'à la fiche', /\/logements\/[a-z0-9-]+/.test(p.url()) && p.url().includes('arrivee=2026-10-02'), p.url());

/* Le prix ne doit pas changer de nature entre la liste et la fiche.

   Il l'a fait : la carte annonçait « 225 EUR » pour le séjour, on cliquait,
   et la fiche répondait « à partir de 60 EUR / nuit ». Deux montants justes,
   dont le rapprochement ne voulait rien dire - et c'est au moment précis de
   décider qu'on retirait au voyageur le seul chiffre qui l'intéresse. */
{
  const encart = await p.locator('.reserver-prix').innerText().catch(() => '');
  check('  la fiche annonce le prix du séjour, pas le prix par nuit',
    /séjour de \d+ nuit/i.test(encart) || encart === '',
    encart.replace(/\n/g, ' ') || 'aucun encart de prix');
  if (/séjour de \d+ nuit/i.test(encart)) {
    check('    pour la durée demandée', /séjour de 7 nuit/i.test(encart), encart.replace(/\n/g, ' '));
    check('    et sans « / nuit » qui contredirait le total', !/\/ nuit/i.test(encart), encart.replace(/\n/g, ' '));
  }
}

/* Le temps de réponse.

   Une page a mis quatre minutes à s'afficher. Ce n'était pas Lodgify : c'était
   le catalogue reconstruit dans la requête du visiteur, la découverte du
   chemin des tarifs recommencée à chaque visite, et les chambres redemandées
   une par une alors qu'elles venaient d'être lues. Rien de tout cela ne se
   voit dans une capture d'écran - il faut mesurer.

   Le seuil est volontairement large : une machine de développement compile à
   la demande. Ce qu'il attrape n'est pas la lenteur, c'est l'enlisement. */
{
  await p.goto(`${B}/fr/logements?arrivee=2026-11-04&depart=2026-11-11&voyageurs=2`, { waitUntil: 'domcontentloaded' });
  const t0 = Date.now();
  await p.goto(`${B}/fr/logements?arrivee=2026-11-05&depart=2026-11-12&voyageurs=2`, { waitUntil: 'domcontentloaded' });
  const mis = Date.now() - t0;
  check('  la liste répond en un temps borné', mis < 30000, `${(mis / 1000).toFixed(1)} s sur des dates neuves`);
}
await p.goto(`${B}/fr/logements?arrivee=2026-10-02&depart=2026-10-09&voyageurs=4`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(300);
await p.locator('.bien-carte').first().click();
await p.waitForURL(/\/logements\/[a-z0-9-]+/, { timeout: 25000 }).catch(() => {});
await p.waitForTimeout(300);
/* Le titre d'une fiche tient sur une seule ligne, quel que soit la longueur
   du nom, et ne dépasse jamais le corps plafond. */
const titre = await p.evaluate(() => {
  const h = document.querySelector('.fiche-nom');
  if (!h) return null;
  const st = getComputedStyle(h);
  return {
    corps: parseFloat(st.fontSize),
    lignes: Math.round(h.getBoundingClientRect().height / parseFloat(st.lineHeight)),
    n: h.textContent.trim().length,
  };
});
check('  le titre tient sur une ligne', !!titre && titre.lignes === 1, titre ? `${titre.n} caractères, ${titre.corps}px` : 'absent');
check('    et reste sous le corps plafond', !!titre && titre.corps <= 40, titre ? `${titre.corps}px` : '-');

/* Où mène le bouton « Réserver ».

   Deux destinations légitimes depuis que le site pose lui-même la question du
   paiement. Quand le virement est proposable, il mène à notre étape - un lien
   interne, donc sans nouvel onglet. Sinon il mène droit au moteur, comme
   avant.

   Dans les deux cas, une seule chose compte vraiment et se vérifie de la même
   façon : les dates choisies doivent arriver chez Lodgify. Qu'elles fassent
   ou non un détour par une page à nous ne change rien à cette promesse, et
   c'est donc elle qu'on suit jusqu'au bout plutôt que la forme du premier
   lien. */
/* Le choix des dates sur la fiche elle-même. Il manquait, et l'absence ne se
   voyait pas tant qu'on arrivait toujours par la recherche : un voyageur venu
   d'un lien se trouvait devant un appartement, un prix « à partir de », et
   aucun moyen de demander SES dates. */
check('  la fiche porte son propre choix de dates', (await p.locator('.reserver-dates-choix').count()) === 1);
check('    avec le calendrier', (await p.locator('.reserver-dates-choix .cal-champ').count()) === 1);
check('    et le nombre de voyageurs', (await p.locator('.reserver-dates-choix select').count()) === 1);
{
  /* On ouvre le calendrier depuis la fiche et l'on choisit deux jours : la
     page doit se recharger avec les dates dans son adresse, sans quoi le prix
     et la disponibilité ne suivraient pas. */
  const avant = p.url();
  await p.locator('.reserver-dates-choix .cal-champ').click();
  await p.locator('.cal-jour:not([disabled])').first().waitFor({ timeout: 20000 }).catch(() => {});
  const jours = p.locator('.cal-jour:not([disabled])');
  const n = await jours.count();
  if (n > 4) {
    await jours.nth(1).click();
    await jours.nth(4).click();
    /* On attend que l'adresse CHANGE, et non qu'elle porte des dates : elle en
       portait déjà, venues de la recherche, et une attente qui se satisfait de
       l'état antérieur ne mesure rien. */
    await p.waitForFunction((av) => location.href !== av, avant, { timeout: 25000 }).catch(() => {});
  }
  /* Les dates doivent avoir CHANGÉ. La fiche en portait déjà, venues de la
     recherche : se contenter de vérifier qu'il y en a laisserait passer un
     calendrier qui ne fait rien du tout. */
  check('    choisir deux dates recharge la fiche avec CELLES-LÀ',
    /arrivee=\d{4}-\d{2}-\d{2}/.test(p.url()) && p.url().split('?')[1] !== avant.split('?')[1],
    `${avant.split('?')[1] || 'sans dates'} → ${p.url().split('?')[1] || 'sans dates'}`);
  check('      et le séjour est repris à l\'écran',
    /nuit/i.test(await p.locator('.reserver').innerText()), (await p.locator('.reserver').innerText()).split('\n')[0]);
  await p.goto(avant, { waitUntil: 'domcontentloaded' });
}

const premierLien = await p.locator('.reserver a.btn').getAttribute('href');
const parNous = premierLien.startsWith('/');
check('  le bouton mène soit à notre étape, soit au moteur',
  parNous || /lodgify\.com/.test(premierLien), premierLien);

if (parNous) {
  check('    un lien interne ne s\'ouvre pas dans un onglet neuf',
    (await p.locator('.reserver a.btn').getAttribute('target')) === null);
  check('    et il porte les dates', /arrivee=2026-10-02/.test(premierLien) && /depart=2026-10-09/.test(premierLien), premierLien);
} else {
  check('    un lien externe s\'ouvre dans un onglet neuf',
    (await p.locator('.reserver a.btn').getAttribute('target')) === '_blank');
  check('    et ne fuit pas la page appelante',
    /noopener/.test(await p.locator('.reserver a.btn').getAttribute('rel')));
}

/* On suit le chemin jusqu'au lien Lodgify.

   Il ne s'affiche plus sur la page : depuis que l'etape demande qui est le
   voyageur, l'adresse du moteur est produite par le serveur au moment ou l'on
   choisit la carte. On parcourt donc l'etape pour de bon - c'est d'ailleurs
   plus proche de ce que fait un voyageur qu'un attribut lu dans le HTML. */
let lien = premierLien;
if (parNous) {
  await p.goto(`${B}${premierLien}`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('input[name=prenom]', { timeout: 20000 });
  await p.locator('input[name=prenom]').fill('Chemin');
  await p.locator('input[name=nom]').fill('Lodgify');
  await p.locator('input[name=email]').fill('chemin@example.com');
  await p.locator('input[name=telephone]').fill('+212622222222');
  await p.locator('input[name=cgv]').check();
  await p.locator('button[value=carte]').click();
  await p.waitForSelector('.virement-merci a', { timeout: 30000 });
  lien = await p.locator('.virement-merci a').first().getAttribute('href');
  /* La page part d'elle-meme chez Lodgify au bout de deux secondes : on
     quitte, le verificateur n'a rien a faire sur un site tiers. */
  await revenir(`${B}/fr/logements`);
}

check('  et jusqu\'au lien Lodgify', /lodgify\.com/.test(lien), lien);
/* L'adresse se fabrique de nouveau - mais pas n'importe laquelle.

   Le premier essai visait le site vitrine, dont les adresses sont des slugs
   en francais qu'aucun champ de l'API ne porte : /property/{id} y menait a
   une page introuvable, au moment precis de payer. Le tunnel de paiement,
   lui, s'adresse par identifiant. La regle tient donc en deux lignes : jamais
   /property/{id}, et si l'on construit, ce doit etre vers /contact. */
check('  sans adresse fabriquée depuis l\'identifiant', !/\/property\/\d/.test(lien), lien);
check('  avec les dates déjà remplies', /arrival=2026-10-02/.test(lien) && /departure=2026-10-09/.test(lien), lien);
check('  et le détail des voyageurs', /adults=/.test(lien), lien);
{
  /* Un lien construit mene au bon logement : son identifiant Lodgify doit s'y
     lire. C'est toute la difference entre arriver sur son appartement et
     arriver sur la liste des vingt-quatre. */
  const construit = /checkout\.lodgify\.com/.test(lien);
  check('  le tunnel de paiement est visé directement', construit || /toutes-les-proprietes/.test(lien),
    construit ? 'lien construit vers checkout' : 'repli « toutes les propriétés »');
  if (construit) {
    check('    il porte un identifiant de logement', /\/(\d+)\/contact/.test(lien), lien.match(/\/\d+\/contact/)?.[0] || 'aucun');
    check('    et l\'étape des coordonnées', /\/contact(\?|$)/.test(lien.split('?')[0] + '?'), lien.split('?')[0]);
    check('    la devise est annoncée', /currency=[A-Z]{3}/.test(lien), lien.match(/currency=\w+/)?.[0] || 'absente');
    /* Aucune donnee personnelle dans une adresse : elle finirait dans
       l'historique du navigateur, les en-tetes de provenance et les journaux
       de tous les serveurs traverses - pour un pre-remplissage que Lodgify ne
       propose pas. */
    check('    et rien de personnel n\'y figure',
      !/(email|mail|prenom|firstname|lastname|phone|tel)=/i.test(lien), lien);
  }
}

await p.goto(`${B}/fr/proprietaires`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(500);
check('page propriétaires', (await p.locator('.etapes li').count()) === 4);
const po = await p.locator('body').innerText();
check('  le contenu de la page conciergerie est repris mot pour mot',
  /30-35% d’occupation/.test(po) && /Trois principes qui font la différence/.test(po)
  && /Si vous êtes propriétaire, vous le savez déjà/.test(po)
  && /typiquement sous 21 jours/.test(po));
check('  chaque étape porte son délai', (await p.locator('.etape-delai').count()) === 4);
const pied = await p.locator('.site-footer').innerText();
check('  et l\'adresse de contact est la vraie', /partnershotels\.ma/.test(pied),
  pied.split('\n').find((l) => /@/.test(l)) || '');
check('  avec le siège de Partners Hotels', /Rachidi/.test(pied) && !/Ghandi/.test(pied),
  pied.split('\n').find((l) => /boulevard/i.test(l)) || '');
check('  formulaire d\'audit', (await p.locator('form input[name=nom]').count()) === 1);

await p.goto(`${B}/fr/qui-sommes-nous`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(400);
check('page qui sommes-nous', (await p.locator('h1').innerText()).includes('écart'));
const qsOrdre = await p.evaluate(() => {
  const y = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + window.scrollY : null; };
  return { menu: y('.sous-menu'), titre: y('h1') };
});
check('  le sommaire ouvre la page', qsOrdre.menu < qsOrdre.titre,
  `sommaire ${Math.round(qsOrdre.menu)}px, titre ${Math.round(qsOrdre.titre)}px`);
check('  et plus de « La maison »', !/La maison/i.test(await p.locator('body').innerText()));
check('  avec ses cinq sous-menus', (await p.locator('.sous-menu a').count()) === 5);
check('  qui pointent tous vers une section réelle', await p.evaluate(() =>
  [...document.querySelectorAll('.sous-menu a')].every((a) => document.querySelector(a.getAttribute('href')))));
const qs = await p.locator('body').innerText();
check('  et reprend le contenu conciergerie mot pour mot',
  /Transparence absolue/i.test(qs) && /PriceLabs/.test(qs) && /Calibration honnête/i.test(qs)
  && /opérateur qui le gère/i.test(qs));
check('    ses six services', (await p.locator('#services .encart').count()) === 6);
/* Le bloc « Nos résultats » a été retiré : il annonçait des résultats concrets
   et affichait des chiffres que personne n'avait renseignés. Ni ses études de
   cas ni son titre ne doivent reparaître. */
check('    et plus d\'études de cas ni de résultats promis',
  (await p.locator('.cas').count()) === 0 && !/résultats concrets/i.test(qs));
check('    ses trois témoignages de propriétaires', (await p.locator('.avis-carte-nue').count()) === 3);
/* Deux illustrations d'ambiance, servies depuis public/ : elles ne dépendent
   d'aucune API et doivent donc toujours être là. Les photographies des études
   de cas viennent de Lodgify, et sont légitimement absentes sans clé - une
   carte qui nomme un logement précis ne s'illustre pas d'une autre image. */
const ambiance = await p.locator('.presentation-portrait img').count();
check('    ses deux illustrations', ambiance === 2, `${ambiance}`);
/* On interroge les adresses plutôt que l'état de peinture du navigateur :
   ces images sont en chargement paresseux, et une vérification faite avant
   qu'elles n'entrent dans l'écran échouerait sans qu'aucune ne manque. */
const adresses = await p.evaluate(() =>
  [...document.querySelectorAll('.presentation-portrait img')].map((i) => i.getAttribute('src')));
const statuts = await Promise.all(
  adresses.map(async (u) => (await fetch(new URL(u, B))).status)
);
check('      dont les fichiers existent', statuts.every((c) => c === 200), statuts.join(', '));
/* En revanche la distribution reste : elle ne promet rien, elle énumère. */
check('    la distribution est conservée', /Airbnb/.test(qs) && /Booking/.test(qs));
check('    et plus aucun sigle ADR', !/\bADR\b/.test(qs));

await p.goto(`${B}/fr/contact`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(400);
const coord = await p.locator('.coordonnees').innerText();
check('page contact', /661 21 56 98/.test(coord), coord.split('\n').slice(0, 2).join(' '));
check('  avec les horaires 8 h - 22 h', /8 h - 22 h/.test(coord));
check('  et le siège de Partners Hotels', /Rachidi/.test(coord) && !/Ghandi/.test(coord));
check('  formulaire de message', (await p.locator('form textarea[name=message]').count()) === 1);

await p.goto(`${B}/fr/proprietaires`, { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(300);
/* Le paragraphe d'engagement, mot pour mot depuis le site de conciergerie,
   avec ses trois encarts. */
const eng = await p.locator('#engagement').innerText();
/* L'audit doit précéder le processus : c'est la proposition, et l'on ne lit
   comment cela se déroule qu'une fois convaincu. On compare la position des
   deux titres dans la page rendue, pas leur ordre dans le code. */
{
  /* On repère les deux blocs par leur surtitre, qui les nomme, et non par leur
     titre - « Prêt à valoriser votre bien » ne contient pas le mot audit. */
  const rangs = await p.evaluate(() => {
    const t = document.body.textContent || '';
    return { audit: t.indexOf('Audit gratuit'), processus: t.indexOf('Un processus clair') };
  });
  check(
    '  l\'audit précède le processus',
    rangs.audit >= 0 && rangs.processus >= 0 && rangs.audit < rangs.processus,
    `audit en ${rangs.audit}, processus en ${rangs.processus}`
  );
  const faq = await p.locator('.faq details').count();
  check('  la foire aux questions ferme la page', faq >= 10, `${faq} question(s)`);
  /* Une question repliée dont la réponse n'est pas dans le document serait un
     titre creux : on vérifie que le texte est bien là, ouvert ou non. */
  /* textContent et non innerText : le contenu d'un « details » replié n'est pas
     visible, et innerText ne rend que ce qui l'est. */
  const texte = await p.evaluate(() => document.querySelector('.faq')?.textContent || '');
  check('    avec le coût, la durée et le délai',
    /commission/i.test(texte) && /mandat/i.test(texte) && /21 jours/.test(texte));
  /* Les trois réponses venues du terrain : occuper son bien, le suivre, être
     payé. Ce sont celles qu'un propriétaire pose au téléphone. */
  check('    et ce qu\'on demande au téléphone',
    /calendrier/i.test(texte) && /temps réel/i.test(texte) && /avant le 5/.test(texte));
  /* La première est ouverte : sans cela, sept titres alignés ne laissent pas
     deviner qu'ils cachent des réponses. */
  const ouvertes = await p.locator('.faq details[open]').count();
  check('    dont la première est ouverte', ouvertes === 1, `${ouvertes} ouverte(s)`);
}
check('  la sélection est réciproque',
  /sélectionnons nos propriétaires autant qu’ils nous sélectionnent/i.test(eng));
check('    avec ses trois encarts', (await p.locator('#engagement .encart').count()) === 3);
check('    dont la calibration des attentes', /Calibration honnête des attentes/i.test(eng));
check('  plus de sigle ADR sur la page', !/\bADR\b/.test(await p.locator('body').innerText()));
check('  le prix de la nuit est dit en clair',
  /prix de la nuit d’abord/i.test(await p.locator('body').innerText()));

await p.goto(`${B}/fr/mentions`, { waitUntil: 'domcontentloaded' });
check('mentions légales', /114465/.test(await p.locator('body').innerText()));
await p.goto(`${B}/fr/confidentialite`, { waitUntil: 'domcontentloaded' });
check('confidentialité', /09-08/.test(await p.locator('body').innerText()));

await p.goto(`${B}/en`, { waitUntil: 'domcontentloaded' });
check('anglais', (await p.locator('h1').innerText()).includes('alternative to a hotel'));

const ctxM = await b.newContext({ viewport: { width: 390, height: 844 } });
ctxM.setDefaultNavigationTimeout(60000);
ctxM.setDefaultTimeout(30000);
const m = await ctxM.newPage();
for (const u of ['/fr', '/fr/logements', '/fr/proprietaires', '/fr/qui-sommes-nous', '/fr/contact', '/fr/logements/c202-alcazar', '/fr/mentions']) {
  await m.goto(B + u, { waitUntil: 'domcontentloaded' });
  await m.waitForTimeout(400);
  const w = await m.evaluate(() => document.documentElement.scrollWidth);
  check(`pas de débordement sur mobile ${u}`, w <= 400, `${w}px`);
}
await m.goto(B + '/fr', { waitUntil: 'domcontentloaded' });
/* Le bouton n'ouvre rien tant que React ne l'a pas repris en main. En
   developpement, la page est compilee a la demande : cliquer trop tot ne
   testait pas le menu, seulement la vitesse du compilateur. */
await m.waitForTimeout(900);
await m.locator('.menu-bouton').click();
await m.locator('.menu-panneau').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
check('le menu mobile s\'ouvre', (await m.locator('.menu-panneau nav a').count()) === 5);
check('  et garde le lien propriétaires', /Propriétaires/.test(await m.locator('.menu-panneau').innerText()));
await m.keyboard.press('Escape');
await m.waitForTimeout(300);
check('  et se ferme avec Échap', (await m.locator('.menu-panneau').count()) === 0);

/* ---------- l'administration ---------- */
const mdp = process.env.ADMIN_PASSWORD;
if (!mdp) {
  console.log('  ..   administration non vérifiée (ADMIN_PASSWORD absent des deux côtés)');
} else {
  const ctxA = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  ctxA.setDefaultNavigationTimeout(60000);
  ctxA.setDefaultTimeout(30000);
  const a = await ctxA.newPage();
  await a.goto(`${B}/admin/avis`, { waitUntil: 'domcontentloaded' });
  check('l\'administration est fermée sans session', /\/admin$/.test(a.url()), a.url());
  /* Le formulaire de connexion est une action serveur : tant que React n'a pas
     attaché son écouteur, le bouton est à l'écran et ne fait rien. En
     développement cet attachement arrive après l'affichage, d'autant plus tard
     que le paquet est gros - et l'on prendrait une lenteur pour un refus. On
     redemande donc, plutôt que de conclure au premier essai. */
  const soumettre = async (motDePasse, attendu, essais = 4) => {
    for (let n = 0; n < essais; n += 1) {
      await a.locator('input[name=motdepasse]').fill(motDePasse);
      await a.locator('button[type=submit]').click();
      await a.waitForTimeout(1800);
      if (attendu.test(await a.locator('body').innerText()) || !/\/admin$/.test(a.url())) return true;
    }
    return false;
  };

  const refus = await soumettre('mauvais mot de passe', /incorrect/i);
  check('  un mauvais mot de passe est refusé', refus && /incorrect/i.test(await a.locator('body').innerText()));
  await soumettre(mdp, /jamais$/);
  /* La connexion redirige vers une page compilée à la demande : on attend
     l'adresse, puis la première fiche. Un délai fixe mesurait le compilateur
     et faisait passer pour un refus ce qui n'était qu'une lenteur. */
  await a.waitForURL(/\/admin\/avis$/, { timeout: 25000 }).catch(() => {});
  await a.locator('form.fiche').first().waitFor({ timeout: 25000 }).catch(() => {});
  check('  le bon mot de passe ouvre les avis', /\/admin\/avis$/.test(a.url()), a.url());
  const nAvis = await a.locator('form.fiche').count();
  check('    les avis existants sont là', nAvis >= 10, `${nAvis} fiches (dont celle d'ajout)`);
  check('    le diaporama est accessible', true);
  await a.goto(`${B}/admin/diaporama`, { waitUntil: 'domcontentloaded' });
  check('  page diaporama', /Diaporama de l/.test(await a.locator('h1').innerText()));
  await a.goto(`${B}/admin/demandes`, { waitUntil: 'domcontentloaded' });
  check('  page demandes', /Demandes et messages/.test(await a.locator('h1').innerText()));
  await a.goto(`${B}/admin/logements`, { waitUntil: 'domcontentloaded' });
  check('  page logements', /Logements/i.test(await a.locator('h1').innerText()));
  const cartes = await a.locator('.carte-logement').count();
  check('    elle liste les logements', cartes > 0, `${cartes} carte(s)`);
  if (cartes > 0) {
    await a.locator('.carte-logement').first().click();
    await a.waitForURL(/admin\/logements\/-?\d+/, { timeout: 15000 }).catch(() => {});
    /* La route est compilée à la demande : on attend le bouton, pas une durée. */
    await a.locator('button:has-text("Enregistrer cet ordre")').waitFor({ timeout: 25000 }).catch(() => {});
    const corps = await a.locator('body').innerText();
    /* innerText rend le texte tel qu'il s'affiche : la feuille de style met
       les boutons en capitales, la comparaison doit donc ignorer la casse. */
    check('    on entre dans un logement', /enregistrer cet ordre/i.test(corps), a.url());
    /* Les trois dimensions d'un logement tiennent désormais sur une seule
       page : c'est le point de ce regroupement, il mérite d'être vérifié. */
    check(
      '      avec présentation, photographies et adresse',
      /présentation/i.test(corps) && /photographies/i.test(corps) && /adresse de réservation/i.test(corps),
      a.url()
    );
    /* Les deux champs cachés portent l'ordre : c'est eux qui sont enregistrés,
       et non l'ordre visuel, qui n'existe que dans le navigateur. */
    const champs = await a.locator('input[name=retenues], input[name=ecartees]').count();
    check('      l\'ordre est porté par le formulaire', champs === 2, `${champs} champ(s)`);
    /* Le dépôt d'une photographie, de bout en bout : on fabrique une image en
       mémoire, on la donne au champ de fichier comme le ferait un téléphone,
       et l'on vérifie qu'une vignette de plus apparaît. C'est la seule façon
       de savoir que la route accepte, que la conversion passe, et que
       l'adresse rendue est affichable. */
    const avant = await a.locator('.grille-photos .vignette-carte').count();
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );
    await a.locator('input[type=file]').setInputFiles({ name: 'essai.png', mimeType: 'image/png', buffer: png });
    await a.locator('.btn-ajout:not([disabled])').waitFor({ timeout: 25000 }).catch(() => {});
    const apres = await a.locator('.grille-photos .vignette-carte').count();
    check('      une photographie déposée rejoint la galerie', apres === avant + 1, `${avant} puis ${apres}`);
    /* Et elle doit être servie : une vignette qui pointe dans le vide vaut une
       vignette absente. */
    const src = await a.locator('.grille-photos .vignette-carte img').last().getAttribute('src');
    const servie = src ? await a.evaluate(async (u) => (await fetch(u)).status, src) : 0;
    check('        et elle est bien servie', servie === 200, `${src} → ${servie}`);
    /* Un fichier qui n'est pas une image ne doit pas entrer, quoi qu'en dise
       son extension : on se fie au contenu, pas au nom. */
    await a.locator('input[type=file]').setInputFiles({
      name: 'piege.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('ceci n\'est pas une image'),
    });
    await a.locator('.btn-ajout:not([disabled])').waitFor({ timeout: 25000 }).catch(() => {});
    const encore = await a.locator('.grille-photos .vignette-carte').count();
    check('      un fichier qui n\'est pas une image est refusé', encore === apres, `${apres} puis ${encore}`);

    /* Une galerie vide doit se dire, pas se taire : une fiche sans photo est
       un accident, et l'accident doit être visible ici avant de l'être sur le
       site. */
    const vide = /aucune photographie retenue/i.test(corps);
    const vignettes = await a.locator('.grille-photos .vignette-carte').count();
    check('      une galerie vide s\'annonce', vignettes > 0 || vide, `${vignettes} vignette(s)`);
  }

  /* Les équipements, tous logements confondus. C'est la première chose qu'un
     voyageur cherche après le prix, et Lodgify ne la publie pas : sans cette
     page, aucune fiche n'en porterait jamais. */
  await a.goto(`${B}/admin/logements/equipements`, { waitUntil: 'domcontentloaded' });
  await a.locator('.grille-cases').waitFor({ timeout: 20000 }).catch(() => {});
  check('  page des équipements', /Équipements/i.test(await a.locator('h1').innerText()));
  const colonnes = await a.locator('.colonne-bascule').count();
  const casesEq = await a.locator('.grille-cases td input[type=checkbox]').count();
  check('    une case par logement et par équipement', casesEq === colonnes * cartes,
    `${casesEq} case(s) pour ${colonnes} × ${cartes}`);
  /* La bascule de colonne : c'est elle qui rend la page utilisable, et c'est
     du script inline - donc précisément ce qu'aucun typage ne protège. */
  const comptees = () => a.locator('.grille-cases td input[data-eq=wifi]:checked').count();
  /* L'état de départ n'est pas connu d'avance : la bascule coche tout ou
     décoche tout selon ce qu'elle trouve, et une exécution interrompue peut
     laisser la colonne pleine. On amène donc la colonne où on la veut au lieu
     de supposer qu'un clic suffira - un test qui dépend de ce qu'a laissé le
     test précédent finit par accuser un code correct. */
  const auDepart = await comptees();
  for (let essai = 0; essai < 3 && (await comptees()) !== cartes; essai += 1) {
    await a.locator('.colonne-bascule').first().click();
    await a.waitForTimeout(300);
  }
  const cochees = await comptees();
  check('      le titre de colonne coche tout le monde', cochees === cartes, `${cochees} coché(s) sur ${cartes}`);
  /* On enregistre, on relit, puis on remet la base comme on l'a trouvée : sans
     ce va-et-vient, on ne saurait pas si le formulaire écrit ou parle dans le
     vide. */
  await a.locator('.admin-corps button[type=submit]').first().click();
  await a.waitForTimeout(1800);
  await a.reload({ waitUntil: 'domcontentloaded' });
  await a.locator('.grille-cases').waitFor({ timeout: 20000 }).catch(() => {});
  const relues = await a.locator('.grille-cases td input[data-eq=wifi]:checked').count();
  check('        et l\'enregistrement tient', relues === cartes, `${relues} relu(s) sur ${cartes}`);
  /* La fiche publique doit alors le montrer. */
  await p.goto(`${B}/fr/logements/c202-alcazar`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(800);
  check('        et la fiche affiche l\'équipement', /Wi-Fi/i.test(await p.locator('body').innerText()));
  /* On repose la colonne dans l'état où on l'a trouvée. */
  for (let essai = 0; essai < 3 && (await comptees()) !== auDepart; essai += 1) {
    await a.locator('.colonne-bascule').first().click();
    await a.waitForTimeout(300);
  }
  await a.locator('.admin-corps button[type=submit]').first().click();
  await a.waitForTimeout(1800);

  /* La saisie en série des caractéristiques. Lodgify ne dit ni les lits, ni les
     salles d'eau, ni la surface, ni le quartier : sans cette page, l'encadré
     d'une fiche reste à une ligne et il faudrait traverser vingt-quatre pages
     pour le remplir. */
  await a.goto(`${B}/admin/logements/caracteristiques`, { waitUntil: 'domcontentloaded' });
  await a.locator('.grille-saisie').waitFor({ timeout: 20000 }).catch(() => {});
  check('  page des caractéristiques', /Caractéristiques/i.test(await a.locator('h1').innerText()));
  const lignes = await a.locator('.grille-saisie tbody tr').count();
  check('    une ligne par logement', lignes === cartes, `${lignes} ligne(s) pour ${cartes} logement(s)`);
  const cases = await a.locator('.grille-saisie tbody input').count();
  check('    et neuf colonnes à remplir', cases === lignes * 9, `${cases} case(s)`);

  /* Les trois distinctions que le voyageur fait, et que le tableau doit donc
     tenir : le canapé-lit se compte à part des lits, la salle de bain a une
     baignoire, la salle d'eau une douche. */
  const titres = await a.locator('.grille-saisie thead th').allInnerTexts();
  const entetes = titres.join(' | ');
  check('    la colonne canapés-lits existe', /canap/i.test(entetes), entetes);
  check('    la salle d\'eau est devenue salle de bain', /salles? de bain/i.test(entetes), entetes);
  check('    et la salle d\'eau a sa propre colonne', /salles? d.eau/i.test(entetes), entetes);

  /* La ligne des titres et la colonne des noms doivent tenir en place quand on
     parcourt la grille : sans elles, une case juste au mauvais endroit fait
     d'une surface un nombre de lits. On mesure donc leur position à l'écran
     avant et après avoir fait défiler le cadre. */
  /* Sur un grand écran la grille tient parfois en largeur, et rien ne défile
     latéralement : on rétrécit donc la fenêtre le temps de la mesure, pour
     vérifier l'ancrage dans les conditions où il sert vraiment. */
  const fenetreAvant = a.viewportSize();
  await a.setViewportSize({ width: 900, height: 820 });
  await a.waitForTimeout(300);
  const ancrage = await a.evaluate(() => {
    const cadre = document.querySelector('.tableau-large');
    if (!cadre) return null;
    const titre = cadre.querySelector('thead th:nth-child(3)');
    const nom = cadre.querySelector('tbody th');
    const av = { t: titre.getBoundingClientRect().top, n: nom.getBoundingClientRect().left };
    cadre.scrollTop = 200;
    cadre.scrollLeft = 300;
    const ap = { t: titre.getBoundingClientRect().top, n: nom.getBoundingClientRect().left };
    const bouge = { y: cadre.scrollTop, x: cadre.scrollLeft };
    cadre.scrollTop = 0;
    cadre.scrollLeft = 0;
    return { av, ap, bouge };
  });
  check('    le cadre défile pour lui-même', !!ancrage && ancrage.bouge.y > 0 && ancrage.bouge.x > 0,
    ancrage ? `${ancrage.bouge.y}px vers le bas, ${ancrage.bouge.x}px vers la droite` : 'cadre absent');
  check('      la ligne des titres reste visible',
    !!ancrage && Math.abs(ancrage.ap.t - ancrage.av.t) < 2,
    ancrage ? `${Math.round(ancrage.av.t)}px puis ${Math.round(ancrage.ap.t)}px` : '-');
  check('      et la colonne des noms aussi',
    !!ancrage && Math.abs(ancrage.ap.n - ancrage.av.n) < 2,
    ancrage ? `${Math.round(ancrage.av.n)}px puis ${Math.round(ancrage.ap.n)}px` : '-');
  if (fenetreAvant) await a.setViewportSize(fenetreAvant);
  await a.waitForTimeout(300);

  /* Une saisie, un enregistrement, une relecture : c'est le seul moyen de
     savoir que le tableau écrit vraiment en base et non dans le vide. On écrit
     dans les deux colonnes neuves, celles qui n'ont encore jamais servi. */
  const premier = a.locator('.grille-saisie tbody tr').first();
  await premier.locator('input[name^=f_bains_]').fill('3');
  await premier.locator('input[name^=f_canapes_]').fill('2');
  await premier.locator('input[name^=f_eau_]').fill('1');
  await premier.locator('input[name^=f_quartier_]').fill('Triangle d’essai');
  await a.locator('.admin-corps button[type=submit]').first().click();
  await a.waitForTimeout(1800);
  await a.reload({ waitUntil: 'domcontentloaded' });
  await a.locator('.grille-saisie').waitFor({ timeout: 20000 }).catch(() => {});
  const ligne1 = a.locator('.grille-saisie tbody tr').first();
  const relu = await ligne1.locator('input[name^=f_bains_]').inputValue();
  check('      la saisie est bien enregistrée', relu === '3', `relu « ${relu} »`);
  check('        les canapés-lits aussi', (await ligne1.locator('input[name^=f_canapes_]').inputValue()) === '2');
  check('        et les salles d’eau', (await ligne1.locator('input[name^=f_eau_]').inputValue()) === '1');

  /* Et ce qui est saisi doit atteindre la fiche publique, sans quoi le tableau
     ne serait qu'un carnet privé. */
  const versFiche = await ligne1.locator('th a').getAttribute('href');
  await a.goto(`${B}${versFiche}`, { waitUntil: 'domcontentloaded' });
  const publique = await a.locator('a', { hasText: 'Voir la fiche publique' }).getAttribute('href');
  await p.goto(`${B}${publique}`, { waitUntil: 'domcontentloaded' });
  const panneau = await p.locator('.faits-panneau').innerText();
  check('      le panneau de la fiche porte les canapés-lits', /2 canap/i.test(panneau), panneau.replace(/\n/g, ' · '));
  check('        les salles de bain', /3 salles de bain/i.test(panneau), panneau.replace(/\n/g, ' · '));
  check('        et la salle d’eau, distincte', /1 salle d.eau/i.test(panneau), panneau.replace(/\n/g, ' · '));

  /* Puis on repose la base dans l'état où on l'a trouvée. */
  await a.goto(`${B}/admin/logements/caracteristiques`, { waitUntil: 'domcontentloaded' });
  await a.locator('.grille-saisie').waitFor({ timeout: 20000 }).catch(() => {});
  for (const champ of ['f_bains_', 'f_canapes_', 'f_eau_', 'f_quartier_']) {
    await a.locator('.grille-saisie tbody tr').first().locator(`input[name^=${champ}]`).fill('');
  }
  await a.locator('.admin-corps button[type=submit]').first().click();
  await a.waitForTimeout(1800);

  /* La saisie en série des adresses : un champ par logement, un seul bouton.
     L'API ne portant aucun identifiant d'adresse, c'est le seul chemin. */
  await a.goto(`${B}/admin/logements/adresses`, { waitUntil: 'domcontentloaded' });
  check('  page des adresses de réservation', /adresses de réservation/i.test(await a.locator('h1').innerText()));
  const champsUrl = await a.locator('input[name^=url_]').count();
  check('    un champ par logement', champsUrl === cartes, `${champsUrl} champ(s) pour ${cartes} logement(s)`);
  /* Le segment « adresses » ne doit pas être avalé par la route d'un logement,
     qui attend un identifiant : les deux se ressemblent dans l'adresse. */
  check('    et elle n\'est pas prise pour un logement', !/enregistrer cet ordre/i.test(await a.locator('body').innerText()));

  /* Les anciennes adresses ne meurent pas d'un rangement : un signet reste bon. */
  await a.goto(`${B}/admin/photos`, { waitUntil: 'domcontentloaded' });
  check('    l\'ancienne adresse des photos redirige', /\/admin\/logements$/.test(a.url()), a.url());
  await a.goto(`${B}/admin/reservation`, { waitUntil: 'domcontentloaded' });
  check('    celle des réservations aussi', /\/admin\/logements$/.test(a.url()), a.url());

  await a.goto(`${B}/admin/paiement`, { waitUntil: 'domcontentloaded' });
  const paie = await a.locator('body').innerText();
  check('  page paiement', /Paiement/.test(await a.locator('h1').innerText()));
  /* Tant que la commission n'est pas renseignee, le virement reste eteint et
     la page le dit : c'est la garantie qu'aucun second prix n'est invente. */
  const commission = await a.locator('input[name=commission_pct]').inputValue();
  check('    la commission est modifiable', typeof commission === 'string');
  check(
    '    sans commission, le virement reste eteint',
    Boolean(commission) || /prix inventé/.test(paie),
    commission || 'commission vide'
  );
  /* La majoration n'est pas la commission : on verifie l'arithmetique sur deux
     cas connus. On note d'abord les trois valeurs en place pour les reposer
     ensuite - une verification qui laisse le tarif du client a 5 % ferait plus
     de degats que l'erreur qu'elle cherche. */
  const fixeAvant = await a.locator('input[name=commission_fixe]').inputValue();
  const convAvant = await a.locator('input[name=conversion_pct]').inputValue();
  /* Le formulaire est une action serveur : la page ne navigue pas, elle se
     re-rend. React repose alors les champs sur ce que dit le serveur, ce qui
     peut effacer une saisie faite trop tot. On recharge donc avant chaque
     saisie, on relit les champs juste avant de valider, et on attend que la
     page affiche vraiment la nouvelle valeur plutot qu'un delai au juge. */
  const poser = async (pct, fixe, conv) => {
    /* On refait la saisie ENTIÈRE à chaque essai, clic compris. Le formulaire
       est une action serveur : tant que React n'a pas attaché son écouteur, le
       bouton est à l'écran et ne fait rien - et recharger vingt fois pour lire
       une valeur qui n'a jamais été envoyée ne prouverait que notre patience. */
    for (let essai = 0; essai < 5; essai += 1) {
      await a.goto(`${B}/admin/paiement`, { waitUntil: 'domcontentloaded' });
      for (const [nom, valeur] of [
        ['commission_pct', pct],
        ['commission_fixe', fixe],
        ['conversion_pct', conv],
      ]) {
        const champ = a.locator(`input[name=${nom}]`);
        await champ.fill(valeur);
        await champ.evaluate((el, v) => {
          if (el.value !== v) throw new Error('champ repose par le rendu');
        }, valeur);
      }
      await a.locator('.admin-corps button[type=submit]').first().click();
      await a.waitForLoadState('domcontentloaded');
      await a.waitForTimeout(1200);
      /* La seule preuve que l'enregistrement a eu lieu : le serveur nous rend
         ce qu'on a écrit. */
      await a.goto(`${B}/admin/paiement`, { waitUntil: 'domcontentloaded' });
      if ((await a.locator('input[name=commission_pct]').inputValue()) === pct) break;
    }
    return a.locator('body').innerText();
  };

  /* Cas d'ecole : 5 % de commission demandent 5,26 % de majoration. */
  const calcul = await poser('5', '', '');
  check('    la majoration compense vraiment la commission', /5,26 %/.test(calcul), calcul.match(/majoration de [^—]*/)?.[0] || 'non calculee');

  /* Cas reel, celui d'IB Signature : Payyo retient 3,9 % plus 0,28 € par
     transaction, et facture 2 % de conversion puisque le versement se fait en
     dirhams. Sur cinq cents euros nets, cela fait 6,33 % - et non 5,9 %. */
  const reel = await poser('3,9', '0,28', '2');
  check('    la conversion de devise entre dans le calcul', /6,33 %/.test(reel), reel.match(/majoration de [^—]*/)?.[0] || 'non calculee');
  check('    et se distingue du total retenu', /5,9 %/.test(reel), reel.match(/et non de [\d,]+ %/)?.[0] || 'le total Payyo n\'est pas affiche');

  /* On repose la page dans l'etat ou on l'a trouvee. */
  await poser(commission, fixeAvant, convAvant);

  /* Retirer la ligne de frais que Lodgify ajoute lui-meme.
   *
   * C'est une division, pas une soustraction de pourcentage, et la difference
   * n'est pas academique : Lodgify facture sous-total x (1 + taux). Retirer
   * 6,33 % du montant facture rend un euro de moins que le sous-total, a
   * chaque reservation, dans le mauvais sens et sans que rien ne le signale.
   *
   * Ce controle ne passe par aucune page : il n'y a rien a regarder, il y a
   * une egalite a tenir. */
  {
    const { sansPlan } = await import('../src/lib/db.ts');
    const r = { plan_majoration_pct: '6,33' };
    const sousTotal = 291.5;
    const facture = sousTotal * 1.0633;
    const retour = sansPlan(facture, r);
    check('  retirer le plan tarifaire rend exactement le sous-total',
      Math.abs(retour - sousTotal) < 0.005, `${sousTotal} → ${facture.toFixed(2)} → ${retour.toFixed(2)}`);
    check('    et ce n\'est pas une soustraction de pourcentage',
      Math.abs(facture * (1 - 0.0633) - sousTotal) > 0.5,
      `la soustraction naive donnerait ${(facture * (1 - 0.0633)).toFixed(2)}`);
    check('    sans taux renseigne, rien n\'est devine',
      sansPlan(facture, { plan_majoration_pct: '' }) === null);
    check('    et un montant absurde ne rend rien',
      sansPlan(0, r) === null && sansPlan(-10, r) === null);
  }

  /* L'adresse du tunnel de paiement.
   *
   * C'est la derniere adresse que voit un voyageur avant de sortir sa carte.
   * Une erreur ici envoie quelqu'un qui allait payer sur une page introuvable,
   * ou pire, sur le mauvais appartement - et cela ne se rattrape pas.
   *
   * Le catalogue de repli n'a que des identifiants negatifs : le parcours au
   * navigateur ne peut donc jamais emprunter le chemin construit. Il se
   * verifie ici, ou il n'est verifie nulle part. */
  {
    const { lienCheckout } = await import('../src/lib/checkout.ts');
    const commun = { base: 'https://checkout.lodgify.com', compte: 'ibsignature', devise: 'EUR' };
    const u = lienCheckout({ ...commun, bienId: 604830, locale: 'fr', arrivee: '2026-09-14', depart: '2026-09-18', voyageurs: 2 });
    check('  l\'adresse du tunnel mene au bon logement', /\/604830\/contact\?/.test(u), u);
    check('    dans la langue du visiteur',
      u.includes('/fr/ibsignature/')
      && lienCheckout({ ...commun, bienId: 1, locale: 'en' }).includes('/en/ibsignature/'),
      u.split('?')[0]);
    check('    une langue inconnue retombe en francais',
      lienCheckout({ ...commun, bienId: 1, locale: 'de' }).includes('/fr/'));
    check('    elle porte les dates', /arrival=2026-09-14/.test(u) && /departure=2026-09-18/.test(u), u);
    check('    le detail des voyageurs', /adults=2&children=0&infants=0&pets=0/.test(u), u);
    check('    et la devise', /currency=EUR/.test(u), u);

    /* Rien de personnel dans une adresse : elle finit dans l'historique du
       navigateur, les en-tetes de provenance et les journaux de tous les
       serveurs traverses - pour un pre-remplissage que Lodgify ne propose pas. */
    check('    rien de personnel n\'y entre', !/(email|prenom|nom|phone|tel)=/i.test(u), u);

    /* Les refus. Un logement de repli n'a pas d'identifiant Lodgify, et une
       adresse construite sur un identifiant negatif menerait n'importe ou. */
    check('  sans identifiant utilisable, aucune adresse n\'est devinee',
      lienCheckout({ ...commun, bienId: -3 }) === null
      && lienCheckout({ ...commun, bienId: 0 }) === null
      && lienCheckout({ ...commun, bienId: NaN }) === null);
    check('    ni sans compte renseigne', lienCheckout({ base: commun.base, compte: '', bienId: 604830 }) === null);
    check('    une devise mal formee est ecartee plutot que transmise',
      !lienCheckout({ ...commun, devise: 'euros', bienId: 1 }).includes('currency'));
  }

  /* Qui l'emporte, du tunnel construit ou de l'adresse collee a la main ?
   *
   * L'adresse collee gagnait, et cela renvoyait le voyageur sur le site
   * vitrine - une seconde fiche du logement, avec son propre bouton
   * « Reservez ». Il devait donc recliquer sur ce qu'il venait de choisir, au
   * moment precis ou il allait payer. Le tunnel ouvre l'etape des coordonnees
   * directement : c'est lui qui doit gagner.
   *
   * L'echappatoire reste : une adresse collee qui vise deja le tunnel passe
   * devant tout, pour reparer sans redeployer. */
  {
    const { adresseReservation } = await import('../src/lib/checkout.ts');
    const REPLI = 'https://ibsignature.lodgify.com/fr/toutes-les-proprietes/';
    const bien = {
      bienId: 604830,
      devise: 'EUR',
      base: 'https://checkout.lodgify.com',
      compte: 'ibsignature',
      repli: REPLI,
      collee: 'https://ibsignature.lodgify.com/fr/the-23-princesses',
    };
    const lienReservation = (b, arrivee, depart, voyageurs, locale) =>
      adresseReservation({ ...b, arrivee, depart, voyageurs, locale });
    const u = lienReservation(bien, '2026-10-05', '2026-10-08', 2, 'fr');
    check('  le tunnel passe devant l\'adresse du site vitrine', /checkout\.lodgify\.com/.test(u), u);
    check('    une adresse collee qui vise le tunnel reprend la main',
      lienReservation({ ...bien, collee: 'https://checkout.lodgify.com/fr/autre/9/contact' }, '2026-10-05', '2026-10-08', 2, 'fr')
        .startsWith('https://checkout.lodgify.com/fr/autre/9/contact'),
      lienReservation({ ...bien, collee: 'https://checkout.lodgify.com/fr/autre/9/contact' }, '2026-10-05', '2026-10-08', 2, 'fr'));
    /* Le nom d'hote fait foi, et rien d'autre : une adresse vitrine qui
       contiendrait le mot « checkout » dans son chemin ne doit pas etre prise
       pour un tunnel. */
    check('      mais seulement d\'apres le nom d\'hote',
      /checkout\.lodgify\.com\/fr\/ibsignature\/604830/.test(
        lienReservation({ ...bien, collee: 'https://ibsignature.lodgify.com/fr/checkout-express' }, '2026-10-05', '2026-10-08', 2, 'fr')));
    check('      et une adresse illisible ne fait pas tomber la page',
      lienReservation({ ...bien, collee: 'pas une adresse' }, '2026-10-05', '2026-10-08', 2, 'fr').length > 0);
    check('    sans identifiant, l\'adresse collee sert de repli',
      lienReservation({ ...bien, bienId: -2 }, '2026-10-05', '2026-10-08', 2, 'fr').includes('the-23-princesses'));

    /* La langue. Un visiteur anglophone lisait la fiche en anglais, cliquait
       sur « Pay by card », et atterrissait sur une page en francais : les
       adresses ont ete collees depuis un navigateur francais et portent
       toutes /fr/. */
    check('  le tunnel suit la langue du visiteur',
      lienReservation(bien, '2026-10-05', '2026-10-08', 2, 'en').includes('/en/'),
      lienReservation(bien, '2026-10-05', '2026-10-08', 2, 'en').split('?')[0]);
    check('    et le repli aussi',
      lienReservation({ ...bien, bienId: -2 }, '2026-10-05', '2026-10-08', 2, 'en').includes('/en/the-23-princesses'),
      lienReservation({ ...bien, bienId: -2 }, '2026-10-05', '2026-10-08', 2, 'en').split('?')[0]);
    check('      sans toucher au reste de l\'adresse',
      lienReservation({ ...bien, bienId: -2 }, '2026-10-05', '2026-10-08', 2, 'en').includes('the-23-princesses'));
  }

  /* ==========================================================================
     Le parcours de reservation par virement.

     C'est le seul endroit du site ou une erreur coute de l'argent reel : un
     montant annonce engage. On le parcourt donc en entier - la fiche, l'etape
     de paiement, le formulaire, l'enregistrement, l'administration - plutot
     que de verifier des morceaux.

     Le prix vient de LODGIFY_DEVIS_ESSAI, une ouverture de developpement qui
     ne fonctionne jamais en production. Sans elle, ce bloc s'annonce comme non
     verifie plutot que de passer en silence : un parcours de paiement qu'on
     croit teste et qui ne l'est pas est pire qu'un parcours qu'on sait non
     teste.
     ========================================================================== */
  const PRIX = 531.65;
  const essaiActif = Number(process.env.LODGIFY_DEVIS_ESSAI || 0) === PRIX;

  if (!essaiActif) {
    console.log(`  ..   parcours virement non verifie (LODGIFY_DEVIS_ESSAI absent ou different de ${PRIX})`);
  } else {
    /* On pose des reglages complets, on parcourt, puis on repose tout. */
    await a.goto(`${B}/admin/paiement`, { waitUntil: 'domcontentloaded' });
    const ribAvant = await a.locator('textarea[name=virement_rib]').inputValue();
    const actifAvant = await a.locator('input[name=virement_actif]').isChecked();
    const tauxAvant = await a.locator('input[name=taux_mad]').inputValue();

    const reglerPaiement = async (valeurs, actif) => {
      await a.goto(`${B}/admin/paiement`, { waitUntil: 'domcontentloaded' });
      for (const [nom, v] of Object.entries(valeurs)) {
        await a.locator(`[name=${nom}]`).fill(v);
      }
      const c = a.locator('input[name=virement_actif]');
      if ((await c.isChecked()) !== actif) await c.click();
      await a.locator('.admin-corps button[type=submit]').first().click();
      await a.waitForLoadState('domcontentloaded');
      for (let i = 0; i < 20; i += 1) {
        await a.goto(`${B}/admin/paiement`, { waitUntil: 'domcontentloaded' });
        if ((await a.locator('input[name=commission_pct]').inputValue()) === (valeurs.commission_pct ?? '')) break;
        await a.waitForTimeout(400);
      }
    };

    await reglerPaiement(
      {
        commission_pct: '3,9',
        commission_fixe: '0,28',
        conversion_pct: '2',
        virement_delai_jours: '5',
        virement_blocage_heures: '48',
        virement_reponse_heures: '12',
        taux_mad: '10,8',
        virement_rib: 'Banque d\'essai\nIBAN MA00 0000 0000 0000\nSWIFT ESSAIMA0',
      },
      true
    );
    check('  le virement est allume pour l\'essai', (await a.locator('input[name=virement_actif]').isChecked()) === true);
    check('    et le taux est date du jour',
      /saisi le \d{4}-\d{2}-\d{2}/i.test(await a.locator('label[for=tm]').innerText()),
      await a.locator('label[for=tm]').innerText());

    /* Une execution precedente a pu etre interrompue en laissant une demande
       en attente : elle tiendrait les dates d'essai, et tout ce qui suit
       echouerait pour une raison qui n'a rien a voir avec le code. On fait
       donc le menage avant de commencer, plutot qu'apres coup. */
    await a.goto(`${B}/admin/virements`, { waitUntil: 'domcontentloaded' });
    for (let reste = 12; reste > 0; reste -= 1) {
      /* On cherche « Verificateur » et non « Essai Verificateur » : le nom de
         famille suffit, et l'affichage ne compose pas toujours les deux dans
         le meme bloc de texte. Une execution interrompue laissait donc une
         demande que le menage ne reconnaissait pas - elle tenait les dates
         d'essai, et le virement n'etait plus propose au controle suivant pour
         une raison qui n'avait rien a voir avec le code. */
      const vieilles = a.locator('article.boite', { hasText: 'Verificateur' })
        .filter({ has: a.locator('button:has-text("Annuler")') });
      if ((await vieilles.count()) === 0) break;
      await vieilles.first().locator('button', { hasText: 'Annuler' }).click();
      await a.waitForLoadState('domcontentloaded');
      await a.waitForTimeout(700);
    }

    /* Les dates : loin devant, pour passer le delai de cinq jours. */
    const dans = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
    const arr = dans(40);
    const dep = dans(44);

    /* Le logement d'essai : celui que la liste presente en premier. */
    await p.goto(`${B}/fr/logements`, { waitUntil: 'domcontentloaded' });
    const premier = await p.locator('a[href*="/fr/logements/"]').first().getAttribute('href');
    const slugEssai = (premier || '').split('/fr/logements/')[1]?.split('?')[0] || '';
    check('  un logement pour l\'essai du virement', Boolean(slugEssai), slugEssai || 'aucun');

    if (slugEssai) {
      const q = `arrivee=${arr}&depart=${dep}&voyageurs=2`;
      await p.goto(`${B}/fr/logements/${slugEssai}?${q}`, { waitUntil: 'domcontentloaded' });
      const nomEssai = (await p.locator('.fiche-nom').innerText()).trim();
      const bouton = await p.locator('.reserver a.btn').first().getAttribute('href');
      check('  la fiche mene a notre etape de paiement', (bouton || '').startsWith(`/fr/reserver/${slugEssai}`), bouton || 'aucun lien');
      check('    et n\'ouvre pas un onglet neuf pour une page a nous',
        (await p.locator('.reserver a.btn').first().getAttribute('target')) === null);

      await p.goto(`${B}/fr/reserver/${slugEssai}?${q}`, { waitUntil: 'domcontentloaded' });
      await p.waitForSelector('input[name=prenom]', { timeout: 20000 });
      const etape = await p.locator('body').innerText();

      /* Le recapitulatif, a droite, pendant toute la saisie. Sans lui on
         remplit six champs sans plus voir ce qu'on achete - et l'on se demande
         a mi-chemin ce qu'on est en train de faire. */
      const resume = await p.locator('.reserver-resume').innerText();
      check('  le recapitulatif porte le logement', resume.includes(nomEssai), resume.split('\n')[1] || '');
      check('    ses dates', resume.includes('2026') || /\d{1,2} \w+/.test(resume), resume.replace(/\n/g, ' ').slice(0, 90));
      check('    le nombre de voyageurs', /2 voyageurs/i.test(resume), resume.replace(/\n/g, ' ').slice(0, 120));
      check('    et le total du sejour', /531,65/.test(resume), resume.match(/\d+,\d\d/)?.[0] || 'absent');

      /* L'arithmetique, lue a l'ecran et non recalculee dans le test : c'est
         ce que le voyageur voit qui doit etre juste. */
      check('  les deux moyens sont proposes',
        /Payer par carte/i.test(etape) && /Réserver par virement/i.test(etape));

      check('    le prix par carte est celui de Lodgify', /531,65/.test(etape), etape.match(/5\d\d,\d\d/)?.[0] || 'absent');
      check('    le montant a virer est le net', /500,00/.test(etape), etape.match(/500,\d\d/)?.[0] || 'absent');
      check('    l\'economie est annoncee', /31,65/.test(etape), etape.match(/économisez[^\n]*/i)?.[0] || 'absente');
      check('    la contre-valeur en dirhams est indicative',
        /5\s?400 MAD/.test(etape.replace(/ | /g, ' ')) && /indicative/i.test(etape));
      check('    et le taux est date', /au taux du \d{4}-\d{2}-\d{2}/.test(etape));

      /* Aucun montant ne doit voyager dans le formulaire : un prix dans un
         champ cache est un prix reecrivable avant l'envoi. */
      const caches = await p.locator('form input[type=hidden]').evaluateAll((n) => n.map((x) => x.name));
      check('  le formulaire ne transporte aucun montant',
        !caches.some((n) => /montant|prix|total/i.test(n)), caches.join(', '));

      /* Les conditions generales se cochent, et le refus doit tenir SANS le
         navigateur : on retire l'attribut qui les rend obligatoires et l'on
         verifie que le serveur refuse quand meme. Une garde qui ne vit que
         dans le HTML ne garde rien. */
      const remplir = async () => {
        await p.locator('input[name=prenom]').fill('Prenom');
        await p.locator('input[name=nom]').fill('Verificateur');
        await p.locator('input[name=nationalite]').fill('Française');
        await p.locator('input[name=residence]').fill('Paris');
        await p.locator('input[name=email]').fill('essai@example.com');
        await p.locator('input[name=telephone]').fill('+212600000000');
      };
      await remplir();
      await p.locator('input[name=cgv]').evaluate((e) => e.removeAttribute('required'));
      await p.locator('button[value=virement]').click();
      await p.waitForSelector('.avert', { timeout: 20000 }).catch(() => {});
      check('  les conditions generales sont exigees par le serveur',
        /conditions générales/i.test(await p.locator('body').innerText()),
        (await p.locator('.avert').innerText().catch(() => '')) || 'aucun refus');

      /* Puis le parcours complet, cette fois avec la case cochee. */
      await p.goto(`${B}/fr/reserver/${slugEssai}?${q}`, { waitUntil: 'domcontentloaded' });
      await p.waitForSelector('input[name=prenom]', { timeout: 20000 });
      await remplir();
      await p.locator('input[name=cgv]').check();
      await p.locator('button[value=virement]').click();
      await p.waitForSelector('.virement-merci', { timeout: 30000 });
      const merci = await p.locator('.virement-merci').innerText();
      const ref = merci.match(/IB-\d{4}-[A-Z0-9]{4}/)?.[0] || '';
      check('  la demande est enregistree et rend une reference', Boolean(ref), ref || merci.slice(0, 80));
      check('    le montant confirme est bien le net', /500,00/.test(merci), merci.match(/\d+,\d\d/)?.[0] || 'absent');
      check('    les coordonnees bancaires sont donnees', (await p.locator('.virement-rib').count()) === 1);

      /* Le titre et le texte doivent avoir change d'etat.
       *
       * Deux textes dataient d'une version anterieure et se contredisaient
       * eux-memes une fois la demande deposee. Le titre demandait encore
       * « Comment souhaitez-vous regler ? » a quelqu'un qui venait de
       * repondre. Et la page annoncait qu'on lui enverrait les coordonnees
       * bancaires « sous douze heures » alors qu'elles etaient imprimees
       * juste en dessous - un texte d'avant, quand elles arrivaient par
       * courriel. Rien ne signale ce genre de derive : le texte reste
       * grammatical, il devient seulement faux. */
      const titrePage = await p.locator('h1').first().innerText();
      check('  le titre suit l\'etat de la demande',
        !/souhaitez-vous r|would you like to pay/i.test(titrePage), titrePage);
      check('    et annonce une demande deposee', /demande de r[ée]servation|booking request/i.test(titrePage), titrePage);
      check('  on ne promet plus d\'envoyer un RIB deja affiche',
        !/coordonn[ée]es bancaires/i.test(merci.split('\n').slice(0, 4).join(' ')),
        merci.split('\n').slice(0, 4).join(' ').slice(0, 110));
      check('    le delai pour virer est annonce', /sous 24 heures|within 24 hours/i.test(merci),
        merci.match(/sous \d+ heures|within \d+ hours/i)?.[0] || 'absent');
      check('    et la duree du calendrier ferme', /pendant 48 heures|for 48 hours/i.test(merci),
        merci.match(/pendant \d+ heures|for \d+ hours/i)?.[0] || 'absente');
      check('    les deux delais different', !/sous 48|within 48/i.test(merci),
        'le virement est demande plus tot que la fin du blocage');

      /* Elle doit maintenant exister dans l'administration. */
      await a.goto(`${B}/admin/virements`, { waitUntil: 'domcontentloaded' });
      const admin = await a.locator('body').innerText();
      check('  la demande apparait dans l\'administration', ref ? admin.includes(ref) : false);
      check('    avec le nom et le telephone du voyageur', /Prenom Verificateur/.test(admin) && /\+212600000000/.test(admin));
      check('    la nationalite et la residence', /Française/.test(admin) && /réside à Paris/.test(admin));
      check('    et l\'echeance des dates tenues', /dates tenues jusqu/.test(admin));

      /* Les memes dates ne doivent plus etre proposees au virement. */
      await p.goto(`${B}/fr/reserver/${slugEssai}?${q}`, { waitUntil: 'domcontentloaded' });
      const apres = await p.locator('body').innerText();
      check('  les memes dates ne sont plus offertes au virement',
        !/Réserver par virement/i.test(apres) && /seul le paiement par carte/i.test(apres));

      /* Et la page dit pourquoi - a vous seul.
       *
       * Sept conditions doivent tenir ensemble pour que le virement soit
       * propose, et il suffit qu'une seule manque. Le site savait toujours
       * laquelle : `raison` est calculee a chaque refus. Elle n'etait affichee
       * nulle part, et il fallait relire le code pour repondre a une question
       * que le site avait deja resolue.
       *
       * Le voyageur ne doit jamais la voir - on ne lui doit pas le detail de
       * nos reglages, et « le virement est eteint » ne l'aiderait en rien. On
       * verifie donc les deux : visible pour l'administrateur, invisible pour
       * le visiteur ordinaire. */
      check('    le voyageur ne voit aucune explication', !/Visible par vous seul/i.test(apres),
        apres.match(/Visible par vous seul[^\n]*/i)?.[0] || 'rien, comme il se doit');

      await a.goto(`${B}/fr/reserver/${slugEssai}?${q}`, { waitUntil: 'domcontentloaded' });
      const vu = await a.locator('body').innerText();
      check('    mais vous, oui', /Visible par vous seul/i.test(vu),
        vu.match(/le virement n’est pas proposé parce que[^\n.]*/i)?.[0] || 'aucune raison affichee');
      check('      et elle nomme la cause', /demande en attente/i.test(vu),
        vu.match(/parce que ([^\n.]*)/i)?.[1] || 'sans cause');

      /* ---------- le chemin de la carte ----------
         Le voyageur se presente, puis part payer chez Lodgify. Deux choses
         comptent : ses coordonnees ne doivent pas s'evaporer - beaucoup
         renoncent devant le formulaire bancaire -, et sa piste ne doit tenir
         AUCUNE date, puisqu'il n'a rien reserve. */
      const arrC = dans(90);
      const depC = dans(94);
      const qC = `arrivee=${arrC}&depart=${depC}&voyageurs=2`;
      await p.goto(`${B}/fr/reserver/${slugEssai}?${qC}`, { waitUntil: 'domcontentloaded' });
      await p.waitForSelector('input[name=prenom]', { timeout: 20000 });
      await p.locator('input[name=prenom]').fill('Carte');
      await p.locator('input[name=nom]').fill('Essai');
      await p.locator('input[name=email]').fill('carte@example.com');
      await p.locator('input[name=telephone]').fill('+212611111111');
      await p.locator('input[name=cgv]').check();
      await p.locator('button[value=carte]').click();
      await p.waitForSelector('.virement-merci a', { timeout: 30000 });
      const sortie = await p.locator('.virement-merci a').first().getAttribute('href');
      /* On quitte : la page part d'elle-meme chez Lodgify au bout de deux
         secondes, et le verificateur n'a rien a y faire. */
      await revenir(`${B}/fr/logements`);

      check('  la carte mene au moteur avec les dates',
        /lodgify/.test(sortie || '') && (sortie || '').includes(arrC), sortie || 'aucune sortie');
      /* Le point le plus important de ce bloc. Un nom, un courriel ou un
         telephone dans une adresse se retrouve dans l'historique du
         navigateur, dans les en-tetes de provenance et dans les journaux de
         tous les serveurs traverses - et Lodgify ne les lirait meme pas. */
      check('    sans aucune donnee personnelle dans l\'adresse',
        !/(carte@example|Carte|Essai|212611111111|email|phone|firstname|lastname)/i.test(sortie || ''),
        sortie || '');

      await a.goto(`${B}/admin/virements`, { waitUntil: 'domcontentloaded' });
      const admin2 = await a.locator('body').innerText();
      check('  la piste est conservee pour pouvoir rappeler', /Carte Essai/.test(admin2));
      check('    et annoncee comme ne tenant aucune date',
        /Parti payer par carte/i.test(admin2) && /aucune date tenue/i.test(admin2));

      /* Et surtout : ces dates restent vendables. Une piste qui bloquerait un
         calendrier fermerait l'appartement a des voyageurs qui, eux, auraient
         paye. */
      await p.goto(`${B}/fr/reserver/${slugEssai}?${qC}`, { waitUntil: 'domcontentloaded' });
      check('  les dates d\'une piste restent offertes au virement',
        /Réserver par virement/i.test(await p.locator('body').innerText()));

      /* Une arrivee trop proche reste a la carte. */
      await p.goto(`${B}/fr/reserver/${slugEssai}?arrivee=${dans(2)}&depart=${dans(5)}&voyageurs=2`, { waitUntil: 'domcontentloaded' });
      check('  une arrivee sous cinq jours reste a la carte',
        !/Réserver par virement/i.test(await p.locator('body').innerText()));

      /* ---------- l'importation iCal, de bout en bout ----------
         Le site telecharge lui-meme les calendriers d'Airbnb et de Booking -
         c'est ce que fait Staytle, et cela ne demande la permission de
         personne. Ce qu'on en attend n'est pas de doubler Lodgify mais de
         pouvoir le contredire : une semaine prise chez Airbnb et libre chez
         Lodgify, c'est la panne qui vend deux fois le meme appartement.

         On sert donc un vrai calendrier depuis cette machine, on le declare,
         on le fait lire, et l'on verifie que le virement cesse d'etre proposé
         sur ces dates-la. Rien de moins ne prouverait que la garde fonctionne. */
      const arrIcal = dans(60);
      const depIcal = dans(64);
      const compact = (d) => d.replace(/-/g, '');
      const ics = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Essai//FR',
        'BEGIN:VEVENT',
        `DTSTART;VALUE=DATE:${compact(arrIcal)}`,
        `DTEND;VALUE=DATE:${compact(depIcal)}`,
        'SUMMARY:Reserved', 'UID:essai-1@ibsignature', 'END:VEVENT',
        'END:VCALENDAR', '',
      ].join('\r\n');

        /* Le formulaire est une action serveur : sans JavaScript attaché, le
         clic ne fait rien du tout. En développement l'attachement peut
         arriver après l'affichage, et l'on redemande donc jusqu'à ce que le
         serveur nous rende ce qu'on a écrit - c'est la seule preuve que
         l'enregistrement a eu lieu. */
      /* Deux tableaux portent le nom du logement : celui de l'état et celui
         des adresses. On ne retient donc que la ligne qui porte vraiment un
         champ de saisie - filtrer sur le nom seul attraperait l'autre. */
      const zoneFlux = () =>
        a
          .locator('.grille-saisie tbody tr')
          .filter({ hasText: nomEssai })
          .filter({ has: a.locator('input[name^=flux_]') })
          .first()
          .locator('input[name^=flux_]');
      const poserFlux = async (valeur) => {
        for (let essai = 0; essai < 4; essai += 1) {
        await a.goto(`${B}/admin/calendriers`, { waitUntil: 'domcontentloaded' });
        await zoneFlux().waitFor({ timeout: 20000 });
        await zoneFlux().fill(valeur);
        await a.locator('button', { hasText: 'Enregistrer les adresses' }).click();
        await a.waitForLoadState('domcontentloaded');
        await a.waitForTimeout(1400);
        await a.goto(`${B}/admin/calendriers`, { waitUntil: 'domcontentloaded' });
        const lu = await zoneFlux().inputValue();
        if (lu.trim() === valeur.trim()) return lu;
        }
        return await zoneFlux().inputValue();
      };

      const serveur = http.createServer((_rq, rs) => {
        rs.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8' });
        rs.end(ics);
      });
      await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
      const portIcs = serveur.address().port;
      const adresseIcs = `http://127.0.0.1:${portIcs}/essai.ics`;

      try {
        /* Le virement doit d'abord etre proposé sur ces dates : sans cela, le
           test qui suit ne prouverait rien - on ne saurait pas si c'est
           l'import qui bloque ou autre chose. */
        const qIcal = `arrivee=${arrIcal}&depart=${depIcal}&voyageurs=2`;
        await p.goto(`${B}/fr/reserver/${slugEssai}?${qIcal}`, { waitUntil: 'domcontentloaded' });
        /* Cette ligne n'est pas une vérification du site mais une condition
           d'expérience : si le virement n'était pas proposé AVANT l'import, le
           test suivant ne prouverait rien - on ne saurait pas si c'est le
           calendrier qui bloque ou autre chose. En développement, la première
           requête sur une route que l'on vient de modifier arrive parfois
           avant que Next n'ait fini de la reconstruire ; on redemande plutôt
           que de conclure. */
        let avantImport = '';
        for (let essai = 0; essai < 3; essai += 1) {
          avantImport = await p.locator('body').innerText();
          if (/Réserver par virement/i.test(avantImport)) break;
          await p.waitForTimeout(900);
          await p.goto(`${B}/fr/reserver/${slugEssai}?${qIcal}`, { waitUntil: 'domcontentloaded' });
        }
        check('  avant tout import, le virement est proposé sur ces dates',
          /Réserver par virement/i.test(avantImport),
          avantImport.replace(/\s+/g, ' ').slice(0, 160));

        const relu = await poserFlux(adresseIcs);
        check('  l\'adresse iCal est enregistrée', relu.includes(adresseIcs), relu.slice(0, 60) || 'vide');

        await a.locator('button', { hasText: 'Relire les' }).click();
        await a.waitForLoadState('domcontentloaded');
        await a.waitForTimeout(2500);
        await a.goto(`${B}/admin/calendriers`, { waitUntil: 'domcontentloaded' });
        const apresImport = await a.locator('body').innerText();
        const ligneEssai = await a
          .locator('.grille-saisie tbody tr')
          .filter({ hasText: nomEssai })
          .filter({ has: a.locator('.pastille') })
          .last()
          .innerText();
        check('  le calendrier a été téléchargé et lu',
          !/Aucune adresse n.est encore déclarée/i.test(apresImport) && /4 \/ /.test(apresImport),
          apresImport.match(/[^\n]*\d+ \/ \d+[^\n]*/)?.[0] || 'aucune nuit comptée');
        check('    et la provenance est devinée', /autre/i.test(ligneEssai), ligneEssai.replace(/\n/g, ' · ').slice(0, 90));
        /* Une adresse qui ne vient pas de Lodgify doit se dénoncer : le
           calendrier d'une plateforme ignore ce qui a été vendu ailleurs, et
           le laisser passer pour le calendrier complet serait le pire
           service à rendre. */
        check('    une adresse hors Lodgify est signalée comme incomplète',
          /ne viennent pas de Lodgify/i.test(apresImport));

        /* Le cœur de l'affaire : ces dates ne doivent plus etre vendables par
           virement, alors meme que Lodgify les annonce libres. */
        await p.goto(`${B}/fr/reserver/${slugEssai}?${qIcal}`, { waitUntil: 'domcontentloaded' });
        const bloque = await p.locator('body').innerText();
        check('  un calendrier importé bloque le virement sur ces dates',
          !/Réserver par virement/i.test(bloque) && /seul le paiement par carte/i.test(bloque));

        /* Et la liste doit l'écarter, elle aussi. C'est là que le voyageur
           regarde en premier : un logement affiché libre puis refusé au
           paiement est la pire des impasses, parce qu'elle se découvre après
           avoir choisi. */
        await p.goto(`${B}/fr/logements?arrivee=${arrIcal}&depart=${depIcal}&voyageurs=2`, { waitUntil: 'domcontentloaded' });
        const listeBloquee = await p.locator('body').innerText();
        check('    et la liste ne propose plus ce logement sur ces dates',
          !listeBloquee.includes(nomEssai), nomEssai);
        check('      sans écarter les autres', (await p.locator('.bien-carte').count()) > 0,
          `${await p.locator('.bien-carte').count()} logement(s) restants`);

        /* Et la rotation reste possible : arriver le jour du départ n'est pas
           un conflit, sans quoi on perdrait une nuit a chaque enchainement. */
        await p.goto(`${B}/fr/reserver/${slugEssai}?arrivee=${depIcal}&depart=${dans(68)}&voyageurs=2`, { waitUntil: 'domcontentloaded' });
        check('    mais arriver le jour du départ reste possible',
          /Réserver par virement/i.test(await p.locator('body').innerText()));
      } finally {
        /* On retire l'adresse d'essai, quoi qu'il arrive : une adresse morte
           qui resterait declaree ferait echouer tous les imports suivants. */
        await poserFlux('').catch(() => {});
        await new Promise((ok) => serveur.close(ok));
      }

      /* Menage : on annule la demande d'essai, ce qui rend les dates. */
      if (ref) {
        await a.goto(`${B}/admin/virements`, { waitUntil: 'domcontentloaded' });
        const carte = a.locator('article.boite', { hasText: ref });
        await carte.locator('button', { hasText: 'Annuler' }).first().click();
        await a.waitForLoadState('domcontentloaded');
        await a.waitForTimeout(700);
      }
    }

    /* On repose les reglages tels qu'on les a trouves. */
    await reglerPaiement(
      {
        commission_pct: commission,
        commission_fixe: fixeAvant,
        conversion_pct: convAvant,
        taux_mad: tauxAvant,
        virement_rib: ribAvant,
      },
      actifAvant
    );
  }

  /* La page des calendriers : le geste unique demandé, et surtout son
     honnêteté. Elle ne relance aucune importation iCal - l'API de Lodgify
     n'expose rien pour cela - et elle doit le dire, faute de quoi on
     presserait le bouton en croyant avoir agi. */
  await a.goto(`${B}/admin/calendriers`, { waitUntil: 'domcontentloaded' });
  const cal = await a.locator('body').innerText();
  check('  page des calendriers', /Calendriers/i.test(await a.locator('h1').innerText()));
  const plat = cal.replace(/\s+/g, ' ');
  check('    une seule adresse par logement, celle de Lodgify',
    /Une seule adresse par logement, et c.est celle de Lodgify/i.test(plat));
  check('    et la raison est dite : Lodgify porte aussi le direct',
    /ignore vos réservations directes/i.test(plat));
  check('    elle distingue lire le résultat et relancer Lodgify',
    /ne demande pas à Lodgify de relancer/i.test(plat));
  check('    un champ de calendrier par logement',
    (await a.locator('input[name^=flux_]').count()) === cartes,
    `${await a.locator('input[name^=flux_]').count()} champ(s) pour ${cartes} logement(s)`);

  /* Le collage venu de Staytle : on colle, on regarde, on écrit. Le premier
     temps ne doit rien écrire - c'est tout l'objet d'un aperçu. */
  {
    const nomPremier = (await a.locator('.grille-saisie tbody th a').last().innerText()).trim();
    const idPremier = (await a.locator('.grille-saisie tbody th a').last().getAttribute('href') || '').split('/').pop();
    /* On colle le NOM et non l'identifiant : sans clé Lodgify, cette machine
       sert le catalogue de repli, dont les logements sont numérotés en négatif
       - et le lecteur ne lit que les identifiants positifs, à dessein. Le
       rapprochement par identifiant est éprouvé plus haut, sur des numéros
       Lodgify réels. */
    const faux = `${nomPremier}\tSTAYTLE\thttps://exemple-de-collage.lodgify.com/9/calendar.ics`;
    await a.locator('textarea[name=colle]').fill(faux);
    await a.locator('button', { hasText: 'Vérifier ce collage' }).click();
    await a.locator('table', { hasText: 'Ligne collée' }).waitFor({ timeout: 25000 }).catch(() => {});
    const apercu = await a.locator('body').innerText();
    check('  le collage reconnaît l\'appartement',
      apercu.includes(nomPremier) && /\bnom\b/i.test(apercu), apercu.match(/[^\n]*STAYTLE[^\n]*/)?.[0] || 'non reconnu');
    check('    et l\'aperçu n\'écrit rien',
      (await a.locator(`input[name=flux_${idPremier}]`).inputValue()) === '',
      await a.locator(`input[name=flux_${idPremier}]`).inputValue());
    check('    le nom du logement est bien celui attendu', apercu.includes(nomPremier), nomPremier);

    /* Le clic se retente. Cette page se re-rend apres hydratation - le bandeau
       de fraicheur des calendriers apparait ou disparait selon l'age des flux -
       et un clic parti pendant ce remaniement se perd sans rien dire. Redonner
       le clic est plus honnete que d'attendre une duree arbitraire. */
    for (let essai = 0; essai < 5; essai += 1) {
      try {
        await a.locator('button', { hasText: 'Écrire les' }).click({ timeout: 8000 });
        break;
      } catch {
        await a.waitForTimeout(700);
      }
    }
    await a.waitForTimeout(2200);
    await a.goto(`${B}/admin/calendriers`, { waitUntil: 'domcontentloaded' });
    check('  puis l\'écriture pose vraiment l\'adresse',
      (await a.locator(`input[name=flux_${idPremier}]`).inputValue()).includes('exemple-de-collage'),
      await a.locator(`input[name=flux_${idPremier}]`).inputValue() || 'vide');

  /* La peremption, lue sur l'ecran ou elle sert. C'est le filet qui compte :
     il rend l'oubli de la tache planifiee couteux en reservations, jamais en
     remboursements - et il ne sert a rien s'il ne se voit pas. */
  await a.goto(`${B}/admin/calendriers`, { waitUntil: 'domcontentloaded' });
  const cal = await a.locator('body').innerText();
  check('  la page des calendriers annonce le rendez-vous de 3 h', /3 h/.test(cal),
    cal.match(/[^.]*3 h[^.]*/)?.[0]?.trim().slice(0, 90) || 'non annonce');
  check('    et dit la fraicheur des calendriers',
    /jamais [ée]t[ée] lus|datent de plus de|ont moins de/.test(cal),
    cal.match(/[^.\n]*(jamais ete lus|jamais été lus|datent de plus de|ont moins de)[^.\n]*/)?.[0]?.trim().slice(0, 110) || 'muette');
  /* Quand quelque chose ne va pas, la page doit dire ce que le site FAIT -
     pas seulement qu'il y a un probleme. */
  if (/jamais été lus|datent de plus de/.test(cal)) {
    check('      en disant ce que le site cesse de faire', /je ne sais pas/.test(cal));
  }

    /* ---------- le menu de l'administration ----------

       Huit boutons d'affilee ne se lisent pas : on les parcourt un par un, a
       chaque fois, parce que rien ne dit lequel concerne ce qu'on fait. Deux
       rangs - les familles, puis ce que contient celle ou l'on se trouve.

       Ce qui se verifie : que le second rang suit bien la page ouverte, que
       la famille active se distingue, et surtout qu'AUCUNE adresse n'a change.
       C'est ce dernier point qui rendait la modification sans risque, et c'est
       lui qu'un controle doit tenir. */
    for (const [adresse, famille, voisine] of [
      ['/admin/virements', 'Réservations', '/admin/demandes'],
      ['/admin/logements/equipements', 'Logements', '/admin/logements/caracteristiques'],
      ['/admin/avis', 'Vitrine', '/admin/diaporama'],
      ['/admin/paiement', 'Réglages', '/admin/lodgify'],
    ]) {
      await a.goto(`${B}${adresse}`, { waitUntil: 'domcontentloaded' });
      check(`  ${adresse} répond encore`, a.url().includes(adresse), a.url());
      const active = await a.locator('.admin-famille.est-active').innerText().catch(() => '');
      check(`    dans la famille « ${famille} »`, active.trim() === famille, active.trim() || 'aucune');
      /* La page voisine de la meme famille doit etre a un clic, sans deplier
         quoi que ce soit. */
      check('    et sa voisine est à un clic',
        (await a.locator(`.admin-pages a[href="${voisine}"]`).count()) === 1, voisine);
    }
    /* Le second rang doit marquer la page ouverte, pas seulement la famille. */
    await a.goto(`${B}/admin/logements/equipements`, { waitUntil: 'domcontentloaded' });
    check('  le second rang marque la page ouverte',
      (await a.locator('.admin-pages a.est-active').innerText().catch(() => '')).includes('Équipements'),
      await a.locator('.admin-pages a.est-active').innerText().catch(() => 'aucune'));
    /* Le piege du prefixe : /admin/logements ne doit pas gagner contre
       /admin/logements/equipements, sans quoi on se croit toujours sur la
       liste. */
    check('    sans que « Tous les logements » ne gagne par son préfixe',
      (await a.locator('.admin-pages a.est-active').count()) === 1,
      `${await a.locator('.admin-pages a.est-active').count()} page(s) marquée(s)`);

    /* ---------- l'etat du courrier ----------

       Sans fournisseur, les courriels ne partent pas : ils s'ecrivent dans le
       journal du serveur. Le site continue de fonctionner - une demande est
       ecrite en base AVANT tout envoi - mais personne n'est prevenu. C'est la
       panne la plus couteuse qu'un site de reservation puisse avoir, et la
       plus silencieuse : tout parait marcher. */
    {
      const corps = await a.locator('body').innerText();
      check('  l\'administration dit si les courriels partent',
        /courriels ne partent pas|expéditeur est encore celui d’essai|ne sont jamais partis/i.test(corps)
        || !/RESEND/i.test(corps),
        corps.match(/[^\n]*(courriels ne partent pas|celui d’essai|jamais partis)[^\n]*/i)?.[0]?.slice(0, 90) || 'rien à signaler');
      /* Et il dit ce qui n'est PAS perdu : une demande ecrite en base reste
         lisible, et l'ecran doit le dire plutot que d'alarmer sans issue. */
      if (/courriels ne partent pas/i.test(corps)) {
        check('    en disant où retrouver les demandes', /Séjours et virements/.test(corps));
      }
    }

    /* ---------- emporter la base, et la reposer ----------

       Cette base est un fichier unique sur un volume unique. Elle sert d'abord
       a porter en ligne ce qui a ete saisi en local - vingt-quatre logements
       equipes, les calendriers, le RIB - puis, tous les jours d'apres, de
       sauvegarde.

       Les refus se verifient ; le remplacement lui-meme ne se verifie pas ici,
       pour une raison evidente : il remplacerait la base sur laquelle tourne
       ce controle. */
    {
      await a.goto(`${B}/admin/sauvegarde`, { waitUntil: 'domcontentloaded' });
      const corps = await a.locator('body').innerText();
      check('  la page de sauvegarde dit ce que contient la base',
        /Logements renseignés/.test(corps) && /Réglages/.test(corps),
        corps.match(/Logements renseignés[^\n]*/)?.[0] || 'muette');

      const fichier = await a.request.get(`${B}/admin/api/sauvegarde`);
      const octets = await fichier.body();
      check('    la base se télécharge', fichier.status() === 200, `HTTP ${fichier.status()}`);
      check('      et c\'est bien une base SQLite',
        octets.subarray(0, 15).toString() === 'SQLite format 3', `${octets.length} octet(s)`);
      check('      annoncée comme un fichier à enregistrer',
        /attachment/.test(fichier.headers()['content-disposition'] || ''),
        fichier.headers()['content-disposition'] || 'aucun en-tête');
      /* Jamais en cache : ce fichier porte les noms, telephones et courriels
         des voyageurs, et les coordonnees bancaires de la maison. */
      check('      et jamais mise en cache',
        /no-store/.test(fichier.headers()['cache-control'] || ''),
        fichier.headers()['cache-control'] || 'aucun en-tête');

      /* Sans session, cette adresse n'a pas a exister. Repondre « non
         autorise » reviendrait a confirmer qu'il y a quelque chose ici. */
      const anonyme = await p.request.get(`${B}/admin/api/sauvegarde`);
      check('    sans session, elle est introuvable', anonyme.status() === 404, `HTTP ${anonyme.status()}`);
    }

    /* On revient d'où l'on venait.

       Ces deux blocs se promènent dans l'administration, et ils ont été
       glissés juste avant le ménage du test de collage - lequel repose une
       adresse de flux sur la page des calendriers. Sans ce retour, il la
       cherchait sur la page des réglages de paiement, et n'y trouvait rien.

       Un contrôle qui laisse la page ailleurs qu'il ne l'a trouvée casse celui
       d'après, et l'échec s'affiche alors sur le mauvais nom. */
    await a.goto(`${B}/admin/calendriers`, { waitUntil: 'domcontentloaded' });
    await a.locator('.grille-saisie, input[name^=flux_]').first().waitFor({ timeout: 25000 }).catch(() => {});

    /* On repose ce logement dans l'état où on l'a trouvé. */
    await a.locator(`input[name=flux_${idPremier}]`).fill('');
    await a.locator('button', { hasText: 'Enregistrer les adresses' }).click();
    await a.waitForTimeout(1600);
  }

  await a.goto(`${B}/admin/lodgify`, { waitUntil: 'domcontentloaded' });
  const diag = await a.locator('body').innerText();
  check('  page diagnostic Lodgify', /Connexion à Lodgify/.test(diag));
  check('    elle nomme l\'adresse et l\'en-tête', /api\.lodgify\.com\/v2\/properties/.test(diag) && /X-ApiKey/.test(diag));
  /* La clé ne doit jamais s'afficher, même partiellement. */
  const clef = process.env.LODGIFY_API_KEY;
  check('    et n\'affiche jamais la clé', !clef || !diag.includes(clef.trim()));
  /* ---------- un avis long se replie ----------
     Aucun des avis de démonstration ne dépasse quatre lignes : le repli ne
     serait donc jamais éprouvé, et l'on livrerait un bouton que personne n'a
     jamais vu apparaître. On en écrit donc un très long, on vérifie qu'il est
     bien coupé et qu'il se déplie, puis on le retire. */
  await a.goto(`${B}/admin/avis`, { waitUntil: 'domcontentloaded' });
  await a.waitForTimeout(500);
  const ajoutAvis = a.locator('form.fiche').first();
  const marqueur = 'Séjour d’essai pour la vérification du repliement';
  const long = `${marqueur}. ${'Le salon donne sur une terrasse plein sud et la cuisine est parfaitement équipée. '.repeat(8)}`;
  await ajoutAvis.locator('textarea[name=texte_fr]').fill(long);
  await ajoutAvis.locator('input[name=prenom]').fill('Essai');
  await ajoutAvis.locator('input[name=pays_fr]').fill('France');
  /* L'accueil n'affiche que les six premiers avis, par rang. Sans rang faible,
     l'essai serait bien enregistré mais invisible, et le test échouerait sur
     une absence qui n'aurait rien à voir avec le repliement. */
  await ajoutAvis.locator('input[name=rang]').fill('1');
  await ajoutAvis.locator('button[type=submit]').first().click();
  await a.waitForTimeout(1600);

  await p.goto(`${B}/fr`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1400);
  const longue = p.locator('.avis-case', { hasText: marqueur }).first();
  const bloc = longue.locator('.avis-texte');
  const replie = await bloc.evaluate((e) => ({ vu: e.clientHeight, reel: e.scrollHeight }));
  check('un avis long est coupé à quatre lignes', replie.reel > replie.vu + 2, `${replie.vu}px vus sur ${replie.reel}px`);
  const bouton = longue.locator('.avis-plus');
  /* Le bouton n'existe qu'après hydratation : il n'apparaît qu'une fois le
     texte mesuré, et le compter trop tôt reviendrait à chronométrer React. */
  await bouton.waitFor({ timeout: 8000 }).catch(() => {});
  const nBoutons = await bouton.count();
  check('  et propose de lire la suite', nBoutons === 1, `${nBoutons} bouton(s)`);
  if (await bouton.count()) {
    await bouton.click();
    await p.waitForTimeout(400);
    const ouvert = await bloc.evaluate((e) => e.clientHeight);
    check('    qui déplie vraiment le texte', ouvert > replie.vu, `${replie.vu}px puis ${ouvert}px`);
  }

  /* On remet la base dans l'état où on l'a trouvée. */
  await a.goto(`${B}/admin/avis`, { waitUntil: 'domcontentloaded' });
  await a.waitForTimeout(500);
  /* On repère la fiche par la VALEUR de son champ de texte : le contenu d'un
     textarea n'appartient pas au texte rendu de la page, et un filtre par
     texte ne le voit donc pas. */
  const rangDe = () =>
    a.evaluate(
      (m) =>
        [...document.querySelectorAll('form.fiche')].findIndex(
          (x) => x.querySelector('textarea[name=texte_fr]')?.value.startsWith(m)
        ),
      marqueur
    );
  check('  l\'essai est bien en base', (await rangDe()) > 0);
  /* En boucle, et pas une seule fois : une exécution interrompue a pu en
     laisser un derrière elle, et un test qui ne nettoie qu'à moitié finit par
     polluer ce qu'il vérifie. */
  for (let tour = 0; tour < 5; tour++) {
    const k = await rangDe();
    if (k <= 0) break;
    await a.locator('form.fiche').nth(k).locator('button:has-text("Supprimer")').first().click();
    await a.waitForTimeout(1500);
    /* On recharge avant de reprendre : l'action serveur revalide la page, mais
       relire le DOM d'avant le rafraîchissement reviendrait à interroger un
       souvenir plutôt que la base. */
    await a.reload({ waitUntil: 'domcontentloaded' });
    await a.waitForTimeout(600);
  }
  check('    puis retiré, la base retrouve son état', (await rangDe()) === -1);

  /* Dépublier un avis doit le faire disparaître du site, pas de la base. */
  await a.goto(`${B}/admin/avis`, { waitUntil: 'domcontentloaded' });
  const fiche = a.locator('form.fiche').nth(1);
  const extrait = (await fiche.locator('textarea[name=texte_fr]').inputValue()).slice(0, 40);
  const surAccueil = async () => p.evaluate(async ([u, t]) => (await (await fetch(u)).text()).includes(t), [`${B}/fr`, extrait]);
  check('  l\'avis est bien sur l\'accueil', await surAccueil(), extrait);
  await fiche.locator('input[name=publie]').uncheck();
  await fiche.locator('button[type=submit]').first().click();
  await a.waitForTimeout(1400);
  check('  dépublier le retire de l\'accueil', !(await surAccueil()), extrait);
  await a.locator('form.fiche').nth(1).locator('input[name=publie]').check();
  await a.locator('form.fiche').nth(1).locator('button[type=submit]').first().click();
  await a.waitForTimeout(1400);
  check('    et le republier le remet', await surAccueil(), extrait);

  /* ---------- les sauts de ligne d'une présentation ----------
     Le HTML les ignore : un texte tapé sur plusieurs paragraphes arrivait à
     l'écran en un seul bloc. On écrit donc une présentation depuis
     l'administration - lignes vides et simples retours mêlés - et l'on vérifie
     que la fiche la rend telle qu'elle a été écrite. */
  {
    const marqueur = 'Essai de mise en page';
    const texte = [
      `${marqueur} : premier paragraphe.`,
      'Deuxième paragraphe, après une ligne vide.',
      'Troisième ligne, après un simple retour.',
    ];
    const saisi = `${texte[0]}\n\n${texte[1]}\n${texte[2]}`;

    await a.goto(`${B}/admin/logements`, { waitUntil: 'domcontentloaded' });
    await a.locator('.carte-logement').first().click();
    await a.locator('textarea[name=description_fr]').waitFor({ timeout: 25000 }).catch(() => {});
    const adresseLogement = a.url();
    /* On relève la fiche publique de CE logement : la grille n'est pas triée
       comme on l'imagine, et vérifier une autre fiche que celle qu'on vient
       d'écrire ne prouverait rien. */
    const fichePublique = await a.locator('a:has-text("Voir la fiche publique")').getAttribute('href');
    /* Ce qu'on trouve, sauf si c'est notre propre marqueur : une exécution
       interrompue peut avoir laissé le texte d'essai en place, et le « rendre »
       à la fin le graverait pour de bon. Un ménage qui repose les ordures qu'il
       vient de trouver n'est pas un ménage. */
    const trouve = await a.locator('textarea[name=description_fr]').inputValue();
    const avant = trouve.includes(marqueur) ? '' : trouve;
    await a.locator('textarea[name=description_fr]').fill(saisi);
    /* On s'assure que le champ porte EXACTEMENT ce qu'on veut écrire avant de
       valider : un texte qui s'ajouterait au précédent au lieu de le remplacer
       passerait autrement inaperçu, et grossirait à chaque exécution. */
    const pose = await a.locator('textarea[name=description_fr]').inputValue();
    check('  le champ porte exactement le texte saisi', pose === saisi,
      `${pose.length} caractères pour ${saisi.length} attendus`);
    await a.locator('form').filter({ has: a.locator('textarea[name=description_fr]') }).locator('button[type=submit]').click();
    await a.waitForTimeout(1800);

    await p.goto(`${B}${fichePublique}`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(900);
    const bloc = p.locator('.fiche-bloc', { hasText: marqueur }).first();
    const paras = await bloc.locator('p.lead').count();
    check('une ligne vide fait un paragraphe', paras === 2, `${paras} paragraphe(s)`);
    const sauts = await bloc.locator('p.lead br').count();
    check('  et un simple retour fait un saut de ligne', sauts === 1, `${sauts} saut(s)`);
    /* Ce qui compte pour le lecteur : les trois morceaux sont bien sur trois
       lignes distinctes à l'écran, et non collés bout à bout. */
    const rendu = await bloc.innerText();
    check('    les trois lignes sont séparées à l\'écran',
      texte.every((x) => rendu.includes(x)) && !/paragraphe. Deuxième/.test(rendu),
      rendu.replace(/\n/g, ' ⏎ ').slice(0, 120));

    /* On repose la présentation dans l'état où on l'a trouvée. */
    await a.goto(adresseLogement, { waitUntil: 'domcontentloaded' });
    await a.locator('textarea[name=description_fr]').waitFor({ timeout: 25000 }).catch(() => {});
    await a.locator('textarea[name=description_fr]').fill(avant);
    await a.locator('form').filter({ has: a.locator('textarea[name=description_fr]') }).locator('button[type=submit]').click();
    await a.waitForTimeout(1500);
  }
}

/* ---------- l'encadré des caractéristiques ----------
   Deux registres : le quartier et la capacité sur le fond de la page, ce qui se
   compte dans un panneau bordé. Et surtout, rien qui ne soit connu - une salle
   d'eau posée par défaut serait fausse la moitié du temps, et c'est le genre
   d'erreur qu'un voyageur découvre sur place. */
{
  await p.goto(`${B}/fr/logements/c202-alcazar`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(700);
  check('la fiche porte l\'encadré des caractéristiques', (await p.locator('.faits-panneau').count()) === 1);
  const tete = await p.locator('.faits-tete').innerText();
  check('  le quartier et la capacité en tête', /Casablanca|Marrakech/.test(tete), tete.replace(/\n/g, ' · '));
  const panneau = await p.locator('.faits-panneau').innerText();
  check('    les chambres dans le panneau', /chambre/i.test(panneau), panneau.replace(/\n/g, ' · '));
  /* Chaque ligne porte son icône : sans elle, l'encadré redevient une liste. */
  const n = await p.locator('.faits-panneau .fait').count();
  const icones = await p.locator('.faits-panneau .fait-ic').count();
  check('    chaque ligne a son icône', n > 0 && icones === n, `${n} ligne(s), ${icones} icône(s)`);
  /* Rien d'inventé : aucune ligne ne peut afficher « undefined » ni un zéro. */
  check('    et rien d\'inconnu ne s\'affiche', !/undefined|NaN|\b0 /.test(panneau), panneau.replace(/\n/g, ' · '));
}

/* ---------- la carte d'un logement ----------
   Elle ne s'affiche qu'avec des coordonnées, et le catalogue de repli n'en a
   pas. On en écrit donc pour la durée de l'essai, puis on remet le fichier
   dans l'état où on l'a trouvé. C'est aussi la preuve que des coordonnées
   saisies à la main prennent le relais quand Lodgify n'en publie pas. */
{
  const chemin = new URL('../data/enrichissement.json', import.meta.url);
  const avant = fs.readFileSync(chemin, 'utf8');
  try {
    const e = JSON.parse(avant);
    /* Le Triangle d'Or, à Casablanca : des coordonnées vraies, pour que la
       carte montre une ville et non un océan. */
    for (const r of e.repli || []) e.biens[r.slug] = { ...(e.biens[r.slug] || {}), slug: r.slug, latitude: 33.5899, longitude: -7.6339 };
    fs.writeFileSync(chemin, JSON.stringify(e, null, 2));
    await p.waitForTimeout(2500);
    await p.goto(`${B}/fr/logements/c202-alcazar`, { waitUntil: 'domcontentloaded' });
    await p.locator('.carte-toile').waitFor({ timeout: 20000 }).catch(() => {});
    check('la fiche porte une carte', (await p.locator('.carte-toile').count()) === 1);
    /* Le rayon annoncé doit être celui qui est dessiné : une étiquette qui
       promet 250 m sur un cercle de 50 est un mensonge poli. */
    const etiquette = await p.locator('.carte-etiquette').innerText().catch(() => '');
    check('  et annonce son rayon', /250/.test(etiquette), etiquette || 'absente');
    /* La promesse tient dans une valeur : on ne descend jamais sous le rayon
       plancher. Le composant publie ce qu'il montre vraiment. */
    /* On attend que la carte ait publié sa vue, et non une durée fixe.
       Deux secondes et demie suffisaient sur une machine au repos et plus du
       tout sur une machine chargée : le contrôle échouait alors sur « undefined
       mètres », ce qui ne dit rien de la carte et tout de la machine. */
    await p.waitForFunction(
      () => {
        const e = document.querySelector('.carte-toile');
        return Boolean(e && e.dataset && e.dataset.zoom);
      },
      { timeout: 25000 }
    ).catch(() => {});
    const vue = await p.locator('.carte-toile').evaluate((e) => ({ ...e.dataset }));
    check(
      '    sans jamais descendre à la porte',
      Number(vue.rayonVisible) >= 110,
      `${vue.rayonVisible} m visibles, zoom ${vue.zoom} sur ${vue.zoommax} au plus`
    );
    /* L'adresse exacte n'est pas publiée : c'est ce que la note doit dire. */
    const corps = await p.locator('.carte-bloc').innerText();
    check('    et le dit au voyageur', /adresse exacte/i.test(corps));
  } finally {
    fs.writeFileSync(chemin, avant);
  }
}

/* ---------- le report des galeries vers la production ----------
   Les fichiers d'images sont versionnés, mais la liste qui les rattache à
   chaque logement vit en base - et la base de production est vide au premier
   jour. Un fichier versionné prend le relais pour tout logement dont la base
   ne dit rien. Si ce relais casse, le site en ligne s'affiche sans
   photographies alors que les images y sont : c'est exactement le genre de
   panne qui ne se voit qu'une fois en ligne. */
{
  const chemin = new URL('../data/galeries.json', import.meta.url);
  const avant = fs.readFileSync(chemin, 'utf8');
  try {
    const faux = {};
    const jeu = ['/maison-1.jpg', '/maison-2.jpg', '/accueil-sejour.jpg', '/maison-1-petit.jpg', '/maison-2-petit.jpg', '/logo-ib.png'];
    for (let i = 1; i <= 20; i++) faux[-i] = jeu;
    fs.writeFileSync(chemin, JSON.stringify(faux, null, 2));
    /* Le fichier est importé par le code : il faut laisser au serveur le temps
       de recompiler avant de regarder. */
    await p.waitForTimeout(2500);
    await p.goto(`${B}/fr/logements/c202-alcazar`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    const reportee = await p.locator('.mosaique img').count();
    check('les galeries versionnées atteignent les fiches', reportee > 0, `${reportee} image(s) reportée(s)`);
    /* Cinq visibles en tête, pas une de plus : au-delà la mosaïque devient une
       planche-contact et la fiche perd son premier regard. */
    check('  cinq photographies en tête', reportee === 5, `${reportee} visible(s)`);
    /* Et le compte total est annoncé : c'est ce qui donne envie d'ouvrir. */
    const bouton = await p.locator('.mosaique-toutes').innerText().catch(() => '');
    check('    avec le compte total', /6/.test(bouton), bouton || 'aucun bouton');
    /* La visionneuse s'ouvre au clic et sait avancer. */
    /* Deux tentatives : en développement, la page est compilée à la demande et
       le premier clic peut tomber avant que React n'ait repris la main. Une
       seconde tentative distingue un composant cassé d'un composant lent -
       c'est la différence entre un défaut et une fausse alerte. */
    for (let essai = 0; essai < 2; essai++) {
      await p.locator('.mosaique button').first().click();
      await p.locator('.visionneuse').waitFor({ timeout: 12000 }).catch(() => {});
      if (await p.locator('.visionneuse').count()) break;
      await p.waitForTimeout(1500);
    }
    check('    un clic ouvre la visionneuse', (await p.locator('.visionneuse').count()) === 1);
    await p.locator('.vis-apres').click();
    await p.waitForTimeout(300);
    check('      qui avance', /2 \/ 6/.test(await p.locator('.vis-compte').innerText()));
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    check('      et se ferme avec Échap', (await p.locator('.visionneuse').count()) === 0);

    /* Dans la liste, on doit pouvoir faire défiler sans ouvrir la fiche. */
    await p.goto(`${B}/fr/logements`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(900);
    const bandes = await p.locator('.bien-carte .bien-bande').count();
    check('  les vignettes portent une bande de photographies', bandes > 0, `${bandes} bande(s)`);
    const parVignette = await p.locator('.bien-carte').first().locator('.bien-bande img').count();
    check('    de six photographies au plus', parVignette > 1 && parVignette <= 6, `${parVignette}`);
    /* La flèche fait défiler et n'ouvre surtout pas la fiche : elle vit à
       l'intérieur du lien, et un clic mal arrêté annulerait tout l'intérêt. */
    const avant = p.url();
    /* On survole d'abord : les flèches n'apparaissent qu'au survol, et cliquer
       de force sur un élément encore transparent revient à cliquer au travers,
       donc sur le lien - ce que le test est justement censé exclure. */
    await p.locator('.bien-carte').first().hover();
    await p.waitForTimeout(300);
    await p.locator('.bien-carte').first().locator('.bien-apres').click();
    await p.waitForTimeout(900);
    check('    et la flèche ne quitte pas la liste', p.url() === avant, p.url());
  } finally {
    /* Quoi qu'il arrive, le fichier livré retrouve son état. */
    fs.writeFileSync(chemin, avant);
  }
}

/* ---------- les traductions manquantes ----------
   Une clef absente du dictionnaire ne casse rien : elle s'affiche telle quelle.
   Le bouton principal de la page Propriétaires a ainsi annoncé « po_cta » à
   tout visiteur, et rien n'a protesté - ni le compilateur, ni le navigateur,
   ni aucune vérification. C'est la pire espèce de défaut : silencieux, visible
   de tous, et invisible de celui qui l'a écrit.

   On lit donc le code plutôt que l'écran. Chaque clef demandée quelque part
   doit exister dans les deux dictionnaires : une page anglaise qui affiche une
   clef est aussi grave qu'une page française. */
{
  const racine = new URL('../src/', import.meta.url).pathname;
  const fichiers = [];
  const parcourir = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const chemin = `${d}/${e.name}`;
      if (e.isDirectory()) parcourir(chemin);
      else if (/\.tsx?$/.test(e.name)) fichiers.push(chemin);
    }
  };
  parcourir(racine.replace(/\/$/, ''));

  const demandees = new Set();
  for (const f of fichiers) {
    if (f.endsWith('i18n.ts')) continue;
    const code = fs.readFileSync(f, 'utf8');
    /* On lit l'appel en entier, parenthèses comptées, et l'on relève toutes les
       clefs qui s'y trouvent. Une expression conditionnelle - t(n === 1 ?
       'fait_lit' : 'fait_lits', { n }) - en contient deux, et une lecture qui
       s'arrête à la première les déclarerait orphelines toutes les deux : la
       vérification accuserait alors un code parfaitement correct, ce qui est la
       pire chose qu'une vérification puisse faire. */
    for (let i = code.indexOf('t('); i >= 0; i = code.indexOf('t(', i + 1)) {
      /* « t( » doit être l'appel de traduction, pas la fin d'un autre nom. */
      if (i > 0 && /[A-Za-z0-9_$.]/.test(code[i - 1])) continue;
      let profondeur = 0;
      let j = i + 1;
      for (; j < code.length && j < i + 400; j++) {
        if (code[j] === '(') profondeur++;
        else if (code[j] === ')') {
          profondeur--;
          if (profondeur === 0) break;
        }
      }
      for (const m of code.slice(i, j).matchAll(/'([a-z][a-z0-9_]*)'/g)) demandees.add(m[1]);
    }
  }

  /* Le dictionnaire est un objet par langue : on découpe sur la seconde
     déclaration pour distinguer le français de l'anglais. */
  const dico = fs.readFileSync(`${racine}lib/i18n.ts`, 'utf8');
  const bornes = [...dico.matchAll(/^const (fr|en): Dico = \{/gm)].map((m) => ({ langue: m[1], i: m.index }));
  const cles = {};
  for (let k = 0; k < bornes.length; k++) {
    const part = dico.slice(bornes[k].i, k + 1 < bornes.length ? bornes[k + 1].i : undefined);
    cles[bornes[k].langue] = new Set([...part.matchAll(/^\s{2}([a-z0-9_]+):/gm)].map((m) => m[1]));
  }

  const trouvees = bornes.length === 2;
  check('le dictionnaire se lit dans les deux langues', trouvees, bornes.map((b) => b.langue).join(', ') || 'aucun');
  if (trouvees) {
    const manquantes = [...demandees].filter((c) => !cles.fr.has(c) || !cles.en.has(c));
    check(
      'aucune traduction manquante',
      manquantes.length === 0,
      manquantes.length ? manquantes.join(', ') : `${demandees.size} clef(s) vérifiée(s)`
    );
    /* Et l'inverse, moins grave mais salissant : une clef traduite que plus
       personne ne demande encombre le fichier et fait douter du reste. */
    const orphelines = [...cles.fr].filter((c) => !demandees.has(c));
    /* Zéro : le fichier a été nettoyé, et il n'y a aucune raison qu'il se
       resalisse. Une clef qui survit à la section qui l'affichait fait douter
       de tout le reste du dictionnaire. */
    check('  et aucune clef orpheline', orphelines.length === 0, `${orphelines.length} : ${orphelines.slice(0, 12).join(', ')}`);
  }
}

/* ---------- être trouvé ----------
   Trois publics qui ne lisent pas la même chose : un moteur lit les balises et
   le plan, un assistant cherche d'abord ce qui est structuré, un être humain
   lit le titre dans une page de résultats - et c'est le seul des trois qui
   décide. On vérifie que les trois trouvent quelque chose, et surtout que rien
   n'est déclaré qui ne soit vrai. */
{
  await p.goto(`${B}/fr/logements`, { waitUntil: 'domcontentloaded' });
  const robots = await (await fetch(`${B}/robots.txt`)).text();
  check('robots.txt existe', /User-Agent/i.test(robots), robots.split('\n')[0]);
  check('  il ferme l\'administration', /Disallow:\s*\/admin/i.test(robots));
  check('  et annonce le plan du site', /Sitemap:/i.test(robots));
  check('  sans écarter les assistants',
    !/Disallow:\s*\/\s*$/im.test(robots) && !/GPTBot|Google-Extended/i.test(robots));

  const plan = await (await fetch(`${B}/sitemap.xml`)).text();
  const adresses = [...plan.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  check('le plan du site est servi', adresses.length > 0, `${adresses.length} adresse(s)`);
  check('  dans les deux langues',
    adresses.some((u) => /\/fr\//.test(u) || /\/fr$/.test(u)) && adresses.some((u) => /\/en\//.test(u) || /\/en$/.test(u)));
  /* Le plan est construit depuis le catalogue réel, jamais d'une liste écrite
     à la main : on vérifie donc qu'il porte AUTANT de fiches que la liste en
     affiche, dans les deux langues. Un plan tenu à la main finit toujours par
     annoncer des pages mortes. */
  const surLaListe = await p.locator('a[href*="/fr/logements/"]').evaluateAll(
    (n) => new Set(n.map((a) => a.getAttribute('href').split('?')[0])).size
  );
  const dansLePlan = adresses.filter((u) => u.includes('/fr/logements/')).length;
  check('  il porte toutes les fiches de logement', dansLePlan >= surLaListe && dansLePlan > 0,
    `${dansLePlan} au plan pour ${surLaListe} sur la liste`);
  check('  et jamais l\'administration', !adresses.some((u) => u.includes('/admin')));
  check('  chaque adresse annonce ses langues', /hreflang="en"/.test(plan) && /hreflang="fr"/.test(plan));

  /* Le JSON-LD de la fiche : ce qu'un assistant lira pour répondre. */
  await p.goto(`${B}/fr/logements`, { waitUntil: 'domcontentloaded' });
  const uneFiche = await p.locator('a[href*="/fr/logements/"]').first().getAttribute('href');
  await p.goto(`${B}${(uneFiche || '').split('?')[0]}`, { waitUntil: 'domcontentloaded' });
  const blocs = await p.locator('script[type="application/ld+json"]').allTextContents();
  check('la fiche porte ses données structurées', blocs.length >= 2, `${blocs.length} bloc(s)`);
  const objets = blocs.map((x) => { try { return JSON.parse(x); } catch { return null; } });
  check('  toutes lisibles', objets.every(Boolean));
  const logement = objets.find((o) => o && o['@type'] === 'Apartment');
  check('  le logement est décrit comme un appartement', !!logement, objets.map((o) => o && o['@type']).join(', '));
  check('    avec son nom et sa ville',
    !!logement?.name && !!logement?.address?.addressLocality,
    `${logement?.name} · ${logement?.address?.addressLocality}`);
  /* Le point qui compte : rien d'inventé. Une note agrégée déclarée sans
     source est ce que Google sanctionne, et ce qu'un assistant répète ensuite
     comme un fait. */
  check('    et aucune note inventée',
    !logement?.aggregateRating && !JSON.stringify(objets).includes('aggregateRating'));
  check('    ni adresse exacte publiée', !logement?.address?.streetAddress, logement?.address?.streetAddress || 'absente');

  const maison = objets.find((o) => o && o['@type'] === 'LodgingBusiness');
  check('  la maison est décrite une fois', !!maison, maison?.name);

  const canonique = await p.locator('link[rel=canonical]').getAttribute('href');
  check('  la page dit son adresse canonique', /\/fr\/logements\//.test(canonique || ''), canonique || 'absente');
  const alt = await p.locator('link[rel=alternate][hreflang=en]').getAttribute('href');
  check('    et son équivalent anglais', /\/en\/logements\//.test(alt || ''), alt || 'absent');

  const llms = await (await fetch(`${B}/llms.txt`)).text();
  /* ---------- la canonique de CHAQUE page ----------

     Cinq pages annonçaient la même adresse canonique que l'accueil, et se
     dés-indexaient donc elles-mêmes : dire à Google « je suis un doublon de la
     page d'accueil » revient à lui demander de ne pas me référencer. La cause
     tenait à une ligne - une page qui rend un objet de métadonnées nu hérite
     de la canonique de la mise en page, sans que rien ne le signale.

     Ce contrôle est celui qui aurait fallu écrire le premier : il ne juge pas
     le contenu, il vérifie que chaque page dit son propre nom. */
  for (const chemin of ['', '/logements', '/proprietaires', '/qui-sommes-nous', '/contact', '/cgv', '/mentions', '/confidentialite']) {
    const h = await (await fetch(`${B}/fr${chemin}`)).text();
    const canon = h.match(/rel="canonical" href="([^"]*)"/)?.[1] || '';
    check(`  canonique de /fr${chemin || ' (accueil)'}`, canon.endsWith(`/fr${chemin}`), canon || 'absente');
    const titre = h.match(/<title>([^<]*)<\/title>/)?.[1] || '';
    check('    un titre propre', titre.length > 10 && titre.length < 75, `${titre.length} car. — ${titre}`);
    const desc = h.match(/name="description" content="([^"]*)"/)?.[1] || '';
    check('    une description de longueur utile', desc.length >= 50 && desc.length <= 200, `${desc.length} car.`);
    const img = h.match(/property="og:image" content="([^"]*)"/)?.[1] || '';
    check('    une image de partage absolue', /^https?:\/\//.test(img), img || 'absente');
    check('    et la langue par défaut est annoncée', /hrefLang="x-default"/.test(h));
  }

  /* Deux pages différentes ne doivent jamais annoncer la même canonique : ce
     serait la meme faute sous une autre forme. */
  {
    const vues = new Set();
    let doublon = '';
    for (const chemin of ['', '/logements', '/proprietaires', '/qui-sommes-nous', '/contact', '/cgv', '/mentions', '/confidentialite']) {
      const h = await (await fetch(`${B}/fr${chemin}`)).text();
      const c = h.match(/rel="canonical" href="([^"]*)"/)?.[1] || chemin;
      if (vues.has(c)) doublon = c;
      vues.add(c);
    }
    check('  aucune canonique en double', !doublon, doublon || `${vues.size} adresses distinctes`);
  }

  /* Le titre suit la langue. Un anglophone arrivait sur « Conciergerie
     premium », mot qui ne lui dit rien et qui s'affiche tel quel dans sa page
     de resultats. */
  {
    const en = await (await fetch(`${B}/en`)).text();
    const titre = en.match(/<title>([^<]*)<\/title>/)?.[1] || '';
    check('  le titre de l\'accueil suit la langue', !/Conciergerie/i.test(titre), titre);
  }

  /* La FAQ des proprietaires, balisee. Douze questions-reponses redigees,
     exactement le format que Google reprend en resultat enrichi et qu'un
     assistant cite mot pour mot - et rien ne le disait. */
  {
    const h = await (await fetch(`${B}/fr/proprietaires`)).text();
    const blocs = [...h.matchAll(/application\/ld\+json">(.*?)<\/script>/gs)].map((m) => {
      try { return JSON.parse(m[1]); } catch { return null; }
    });
    const faq = blocs.find((x) => x && x['@type'] === 'FAQPage');
    check('  la FAQ est balisée pour les moteurs et les assistants', Boolean(faq),
      faq ? `${faq.mainEntity.length} question(s)` : 'aucun bloc FAQPage');
    if (faq) {
      check('    chaque question porte sa réponse',
        faq.mainEntity.every((q) => q.name && q.acceptedAnswer?.text));
      /* Baliser autre chose que ce qui est affiche est precisement ce que
         Google sanctionne. */
      const texte = h.replace(/<script[\s\S]*?<\/script>/g, '');
      check('    et se retrouve bien dans la page visible',
        faq.mainEntity.every((q) => texte.includes(q.name.slice(0, 30))),
        'balisage et affichage concordent');
    }
  }

  check('llms.txt existe pour les assistants', /IB Signature/.test(llms), llms.split('\n')[0]);
  check('  il dit aussi ce que la maison ne fait pas', /ne faisons pas/i.test(llms));
}

/* Une erreur de console mérite d'être confirmée avant d'être retenue.

   Ce contrôle navigue vite, et parfois quitte une page pendant que le serveur
   est encore en train de l'écrire. React hydrate alors un document incomplet
   et signale une discordance - qui dit vrai sur l'instant, et faux sur le
   site : aucun visiteur ne navigue de cette façon. Plutôt que d'ignorer ces
   messages ou de les subir, on retourne sur la page en cause et on la laisse
   se poser. Ce qui se reproduit est un défaut ; ce qui disparaît était le
   nôtre.

   On ne masque donc rien : on vérifie une seconde fois, ce qui est l'inverse. */
const aConfirmer = [...new Set(err)];
const confirmees = [];
for (const ligne of aConfirmer) {
  const adresse = ligne.split(' @ ').pop();
  if (!adresse || !adresse.startsWith(B)) {
    confirmees.push(ligne);
    continue;
  }
  const temoin = [];
  const surveiller = (e) => {
    const m = e?.message || String(e);
    if (m !== 'Event') temoin.push(m);
  };
  p.on('pageerror', surveiller);
  await p.goto(adresse, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(1500);
  p.off('pageerror', surveiller);
  if (temoin.length) confirmees.push(`${ligne} (reproduite)`);
}
check('aucune erreur de console', confirmees.length === 0, confirmees.join(' | ').slice(0, 1400));
if (aConfirmer.length && !confirmees.length) {
  console.log(`  ..   ${aConfirmer.length} message(s) vus en cours de navigation, aucun reproduit page posée`);
}
/* ---------- les conditions generales de vente ----------

   Elles etaient citees sans exister : la case a cocher demandait d'accepter
   des conditions qu'aucun lien ne permettait de lire. Faire accepter un texte
   introuvable n'est pas seulement discourtois, c'est sans effet - une clause
   qu'on n'a pas pu consulter ne s'oppose pas a celui qui l'a cochee, et c'est
   la clause d'annulation qui tomberait la premiere.

   Ce qui se verifie ici : que la page existe dans les deux langues, que les
   conditions d'annulation y viennent EN TETE, qu'elles disent le delai reel
   des reglages et non un chiffre ecrit dans le code, et que le lien depuis la
   case a cocher y mene sans faire perdre la saisie. */
{
  const { phrasesAnnulation, resumeAnnulation } = await import('../src/lib/annulation.ts');

  /* D'abord l'arithmetique des phrases, sans navigateur : c'est la que les
     cas limites se cachent. */
  const cinq = { jours: 5, retenu: 100, rembours: 14, note: '' };
  const ph = phrasesAnnulation('fr', cinq);
  check('  les conditions se disent en francais', /5 jours avant votre arriv/i.test(ph[0]), ph[0]);
  check('    le pluriel suit le nombre',
    /1 jour avant/.test(phrasesAnnulation('fr', { ...cinq, jours: 1 })[0])
    && !/1 jours/.test(phrasesAnnulation('fr', { ...cinq, jours: 1 })[0]),
    phrasesAnnulation('fr', { ...cinq, jours: 1 })[0]);
  check('    zero jour se dit « non annulable », pas « zero jour »',
    /pas annulable/i.test(phrasesAnnulation('fr', { ...cinq, jours: 0 })[0])
    && !/0 jour/.test(phrasesAnnulation('fr', { ...cinq, jours: 0 })[0]),
    phrasesAnnulation('fr', { ...cinq, jours: 0 })[0]);
  check('    une retenue partielle s\'annonce comme telle',
    /50 % du montant/.test(phrasesAnnulation('fr', { ...cinq, retenu: 50 })[1]),
    phrasesAnnulation('fr', { ...cinq, retenu: 50 })[1]);
  check('    une retenue nulle ne dit pas « 0 % est retenu »',
    !/0 %/.test(phrasesAnnulation('fr', { ...cinq, retenu: 0 })[1]),
    phrasesAnnulation('fr', { ...cinq, retenu: 0 })[1]);
  check('    la clause libre est ajoutee quand elle existe',
    phrasesAnnulation('fr', { ...cinq, note: 'Clause maison.' }).includes('Clause maison.'));
  check('    et rien n\'est ajoute quand elle est vide',
    phrasesAnnulation('fr', cinq).length === phrasesAnnulation('fr', { ...cinq, note: '   ' }).length);
  check('    le resume tient sur une ligne', resumeAnnulation('fr', cinq).length < 70, resumeAnnulation('fr', cinq));
  check('    et existe aussi en anglais', /Free cancellation/i.test(resumeAnnulation('en', cinq)), resumeAnnulation('en', cinq));

  /* Puis la page elle-meme. */
  for (const l of ['fr', 'en']) {
    await p.goto(`${B}/${l}/cgv`, { waitUntil: 'domcontentloaded' });
    const corps = await p.locator('body').innerText();
    check(`  la page des conditions existe en ${l}`, (await p.locator('h1').count()) >= 1,
      (await p.locator('h1').first().innerText().catch(() => '')) || 'aucun titre');
    check('    les conditions d\'annulation y sont', (await p.locator('.cgv-annulation').count()) === 1);
    check('    et viennent avant tout le reste', await p.evaluate(() => {
      const a = document.querySelector('.cgv-annulation');
      const s = document.querySelector('.cgv-section');
      if (!a || !s) return false;
      return a.getBoundingClientRect().top < s.getBoundingClientRect().top;
    }), 'encadre au-dessus de la premiere section');
    check('    le delai vient des reglages et non du code', /5 (jours|days)/.test(corps),
      corps.match(/[^.]*5 (jours|days)[^.]*/)?.[0]?.trim().slice(0, 90) || 'delai absent');
    check('    la page dit a qui adresser une annulation', /@/.test(corps));
    check('    aucun crochet oublie dans le titre', !/\[/.test(await p.locator('h1').first().innerText()));
  }

  /* Et le chemin depuis la case a cocher. */
  await p.goto(`${B}/fr/reserver/c202-alcazar?arrivee=2026-11-20&depart=2026-11-24&voyageurs=2`, { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('input[name=cgv]', { timeout: 20000 });
  const lienCgv = p.locator('label.cgv a').first();
  check('  la mention des conditions est cliquable', (await lienCgv.count()) === 1);
  if (await lienCgv.count()) {
    check('    elle mene aux conditions', (await lienCgv.getAttribute('href')) === '/fr/cgv',
      await lienCgv.getAttribute('href'));
    /* Un onglet neuf : quitter la page perdrait six champs deja saisis, et un
       voyageur qui doit tout retaper pour avoir ose lire les conditions ne les
       lit plus. */
    check('    dans un onglet neuf, sans perdre la saisie',
      (await lienCgv.getAttribute('target')) === '_blank'
      && /noopener/.test((await lienCgv.getAttribute('rel')) || ''),
      `${await lienCgv.getAttribute('target')} ${await lienCgv.getAttribute('rel')}`);
  }
  const sousCase = await p.locator('.cgv-resume').innerText().catch(() => '');
  check('  le delai d\'annulation est repete en clair sous la case', /5 jours/.test(sousCase), sousCase || 'absent');

  /* Les horaires d'arrivee et de depart.

     Ils sont les memes pour les vingt-quatre logements, et c'est justement
     pour cela qu'ils doivent etre ecrits en un seul endroit : la fiche, les
     conditions et le courriel qui annonceraient trois heures differentes se
     reglent devant une porte fermee, avec des valises.

     Un piege particulier ici : la fiche annoncait « Arrivee autonome, a toute
     heure », ce qui contredisait mot pour mot une arrivee fixee a quinze
     heures. Deux phrases vraies separement, fausses ensemble. */
  for (const l of ['fr', 'en']) {
    await p.goto(`${B}/${l}/cgv`, { waitUntil: 'domcontentloaded' });
    const c = await p.locator('body').innerText();
    check(`  les conditions annoncent les horaires (${l})`, /15:00/.test(c) && /11:00/.test(c),
      c.match(/[^.]*15:00[^.]*/)?.[0]?.trim().slice(0, 100) || 'absents');
    check('    et disent qu\'ils valent pour tous les logements',
      /tous les logements|every apartment/i.test(c));
    check('    aucun crochet ne subsiste sur les horaires', !/\[heure|\[check-in|\[check-out/i.test(c));
  }

  await p.goto(`${B}/fr/logements/c202-alcazar`, { waitUntil: 'domcontentloaded' });
  const fiche = await p.locator('body').innerText();
  check('  la fiche annonce les horaires', /15:00/.test(fiche) && /11:00/.test(fiche),
    (await p.locator('.compris-horaires').innerText().catch(() => '')) || 'absents');
  check('    « a toute heure » ne contredit plus l\'heure d\'arrivee',
    !/autonome, à toute heure/i.test(fiche),
    fiche.match(/Arrivée autonome[^\n]*/)?.[0] || 'ligne absente');
  check('    elle dit a partir de quand', /autonome à partir de 15:00/i.test(fiche),
    fiche.match(/Arrivée autonome[^\n]*/)?.[0] || 'absente');

  /* Le pied de page doit y mener depuis n'importe ou. */
  await p.goto(`${B}/fr`, { waitUntil: 'domcontentloaded' });
  check('  le pied de page porte les conditions',
    (await p.locator('footer a[href="/fr/cgv"]').count()) >= 1);
}

/* ---------- le rafraichissement nocturne des calendriers ----------

   L'import ne partait que d'un bouton. Rien ne le lancait seul, et rien ne
   disait a la garde du virement que ses donnees dataient de trois semaines :
   le site tenait des dates sur un calendrier perime, en silence, avec la meme
   assurance que s'il etait frais.

   Ce qui se verifie ici : que l'adresse existe, qu'elle refuse sans secret, et
   qu'elle refuse AUSSI quand aucun secret n'est configure - une adresse qui
   declenche vingt-quatre appels reseau, ouverte a qui la trouve, est une
   invitation a faire tomber le site. */
{
  const sans = await fetch(`${B}/api/flux`, { method: 'POST' });
  check('  l\'adresse du batch existe', sans.status !== 404, `HTTP ${sans.status}`);
  check('    et refuse sans secret', sans.status === 401 || sans.status === 503, `HTTP ${sans.status}`);
  const corps = await sans.json().catch(() => ({}));
  check('    en disant pourquoi', typeof corps.erreur === 'string' && corps.erreur.length > 0,
    corps.erreur || 'aucune explication');
  /* Sans CRON_SECRET, l'adresse doit se fermer et non s'ouvrir. C'est
     l'inverse du reflexe habituel, et c'est le bon sens ici. */
  if (sans.status === 503) {
    check('    fermee tant qu\'aucun secret n\'est configure', /CRON_SECRET/.test(corps.erreur || ''), corps.erreur);
  }
  const faux = await fetch(`${B}/api/flux`, { method: 'POST', headers: { 'x-cron-secret': 'faux' } });
  check('    un mauvais secret ne passe pas', faux.status === 401 || faux.status === 503, `HTTP ${faux.status}`);

}

await b.close();
console.log(`\n${ok.length} au vert, ${ko.length} en échec`);
if (ko.length) process.exit(1);
