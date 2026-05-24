import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRootPath = fileURLToPath(new URL('../', import.meta.url));
const prismaCliPath = resolve(repoRootPath, 'node_modules', 'prisma', 'build', 'index.js');
const envFilePath = resolve(repoRootPath, '.env');

const DEFAULT_DATABASE_HOST = 'localhost';
const DEFAULT_DATABASE_PORT = '5432';
const DEFAULT_DATABASE_NAME = 'sub_next';
const DEFAULT_DATABASE_USER = 'postgres';
const DEFAULT_DATABASE_PASSWORD = 'postgres';

loadEnvFile(envFilePath);

const env = { ...process.env };
env.DATABASE_URL = resolveDatabaseUrl(env);

const child = spawn(process.execPath, [prismaCliPath, ...process.argv.slice(2)], {
  cwd: repoRootPath,
  env,
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(error);
  process.exit(1);
});

child.on('close', (code) => {
  process.exit(code ?? 1);
});

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const envFile = readFileSync(filePath, 'utf8');

  for (const line of envFile.split(/\r?\n/u)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const normalizedLine = trimmedLine.startsWith('export ') ? trimmedLine.slice(7) : trimmedLine;
    const separatorIndex = normalizedLine.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    const value = normalizedLine.slice(separatorIndex + 1).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = stripWrappingQuotes(value);
  }
}

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function resolveDatabaseUrl(env) {
  const hasAnySplitDatabaseSetting = [
    env.DATABASE_HOST,
    env.DATABASE_PORT,
    env.DATABASE_NAME,
    env.DATABASE_USER,
    env.DATABASE_PASSWORD,
  ].some((value) => value !== undefined && value !== '');

  if (!hasAnySplitDatabaseSetting && env.DATABASE_URL) {
    return env.DATABASE_URL;
  }

  const databaseUrl = new URL('postgresql://localhost');
  databaseUrl.hostname = env.DATABASE_HOST || DEFAULT_DATABASE_HOST;
  databaseUrl.port = env.DATABASE_PORT || DEFAULT_DATABASE_PORT;
  databaseUrl.pathname = `/${env.DATABASE_NAME || DEFAULT_DATABASE_NAME}`;
  databaseUrl.username = env.DATABASE_USER || DEFAULT_DATABASE_USER;
  databaseUrl.password = env.DATABASE_PASSWORD || DEFAULT_DATABASE_PASSWORD;
  return databaseUrl.toString();
}
