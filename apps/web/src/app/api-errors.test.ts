import { describe, expect, it } from 'vitest';
import { getResponseErrorMessage } from './api-errors.js';

describe('api error helpers', () => {
  it('formats rate-limit errors with retry seconds', async () => {
    const response = new Response(JSON.stringify({ message: 'Rate limit exceeded, retry in 32 seconds' }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });

    await expect(getResponseErrorMessage(response, '请求失败')).resolves.toBe('请求过于频繁，请 32 秒后再试');
  });

  it('falls back to a generic rate-limit message when retry seconds are missing', async () => {
    const response = new Response(JSON.stringify({ message: 'Rate limit exceeded' }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });

    await expect(getResponseErrorMessage(response, '请求失败')).resolves.toBe('请求过于频繁，请稍后再试');
  });
});
