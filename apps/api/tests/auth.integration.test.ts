import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

describe('auth routes', () => {
  afterEach(() => {
    delete process.env.ADMIN_PASSWORD;
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

  it('registers and logs in a user', async () => {
    const app = await buildFreshApp();

    const registerResponse = await request(app.server)
      .post('/auth/register')
      .send({
        email: 'demo@example.com',
        username: 'demo_user',
        password: 'strong-password',
      });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.email).toBe('demo@example.com');
    expect(registerResponse.body.tokens.accessToken).toBeTypeOf('string');

    const loginResponse = await request(app.server)
      .post('/auth/login')
      .send({
        account: 'demo@example.com',
        password: 'strong-password',
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.tokens.refreshToken).toBeTypeOf('string');

    await closeApp(app);
  });

  it('allows the built-in admin account with the default password', async () => {
    const app = await buildFreshApp();

    const loginResponse = await request(app.server)
      .post('/auth/login')
      .send({
        account: 'admin',
        password: 'admin123',
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user.username).toBe('admin');
    expect(loginResponse.body.tokens.accessToken).toBeTypeOf('string');

    await closeApp(app);
  });

  it('uses ADMIN_PASSWORD from env for the built-in admin account', async () => {
    process.env.ADMIN_PASSWORD = 'override-pass-123';
    const app = await buildFreshApp();

    const invalidResponse = await request(app.server)
      .post('/auth/login')
      .send({
        account: 'admin',
        password: 'admin123',
      });

    expect(invalidResponse.status).toBe(401);

    const validResponse = await request(app.server)
      .post('/auth/login')
      .send({
        account: 'admin',
        password: 'override-pass-123',
      });

    expect(validResponse.status).toBe(200);
    expect(validResponse.body.user.username).toBe('admin');

    await closeApp(app);
  });
});
