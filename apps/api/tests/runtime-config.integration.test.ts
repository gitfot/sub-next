import crypto from 'node:crypto';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

const SAMPLE_VMESS =
  'vmess://ewogICJ2IjogIjIiLAogICJwcyI6ICJkZW1vLXdzLXRscyIsCiAgImFkZCI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAicG9ydCI6ICI0NDMiLAogICJpZCI6ICIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLAogICJzY3kiOiAiYXV0byIsCiAgIm5ldCI6ICJ3cyIsCiAgInRscyI6ICJ0bHMiLAogICJwYXRoIjogIi93cyIsCiAgImhvc3QiOiAiZWRnZS5leGFtcGxlLmNvbSIsCiAgInNuaSI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAiZnAiOiAiY2hyb21lIiwKICAiYWxwbiI6ICJoMixodHRwLzEuMSIKfQ==';

describe('runtime config', () => {
  afterEach(() => {
    delete process.env.API_BASE_URL;
    delete process.env.PUBLIC_BASE_URL;
    vi.resetModules();
  });

  async function buildFreshApp() {
    const { buildApp } = await import('../src/app.js');
    const app = buildApp();
    await app.ready();
    return app;
  }

  async function closeApp(app: FastifyInstance) {
    await app.close();
  }

  async function createUserAndLogin(server: Parameters<typeof request>[0]) {
    const email = `runtime-${crypto.randomUUID()}@example.com`;
    const registration = await request(server)
      .post('/auth/register')
      .send({ email, password: 'strong-password' });

    return { accessToken: registration.body.tokens.accessToken as string };
  }

  it('allows cross-origin preflight requests from any origin', async () => {
    const app = await buildFreshApp();

    const response = await request(app.server)
      .options('/auth/login')
      .set('origin', 'https://public.example.com')
      .set('access-control-request-method', 'POST');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://public.example.com');

    await closeApp(app);
  });

  it('builds public subscription urls from PUBLIC_BASE_URL when API_BASE_URL is unset', async () => {
    process.env.PUBLIC_BASE_URL = 'https://public.example.com';
    const app = await buildFreshApp();
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

    expect(publishResponse.status).toBe(201);
    expect(publishResponse.body.publicUrl).toBe(
      `https://public.example.com/subscriptions/public/${publishResponse.body.publicToken}`,
    );

    await closeApp(app);
  });
});
