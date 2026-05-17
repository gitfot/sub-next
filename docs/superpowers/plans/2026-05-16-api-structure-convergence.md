# API Structure Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `packages/shared` back into `apps/api`, keep `packages/sub-core` as the only internal package, and remove active `cloudflaresub` naming from the repository.

**Architecture:** API request schemas move into the API modules that consume them, so validation lives next to the routes and services it supports. `sub-core` remains a standalone workspace package for pure subscription domain logic, while workspace/package metadata and runtime naming are simplified around the `sub-next` project identity.

**Tech Stack:** `pnpm` workspace, TypeScript ESM, Fastify, Zod, Vitest, Vite, Prisma

---

## File Structure Map

### New files

- `apps/api/src/modules/auth/auth.schema.test.ts`
- `apps/api/src/modules/auth/auth.schema.ts`
- `apps/api/src/modules/generator/generator.schema.test.ts`
- `apps/api/src/modules/generator/generator.schema.ts`
- `apps/api/src/modules/sources/source.schema.test.ts`
- `apps/api/src/modules/sources/source.schema.ts`
- `apps/api/src/modules/subscriptions/subscription.schema.test.ts`
- `apps/api/src/modules/subscriptions/subscription.schema.ts`

### Modified files

- `package.json`
- `apps/api/package.json`
- `apps/web/package.json`
- `tsconfig.base.json`
- `apps/api/Dockerfile`
- `apps/web/Dockerfile`
- `README.md`
- `apps/web/src/app/auth-store.ts`
- `apps/api/src/modules/auth/auth.routes.ts`
- `apps/api/src/modules/generator/generator.routes.ts`
- `apps/api/src/modules/sources/source.routes.ts`
- `apps/api/src/modules/subscriptions/subscription.routes.ts`
- `apps/api/src/modules/generator/generator.service.ts`
- `apps/api/src/modules/subscriptions/subscription.service.ts`
- `packages/sub-core/package.json`
- `pnpm-lock.yaml`

### Deleted files

- `packages/shared/package.json`
- `packages/shared/tsconfig.json`
- `packages/shared/src/auth.schema.test.ts`
- `packages/shared/src/auth.schema.ts`
- `packages/shared/src/enums.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/source.schema.ts`
- `packages/shared/src/subscription.schema.ts`

---

### Task 1: Seed API-local schema tests

**Files:**
- Create: `apps/api/src/modules/auth/auth.schema.test.ts`
- Create: `apps/api/src/modules/generator/generator.schema.test.ts`
- Create: `apps/api/src/modules/sources/source.schema.test.ts`
- Create: `apps/api/src/modules/subscriptions/subscription.schema.test.ts`
- Test: `apps/api/src/modules/auth/auth.schema.test.ts`
- Test: `apps/api/src/modules/generator/generator.schema.test.ts`
- Test: `apps/api/src/modules/sources/source.schema.test.ts`
- Test: `apps/api/src/modules/subscriptions/subscription.schema.test.ts`

- [ ] **Step 1: Write the failing auth schema test next to the auth module**

```ts
import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth.schema.js';

describe('auth schema', () => {
  it('accepts a valid self-service registration payload', () => {
    const payload = registerSchema.parse({
      email: 'demo@example.com',
      username: 'demo_user',
      password: 'strong-password',
    });

    expect(payload.email).toBe('demo@example.com');
  });

  it('accepts a valid login payload', () => {
    const payload = loginSchema.parse({
      account: 'demo_user',
      password: 'strong-password',
    });

    expect(payload.account).toBe('demo_user');
  });
});
```

- [ ] **Step 2: Write the failing source schema test before the schema file exists**

```ts
import { describe, expect, it } from 'vitest';
import { datasetSchema } from './source.schema.js';

describe('source schema', () => {
  it('accepts a dataset payload with optional description', () => {
    const payload = datasetSchema.parse({
      name: 'My node links',
      description: 'Imported from clipboard',
      content: 'vmess://demo',
    });

    expect(payload.name).toBe('My node links');
  });

  it('rejects an empty content field', () => {
    expect(() =>
      datasetSchema.parse({
        name: 'Broken dataset',
        content: '',
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 3: Write the failing generator and subscription schema tests**

```ts
// apps/api/src/modules/generator/generator.schema.test.ts
import { describe, expect, it } from 'vitest';
import { previewRequestSchema } from './generator.schema.js';

describe('generator schema', () => {
  it('defaults keepOriginalHost to true', () => {
    const payload = previewRequestSchema.parse({
      nodeLinksInput: 'vmess://demo',
      preferredAddressesInput: '104.16.1.2#HK',
    });

    expect(payload.keepOriginalHost).toBe(true);
  });
});

// apps/api/src/modules/subscriptions/subscription.schema.test.ts
import { describe, expect, it } from 'vitest';
import { publishSubscriptionSchema, subscriptionTargets } from './subscription.schema.js';

describe('subscription schema', () => {
  it('accepts a valid publish payload', () => {
    const payload = publishSubscriptionSchema.parse({
      nodeLinksInput: 'vmess://demo',
      preferredAddressesInput: '104.16.1.2#HK',
      keepOriginalHost: true,
      previewNodes: [{ name: 'demo' }],
      remark: 'daily',
      expiresAt: '2026-06-15T00:00:00.000Z',
      subscriptionType: 'clash',
    });

    expect(payload.subscriptionType).toBe('clash');
    expect(subscriptionTargets).toContain('surge');
  });
});
```

- [ ] **Step 4: Run the new module-local schema tests and verify they fail**

Run:

```bash
pnpm --filter @cloudflaresub/api test -- src/modules/auth/auth.schema.test.ts src/modules/sources/source.schema.test.ts src/modules/generator/generator.schema.test.ts src/modules/subscriptions/subscription.schema.test.ts
```

Expected: Vitest fails with module resolution errors because the new schema files do not exist yet.

- [ ] **Step 5: Commit the failing-test checkpoint**

```bash
git add apps/api/src/modules/auth/auth.schema.test.ts apps/api/src/modules/sources/source.schema.test.ts apps/api/src/modules/generator/generator.schema.test.ts apps/api/src/modules/subscriptions/subscription.schema.test.ts
git commit -m "test: add api-local schema coverage plan"
```

---

### Task 2: Move auth and source schemas into `apps/api`

**Files:**
- Create: `apps/api/src/modules/auth/auth.schema.ts`
- Create: `apps/api/src/modules/sources/source.schema.ts`
- Modify: `apps/api/src/modules/auth/auth.routes.ts`
- Modify: `apps/api/src/modules/sources/source.routes.ts`
- Test: `apps/api/src/modules/auth/auth.schema.test.ts`
- Test: `apps/api/src/modules/sources/source.schema.test.ts`

- [ ] **Step 1: Implement the auth schema file beside the auth module**

```ts
// apps/api/src/modules/auth/auth.schema.ts
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  account: z.string().min(3),
  password: z.string().min(8).max(128),
});
```

- [ ] **Step 2: Implement the source schema file beside the source module**

```ts
// apps/api/src/modules/sources/source.schema.ts
import { z } from 'zod';

export const datasetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  content: z.string().min(1),
});
```

- [ ] **Step 3: Update auth and source routes to use local schema imports**

```ts
// apps/api/src/modules/auth/auth.routes.ts
import type { FastifyInstance } from 'fastify';
import { loginSchema, registerSchema } from './auth.schema.js';
import { createUser, loginUser } from './auth.service.js';

// apps/api/src/modules/sources/source.routes.ts
import type { FastifyInstance } from 'fastify';
import { datasetSchema } from './source.schema.js';
import { requireUser } from '../../plugins/require-user.js';
```

- [ ] **Step 4: Run the targeted API tests and confirm they pass**

Run:

```bash
pnpm --filter @cloudflaresub/api test -- src/modules/auth/auth.schema.test.ts src/modules/sources/source.schema.test.ts
```

Expected: Vitest passes both new test files and there are no imports from `@cloudflaresub/shared` left in the auth and source routes.

- [ ] **Step 5: Commit the auth/source schema migration**

```bash
git add apps/api/src/modules/auth/auth.schema.ts apps/api/src/modules/auth/auth.schema.test.ts apps/api/src/modules/auth/auth.routes.ts apps/api/src/modules/sources/source.schema.ts apps/api/src/modules/sources/source.schema.test.ts apps/api/src/modules/sources/source.routes.ts
git commit -m "refactor: colocate auth and source schemas"
```

---

### Task 3: Move generator and subscription schemas into `apps/api`

**Files:**
- Create: `apps/api/src/modules/generator/generator.schema.ts`
- Create: `apps/api/src/modules/subscriptions/subscription.schema.ts`
- Modify: `apps/api/src/modules/generator/generator.routes.ts`
- Modify: `apps/api/src/modules/subscriptions/subscription.routes.ts`
- Modify: `apps/api/src/modules/subscriptions/subscription.service.ts`
- Test: `apps/api/src/modules/generator/generator.schema.test.ts`
- Test: `apps/api/src/modules/subscriptions/subscription.schema.test.ts`

- [ ] **Step 1: Implement the generator-local preview request schema**

```ts
// apps/api/src/modules/generator/generator.schema.ts
import { z } from 'zod';

export const previewRequestSchema = z.object({
  nodeLinkSetId: z.string().uuid().optional(),
  preferredAddressSetId: z.string().uuid().optional(),
  nodeLinksInput: z.string().min(1),
  preferredAddressesInput: z.string().min(1),
  namePrefix: z.string().max(50).optional(),
  keepOriginalHost: z.boolean().default(true),
});
```

- [ ] **Step 2: Implement the subscription-local publish schema and enum**

```ts
// apps/api/src/modules/subscriptions/subscription.schema.ts
import { z } from 'zod';
import { previewRequestSchema } from '../generator/generator.schema.js';

export const subscriptionTargets = ['v2rayn', 'clash', 'shadowrocket', 'surge'] as const;
export type SubscriptionTarget = (typeof subscriptionTargets)[number];

export const publishSubscriptionSchema = previewRequestSchema.extend({
  previewNodes: z.array(z.record(z.string(), z.unknown())).min(1),
  remark: z.string().min(1).max(100),
  expiresAt: z.string().datetime(),
  subscriptionType: z.enum(subscriptionTargets),
});
```

 - [ ] **Step 3: Update route and service consumers to use the new local schemas**

```ts
// apps/api/src/modules/generator/generator.routes.ts
import type { FastifyInstance } from 'fastify';
import { previewRequestSchema } from './generator.schema.js';
import { requireUser } from '../../plugins/require-user.js';
import { previewSubscription } from './generator.service.js';

// apps/api/src/modules/subscriptions/subscription.routes.ts
import type { FastifyInstance } from 'fastify';
import { publishSubscriptionSchema } from './subscription.schema.js';
import type { ParsedNode } from 'sub-core';

// apps/api/src/modules/subscriptions/subscription.service.ts
import crypto from 'node:crypto';
import { renderSubscription, type ParsedNode } from 'sub-core';
import type { SubscriptionTarget } from './subscription.schema.js';
```

- [ ] **Step 4: Run the targeted generator/subscription tests and API module tests**

Run:

```bash
pnpm --filter @cloudflaresub/api test -- src/modules/generator/generator.schema.test.ts src/modules/subscriptions/subscription.schema.test.ts
```

Expected: Vitest passes the generator and subscription schema tests and both routes compile against local schema files.

- [ ] **Step 5: Commit the generator/subscription schema migration**

```bash
git add apps/api/src/modules/generator/generator.schema.ts apps/api/src/modules/generator/generator.schema.test.ts apps/api/src/modules/generator/generator.routes.ts apps/api/src/modules/subscriptions/subscription.schema.ts apps/api/src/modules/subscriptions/subscription.schema.test.ts apps/api/src/modules/subscriptions/subscription.routes.ts apps/api/src/modules/subscriptions/subscription.service.ts
git commit -m "refactor: colocate generator and subscription schemas"
```

---

### Task 4: Rename `sub-core` and rewire API consumers

**Files:**
- Modify: `packages/sub-core/package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/modules/generator/generator.service.ts`
- Modify: `apps/api/src/modules/subscriptions/subscription.service.ts`
- Modify: `apps/api/src/modules/subscriptions/subscription.routes.ts`
- Modify: `tsconfig.base.json`
- Test: `packages/sub-core/tests/sub-core.spec.ts`

- [ ] **Step 1: Rename the remaining internal package and API dependency**

```json
// packages/sub-core/package.json
{
  "name": "sub-core",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  }
}

// apps/api/package.json (dependencies excerpt)
{
  "name": "sub-next-api",
  "dependencies": {
    "sub-core": "workspace:*",
    "@fastify/cors": "^11.2.0",
    "@fastify/rate-limit": "^10.3.0"
  }
}
```

- [ ] **Step 2: Update TypeScript path aliases to remove old scoped names**

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "sub-core": [
        "packages/sub-core/src/index.ts"
      ],
      "sub-core/*": [
        "packages/sub-core/src/*"
      ]
    }
  }
}
```

- [ ] **Step 3: Update all API imports from `@cloudflaresub/sub-core` to `sub-core`**

```ts
// apps/api/src/modules/generator/generator.service.ts
import { expandNodes, parseNodeLinks, parsePreferredAddresses } from 'sub-core';

// apps/api/src/modules/subscriptions/subscription.service.ts
import { renderSubscription, type ParsedNode } from 'sub-core';
import type { SubscriptionTarget } from './subscription.schema.js';

// apps/api/src/modules/subscriptions/subscription.routes.ts
import type { ParsedNode } from 'sub-core';
```

- [ ] **Step 4: Run the package-local and API-local tests after the rename**

Run:

```bash
pnpm --filter sub-core test
pnpm --filter sub-next-api test -- src/modules/generator/generator.schema.test.ts src/modules/subscriptions/subscription.schema.test.ts
```

Expected: `sub-core` tests still pass and the API test run resolves the renamed package without scoped imports.

- [ ] **Step 5: Commit the `sub-core` rename and import rewiring**

```bash
git add packages/sub-core/package.json apps/api/package.json tsconfig.base.json apps/api/src/modules/generator/generator.service.ts apps/api/src/modules/subscriptions/subscription.service.ts apps/api/src/modules/subscriptions/subscription.routes.ts
git commit -m "refactor: rename sub-core package"
```

---

### Task 5: Remove `packages/shared` and clean workspace/package naming

**Files:**
- Modify: `package.json`
- Modify: `apps/web/package.json`
- Modify: `apps/api/Dockerfile`
- Modify: `apps/web/Dockerfile`
- Modify: `README.md`
- Modify: `apps/web/src/app/auth-store.ts`
- Modify: `pnpm-lock.yaml`
- Delete: `packages/shared/package.json`
- Delete: `packages/shared/tsconfig.json`
- Delete: `packages/shared/src/auth.schema.test.ts`
- Delete: `packages/shared/src/auth.schema.ts`
- Delete: `packages/shared/src/enums.ts`
- Delete: `packages/shared/src/index.ts`
- Delete: `packages/shared/src/source.schema.ts`
- Delete: `packages/shared/src/subscription.schema.ts`

- [ ] **Step 1: Rename root and web package metadata and update workspace scripts**

```json
// package.json
{
  "name": "sub-next",
  "scripts": {
    "dev:api": "pnpm --filter sub-next-api dev",
    "dev:web": "pnpm --filter sub-next-web dev",
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint"
  }
}

// apps/web/package.json
{
  "name": "sub-next-web",
  "private": true,
  "type": "module"
}
```

- [ ] **Step 2: Update Docker build filters and frontend runtime naming**

```dockerfile
# apps/api/Dockerfile
RUN pnpm install --frozen-lockfile && pnpm --filter sub-next-api build

# apps/web/Dockerfile
RUN pnpm install --frozen-lockfile && pnpm --filter sub-next-web build
```

```ts
// apps/web/src/app/auth-store.ts
const STORAGE_KEY = 'sub-next-auth';
```

- [ ] **Step 3: Rewrite the active README product name and remove the shared package from workspace reality**

```md
# sub-next

Server-hosted rewrite of the previous CloudflareSub project.

## Workspaces

- `apps/web`: React homepage and data management UI
- `apps/api`: Fastify API
- `packages/sub-core`: subscription core
```

```bash
git rm -r packages/shared
```

- [ ] **Step 4: Refresh the lockfile and verify there are no old scoped package references left**

Run:

```bash
pnpm install
rg -n "cloudflaresub|@cloudflaresub/shared|@cloudflaresub/sub-core" package.json apps packages README.md tsconfig.base.json pnpm-lock.yaml
```

Expected: `pnpm install` updates `pnpm-lock.yaml`, and `rg` returns no active scoped package references outside historical prose that explicitly mentions migration history.

- [ ] **Step 5: Commit the workspace cleanup and package removal**

```bash
git add package.json apps/web/package.json apps/api/Dockerfile apps/web/Dockerfile README.md apps/web/src/app/auth-store.ts pnpm-lock.yaml
git add -u packages/shared
git commit -m "refactor: remove shared workspace package"
```

---

### Task 6: Run full verification and stabilize the repository

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/web/package.json`
- Modify: `package.json`
- Modify: `tsconfig.base.json`
- Modify: `README.md`
- Modify: `pnpm-lock.yaml`
- Test: `apps/api/src/modules/**`
- Test: `packages/sub-core/tests/sub-core.spec.ts`

- [ ] **Step 1: Run API type-checking after all import moves**

Run:

```bash
pnpm --filter sub-next-api lint
```

Expected: TypeScript completes without unresolved imports from deleted `packages/shared` files.

- [ ] **Step 2: Run web and `sub-core` linting to catch naming/config regressions**

Run:

```bash
pnpm --filter sub-next-web lint
pnpm --filter sub-core lint
```

Expected: both commands pass and no workspace package names reference the old scope.

- [ ] **Step 3: Run the full workspace test suite**

Run:

```bash
pnpm test
```

Expected: all Vitest suites pass, including API-local schema tests and `packages/sub-core/tests/sub-core.spec.ts`.

- [ ] **Step 4: Run a final repository-wide old-name sweep**

Run:

```bash
rg -n "cloudflaresub|@cloudflaresub/shared|@cloudflaresub/sub-core" .
```

Expected: no active configuration, import, package metadata, or runtime key still uses the old name. If a historical mention remains in documentation, make it intentional and explicit.

- [ ] **Step 5: Commit the final verified state**

```bash
git add package.json apps/api/package.json apps/web/package.json tsconfig.base.json apps/api/src/modules apps/web/src/app/auth-store.ts apps/api/Dockerfile apps/web/Dockerfile README.md packages/sub-core/package.json pnpm-lock.yaml
git commit -m "重构 API 结构并清理旧项目命名"
```

---

## Self-Review Checklist

### Spec coverage

- Remove `packages/shared`: covered by Task 5
- Move API request schemas next to consuming modules: covered by Tasks 2 and 3
- Keep `sub-core` independent and rename it: covered by Task 4
- Remove active `cloudflaresub` naming from metadata, scripts, docs, and runtime keys: covered by Task 5 and the repository-wide verification in Task 6
- Preserve behavior through lint/test verification: covered by Task 6

### Placeholder scan

- No `TODO`, `TBD`, or deferred “handle later” steps remain
- Each task names exact files and exact commands
- Every code-changing step includes concrete code or command blocks

### Type consistency

- API package is consistently named `sub-next-api`
- web package is consistently named `sub-next-web`
- the remaining shared package is consistently named `sub-core`
- `previewRequestSchema` lives in `generator.schema.ts`
- `publishSubscriptionSchema` and `subscriptionTargets` live in `subscription.schema.ts`
