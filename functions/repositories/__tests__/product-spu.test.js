import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductRepository } from '../ProductRepository.js';
import * as queryModule from '../../lib/db/query.js';

// 模拟 D1 prepared statement
function createPreparedStatement(sql) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    first: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
  };
  return statement;
}

// 模拟 D1 database
function createMockDb() {
  const statements = [];
  const db = {
    prepare: vi.fn((sql) => {
      const stmt = createPreparedStatement(sql);
      statements.push(stmt);
      return stmt;
    }),
    batch: vi.fn(async (batchStatements) => batchStatements),
  };
  return { db, statements };
}

describe('ProductRepository — SPU 重构', () => {
  let db;
  let repo;

  beforeEach(() => {
    ({ db } = createMockDb());
    repo = new ProductRepository(db);
    // 模拟 crypto.randomUUID
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'test-uuid') });
  });

  // ---------------------------------------------------------------
  // 创建商品 (spu 可选)
  // ---------------------------------------------------------------
  describe('create — spu 可选', () => {
    it('创建商品时 spu 缺省应成功', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);
        if (sql.includes('INSERT INTO products')) {
          stmt.run.mockResolvedValue({ meta: { changes: 1 } });
        }
        return stmt;
      });

      const product = await repo.create({ name: 'Test Product' });

      // 产品应成功创建
      expect(product).toBeTruthy();
      expect(product.name).toBe('Test Product');
      // spu 字段应存在且为 null 或空
      expect(product).toHaveProperty('spu');
    });

    it('创建商品时可指定 spu', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);
        if (sql.includes('INSERT INTO products')) {
          stmt.run.mockResolvedValue({ meta: { changes: 1 } });
        }
        if (sql.includes('FROM products p') && sql.includes('WHERE p.id = ?')) {
          stmt.first.mockResolvedValue({
            id: 'test-uuid',
            name: 'Test',
            spu: 'SPU-001',
            product_code: 'PTESTUUID0000',
            images: '[]',
            specifications: '{}',
            options: '[]',
          });
        }
        return stmt;
      });

      const product = await repo.create({ name: 'Test', spu: 'SPU-001' });
      expect(product.spu).toBe('SPU-001');
    });

    it('创建商品后应返回数据库生成的 product_code', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);
        if (sql.includes('INSERT INTO products')) {
          // RETURNING * 模式：run() 返回插入的行数据
          stmt.run.mockResolvedValue({
            success: true,
            meta: { changes: 1 },
            results: [
              {
                id: 'test-uuid',
                name: 'Code Product',
                spu: null,
                product_code: 'PTESTUUID0000',
                images: '[]',
                specifications: '{}',
                options: '[]',
              },
            ],
          });
        }
        return stmt;
      });

      const product = await repo.create({ name: 'Code Product' });
      expect(product.product_code).toBe('PTESTUUID0000');
    });

    it('创建商品 SQL 不应再写入 products.status 列', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);
        if (sql.includes('INSERT INTO products')) {
          stmt.run.mockResolvedValue({ meta: { changes: 1 } });
        }
        return stmt;
      });

      await repo.create({ name: 'No Status Column Product' });
      const insertSql =
        db.prepare.mock.calls.find((call) => call[0].includes('INSERT INTO products'))?.[0] || '';
      expect(insertSql).not.toContain('status');
    });

    it('创建商品时应拒绝非法 currency', async () => {
      await expect(
        repo.create({ name: 'Bad Currency Product', currency: 'INVALID' })
      ).rejects.toThrow('Invalid currency code');
    });
  });

  // ---------------------------------------------------------------
  // findBySpu 方法
  // ---------------------------------------------------------------
  describe('findBySpu', () => {
    it('应通过 spu 查找产品', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);
        if (sql.includes('FROM products p') && sql.includes('WHERE p.spu = ?')) {
          stmt.first.mockResolvedValue({
            id: 'test-id',
            name: 'Test',
            spu: 'SPU-001',
            images: '[]',
            specifications: '{}',
            options: '[]',
          });
        }
        return stmt;
      });

      const product = await repo.findBySpu('SPU-001');
      expect(product).toBeTruthy();
      expect(product.spu).toBe('SPU-001');
    });
  });

  // ---------------------------------------------------------------
  // search — 返回 spu 字段
  // ---------------------------------------------------------------
  describe('search — spu 搜索', () => {
    it('搜索结果应包含 spu 字段', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);
        if (sql.includes('FROM products p')) {
          stmt.all.mockResolvedValue({
            results: [
              {
                id: 'test-id',
                name: 'Test',
                spu: 'SPU-001',
                images: '[]',
                specifications: '{}',
                options: '[]',
              },
            ],
          });
        }
        if (sql.includes('COUNT(*)')) {
          stmt.first.mockResolvedValue({ total: 1 });
        }
        return stmt;
      });

      const result = await repo.search({ search: 'SPU-001' });
      expect(result.items[0]).toHaveProperty('spu');
      // 搜索 SQL 应引用 spu 而不是 sku
      const searchSql = db.prepare.mock.calls.find((c) => c[0].includes('LIKE'));
      expect(searchSql[0]).toContain('spu LIKE');
      expect(searchSql[0]).not.toContain('sku LIKE');
    });

    it('商品聚合应只统计 active 规格的价格与库存', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);
        if (sql.includes('COUNT(*)')) {
          stmt.first.mockResolvedValue({ total: 0 });
          return stmt;
        }
        if (
          sql.includes('SELECT DISTINCT p.brand AS brand') ||
          sql.includes('SELECT DISTINCT p.category AS category')
        ) {
          stmt.all.mockResolvedValue({ results: [] });
          return stmt;
        }
        if (sql.includes('FROM products p')) {
          stmt.all.mockResolvedValue({ results: [] });
          return stmt;
        }
        return stmt;
      });

      await repo.search({ hasStock: 'in_stock', status: 'active' });

      const listSql = db.prepare.mock.calls.find((call) => call[0].includes('ORDER BY'))?.[0] || '';
      // 使用 product_projection 表替代 CTE 全表扫描
      expect(listSql).toContain('LEFT JOIN product_projection pp ON pp.product_id = p.id');
      expect(listSql).toContain('COALESCE(pp.min_price, 0) AS price');
      expect(listSql).toContain('COALESCE(pp.total_available, COALESCE(pp.total_stock, 0))');
      expect(listSql).toContain('COALESCE(pp.active_variant_count, 0) > 0');
      expect(listSql).not.toContain('p.status');
    });

    it('应支持组合品牌、分类、有库存和排序查询', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);
        if (sql.includes('FROM products p')) {
          stmt.all.mockResolvedValue({
            results: [
              {
                id: 'test-id',
                name: 'Test',
                brand: 'KK',
                category: 'Top',
                stock_quantity: 8,
                available_quantity: 8,
                images: '[]',
                specifications: '{}',
                options: '[]',
              },
            ],
          });
        }
        if (sql.includes('COUNT(*)')) {
          stmt.first.mockResolvedValue({ total: 1 });
        }
        return stmt;
      });

      await repo.search({
        brand: 'KK',
        category: 'Top',
        hasStock: 'in_stock',
        sortBy: 'stock',
        sortOrder: 'desc',
      });

      const listSql = db.prepare.mock.calls.find((call) => call[0].includes('ORDER BY'))?.[0] || '';
      expect(listSql).toContain('brand = ?');
      expect(listSql).toContain('category = ?');
      expect(listSql).toContain('COALESCE(pp.total_available, COALESCE(pp.total_stock, 0)) > 0');
      expect(listSql).toContain('ORDER BY available_quantity DESC');
    });

    it('ProductRepository.search 应通过可观测查询封装打热路径标签', async () => {
      const querySpy = vi.spyOn(queryModule, 'query');
      const queryFirstSpy = vi.spyOn(queryModule, 'queryFirst');

      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);

        if (sql.includes('COUNT(*)')) {
          stmt.first.mockResolvedValue({ total: 1 });
          return stmt;
        }

        if (sql.includes('SELECT DISTINCT p.brand AS brand')) {
          stmt.all.mockResolvedValue({ results: [{ brand: 'KK' }] });
          return stmt;
        }

        if (sql.includes('SELECT DISTINCT p.category AS category')) {
          stmt.all.mockResolvedValue({ results: [{ category: 'Top' }] });
          return stmt;
        }

        if (sql.includes('FROM products p')) {
          stmt.all.mockResolvedValue({
            results: [
              {
                id: 'test-id',
                name: 'Observable Product',
                spu: 'SPU-OBS',
                images: '[]',
                specifications: '{}',
                options: '[]',
              },
            ],
          });
        }

        return stmt;
      });

      const result = await repo.search({ search: 'SPU-OBS' });

      expect(result.items).toHaveLength(1);
      expect(
        querySpy.mock.calls.some(([, , , options]) => options?.label === 'product.search.list')
      ).toBe(true);
      expect(
        queryFirstSpy.mock.calls.some(
          ([, , , options]) => options?.label === 'product.search.count'
        )
      ).toBe(true);
      expect(
        querySpy.mock.calls.some(
          ([, , , options]) => options?.label === 'product.search.filters.brands'
        )
      ).toBe(true);
      expect(
        querySpy.mock.calls.some(
          ([, , , options]) => options?.label === 'product.search.filters.categories'
        )
      ).toBe(true);
    });

    it('返回品牌分面元数据时应忽略当前品牌条件但保留其他条件', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);

        if (sql.includes('SELECT DISTINCT p.brand AS brand')) {
          stmt.all.mockResolvedValue({
            results: [{ brand: 'KK' }, { brand: 'ACME' }],
          });
          return stmt;
        }

        if (sql.includes('SELECT DISTINCT p.category AS category')) {
          stmt.all.mockResolvedValue({
            results: [{ category: 'Top' }],
          });
          return stmt;
        }

        if (sql.includes('COUNT(*)')) {
          stmt.first.mockResolvedValue({ total: 1 });
          return stmt;
        }

        if (sql.includes('FROM products p')) {
          stmt.all.mockResolvedValue({
            results: [
              {
                id: 'test-id',
                name: 'Test',
                brand: 'KK',
                category: 'Top',
                images: '[]',
                specifications: '{}',
                options: '[]',
              },
            ],
          });
        }

        return stmt;
      });

      const result = await repo.search({
        brand: 'KK',
        category: 'Top',
        search: 'tee',
        hasStock: 'in_stock',
      });

      expect(result.filters.brands).toEqual(['KK', 'ACME']);
    });

    it('返回分类分面元数据时应忽略当前分类条件但保留其他条件', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);

        if (sql.includes('SELECT DISTINCT p.brand AS brand')) {
          stmt.all.mockResolvedValue({
            results: [{ brand: 'KK' }],
          });
          return stmt;
        }

        if (sql.includes('SELECT DISTINCT p.category AS category')) {
          stmt.all.mockResolvedValue({
            results: [{ category: 'Top' }, { category: 'Shoes' }],
          });
          return stmt;
        }

        if (sql.includes('COUNT(*)')) {
          stmt.first.mockResolvedValue({ total: 1 });
          return stmt;
        }

        if (sql.includes('FROM products p')) {
          stmt.all.mockResolvedValue({
            results: [
              {
                id: 'test-id',
                name: 'Test',
                brand: 'KK',
                category: 'Top',
                images: '[]',
                specifications: '{}',
                options: '[]',
              },
            ],
          });
        }

        return stmt;
      });

      const result = await repo.search({
        brand: 'KK',
        category: 'Top',
        status: 'active',
      });

      expect(result.filters.categories).toEqual(['Top', 'Shoes']);
    });

    it('可按选项跳过分面查询以减少额外聚合扫描', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);

        if (sql.includes('COUNT(*)')) {
          stmt.first.mockResolvedValue({ total: 1 });
          return stmt;
        }

        if (sql.includes('FROM products p')) {
          stmt.all.mockResolvedValue({
            results: [
              {
                id: 'test-id',
                name: 'Test',
                images: '[]',
                specifications: '{}',
                options: '[]',
              },
            ],
          });
        }

        return stmt;
      });

      const result = await repo.search(
        { status: 'active', hasStock: 'in_stock' },
        { includeFilters: false }
      );

      expect(result.filters).toEqual({ brands: [], categories: [] });
      expect(
        db.prepare.mock.calls.some((call) => call[0].includes('SELECT DISTINCT p.brand AS brand'))
      ).toBe(false);
      expect(
        db.prepare.mock.calls.some((call) =>
          call[0].includes('SELECT DISTINCT p.category AS category')
        )
      ).toBe(false);
    });

    it('计数查询不应包装完整商品列表子查询', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);

        if (sql.includes('COUNT(*)')) {
          stmt.first.mockResolvedValue({ total: 1 });
          return stmt;
        }

        if (sql.includes('FROM products p')) {
          stmt.all.mockResolvedValue({
            results: [
              {
                id: 'test-id',
                name: 'Test',
                images: '[]',
                specifications: '{}',
                options: '[]',
              },
            ],
          });
        }

        return stmt;
      });

      await repo.search({ status: 'active', hasStock: 'in_stock' }, { includeFilters: false });

      const countSql =
        db.prepare.mock.calls.find((call) => call[0].includes('COUNT(*) as total'))?.[0] || '';
      expect(countSql).not.toContain('FROM (');
    });
  });

  // ---------------------------------------------------------------
  // update — allowedFields 包含 spu
  // ---------------------------------------------------------------
  describe('updateWithMeta — spu', () => {
    it('应允许更新 spu 字段', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);
        if (sql.includes('UPDATE products')) {
          stmt.run.mockResolvedValue({ success: true, meta: { changes: 1 } });
        }
        return stmt;
      });

      const result = await repo.updateWithMeta('test-id', { spu: 'SPU-002' });
      expect(result.success).toBe(true);
      // SQL 应包含 spu =
      const updateCall = db.prepare.mock.calls.find((c) => c[0].includes('UPDATE'));
      expect(updateCall[0]).toContain('spu =');
    });

    it('应忽略 status 字段，避免写入 products.status', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);
        if (sql.includes('UPDATE products')) {
          stmt.run.mockResolvedValue({ success: true, meta: { changes: 1 } });
        }
        return stmt;
      });

      const result = await repo.updateWithMeta('test-id', { status: 'archived', name: 'Desk' });
      expect(result.success).toBe(true);
      const updateCall = db.prepare.mock.calls.find((c) => c[0].includes('UPDATE products'));
      expect(updateCall[0]).toContain('name =');
      expect(updateCall[0]).not.toContain('status =');
    });

    it('应拒绝更新非法 currency', async () => {
      const result = await repo.updateWithMeta('test-id', { currency: 'INVALID' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid currency code');
      expect(db.prepare).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // createBatch — spu 可选
  // ---------------------------------------------------------------
  describe('createBatch — spu 可选', () => {
    it('批量创建时只要 name 必填, spu 可选', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);
        stmt.run.mockResolvedValue({ meta: { changes: 1 } });
        return stmt;
      });
      db.batch.mockResolvedValue([{ success: true, meta: { changes: 1 } }]);

      const result = await repo.createBatch([{ name: 'Product A' }]);
      // 应成功而不是因缺少 sku 而报错
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
    });

    it('批量创建应过滤非法 currency 数据', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);
        stmt.run.mockResolvedValue({ meta: { changes: 1 } });
        return stmt;
      });
      db.batch.mockResolvedValue([{ success: true, meta: { changes: 1 } }]);

      const result = await repo.createBatch([
        { name: 'Valid Product', currency: 'USD' },
        { name: 'Invalid Product', currency: 'XYZ' },
      ]);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ error: 'Invalid currency code' })])
      );
    });

    it('批量创建超大商品集时应分块执行 D1 batch', async () => {
      db.prepare.mockImplementation((sql) => {
        const stmt = createPreparedStatement(sql);
        stmt.run.mockResolvedValue({ meta: { changes: 1 } });
        return stmt;
      });
      db.batch.mockImplementation(async (batchStatements) =>
        batchStatements.map(() => ({ success: true, meta: { changes: 1 } }))
      );

      const result = await repo.createBatch(
        Array.from({ length: 205 }, (_, index) => ({ name: `Product ${index}` }))
      );

      expect(result.success).toBe(true);
      expect(result.count).toBe(205);
      expect(db.batch).toHaveBeenCalledTimes(3);
      expect(db.batch.mock.calls.map(([batch]) => batch.length)).toEqual([100, 100, 5]);
    });
  });
});
