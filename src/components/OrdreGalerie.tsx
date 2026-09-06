'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * L'ordre des photographies d'un logement.
 *
 * Trois gestes suffisent : déplacer, écarter, remettre. Le glisser-déposer est
 * le geste naturel sur un ordinateur, mais il n'est ni tactile ni accessible
 * au clavier - chaque vignette porte donc aussi deux flèches, qui font la même
 * chose et qui marchent partout. L'une n'est pas le repli de l'autre : ce sont
 * deux chemins vers le même résultat, et le visiteur prend celui qu'il veut.
 *
 * Rien n'est enregistré tant que vous n'avez pas cliqué. On peut donc essayer
 * un ordre, en changer, revenir - et fermer la page sans rien casser.
 *
 * Écarter n'est pas supprimer. La photographie descend dans une réserve d'où
 * elle remonte d'un clic. Supprimer pour de bon obligerait à relancer tout
 * l'import pour récupérer une image retirée un jour de trop.
 *
 * On peut aussi en ajouter. Le bouton ouvre l'appareil photo ou la pellicule
 * sur un téléphone, et le sélecteur de fichiers sur un ordinateur. Les images
 * partent aussitôt vers le serveur, qui les redimensionne aux mêmes réglages
 * que celles de l'import - une galerie où une image pèse dix fois ses voisines
 * se voit au chargement. Elles se rangent ensuite comme les autres, et c'est
 * l'enregistrement qui les fait entrer dans la galerie.
 */
export default function OrdreGalerie({
  bienId,
  retenues: initRetenues,
  ecartees: initEcartees,
}: {
  bienId: number;
  retenues: string[];
  ecartees: string[];
}) {
  const [retenues, setRetenues] = useState(initRetenues);
  const [ecartees, setEcartees] = useState(initEcartees);
  const [prise, setPrise] = useState<number | null>(null);
  const [cible, setCible] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [souci, setSouci] = useState<string[]>([]);
  const [progres, setProgres] = useState('');
  /* Ce qui a changé à l'écran et pas encore en base.
     Déposer une photographie l'envoie au serveur, mais ne la fait pas entrer
     dans la galerie : c'est l'enregistrement qui décide. La distinction est
     juste - on veut pouvoir déposer douze images, en écarter trois, puis
     enregistrer - mais rien ne la disait. On voyait ses photographies
     apparaître, on quittait la page, elles avaient disparu. */
  const [modifie, setModifie] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  /* Le garde-fou du navigateur, pour le cas où l'on ferme l'onglet sans avoir
     lu le bandeau. Il ne s'arme que s'il y a quelque chose à perdre. */
  useEffect(() => {
    if (!modifie) return;
    const alerte = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', alerte);
    return () => window.removeEventListener('beforeunload', alerte);
  }, [modifie]);

  async function ajouter(liste: FileList | null) {
    if (!liste || !liste.length) return;
    const fichiers = Array.from(liste);
    setEnvoi(true);
    setSouci([]);
    const rates: string[] = [];

    /* Par petits paquets, l'un après l'autre. Douze photographies de téléphone
       font soixante mégaoctets : envoyées d'un bloc depuis un réseau mobile,
       elles échouent toutes ensemble, et l'on ne sait pas laquelle a fauté.
       Par deux, un échec ne coûte que deux images, et les autres passent.
       Deux et non quatre : un appareil récent produit des fichiers de huit à
       dix mégaoctets, et quatre d'un coup approchaient des limites de taille
       que traversent ces requêtes - sur un réseau mobile, un envoi trop gros
       échoue de plusieurs façons, toutes muettes. */
    for (let i = 0; i < fichiers.length; i += 2) {
      const paquet = fichiers.slice(i, i + 2);
      setProgres(`${Math.min(i + paquet.length, fichiers.length)} / ${fichiers.length}`);
      const corps = new FormData();
      corps.set('bien_id', String(bienId));
      for (const f of paquet) corps.append('fichiers', f);
      try {
        const r = await fetch('/admin/api/photos', { method: 'POST', body: corps });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.erreur || `envoi refusé (${r.status})`);
        /* Les nouvelles arrivent à la fin : c'est le seul endroit qui ne
           bouscule pas l'ordre que vous venez peut-être d'établir. */
        if (d.ajoutees?.length) {
          setRetenues((v) => [...v, ...d.ajoutees.filter((u: string) => !v.includes(u))]);
          setModifie(true);
        }
        if (d.refusees?.length) rates.push(...d.refusees);
      } catch (e: any) {
        rates.push(...paquet.map((f) => `${f.name} — ${e?.message || 'envoi interrompu'}`));
      }
    }

    setSouci(rates);
    setEnvoi(false);
    setProgres('');
    /* On vide le champ, sans quoi choisir deux fois la même photo ne
       déclencherait rien la seconde fois. */
    if (champ.current) champ.current.value = '';
  }

  const deplacer = (de: number, vers: number) => {
    if (vers < 0 || vers >= retenues.length || de === vers) return;
    const copie = [...retenues];
    const [x] = copie.splice(de, 1);
    copie.splice(vers, 0, x);
    setRetenues(copie);
    setModifie(true);
  };

  const ecarter = (i: number) => {
    const copie = [...retenues];
    const [x] = copie.splice(i, 1);
    setRetenues(copie);
    setEcartees([x, ...ecartees]);
    setModifie(true);
  };

  const remettre = (i: number) => {
    const copie = [...ecartees];
    const [x] = copie.splice(i, 1);
    setEcartees(copie);
    setRetenues([...retenues, x]);
    setModifie(true);
  };

  return (
    <>
      <input type="hidden" name="retenues" value={retenues.join('\n')} />
      <input type="hidden" name="ecartees" value={ecartees.join('\n')} />

      <p className="corps">
        {retenues.length} photographie(s) affichée(s). La première est la couverture : c’est elle qui représente le
        logement dans les listes et sur l’accueil. Faites-les glisser pour les réordonner, ou servez-vous des flèches.
      </p>

      <div className="ajout">
        <input
          ref={champ}
          type="file"
          id="ajout-photos"
          /* Les types MIME ne suffisent pas. Sous Windows, le sélecteur de
             fichiers ne les déduit pas du contenu : il les lit dans la base de
             registre, et quand « .jpeg » n'y est pas associé à image/jpeg -
             ce qui arrive - les fichiers apparaissent grisés, impossibles à
             choisir, sans le moindre message. On énumère donc aussi les
             extensions : le sélecteur accepte alors l'une OU l'autre forme.
             Le serveur, lui, ne se fie ni à l'une ni à l'autre - il relit
             l'image et refuse ce qui n'en est pas une. */
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.jpe,.png,.webp"
          multiple
          hidden
          onChange={(e) => ajouter(e.target.files)}
        />
        <button type="button" className="btn-ajout" onClick={() => champ.current?.click()} disabled={envoi}>
          {envoi ? `Envoi… ${progres}` : '＋ Ajouter des photographies'}
        </button>
        <span className="small muted">
          JPG, JPEG, PNG ou WEBP — douze au maximum à la fois, depuis votre téléphone ou votre ordinateur. Elles
          s’ajoutent à la fin, puis se rangent comme les autres.
        </span>
      </div>

      {/* Le bandeau qui manquait. Il porte son propre bouton d'enregistrement :
          celui du bas de page existe déjà, mais après avoir déposé douze
          photographies on est en haut de la liste, et un bouton qu'il faut
          aller chercher trois écrans plus bas n'est pas un bouton. */}
      {modifie && (
        <p className="avert" style={{ borderColor: 'var(--accent)' }}>
          <strong>Rien n’est encore enregistré.</strong> Les photographies déposées sont bien sur le serveur, mais la
          galerie de ce logement ne les montrera qu’après enregistrement — et l’ordre que vous venez d’établir non
          plus.{' '}
          <button type="submit" className="btn-mini" style={{ marginTop: 12, display: 'inline-block' }}>
            Enregistrer maintenant
          </button>
        </p>
      )}

      {souci.length > 0 && (
        <p className="avert">
          {souci.map((x) => (
            <span key={x}>
              {x}
              <br />
            </span>
          ))}
        </p>
      )}

      {retenues.length === 0 && (
        <p className="avert">
          Aucune photographie retenue : la fiche de ce logement n’en montrera aucune. Remettez-en au moins une depuis
          la réserve ci-dessous, ou relancez l’import.
        </p>
      )}

      <div className="grille-photos">
        {retenues.map((u, i) => (
          <figure
            key={u}
            className={['vignette-carte', prise === i ? 'prise' : '', cible === i && prise !== i ? 'cible' : '']
              .filter(Boolean)
              .join(' ')}
            draggable
            onDragStart={() => setPrise(i)}
            onDragOver={(e) => {
              e.preventDefault();
              setCible(i);
            }}
            onDragEnd={() => {
              setPrise(null);
              setCible(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (prise !== null) deplacer(prise, i);
              setPrise(null);
              setCible(null);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" loading="lazy" />
            {i === 0 && <span className="etiquette">Couverture</span>}
            <figcaption>
              <button type="button" onClick={() => deplacer(i, i - 1)} disabled={i === 0} aria-label="Reculer">
                ‹
              </button>
              <span className="rang">{i + 1}</span>
              <button
                type="button"
                onClick={() => deplacer(i, i + 1)}
                disabled={i === retenues.length - 1}
                aria-label="Avancer"
              >
                ›
              </button>
              <button type="button" className="ecarter" onClick={() => ecarter(i)}>
                Écarter
              </button>
            </figcaption>
          </figure>
        ))}
      </div>

      {ecartees.length > 0 && (
        <>
          <h2 className="sous-titre">Écartées</h2>
          <p className="corps">
            Elles ne s’affichent plus sur le site, mais elles restent ici. Un clic les remet à la fin de la galerie.
          </p>
          <div className="grille-photos reserve">
            {ecartees.map((u, i) => (
              <figure key={u} className="vignette-carte">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" loading="lazy" />
                <figcaption>
                  <button type="button" onClick={() => remettre(i)}>
                    Remettre
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      )}
    </>
  );
}
