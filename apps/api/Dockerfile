FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma prisma
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/sub-core/package.json packages/sub-core/package.json

RUN pnpm install --frozen-lockfile

FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm --filter sub-core build && pnpm --filter sub-next-api build && pnpm --filter sub-next-web build

FROM node:22-alpine AS runtime

RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

ENV NODE_ENV=production

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/packages/sub-core/package.json ./packages/sub-core/package.json
COPY --from=build /app/packages/sub-core/dist ./packages/sub-core/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist

EXPOSE 4000

CMD ["node", "apps/api/dist/src/server.js"]
