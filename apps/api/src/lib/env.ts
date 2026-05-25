import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';

const DEFAULT_PUBLIC_BASE_URL = 'http://localhost:4000';
const DEFAULT_API_BASE_URL = 'http://localhost:4000';
const DEFAULT_DATABASE_HOST = 'localhost';
const DEFAULT_DATABASE_PORT = 5432;
const DEFAULT_DATABASE_NAME = 'sub_next';
const DEFAULT_DATABASE_USER = 'postgres';
const DEFAULT_DATABASE_PASSWORD = 'postgres';

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
const optionalString = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}, z.string().optional());
const optionalDatabaseUrl = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}, z.string().min(1).optional());
const optionalUrl = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}, z.string().url().optional());
const optionalPositiveInt = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}, z.coerce.number().int().positive().optional());

const envSchema = z.object({
  DATABASE_HOST: optionalString,
  DATABASE_PORT: optionalPositiveInt,
  DATABASE_NAME: optionalString,
  DATABASE_USER: optionalString,
  DATABASE_PASSWORD: optionalString,
  DATABASE_URL: optionalDatabaseUrl,
  JWT_ACCESS_SECRET: z.string().min(32).default(TEST_ACCESS_SECRET),
  JWT_REFRESH_SECRET: z.string().min(32).default(TEST_REFRESH_SECRET),
  ADMIN_PASSWORD: z.string().min(8).default('admin123'),
  PUBLIC_BASE_URL: z.string().url().default(DEFAULT_PUBLIC_BASE_URL),
  API_BASE_URL: optionalUrl,
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_TIME_WINDOW: z.string().min(1).default('1 minute'),
});

type RawEnv = z.infer<typeof envSchema>;

export interface AppEnv extends Omit<RawEnv, 'DATABASE_URL' | 'DATABASE_HOST' | 'DATABASE_PORT' | 'DATABASE_NAME' | 'DATABASE_USER' | 'DATABASE_PASSWORD'> {
  DATABASE_HOST: string;
  DATABASE_PORT: number;
  DATABASE_NAME: string;
  DATABASE_USER: string;
  DATABASE_PASSWORD: string;
  DATABASE_URL: string;
}

let cachedEnv: AppEnv | undefined;

function hasProvidedValue(value: string | number | undefined) {
  return value !== undefined;
}

function buildDatabaseUrl({
  host,
  port,
  name,
  user,
  password,
}: {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
}) {
  const databaseUrl = new URL('postgresql://localhost');
  databaseUrl.hostname = host;
  databaseUrl.port = String(port);
  databaseUrl.pathname = `/${name}`;
  databaseUrl.username = user;
  databaseUrl.password = password;
  return databaseUrl.toString();
}

function resolveDatabaseEnv(rawEnv: RawEnv): Pick<
  AppEnv,
  'DATABASE_HOST' | 'DATABASE_PORT' | 'DATABASE_NAME' | 'DATABASE_USER' | 'DATABASE_PASSWORD' | 'DATABASE_URL'
> {
  const hasAnySplitDatabaseSetting = [
    rawEnv.DATABASE_HOST,
    rawEnv.DATABASE_PORT,
    rawEnv.DATABASE_NAME,
    rawEnv.DATABASE_USER,
    rawEnv.DATABASE_PASSWORD,
  ].some((value) => hasProvidedValue(value));

  const databaseEnv = {
    DATABASE_HOST: rawEnv.DATABASE_HOST ?? DEFAULT_DATABASE_HOST,
    DATABASE_PORT: rawEnv.DATABASE_PORT ?? DEFAULT_DATABASE_PORT,
    DATABASE_NAME: rawEnv.DATABASE_NAME ?? DEFAULT_DATABASE_NAME,
    DATABASE_USER: rawEnv.DATABASE_USER ?? DEFAULT_DATABASE_USER,
    DATABASE_PASSWORD: rawEnv.DATABASE_PASSWORD ?? DEFAULT_DATABASE_PASSWORD,
  };

  return {
    ...databaseEnv,
    DATABASE_URL:
      hasAnySplitDatabaseSetting || !rawEnv.DATABASE_URL
        ? buildDatabaseUrl({
            host: databaseEnv.DATABASE_HOST,
            port: databaseEnv.DATABASE_PORT,
            name: databaseEnv.DATABASE_NAME,
            user: databaseEnv.DATABASE_USER,
            password: databaseEnv.DATABASE_PASSWORD,
          })
        : rawEnv.DATABASE_URL,
  };
}

export function getEnv(): AppEnv {
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

    const parsedEnv = envSchema.parse(rawEnv);
    cachedEnv = {
      ...parsedEnv,
      ...resolveDatabaseEnv(parsedEnv),
    };

    process.env.DATABASE_HOST = cachedEnv.DATABASE_HOST;
    process.env.DATABASE_PORT = String(cachedEnv.DATABASE_PORT);
    process.env.DATABASE_NAME = cachedEnv.DATABASE_NAME;
    process.env.DATABASE_USER = cachedEnv.DATABASE_USER;
    process.env.DATABASE_PASSWORD = cachedEnv.DATABASE_PASSWORD;
    process.env.DATABASE_URL = cachedEnv.DATABASE_URL;
  }
  return cachedEnv;
}

export function getApiBaseUrl(env = getEnv()) {
  return env.API_BASE_URL ?? DEFAULT_API_BASE_URL;
}
