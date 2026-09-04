import { notFound } from 'next/navigation';
import { estLocale, getT } from '@/lib/i18n';
import { conciergerie } from '@/lib/conciergerie';
import FormulaireAudit from '@/components/FormulaireAudit';
import { FAQ } from '@/lib/faq';
import DonneesStructurees from '@/components/DonneesStructurees';

import { jsonFaq, metaCommune } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = getT(locale);
  /* Passer par `metaCommune` et non par un objet nu : sans lui, la page
     hérite de la canonique de la mise en page - celle de l'accueil - et
     annonce donc à Google qu'elle est un doublon de la page d'accueil. Cinq
     pages étaient dans ce cas, et se dés-indexaient elles-mêmes en silence. */
  return metaCommune(locale, '/proprietaires', `${t('po_titre')} · IB Signature`, t('po_texte'));
}

/**
 * La page des propriétaires.
 *
 * Elle reprend l'accueil de conciergerie.ibsignature.com, dans son ordre et
 * dans ses mots, encarts compris. Une seule phrase change : « ADR-first, pas
 * occupation-first » devient « Le prix de la nuit d'abord, le remplissage
 * ensuite », parce qu'un propriétaire qui doit chercher un sigle a déjà cessé
 * de lire. Le reste est intact - « les biens sous-exploités au Maroc plafonnent
 * à 30-35% d'occupation » est un chiffre, et un chiffre convainc là où trois
 * adjectifs laissent froid.
 *
 * L'ordre est celui d'une conversation de vente : le constat d'abord, parce
 * qu'un propriétaire veut d'abord savoir qu'on a compris son problème ; la
 * différence ensuite ; les preuves ; puis, seulement à la fin, ce qu'on lui
 * demande de faire - et c'est peu, un formulaire d'une minute.
 */
export default async function Proprietaires({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!estLocale(locale)) notFound();
  const t = getT(locale);
  const c = conciergerie(locale);
  const faq = FAQ[locale === 'en' ? 'en' : 'fr'];

  const constat = [
    { n: '01', t: t('po_pb1_t'), p: t('po_pb1_p') },
    { n: '02', t: t('po_pb2_t'), p: t('po_pb2_p') },
    { n: '03', t: t('po_pb3_t'), p: t('po_pb3_p') },
  ];
  const difference = [
    { t: t('po_n1_t'), p: t('po_n1_p') },
    { t: t('po_n2_t'), p: t('po_n2_p') },
    { t: t('po_n3_t'), p: t('po_n3_p') },
  ];
  /* Une numérotation légitime : ce sont quatre étapes dans l'ordre, et chacune
     porte son délai. Un propriétaire qui hésite veut savoir à quoi il s'engage
     en temps, pas seulement en principe. */
  const etapes = [
    { n: '01', t: t('po_e1'), d: t('po_e1_d'), p: t('po_e1_p') },
    { n: '02', t: t('po_e2'), d: t('po_e2_d'), p: t('po_e2_p') },
    { n: '03', t: t('po_e3'), d: t('po_e3_d'), p: t('po_e3_p') },
    { n: '04', t: t('po_e4'), d: t('po_e4_d'), p: t('po_e4_p') },
  ];

  return (
    <>
      {/* La FAQ écrite une seconde fois, dans la forme qu'un moteur et un
          assistant savent lire.

          Elle était affichée sans être balisée : douze questions-réponses
          rédigées, exactement le format que Google reprend en résultat enrichi
          et qu'un assistant cite mot pour mot quand on lui demande « comment
          marche une conciergerie à Casablanca » - et rien ne le disait. C'est
          la surface de référencement la moins chère du site, et elle était
          laissée par terre.

          Aucun contenu nouveau : ce sont les mêmes questions et les mêmes
          réponses que la page affiche. Baliser autre chose que ce qui est
          visible est précisément ce que Google sanctionne. */}
      <DonneesStructurees donnees={jsonFaq(faq.questions)} />
    <>
      <section className="accroche accroche-courte">
        <div className="accroche-fond" aria-hidden="true" />
        <div className="wrap accroche-corps">
          <div className="eyebrow">{t('po_sur')}</div>
          <h1>{t('po_titre')}</h1>
          <p className="lead">{t('po_texte')}</p>
          <p className="rassurance">{t('po_rassurance')}</p>
        </div>
      </section>

      <section className="section-tight chiffres">
        <div className="wrap grid4">
          <div className="chiffre">
            <b>24</b>
            <span className="small muted">{t('chiffre_1')}</span>
          </div>
          <div className="chiffre">
            <b>4,93</b>
            <span className="small muted">{t('chiffre_2')}</span>
          </div>
          <div className="chiffre">
            <b>8 h - 22 h</b>
            <span className="small muted">{t('chiffre_3')}</span>
          </div>
          <div className="chiffre">
            <b>2</b>
            <span className="small muted">{t('chiffre_4')}</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <hr className="filet-or" />
          <div className="eyebrow">{t('po_pb_sur')}</div>
          <h2 style={{ marginTop: 14, marginBottom: 44 }}>{t('po_pb_titre')}</h2>
          <div className="grid3 piliers">
            {constat.map((x) => (
              <article key={x.n} className="pilier">
                <div className="pilier-n">{x.n}</div>
                <h3>{x.t}</h3>
                <p className="muted small">{x.p}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="wrap">
          <hr className="filet-or" />
          <div className="eyebrow">{t('po_nous_sur')}</div>
          <h2 style={{ marginTop: 14, marginBottom: 44 }}>{t('po_nous_titre')}</h2>
          <div className="grid3 piliers">
            {difference.map((x) => (
              <article key={x.t} className="pilier">
                <h3>{x.t}</h3>
                <p className="muted small">{x.p}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- notre engagement ----------
          Le paragraphe de conciergerie.ibsignature.com et ses trois encarts,
          repris mot pour mot. Il est posé seul et en grand : c'est un
          engagement, pas un argument parmi d'autres. */}
      <section className="section-tight" id="engagement">
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

      {/* ---------- l'audit, remonté avant le processus ----------
          Il était en bas, après le déroulé des étapes. Or c'est lui la
          proposition : un propriétaire veut savoir ce qu'on lui offre avant de
          lire comment cela se déroulera. Le processus répond à une question
          qu'on ne se pose qu'une fois convaincu. */}
      <section className="section-tight">
        <div className="wrap">
          <div className="card card-pad proprio">
            <div>
              <hr className="filet-or" />
              <div className="eyebrow">{t('po_audit_sur')}</div>
              <h2 style={{ marginTop: 14 }}>{t('po_audit_titre')}</h2>
            </div>
            <div>
              <p className="lead" style={{ fontSize: 17 }}>
                {t('po_audit_p')}
              </p>
              <a href="#audit" className="btn" style={{ marginTop: 10 }}>
                {t('po_cta')}
              </a>
              <p className="small muted" style={{ marginTop: 16 }}>
                {t('po_audit_pied')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap parcours-audit">
          <div>
            <hr className="filet-or" />
            <div className="eyebrow">{t('po_parcours_sur')}</div>
            <h2 style={{ marginTop: 14, marginBottom: 8 }}>{t('po_parcours_titre')}</h2>
            <p className="muted small" style={{ marginBottom: 34, maxWidth: '46ch' }}>
              {t('po_parcours_p')}
            </p>
            <ol className="etapes">
              {etapes.map((e) => (
                <li key={e.n}>
                  <span className="etape-n">{e.n}</span>
                  <div>
                    <h3>{e.t}</h3>
                    <span className="etape-delai">{e.d}</span>
                    <p className="muted small" style={{ margin: '6px 0 0' }}>
                      {e.p}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div id="audit">
            <FormulaireAudit locale={locale} />
          </div>
        </div>
      </section>

      {/* ---------- les questions qu'on se pose avant d'écrire ----------
          Un propriétaire qui hésite a quatre ou cinq questions en tête, et tant
          qu'elles restent sans réponse il ne remplit pas le formulaire. Les
          réponses sont dépliables : la page reste lisible d'un coup d'oeil, et
          chacun n'ouvre que ce qui le concerne. La première est ouverte, pour
          qu'on comprenne sans cliquer que ces titres cachent des réponses. */}
      <section className="section-tight" style={{ paddingBottom: 96 }} id="questions">
        <div className="wrap">
          <hr className="filet-or" />
          <div className="eyebrow">{faq.sur}</div>
          <h2 style={{ marginTop: 14, marginBottom: 34 }}>{faq.titre}</h2>
          <div className="faq">
            {faq.questions.map((x, i) => (
              <details key={x.q} open={i === 0}>
                <summary>{x.q}</summary>
                <p>{x.r}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

    </>
    </>
  );
}
