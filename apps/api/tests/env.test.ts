import { afterEach, describe, expect, it, vi } from 'vitest';

describe('env helpers', () => {
  afterEach(() => {
    delete process.env.DATABASE_HOST;
    delete process.env.DATABASE_PORT;
    delete process.env.DATABASE_NAME;
    delete process.env.DATABASE_USER;
    delete process.env.DATABASE_PASSWORD;
    delete process.env.DATABASE_URL;
    delete process.env.API_BASE_URL;
    vi.resetModules();
  });

  it('derives DATABASE_URL from split database settings', async () => {
    process.env.DATABASE_HOST = 'postgres';
    process.env.DATABASE_PORT = '5432';
    process.env.DATABASE_NAME = 'sub_next';
    process.env.DATABASE_USER = 'postgres';
    process.env.DATABASE_PASSWORD = 'postgres';

    const { getEnv } = await import('../src/lib/env.js');

    expect(getEnv().DATABASE_URL).toBe('postgresql://postgres:postgres@postgres:5432/sub_next');
  });

  it('falls back to an explicit DATABASE_URL when split database settings are absent', async () => {
    process.env.DATABASE_URL = 'postgresql://demo:secret@db.internal:5433/demo_db';

    const { getEnv } = await import('../src/lib/env.js');

    expect(getEnv().DATABASE_URL).toBe('postgresql://demo:secret@db.internal:5433/demo_db');
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
