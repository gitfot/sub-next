import { describe, expect, it } from 'vitest';
import { previewRequestSchema } from './generator.schema.js';

describe('generator schema', () => {
  it('defaults keepOriginalHost to true', () => {
    const payload = previewRequestSchema.parse({
      nodeLinksInput: 'vmess://demo',
      preferredAddressesInput: '104.16.1.2#HK',
    });

    expect(payload.keepOriginalHost).toBe(true);
  });
});
