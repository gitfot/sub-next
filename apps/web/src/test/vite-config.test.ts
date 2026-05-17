import { describe, expect, it } from 'vitest';
import { createApiProxy, getApiProxyTarget, rewriteApiPath } from '../../vite.config.js';

describe('vite api proxy config', () => {
  it('falls back to the local api server when API_BASE_URL is absent', () => {
    expect(getApiProxyTarget()).toBe('http://localhost:4000');
  });

  it('rewrites /api requests to backend route paths', () => {
    expect(rewriteApiPath('/api/auth/login')).toBe('/auth/login');
    expect(rewriteApiPath('/api/subscriptions')).toBe('/subscriptions');
  });

  it('creates a dev proxy for api requests', () => {
    const proxy = createApiProxy('http://localhost:4100');

    expect(proxy['/api'].target).toBe('http://localhost:4100');
    expect(proxy['/api'].rewrite('/api/generator/preview')).toBe('/generator/preview');
  });
});
