/**
 * Le JSON-LD d'une page.
 *
 * Un composant, et non un `dangerouslySetInnerHTML` recopié dans chaque page :
 * l'échappement du `<` est la seule chose qui empêche qu'un nom de logement
 * contenant « </script> » ne referme la balise et ne laisse le reste du
 * document à la merci de ce qui suit. Écrit une fois, il est juste partout.
 *
 * Le contenu n'est jamais du texte saisi par un visiteur - il vient du
 * catalogue et de l'administration - mais la précaution ne coûte rien, et
 * c'est exactement le genre de porte qu'on laisse ouverte en se disant que la
 * source est de confiance.
 */
export default function DonneesStructurees({ donnees }: { donnees: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(donnees).replace(/</g, '\\u003c'),
      }}
    />
  );
}
