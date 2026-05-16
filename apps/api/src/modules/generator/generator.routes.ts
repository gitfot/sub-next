import type { FastifyInstance } from 'fastify';
import { previewRequestSchema } from '@cloudflaresub/shared';
import { requireUser } from '../../plugins/require-user.js';
import { previewSubscription } from './generator.service.js';

export async function generatorRoutes(app: FastifyInstance) {
  app.post('/preview', { preHandler: requireUser }, async (request) => {
    const input = previewRequestSchema.parse(request.body);
    return previewSubscription({
      nodeLinksInput: input.nodeLinksInput,
      preferredAddressesInput: input.preferredAddressesInput,
      keepOriginalHost: input.keepOriginalHost,
      ...(input.namePrefix ? { namePrefix: input.namePrefix } : {}),
    });
  });
}
