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
    return { items: await listSubscriptions(request.user.id) };
  });

  app.get('/:id', { preHandler: requireUser }, async (request, reply) => {
    const detail = await getSubscriptionDetail(request.user.id, (request.params as { id: string }).id);
    if (!detail) {
      return reply.status(404).send({ message: 'Subscription not found' });
    }
    return detail;
  });

  app.delete('/:id', { preHandler: requireUser }, async (request, reply) => {
    await softDeleteSubscription(request.user.id, (request.params as { id: string }).id);
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
