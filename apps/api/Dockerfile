FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile && pnpm --filter sub-next-api build

CMD ["pnpm", "dev:api"]
