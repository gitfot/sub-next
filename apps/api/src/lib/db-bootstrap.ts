import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { getEnv } from './env.js';

const REQUIRED_TABLES = [
  'User',
  'UserSession',
  'NodeLinkSet',
  'PreferredAddressSet',
  'Subscription',
  'SubscriptionSnapshot',
] as const;

const require = createRequire(import.meta.url);
const repoRootPath = fileURLToPath(new URL('../../../../', import.meta.url));
const prismaSchemaPath = fileURLToPath(new URL('../../../../prisma/schema.prisma', import.meta.url));
const prismaCliPath = require.resolve('prisma/build/index.js');

export interface DatabaseSchemaBootstrapDeps {
  isTestRuntime: boolean;
  databaseUrl: string;
  listMissingTables: () => Promise<string[]>;
  pushSchema: () => Promise<void>;
  log: (message: string) => void;
}

export async function ensureDatabaseSchema(overrides: Partial<DatabaseSchemaBootstrapDeps> = {}) {
  const deps = createBootstrapDeps(overrides);

  if (deps.isTestRuntime) {
    return;
  }

  const missingTables = await deps.listMissingTables();
  if (!missingTables.length) {
    deps.log(`Database schema check passed for ${formatDatabaseTarget(deps.databaseUrl)}.`);
    return;
  }

  deps.log(
    `Missing Prisma tables in ${formatDatabaseTarget(deps.databaseUrl)}: ${missingTables.join(', ')}. Running prisma db push...`,
  );
  await deps.pushSchema();

  const remainingTables = await deps.listMissingTables();
  if (remainingTables.length) {
    throw new Error(
      `Database schema bootstrap failed for ${formatDatabaseTarget(deps.databaseUrl)}. Missing tables after sync: ${remainingTables.join(', ')}`,
    );
  }

  deps.log(`Database schema synchronized for ${formatDatabaseTarget(deps.databaseUrl)}.`);
}

function createBootstrapDeps(overrides: Partial<DatabaseSchemaBootstrapDeps>): DatabaseSchemaBootstrapDeps {
  const env = getEnv();

  return {
    isTestRuntime: Boolean(process.env.VITEST || process.env.NODE_ENV === 'test'),
    databaseUrl: env.DATABASE_URL,
    listMissingTables: listMissingTablesFromDatabase,
    pushSchema: runPrismaDbPush,
    log: console.log,
    ...overrides,
  };
}

async function listMissingTablesFromDatabase() {
  const prisma = new PrismaClient();

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN (${REQUIRED_TABLES.map((name) => `'${name}'`).join(', ')})`,
    );
    const existingTables = new Set(rows.map((row) => row.table_name));
    return REQUIRED_TABLES.filter((name) => !existingTables.has(name));
  } finally {
    await prisma.$disconnect();
  }
}

async function runPrismaDbPush() {
  await runCommand(process.execPath, [
    prismaCliPath,
    'db',
    'push',
    '--accept-data-loss',
    '--skip-generate',
    '--schema',
    prismaSchemaPath,
  ]);
}

async function runCommand(command: string, args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRootPath,
      env: process.env,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(
        `Command failed: ${command} ${args.join(' ')}\n${[stdout.trim(), stderr.trim()].filter(Boolean).join('\n')}`,
      ));
    });
  });
}

function formatDatabaseTarget(databaseUrl: string) {
  try {
    const url = new URL(databaseUrl);
    const databaseName = url.pathname.replace(/^\//, '') || '(unknown-db)';
    return `${url.hostname}:${url.port || '5432'}/${databaseName}`;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}
