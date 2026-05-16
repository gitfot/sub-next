import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('auth routes', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  it('registers and logs in a user', async () => {
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
  });
});
