import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileRepository } from '../FileRepository.js';

function createStatement(sql, options = {}) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    first: vi.fn(async () => null),
    all: vi.fn(async () => ({ results: [] })),
    run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
  };

  if ('firstResult' in options) {
    statement.first.mockResolvedValue(options.firstResult);
  }
  if ('allResult' in options) {
    statement.all.mockResolvedValue(options.allResult);
  }
  if ('runResult' in options) {
    statement.run.mockResolvedValue(options.runResult);
  }

  return statement;
}

describe('FileRepository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns active files for a folder ordered by creation time', async () => {
    const statement = createStatement('find-by-folder', {
      allResult: { results: [{ id: 'file-1', folder_id: 'folder-1' }] },
    });
    const db = { prepare: vi.fn(() => statement) };
    const repo = new FileRepository(db);

    await expect(repo.findByFolder('folder-1')).resolves.toEqual([{ id: 'file-1', folder_id: 'folder-1' }]);
    expect(db.prepare).toHaveBeenCalledWith(
      'SELECT id, folder_id, name, original_name, mime_type, size, storage_key, content_hash, status, created_at FROM files WHERE folder_id = ? AND is_deleted = 0 ORDER BY created_at DESC'
    );
    expect(statement.bind).toHaveBeenCalledWith('folder-1');
  });

  it('creates a file with fallback values', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T08:00:00.000Z'));

    const statement = createStatement('create');
    const db = { prepare: vi.fn(() => statement) };
    const repo = new FileRepository(db);

    await repo.create({
      id: 'file-1',
      storageKey: 'key-1',
    });

    expect(statement.bind).toHaveBeenCalledWith(
      'file-1',
      'root',
      'unnamed',
      'unnamed',
      'key-1',
      0,
      'application/octet-stream',
      null,
      null,
      null,
      Date.now(),
      Date.now()
    );
  });

  it('skips batch creation when there are no items', async () => {
    const db = { prepare: vi.fn(), batch: vi.fn() };
    const repo = new FileRepository(db);

    await repo.createBatch([]);
    expect(db.prepare).not.toHaveBeenCalled();
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('creates file batches using prepared statements with defaults', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T08:00:00.000Z'));

    const statements = [];
    const db = {
      prepare: vi.fn((sql) => {
        const statement = createStatement(sql);
        statements.push(statement);
        return statement;
      }),
      batch: vi.fn(async (batch) => batch.map(() => ({ meta: { changes: 1 } }))),
    };
    const repo = new FileRepository(db);

    await repo.createBatch([
      { id: 'file-1', storageKey: 'key-1' },
      { id: 'file-2', folderId: 'folder-2', name: 'hero.jpg', originalName: 'hero-original.jpg', storageKey: 'key-2' },
    ]);

    expect(db.batch).toHaveBeenCalledTimes(1);
    expect(db.batch.mock.calls[0][0]).toHaveLength(2);
    expect(statements[0].bind).toHaveBeenCalledWith(
      'file-1',
      'root',
      'unnamed',
      'unnamed',
      'key-1',
      0,
      'application/octet-stream',
      null,
      null,
      null,
      Date.now(),
      Date.now()
    );
    expect(statements[1].bind).toHaveBeenCalledWith(
      'file-2',
      'folder-2',
      'hero.jpg',
      'hero-original.jpg',
      'key-2',
      0,
      'application/octet-stream',
      null,
      null,
      null,
      Date.now(),
      Date.now()
    );
  });

  it('finds files by id and original hash', async () => {
    const byId = createStatement('find-by-id', {
      firstResult: { id: 'file-1' },
    });
    const byHash = createStatement('find-by-hash', {
      firstResult: { id: 'file-2', original_hash: 'hash-1' },
    });
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(byId)
        .mockReturnValueOnce(byHash),
    };
    const repo = new FileRepository(db);

    await expect(repo.findById('file-1')).resolves.toEqual({ id: 'file-1' });
    await expect(repo.findByOriginalHash('hash-1')).resolves.toEqual({ id: 'file-2', original_hash: 'hash-1' });
    expect(byId.bind).toHaveBeenCalledWith('file-1');
    expect(byHash.bind).toHaveBeenCalledWith('hash-1');
  });

  it('finds all files for a specific folder with sanitized pagination', async () => {
    const countStatement = createStatement('count-folder', { firstResult: { total: 3 } });
    const listStatement = createStatement('list-folder', {
      allResult: { results: [{ id: 'file-1', folder_id: 'folder-1' }] },
    });
    const db = {
      prepare: vi.fn((sql) => {
        if (sql.includes('COUNT(*) as total')) return countStatement;
        return listStatement;
      }),
    };
    const repo = new FileRepository(db);

    const value = await repo.findAll({ folderId: 'folder-1' }, { page: 0, limit: 200 });

    expect(countStatement.bind).toHaveBeenCalledWith('folder-1');
    expect(listStatement.bind).toHaveBeenCalledWith('folder-1', 100, 0);
    expect(value).toEqual({
      items: [{ id: 'file-1', folder_id: 'folder-1' }],
      total: 3,
      page: 1,
      limit: 100,
      totalPages: 1,
    });
  });

  it('finds root-only files when requested', async () => {
    const countStatement = createStatement('count-root', { firstResult: { total: 1 } });
    const listStatement = createStatement('list-root', {
      allResult: { results: [{ id: 'file-root', folder_id: 'root' }] },
    });
    const db = {
      prepare: vi.fn((sql) => {
        if (sql.includes('COUNT(*) as total')) return countStatement;
        return listStatement;
      }),
    };
    const repo = new FileRepository(db);

    const value = await repo.findAll({ rootOnly: true }, { page: 2, limit: 1 });

    expect(db.prepare.mock.calls[0][0]).toContain("(folder_id = 'root' OR folder_id IS NULL)");
    expect(listStatement.bind).toHaveBeenCalledWith(1, 1);
    expect(value.page).toBe(2);
    expect(value.totalPages).toBe(1);
  });

  it('ignores update requests without allowed columns', async () => {
    const db = { prepare: vi.fn() };
    const repo = new FileRepository(db);

    await repo.update('file-1', { malicious: 'x' });
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('moves files in chunked updates with current timestamp', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T08:00:00.000Z'));

    const statements = [];
    const db = {
      prepare: vi.fn((sql) => {
        const statement = createStatement(sql);
        statements.push(statement);
        return statement;
      }),
    };
    const repo = new FileRepository(db);

    await repo.moveBatch(Array.from({ length: 100 }, (_, index) => `file-${index}`), 'folder-2');

    expect(statements).toHaveLength(2);
    expect(statements[0].bind.mock.calls[0][0]).toBe('folder-2');
    expect(statements[0].bind.mock.calls[0][1]).toBe(Date.now());
    expect(statements[1].bind.mock.calls[0]).toEqual(['folder-2', Date.now(), 'file-98', 'file-99']);
  });

  it('deletes single and batched files while skipping empty batches', async () => {
    const deleteStatement = createStatement('delete-one');
    const batchStatements = [];
    const db = {
      prepare: vi.fn((sql) => {
        const statement = createStatement(sql);
        if (sql === 'DELETE FROM files WHERE id = ?') return deleteStatement;
        batchStatements.push(statement);
        return statement;
      }),
    };
    const repo = new FileRepository(db);

    await repo.delete('file-1');
    await repo.deleteBatch([]);
    await repo.deleteBatch(['file-1', 'file-2']);

    expect(deleteStatement.bind).toHaveBeenCalledWith('file-1');
    expect(batchStatements).toHaveLength(1);
    expect(batchStatements[0].bind).toHaveBeenCalledWith('file-1', 'file-2');
  });

  it('soft deletes and restores batches with timestamped recycling semantics', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T08:00:00.000Z'));

    const statements = [];
    const db = {
      prepare: vi.fn((sql) => {
        const statement = createStatement(sql);
        statements.push(statement);
        return statement;
      }),
    };
    const repo = new FileRepository(db);

    await repo.softDelete('file-1');
    await repo.softDeleteBatch([]);
    await repo.softDeleteBatch(['file-1', 'file-2']);
    await repo.restoreBatch([]);
    await repo.restoreBatch(['file-1', 'file-2']);

    expect(statements[0].bind).toHaveBeenCalledWith(Date.now(), 'file-1');
    expect(statements[1].bind).toHaveBeenCalledWith(Date.now(), 'file-1', 'file-2');
    expect(statements[2].bind).toHaveBeenCalledWith('file-1', 'file-2');
  });

  it('delegates trash lookup to the path-aware implementation', async () => {
    const db = { prepare: vi.fn() };
    const repo = new FileRepository(db);
    const spy = vi.spyOn(repo, 'findTrashWithPaths').mockResolvedValue([{ id: 'file-1' }]);

    await expect(repo.findTrash()).resolves.toEqual([{ id: 'file-1' }]);
    expect(spy).toHaveBeenCalled();
  });

  it('returns trashed files with original paths', async () => {
    const statement = createStatement('trash-paths', {
      allResult: { results: [{ id: 'file-1', original_path: '/Albums' }] },
    });
    const db = { prepare: vi.fn(() => statement) };
    const repo = new FileRepository(db);

    await expect(repo.findTrashWithPaths()).resolves.toEqual([{ id: 'file-1', original_path: '/Albums' }]);
    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('WITH RECURSIVE folder_paths');
    expect(sql).toContain('WHERE f.is_deleted = 1');
  });

  it('finds same-name files in root and nested folders', async () => {
    const rootStatement = createStatement('find-root', {
      firstResult: { id: 'file-root', name: 'hero.jpg' },
    });
    const nestedStatement = createStatement('find-nested', {
      firstResult: { id: 'file-2', folder_id: 'folder-2' },
    });
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(rootStatement)
        .mockReturnValueOnce(nestedStatement),
    };
    const repo = new FileRepository(db);

    await expect(repo.findByNameInFolder('root', 'hero.jpg')).resolves.toEqual({ id: 'file-root', name: 'hero.jpg' });
    await expect(repo.findByNameInFolder('folder-2', 'hero.jpg')).resolves.toEqual({ id: 'file-2', folder_id: 'folder-2' });

    expect(db.prepare.mock.calls[0][0]).toContain("(folder_id = 'root' OR folder_id IS NULL)");
    expect(rootStatement.bind).toHaveBeenCalledWith('hero.jpg');
    expect(db.prepare.mock.calls[1][0]).toContain('AND folder_id = ?');
    expect(nestedStatement.bind).toHaveBeenCalledWith('hero.jpg', 'folder-2');
  });

  it('checks file name conflicts in root and nested folders', async () => {
    const rootStatement = createStatement('conflict-root', { firstResult: { exist: 1 } });
    const nestedStatement = createStatement('conflict-nested', { firstResult: null });
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(rootStatement)
        .mockReturnValueOnce(nestedStatement),
    };
    const repo = new FileRepository(db);

    await expect(repo.checkNameConflict('root', 'hero.jpg')).resolves.toBe(true);
    await expect(repo.checkNameConflict('folder-2', 'hero.jpg', 'file-2')).resolves.toBe(false);

    expect(db.prepare.mock.calls[1][0]).toContain('AND id != ?');
    expect(nestedStatement.bind).toHaveBeenCalledWith('hero.jpg', 'folder-2', 'file-2');
  });

  it('finds conflicting names across root and nested folders in chunks', async () => {
    const nestedFirst = createStatement('nested-first', {
      allResult: { results: [{ name: 'a.jpg' }, { name: 'b.jpg' }] },
    });
    const nestedSecond = createStatement('nested-second', {
      allResult: { results: [{ name: 'tail.jpg' }] },
    });
    const rootStatement = createStatement('root', {
      allResult: { results: [{ name: 'root.jpg' }] },
    });
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(nestedFirst)
        .mockReturnValueOnce(nestedSecond)
        .mockReturnValueOnce(rootStatement),
    };
    const repo = new FileRepository(db);

    await expect(repo.findConflictingNames('folder-2', Array.from({ length: 99 }, (_, index) => `${index}.jpg`))).resolves.toEqual(['a.jpg', 'b.jpg', 'tail.jpg']);
    await expect(repo.findConflictingNames('root', ['root.jpg'])).resolves.toEqual(['root.jpg']);
    await expect(repo.findConflictingNames('root', [])).resolves.toEqual([]);

    expect(nestedFirst.bind.mock.calls[0]).toHaveLength(99);
    expect(nestedFirst.bind.mock.calls[0].at(-1)).toBe('folder-2');
    expect(db.prepare.mock.calls[2][0]).toContain("(folder_id = 'root' OR folder_id IS NULL)");
  });

  it('loads files by ids in chunks and skips empty inputs', async () => {
    const firstChunk = createStatement('ids-first', {
      allResult: { results: [{ id: 'file-1' }] },
    });
    const secondChunk = createStatement('ids-second', {
      allResult: { results: [{ id: 'file-99' }] },
    });
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(firstChunk)
        .mockReturnValueOnce(secondChunk),
    };
    const repo = new FileRepository(db);

    await expect(repo.findByIds([])).resolves.toEqual([]);
    await expect(repo.findByIds(Array.from({ length: 99 }, (_, index) => `file-${index}`))).resolves.toEqual([
      { id: 'file-1' },
      { id: 'file-99' },
    ]);

    expect(firstChunk.bind.mock.calls[0]).toHaveLength(98);
    expect(secondChunk.bind.mock.calls[0]).toEqual(['file-98']);
  });
});
