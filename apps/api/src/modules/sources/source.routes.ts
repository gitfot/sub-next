import type { FastifyInstance } from 'fastify';
import { datasetSchema } from '@cloudflaresub/shared';
import { requireUser } from '../../plugins/require-user.js';
import {
  createNodeLinkSet,
  createPreferredAddressSet,
  listNodeLinkSets,
  listPreferredAddressSets,
  softDeleteNodeLinkSet,
  softDeletePreferredAddressSet,
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

  app.delete('/node-links/:id', { preHandler: requireUser }, async (request, reply) => {
    await softDeleteNodeLinkSet(request.user.id, (request.params as { id: string }).id);
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

  app.delete('/preferred-addresses/:id', { preHandler: requireUser }, async (request, reply) => {
    await softDeletePreferredAddressSet(request.user.id, (request.params as { id: string }).id);
    return reply.status(204).send();
  });
}
