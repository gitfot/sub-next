import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(import.meta.dirname, '..', '..', '..');
const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
const rootPackageJsonPath = path.join(rootDir, 'package.json');
const apiPackageJsonPath = path.join(rootDir, 'apps', 'api', 'package.json');

function readPackageJson(filePath: string) {
  return JSON.parse(readFileSync(filePath, 'utf8')) as {
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
});
