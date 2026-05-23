import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import { getEnv } from './lib/env.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { generatorRoutes } from './modules/generator/generator.routes.js';
import { sourceRoutes } from './modules/sources/source.routes.js';
import { subscriptionRoutes } from './modules/subscriptions/subscription.routes.js';

export function buildApp() {
  const env = getEnv();
  const app = Fastify({ logger: false });
  const webDistDir = resolve(process.cwd(), 'apps/web/dist');
  const webIndexFile = resolve(webDistDir, 'index.html');
  const hasWebBuild = existsSync(webIndexFile);

  app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });

  app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_TIME_WINDOW,
    keyGenerator: (request) => request.ip,
    allowList: [],
  });

  for (const prefix of ['', '/api'] as const) {
    app.register(authRoutes, { prefix: `${prefix}/auth` });
    app.register(sourceRoutes, { prefix: `${prefix}/sources` });
    app.register(generatorRoutes, { prefix: `${prefix}/generator` });
    app.register(subscriptionRoutes, { prefix: `${prefix}/subscriptions` });
  }

  if (hasWebBuild) {
    app.register(fastifyStatic, {
      root: webDistDir,
      wildcard: false,
      maxAge: '30d',
      immutable: true,
    });
  }

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({ message: 'Not Found' });
    }

    if (hasWebBuild) {
      return reply.type('text/html; charset=utf-8').sendFile('index.html', { maxAge: 0, immutable: false });
    }

    return reply.status(404).send({ message: 'Not Found' });
  });

  return app;
}
