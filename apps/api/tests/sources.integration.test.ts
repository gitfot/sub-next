import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

async function createTwoUsers(server: Parameters<typeof request>[0]) {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const regA = await request(server)
    .post('/auth/register')
    .send({ email: `userA-${unique}@example.com`, password: 'password-a-long' });
  const regB = await request(server)
    .post('/auth/register')
    .send({ email: `userB-${unique}@example.com`, password: 'password-b-long' });
  return {
    tokenA: regA.body.tokens.accessToken as string,
    tokenB: regB.body.tokens.accessToken as string,
  };
}

describe('source datasets', () => {
  it('isolates datasets by authenticated user', async () => {
    const app = buildApp();
    await app.ready();

    const { tokenA, tokenB } = await createTwoUsers(app.server);

    const createResponse = await request(app.server)
      .post('/sources/node-links')
      .set('authorization', `Bearer ${tokenA}`)
      .send({
        name: '机场A',
        content: 'vmess://demo',
      });

    expect(createResponse.status).toBe(201);

    const listA = await request(app.server)
      .get('/sources/node-links')
      .set('authorization', `Bearer ${tokenA}`);
    const listB = await request(app.server)
      .get('/sources/node-links')
      .set('authorization', `Bearer ${tokenB}`);

    expect(listA.body.items).toHaveLength(1);
    expect(listB.body.items).toHaveLength(0);
  });

  it('updates and soft-deletes datasets for the owning user only', async () => {
    const app = buildApp();
    await app.ready();

    const { tokenA, tokenB } = await createTwoUsers(app.server);

    const nodeLinkCreate = await request(app.server)
      .post('/sources/node-links')
      .set('authorization', `Bearer ${tokenA}`)
      .send({
        name: '旧节点集',
        description: '待更新',
        content: 'vmess://before',
      });

    const preferredCreate = await request(app.server)
      .post('/sources/preferred-addresses')
      .set('authorization', `Bearer ${tokenA}`)
      .send({
        name: '旧优选',
        content: '104.16.1.2#HK',
      });

    const patchForbidden = await request(app.server)
      .patch(`/sources/node-links/${nodeLinkCreate.body.id}`)
      .set('authorization', `Bearer ${tokenB}`)
      .send({
        name: '越权更新',
        content: 'vmess://forbidden',
      });

    expect(patchForbidden.status).toBe(404);

    const patchNodeLinks = await request(app.server)
      .patch(`/sources/node-links/${nodeLinkCreate.body.id}`)
      .set('authorization', `Bearer ${tokenA}`)
      .send({
        name: '新节点集',
        description: '已更新',
        content: 'vmess://after',
      });

    expect(patchNodeLinks.status).toBe(200);
    expect(patchNodeLinks.body.name).toBe('新节点集');
    expect(patchNodeLinks.body.content).toBe('vmess://after');

    const patchPreferred = await request(app.server)
      .patch(`/sources/preferred-addresses/${preferredCreate.body.id}`)
      .set('authorization', `Bearer ${tokenA}`)
      .send({
        name: '新优选',
        description: 'Cloudflare',
        content: '104.17.2.3:2053#US',
      });

    expect(patchPreferred.status).toBe(200);
    expect(patchPreferred.body.name).toBe('新优选');

    const deleteResponse = await request(app.server)
      .delete(`/sources/node-links/${nodeLinkCreate.body.id}`)
      .set('authorization', `Bearer ${tokenA}`);

    expect(deleteResponse.status).toBe(204);

    const listAfterDelete = await request(app.server)
      .get('/sources/node-links')
      .set('authorization', `Bearer ${tokenA}`);

    expect(listAfterDelete.body.items).toHaveLength(0);
  });
});
