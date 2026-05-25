import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(import.meta.dirname, '..', '..', '..');
const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
const rootPackageJsonPath = path.join(rootDir, 'package.json');
const apiPackageJsonPath = path.join(rootDir, 'apps', 'api', 'package.json');
const apiDockerfilePath = path.join(rootDir, 'apps', 'api', 'Dockerfile');
const envExamplePath = path.join(rootDir, '.env.example');

function readPackageJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, 'utf8')) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
}

describe('Prisma workspace setup', () => {
  it('declares @prisma/client at the workspace root when the schema is stored there', () => {
    const schema = readFileSync(schemaPath, 'utf8');
    const rootPackageJson = readPackageJson(rootPackageJsonPath);
    const apiPackageJson = readPackageJson(apiPackageJsonPath);

    expect(schema).toContain('provider = "prisma-client-js"');
    expect(apiPackageJson.dependencies?.['@prisma/client']).toBeTruthy();
    expect(rootPackageJson.devDependencies?.['@prisma/client']).toBe(
      apiPackageJson.dependencies?.['@prisma/client'],
    );
  });

  it('runs prisma generate from the root postinstall hook', () => {
    const rootPackageJson = readPackageJson(rootPackageJsonPath);

    expect(rootPackageJson.scripts?.postinstall).toBe('node ./scripts/run-prisma.mjs generate');
    expect(rootPackageJson.scripts?.['db:generate']).toBe('node ./scripts/run-prisma.mjs generate');
    expect(rootPackageJson.scripts?.['db:push']).toBe('node ./scripts/run-prisma.mjs db push');
    expect(rootPackageJson.scripts?.['db:migrate']).toBe('node ./scripts/run-prisma.mjs migrate dev');
  });

  it('copies prisma helper scripts into the Docker deps stage before install runs', () => {
    const dockerfile = readFileSync(apiDockerfilePath, 'utf8');

    expect(dockerfile).toContain('COPY scripts scripts');
    expect(dockerfile.indexOf('COPY scripts scripts')).toBeLessThan(
      dockerfile.indexOf('RUN pnpm install --frozen-lockfile'),
    );
  });

  it('documents split database settings in the example env file', () => {
    const envExample = readFileSync(envExamplePath, 'utf8');

    expect(envExample).toContain('DATABASE_HOST=postgres');
    expect(envExample).toContain('DATABASE_PORT=5432');
    expect(envExample).toContain('DATABASE_NAME=sub_next');
    expect(envExample).toContain('DATABASE_USER=postgres');
    expect(envExample).toContain('DATABASE_PASSWORD=postgres');
    expect(envExample).not.toContain('DATABASE_URL=');
  });
});
