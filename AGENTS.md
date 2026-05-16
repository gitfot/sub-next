# Repository Guidelines

## Project Structure & Module Organization
This repo is a `pnpm` workspace with two apps and one shared package. `apps/web` contains the React + Vite UI, with route screens under `src/routes`, shared app wiring under `src/app`, and browser tests in `src/routes/__tests__`. `apps/api` contains the Fastify server, with feature modules under `src/modules/*` and integration tests in `tests/`. API request schemas live beside the consuming modules in `apps/api/src/modules/*`, and subscription parsing/rendering logic lives in `packages/sub-core/src`. Prisma schema and database setup are in `prisma/schema.prisma`; local container orchestration is in `deploy/docker-compose.yml`.

## Build, Test, and Development Commands
Install dependencies with `pnpm install`. Start the apps separately with `pnpm dev:api` and `pnpm dev:web`. Run all workspace builds with `pnpm build`, all tests with `pnpm test`, and type-checking/lint gates with `pnpm lint`. Prisma helpers are root-level: `pnpm db:generate`, `pnpm db:migrate`, and `pnpm db:push`. For local infrastructure, use `docker compose -f deploy/docker-compose.yml up`.

## Coding Style & Naming Conventions
Use TypeScript ESM and follow the existing 2-space indentation style. Prefer small, focused modules and named exports such as `buildApp`. Keep file names in kebab-case, and preserve the established suffixes: `*.routes.ts`, `*.service.ts`, `*.repository.ts`, and `*.test.ts`. React components use PascalCase function names, while hooks/state helpers stay camelCase. `pnpm lint` currently runs TypeScript `--noEmit`, so keep types strict and imports clean.

## Testing Guidelines
Vitest is used across the workspace. API integration tests live in `apps/api/tests` and use `supertest`; web tests use Testing Library; package-level unit tests sit beside source files or under `packages/sub-core/tests`. Name tests after behavior, for example `auth.integration.test.ts` or `auth.schema.test.ts`. Run `pnpm test` before opening a PR, and add or update tests for every route, schema, or parser change.

## Commit & Pull Request Guidelines
Recent commits use short, imperative subjects, often in Chinese, such as `实现认证与会话基础能力` or `补齐部署与验证说明`. Keep commit titles concise, action-oriented, and scoped to one change. PRs should include a brief summary, impacted workspace paths, setup or migration notes, and the verification you ran (`pnpm test`, manual flow checks from `README.md`). Include screenshots for UI changes and mention any `.env` or Prisma updates explicitly.

## Security & Configuration Tips
Copy `.env.example` to `.env` for local work and never commit secrets. Replace JWT placeholders with long random values, and treat `PUBLIC_BASE_URL`, `API_BASE_URL`, and `DATABASE_URL` as environment-specific settings. Review schema changes carefully before running Prisma migrations against shared databases.
