import { describe, it, expect, vi } from 'vitest';
import { SpaceRepository } from '../SpaceRepository.js';

describe('SpaceRepository', () => {
  describe('create', () => {
    it('persists share_mode for newly created spaces', async () => {
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDb = { prepare: mockPrepare };

      const repo = new SpaceRepository(mockDb);

      await repo.create({
        id: 'space-1',
        name: 'Shared Space',
        description: '',
        isPublic: false,
        password: null,
        shareToken: 'share-space',
        expiresAt: null,
        template: 'gallery',
        templateData: '{}',
        shareMode: 'selected',
        productId: null,
        variantId: null,
        createdAt: 100,
        updatedAt: 100,
      });

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('share_mode'));
      expect(mockBind).toHaveBeenCalledWith(
        'space-1',
        'Shared Space',
        '',
        0,
        null,
        'share-space',
        null,
        'gallery',
        '{}',
        'selected',
        null,
        null,
        100,
        100
      );
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe('findByProductId', () => {
    it('derives product status from product_projection active variant counts', async () => {
      const mockAll = vi.fn().mockResolvedValue({ results: [] });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDb = { prepare: mockPrepare };

      const repo = new SpaceRepository(mockDb);

      await repo.findByProductId('prod123');

      const sql = mockPrepare.mock.calls[0][0];
      expect(sql).toContain('LEFT JOIN product_projection pp ON pp.product_id = p.id');
      expect(sql).toContain('COALESCE(pp.active_variant_count, 0) > 0');
      expect(sql).not.toContain('NULL as p_status');
    });

    it('should return spaces linked to a specific product ID', async () => {
      // Setup mock DB
      const mockResults = [
        {
          id: 'space1',
          name: 'Space 1',
          product_id: 'prod123',
          file_count: 5,
          cover_storage_key: 'key1',
        },
      ];

      const mockAll = vi.fn().mockResolvedValue({ results: mockResults });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

      const mockDb = { prepare: mockPrepare };

      const repo = new SpaceRepository(mockDb);
      const productId = 'prod123';

      // Execute
      const result = await repo.findByProductId(productId);

      // Assert
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('SELECT s.*'));
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('WHERE s.product_id = ?'));
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('AND s.parent_id IS NULL'));
      expect(mockBind).toHaveBeenCalledWith(productId, expect.any(Number));
      expect(mockAll).toHaveBeenCalled();

      expect(result).toEqual(mockResults);
    });

    it('should return empty array if no spaces are linked to the product ID', async () => {
      // Setup mock DB
      const mockAll = vi.fn().mockResolvedValue({ results: [] });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

      const mockDb = { prepare: mockPrepare };

      const repo = new SpaceRepository(mockDb);
      const productId = 'prod_none';

      // Execute
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-12T00:00:00.000Z'));
      const result = await repo.findByProductId(productId);
      const sql = mockPrepare.mock.calls[0][0];

      expect(sql).toContain('s.expires_at IS NULL OR s.expires_at >= ?');
      expect(mockBind).toHaveBeenCalledWith(productId, Date.now());

      // Assert
      expect(result).toEqual([]);
      vi.useRealTimers();
    });

    it('should throw an error if the database query fails', async () => {
      // Setup mock DB to throw
      const dbError = new Error('Database connection failed');
      const mockAll = vi.fn().mockRejectedValue(dbError);
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

      const mockDb = { prepare: mockPrepare };

      const repo = new SpaceRepository(mockDb);
      const productId = 'prod_error';

      // Execute & Assert
      await expect(repo.findByProductId(productId)).rejects.toThrow('Database connection failed');
    });

    it('prefers variant primary image over product image in query selection', async () => {
      const mockAll = vi.fn().mockResolvedValue({ results: [] });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDb = { prepare: mockPrepare };

      const repo = new SpaceRepository(mockDb);
      await repo.findByProductId('prod_1');

      const sql = mockPrepare.mock.calls[0][0];
      expect(sql).toContain('variant_images');
      expect(sql).toContain('COALESCE');
      expect(sql).toContain('p.id as p_bound_id');
      expect(sql).toContain('display_image_id');
    });
  });

  describe('findById', () => {
    it('keeps fallback chain when variant images are empty', async () => {
      const mockFirst = vi.fn().mockResolvedValue({
        id: 'space_1',
        display_image_id: 'product_img_1',
      });
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDb = { prepare: mockPrepare };

      const repo = new SpaceRepository(mockDb);
      const result = await repo.findById('space_1');

      const sql = mockPrepare.mock.calls[0][0];
      expect(sql).toContain('variant_images');
      expect(sql).toContain('json_extract');
      expect(result.display_image_id).toBe('product_img_1');
    });
  });

  describe('read models', () => {
    it('returns all top-level spaces from findAll', async () => {
      const mockAll = vi.fn().mockResolvedValue({ results: [{ id: 'space-1' }] });
      const mockPrepare = vi.fn().mockReturnValue({ all: mockAll });
      const mockDb = { prepare: mockPrepare };

      const repo = new SpaceRepository(mockDb);
      const result = await repo.findAll();

      expect(mockPrepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE s.parent_id IS NULL')
      );
      expect(result).toEqual([{ id: 'space-1' }]);
    });

    it('returns space files when getWithFiles finds a space', async () => {
      const mockFirst = vi.fn().mockResolvedValue({ id: 'space-1', name: 'Main space' });
      const firstBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockAll = vi.fn().mockResolvedValue({ results: [{ id: 'file-1' }] });
      const secondBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockDb = {
        prepare: vi
          .fn()
          .mockReturnValueOnce({ bind: firstBind })
          .mockReturnValueOnce({ bind: secondBind }),
      };

      const repo = new SpaceRepository(mockDb);
      await expect(repo.getWithFiles('space-1')).resolves.toEqual({
        space: { id: 'space-1', name: 'Main space' },
        files: [{ id: 'file-1' }],
      });

      expect(secondBind).toHaveBeenCalledWith('space-1');
    });

    it('returns null when getWithFiles cannot find the space', async () => {
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockDb = {
        prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnValue({ first: mockFirst }) }),
      };

      const repo = new SpaceRepository(mockDb);
      await expect(repo.getWithFiles('missing-space')).resolves.toBeNull();
      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
    });

    it('returns space stats with trend rows and zero-safe counters', async () => {
      const firstSpace = vi.fn().mockResolvedValue({ view_count: 7, download_count: 3 });
      const bindSpace = vi.fn().mockReturnValue({ first: firstSpace });
      const firstFileStats = vi.fn().mockResolvedValue({ file_count: 2, total_size: 4096 });
      const bindFileStats = vi.fn().mockReturnValue({ first: firstFileStats });
      const allTrend = vi.fn().mockResolvedValue({ results: [{ date: '2026-04-18', count: 5 }] });
      const bindTrend = vi.fn().mockReturnValue({ all: allTrend });
      const mockDb = {
        prepare: vi
          .fn()
          .mockReturnValueOnce({ bind: bindSpace })
          .mockReturnValueOnce({ bind: bindFileStats })
          .mockReturnValueOnce({ bind: bindTrend }),
      };

      const repo = new SpaceRepository(mockDb);
      await expect(repo.getStats('space-1', 7, 123)).resolves.toEqual({
        viewCount: 7,
        downloadCount: 3,
        fileCount: 2,
        totalSize: 4096,
        trendData: [{ date: '2026-04-18', count: 5 }],
      });

      expect(bindTrend).toHaveBeenCalledWith('space-1', 123);
    });

    it('returns null when getStats cannot find the space', async () => {
      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockDb = {
        prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnValue({ first: mockFirst }) }),
      };

      const repo = new SpaceRepository(mockDb);
      await expect(repo.getStats('missing-space', 7, 0)).resolves.toBeNull();
      expect(mockDb.prepare).toHaveBeenCalledTimes(1);
    });

    it('returns subspaces and shared salespersons lists', async () => {
      const subspaceAll = vi.fn().mockResolvedValue({ results: [{ id: 'sub-1' }] });
      const subspaceBind = vi.fn().mockReturnValue({ all: subspaceAll });
      const sharedAll = vi.fn().mockResolvedValue({ results: [{ id: 'sp-1', name: 'Alice' }] });
      const sharedBind = vi.fn().mockReturnValue({ all: sharedAll });
      const mockDb = {
        prepare: vi
          .fn()
          .mockReturnValueOnce({ bind: subspaceBind })
          .mockReturnValueOnce({ bind: sharedBind }),
      };

      const repo = new SpaceRepository(mockDb);
      await expect(repo.findSubspaces('parent-1')).resolves.toEqual([{ id: 'sub-1' }]);
      await expect(repo.getSharedSalespersons('space-1')).resolves.toEqual([
        { id: 'sp-1', name: 'Alice' },
      ]);

      expect(subspaceBind).toHaveBeenCalledWith('parent-1');
      expect(sharedBind).toHaveBeenCalledWith('space-1');
    });
  });

  describe('salesperson visibility', () => {
    it('filters expired spaces in salesperson list queries at repository level', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-12T00:00:00.000Z'));

      const mockAll = vi.fn().mockResolvedValue({ results: [] });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDb = { prepare: mockPrepare };

      const repo = new SpaceRepository(mockDb);
      await repo.findAllForSalesperson('sp-1');

      const sql = mockPrepare.mock.calls[0][0];
      expect(sql).toContain('s.parent_id IS NULL');
      expect(sql).toContain('s.expires_at IS NULL OR s.expires_at >= ?');
      expect(mockBind).toHaveBeenCalledWith(Date.now(), 'sp-1');

      vi.useRealTimers();
    });

    it('filters expired spaces in salesperson detail queries at repository level', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-12T00:00:00.000Z'));

      const mockFirst = vi.fn().mockResolvedValue(null);
      const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDb = { prepare: mockPrepare };

      const repo = new SpaceRepository(mockDb);
      await repo.findByIdForSalesperson('space-1', 'sp-1');

      const sql = mockPrepare.mock.calls[0][0];
      expect(sql).toContain('WHERE s.id = ?');
      expect(sql).toContain('s.expires_at IS NULL OR s.expires_at >= ?');
      expect(mockBind).toHaveBeenCalledWith('space-1', Date.now(), 'sp-1');

      vi.useRealTimers();
    });

    it('filters expired subspaces in salesperson subspace queries at repository level', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-12T00:00:00.000Z'));

      const mockAll = vi.fn().mockResolvedValue({ results: [] });
      const mockBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDb = { prepare: mockPrepare };

      const repo = new SpaceRepository(mockDb);
      await repo.findSubspacesForSalesperson('parent-1', 'sp-1');

      const sql = mockPrepare.mock.calls[0][0];
      expect(sql).toContain('WHERE s.parent_id = ?');
      expect(sql).toContain('s.expires_at IS NULL OR s.expires_at >= ?');
      expect(mockBind).toHaveBeenCalledWith('parent-1', Date.now(), 'sp-1');

      vi.useRealTimers();
    });

    it('returns visible salesperson space details with files', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-12T00:00:00.000Z'));

      const mockFirst = vi.fn().mockResolvedValue({ id: 'space-1', share_mode: 'selected' });
      const detailBind = vi.fn().mockReturnValue({ first: mockFirst });
      const mockAll = vi.fn().mockResolvedValue({ results: [{ id: 'file-1', section: 'hero' }] });
      const filesBind = vi.fn().mockReturnValue({ all: mockAll });
      const mockDb = {
        prepare: vi
          .fn()
          .mockReturnValueOnce({ bind: detailBind })
          .mockReturnValueOnce({ bind: filesBind }),
      };

      const repo = new SpaceRepository(mockDb);
      await expect(repo.findByIdForSalesperson('space-1', 'sp-1')).resolves.toEqual({
        id: 'space-1',
        share_mode: 'selected',
        files: [{ id: 'file-1', section: 'hero' }],
      });

      expect(detailBind).toHaveBeenCalledWith('space-1', Date.now(), 'sp-1');
      expect(filesBind).toHaveBeenCalledWith('space-1');

      vi.useRealTimers();
    });
  });

  describe('batch safety', () => {
    function createStatement(sql) {
      const statement = {
        sql,
        params: [],
        bind: vi.fn((...params) => {
          statement.params = params;
          return statement;
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      };
      return statement;
    }

    it('chunks addFiles when linking many files to one space', async () => {
      const db = {
        prepare: vi.fn((sql) => createStatement(sql)),
        batch: vi.fn(async (statements = []) => statements.map(() => ({ meta: { changes: 1 } }))),
      };
      const repo = new SpaceRepository(db);

      await repo.addFiles(
        'space-1',
        Array.from({ length: 205 }, (_, index) => `file-${index}`)
      );

      expect(db.batch).toHaveBeenCalledTimes(3);
      expect(db.batch.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 5]);
    });

    it('chunks reorderFiles when sorting many files in one space', async () => {
      const db = {
        prepare: vi.fn((sql) => createStatement(sql)),
        batch: vi.fn(async (statements = []) => statements.map(() => ({ meta: { changes: 1 } }))),
      };
      const repo = new SpaceRepository(db);

      await repo.reorderFiles(
        'space-1',
        Array.from({ length: 205 }, (_, index) => `file-${index}`)
      );

      expect(db.batch).toHaveBeenCalledTimes(3);
      expect(db.batch.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 6]);
    });

    it('updates space timestamps after addFiles', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-12T00:00:00.000Z'));

      const db = {
        prepare: vi.fn((sql) => createStatement(sql)),
        batch: vi.fn(async (statements = []) => statements.map(() => ({ meta: { changes: 1 } }))),
      };
      const repo = new SpaceRepository(db);

      await repo.addFiles('space-1', ['file-1', 'file-2']);

      expect(db.batch).toHaveBeenCalledTimes(1);
      const updateStatement = db.prepare.mock.results.at(-1).value;
      expect(updateStatement.sql).toContain('UPDATE spaces SET updated_at = ?');
      expect(updateStatement.params).toEqual([Date.now(), 'space-1']);

      vi.useRealTimers();
    });

    it('chunks removeFiles into D1-safe delete batches', async () => {
      const runStatements = [];
      const db = {
        prepare: vi.fn((sql) => {
          const statement = createStatement(sql);
          statement.run = vi.fn(async () => {
            runStatements.push(statement.params);
            return { success: true, meta: { changes: 1 } };
          });
          return statement;
        }),
      };
      const repo = new SpaceRepository(db);

      await repo.removeFiles(
        'space-1',
        Array.from({ length: 205 }, (_, index) => `file-${index}`)
      );

      expect(db.prepare).toHaveBeenCalledTimes(3);
      expect(runStatements.map((params) => params.length)).toEqual([99, 99, 10]);
    });

    it('updates shared salesperson bindings with delete-only and insert batches', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-12T00:00:00.000Z'));

      const db = {
        prepare: vi.fn((sql) => createStatement(sql)),
        batch: vi.fn(async (statements = []) => statements.map(() => ({ meta: { changes: 1 } }))),
      };
      const repo = new SpaceRepository(db);

      await repo.updateSharedSalespersons('space-1', []);
      await repo.updateSharedSalespersons('space-1', ['sp-1', 'sp-2']);

      expect(db.batch).toHaveBeenCalledTimes(2);
      expect(db.batch.mock.calls[0][0]).toHaveLength(1);
      expect(db.batch.mock.calls[1][0]).toHaveLength(3);
      const insertStatement = db.prepare.mock.results[2].value;
      expect(insertStatement.bind).toHaveBeenNthCalledWith(1, 'space-1', 'sp-1', Date.now());
      expect(insertStatement.bind).toHaveBeenNthCalledWith(2, 'space-1', 'sp-2', Date.now());

      vi.useRealTimers();
    });
  });

  describe('createSubspace', () => {
    it('persists both product_id and variant_id for bound child spaces', async () => {
      const mockRun = vi.fn().mockResolvedValue({ success: true });
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
      const mockDb = { prepare: mockPrepare };

      const repo = new SpaceRepository(mockDb);

      await repo.createSubspace({
        id: 'space-child-1',
        parentId: 'space-parent-1',
        name: 'Child Product Space',
        description: '',
        isPublic: false,
        password: null,
        shareToken: 'share-space',
        expiresAt: null,
        template: 'product',
        templateData: '{}',
        shareMode: 'selected',
        productId: 'product-2',
        variantId: 'variant-2',
        createdAt: 100,
        updatedAt: 100,
      });

      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('product_id'));
      expect(mockBind).toHaveBeenCalledWith(
        'space-child-1',
        'space-parent-1',
        'Child Product Space',
        '',
        0,
        null,
        'share-space',
        null,
        'product',
        '{}',
        'selected',
        'product-2',
        'variant-2',
        100,
        100
      );
      expect(mockRun).toHaveBeenCalled();
    });
  });

  describe('mutations', () => {
    it('updates spaces through dynamic update clauses and reloads the record', async () => {
      const updateRun = vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } });
      const updateBind = vi.fn().mockReturnValue({ run: updateRun });
      const mockDb = {
        prepare: vi.fn().mockReturnValue({ bind: updateBind }),
      };

      const repo = new SpaceRepository(mockDb, { now: () => 123 });
      const result = await repo.update('space-1', { name: 'Updated space' });

      expect(result).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalled();
      expect(updateBind).toHaveBeenCalled();
      expect(updateRun).toHaveBeenCalled();
    });

    it('deletes space files before deleting the space row', async () => {
      const statements = [];
      const db = {
        prepare: vi.fn((sql) => {
          const statement = {
            sql,
            params: [],
            bind: vi.fn((...params) => {
              statement.params = params;
              return statement;
            }),
          };
          statements.push(statement);
          return statement;
        }),
        batch: vi.fn(async () => []),
      };
      const repo = new SpaceRepository(db);

      await repo.delete('space-1');

      expect(db.batch).toHaveBeenCalledTimes(1);
      expect(statements.map((statement) => statement.sql)).toEqual([
        'DELETE FROM space_files WHERE space_id = ?',
        'DELETE FROM spaces WHERE id = ?',
      ]);
      expect(statements.map((statement) => statement.params)).toEqual([['space-1'], ['space-1']]);
    });
  });
});
