import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  outputFileTracingRoot: root,

  /**
   * Les adresses sans préfixe de langue.
   *
   * Toutes les pages vivent sous /fr ou /en. Une adresse écrite à la main, ou
   * recopiée dans un courriel, ou pointée par une redirection venue d'un autre
   * site, arrive souvent sans ce préfixe : ibsignature.com/qui-sommes-nous
   * renverrait alors une page introuvable. On les rattrape ici plutôt que de
   * compter sur le visiteur pour deviner.
   *
   * Redirections permanentes : ces chemins ne changeront plus, et un 308 évite
   * qu'un moteur indexe deux adresses pour une seule page.
   */
  async redirects() {
    const pages = ['logements', 'qui-sommes-nous', 'proprietaires', 'contact', 'mentions', 'confidentialite'];
    return pages.flatMap((page) => [
      { source: `/${page}`, destination: `/fr/${page}`, permanent: true },
      { source: `/${page}/:reste*`, destination: `/fr/${page}/:reste*`, permanent: true },
    ]);
  },

  /**
   * Les métadonnées écrites dans l'en-tête, et non diffusées en fin de page.
   *
   * Depuis Next 15.2, le titre, la description et surtout la balise canonique
   * ne sont plus écrits dans le `<head>` : ils sont envoyés à la fin du corps,
   * pour ne pas retarder l'affichage. Un navigateur les remonte sans peine, et
   * Google, qui exécute le JavaScript, finit par les voir.
   *
   * Mais « finit par » ne suffit pas. Le premier passage de Google ne lit que
   * le HTML brut, et c'est souvent à ce moment-là qu'il décide quelle page est
   * l'originale et laquelle est un doublon. C'est ce qui explique le rapport de
   * Search Console : « URL canonique déclarée par l'utilisateur : Aucun »,
   * alors que la balise est bien là quand on inspecte la page. Elle n'est pas
   * absente, elle arrive trop tard.
   *
   * `/.*​/` désigne tous les robots : plus personne ne reçoit les métadonnées en
   * différé. Le coût est de quelques millisecondes sur le premier octet,
   * puisqu'il faut résoudre `generateMetadata` avant d'envoyer la page. C'est
   * sans commune mesure avec une page écartée de l'index.
   *
   * Staytle porte le même réglage depuis le 15 septembre, pour le même motif.
   */
  htmlLimitedBots: /.*/,

  /* Le tampon que l'intergiciel impose au corps des requêtes.
     Par défaut dix mégaoctets, et au-delà le corps est tronqué en silence -
     la route reçoit un formulaire amputé et échoue sans que rien n'explique
     pourquoi. Un envoi de photographies dépasse ce plafond dès la deuxième
     image. La route de dépôt est déjà écartée de l'intergiciel, ce qui suffit ;
     ceci est la seconde barrière, pour le jour où une autre route recevra un
     fichier et où personne ne se souviendra de cette histoire. */
  experimental: { middlewareClientMaxBodySize: '64mb' },

  serverExternalPackages: ['better-sqlite3'],
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    config.resolve.alias['@'] = path.join(root, 'src');
    return config;
  },
  turbopack: { resolveAlias: { '@/*': './src/*' } },
};
