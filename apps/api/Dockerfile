# syntax=docker/dockerfile:1.7
# Tally API. Build from the repo root:
#   docker build -f apps/api/Dockerfile -t tally-api .
# All config comes from runtime env vars (no .env in the image). Migrations are not run here: apply them with
# `pnpm db:migrate` (staging) — production is applied by the CTO.

# ─── build ────────────────────────────────────────────────────────────
# Debian slim, not Alpine: sharp (shelf-scan crops) resolves its glibc libvips binary here.
FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @tally/api...
RUN pnpm --filter @tally/db build \
 && pnpm --filter @tally/catalog-client build \
 && pnpm --filter @tally/api build \
 && pnpm --filter @tally/api deploy --legacy --prod /out

# ─── runtime ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=4100
# curl for the health probe; tini forwards SIGTERM so Nest shuts down cleanly.
RUN apt-get update && apt-get install -y --no-install-recommends curl tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./dist
USER node
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/api/health" || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
