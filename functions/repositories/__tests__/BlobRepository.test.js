import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlobRepository } from '../BlobRepository.js';

/** 创建语句 mock（含 first/all/run） */
function createStatement(overrides = {}) {
  const statement = {
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    first: vi.fn(async () => null),
    all: vi.fn(async () => ({ results: [] })),
    run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
    ...overrides,
  };
  return statement;
}

describe('BlobRepository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================
  // findByHash
  // ==========================================
  describe('findByHash', () => {
    it('返回匹配的 blob 记录', async () => {
      const stmt = createStatement({
        first: vi.fn(async () => ({
          content_hash: 'abc123',
          size: 1024,
          mime_type: 'image/jpeg',
          ref_count: 3,
        })),
      });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new BlobRepository(db);

      const result = await repo.findByHash('abc123');

      expect(result).not.toBeNull();
      expect(result.content_hash).toBe('abc123');
      expect(result.size).toBe(1024);
      expect(result.mime_type).toBe('image/jpeg');
      expect(result.ref_count).toBe(3);
      expect(db.prepare.mock.calls[0][0]).toContain('SELECT content_hash, size, mime_type, ref_count FROM blobs');
      expect(stmt.bind).toHaveBeenCalledWith('abc123');
    });

    it('blob 不存在时返回 null', async () => {
      const stmt = createStatement({ first: vi.fn(async () => null) });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new BlobRepository(db);

      const result = await repo.findByHash('nonexistent');

      expect(result).toBeNull();
    });

    it('哈希为空时直接返回 null（不查询数据库）', async () => {
      const db = { prepare: vi.fn() };
      const repo = new BlobRepository(db);

      const result = await repo.findByHash('');

      expect(result).toBeNull();
      expect(db.prepare).not.toHaveBeenCalled();
    });

    it('哈希为 null 时直接返回 null', async () => {
      const db = { prepare: vi.fn() };
      const repo = new BlobRepository(db);

      const result = await repo.findByHash(null);

      expect(result).toBeNull();
      expect(db.prepare).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // create
  // ==========================================
  describe('create', () => {
    it('创建 blob 记录（初始引用计数为 1）', async () => {
      const now = 1710000000000;
      vi.spyOn(Date, 'now').mockReturnValue(now);

      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new BlobRepository(db);

      await repo.create('abc123', 2048, 'image/png');

      expect(db.prepare.mock.calls[0][0]).toContain('INSERT INTO blobs');
      expect(db.prepare.mock.calls[0][0]).toContain('ref_count');
      expect(stmt.params).toEqual(['abc123', 2048, 'image/png', now]);
      expect(stmt.run).toHaveBeenCalled();
    });
  });

  // ==========================================
  // incrementRefCount
  // ==========================================
  describe('incrementRefCount', () => {
    it('增加引用计数', async () => {
      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new BlobRepository(db);

      await repo.incrementRefCount('abc123');

      expect(db.prepare.mock.calls[0][0]).toContain('ref_count = ref_count + 1');
      expect(db.prepare.mock.calls[0][0]).toContain('WHERE content_hash = ?');
      expect(stmt.params).toEqual(['abc123']);
      expect(stmt.run).toHaveBeenCalled();
    });
  });

  // ==========================================
  // decrementRefCount
  // ==========================================
  describe('decrementRefCount', () => {
    it('原子减少引用计数并返回更新后的记录', async () => {
      const updateStmt = createStatement();
      const selectStmt = createStatement({
        all: vi.fn(async () => ({ results: [{ ref_count: 2 }] })),
      });

      const db = {
        prepare: vi.fn()
          .mockReturnValueOnce(updateStmt)
          .mockReturnValueOnce(selectStmt),
        batch: vi.fn(async (stmts) => [
          { success: true, meta: { changes: 1 } },
          { results: [{ ref_count: 2 }] },
        ]),
      };
      const repo = new BlobRepository(db);

      const result = await repo.decrementRefCount('abc123');

      expect(db.prepare).toHaveBeenCalledTimes(2);
      expect(db.prepare.mock.calls[0][0]).toContain('ref_count = ref_count - 1');
      expect(db.prepare.mock.calls[1][0]).toContain('SELECT ref_count FROM blobs');
      expect(db.batch).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ ref_count: 2 });
    });

    it('blob 不存在时返回 null', async () => {
      const updateStmt = createStatement();
      const selectStmt = createStatement();

      const db = {
        prepare: vi.fn()
          .mockReturnValueOnce(updateStmt)
          .mockReturnValueOnce(selectStmt),
        batch: vi.fn(async () => [
          { success: true, meta: { changes: 0 } },
          { results: [] },
        ]),
      };
      const repo = new BlobRepository(db);

      const result = await repo.decrementRefCount('nonexistent');

      expect(result).toBeNull();
    });
  });
});
