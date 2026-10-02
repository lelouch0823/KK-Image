import { describe, it, expect, vi } from 'vitest';
import { SettingsRepository } from '../SettingsRepository.js';
import { AlbumRepository } from '../AlbumRepository.js';
import { FileRepository } from '../FileRepository.js';
import { FolderRepository } from '../FolderRepository.js';

function createStatement(sql) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    all: vi.fn(async () => ({ results: [] })),
    run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
  };
  return statement;
}

describe('repository batch safety hardening', () => {
  it('SettingsRepository.batchUpsert chunks large settings writes', async () => {
    const db = {
      prepare: vi.fn((sql) => createStatement(sql)),
      batch: vi.fn(async (statements = []) => statements.map(() => ({ meta: { changes: 1 } }))),
    };
    const repo = new SettingsRepository(db);

    const count = await repo.batchUpsert(
      Array.from({ length: 205 }, (_, index) => ({
        key: `key-${index}`,
        value: `value-${index}`,
      }))
    );

    expect(count).toBe(205);
    expect(db.batch).toHaveBeenCalledTimes(3);
    expect(db.batch.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 5]);
  });

  it('AlbumRepository.addFiles chunks large relation writes', async () => {
    const db = {
      prepare: vi.fn((sql) => createStatement(sql)),
      batch: vi.fn(async (statements = []) => statements.map(() => ({ meta: { changes: 1 } }))),
    };
    const repo = new AlbumRepository(db);

    await repo.addFiles(
      'album-1',
      Array.from({ length: 205 }, (_, index) => `file-${index}`)
    );

    expect(db.batch).toHaveBeenCalledTimes(3);
    expect(db.batch.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 5]);
  });

  it('FileRepository.createBatch chunks large file inserts', async () => {
    const db = {
      prepare: vi.fn((sql) => createStatement(sql)),
      batch: vi.fn(async (statements = []) => statements.map(() => ({ meta: { changes: 1 } }))),
    };
    const repo = new FileRepository(db);

    await repo.createBatch(
      Array.from({ length: 205 }, (_, index) => ({
        id: `file-${index}`,
        name: `File ${index}`,
        storageKey: `key/${index}`,
      }))
    );

    expect(db.batch).toHaveBeenCalledTimes(3);
    expect(db.batch.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 5]);
  });

  it('FileRepository.moveBatch chunks large IN-clause updates', async () => {
    const db = {
      prepare: vi.fn((sql) => createStatement(sql)),
    };
    const repo = new FileRepository(db);

    await repo.moveBatch(
      Array.from({ length: 205 }, (_, index) => `file-${index}`),
      'folder-2'
    );

    const moveCalls = db.prepare.mock.calls.filter(([sql]) =>
      sql.includes('UPDATE files SET folder_id = ?')
    );
    expect(moveCalls).toHaveLength(3);
  });

  it('FolderRepository.deleteRecursive deletes files before folders with bounded IN chunks', async () => {
    const db = {
      prepare: vi.fn((sql) => {
        const statement = createStatement(sql);
        if (sql.includes('SELECT id FROM descendant_folders')) {
          statement.all.mockResolvedValue({
            results: Array.from({ length: 205 }, (_, index) => ({ id: `folder-${index}` })),
          });
        }
        return statement;
      }),
      batch: vi.fn(async (statements = []) => statements.map(() => ({ meta: { changes: 1 } }))),
    };
    const repo = new FolderRepository(db);

    await repo.deleteRecursive('folder-root');

    // 205 个子目录 → 3 个 IN 分块 × (files + folders) = 6 条语句；
    // 默认批次大小（100）下合并为单个原子 batch，且文件删除先于文件夹删除
    expect(db.batch).toHaveBeenCalledTimes(1);
    const batchStatements = db.batch.mock.calls[0][0];
    expect(batchStatements).toHaveLength(6);
    const sqls = batchStatements.map((stmt) => stmt.sql);
    expect(sqls.slice(0, 3).every((sql) => sql.includes('DELETE FROM files'))).toBe(true);
    expect(sqls.slice(3).every((sql) => sql.includes('DELETE FROM folders'))).toBe(true);
  });
});
