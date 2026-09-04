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

  serverExternalPackages: ['better-sqlite3'],
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    config.resolve.alias['@'] = path.join(root, 'src');
    return config;
  },
  turbopack: { resolveAlias: { '@/*': './src/*' } },
};
