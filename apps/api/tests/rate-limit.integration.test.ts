import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

describe('rate limit', () => {
  afterEach(() => {
    delete process.env.RATE_LIMIT_MAX;
    delete process.env.RATE_LIMIT_TIME_WINDOW;
  });

  async function buildFreshApp() {
    vi.resetModules();
    const { buildApp } = await import('../src/app.js');
    const app = buildApp();
    await app.ready();
    return app;
  }

  async function closeApp(app: FastifyInstance) {
    await app.close();
  }

  it('limits auth requests using the default settings', async () => {
    const app = await buildFreshApp();

    for (let index = 0; index < 10; index += 1) {
      const response = await request(app.server)
        .post('/auth/login')
        .send({
          account: 'admin',
          password: 'wrong-password',
        });

      expect(response.status).toBe(401);
    }

    const limitedResponse = await request(app.server)
      .post('/auth/login')
      .send({
        account: 'admin',
        password: 'wrong-password',
      });

    expect(limitedResponse.status).toBe(429);
    expect(String(limitedResponse.body.message)).toContain('Rate limit exceeded');

    await closeApp(app);
  });

  it('uses env overrides for rate-limit settings', async () => {
    process.env.RATE_LIMIT_MAX = '2';
    process.env.RATE_LIMIT_TIME_WINDOW = '1 minute';
    const app = await buildFreshApp();

    const firstResponse = await request(app.server)
      .post('/auth/login')
      .send({
        account: 'admin',
        password: 'wrong-password',
      });

    const secondResponse = await request(app.server)
      .post('/auth/login')
      .send({
        account: 'admin',
        password: 'wrong-password',
      });

    const limitedResponse = await request(app.server)
      .post('/auth/login')
      .send({
        account: 'admin',
        password: 'wrong-password',
      });

    expect(firstResponse.status).toBe(401);
    expect(secondResponse.status).toBe(401);
    expect(limitedResponse.status).toBe(429);

    await closeApp(app);
  });
});
