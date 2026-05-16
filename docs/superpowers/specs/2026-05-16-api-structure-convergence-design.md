# API Structure Convergence Design

Date: 2026-05-16
Repository: `sub-next`
Status: Ready for review

## Summary

This design converges the current workspace structure toward the codebase's real boundaries.

The change keeps `packages/sub-core` as the only independent internal package because it already acts as a stable subscription domain kernel. At the same time, it removes `packages/shared` and merges its schemas back into `apps/api`, where they are currently the only consumer.

This work also cleans up residual `cloudflaresub` naming so the repository reflects the current `sub-next` identity and stops using scoped package names for internal-only modules.

## Goals

- Remove the low-value `packages/shared` workspace package.
- Keep `packages/sub-core` independent and focused on pure subscription domain logic.
- Move API request schemas next to the modules that use them.
- Remove residual `cloudflaresub` naming from package metadata, scripts, imports, docs, and runtime keys where appropriate.
- Reduce workspace and TypeScript configuration overhead without changing product behavior.

## Non-Goals

- Do not merge `packages/sub-core` back into `apps/api`.
- Do not redesign API routes, business behavior, or Prisma models.
- Do not add new shared packages.
- Do not change the frontend's HTTP integration model.
- Do not introduce unrelated refactors beyond what is needed for structure convergence and naming cleanup.

## Current State

The repository is a `pnpm` workspace with:

- `apps/api`
- `apps/web`
- `packages/shared`
- `packages/sub-core`

The real dependency picture is narrower than the workspace structure suggests:

- `apps/web` does not depend on `packages/shared` or `packages/sub-core`
- `apps/api` depends on both
- `packages/shared` contains lightweight Zod schemas and a small enum surface
- `packages/sub-core` contains parser, expansion, rendering, helpers, types, and tests for subscription processing

This means `packages/shared` currently behaves like an API-internal contract layer rather than a genuinely shared workspace package. By contrast, `packages/sub-core` already has the shape of a stable domain package and should remain isolated from API framework concerns.

## Target Architecture

After this change, the repository will keep this high-level shape:

- `apps/api`
- `apps/web`
- `packages/sub-core`

`apps/api` becomes the home for API-facing request schemas. Those schemas will live with the modules they serve instead of being aggregated in a generic shared package.

`packages/sub-core` remains the only internal package boundary. Its responsibility stays narrow:

- parse node links
- parse preferred addresses
- expand nodes
- render subscriptions
- expose related types used by API consumers

It must stay free of Fastify, Prisma, auth, request/response formatting, and environment-specific behavior.

## Directory Design

The intended API layout is:

```text
apps/api/src/modules/auth/
  auth.routes.ts
  auth.service.ts
  auth.schema.ts

apps/api/src/modules/generator/
  generator.routes.ts
  generator.service.ts
  generator.schema.ts

apps/api/src/modules/sources/
  source.routes.ts
  source.repository.ts
  source.schema.ts

apps/api/src/modules/subscriptions/
  subscription.routes.ts
  subscription.service.ts
  subscription.schema.ts
```

Schema placement rules:

- `auth.schema.ts` stays with auth routes and auth service entry points
- `source.schema.ts` stays with source routes because it validates source dataset input
- `generator.schema.ts` owns preview request validation because that schema currently serves generator preview only
- `subscription.schema.ts` owns publish subscription validation because that schema belongs to the subscription creation flow

No replacement `shared/` directory will be introduced under `apps/api`. The design intentionally avoids replacing one abstraction-heavy container with another.

## Naming Strategy

The repository will stop using scoped package names for internal-only application modules.

Target naming rules:

- root package name becomes `sub-next`
- `apps/api` package name becomes `sub-next-api`
- `apps/web` package name becomes `sub-next-web`
- `packages/sub-core` keeps package identity, but its package name becomes `sub-core`
- `packages/shared` is removed entirely

Import rules:

- inside `apps/api`, use relative imports for API-internal modules
- from `apps/api` to `packages/sub-core`, keep importing through the package name `sub-core`
- `apps/web` continues to consume API only over HTTP, not through workspace package imports

Runtime naming cleanup included in scope:

- replace the frontend auth storage key `cloudflaresub-next-auth` with `sub-next-auth`
- replace `cloudflaresub` naming in README and package metadata unless a reference explicitly describes migration history

## Configuration Changes

The structural cleanup requires coordinated configuration updates.

### Workspace and package metadata

- remove `packages/shared/package.json`
- keep `packages/sub-core/package.json`, but rename the package to `sub-core`
- update root `package.json` name and any `pnpm --filter` script references
- update `apps/api/package.json` and `apps/web/package.json` to `sub-next-api` and `sub-next-web`

### TypeScript configuration

- remove `@cloudflaresub/shared` path mappings from the base TypeScript config
- remove `@cloudflaresub/sub-core` path mappings and replace them with the minimum needed support for `sub-core`
- update API imports from package aliases to relative module paths where schemas move into `apps/api`

### Container and build configuration

- update Dockerfiles that filter builds by old scoped package names
- ensure workspace-aware build commands still resolve the API, web app, and `sub-core` correctly

## Detailed Change List

### 1. Merge `packages/shared` into `apps/api`

Move and rehome the following schema surfaces:

- `auth.schema.ts` to `apps/api/src/modules/auth/`
- `source.schema.ts` to `apps/api/src/modules/sources/`
- `subscription.schema.ts` to `apps/api/src/modules/subscriptions/`
- preview request schema to `apps/api/src/modules/generator/generator.schema.ts`

The subscription target enum moves into `apps/api/src/modules/subscriptions/subscription.schema.ts` because it belongs to subscription publishing and is not a repository-wide shared concern.

### 2. Update API imports

Change API route imports so each route or service pulls schemas from local module files rather than from `packages/shared`.

Examples:

- auth routes import from local `auth.schema.ts`
- source routes import from local `source.schema.ts`
- generator routes import from local `generator.schema.ts`
- subscription routes import from local `subscription.schema.ts`

### 3. Remove `packages/shared`

Delete:

- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/src/*`

Also remove all remaining references from workspace configuration and lockfile-backed package relationships as part of normal dependency graph refresh.

### 4. Preserve `packages/sub-core`

Keep the package layout and tests intact.

Allowed changes:

- rename package metadata from old scoped naming to `sub-core`
- update consuming imports accordingly
- update any TypeScript path or workspace configuration required for the new package name

Forbidden changes:

- moving the source into `apps/api`
- adding API-specific dependencies
- mixing HTTP or database concerns into the package

### 5. Clean residual project naming

Replace lingering `cloudflaresub` naming in:

- root `package.json`
- app package metadata
- `sub-core` package metadata
- workspace scripts and filters
- TypeScript path aliases
- Dockerfiles
- README
- frontend auth storage key

The migration origin may still be referenced in prose where historically useful, but it should no longer be the active product name.

## Data Flow Impact

The runtime request flow does not change.

Current and target request flow both remain:

1. `apps/web` sends HTTP requests to `apps/api`
2. `apps/api` validates request payloads with Zod schemas
3. generator and subscription services call `sub-core` for subscription-specific processing
4. API services persist or return results as before

Only the code ownership and import topology change:

- validation logic moves from a workspace package into API module-local files
- domain processing remains in `sub-core`

## Error Handling and Compatibility

No intentional behavior changes are planned for request validation, domain parsing, subscription rendering, or persistence flows.

Compatibility notes:

- changing the frontend auth storage key will invalidate existing browser sessions stored under the old key
- this is acceptable because it is limited to local session persistence and does not change backend auth semantics

Implementation should preserve:

- existing Zod validation rules
- existing route status codes
- existing generator and subscription behavior
- existing public subscription rendering behavior

## Testing and Verification

Required verification after implementation:

- `pnpm lint`
- `pnpm test`

Targeted checks:

- no remaining runtime or compile-time imports from `@cloudflaresub/shared`
- API still compiles after schema files move to module-local locations
- API still resolves `sub-core` correctly after package rename
- README, package metadata, scripts, and Dockerfiles no longer use the old project name as the active name

Behavior checks that matter most:

- auth routes still validate login and registration payloads correctly
- source routes still validate dataset payloads correctly
- generator preview still validates and processes preview requests correctly
- subscription publishing still validates payloads and renders public URLs correctly

## Risks

### Workspace resolution risk

Renaming packages and removing one workspace package can break `pnpm` filters, dependency resolution, or build commands if metadata and scripts are not updated together.

Mitigation:

- update names, filters, and dependencies in the same change
- verify with workspace-wide lint and test commands

### TypeScript import risk

Moving schemas into API modules introduces relative import changes that can break builds or create awkward dependency direction.

Mitigation:

- place schema files adjacent to their consuming modules
- avoid adding a new API-wide schema barrel
- keep import paths short and local

### Silent behavior drift risk

Mechanical file moves can accidentally change schema exports or enum ownership.

Mitigation:

- preserve schema definitions exactly unless a move requires local file splitting
- verify the API behavior through existing tests and type checks

## Implementation Boundaries

This design is intentionally scoped for a single implementation plan.

Included:

- remove `packages/shared`
- relocate API schemas into module-local files
- rename active project/package identifiers away from `cloudflaresub`
- keep and rename `sub-core` as the only remaining internal package

Excluded:

- further decomposition of `sub-core`
- frontend contract sharing
- route redesign
- database refactors
- new packaging strategy beyond this convergence step

## Recommendation

Implement the "module-local schema convergence" approach:

- merge `packages/shared` into `apps/api`
- keep `packages/sub-core` independent as `sub-core`
- replace old scoped package naming with simple local naming
- clean up residual old product names during the same pass

This gives the repository a structure that matches its real usage today while preserving the one package boundary that already represents a genuine domain seam.
