import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';

const DEFAULT_PUBLIC_BASE_URL = 'http://localhost:4000';
const DEFAULT_API_BASE_URL = 'http://localhost:4000';

function findEnvFile() {
  let currentDir = process.cwd();

  for (;;) {
    const candidate = resolve(currentDir, '.env');
    if (existsSync(candidate)) {
      return candidate;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

const envFile = findEnvFile();
if (envFile) {
  config({ path: envFile, quiet: true });
}

const TEST_ACCESS_SECRET = 'test-access-secret-12345678901234567890';
const TEST_REFRESH_SECRET = 'test-refresh-secret-1234567890123456789';
const optionalUrl = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}, z.string().url().optional());

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost:5432/sub_next'),
  JWT_ACCESS_SECRET: z.string().min(32).default(TEST_ACCESS_SECRET),
  JWT_REFRESH_SECRET: z.string().min(32).default(TEST_REFRESH_SECRET),
  ADMIN_PASSWORD: z.string().min(8).default('admin123'),
  PUBLIC_BASE_URL: z.string().url().default(DEFAULT_PUBLIC_BASE_URL),
  API_BASE_URL: optionalUrl,
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_TIME_WINDOW: z.string().min(1).default('1 minute'),
});

let cachedEnv: z.infer<typeof envSchema> | undefined;

export function getEnv() {
  if (!cachedEnv) {
    const rawEnv = { ...process.env };

    if (process.env.VITEST || process.env.NODE_ENV === 'test') {
      if (!rawEnv.JWT_ACCESS_SECRET || rawEnv.JWT_ACCESS_SECRET.length < 32) {
        rawEnv.JWT_ACCESS_SECRET = TEST_ACCESS_SECRET;
      }
      if (!rawEnv.JWT_REFRESH_SECRET || rawEnv.JWT_REFRESH_SECRET.length < 32) {
        rawEnv.JWT_REFRESH_SECRET = TEST_REFRESH_SECRET;
      }
    }

    cachedEnv = envSchema.parse(rawEnv);
  }
  return cachedEnv;
}

export function getApiBaseUrl(env = getEnv()) {
  return env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
}
