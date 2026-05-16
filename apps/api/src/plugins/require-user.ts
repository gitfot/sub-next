import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../lib/auth.js';
import { getEnv } from '../lib/env.js';

export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.status(401).send({ message: 'Unauthorized' });
  }

  try {
    const payload = await verifyAccessToken(header.slice(7), getEnv().JWT_ACCESS_SECRET);
    request.user = { id: payload.sub };
  } catch {
    return reply.status(401).send({ message: 'Unauthorized' });
  }
}
