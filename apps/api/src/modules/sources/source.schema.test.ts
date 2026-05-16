import { describe, expect, it } from 'vitest';
import { datasetSchema } from './source.schema.js';

describe('source schema', () => {
  it('accepts a dataset payload with optional description', () => {
    const payload = datasetSchema.parse({
      name: 'My node links',
      description: 'Imported from clipboard',
      content: 'vmess://demo',
    });

    expect(payload.name).toBe('My node links');
  });

  it('rejects an empty content field', () => {
    expect(() =>
      datasetSchema.parse({
        name: 'Broken dataset',
        content: '',
      }),
    ).toThrow();
  });
});
