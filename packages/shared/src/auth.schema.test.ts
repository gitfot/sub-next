import { describe, expect, it } from 'vitest';
import { registerSchema } from './auth.schema.js';

describe('registerSchema', () => {
  it('accepts a valid self-service registration payload', () => {
    const payload = registerSchema.parse({
      email: 'demo@example.com',
      username: 'demo_user',
      password: 'strong-password',
    });

    expect(payload.email).toBe('demo@example.com');
  });
});
