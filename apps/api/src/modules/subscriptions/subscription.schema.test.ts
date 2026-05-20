import { describe, expect, it } from 'vitest';
import { publishSubscriptionSchema, subscriptionTargets } from './subscription.schema.js';

describe('subscription schema', () => {
  it('accepts a valid publish payload', () => {
    const payload = publishSubscriptionSchema.parse({
      nodeLinkSetIds: ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'],
      preferredAddressSetIds: ['33333333-3333-4333-8333-333333333333'],
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
    expect(payload.nodeLinkSetIds).toHaveLength(2);
  });

  it('accepts an empty or missing remark', () => {
    const withEmptyRemark = publishSubscriptionSchema.parse({
      nodeLinksInput: 'vmess://demo',
      preferredAddressesInput: '104.16.1.2#HK',
      keepOriginalHost: true,
      previewNodes: [{ name: 'demo' }],
      remark: '',
      expiresAt: '2026-06-15T00:00:00.000Z',
      subscriptionType: 'clash',
    });

    const withoutRemark = publishSubscriptionSchema.parse({
      nodeLinksInput: 'vmess://demo',
      preferredAddressesInput: '104.16.1.2#HK',
      keepOriginalHost: true,
      previewNodes: [{ name: 'demo' }],
      expiresAt: '2026-06-15T00:00:00.000Z',
      subscriptionType: 'clash',
    });

    expect(withEmptyRemark.remark).toBe('');
    expect(withoutRemark.remark).toBe('');
  });
});
