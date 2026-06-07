import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FolderRepository } from '../FolderRepository.js';

function createStatement(sql, options = {}) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    all: vi.fn(async () => ({ results: [] })),
    first: vi.fn(async () => null),
    run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
  };

  if ('allResult' in options) {
    statement.all.mockResolvedValue(options.allResult);
  }
  if ('firstResult' in options) {
    statement.first.mockResolvedValue(options.firstResult);
  }
  if ('runResult' in options) {
    statement.run.mockResolvedValue(options.runResult);
  }

  return statement;
}

describe('FolderRepository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('returns minimal active folders ordered by name', async () => {
    const results = [{ id: 'folder-1', parent_id: null, name: 'Alpha' }];
    const statement = createStatement('minimal', { allResult: { results } });
    const db = { prepare: vi.fn(() => statement) };

    const repo = new FolderRepository(db);
    const value = await repo.findAllMinimal();

    expect(db.prepare).toHaveBeenCalledWith(
      'SELECT id, parent_id, name FROM folders WHERE is_deleted = 0 ORDER BY name ASC'
    );
    expect(statement.all).toHaveBeenCalled();
    expect(value).toEqual(results);
  });

  it('loads top level folders with file and subfolder counts', async () => {
    const results = [{ id: 'folder-1', subfolder_count: 2, file_count: 4 }];
    const statement = createStatement('top-level', { allResult: { results } });
    const db = { prepare: vi.fn(() => statement) };

    const repo = new FolderRepository(db);
    const value = await repo.findTopLevel();

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('COALESCE(sub.subfolder_count, 0) as subfolder_count');
    expect(sql).toContain("WHERE (f.parent_id IS NULL OR f.parent_id = 'root')");
    expect(sql).toContain('ORDER BY f.created_at DESC');
    expect(value).toEqual(results);
  });

  it('loads folders by parent id with counters', async () => {
    const results = [{ id: 'child-1', parent_id: 'folder-1' }];
    const statement = createStatement('by-parent', { allResult: { results } });
    const db = { prepare: vi.fn(() => statement) };

    const repo = new FolderRepository(db);
    const value = await repo.findByParent('folder-1');

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('WHERE f.parent_id = ?');
    expect(statement.bind).toHaveBeenCalledWith('folder-1');
    expect(value).toEqual(results);
  });

  it('loads a folder by id without extra filtering', async () => {
    const folder = { id: 'folder-1', is_deleted: 1 };
    const statement = createStatement('find-by-id', { firstResult: folder });
    const db = { prepare: vi.fn(() => statement) };

    const repo = new FolderRepository(db);
    const value = await repo.findById('folder-1');

    expect(db.prepare).toHaveBeenCalledWith('SELECT * FROM folders WHERE id = ?');
    expect(statement.bind).toHaveBeenCalledWith('folder-1');
    expect(value).toEqual(folder);
  });

  it('returns empty breadcrumbs for root folder markers', async () => {
    const db = { prepare: vi.fn() };
    const repo = new FolderRepository(db);

    await expect(repo.getBreadcrumbs()).resolves.toEqual([]);
    await expect(repo.getBreadcrumbs('root')).resolves.toEqual([]);
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('maps recursive breadcrumbs to id and name only', async () => {
    const statement = createStatement('breadcrumbs', {
      allResult: {
        results: [
          { id: 'root-1', name: 'Root', is_deleted: 0, depth: 2 },
          { id: 'child-1', name: 'Child', is_deleted: 0, depth: 1 },
        ],
      },
    });
    const db = { prepare: vi.fn(() => statement) };
    const repo = new FolderRepository(db);

    const value = await repo.getBreadcrumbs('child-1');

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('WITH RECURSIVE ancestors AS');
    expect(sql).toContain('WHERE is_deleted = 0 ORDER BY depth DESC');
    expect(statement.bind).toHaveBeenCalledWith('child-1');
    expect(value).toEqual([
      { id: 'root-1', name: 'Root' },
      { id: 'child-1', name: 'Child' },
    ]);
  });

  it('creates folders with explicit or fallback values', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T08:00:00.000Z'));

    const statement = createStatement('create');
    const db = { prepare: vi.fn(() => statement) };
    const repo = new FolderRepository(db);

    await repo.create({
      id: 'folder-1',
      name: 'Folder',
      isPublic: true,
    });

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('INSERT INTO folders');
    expect(statement.bind).toHaveBeenCalledWith(
      'folder-1',
      null,
      'Folder',
      '',
      null,
      1,
      null,
      Date.now(),
      Date.now()
    );
    expect(statement.run).toHaveBeenCalled();
  });

  it('updates folders using dynamic set clauses and bindings', async () => {
    const statement = createStatement('update');
    const db = { prepare: vi.fn(() => statement) };
    const repo = new FolderRepository(db, { now: () => 123 });

    const result = await repo.update('folder-1', { name: 'Renamed' });

    expect(result).toBe(true);
    expect(db.prepare).toHaveBeenCalled();
    expect(statement.run).toHaveBeenCalled();
  });

  it('soft deletes and restores folders with timestamp handling', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T08:00:00.000Z'));

    const softDeleteStatement = createStatement('soft-delete');
    const restoreStatement = createStatement('restore');
    const db = {
      prepare: vi.fn((sql) => {
        if (sql.includes('deleted_at = ?')) return softDeleteStatement;
        return restoreStatement;
      }),
    };
    const repo = new FolderRepository(db);

    await repo.softDelete('folder-1');
    await repo.restore('folder-1');

    expect(softDeleteStatement.bind).toHaveBeenCalledWith(Date.now(), 'folder-1');
    expect(restoreStatement.bind).toHaveBeenCalledWith('folder-1');
    expect(softDeleteStatement.run).toHaveBeenCalled();
    expect(restoreStatement.run).toHaveBeenCalled();
  });

  it('delegates trash lookup to the path-aware query', async () => {
    const db = { prepare: vi.fn() };
    const repo = new FolderRepository(db);
    const spy = vi.spyOn(repo, 'findTrashWithPaths').mockResolvedValue([{ id: 'trash-1' }]);

    await expect(repo.findTrash()).resolves.toEqual([{ id: 'trash-1' }]);
    expect(spy).toHaveBeenCalled();
  });

  it('returns trash folders with their original paths', async () => {
    const results = [{ id: 'folder-1', original_path: '/Root' }];
    const statement = createStatement('trash-paths', { allResult: { results } });
    const db = { prepare: vi.fn(() => statement) };
    const repo = new FolderRepository(db);

    const value = await repo.findTrashWithPaths();

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('WITH RECURSIVE folder_paths');
    expect(sql).toContain('original_path');
    expect(sql).toContain('WHERE f.is_deleted = 1');
    expect(value).toEqual(results);
  });

  it('returns recursive storage keys only', async () => {
    const statement = createStatement('storage-keys', {
      allResult: {
        results: [{ storage_key: 'a.jpg' }, { storage_key: 'b.jpg' }],
      },
    });
    const db = { prepare: vi.fn(() => statement) };
    const repo = new FolderRepository(db);

    const value = await repo.getAllStorageKeysRecursive('folder-1');

    const sql = db.prepare.mock.calls[0][0];
    expect(sql).toContain('WITH RECURSIVE descendant_folders');
    expect(sql).toContain('SELECT storage_key FROM files');
    expect(statement.bind).toHaveBeenCalledWith('folder-1');
    expect(value).toEqual(['a.jpg', 'b.jpg']);
  });

  it('returns early when recursive delete finds no descendants', async () => {
    const statement = createStatement('delete-recursive', { allResult: { results: [] } });
    const db = {
      prepare: vi.fn(() => statement),
      batch: vi.fn(),
    };
    const repo = new FolderRepository(db);

    await repo.deleteRecursive('folder-1');

    expect(statement.bind).toHaveBeenCalledWith('folder-1');
    expect(db.batch).not.toHaveBeenCalled();
  });

  it('paginates shared folders with sanitized limits', async () => {
    const countStatement = createStatement('shared-count', { firstResult: { total: 3 } });
    const listStatement = createStatement('shared-list', {
      allResult: {
        results: [{ id: 'folder-1', share_token: 'token-1' }],
      },
    });
    const db = {
      prepare: vi.fn((sql) => {
        if (sql.includes('COUNT(*) as total')) return countStatement;
        return listStatement;
      }),
    };
    const repo = new FolderRepository(db);

    const value = await repo.findShared({ page: '0', limit: '500' });

    expect(countStatement.first).toHaveBeenCalled();
    expect(listStatement.bind).toHaveBeenCalledWith(100, 0);
    expect(value).toEqual({
      items: [{ id: 'folder-1', share_token: 'token-1' }],
      total: 3,
      page: 1,
      limit: 100,
      totalPages: 1,
    });
  });

  it('lists folders under root when parentId is null-like', async () => {
    const countStatement = createStatement('list-count', { firstResult: { total: 2 } });
    const listStatement = createStatement('list-items', {
      allResult: {
        results: [{ id: 'folder-1', parent_id: null, fileCount: 1, subfolderCount: 0 }],
      },
    });
    const db = {
      prepare: vi.fn((sql) => {
        if (sql.includes('COUNT(*) as total')) return countStatement;
        return listStatement;
      }),
    };
    const repo = new FolderRepository(db);

    const value = await repo.list({ parentId: 'null', page: '2', limit: '1' });

    const countSql = db.prepare.mock.calls[0][0];
    const listSql = db.prepare.mock.calls[1][0];
    expect(countSql).toContain('f.parent_id IS NULL');
    expect(listSql).toContain('COALESCE(fc.file_count, 0) as fileCount');
    expect(listStatement.bind).toHaveBeenCalledWith(1, 1);
    expect(value).toEqual({
      items: [{ id: 'folder-1', parent_id: null, fileCount: 1, subfolderCount: 0 }],
      total: 2,
      page: 2,
      limit: 1,
      totalPages: 2,
    });
  });

  it('lists folders with parent and fuzzy search bindings', async () => {
    const countStatement = createStatement('list-count-search', { firstResult: { total: 1 } });
    const listStatement = createStatement('list-items-search', {
      allResult: {
        results: [{ id: 'folder-2', parent_id: 'parent-1', name: 'Photo' }],
      },
    });
    const db = {
      prepare: vi.fn((sql) => {
        if (sql.includes('COUNT(*) as total')) return countStatement;
        return listStatement;
      }),
    };
    const repo = new FolderRepository(db);

    const value = await repo.list({ parentId: 'parent-1', search: 'pho' });

    expect(countStatement.bind).toHaveBeenCalledWith('parent-1', '%pho%');
    expect(listStatement.bind).toHaveBeenCalledWith('parent-1', '%pho%', 20, 0);
    expect(value.items).toEqual([{ id: 'folder-2', parent_id: 'parent-1', name: 'Photo' }]);
  });

  it('returns null detail for missing folders', async () => {
    const db = { prepare: vi.fn() };
    const repo = new FolderRepository(db);
    vi.spyOn(repo, 'findById').mockResolvedValue(null);

    await expect(repo.findDetail('folder-1')).resolves.toBeNull();
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it('returns folder details with active files and subfolders', async () => {
    const fileStatement = createStatement('files', {
      allResult: { results: [{ id: 'file-1', folder_id: 'folder-1' }] },
    });
    const subfolderStatement = createStatement('subfolders', {
      allResult: { results: [{ id: 'child-1', parent_id: 'folder-1' }] },
    });
    const db = {
      prepare: vi.fn((sql) => {
        if (sql.includes('SELECT * FROM files')) return fileStatement;
        return subfolderStatement;
      }),
    };
    const repo = new FolderRepository(db);
    vi.spyOn(repo, 'findById').mockResolvedValue({ id: 'folder-1', name: 'Folder' });

    const value = await repo.findDetail('folder-1');

    expect(fileStatement.bind).toHaveBeenCalledWith('folder-1');
    expect(subfolderStatement.bind).toHaveBeenCalledWith('folder-1');
    expect(value).toEqual({
      folder: { id: 'folder-1', name: 'Folder' },
      files: [{ id: 'file-1', folder_id: 'folder-1' }],
      subfolders: [{ id: 'child-1', parent_id: 'folder-1' }],
    });
  });

  it('updates share settings and returns the fresh share snapshot', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T08:00:00.000Z'));

    const updateStatement = createStatement('update-share');
    const selectStatement = createStatement('select-share', {
      firstResult: {
        share_token: 'token-1',
        is_public: 0,
        password: null,
        share_expires_at: new Date('2026-05-01T00:00:00.000Z').getTime(),
      },
    });
    const db = {
      prepare: vi.fn((sql) => {
        if (sql.startsWith('UPDATE folders SET is_public')) return updateStatement;
        return selectStatement;
      }),
    };
    const repo = new FolderRepository(db);

    const value = await repo.updateShareSettings('folder-1', {
      isPublic: false,
      password: '',
      expiresAt: '2026-05-01T00:00:00.000Z',
    });

    expect(updateStatement.bind).toHaveBeenCalledWith(
      0,
      null,
      new Date('2026-05-01T00:00:00.000Z').getTime(),
      Date.now(),
      'folder-1'
    );
    expect(selectStatement.bind).toHaveBeenCalledWith('folder-1');
    expect(value.share_token).toBe('token-1');
  });

  it('checks descendant guards without unnecessary queries', async () => {
    const statement = createStatement('descendants', {
      allResult: { results: [{ found: 1 }] },
    });
    const db = { prepare: vi.fn(() => statement) };
    const repo = new FolderRepository(db);

    await expect(repo.isDescendantOrSelf('folder-1', null)).resolves.toBe(false);
    await expect(repo.isDescendantOrSelf('folder-1', 'folder-1')).resolves.toBe(true);
    await expect(repo.isDescendantOrSelf('folder-1', 'child-1')).resolves.toBe(true);

    expect(db.prepare).toHaveBeenCalledTimes(1);
    expect(statement.bind).toHaveBeenCalledWith('folder-1', 'child-1');
  });

  it('returns false when target is outside descendant tree', async () => {
    const statement = createStatement('descendants-none', {
      allResult: { results: [] },
    });
    const db = { prepare: vi.fn(() => statement) };
    const repo = new FolderRepository(db);

    await expect(repo.isDescendantOrSelf('folder-1', 'other-1')).resolves.toBe(false);
  });

  it('reports delete eligibility from child folder and file counts', async () => {
    const subfoldersStatement = createStatement('can-delete-subfolders', {
      firstResult: { count: 0 },
    });
    const filesStatement = createStatement('can-delete-files', {
      firstResult: { count: 2 },
    });
    const db = {
      prepare: vi.fn((sql) => {
        if (sql.includes('FROM folders')) return subfoldersStatement;
        return filesStatement;
      }),
    };
    const repo = new FolderRepository(db);

    await expect(repo.canDelete('folder-1')).resolves.toEqual({
      canDelete: false,
      subfolderCount: 0,
      fileCount: 2,
    });
  });

  it('checks name conflicts for root and nested folders', async () => {
    const rootStatement = createStatement('conflict-root', { firstResult: { exist: 1 } });
    const nestedStatement = createStatement('conflict-nested', { firstResult: null });
    const db = {
      prepare: vi.fn().mockReturnValueOnce(rootStatement).mockReturnValueOnce(nestedStatement),
    };
    const repo = new FolderRepository(db);

    await expect(repo.checkNameConflict('root', 'Photos')).resolves.toBe(true);
    await expect(repo.checkNameConflict('parent-1', 'Photos', 'folder-1')).resolves.toBe(false);

    expect(db.prepare.mock.calls[0][0]).toContain("(parent_id IS NULL OR parent_id = 'root')");
    expect(rootStatement.bind).toHaveBeenCalledWith('Photos');
    expect(db.prepare.mock.calls[1][0]).toContain('AND parent_id = ?');
    expect(db.prepare.mock.calls[1][0]).toContain('AND id != ?');
    expect(nestedStatement.bind).toHaveBeenCalledWith('Photos', 'parent-1', 'folder-1');
  });
});
