import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from './api-client.js';
import { saveSession } from './auth-store.js';

describe('api client', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('does not set application/json automatically when the request body is empty', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      }),
    );

    await apiJson('/api/subscriptions/sub-1/restore', { method: 'POST' });

    const [, init] = fetchSpy.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.has('content-type')).toBe(false);
  });

  it('adds application/json and authorization when a json body is provided', async () => {
    saveSession({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        username: 'admin',
        email: 'admin@local.test',
      },
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      }),
    );

    await apiJson('/api/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ remark: 'demo' }),
    });

    const [, init] = fetchSpy.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('authorization')).toBe('Bearer access-token');
  });
});
