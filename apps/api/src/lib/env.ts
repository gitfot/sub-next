import { z } from 'zod';

const TEST_ACCESS_SECRET = 'test-access-secret-12345678901234567890';
const TEST_REFRESH_SECRET = 'test-refresh-secret-1234567890123456789';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost:5432/sub_next'),
  JWT_ACCESS_SECRET: z.string().min(32).default(TEST_ACCESS_SECRET),
  JWT_REFRESH_SECRET: z.string().min(32).default(TEST_REFRESH_SECRET),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
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
