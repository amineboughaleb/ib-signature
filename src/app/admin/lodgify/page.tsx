import { redirect } from 'next/navigation';
import { connecte } from '@/lib/admin';
import { refusVus, oublierRefus } from '@/lib/limite';
import { prixEssaiActif, diagnostic, diagnosticDevis, diagnosticDispos, diagnosticEcriture, diagnosticGalerie, diagnosticTarifs } from '@/lib/lodgify';

export const dynamic = 'force-dynamic';

/**
 * Le diagnostic Lodgify.
 *
 * Le client normal avale les pannes en silence : un visiteur ne doit jamais
 * voir « 401 Unauthorized », il doit voir un catalogue. Mais vous, si. Cette
 * page refait exactement le même appel et montre ce que Lodgify répond, y
 * compris le corps de la réponse - c'est précisément ce que leur support
 * demande pour trancher.
 *
 * La clé n'est jamais affichée. On montre sa longueur et ce qui cloche autour
 * d'elle : un guillemet recopié depuis la documentation, un espace de fin
 * ramassé par un copier-coller, un « Bearer » ajouté par habitude. Ces trois
 * accidents expliquent l'essentiel des 401, et aucun ne se voit à l'oeil nu
 * dans un fichier de configuration.
 */
export default async function DiagnosticLodgify() {
  if (!(await connecte())) redirect('/admin');
  /* On remet le compteur à zéro avant de commencer : ce qu'on veut savoir,
     c'est combien d'appels CE diagnostic s'est fait refuser, pas combien le
     serveur en a cumulé depuis son démarrage. */
  oublierRefus();
  const d = await diagnostic();
  /* Les cinq sondes partent ensemble.

     Elles s'enchaînaient, et cette page mettait deux à trois minutes. Aucune
     ne dépend du résultat d'une autre : la galerie n'a que faire des tarifs,
     l'écriture que faire des disponibilités. Les enchaîner laissait surtout
     la file d'attente à l'arrêt - une sonde qui attend l'expiration d'un
     appel de douze secondes n'occupe qu'un des trois créneaux, et les deux
     autres ne servaient à personne.

     Le nombre d'appels ne change pas ; c'est le temps mort qui disparaît. */
  const [dispo, galerie, tarifs, ecriture, devis] =
    d.statut === 200
      ? await Promise.all([
          diagnosticDispos(),
          diagnosticGalerie(),
          diagnosticTarifs(),
          diagnosticEcriture(),
          diagnosticDevis(),
        ])
      : [null, null, null, null, null];
  /* Combien d'appels Lodgify a refusés pendant ce diagnostic, faute de débit.
     C'est la nouvelle la plus utile de la page quand elle n'est pas nulle :
     tout ce qui suit paraît alors absent alors qu'il est seulement refusé. */
  const refuses = refusVus();

  const verdict = !d.configuree
    ? 'La clé n’est pas lue par le serveur.'
    : d.statut === 200
      ? `Lodgify répond, ${d.nbBiens} logement(s) reçus.`
      : d.statut === 401
        ? 'Lodgify refuse la clé (401).'
        : d.statut === 403
          ? 'Lodgify refuse l’accès (403).'
          : d.statut
            ? `Lodgify répond ${d.statut}.`
            : 'Lodgify n’a pas répondu du tout.';

  return (
    <>
      <h1>Connexion à Lodgify</h1>
      <p className="muted" style={{ marginBottom: 30, maxWidth: '70ch' }}>
        {verdict} Rechargez cette page après chaque modification de la configuration ; le serveur doit avoir été
        relancé, un fichier <code>.env.local</code> n’étant lu qu’au démarrage.
      </p>

      <article className="boite">
        <div className="boite-tete">
          <span className="fiche-titre">La requête</span>
          <span className="fiche-meta">{d.duree} ms</span>
        </div>
        <dl>
          <div>
            <dt>Adresse appelée</dt>
            <dd>{d.url}</dd>
          </div>
          <div>
            <dt>En-tête</dt>
            <dd>X-ApiKey</dd>
          </div>
          <div>
            <dt>Statut</dt>
            <dd>{d.statut ?? 'aucune réponse'}</dd>
          </div>
        </dl>
      </article>

      <article className="boite">
        <div className="boite-tete">
          <span className="fiche-titre">La clé</span>
          <span className="fiche-meta">{d.configuree ? `${d.longueur} caractères` : 'absente'}</span>
        </div>
        {!d.configuree && (
          <p className="corps">
            Le serveur ne voit aucune valeur pour LODGIFY_API_KEY. Trois causes possibles, dans l’ordre de fréquence :
            le fichier s’appelle en réalité .env.local.txt ; il n’est pas à la racine du projet, à côté de
            package.json ; ou le serveur n’a pas été relancé depuis que vous l’avez écrit.
          </p>
        )}
        {d.anomalies.length > 0 && (
          <ul className="corps" style={{ paddingLeft: 18 }}>
            {d.anomalies.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
        {d.configuree && d.anomalies.length === 0 && (
          <p className="corps">Aucune anomalie de forme : ni guillemets, ni espace, ni préfixe.</p>
        )}
      </article>

      {d.statut === 200 && (
        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Les photographies</span>
            <span className="fiche-meta">
              {d.nbPhotos === null ? '-' : `${d.nbPhotos} sur ${d.nbBiens} logement(s)`}
            </span>
          </div>
          {d.nbPhotos === 0 ? (
            <p className="corps">
              Lodgify répond, mais aucun de ces logements ne porte d’adresse d’image exploitable. Les champs
              contenant une image dans la réponse sont : {d.champsPhoto.join(', ') || 'aucun'}. Envoyez-moi cette
              ligne, je saurai où aller les chercher.
            </p>
          ) : (
            <p className="corps">
              Les photographies sont lues. Si l’accueil n’en montre toujours pas, patientez cinq minutes : le
              catalogue est gardé en mémoire pendant ce délai, ou relancez le serveur pour voir l’effet
              immédiatement.
            </p>
          )}
          <p className="corps small muted" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
            Champs du premier logement : {d.champs.join(', ')}
          </p>
        </article>
      )}

      {d.statut === 200 && (
        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">La capacité d’accueil</span>
            {/* Le chiffre annoncé est celui du catalogue, pas celui de la
                liste : c'est le catalogue qui filtre les voyageurs. La liste
                seule n'en porte jamais, et l'annoncer donnait « 0 sur 24 »
                au-dessus d'un texte disant que tout fonctionnait. */}
            <span className="fiche-meta">
              {d.capacitesCatalogue !== null
                ? `${d.capacitesCatalogue} sur ${d.nbBiens} logement(s)`
                : d.nbCapacites === null
                  ? '-'
                  : `${d.nbCapacites} sur ${d.nbBiens} logement(s)`}
            </span>
          </div>
          {d.capacitesCatalogue === 0 && (
            <p className="corps">
              Aucun logement ne publie un nombre de voyageurs lisible. Le filtre « voyageurs » n’écarte alors personne,
              plutôt que de vider la liste.
            </p>
          )}
          {d.detailNecessaire && (
            <p className="corps">
              La capacité se lit à trois niveaux chez Lodgify. <code>/v2/properties</code> ne rend qu’un résumé.{' '}
              <code>/v2/properties/{'{id}'}</code> ajoute un tableau <code>rooms</code> dont les éléments n’ont que{' '}
              <code>id</code> et <code>name</code>.{' '}
              <code>/v2/properties/{'{id}'}/rooms</code> est le seul à porter le nombre de personnes.{' '}
              {d.chambresStatut === 200
                ? d.capaciteLue
                  ? `Il répond, et annonce ${d.capaciteLue} personne(s) sur le premier logement : le filtre fonctionne.`
                  : 'Il répond, mais sans capacité lisible. Envoyez-moi les champs ci-dessous.'
                : `Il a répondu ${d.chambresStatut ?? 'rien'}.`}
            </p>
          )}
          {d.capacitesCatalogue !== null && d.capacitesCatalogue > 0 && (
            <p className="corps">
              La capacité est lue. Un logement dont elle resterait inconnue n’est jamais écarté d’une recherche : le
              doute profite à l’affichage.
            </p>
          )}
          <p className="corps small muted" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
            Champs de capacité dans la liste : {d.champsCapacite.join(', ') || 'aucun'}
          </p>
          {d.champsDetail.length > 0 && (
            <p className="corps small muted" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
              Champs de la fiche détaillée : {d.champsDetail.join(', ')}
            </p>
          )}
          {d.champsChambres.length > 0 && (
            <p className="corps small muted" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
              Champs d’une chambre : {d.champsChambres.join(', ')}
            </p>
          )}
        </article>
      )}

      {galerie && (
        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Les galeries</span>
            <span className="fiche-meta">
              {galerie.total} image(s) au total, {galerie.max} au maximum sur un logement
            </span>
          </div>
          {galerie.max > 1 ? (
            <p className="corps">
              Les galeries sont complètes. Chemin retenu : <code>{galerie.chemin || 'la liste suffit'}</code>.
            </p>
          ) : (
            <>
              <p className="corps">
                Chaque logement n’a qu’une seule photographie : la version 2 de l’API n’expose qu’un{' '}
                <code>image_url</code> de couverture. Voici ce que répond chaque chemin essayé, sur votre premier
                logement. Envoyez ce tableau au support Lodgify en leur demandant par quel point d’entrée récupérer
                toutes les photos d’un logement.
              </p>
              <dl style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                {galerie.essais.map((e) => (
                  <div key={e.chemin} style={{ display: 'block' }}>
                    <dt style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {e.chemin} · {e.statut ?? 'aucune réponse'}
                      {e.images ? ` · ${e.images} image(s)` : ''}
                    </dt>
                    <dd className="small muted" style={{ margin: '2px 0 0', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>
                      {e.corps.slice(0, 160) || 'vide'}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="corps">
                En attendant, l’onglet Réservation permet de coller les adresses des photos, logement par logement.
              </p>
            </>
          )}
        </article>
      )}

      {tarifs && (
        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Le séjour minimum</span>
            <span className="fiche-meta">{tarifs.lus ? `${tarifs.lus} logement(s) lus` : 'non lu'}</span>
          </div>
          {tarifs.lus ? (
            <p className="corps">
              Le calendrier des tarifs répond. Chemin retenu : <code>{tarifs.chemin}</code>. Un logement qui demande
              plus de nuits que la période choisie est désormais écarté de la liste, avec l’explication, au lieu
              d’envoyer le voyageur vers un moteur qui lui répondra « aucun résultat ».
            </p>
          ) : (
            <>
              <p className="corps">
                Le séjour minimum n’est pas lisible. Le site n’écarte alors aucun logement, mais un voyageur peut
                encore tomber sur une recherche vide sur votre moteur. Voici ce que répond chaque chemin essayé :
              </p>
              <dl style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                {tarifs.essais.map((e) => (
                  <div key={e.chemin}>
                    <dt style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {e.chemin} · {e.statut ?? 'aucune réponse'}
                    </dt>
                    <dd className="small muted" style={{ margin: '2px 0 0', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>
                      {e.corps.slice(0, 160) || 'vide'}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </article>
      )}

      {refuses > 0 && (
        <p className="avert">
          <strong>{refuses} appel(s) refusés par Lodgify pour cause de débit</strong> pendant ce diagnostic. Lodgify
          accepte 750 appels par minute, mais coupe bien avant sur une rafale — et un refus ressemble à une absence :
          les encadrés ci-dessous diront « aucun chemin n’a répondu » alors que les chemins répondaient. Rechargez
          la page dans une minute pour un diagnostic propre ; le site, lui, ralentit et réessaie plutôt que
          d’abandonner.
        </p>
      )}

      {prixEssaiActif() && (
        <p className="avert">
          <strong>Un prix d’essai est actif</strong> ({prixEssaiActif()} €) : tous les séjours sont chiffrés à ce
          montant, quels que soient le logement et les dates. C’est une aide au développement, jamais un état de
          marche. Retirez <code>LODGIFY_DEVIS_ESSAI</code> de l’environnement avant d’ouvrir le site à qui que ce
          soit. En production, cette variable est ignorée de toute façon.
        </p>
      )}

      {devis && (
        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Le prix d’un séjour</span>
            <span className="fiche-meta">
              {devis.resultat.connu
                ? `${devis.resultat.total?.toFixed(2)} ${devis.resultat.devise || ''}`
                : 'non lisible'}
            </span>
          </div>
          {devis.resultat.connu ? (
            <p className="corps">
              Lodgify rend le prix exact d’un séjour précis. Chemin retenu : <code>{devis.chemin}</code>. C’est ce qui
              permet au site d’annoncer lui-même le montant à virer, sans vous obliger à répondre à la main : le
              voyageur choisit ses dates, lit un prix ferme, et vous recevez une demande déjà chiffrée. Le total n’est
              jamais recalculé ici — multiplier un tarif de nuit par un nombre de nuits ignorerait les remises longue
              durée, le ménage et la taxe de séjour, et donnerait un montant faux avec l’assurance d’un montant juste.
            </p>
          ) : (
            <>
              <p className="corps">
                Aucun chemin n’a rendu de prix exploitable ({devis.resultat.detail || 'sans détail'}). Le virement
                n’est alors proposé à personne : mieux vaut un seul moyen de paiement qu’un montant annoncé au
                hasard. Le site continue de fonctionner exactement comme avant, la carte reprenant seule la main.
                Voici ce que répond chaque chemin essayé — envoyez-le au support Lodgify en leur demandant lequel
                s’applique à votre offre, et je le mets en place.
              </p>
              <dl style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                {devis.essais.map((e) => (
                  <div key={e.chemin}>
                    <dt style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                      {e.chemin} · {e.statut ?? 'aucune réponse'}
                    </dt>
                    <dd className="small muted" style={{ margin: '2px 0 0', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>
                      {e.corps.slice(0, 160) || 'vide'}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </article>
      )}

      {dispo && (
        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Les disponibilités</span>
            <span className="fiche-meta">{dispo.connu ? `${dispo.nbLibres} logement(s) libres sur l’essai` : 'non lues'}</span>
          </div>
          {dispo.connu ? (
            <p className="corps">
              Le calendrier répond. Chemin retenu : <code>{dispo.chemin}</code>. Quand un voyageur saisit deux dates,
              la liste n’affiche plus que les logements libres sur toute la période.
            </p>
          ) : (
            <p className="corps">
              Aucun des chemins essayés n’a rendu un calendrier exploitable. Ce n’est pas bloquant : le site
              n’écarte alors aucun logement et prévient le voyageur que la disponibilité sera confirmée à l’étape de
              réservation. Chemins essayés : {dispo.essayes.join(' · ')}. Envoyez cette liste au support Lodgify en
              leur demandant lequel est le bon pour votre compte, et je le mets en place.
            </p>
          )}
        </article>
      )}

      {d.statut === 200 && (
        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">L’adresse de réservation</span>
            <span className="fiche-meta">{d.pistesAdresse.length ? `${d.pistesAdresse.length} piste(s)` : 'aucune piste'}</span>
          </div>
          <p className="corps">
            {d.pistesAdresse.length
              ? 'Un ou plusieurs champs ressemblent à une adresse ou à un identifiant lisible. Envoyez-moi les lignes ci-dessous : si l’un d’eux correspond vraiment à l’adresse de la fiche sur votre moteur, les vingt-quatre liens se construiront tout seuls au lieu d’être collés un par un.'
              : 'Aucun champ ne ressemble à une adresse ni à un identifiant lisible. Les adresses de réservation devront donc être collées logement par logement — une fois pour toutes, dans l’onglet Logements.'}
          </p>
          {d.pistesAdresse.length > 0 && (
            <p className="corps small muted" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
              {d.pistesAdresse.join(' · ')}
            </p>
          )}
          <p className="corps small muted" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
            Champs de la fiche détaillée : {d.champsDetail.join(', ') || 'aucun — la fiche n’a pas répondu'}
          </p>
        </article>
      )}

      {d.statut === 200 && (
        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Les présentations</span>
            <span className="fiche-meta">
              {d.descriptionLue ? `${d.descriptionLue} caractères sur le premier logement` : 'aucune'}
            </span>
          </div>
          <p className="corps">
            {d.descriptionLue
              ? 'Lodgify publie bien un texte par logement : il s’affiche sur les fiches, et se réécrit logement par logement dans l’onglet Logements.'
              : 'Aucun champ de la fiche détaillée ne ressemble à une description. Les textes de vos annonces vivent peut-être ailleurs dans votre compte, ou l’API ne les expose pas. En attendant, écrivez-les vous-même dans l’onglet Logements : ce sont de toute façon de meilleurs textes que ceux rédigés pour Airbnb.'}
          </p>
          {d.champsTexteDetail.length > 0 && (
            <p className="corps small muted" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
              Champs de texte de la fiche : {d.champsTexteDetail.join(', ')}
            </p>
          )}
        </article>
      )}

      {ecriture && ecriture.length > 0 && (
        <article className="boite">
          <div className="boite-tete">
            <span className="fiche-titre">Votre clé peut-elle écrire&nbsp;?</span>
            <span className="fiche-meta">
              {ecriture.some((e) => e.lecture === 'autorisée') ? 'oui, au moins en partie' : 'non'}
            </span>
          </div>
          <p className="corps">
            Réserver par virement suppose de bloquer les dates pendant que le virement chemine. Ce test le vérifie
            en appelant chaque point d’entrée d’écriture avec un corps vide : sans dates ni voyageur, aucune
            réservation ne peut en naître. Seul le refus nous intéresse. Un 401 ou 403 dit que la clé ne peut pas
            écrire ; un 400 ou 422 dit qu’elle le peut et que ce sont les données qui manquent.
          </p>
          <table className="tableau">
            <tbody>
              {ecriture.map((e) => (
                <tr key={e.chemin + e.methode}>
                  <td>{e.quoi}</td>
                  <td>
                    <code>
                      {e.methode} {e.chemin}
                    </code>
                  </td>
                  <td>{e.statut ?? '—'}</td>
                  <td>
                    {e.lecture === 'autorisée'
                      ? 'écriture possible'
                      : e.lecture === 'refusée'
                        ? 'écriture refusée'
                        : e.lecture === 'inexistante'
                          ? 'pas sur votre offre'
                          : 'indéterminé'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="corps">
            {ecriture.some((e) => e.lecture === 'autorisée')
              ? 'Le blocage des dates pourra être automatique : à votre validation, le site posera lui-même la réservation dans Lodgify.'
              : 'Le blocage restera manuel : le site vous préparera la réservation et vous la poserez dans Lodgify en un clic. C’est plus sûr qu’une automatisation devinée, et cela vous laisse le dernier mot sur chaque virement.'}
          </p>
        </article>
      )}

      <article className="boite">
        <div className="boite-tete">
          <span className="fiche-titre">La réponse de Lodgify</span>
          <span className="fiche-meta">600 premiers caractères</span>
        </div>
        <p className="corps" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
          {d.extrait || 'vide'}
        </p>
      </article>

      {d.statut === 401 && (
        <p className="avert" style={{ marginTop: 34 }}>
          Un 401 avec une clé bien formée signifie que Lodgify ne reconnaît pas cette valeur. Retournez dans Lodgify,
          Settings puis Public API, et recopiez la clé affichée à cet endroit précis : une clé d’un autre écran, ou une
          ancienne clé révoquée, donne exactement cette réponse. Copiez ensuite ce que montre cette page à votre
          interlocuteur Lodgify, sans la clé : adresse appelée, en-tête, statut et corps de réponse, c’est ce qu’il
          demande.
        </p>
      )}
    </>
  );
}
