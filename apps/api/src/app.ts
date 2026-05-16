import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { getEnv } from './lib/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';

export function buildApp() {
  const env = getEnv();
  const app = Fastify({ logger: false });

  app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });

  app.register(rateLimit, {
    max: 10,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
    allowList: [],
  });

  app.register(authRoutes, { prefix: '/auth' });
  return app;
}
