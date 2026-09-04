import { getT } from '@/lib/i18n';
import type { Bien } from '@/lib/biens';

/**
 * L'encadré des caractéristiques.
 *
 * Deux registres, et c'est voulu. Sur la première ligne, ce qui situe : le
 * quartier et le nombre de voyageurs, posés sur le fond de la page. En dessous,
 * dans un panneau bordé, ce qui se compte : chambres, lits, canapés-lits,
 * salles de bain, salles d'eau, surface, séjour minimum. Un voyageur lit la
 * première ligne pour savoir si le logement le concerne, et le panneau pour
 * vérifier qu'il lui convient.
 *
 * Trois distinctions y sont tenues parce qu'un voyageur les fait. Le
 * canapé-lit se compte à part des lits : « 4 lits » quand deux sont dans le
 * salon est exact et donne pourtant le sentiment d'avoir été trompé. La salle
 * de bain a une baignoire ; la salle d'eau, une douche et souvent le WC.
 * Promettre un bain à qui n'aura qu'une douche est la déception la plus banale
 * de la location courte durée, et la plus évitable.
 *
 * Seul ce qui est connu s'affiche. Une salle de bain posée par défaut serait
 * fausse la moitié du temps, et c'est le genre d'erreur qu'on découvre sur
 * place - donc trop tard. Ce que Lodgify ne dit pas se saisit dans
 * l'administration ; ce que personne n'a renseigné reste absent.
 */

/* Icônes linéaires, trait fin, coins arrondis - les mêmes que sur Staytle, pour
   que les deux sites se ressemblent là où ils font le même geste. */
const Ic = ({ children }: { children: React.ReactNode }) => (
  <svg className="fait-ic" viewBox="0 0 24 24" aria-hidden="true">
    {children}
  </svg>
);

const Epingle = () => (
  <Ic>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </Ic>
);
const Voyageurs = () => (
  <Ic>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
  </Ic>
);
const Chambre = () => (
  <Ic>
    <path d="M2 18v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5" />
    <path d="M2 18h20M6 11V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
  </Ic>
);
const Lit = () => (
  <Ic>
    <path d="M3 18V7M3 12h13a4 4 0 0 1 4 4v2M3 18h18" />
    <circle cx="8" cy="9.5" r="2" />
  </Ic>
);
const Bain = () => (
  <Ic>
    <path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2Z" />
    <path d="M6 12V5.5A1.5 1.5 0 0 1 7.5 4h0A1.5 1.5 0 0 1 9 5.5" />
    <path d="M7 19l-1 2M17 19l1 2" />
  </Ic>
);
/* Le canapé-lit : une assise, un dossier, des accoudoirs - on doit reconnaître
   un canapé et non un lit, sinon la distinction se perd à l'oeil au moment
   même où on la fait dans le texte. */
const Canape = () => (
  <Ic>
    <path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" />
    <path d="M2 13a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4H2v-4Z" />
    <path d="M5 17v2M19 17v2M7 11h10" />
  </Ic>
);
/* La salle d'eau : une douchette et son jet, par opposition à la baignoire. */
const Douche = () => (
  <Ic>
    <path d="M6 21V6a3 3 0 0 1 6 0v1" />
    <circle cx="16" cy="8" r="3" />
    <path d="M13 14v1M16 15v1M19 14v1M14.5 18v1M17.5 18v1" />
  </Ic>
);
const Surface = () => (
  <Ic>
    <path d="M15 4h5v5M20 4l-6 6M9 20H4v-5M4 20l6-6" />
  </Ic>
);
const Calendrier = () => (
  <Ic>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Ic>
);

export default function Faits({ b, locale, sejourMin }: { b: Bien; locale: string; sejourMin?: number }) {
  const t = getT(locale);
  const lieu = [b.ville, b.quartier].filter(Boolean).join(' · ');
  /* Le minimum lu dans le calendrier pour les dates demandées prime sur celui
     saisi : il est vrai pour ce séjour-là, l'autre n'est qu'une règle
     générale. */
  const minimum = sejourMin || b.sejourMin;

  const lignes = [
    { ic: <Chambre key="c" />, n: b.chambres, texte: (n: number) => t(n === 1 ? 'fait_chambre' : 'fait_chambres', { n }) },
    { ic: <Lit key="l" />, n: b.lits, texte: (n: number) => t(n === 1 ? 'fait_lit' : 'fait_lits', { n }) },
    { ic: <Canape key="cl" />, n: b.canapes, texte: (n: number) => t(n === 1 ? 'fait_canape' : 'fait_canapes', { n }) },
    { ic: <Bain key="b" />, n: b.bains, texte: (n: number) => t(n === 1 ? 'fait_bain' : 'fait_bains', { n }) },
    { ic: <Douche key="e" />, n: b.eau, texte: (n: number) => t(n === 1 ? 'fait_eau' : 'fait_eaux', { n }) },
    { ic: <Surface key="s" />, n: b.surface, texte: (n: number) => `${n} m²` },
    { ic: <Calendrier key="m" />, n: minimum && minimum > 1 ? minimum : 0, texte: (n: number) => t('fait_minimum', { n }) },
  ].filter((x): x is typeof x & { n: number } => !!x.n);

  if (!lieu && !b.voyageurs && !lignes.length) return null;

  return (
    <>
      <div className="faits-tete">
        {lieu && (
          <span className="fait">
            <Epingle />
            {lieu}
          </span>
        )}
        {!!b.voyageurs && (
          <span className="fait">
            <Voyageurs />
            {t(b.voyageurs === 1 ? 'fait_voyageur' : 'fait_voyageurs', { n: b.voyageurs })}
          </span>
        )}
      </div>

      {lignes.length > 0 && (
        <div className="faits-panneau">
          {lignes.map((x, k) => (
            <span className="fait" key={k}>
              {x.ic}
              {x.texte(x.n)}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
