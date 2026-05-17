import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

const SAMPLE_VMESS =
  'vmess://ewogICJ2IjogIjIiLAogICJwcyI6ICJkZW1vLXdzLXRscyIsCiAgImFkZCI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAicG9ydCI6ICI0NDMiLAogICJpZCI6ICIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLAogICJzY3kiOiAiYXV0byIsCiAgIm5ldCI6ICJ3cyIsCiAgInRscyI6ICJ0bHMiLAogICJwYXRoIjogIi93cyIsCiAgImhvc3QiOiAiZWRnZS5leGFtcGxlLmNvbSIsCiAgInNuaSI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAiZnAiOiAiY2hyb21lIiwKICAiYWxwbiI6ICJoMixodHRwLzEuMSIKfQ==';

async function createUserAndLogin(server: Parameters<typeof request>[0]) {
  const email = `subuser-${crypto.randomUUID()}@example.com`;
  const reg = await request(server)
    .post('/auth/register')
    .send({ email, password: 'strong-password' });
  return { accessToken: reg.body.tokens.accessToken as string };
}

describe('preview and subscriptions', () => {
  it('previews nodes, publishes a subscription, serves it publicly, and restores input state', async () => {
    const app = buildApp();
    await app.ready();
    const { accessToken } = await createUserAndLogin(app.server);

    const previewResponse = await request(app.server)
      .post('/generator/preview')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        nodeLinksInput: SAMPLE_VMESS,
        preferredAddressesInput: '104.16.1.2#HK',
        namePrefix: 'CF',
        keepOriginalHost: true,
      });

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.body.nodes).toHaveLength(1);

    const publishResponse = await request(app.server)
      .post('/subscriptions')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        nodeLinksInput: SAMPLE_VMESS,
        preferredAddressesInput: '104.16.1.2#HK',
        namePrefix: 'CF',
        keepOriginalHost: true,
        previewNodes: previewResponse.body.nodes,
        remark: '测试订阅',
        expiresAt: '2030-01-01T00:00:00.000Z',
        subscriptionType: 'clash',
      });

    expect(publishResponse.status).toBe(201);
    expect(publishResponse.body.publicUrl).toContain('/subscriptions/public/');

    const publicResponse = await request(app.server).get(
      `/subscriptions/public/${publishResponse.body.publicToken}`,
    );
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.text).toContain('proxies:');

    const restoreResponse = await request(app.server)
      .post(`/subscriptions/${publishResponse.body.subscription.id}/restore`)
      .set('authorization', `Bearer ${accessToken}`);

    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body.nodeLinksInput).toContain('vmess://');
  });

  it('publishes a subscription when remark is omitted', async () => {
    const app = buildApp();
    await app.ready();
    const { accessToken } = await createUserAndLogin(app.server);

    const previewResponse = await request(app.server)
      .post('/generator/preview')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        nodeLinksInput: SAMPLE_VMESS,
        preferredAddressesInput: '104.16.1.2#HK',
        keepOriginalHost: true,
      });

    expect(previewResponse.status).toBe(200);

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
    expect(publishResponse.body.subscription.remark).toBe('');
  });

  it('allows the built-in admin account to publish a subscription', async () => {
    const app = buildApp();
    await app.ready();

    const loginResponse = await request(app.server)
      .post('/auth/login')
      .send({
        account: 'admin',
        password: 'admin123',
      });

    expect(loginResponse.status).toBe(200);

    const accessToken = loginResponse.body.tokens.accessToken as string;
    const previewResponse = await request(app.server)
      .post('/generator/preview')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        nodeLinksInput: SAMPLE_VMESS,
        preferredAddressesInput: '104.16.1.2#HK',
        keepOriginalHost: true,
      });

    expect(previewResponse.status).toBe(200);

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
    expect(publishResponse.body.subscription.userId).toBe('builtin-admin');
  });
});
