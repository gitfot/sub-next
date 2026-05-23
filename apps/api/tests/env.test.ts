import { afterEach, describe, expect, it, vi } from 'vitest';

describe('env helpers', () => {
  afterEach(() => {
    delete process.env.API_BASE_URL;
    vi.resetModules();
  });

  it('falls back to the local api base url when API_BASE_URL is absent', async () => {
    const { getApiBaseUrl } = await import('../src/lib/env.js');

    expect(getApiBaseUrl()).toBe('http://localhost:4000');
  });

  it('falls back to the local api base url when API_BASE_URL is blank', async () => {
    process.env.API_BASE_URL = '';

    const { getApiBaseUrl } = await import('../src/lib/env.js');

    expect(getApiBaseUrl()).toBe('http://localhost:4000');
  });
});
