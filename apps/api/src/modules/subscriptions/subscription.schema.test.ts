import { describe, expect, it } from 'vitest';
import { publishSubscriptionSchema, subscriptionTargets } from './subscription.schema.js';

describe('subscription schema', () => {
  it('accepts a valid publish payload', () => {
    const payload = publishSubscriptionSchema.parse({
      nodeLinksInput: 'vmess://demo',
      preferredAddressesInput: '104.16.1.2#HK',
      keepOriginalHost: true,
      previewNodes: [{ name: 'demo' }],
      remark: 'daily',
      expiresAt: '2026-06-15T00:00:00.000Z',
      subscriptionType: 'clash',
    });

    expect(payload.subscriptionType).toBe('clash');
    expect(subscriptionTargets).toContain('surge');
  });
});
