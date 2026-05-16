# CloudflareSub Next

Second-generation server-hosted rewrite of CloudflareSub.

## Workspaces

- `apps/web`: React homepage and data management UI
- `apps/api`: Fastify API
- `packages/sub-core`: migrated subscription core
- `packages/shared`: shared schemas and types

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

## Verification checklist

- register a user
- create one node-link dataset
- create one preferred-address dataset
- generate preview nodes from the homepage
- publish one Clash subscription
- open the public URL without login
- restore the subscription back to the homepage
