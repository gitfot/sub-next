# sub-next

Server-hosted rewrite of the previous CloudflareSub project.

## Workspaces

- `apps/web`: React homepage and data management UI
- `apps/api`: Fastify API
- `packages/sub-core`: subscription core

## First bootstrap

```bash
pnpm install
```

## Environment

Copy `.env.example` to `.env` and adjust values for your environment:

```bash
cp .env.example .env
```

## Development

```bash
pnpm dev:api
pnpm dev:web
```

When the API starts outside the test runtime, it checks whether the required Prisma tables exist.
If any are missing, it automatically runs `prisma db push` before listening on the port.

## Verification checklist

- register a user
- create one node-link dataset
- create one preferred-address dataset
- generate preview nodes from the homepage
- publish one Clash subscription
- open the public URL without login
- restore the subscription back to the homepage
