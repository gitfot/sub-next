import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_API_BASE_URL = 'http://localhost:4000';
const configDir = import.meta.url.startsWith('file:')
  ? dirname(fileURLToPath(import.meta.url))
  : process.cwd();
const rootEnvDir = resolve(configDir, '../..');

export function getApiProxyTarget(apiBaseUrl?: string) {
  return apiBaseUrl || DEFAULT_API_BASE_URL;
}

export function rewriteApiPath(path: string) {
  return path.replace(/^\/api/, '');
}

export function createApiProxy(apiBaseUrl?: string) {
  return {
    '/api': {
      target: getApiProxyTarget(apiBaseUrl),
      changeOrigin: true,
      rewrite: rewriteApiPath,
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootEnvDir, '');

  return {
    envDir: '../..',
    plugins: [react()],
    server: {
      proxy: createApiProxy(env.API_BASE_URL),
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      testTimeout: 15000,
      pool: 'vmThreads',
      fileParallelism: false,
      maxWorkers: 1,
    },
  };
});
