import { describe, expect, it, vi } from 'vitest';
import { ensureDatabaseSchema } from './db-bootstrap.js';

describe('ensureDatabaseSchema', () => {
  it('skips bootstrap in test runtime', async () => {
    const listMissingTables = vi.fn();

    await ensureDatabaseSchema({
      isTestRuntime: true,
      databaseUrl: 'postgresql://postgres:postgres@localhost:5432/sub_next',
      listMissingTables,
      pushSchema: vi.fn(),
      log: vi.fn(),
    });

    expect(listMissingTables).not.toHaveBeenCalled();
  });

  it('pushes schema when required tables are missing', async () => {
    const listMissingTables = vi.fn()
      .mockResolvedValueOnce(['Subscription'])
      .mockResolvedValueOnce([]);
    const pushSchema = vi.fn().mockResolvedValue(undefined);
    const log = vi.fn();

    await ensureDatabaseSchema({
      isTestRuntime: false,
      databaseUrl: 'postgresql://postgres:postgres@db.example.com:5432/sub_next',
      listMissingTables,
      pushSchema,
      log,
    });

    expect(pushSchema).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Subscription'));
    expect(listMissingTables).toHaveBeenCalledTimes(2);
  });

  it('fails startup when required tables are still missing after schema push', async () => {
    const listMissingTables = vi.fn()
      .mockResolvedValueOnce(['Subscription'])
      .mockResolvedValueOnce(['Subscription']);

    await expect(ensureDatabaseSchema({
      isTestRuntime: false,
      databaseUrl: 'postgresql://postgres:postgres@db.example.com:5432/sub_next',
      listMissingTables,
      pushSchema: vi.fn().mockResolvedValue(undefined),
      log: vi.fn(),
    })).rejects.toThrow(/Missing tables after sync: Subscription/);
  });
});
