import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

async function createTwoUsers(server: Parameters<typeof request>[0]) {
  const regA = await request(server)
    .post('/auth/register')
    .send({ email: 'userA@example.com', password: 'password-a-long' });
  const regB = await request(server)
    .post('/auth/register')
    .send({ email: 'userB@example.com', password: 'password-b-long' });
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
});
