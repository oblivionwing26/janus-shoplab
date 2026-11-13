# syntax=docker/dockerfile:1
# ShopLab image. Targets: `tools` (migrations + seed) and `runner` (the app).

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM deps AS tools
COPY . .
CMD ["sh", "-c", "pnpm db:migrate && pnpm db:seed"]

FROM deps AS build
COPY . .
RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3100 HOSTNAME=0.0.0.0
RUN addgroup -S shoplab && adduser -S shoplab -G shoplab
COPY --from=build --chown=shoplab:shoplab /app/.next/standalone ./
COPY --from=build --chown=shoplab:shoplab /app/.next/static ./.next/static
# Where Janus puts the ownership token it proves control with (see src/app/.well-known).
RUN mkdir /app/.well-known && chown shoplab:shoplab /app/.well-known
USER shoplab
EXPOSE 3100
HEALTHCHECK --interval=10s --timeout=3s --retries=6 \
  CMD wget -qO- http://127.0.0.1:3100/api/health || exit 1
CMD ["node", "server.js"]
