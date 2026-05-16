import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default('postgresql://postgres:postgres@localhost:5432/cloudflaresub_next'),
  JWT_ACCESS_SECRET: z.string().min(32).default('test-access-secret-12345678901234567890'),
  JWT_REFRESH_SECRET: z.string().min(32).default('test-refresh-secret-1234567890123456789'),
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
});

let cachedEnv: z.infer<typeof envSchema> | undefined;

export function getEnv() {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
}
