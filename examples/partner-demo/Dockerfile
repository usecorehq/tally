# syntax=docker/dockerfile:1.7
# Demo Shop partner example. Build from the repo root:
#   docker build -f examples/partner-demo/Dockerfile -t tally-partner-demo .
# All config comes from runtime env vars (see .env.example).

# ─── build ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @tally/partner-demo...
RUN pnpm --filter @qorelly/tally-embed build \
 && pnpm --filter @tally/partner-demo build

# ─── runtime ──────────────────────────────────────────────────────────
# The server is bundled into one file, so no node_modules ship.
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=4200
RUN apt-get update && apt-get install -y --no-install-recommends curl tini ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /repo/examples/partner-demo/dist ./dist
USER node
EXPOSE 4200
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/" || exit 1
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.mjs"]
