# IB Signature - image de production.
# better-sqlite3 est un module natif : il se compile à l'installation, ce qui
# demande python3/make/g++. On les installe pour construire, et on ne les
# emporte pas dans l'image finale.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Playwright ne sert qu'à la vérification automatique, qui tourne sur une
# machine de développement et jamais ici. Son installation télécharge pourtant
# trois navigateurs - environ cent cinquante mégaoctets - dans une image qui
# n'ouvrira jamais de page. C'est long, c'est lourd, et cela échoue dès que le
# réseau de construction est restreint : la construction s'arrête alors sur un
# téléchargement qui n'avait aucune raison d'exister.
#
# On ne peut pas se contenter de `--omit=dev` : TypeScript est lui aussi une
# dépendance de développement, et `next build` en a besoin.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM base AS run
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
EXPOSE 3100
USER node
CMD ["npx", "next", "start", "-p", "3100"]
