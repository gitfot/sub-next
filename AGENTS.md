# Repository Guidelines

## Project Structure & Module Organization
This repository is a `pnpm` workspace with two apps and one shared package. `apps/web` contains the React + Vite frontend, with route screens in `src/routes`, app wiring in `src/app`, and UI tests in `src/routes/__tests__`. `apps/api` contains the Fastify server, with feature modules under `src/modules/*`, shared helpers in `src/lib`, and integration tests in `tests/`. Shared subscription parsing and rendering logic lives in `packages/sub-core/src`, with package tests in `packages/sub-core/tests`. Prisma schema files are in `prisma/`, and local infrastructure lives in `deploy/docker-compose.yml`.

## Build, Test, and Development Commands
Install dependencies with `pnpm install`. Start the backend with `pnpm dev:api` and the frontend with `pnpm dev:web`. Build the whole workspace with `pnpm build`, run all tests with `pnpm test`, and run type/lint checks with `pnpm lint`. Database helpers are root-level commands: `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:push`. For local services, run `docker compose -f deploy/docker-compose.yml up`.

## Coding Style & Naming Conventions
Use TypeScript ESM and follow the existing 2-space indentation. Prefer small, focused modules and named exports such as `buildApp`. Keep file names in kebab-case and preserve established suffixes like `*.routes.ts`, `*.service.ts`, `*.repository.ts`, and `*.test.ts`. React components should use PascalCase function names; hooks and helpers should stay camelCase. `pnpm lint` runs workspace checks, so keep imports clean and types explicit.

## Testing Guidelines
Vitest is used across the workspace. API integration tests live in `apps/api/tests` and use `supertest`; frontend tests use Testing Library under `apps/web/src/routes/__tests__`; shared package tests live in `packages/sub-core/tests`. Name tests after behavior, for example `auth.integration.test.ts` or `source.schema.test.ts`. Add or update tests whenever routes, schemas, or subscription parsing logic change, and run `pnpm test` before opening a PR.

## Commit & Pull Request Guidelines
Recent commits mix concise imperative Chinese subjects with scoped English `refactor:` and `test:` prefixes. Keep commit titles short, action-oriented, and limited to one change. PRs should include a brief summary, affected workspace paths, any setup or Prisma notes, and the verification you ran such as `pnpm test` or the README manual flow. Include screenshots for UI changes.

## Security & Configuration Tips
Copy `.env.example` to `.env` before local work and never commit secrets. Treat `DATABASE_URL`, `API_BASE_URL`, `PUBLIC_BASE_URL`, and JWT-related values as environment-specific. Review Prisma schema changes carefully before running migrations against shared databases.
