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
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM base AS run
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
EXPOSE 3100
USER node
CMD ["npx", "next", "start", "-p", "3100"]
