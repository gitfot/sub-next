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
