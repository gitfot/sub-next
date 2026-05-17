# Data Management Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current migrated app meet the copied server-rewrite spec for data management, auth-expiry handling, and homepage draft continuity without reopening the broader architecture rewrite.

**Architecture:** Complete the missing API contract first so dataset CRUD and subscription management expose the behavior promised by the copied spec. Then add a small authenticated web API layer plus a local draft store so the React pages can handle `401` expiry and cross-page state consistently. Keep the existing Fastify/React structure, add the smallest new modules needed, and prefer flattening DTOs over introducing new framework layers.

**Tech Stack:** Fastify, Zod, Prisma-compatible repository helpers, React 19, React Router, localStorage-backed state, Vitest, Testing Library, Supertest

---

## File Structure

- `docs/superpowers/specs/2026-05-15-server-rewrite-design.md`
  Responsibility: copied source-of-truth spec for required data-management behaviors and acceptance criteria.
- `apps/api/tests/sources.integration.test.ts`
  Responsibility: dataset CRUD and user-isolation integration coverage.
- `apps/api/tests/subscriptions.integration.test.ts`
  Responsibility: subscription list/detail/delete/restore/public-link integration coverage.
- `apps/api/src/lib/db.ts`
  Responsibility: in-memory Prisma-compatible behavior used by tests; must support dataset updates and subscription status reads.
- `apps/api/src/modules/sources/source.repository.ts`
  Responsibility: dataset repository helpers for list/create/update/delete.
- `apps/api/src/modules/sources/source.routes.ts`
  Responsibility: authenticated HTTP contract for node-link and preferred-address datasets.
- `apps/api/src/modules/subscriptions/subscription.service.ts`
  Responsibility: list/detail DTO mapping, status/public URL derivation, restore payload normalization.
- `apps/api/src/modules/subscriptions/subscription.routes.ts`
  Responsibility: authenticated HTTP endpoints for subscription management and restore flow.
- `apps/web/src/app/api-client.ts`
  Responsibility: shared fetch wrapper that injects auth headers, normalizes JSON handling, and reacts to `401`.
- `apps/web/src/app/auth-store.ts`
  Responsibility: session persistence plus auth-expiry event dispatch/listening helpers.
- `apps/web/src/app/home-draft.ts`
  Responsibility: homepage draft persistence, restore merge rules, and reset helpers.
- `apps/web/src/features/home/api.ts`
  Responsibility: homepage preview/publish calls routed through the shared API client.
- `apps/web/src/features/data-management/api.ts`
  Responsibility: typed CRUD helpers for datasets and subscriptions.
- `apps/web/src/routes/__tests__/auth-shell.test.tsx`
  Responsibility: route protection and `401` forced-login regression coverage.
- `apps/web/src/routes/__tests__/data-management.test.tsx`
  Responsibility: node-link/preferred-address CRUD plus subscription details/copy/delete/restore UI coverage.
- `apps/web/src/routes/__tests__/home-page.test.tsx`
  Responsibility: homepage selectors, draft persistence, and restore/regenerate behavior.
- `apps/web/src/routes/node-link-page.tsx`
  Responsibility: node-link dataset CRUD screen.
- `apps/web/src/routes/preferred-address-page.tsx`
  Responsibility: preferred-address dataset CRUD screen.
- `apps/web/src/routes/subscription-management-page.tsx`
  Responsibility: subscription list, details, copy, delete, and restore actions.
- `apps/web/src/routes/home-page.tsx`
  Responsibility: homepage source selectors, editable inputs, preview state, publish flow, and draft persistence.
- `apps/web/src/routes/app-shell.tsx`
  Responsibility: authenticated shell that responds to session-expiry events and sends the user back to `/login`.

### Task 1: Finish The Dataset API Contract

**Files:**
- Modify: `apps/api/tests/sources.integration.test.ts`
- Modify: `apps/api/src/lib/db.ts`
- Modify: `apps/api/src/modules/sources/source.repository.ts`
- Modify: `apps/api/src/modules/sources/source.routes.ts`

- [ ] **Step 1: Write the failing dataset CRUD integration test**

```ts
// apps/api/tests/sources.integration.test.ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

async function createTwoUsers(server: Parameters<typeof request>[0]) {
  const regA = await request(server)
    .post('/auth/register')
    .send({ email: 'userA@example.com', password: 'password-a-long' });
  const regB = await request(server)
    .post('/auth/register')
    .send({ email: 'userB@example.com', password: 'password-b-long' });
  return {
    tokenA: regA.body.tokens.accessToken as string,
    tokenB: regB.body.tokens.accessToken as string,
  };
}

describe('source datasets', () => {
  it('isolates datasets by authenticated user', async () => {
    const app = buildApp();
    await app.ready();

    const { tokenA, tokenB } = await createTwoUsers(app.server);

    const createResponse = await request(app.server)
      .post('/sources/node-links')
      .set('authorization', `Bearer ${tokenA}`)
      .send({
        name: '机场A',
        content: 'vmess://demo',
      });

    expect(createResponse.status).toBe(201);

    const listA = await request(app.server)
      .get('/sources/node-links')
      .set('authorization', `Bearer ${tokenA}`);
    const listB = await request(app.server)
      .get('/sources/node-links')
      .set('authorization', `Bearer ${tokenB}`);

    expect(listA.body.items).toHaveLength(1);
    expect(listB.body.items).toHaveLength(0);
  });

  it('updates and soft-deletes datasets for the owning user only', async () => {
    const app = buildApp();
    await app.ready();

    const { tokenA, tokenB } = await createTwoUsers(app.server);

    const nodeLinkCreate = await request(app.server)
      .post('/sources/node-links')
      .set('authorization', `Bearer ${tokenA}`)
      .send({
        name: '旧节点集',
        description: '待更新',
        content: 'vmess://before',
      });

    const preferredCreate = await request(app.server)
      .post('/sources/preferred-addresses')
      .set('authorization', `Bearer ${tokenA}`)
      .send({
        name: '旧优选',
        content: '104.16.1.2#HK',
      });

    const patchForbidden = await request(app.server)
      .patch(`/sources/node-links/${nodeLinkCreate.body.id}`)
      .set('authorization', `Bearer ${tokenB}`)
      .send({
        name: '越权更新',
        content: 'vmess://forbidden',
      });

    expect(patchForbidden.status).toBe(404);

    const patchNodeLinks = await request(app.server)
      .patch(`/sources/node-links/${nodeLinkCreate.body.id}`)
      .set('authorization', `Bearer ${tokenA}`)
      .send({
        name: '新节点集',
        description: '已更新',
        content: 'vmess://after',
      });

    expect(patchNodeLinks.status).toBe(200);
    expect(patchNodeLinks.body.name).toBe('新节点集');
    expect(patchNodeLinks.body.content).toBe('vmess://after');

    const patchPreferred = await request(app.server)
      .patch(`/sources/preferred-addresses/${preferredCreate.body.id}`)
      .set('authorization', `Bearer ${tokenA}`)
      .send({
        name: '新优选',
        description: 'Cloudflare',
        content: '104.17.2.3:2053#US',
      });

    expect(patchPreferred.status).toBe(200);
    expect(patchPreferred.body.name).toBe('新优选');

    const deleteResponse = await request(app.server)
      .delete(`/sources/node-links/${nodeLinkCreate.body.id}`)
      .set('authorization', `Bearer ${tokenA}`);

    expect(deleteResponse.status).toBe(204);

    const listAfterDelete = await request(app.server)
      .get('/sources/node-links')
      .set('authorization', `Bearer ${tokenA}`);

    expect(listAfterDelete.body.items).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the dataset integration test and verify it fails**

Run: `pnpm --filter sub-next-api test -- tests/sources.integration.test.ts`
Expected: FAIL because `PATCH /sources/node-links/:id` and `PATCH /sources/preferred-addresses/:id` do not exist yet.

- [ ] **Step 3: Add repository, memory-db, and route support for dataset updates**

```ts
// apps/api/src/modules/sources/source.repository.ts
import { db } from '../../lib/db.js';

export function listNodeLinkSets(userId: string) {
  return db.nodeLinkSet.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
  });
}

export function createNodeLinkSet(userId: string, input: { name: string; description?: string | undefined; content: string }) {
  return db.nodeLinkSet.create({
    data: { userId, name: input.name, content: input.content, ...(input.description ? { description: input.description } : {}) },
  });
}

export async function updateNodeLinkSet(
  userId: string,
  id: string,
  input: { name: string; description?: string | undefined; content: string },
) {
  const result = await db.nodeLinkSet.updateMany({
    where: { id, userId, deletedAt: null },
    data: {
      name: input.name,
      description: input.description ?? null,
      content: input.content,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return db.nodeLinkSet.findUnique({ where: { id } });
}

export function softDeleteNodeLinkSet(userId: string, id: string) {
  return db.nodeLinkSet.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

export function listPreferredAddressSets(userId: string) {
  return db.preferredAddressSet.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
  });
}

export function createPreferredAddressSet(userId: string, input: { name: string; description?: string | undefined; content: string }) {
  return db.preferredAddressSet.create({
    data: { userId, name: input.name, content: input.content, ...(input.description ? { description: input.description } : {}) },
  });
}

export async function updatePreferredAddressSet(
  userId: string,
  id: string,
  input: { name: string; description?: string | undefined; content: string },
) {
  const result = await db.preferredAddressSet.updateMany({
    where: { id, userId, deletedAt: null },
    data: {
      name: input.name,
      description: input.description ?? null,
      content: input.content,
    },
  });

  if (result.count === 0) {
    return null;
  }

  return db.preferredAddressSet.findUnique({ where: { id } });
}

export function softDeletePreferredAddressSet(userId: string, id: string) {
  return db.preferredAddressSet.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}
```

```ts
// apps/api/src/modules/sources/source.routes.ts
import type { FastifyInstance } from 'fastify';
import { datasetSchema } from './source.schema.js';
import { requireUser } from '../../plugins/require-user.js';
import {
  createNodeLinkSet,
  createPreferredAddressSet,
  listNodeLinkSets,
  listPreferredAddressSets,
  softDeleteNodeLinkSet,
  softDeletePreferredAddressSet,
  updateNodeLinkSet,
  updatePreferredAddressSet,
} from './source.repository.js';

export async function sourceRoutes(app: FastifyInstance) {
  app.get('/node-links', { preHandler: requireUser }, async (request) => {
    return { items: await listNodeLinkSets(request.user.id) };
  });

  app.post('/node-links', { preHandler: requireUser }, async (request, reply) => {
    const input = datasetSchema.parse(request.body);
    const item = await createNodeLinkSet(request.user.id, input);
    return reply.status(201).send(item);
  });

  app.patch('/node-links/:id', { preHandler: requireUser }, async (request, reply) => {
    const input = datasetSchema.parse(request.body);
    const item = await updateNodeLinkSet(request.user.id, (request.params as { id: string }).id, input);
    if (!item) {
      return reply.status(404).send({ message: 'Dataset not found' });
    }
    return item;
  });

  app.delete('/node-links/:id', { preHandler: requireUser }, async (request, reply) => {
    const result = await softDeleteNodeLinkSet(request.user.id, (request.params as { id: string }).id);
    if (result.count === 0) {
      return reply.status(404).send({ message: 'Dataset not found' });
    }
    return reply.status(204).send();
  });

  app.get('/preferred-addresses', { preHandler: requireUser }, async (request) => {
    return { items: await listPreferredAddressSets(request.user.id) };
  });

  app.post('/preferred-addresses', { preHandler: requireUser }, async (request, reply) => {
    const input = datasetSchema.parse(request.body);
    const item = await createPreferredAddressSet(request.user.id, input);
    return reply.status(201).send(item);
  });

  app.patch('/preferred-addresses/:id', { preHandler: requireUser }, async (request, reply) => {
    const input = datasetSchema.parse(request.body);
    const item = await updatePreferredAddressSet(request.user.id, (request.params as { id: string }).id, input);
    if (!item) {
      return reply.status(404).send({ message: 'Dataset not found' });
    }
    return item;
  });

  app.delete('/preferred-addresses/:id', { preHandler: requireUser }, async (request, reply) => {
    const result = await softDeletePreferredAddressSet(request.user.id, (request.params as { id: string }).id);
    if (result.count === 0) {
      return reply.status(404).send({ message: 'Dataset not found' });
    }
    return reply.status(204).send();
  });
}
```

```ts
// apps/api/src/lib/db.ts
function createOwnedCollection<T extends BaseOwnedRecord & { name: string; description: string | null; content: string }>(store: Map<string, T>) {
  return {
    findMany: async ({ where, orderBy }: { where: { userId: string; deletedAt: null }; orderBy: { updatedAt: SortOrder } }) =>
      sortByUpdatedAt(
        [...store.values()].filter((item) => item.userId === where.userId && item.deletedAt === null),
        orderBy.updatedAt,
      ),
    findUnique: async ({ where }: { where: { id: string } }) => store.get(where.id) ?? null,
    create: async ({
      data,
    }: {
      data: { userId: string; name: string; description?: string; content: string };
    }) => {
      const now = new Date();
      const record = {
        id: crypto.randomUUID(),
        userId: data.userId,
        name: data.name,
        description: data.description ?? null,
        content: data.content,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      } as T;
      store.set(record.id, record);
      return record;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { id: string; userId: string; deletedAt: null };
      data: Partial<Pick<T, 'name' | 'description' | 'content' | 'deletedAt'>>;
    }) => {
      const item = store.get(where.id);
      if (!item || item.userId !== where.userId || item.deletedAt !== where.deletedAt) {
        return { count: 0 };
      }
      Object.assign(item, data);
      item.updatedAt = new Date();
      return { count: 1 };
    },
  };
}
```

- [ ] **Step 4: Re-run the dataset integration test and verify it passes**

Run: `pnpm --filter sub-next-api test -- tests/sources.integration.test.ts`
Expected: PASS with both user isolation and dataset update/delete behavior covered.

- [ ] **Step 5: Commit the dataset API contract**

```bash
git add apps/api/tests/sources.integration.test.ts apps/api/src/lib/db.ts apps/api/src/modules/sources/source.repository.ts apps/api/src/modules/sources/source.routes.ts
git commit -m "feat: complete dataset api contract"
```

### Task 2: Normalize Subscription Management DTOs And Restore Semantics

**Files:**
- Modify: `apps/api/tests/subscriptions.integration.test.ts`
- Modify: `apps/api/src/modules/subscriptions/subscription.service.ts`
- Modify: `apps/api/src/modules/subscriptions/subscription.routes.ts`

- [ ] **Step 1: Write the failing subscription management integration test**

```ts
// apps/api/tests/subscriptions.integration.test.ts
import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

const SAMPLE_VMESS =
  'vmess://ewogICJ2IjogIjIiLAogICJwcyI6ICJkZW1vLXdzLXRscyIsCiAgImFkZCI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAicG9ydCI6ICI0NDMiLAogICJpZCI6ICIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLAogICJzY3kiOiAiYXV0byIsCiAgIm5ldCI6ICJ3cyIsCiAgInRscyI6ICJ0bHMiLAogICJwYXRoIjogIi93cyIsCiAgImhvc3QiOiAiZWRnZS5leGFtcGxlLmNvbSIsCiAgInNuaSI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAiZnAiOiAiY2hyb21lIiwKICAiYWxwbiI6ICJoMixodHRwLzEuMSIKfQ==';

async function createUserAndLogin(server: Parameters<typeof request>[0]) {
  const email = `subuser-${crypto.randomUUID()}@example.com`;
  const reg = await request(server)
    .post('/auth/register')
    .send({ email, password: 'strong-password' });
  return { accessToken: reg.body.tokens.accessToken as string };
}

describe('preview and subscriptions', () => {
  it('returns list and detail dto fields for subscription management', async () => {
    const app = buildApp();
    await app.ready();
    const { accessToken } = await createUserAndLogin(app.server);

    const previewResponse = await request(app.server)
      .post('/generator/preview')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        nodeLinksInput: SAMPLE_VMESS,
        preferredAddressesInput: '104.16.1.2#HK',
        namePrefix: 'CF',
        keepOriginalHost: true,
      });

    const publishResponse = await request(app.server)
      .post('/subscriptions')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        nodeLinksInput: SAMPLE_VMESS,
        preferredAddressesInput: '104.16.1.2#HK',
        namePrefix: 'CF',
        keepOriginalHost: true,
        previewNodes: previewResponse.body.nodes,
        remark: '测试订阅',
        expiresAt: '2030-01-01T00:00:00.000Z',
        subscriptionType: 'clash',
      });

    const listResponse = await request(app.server)
      .get('/subscriptions')
      .set('authorization', `Bearer ${accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items[0]).toMatchObject({
      id: publishResponse.body.subscription.id,
      remark: '测试订阅',
      subscriptionType: 'clash',
      status: 'active',
    });
    expect(listResponse.body.items[0].publicUrl).toContain('/subscriptions/public/');

    const detailResponse = await request(app.server)
      .get(`/subscriptions/${publishResponse.body.subscription.id}`)
      .set('authorization', `Bearer ${accessToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.subscription.publicUrl).toContain('/subscriptions/public/');
    expect(detailResponse.body.snapshot.nodeLinksInput).toContain('vmess://');
    expect(detailResponse.body.snapshot.previewNodes).toHaveLength(1);
  });

  it('restores raw inputs but requires regenerate before republish', async () => {
    const app = buildApp();
    await app.ready();
    const { accessToken } = await createUserAndLogin(app.server);

    const previewResponse = await request(app.server)
      .post('/generator/preview')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        nodeLinksInput: SAMPLE_VMESS,
        preferredAddressesInput: '104.16.1.2#HK',
        keepOriginalHost: true,
      });

    const publishResponse = await request(app.server)
      .post('/subscriptions')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        nodeLinksInput: SAMPLE_VMESS,
        preferredAddressesInput: '104.16.1.2#HK',
        keepOriginalHost: true,
        previewNodes: previewResponse.body.nodes,
        remark: '恢复测试',
        expiresAt: '2030-01-01T00:00:00.000Z',
        subscriptionType: 'clash',
      });

    const restoreResponse = await request(app.server)
      .post(`/subscriptions/${publishResponse.body.subscription.id}/restore`)
      .set('authorization', `Bearer ${accessToken}`);

    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body.nodeLinksInput).toContain('vmess://');
    expect(restoreResponse.body.previewNodes).toBeUndefined();
    expect(restoreResponse.body.requiresRegenerate).toBe(true);
  });

  it('soft-deletes subscriptions from the management list', async () => {
    const app = buildApp();
    await app.ready();
    const { accessToken } = await createUserAndLogin(app.server);

    const previewResponse = await request(app.server)
      .post('/generator/preview')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        nodeLinksInput: SAMPLE_VMESS,
        preferredAddressesInput: '104.16.1.2#HK',
        keepOriginalHost: true,
      });

    const publishResponse = await request(app.server)
      .post('/subscriptions')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        nodeLinksInput: SAMPLE_VMESS,
        preferredAddressesInput: '104.16.1.2#HK',
        keepOriginalHost: true,
        previewNodes: previewResponse.body.nodes,
        expiresAt: '2030-01-01T00:00:00.000Z',
        subscriptionType: 'clash',
      });

    const deleteResponse = await request(app.server)
      .delete(`/subscriptions/${publishResponse.body.subscription.id}`)
      .set('authorization', `Bearer ${accessToken}`);

    expect(deleteResponse.status).toBe(204);

    const listAfterDelete = await request(app.server)
      .get('/subscriptions')
      .set('authorization', `Bearer ${accessToken}`);

    expect(listAfterDelete.body.items).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the subscription integration test and verify it fails**

Run: `pnpm --filter sub-next-api test -- tests/subscriptions.integration.test.ts`
Expected: FAIL because list/detail responses do not expose `status`/`publicUrl`, and restore still returns preview nodes instead of a regenerate-required payload.

- [ ] **Step 3: Implement normalized subscription DTO mapping and restore payload rules**

```ts
// apps/api/src/modules/subscriptions/subscription.service.ts
import crypto from 'node:crypto';
import { renderSubscription, type ParsedNode } from 'sub-core';
import type { Prisma } from '@prisma/client';
import { db } from '../../lib/db.js';
import type { SubscriptionTarget } from './subscription.schema.js';

interface PublishSubscriptionInput {
  nodeLinkSetId?: string | undefined;
  preferredAddressSetId?: string | undefined;
  nodeLinksInput: string;
  preferredAddressesInput: string;
  namePrefix?: string | undefined;
  keepOriginalHost: boolean;
  previewNodes: ParsedNode[];
  remark: string;
  expiresAt: string;
  subscriptionType: SubscriptionTarget;
  publicBaseUrl: string;
}

function toPrismaJson(value: Prisma.InputJsonValue | ParsedNode[]) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getSubscriptionStatus(subscription: { expiresAt: Date; deletedAt: Date | null }) {
  if (subscription.deletedAt) {
    return 'deleted';
  }
  if (subscription.expiresAt < new Date()) {
    return 'expired';
  }
  return 'active';
}

function buildPublicUrl(publicBaseUrl: string, publicToken: string) {
  return `${publicBaseUrl}/subscriptions/public/${publicToken}`;
}

function mapListItem(publicBaseUrl: string, subscription: Awaited<ReturnType<typeof db.subscription.create>>) {
  return {
    id: subscription.id,
    remark: subscription.remark,
    subscriptionType: subscription.subscriptionType,
    createdAt: subscription.createdAt.toISOString(),
    expiresAt: subscription.expiresAt.toISOString(),
    status: getSubscriptionStatus(subscription),
    publicUrl: buildPublicUrl(publicBaseUrl, subscription.publicToken),
  };
}

export async function createSubscription(userId: string, input: PublishSubscriptionInput) {
  const rendered = renderSubscription(input.subscriptionType, input.previewNodes, input.publicBaseUrl);
  const publicToken = crypto.randomBytes(24).toString('hex');

  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const subscription = await tx.subscription.create({
      data: {
        userId,
        remark: input.remark,
        subscriptionType: input.subscriptionType,
        publicToken,
        expiresAt: new Date(input.expiresAt),
      },
    });

    await tx.subscriptionSnapshot.create({
      data: {
        subscriptionId: subscription.id,
        userId,
        nodeLinkSetId: input.nodeLinkSetId ?? null,
        preferredAddressSetId: input.preferredAddressSetId ?? null,
        nodeLinksInput: input.nodeLinksInput,
        preferredAddressesInput: input.preferredAddressesInput,
        generatorOptions: toPrismaJson({
          namePrefix: input.namePrefix,
          keepOriginalHost: input.keepOriginalHost,
        }),
        previewNodesJson: toPrismaJson(input.previewNodes),
        renderedContent: rendered.body,
        renderedContentEncoding: input.subscriptionType === 'clash' || input.subscriptionType === 'surge' ? 'plain' : 'base64',
      },
    });

    return { subscription, publicToken, rendered };
  });
}

export function findPublicSubscription(publicToken: string) {
  return db.subscription.findUnique({ where: { publicToken } });
}

export async function findLatestSnapshot(subscriptionId: string) {
  const snapshot = await db.subscriptionSnapshot.findFirst({
    where: { subscriptionId },
    orderBy: { createdAt: 'desc' },
  });

  if (!snapshot) {
    throw new Error('Snapshot not found');
  }

  return snapshot;
}

export async function listSubscriptions(userId: string, publicBaseUrl: string) {
  const items = await db.subscription.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
  });
  return items.map((item) => mapListItem(publicBaseUrl, item));
}

export async function getSubscriptionDetail(userId: string, id: string, publicBaseUrl: string) {
  const subscription = await db.subscription.findUnique({ where: { id } });
  if (!subscription || subscription.userId !== userId || subscription.deletedAt) {
    return null;
  }
  const snapshot = await findLatestSnapshot(subscription.id);
  const options = snapshot.generatorOptions as { namePrefix?: string; keepOriginalHost?: boolean };

  return {
    subscription: mapListItem(publicBaseUrl, subscription),
    snapshot: {
      nodeLinkSetId: snapshot.nodeLinkSetId ?? undefined,
      preferredAddressSetId: snapshot.preferredAddressSetId ?? undefined,
      nodeLinksInput: snapshot.nodeLinksInput,
      preferredAddressesInput: snapshot.preferredAddressesInput,
      namePrefix: options.namePrefix ?? '',
      keepOriginalHost: options.keepOriginalHost ?? true,
      previewNodes: snapshot.previewNodesJson,
    },
  };
}

export async function restoreSubscriptionInput(userId: string, id: string) {
  const detail = await getSubscriptionDetail(userId, id, 'http://restore-base-unused');
  if (!detail) {
    return null;
  }

  return {
    ...(detail.snapshot.nodeLinkSetId ? { nodeLinkSetId: detail.snapshot.nodeLinkSetId } : {}),
    ...(detail.snapshot.preferredAddressSetId ? { preferredAddressSetId: detail.snapshot.preferredAddressSetId } : {}),
    nodeLinksInput: detail.snapshot.nodeLinksInput,
    preferredAddressesInput: detail.snapshot.preferredAddressesInput,
    namePrefix: detail.snapshot.namePrefix,
    keepOriginalHost: detail.snapshot.keepOriginalHost,
    requiresRegenerate: true,
    restoredFromSubscriptionId: id,
  };
}

export function softDeleteSubscription(userId: string, id: string) {
  return db.subscription.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}
```

```ts
// apps/api/src/modules/subscriptions/subscription.routes.ts
import type { FastifyInstance } from 'fastify';
import { publishSubscriptionSchema } from './subscription.schema.js';
import type { ParsedNode } from 'sub-core';
import { getEnv } from '../../lib/env.js';
import { requireUser } from '../../plugins/require-user.js';
import {
  createSubscription,
  findLatestSnapshot,
  findPublicSubscription,
  getSubscriptionDetail,
  listSubscriptions,
  restoreSubscriptionInput,
  softDeleteSubscription,
} from './subscription.service.js';

export async function subscriptionRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: requireUser }, async (request, reply) => {
    const input = publishSubscriptionSchema.parse(request.body);
    const env = getEnv();
    const result = await createSubscription(request.user.id, {
      publicBaseUrl: env.API_BASE_URL,
      nodeLinksInput: input.nodeLinksInput,
      preferredAddressesInput: input.preferredAddressesInput,
      keepOriginalHost: input.keepOriginalHost,
      previewNodes: input.previewNodes as unknown as ParsedNode[],
      remark: input.remark,
      expiresAt: input.expiresAt,
      subscriptionType: input.subscriptionType,
      ...(input.nodeLinkSetId ? { nodeLinkSetId: input.nodeLinkSetId } : {}),
      ...(input.preferredAddressSetId ? { preferredAddressSetId: input.preferredAddressSetId } : {}),
      ...(input.namePrefix ? { namePrefix: input.namePrefix } : {}),
    });

    return reply.status(201).send({
      subscription: result.subscription,
      publicToken: result.publicToken,
      publicUrl: `${env.API_BASE_URL}/subscriptions/public/${result.publicToken}`,
    });
  });

  app.get('/', { preHandler: requireUser }, async (request) => {
    const env = getEnv();
    return { items: await listSubscriptions(request.user.id, env.API_BASE_URL) };
  });

  app.get('/:id', { preHandler: requireUser }, async (request, reply) => {
    const env = getEnv();
    const detail = await getSubscriptionDetail(request.user.id, (request.params as { id: string }).id, env.API_BASE_URL);
    if (!detail) {
      return reply.status(404).send({ message: 'Subscription not found' });
    }
    return detail;
  });

  app.delete('/:id', { preHandler: requireUser }, async (request, reply) => {
    const result = await softDeleteSubscription(request.user.id, (request.params as { id: string }).id);
    if (result.count === 0) {
      return reply.status(404).send({ message: 'Subscription not found' });
    }
    return reply.status(204).send();
  });

  app.post('/:id/restore', { preHandler: requireUser }, async (request, reply) => {
    const payload = await restoreSubscriptionInput(request.user.id, (request.params as { id: string }).id);
    if (!payload) {
      return reply.status(404).send({ message: 'Subscription not found' });
    }
    return payload;
  });

  app.get('/public/:token', async (request, reply) => {
    const token = (request.params as { token: string }).token;
    const subscription = await findPublicSubscription(token);

    if (!subscription || subscription.expiresAt < new Date() || subscription.deletedAt) {
      return reply.status(410).send({ message: 'Subscription expired' });
    }

    const snapshot = await findLatestSnapshot(subscription.id);
    return reply.type('text/plain; charset=utf-8').send(snapshot.renderedContent);
  });
}
```

- [ ] **Step 4: Re-run the subscription integration test and verify it passes**

Run: `pnpm --filter sub-next-api test -- tests/subscriptions.integration.test.ts`
Expected: PASS with list/detail DTOs, restore semantics, and deletion behavior aligned to the spec.

- [ ] **Step 5: Commit the subscription API alignment**

```bash
git add apps/api/tests/subscriptions.integration.test.ts apps/api/src/modules/subscriptions/subscription.service.ts apps/api/src/modules/subscriptions/subscription.routes.ts
git commit -m "feat: align subscription management api"
```

### Task 3: Add A Shared Auth-Aware Web API Client

**Files:**
- Modify: `apps/web/src/routes/__tests__/auth-shell.test.tsx`
- Create: `apps/web/src/app/api-client.ts`
- Modify: `apps/web/src/app/auth-store.ts`
- Modify: `apps/web/src/routes/app-shell.tsx`
- Modify: `apps/web/src/features/home/api.ts`

- [ ] **Step 1: Write the failing auth-expiry route test**

```tsx
// apps/web/src/routes/__tests__/auth-shell.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveSession } from '../../app/auth-store.js';
import { apiJson } from '../../app/api-client.js';
import { routes } from '../../app/router.js';

describe('app shell', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('redirects unauthenticated visitors to the login page', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/'],
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('button', { name: '登录' })).toBeInTheDocument();
    expect(screen.getByLabelText('账号')).toBeInTheDocument();
  });

  it('renders top navigation and current account for authenticated pages', async () => {
    saveSession({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        username: 'admin',
        email: 'admin@local.test',
      },
    });

    const router = createMemoryRouter(routes, {
      initialEntries: ['/'],
    });

    render(<RouterProvider router={router} />);

    expect(screen.getByRole('link', { name: '首页' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '数据管理' })).toBeInTheDocument();
    expect(await screen.findByText('admin')).toBeInTheDocument();
  });

  it('clears the session and returns to login after a 401 api response', async () => {
    saveSession({
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token',
      user: {
        username: 'admin',
        email: 'admin@local.test',
      },
    });

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const router = createMemoryRouter(routes, {
      initialEntries: ['/'],
    });

    render(<RouterProvider router={router} />);

    await expect(apiJson('/api/subscriptions')).rejects.toThrow('Unauthorized');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
    });
    expect(localStorage.getItem('sub-next-auth')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the auth-shell test and verify it fails**

Run: `pnpm --filter sub-next-web test -- src/routes/__tests__/auth-shell.test.tsx`
Expected: FAIL because there is no shared API client and a `401` response does not trigger navigation back to `/login`.

- [ ] **Step 3: Implement the shared API client and auth-expiry event flow**

```ts
// apps/web/src/app/auth-store.ts
export interface SessionUser {
  id?: string;
  email: string;
  username?: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string;
  user?: SessionUser;
}

const STORAGE_KEY = 'sub-next-auth';
const AUTH_EXPIRED_EVENT = 'sub-next-auth-expired';

export function saveSession(session: AuthSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getSession(): AuthSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function notifyAuthExpired() {
  clearSession();
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

export function listenForAuthExpired(listener: () => void) {
  window.addEventListener(AUTH_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
}

export function getSessionAccountLabel(session = getSession()): string {
  if (!session?.user) {
    return '已登录用户';
  }

  return session.user.username?.trim() || session.user.email;
}
```

```ts
// apps/web/src/app/api-client.ts
import { getSession, notifyAuthExpired } from './auth-store.js';

function buildHeaders(init?: HeadersInit) {
  const session = getSession();
  const headers = new Headers(init);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (session?.accessToken) {
    headers.set('authorization', `Bearer ${session.accessToken}`);
  }
  return headers;
}

export async function apiFetch(input: string, init: RequestInit = {}) {
  const response = await fetch(input, {
    ...init,
    headers: buildHeaders(init.headers),
  });

  if (response.status === 401) {
    notifyAuthExpired();
    throw new Error('Unauthorized');
  }

  return response;
}

export async function apiJson<T>(input: string, init: RequestInit = {}) {
  const response = await apiFetch(input, init);
  return response.json() as Promise<T>;
}
```

```tsx
// apps/web/src/routes/app-shell.tsx
import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearSession, getSessionAccountLabel, listenForAuthExpired } from '../app/auth-store.js';

export function AppShell() {
  const navigate = useNavigate();
  const accountLabel = getSessionAccountLabel();
  const avatarLabel = accountLabel.slice(0, 1).toUpperCase();

  useEffect(() => {
    return listenForAuthExpired(() => {
      navigate('/login', { replace: true });
    });
  }, [navigate]);

  function handleLogout() {
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <header>
        <NavLink to="/" className="logo">
          <span>SN</span> sub-next
        </NavLink>
        <nav>
          <NavLink to="/">首页</NavLink>
          <NavLink to="/data">数据管理</NavLink>
        </nav>
        <div className="user-area">
          <span className="text-small text-muted">{accountLabel}</span>
          <button type="button" className="btn btn-secondary" onClick={handleLogout}>
            退出登录
          </button>
          <div className="avatar">{avatarLabel}</div>
        </div>
      </header>
      <main>
        <div className="main-single">
          <Outlet />
        </div>
      </main>
    </>
  );
}
```

```ts
// apps/web/src/features/home/api.ts
import { apiJson } from '../../app/api-client.js';

export interface PreviewRequest {
  nodeLinksInput: string;
  preferredAddressesInput: string;
  namePrefix?: string;
  keepOriginalHost: boolean;
  nodeLinkSetId?: string;
  preferredAddressSetId?: string;
}

export interface PublishSubscriptionRequest extends PreviewRequest {
  previewNodes: Array<Record<string, unknown>>;
  remark?: string;
  expiresAt: string;
  subscriptionType: 'clash' | 'v2rayn' | 'shadowrocket' | 'surge';
}

export async function previewNodes(payload: PreviewRequest) {
  return apiJson<{ warnings?: string[]; nodes?: Array<Record<string, unknown>> }>('/api/generator/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function publishSubscription(payload: PublishSubscriptionRequest) {
  return apiJson<{ publicUrl?: string }>('/api/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 4: Re-run the auth-shell test and verify it passes**

Run: `pnpm --filter sub-next-web test -- src/routes/__tests__/auth-shell.test.tsx`
Expected: PASS with `401` responses clearing the session and navigating back to the login page.

- [ ] **Step 5: Commit the shared web API client**

```bash
git add apps/web/src/routes/__tests__/auth-shell.test.tsx apps/web/src/app/api-client.ts apps/web/src/app/auth-store.ts apps/web/src/routes/app-shell.tsx apps/web/src/features/home/api.ts
git commit -m "feat: handle auth expiry in web api client"
```

### Task 4: Build Usable Dataset Management Screens

**Files:**
- Modify: `apps/web/src/routes/__tests__/data-management.test.tsx`
- Create: `apps/web/src/features/data-management/api.ts`
- Modify: `apps/web/src/routes/node-link-page.tsx`
- Modify: `apps/web/src/routes/preferred-address-page.tsx`

- [ ] **Step 1: Write the failing dataset-management UI test**

```tsx
// apps/web/src/routes/__tests__/data-management.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeLinkPage } from '../node-link-page.js';
import { PreferredAddressPage } from '../preferred-address-page.js';

describe('data management pages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates, edits, and deletes a node-link dataset', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'node-1',
        name: '香港节点',
        description: '首选',
        content: 'vmess://demo',
        updatedAt: '2026-05-17T00:00:00.000Z',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          {
            id: 'node-1',
            name: '香港节点',
            description: '首选',
            content: 'vmess://demo',
            updatedAt: '2026-05-17T00:00:00.000Z',
          },
        ],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'node-1',
        name: '香港节点-更新',
        description: '已编辑',
        content: 'vmess://updated',
        updatedAt: '2026-05-17T00:02:00.000Z',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          {
            id: 'node-1',
            name: '香港节点-更新',
            description: '已编辑',
            content: 'vmess://updated',
            updatedAt: '2026-05-17T00:02:00.000Z',
          },
        ],
      })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })));

    render(
      <MemoryRouter>
        <NodeLinkPage />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: '新增节点链接' }));
    await user.type(screen.getByLabelText('名称'), '香港节点');
    await user.type(screen.getByLabelText('描述'), '首选');
    await user.type(screen.getByLabelText('内容'), 'vmess://demo');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('香港节点')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '编辑' }));
    await user.clear(screen.getByLabelText('名称'));
    await user.type(screen.getByLabelText('名称'), '香港节点-更新');
    await user.clear(screen.getByLabelText('内容'));
    await user.type(screen.getByLabelText('内容'), 'vmess://updated');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('香港节点-更新')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => {
      expect(screen.queryByText('香港节点-更新')).not.toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/sources/node-links/node-1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('creates and edits a preferred-address dataset', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'pref-1',
        name: 'Cloudflare 优选',
        description: '',
        content: '104.16.1.2#HK',
        updatedAt: '2026-05-17T00:00:00.000Z',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          {
            id: 'pref-1',
            name: 'Cloudflare 优选',
            description: '',
            content: '104.16.1.2#HK',
            updatedAt: '2026-05-17T00:00:00.000Z',
          },
        ],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'pref-1',
        name: 'Cloudflare 优选-更新',
        description: '带 2053 端口',
        content: '104.17.2.3:2053#US',
        updatedAt: '2026-05-17T00:02:00.000Z',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          {
            id: 'pref-1',
            name: 'Cloudflare 优选-更新',
            description: '带 2053 端口',
            content: '104.17.2.3:2053#US',
            updatedAt: '2026-05-17T00:02:00.000Z',
          },
        ],
      })));

    render(
      <MemoryRouter>
        <PreferredAddressPage />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: '新增优选地址' }));
    await user.type(screen.getByLabelText('名称'), 'Cloudflare 优选');
    await user.type(screen.getByLabelText('内容'), '104.16.1.2#HK');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('Cloudflare 优选')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '编辑' }));
    await user.clear(screen.getByLabelText('名称'));
    await user.type(screen.getByLabelText('名称'), 'Cloudflare 优选-更新');
    await user.type(screen.getByLabelText('描述'), '带 2053 端口');
    await user.clear(screen.getByLabelText('内容'));
    await user.type(screen.getByLabelText('内容'), '104.17.2.3:2053#US');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('Cloudflare 优选-更新')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the dataset-management UI test and verify it fails**

Run: `pnpm --filter sub-next-web test -- src/routes/__tests__/data-management.test.tsx`
Expected: FAIL because the current dataset pages only render tables or placeholder text and do not create, edit, or delete anything.

- [ ] **Step 3: Implement dataset CRUD helpers and interactive pages**

```ts
// apps/web/src/features/data-management/api.ts
import { apiFetch, apiJson } from '../../app/api-client.js';

export interface DatasetItem {
  id: string;
  name: string;
  description?: string | null;
  content: string;
  updatedAt?: string;
}

export async function listDatasets(kind: 'node-links' | 'preferred-addresses') {
  return apiJson<{ items: DatasetItem[] }>(`/api/sources/${kind}`);
}

export async function createDataset(kind: 'node-links' | 'preferred-addresses', payload: Omit<DatasetItem, 'id' | 'updatedAt'>) {
  return apiJson<DatasetItem>(`/api/sources/${kind}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateDataset(kind: 'node-links' | 'preferred-addresses', id: string, payload: Omit<DatasetItem, 'id' | 'updatedAt'>) {
  return apiJson<DatasetItem>(`/api/sources/${kind}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteDataset(kind: 'node-links' | 'preferred-addresses', id: string) {
  return apiFetch(`/api/sources/${kind}/${id}`, {
    method: 'DELETE',
  });
}
```

```tsx
// apps/web/src/routes/node-link-page.tsx
import { useEffect, useState } from 'react';
import { createDataset, deleteDataset, listDatasets, updateDataset, type DatasetItem } from '../features/data-management/api.js';

interface DatasetFormState {
  id?: string;
  name: string;
  description: string;
  content: string;
}

const emptyForm: DatasetFormState = {
  name: '',
  description: '',
  content: '',
};

export function NodeLinkPage() {
  const [items, setItems] = useState<DatasetItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<DatasetFormState>(emptyForm);

  async function refresh() {
    const payload = await listDatasets('node-links');
    setItems(payload.items ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleSubmit() {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      content: form.content.trim(),
    };

    if (form.id) {
      await updateDataset('node-links', form.id, payload);
    } else {
      await createDataset('node-links', payload);
    }

    setForm(emptyForm);
    setIsEditing(false);
    await refresh();
  }

  function handleEdit(item: DatasetItem) {
    setForm({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      content: item.content,
    });
    setIsEditing(true);
  }

  async function handleDelete(id: string) {
    await deleteDataset('node-links', id);
    await refresh();
  }

  return (
    <div className="panel">
      <div className="panel-title-row">
        <div className="panel-title">节点链接</div>
        <button type="button" className="btn btn-primary" onClick={() => { setForm(emptyForm); setIsEditing(true); }}>
          新增节点链接
        </button>
      </div>

      {isEditing ? (
        <div className="panel-form">
          <label>
            名称
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            描述
            <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <label>
            内容
            <textarea aria-label="内容" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
          </label>
          <div className="actions-row">
            <button type="button" className="btn btn-primary" onClick={handleSubmit}>
              保存
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { setForm(emptyForm); setIsEditing(false); }}>
              取消
            </button>
          </div>
        </div>
      ) : null}

      {items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>更新时间</th>
                <th>内容摘要</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.updatedAt ?? ''}</td>
                  <td>{item.content.slice(0, 60)}</td>
                  <td className="td-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleEdit(item)}>
                      编辑
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>暂无节点链接数据集。</p>
        </div>
      )}
    </div>
  );
}
```

```tsx
// apps/web/src/routes/preferred-address-page.tsx
import { useEffect, useState } from 'react';
import { createDataset, deleteDataset, listDatasets, updateDataset, type DatasetItem } from '../features/data-management/api.js';

interface DatasetFormState {
  id?: string;
  name: string;
  description: string;
  content: string;
}

const emptyForm: DatasetFormState = {
  name: '',
  description: '',
  content: '',
};

export function PreferredAddressPage() {
  const [items, setItems] = useState<DatasetItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<DatasetFormState>(emptyForm);

  async function refresh() {
    const payload = await listDatasets('preferred-addresses');
    setItems(payload.items ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleSubmit() {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      content: form.content.trim(),
    };

    if (form.id) {
      await updateDataset('preferred-addresses', form.id, payload);
    } else {
      await createDataset('preferred-addresses', payload);
    }

    setForm(emptyForm);
    setIsEditing(false);
    await refresh();
  }

  function handleEdit(item: DatasetItem) {
    setForm({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      content: item.content,
    });
    setIsEditing(true);
  }

  async function handleDelete(id: string) {
    await deleteDataset('preferred-addresses', id);
    await refresh();
  }

  return (
    <div className="panel">
      <div className="panel-title-row">
        <div className="panel-title">优选地址</div>
        <button type="button" className="btn btn-primary" onClick={() => { setForm(emptyForm); setIsEditing(true); }}>
          新增优选地址
        </button>
      </div>

      {isEditing ? (
        <div className="panel-form">
          <label>
            名称
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            描述
            <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <label>
            内容
            <textarea aria-label="内容" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
          </label>
          <div className="actions-row">
            <button type="button" className="btn btn-primary" onClick={handleSubmit}>
              保存
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { setForm(emptyForm); setIsEditing(false); }}>
              取消
            </button>
          </div>
        </div>
      ) : null}

      {items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>更新时间</th>
                <th>内容摘要</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.updatedAt ?? ''}</td>
                  <td>{item.content.slice(0, 60)}</td>
                  <td className="td-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleEdit(item)}>
                      编辑
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>暂无优选地址数据集。</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Re-run the dataset-management UI test and verify it passes**

Run: `pnpm --filter sub-next-web test -- src/routes/__tests__/data-management.test.tsx`
Expected: PASS for node-link and preferred-address CRUD interactions.

- [ ] **Step 5: Commit the usable dataset screens**

```bash
git add apps/web/src/routes/__tests__/data-management.test.tsx apps/web/src/features/data-management/api.ts apps/web/src/routes/node-link-page.tsx apps/web/src/routes/preferred-address-page.tsx
git commit -m "feat: enable dataset management pages"
```

### Task 5: Complete Subscription Management Page Actions

**Files:**
- Modify: `apps/web/src/routes/__tests__/data-management.test.tsx`
- Modify: `apps/web/src/features/data-management/api.ts`
- Modify: `apps/web/src/routes/subscription-management-page.tsx`

- [ ] **Step 1: Extend the failing UI test for details/copy/delete/restore**

```tsx
// apps/web/src/routes/__tests__/data-management.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionManagementPage } from '../subscription-management-page.js';

describe('subscription management', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows details, copies public url, deletes, and restores a subscription', async () => {
    const user = userEvent.setup();
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: clipboardWriteText,
      },
    });

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          {
            id: 'sub-1',
            remark: '测试订阅',
            subscriptionType: 'clash',
            createdAt: '2026-05-15T00:00:00.000Z',
            expiresAt: '2030-01-01T00:00:00.000Z',
            status: 'active',
            publicUrl: 'http://localhost:4000/subscriptions/public/demo-token',
          },
        ],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        subscription: {
          id: 'sub-1',
          remark: '测试订阅',
          subscriptionType: 'clash',
          createdAt: '2026-05-15T00:00:00.000Z',
          expiresAt: '2030-01-01T00:00:00.000Z',
          status: 'active',
          publicUrl: 'http://localhost:4000/subscriptions/public/demo-token',
        },
        snapshot: {
          nodeLinksInput: 'vmess://demo',
          preferredAddressesInput: '104.16.1.2#HK',
          namePrefix: 'CF',
          keepOriginalHost: true,
          previewNodes: [{ name: 'node-1', server: '104.16.1.2', port: 443 }],
        },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        nodeLinksInput: 'vmess://demo',
        preferredAddressesInput: '104.16.1.2#HK',
        namePrefix: 'CF',
        keepOriginalHost: true,
        requiresRegenerate: true,
      })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })));

    render(
      <MemoryRouter>
        <SubscriptionManagementPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('测试订阅')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '详情' }));
    expect(await screen.findByText('vmess://demo')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '复制' }));
    expect(clipboardWriteText).toHaveBeenCalledWith('http://localhost:4000/subscriptions/public/demo-token');

    await user.click(screen.getByRole('button', { name: '恢复' }));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/subscriptions/sub-1/restore'),
      expect.any(Object),
    );

    await user.click(screen.getByRole('button', { name: '删除' }));
    await waitFor(() => {
      expect(screen.queryByText('测试订阅')).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the subscription-management UI test and verify it fails**

Run: `pnpm --filter sub-next-web test -- src/routes/__tests__/data-management.test.tsx`
Expected: FAIL because the current page renders inert buttons for details/copy/delete and does not refresh the list after deletion.

- [ ] **Step 3: Implement subscription detail, copy, delete, and restore behavior**

```ts
// apps/web/src/features/data-management/api.ts
export interface SubscriptionListItem {
  id: string;
  remark: string;
  subscriptionType: string;
  createdAt: string;
  expiresAt: string;
  status: string;
  publicUrl: string;
}

export interface SubscriptionDetail {
  subscription: SubscriptionListItem;
  snapshot: {
    nodeLinkSetId?: string;
    preferredAddressSetId?: string;
    nodeLinksInput: string;
    preferredAddressesInput: string;
    namePrefix: string;
    keepOriginalHost: boolean;
    previewNodes: Array<Record<string, unknown>>;
  };
}

export interface RestorePayload {
  nodeLinkSetId?: string;
  preferredAddressSetId?: string;
  nodeLinksInput: string;
  preferredAddressesInput: string;
  namePrefix: string;
  keepOriginalHost: boolean;
  requiresRegenerate: boolean;
  restoredFromSubscriptionId?: string;
}

export async function listSubscriptions() {
  return apiJson<{ items: SubscriptionListItem[] }>('/api/subscriptions');
}

export async function getSubscriptionDetail(id: string) {
  return apiJson<SubscriptionDetail>(`/api/subscriptions/${id}`);
}

export async function restoreSubscription(id: string) {
  return apiJson<RestorePayload>(`/api/subscriptions/${id}/restore`, {
    method: 'POST',
  });
}

export async function deleteSubscription(id: string) {
  return apiFetch(`/api/subscriptions/${id}`, {
    method: 'DELETE',
  });
}
```

```tsx
// apps/web/src/routes/subscription-management-page.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteSubscription, getSubscriptionDetail, listSubscriptions, restoreSubscription, type SubscriptionDetail, type SubscriptionListItem } from '../features/data-management/api.js';
import { saveHomeDraftFromRestore } from '../app/home-draft.js';

export function SubscriptionManagementPage() {
  const [items, setItems] = useState<SubscriptionListItem[]>([]);
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const navigate = useNavigate();

  async function refresh() {
    const payload = await listSubscriptions();
    setItems(payload.items ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleDetail(id: string) {
    setDetail(await getSubscriptionDetail(id));
  }

  async function handleCopy(publicUrl: string) {
    await navigator.clipboard.writeText(publicUrl);
  }

  async function handleRestore(id: string) {
    const payload = await restoreSubscription(id);
    saveHomeDraftFromRestore(payload);
    navigate('/', { replace: true });
  }

  async function handleDelete(id: string) {
    await deleteSubscription(id);
    await refresh();
  }

  return (
    <div className="panel">
      <div className="panel-title">订阅管理</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>备注</th>
              <th>类型</th>
              <th>创建时间</th>
              <th>有效期至</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.remark}</td>
                <td>{item.subscriptionType}</td>
                <td>{item.createdAt}</td>
                <td>{item.expiresAt}</td>
                <td>{item.status}</td>
                <td className="td-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDetail(item.id)}>
                    详情
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleCopy(item.publicUrl)}>
                    复制
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleRestore(item.id)}>
                    恢复
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail ? (
        <div className="panel detail-panel">
          <div className="panel-title">订阅详情</div>
          <p>{detail.subscription.publicUrl}</p>
          <pre>{detail.snapshot.nodeLinksInput}</pre>
          <pre>{detail.snapshot.preferredAddressesInput}</pre>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Re-run the subscription-management UI test and verify it passes**

Run: `pnpm --filter sub-next-web test -- src/routes/__tests__/data-management.test.tsx`
Expected: PASS with details, copy, delete, and restore fully wired.

- [ ] **Step 5: Commit subscription-management page completion**

```bash
git add apps/web/src/routes/__tests__/data-management.test.tsx apps/web/src/features/data-management/api.ts apps/web/src/routes/subscription-management-page.tsx
git commit -m "feat: complete subscription management actions"
```

### Task 6: Persist Homepage Draft And Add Dataset Selectors

**Files:**
- Modify: `apps/web/src/routes/__tests__/home-page.test.tsx`
- Create: `apps/web/src/app/home-draft.ts`
- Modify: `apps/web/src/features/home/api.ts`
- Modify: `apps/web/src/routes/home-page.tsx`

- [ ] **Step 1: Write the failing homepage draft and restore tests**

```tsx
// apps/web/src/routes/__tests__/home-page.test.tsx
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from '../home-page.js';
import { saveHomeDraftFromRestore } from '../../app/home-draft.js';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('home page', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 'node-1', name: '机场A', content: 'vmess://saved-node' }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 'pref-1', name: 'Cloudflare', content: '104.16.1.2#HK' }],
      })));
  });

  it('loads saved datasets into the editable homepage inputs', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await user.selectOptions(await screen.findByLabelText('节点链接来源'), 'node-1');
    await user.selectOptions(screen.getByLabelText('优选地址来源'), 'pref-1');

    expect(screen.getByLabelText('节点链接')).toHaveValue('vmess://saved-node');
    expect(screen.getByLabelText('优选地址')).toHaveValue('104.16.1.2#HK');
  });

  it('restores draft input after leaving and returning to the homepage', async () => {
    const user = userEvent.setup();

    const { unmount } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await user.type(await screen.findByLabelText('节点链接'), 'vmess://draft');
    await user.type(screen.getByLabelText('优选地址'), '104.16.1.2#HK');
    unmount();

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('节点链接')).toHaveValue('vmess://draft');
    expect(screen.getByLabelText('优选地址')).toHaveValue('104.16.1.2#HK');
  });

  it('requires regenerate after restoring from subscription history', async () => {
    saveHomeDraftFromRestore({
      nodeLinksInput: 'vmess://restored',
      preferredAddressesInput: '104.16.1.2#HK',
      namePrefix: 'CF',
      keepOriginalHost: true,
      requiresRegenerate: true,
    });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue('vmess://restored')).toBeInTheDocument();
    expect(screen.getByText('已从历史订阅恢复输入，请重新生成节点后再发布。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成订阅' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the homepage test and verify it fails**

Run: `pnpm --filter sub-next-web test -- src/routes/__tests__/home-page.test.tsx`
Expected: FAIL because the homepage has no dataset selectors, no draft persistence, and restore still allows publish without re-running preview.

- [ ] **Step 3: Implement the local draft store and homepage selector workflow**

```ts
// apps/web/src/app/home-draft.ts
export interface HomeDraft {
  nodeLinkSetId?: string;
  preferredAddressSetId?: string;
  nodeLinksInput: string;
  preferredAddressesInput: string;
  namePrefix: string;
  keepOriginalHost: boolean;
  previewNodes: Array<Record<string, unknown>>;
  warnings: string[];
  subscriptionType: 'clash' | 'v2rayn' | 'shadowrocket' | 'surge';
  remark: string;
  requiresRegenerate: boolean;
}

export interface RestoreDraftInput {
  nodeLinkSetId?: string;
  preferredAddressSetId?: string;
  nodeLinksInput: string;
  preferredAddressesInput: string;
  namePrefix: string;
  keepOriginalHost: boolean;
  requiresRegenerate: boolean;
}

const STORAGE_KEY = 'sub-next-home-draft';

export function getEmptyHomeDraft(): HomeDraft {
  return {
    nodeLinksInput: '',
    preferredAddressesInput: '',
    namePrefix: '',
    keepOriginalHost: true,
    previewNodes: [],
    warnings: [],
    subscriptionType: 'clash',
    remark: '',
    requiresRegenerate: false,
  };
}

export function loadHomeDraft(): HomeDraft {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return getEmptyHomeDraft();
  }
  try {
    return {
      ...getEmptyHomeDraft(),
      ...(JSON.parse(raw) as Partial<HomeDraft>),
    };
  } catch {
    return getEmptyHomeDraft();
  }
}

export function saveHomeDraft(draft: HomeDraft) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function saveHomeDraftFromRestore(restore: RestoreDraftInput) {
  saveHomeDraft({
    ...getEmptyHomeDraft(),
    ...(restore.nodeLinkSetId ? { nodeLinkSetId: restore.nodeLinkSetId } : {}),
    ...(restore.preferredAddressSetId ? { preferredAddressSetId: restore.preferredAddressSetId } : {}),
    nodeLinksInput: restore.nodeLinksInput,
    preferredAddressesInput: restore.preferredAddressesInput,
    namePrefix: restore.namePrefix,
    keepOriginalHost: restore.keepOriginalHost,
    requiresRegenerate: restore.requiresRegenerate,
  });
}
```

```tsx
// apps/web/src/routes/home-page.tsx
import { useEffect, useMemo, useState } from 'react';
import { previewNodes, publishSubscription } from '../features/home/api.js';
import { listDatasets, type DatasetItem } from '../features/data-management/api.js';
import { loadHomeDraft, saveHomeDraft, type HomeDraft } from '../app/home-draft.js';

interface PreviewNode {
  name: string;
  type: string;
  server: string;
  port: number;
  hostHeader?: string;
  sni?: string;
}

function toDraft(partial: {
  nodeLinkSetId?: string;
  preferredAddressSetId?: string;
  nodeLinksInput: string;
  preferredAddressesInput: string;
  namePrefix: string;
  keepOriginalHost: boolean;
  previewNodes: PreviewNode[];
  warnings: string[];
  subscriptionType: 'clash' | 'v2rayn' | 'shadowrocket' | 'surge';
  remark: string;
  requiresRegenerate: boolean;
}): HomeDraft {
  return {
    ...(partial.nodeLinkSetId ? { nodeLinkSetId: partial.nodeLinkSetId } : {}),
    ...(partial.preferredAddressSetId ? { preferredAddressSetId: partial.preferredAddressSetId } : {}),
    nodeLinksInput: partial.nodeLinksInput,
    preferredAddressesInput: partial.preferredAddressesInput,
    namePrefix: partial.namePrefix,
    keepOriginalHost: partial.keepOriginalHost,
    previewNodes: partial.previewNodes,
    warnings: partial.warnings,
    subscriptionType: partial.subscriptionType,
    remark: partial.remark,
    requiresRegenerate: partial.requiresRegenerate,
  };
}

export function HomePage() {
  const initialDraft = loadHomeDraft();
  const [nodeDatasets, setNodeDatasets] = useState<DatasetItem[]>([]);
  const [preferredDatasets, setPreferredDatasets] = useState<DatasetItem[]>([]);
  const [nodeLinkSetId, setNodeLinkSetId] = useState(initialDraft.nodeLinkSetId ?? '');
  const [preferredAddressSetId, setPreferredAddressSetId] = useState(initialDraft.preferredAddressSetId ?? '');
  const [nodeLinksInput, setNodeLinksInput] = useState(initialDraft.nodeLinksInput);
  const [preferredAddressesInput, setPreferredAddressesInput] = useState(initialDraft.preferredAddressesInput);
  const [namePrefix, setNamePrefix] = useState(initialDraft.namePrefix);
  const [keepOriginalHost, setKeepOriginalHost] = useState(initialDraft.keepOriginalHost);
  const [nodes, setNodes] = useState<PreviewNode[]>(initialDraft.previewNodes as PreviewNode[]);
  const [warnings, setWarnings] = useState<string[]>(initialDraft.warnings);
  const [subscriptionType, setSubscriptionType] = useState<'clash' | 'v2rayn' | 'shadowrocket' | 'surge'>(initialDraft.subscriptionType);
  const [remark, setRemark] = useState(initialDraft.remark);
  const [publicUrl, setPublicUrl] = useState('');
  const [requiresRegenerate, setRequiresRegenerate] = useState(initialDraft.requiresRegenerate);
  const expiresAt = useMemo(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), []);

  useEffect(() => {
    void Promise.all([
      listDatasets('node-links'),
      listDatasets('preferred-addresses'),
    ]).then(([nodePayload, preferredPayload]) => {
      setNodeDatasets(nodePayload.items ?? []);
      setPreferredDatasets(preferredPayload.items ?? []);
    });
  }, []);

  useEffect(() => {
    saveHomeDraft(toDraft({
      ...(nodeLinkSetId ? { nodeLinkSetId } : {}),
      ...(preferredAddressSetId ? { preferredAddressSetId } : {}),
      nodeLinksInput,
      preferredAddressesInput,
      namePrefix,
      keepOriginalHost,
      previewNodes: nodes,
      warnings,
      subscriptionType,
      remark,
      requiresRegenerate,
    }));
  }, [
    nodeLinkSetId,
    preferredAddressSetId,
    nodeLinksInput,
    preferredAddressesInput,
    namePrefix,
    keepOriginalHost,
    nodes,
    warnings,
    subscriptionType,
    remark,
    requiresRegenerate,
  ]);

  async function handlePreview() {
    const payload = await previewNodes({
      ...(nodeLinkSetId ? { nodeLinkSetId } : {}),
      ...(preferredAddressSetId ? { preferredAddressSetId } : {}),
      nodeLinksInput,
      preferredAddressesInput,
      keepOriginalHost,
      ...(namePrefix ? { namePrefix } : {}),
    });
    setWarnings(payload.warnings ?? []);
    setNodes((payload.nodes ?? []) as PreviewNode[]);
    setRequiresRegenerate(false);
  }

  async function handlePublish() {
    const normalizedRemark = remark.trim();
    const payload = await publishSubscription({
      ...(nodeLinkSetId ? { nodeLinkSetId } : {}),
      ...(preferredAddressSetId ? { preferredAddressSetId } : {}),
      nodeLinksInput,
      preferredAddressesInput,
      keepOriginalHost,
      previewNodes: nodes as unknown as Array<Record<string, unknown>>,
      expiresAt,
      subscriptionType,
      ...(normalizedRemark ? { remark: normalizedRemark } : {}),
      ...(namePrefix ? { namePrefix } : {}),
    });
    setPublicUrl(payload.publicUrl ?? '');
  }

  function applyNodeDataset(id: string) {
    setNodeLinkSetId(id);
    const found = nodeDatasets.find((item) => item.id === id);
    if (found) {
      setNodeLinksInput(found.content);
      setNodes([]);
      setWarnings([]);
      setRequiresRegenerate(false);
    }
  }

  function applyPreferredDataset(id: string) {
    setPreferredAddressSetId(id);
    const found = preferredDatasets.find((item) => item.id === id);
    if (found) {
      setPreferredAddressesInput(found.content);
      setNodes([]);
      setWarnings([]);
      setRequiresRegenerate(false);
    }
  }

  return (
    <div className="home-layout">
      <section className="panel">
        <div className="panel-title">输入配置</div>
        <div>
          <label htmlFor="node-link-set">节点链接来源</label>
          <select id="node-link-set" aria-label="节点链接来源" value={nodeLinkSetId} onChange={(event) => applyNodeDataset(event.target.value)}>
            <option value="">手动输入</option>
            {nodeDatasets.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="node-links">节点链接</label>
          <textarea id="node-links" aria-label="节点链接" value={nodeLinksInput} onChange={(event) => setNodeLinksInput(event.target.value)} />
        </div>
        <div>
          <label htmlFor="preferred-address-set">优选地址来源</label>
          <select id="preferred-address-set" aria-label="优选地址来源" value={preferredAddressSetId} onChange={(event) => applyPreferredDataset(event.target.value)}>
            <option value="">手动输入</option>
            {preferredDatasets.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="preferred-addresses">优选地址</label>
          <textarea id="preferred-addresses" aria-label="优选地址" value={preferredAddressesInput} onChange={(event) => setPreferredAddressesInput(event.target.value)} />
        </div>
        <div className="row">
          <div>
            <label htmlFor="name-prefix">备注前缀</label>
            <input id="name-prefix" value={namePrefix} onChange={(event) => setNamePrefix(event.target.value)} />
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={keepOriginalHost} onChange={(event) => setKeepOriginalHost(event.target.checked)} />
            保留原 Host/SNI
          </label>
        </div>
        <div className="actions-row">
          <button type="button" className="btn btn-primary" onClick={handlePreview}>
            生成节点
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">生成结果</div>
        {requiresRegenerate ? (
          <p className="text-muted">已从历史订阅恢复输入，请重新生成节点后再发布。</p>
        ) : null}
        {warnings.length ? (
          <div className="warning-list">
            {warnings.map((warning) => (
              <p key={warning} className="text-muted">{warning}</p>
            ))}
          </div>
        ) : null}
        <div className="node-list">
          {nodes.map((node) => (
            <article key={node.name} className="node-item">
              <div>
                <div className="name">{node.name}</div>
                <div className="meta">
                  {node.server}:{node.port}
                  {node.hostHeader ? ` · Host: ${node.hostHeader}` : ''}
                  {node.sni ? ` · SNI: ${node.sni}` : ''}
                </div>
              </div>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setNodes(nodes.filter((item) => item.name !== node.name))}>
                删除
              </button>
            </article>
          ))}
        </div>
        <div className="row">
          <div>
            <label htmlFor="subscription-type">订阅类型</label>
            <select id="subscription-type" aria-label="订阅类型" value={subscriptionType} onChange={(event) => setSubscriptionType(event.target.value as typeof subscriptionType)}>
              <option value="clash">Clash</option>
              <option value="v2rayn">V2rayN</option>
              <option value="shadowrocket">Shadowrocket</option>
              <option value="surge">Surge</option>
            </select>
          </div>
          <div>
            <label htmlFor="remark">备注</label>
            <input id="remark" aria-label="备注" value={remark} onChange={(event) => setRemark(event.target.value)} />
          </div>
        </div>
        <div className="actions-row">
          <button type="button" className="btn btn-primary" onClick={handlePublish} disabled={requiresRegenerate || nodes.length === 0}>
            生成订阅
          </button>
        </div>
        {publicUrl ? (
          <div className="result-box">
            <input readOnly value={publicUrl} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Re-run the homepage test and verify it passes**

Run: `pnpm --filter sub-next-web test -- src/routes/__tests__/home-page.test.tsx`
Expected: PASS with dataset selectors, draft persistence across remounts, and restore forcing a fresh preview before publish.

- [ ] **Step 5: Commit the homepage continuity fixes**

```bash
git add apps/web/src/routes/__tests__/home-page.test.tsx apps/web/src/app/home-draft.ts apps/web/src/features/home/api.ts apps/web/src/routes/home-page.tsx
git commit -m "feat: persist homepage draft and restore flow"
```

### Task 7: Run The Targeted Verification Suite

**Files:**
- Modify: none
- Test: `apps/api/tests/sources.integration.test.ts`
- Test: `apps/api/tests/subscriptions.integration.test.ts`
- Test: `apps/web/src/routes/__tests__/auth-shell.test.tsx`
- Test: `apps/web/src/routes/__tests__/data-management.test.tsx`
- Test: `apps/web/src/routes/__tests__/home-page.test.tsx`

- [ ] **Step 1: Run the API verification subset**

```bash
pnpm --filter sub-next-api test -- tests/sources.integration.test.ts tests/subscriptions.integration.test.ts
```

Expected: PASS with dataset CRUD, subscription list/detail/delete/restore, and public access behavior all green.

- [ ] **Step 2: Run the web verification subset**

```bash
pnpm --filter sub-next-web test -- src/routes/__tests__/auth-shell.test.tsx src/routes/__tests__/data-management.test.tsx src/routes/__tests__/home-page.test.tsx
```

Expected: PASS with auth-expiry redirect, usable management pages, and homepage draft continuity covered.

- [ ] **Step 3: Run the workspace lint checks touched by this plan**

```bash
pnpm --filter sub-next-api lint
pnpm --filter sub-next-web lint
```

Expected: PASS with no new type errors in the API or web packages.

- [ ] **Step 4: Commit the verified recovery work**

```bash
git add .
git commit -m "test: verify data management recovery"
```
