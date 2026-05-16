import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema } from './auth.schema.js';

describe('auth schema', () => {
  it('accepts a valid self-service registration payload', () => {
    const payload = registerSchema.parse({
      email: 'demo@example.com',
      username: 'demo_user',
      password: 'strong-password',
    });

    expect(payload.email).toBe('demo@example.com');
  });

  it('accepts a valid login payload', () => {
    const payload = loginSchema.parse({
      account: 'demo_user',
      password: 'strong-password',
    });

    expect(payload.account).toBe('demo_user');
  });
});
