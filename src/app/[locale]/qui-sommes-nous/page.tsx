import Link from 'next/link';
import { notFound } from 'next/navigation';
import { estLocale, getT } from '@/lib/i18n';
import { conciergerie } from '@/lib/conciergerie';
import { biens } from '@/lib/biens';

import { metaCommune } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = conciergerie(locale);
  /* Un titre et une description écrits POUR la page de résultats, et non
     repris du corps de la page.

     Ils l'étaient, et ils ne tenaient pas : soixante-dix-neuf caractères de
     titre et deux cent dix-huit de description, là où Google coupe vers
     soixante et cent soixante. Le lecteur voyait donc « L'écart entre un
     Airbnb ordinaire et une expérience IB Sign… » - une phrase tranchée au
     milieu d'un mot, qui ressemble à une négligence au moment précis où l'on
     décide de cliquer.

     Un titre de page et un titre de résultat n'ont pas le même travail à
     faire. Le premier ouvre un texte qu'on est en train de lire ; le second
     doit gagner un clic contre neuf autres lignes. */
  return metaCommune(
    locale,
    '/qui-sommes-nous',
    locale === 'en' ? 'How we run our apartments · IB Signature' : 'Notre façon de tenir un appartement · IB Signature',
    locale === 'en'
      ? 'What separates an ordinary Airbnb from an IB Signature stay: our own teams, never subcontracted, and a hotel standard on every detail.'
      : 'Ce qui sépare un Airbnb ordinaire d’un séjour IB Signature : des équipes en propre, jamais de sous-traitance, et un standard d’hôtel sur chaque détail.'
  );
}

/**
 * Qui sommes-nous.
 *
 * La page reprend conciergerie.ibsignature.com mot pour mot, ses encarts et ses
 * photographies comprises. Les sous-menus ne sont pas une invention de mise en
 * page : ce sont exactement les pages du site de conciergerie - Notre approche,
 * Notre engagement, Nos services, Nos résultats - réunies ici sous des ancres,
 * parce qu'obliger à quatre chargements pour lire quatre écrans n'apporte rien.
 *
 * Une seule phrase a changé, à votre demande : « ADR-first, pas
 * occupation-first » se lit désormais « Le prix de la nuit d'abord, le
 * remplissage ensuite », et le sigle ADR a disparu partout où il figurait dans
 * le corps du texte. Le reste est intact, ponctuation comprise.
 *
 * Les photographies ne sont plus servies depuis un hébergeur extérieur : elles
 * vivent dans public/, chez vous. Le jour où cet hébergeur bougeait une
 * adresse, la page se retrouvait avec des cadres vides.
 *
 * Deux sources, et la distinction compte. Les deux illustrations d'ambiance
 * sont les images que vous avez fournies. Les trois études de cas, elles,
 * prennent les photographies de vos propres logements chez Lodgify : ces
 * cartes nomment un bien précis, « Anfa, appartement 2 chambres », et les
 * illustrer d'une image d'ambiance laisserait croire que c'est ce logement-là.
 * Sans Lodgify, elles n'affichent aucune image plutôt qu'une image d'ailleurs.
 */
export default async function QuiSommesNous({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!estLocale(locale)) notFound();
  const t = getT(locale);
  const c = conciergerie(locale);

  /* Les photographies des études de cas : les vôtres, chez Lodgify. Aucune
     image de remplacement - une carte qui nomme un logement précis ne doit pas
     être illustrée par un intérieur qui n'est pas le sien. */
  const catalogue = await biens();
  const miennes = catalogue.filter((b) => b.photos[0]).map((b) => ({ url: b.photos[0], alt: b.nom }));
  const image = (n: number) => miennes[n % miennes.length];

  const sections = [
    { id: 'approche', l: c.principes_sur },
    { id: 'methode', l: c.methode_sur },
    { id: 'engagement', l: c.engagement_sur },
    { id: 'services', l: c.services_sur },
    { id: 'distribution', l: c.distribution_sur },
  ];

  return (
    <>
      {/* Le sommaire ouvre la page : il dit en une ligne tout ce qu'elle
          contient, et l'accroche pleine hauteur qui le précédait ne faisait
          que repousser la lecture d'un écran. */}
      <nav className="sous-menu sous-menu-haut" aria-label={t('qs_menu')}>
        <div className="wrap">
          <span className="surtitre">{t('qs_menu')}</span>
          <ul>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.l}</a>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <section className="section">
        <div className="wrap presentation">
          <div className="presentation-image presentation-portrait">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/maison-1.jpg"
              srcSet="/maison-1-petit.jpg 405w, /maison-1.jpg 736w"
              sizes="(max-width: 900px) 100vw, 48vw"
              alt={c.principes[0].t}
              loading="lazy"
            />
          </div>
          <div className="presentation-texte">
            <hr className="filet-or" />
            <div className="eyebrow">{t('qs_sur')}</div>
            <h1 style={{ margin: '14px 0 8px' }}>{c.approche_titre}</h1>
            {c.approche_p.map((p, i) => (
              <p key={i} className={i === 0 ? 'manifeste-phrase' : 'lead'} style={{ marginTop: i ? 20 : 18 }}>
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- trois principes ---------- */}
      <section className="section section-alt" id="approche">
        <div className="wrap">
          <hr className="filet-or" />
          <div className="eyebrow">{c.principes_sur}</div>
          <h2 style={{ marginTop: 14, marginBottom: 44 }}>{c.principes_titre}</h2>
          <div className="grid3 piliers">
            {c.principes.map((x, i) => (
              <article key={x.t} className="pilier">
                <div className="pilier-n">{String(i + 1).padStart(2, '0')}</div>
                <h3>{x.t}</h3>
                <p className="muted small">{x.p}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- la méthode ---------- */}
      <section className="section" id="methode">
        <div className="wrap parcours-photo">
          <div>
            <hr className="filet-or" />
            <div className="eyebrow">{c.methode_sur}</div>
            <h2 style={{ marginTop: 14, marginBottom: 34 }}>{c.methode_titre}</h2>
            <ol className="etapes">
              {c.methode.map((e) => (
                <li key={e.n}>
                  <span className="etape-n">{e.n}</span>
                  <div>
                    <h3>{e.t}</h3>
                    <p className="muted small" style={{ margin: '6px 0 0' }}>
                      {e.p}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="presentation-image presentation-portrait">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/maison-2.jpg"
              srcSet="/maison-2-petit.jpg 545w, /maison-2.jpg 990w"
              sizes="(max-width: 900px) 100vw, 44vw"
              alt={c.principes[2].t}
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ---------- notre engagement ----------
          La phrase que vous nous demandiez de reprendre, et ses trois encarts.
          Elle est posée seule, en grand : c'est un engagement, pas un argument
          parmi d'autres. */}
      <section className="section section-alt" id="engagement">
        <div className="wrap">
          <hr className="filet-or" />
          <div className="eyebrow">{c.engagement_sur}</div>
          <p className="manifeste-phrase" style={{ maxWidth: '30ch', marginTop: 18 }}>
            {c.engagement_p}
          </p>
          <div className="grid3 encarts">
            {c.engagement_cartes.map((x) => (
              <article key={x.t} className="encart">
                <hr className="filet-or" />
                <h3>{x.t}</h3>
                <p className="muted small">{x.p}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- nos services ---------- */}
      <section className="section" id="services">
        <div className="wrap">
          <div className="duo">
            <div>
              <hr className="filet-or" />
              <div className="eyebrow">{c.services_sur}</div>
              <h2 style={{ marginTop: 14 }}>{c.services_titre}</h2>
            </div>
            <p className="lead" style={{ margin: 0 }}>
              {c.services_p}
            </p>
          </div>

          <div className="grid3 encarts">
            {c.services.map((s) => (
              <article key={s.t} className="encart">
                <hr className="filet-or" />
                <h3>{s.t}</h3>
                <p className="muted small">{s.p}</p>
                {s.puces && (
                  <ul className="jetons">
                    {s.puces.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>

          <div className="card card-pad operateur">
            <div>
              <hr className="filet-or" />
              <h2 style={{ marginTop: 14 }}>{c.operateur_titre}</h2>
            </div>
            <p className="lead" style={{ margin: 0, fontSize: 17 }}>
              {c.operateur_p}
            </p>
          </div>
        </div>
      </section>

      {/* ---------- la distribution et les propriétaires ----------
          Le bloc « Nos résultats » a été retiré, avec ses trois études de cas :
          il annonçait des résultats concrets et affichait des chiffres que
          personne n'avait renseignés. Mieux vaut ne rien promettre que
          promettre à vide. Ce qui reste ici ne promet rien - ce sont des faits
          vérifiables : les plateformes où vos biens sont distribués, et la
          parole de propriétaires qui ont signé. */}
      <section className="section section-alt" id="distribution">
        <div className="wrap">
          <div className="distribution">
            <hr className="filet-or" />
            <div className="eyebrow">{c.distribution_sur}</div>
            <h3 style={{ marginTop: 12, marginBottom: 20 }}>{c.distribution_titre}</h3>
            <ul className="jetons jetons-large">
              {c.plateformes.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>

          <h3 className="surtitre" style={{ marginTop: 56, marginBottom: 24 }}>
            {c.temoins_titre}
          </h3>
          <div className="grid3 avis-grille">
            {c.temoins.map((x) => (
              <figure key={x.nom} className="avis-carte avis-carte-nue">
                <blockquote>{x.texte}</blockquote>
                <figcaption>
                  <span className="avis-qui">{x.nom}</span>
                  <span className="avis-bien small muted">{x.bien}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- l'appel final ---------- */}
      <section className="section">
        <div className="wrap">
          <div className="card card-pad proprio">
            <div>
              <hr className="filet-or" />
              <div className="eyebrow">{t('prop_sur')}</div>
              <h2 style={{ marginTop: 14 }}>{c.cta_titre}</h2>
            </div>
            <div>
              <p className="lead" style={{ fontSize: 17 }}>
                {c.cta_p}
              </p>
              <Link href={`/${locale}/proprietaires#audit`} className="btn" style={{ marginTop: 10 }}>
                {c.cta_bouton}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
