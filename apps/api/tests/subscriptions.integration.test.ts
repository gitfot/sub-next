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
  it('returns list and detail dto fields for subscription management', async () => {
    const app = buildApp();
    await app.ready();
    const { accessToken } = await createUserAndLogin(app.server);
    const nodeLinkSetIds = [crypto.randomUUID(), crypto.randomUUID()];
    const preferredAddressSetIds = [crypto.randomUUID(), crypto.randomUUID()];

    const previewResponse = await request(app.server)
      .post('/generator/preview')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        nodeLinksInput: SAMPLE_VMESS,
        preferredAddressesInput: '104.16.1.2#HK',
        namePrefix: 'CF',
        keepOriginalHost: true,
      });

    const publishResponse = await request(app.server)
      .post('/subscriptions')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        nodeLinkSetIds,
        preferredAddressSetIds,
        nodeLinksInput: SAMPLE_VMESS,
        preferredAddressesInput: '104.16.1.2#HK',
        namePrefix: 'CF',
        keepOriginalHost: true,
        previewNodes: previewResponse.body.nodes,
        remark: '测试订阅',
        expiresAt: '2030-01-01T00:00:00.000Z',
        subscriptionType: 'clash',
      });

    const listResponse = await request(app.server)
      .get('/subscriptions')
      .set('authorization', `Bearer ${accessToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items[0]).toMatchObject({
      id: publishResponse.body.subscription.id,
      remark: '测试订阅',
      subscriptionType: 'clash',
      status: 'active',
    });
    expect(listResponse.body.items[0].publicUrl).toContain('/subscriptions/public/');

    const detailResponse = await request(app.server)
      .get(`/subscriptions/${publishResponse.body.subscription.id}`)
      .set('authorization', `Bearer ${accessToken}`);

    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.subscription.publicUrl).toContain('/subscriptions/public/');
    expect(detailResponse.body.snapshot.nodeLinksInput).toContain('vmess://');
    expect(detailResponse.body.snapshot.previewNodes).toHaveLength(1);
    expect(detailResponse.body.snapshot.nodeLinkSetIds).toEqual(nodeLinkSetIds);
    expect(detailResponse.body.snapshot.preferredAddressSetIds).toEqual(preferredAddressSetIds);
  });

  it('previews nodes, publishes a subscription, serves it publicly, and restores input state', async () => {
    const app = buildApp();
    await app.ready();
    const { accessToken } = await createUserAndLogin(app.server);
    const nodeLinkSetIds = [crypto.randomUUID(), crypto.randomUUID()];
    const preferredAddressSetIds = [crypto.randomUUID()];

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
        nodeLinkSetIds,
        preferredAddressSetIds,
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
    expect(restoreResponse.body.nodeLinkSetIds).toEqual(nodeLinkSetIds);
    expect(restoreResponse.body.preferredAddressSetIds).toEqual(preferredAddressSetIds);
  });

  it('restores raw inputs but requires regenerate before republish', async () => {
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

    const publishResponse = await request(app.server)
      .post('/subscriptions')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        nodeLinksInput: SAMPLE_VMESS,
        preferredAddressesInput: '104.16.1.2#HK',
        keepOriginalHost: true,
        previewNodes: previewResponse.body.nodes,
        remark: '恢复测试',
        expiresAt: '2030-01-01T00:00:00.000Z',
        subscriptionType: 'clash',
      });

    const restoreResponse = await request(app.server)
      .post(`/subscriptions/${publishResponse.body.subscription.id}/restore`)
      .set('authorization', `Bearer ${accessToken}`);

    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body.nodeLinksInput).toContain('vmess://');
    expect(restoreResponse.body.previewNodes).toBeUndefined();
    expect(restoreResponse.body.requiresRegenerate).toBe(true);
  });

  it('soft-deletes subscriptions from the management list', async () => {
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

    const deleteResponse = await request(app.server)
      .delete(`/subscriptions/${publishResponse.body.subscription.id}`)
      .set('authorization', `Bearer ${accessToken}`);

    expect(deleteResponse.status).toBe(204);

    const listAfterDelete = await request(app.server)
      .get('/subscriptions')
      .set('authorization', `Bearer ${accessToken}`);

    expect(listAfterDelete.body.items).toHaveLength(0);
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
