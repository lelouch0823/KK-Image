import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductRepository } from '../ProductRepository.js';
import { clearFtsCache } from '../../api/utils/fts.js';

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

describe('ProductRepository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearFtsCache();
  });

  // ==========================================
  // findById
  // ==========================================
  describe('findById', () => {
    it('返回解析后的商品详情', async () => {
      const stmt = createStatement({
        first: vi.fn(async () => ({
          id: 'prod-1',
          name: '测试商品',
          spu: 'SPU-001',
          brand: 'KK',
          category: '家具',
          series: '经典',
          currency: 'CNY',
          description: '描述',
          images: '["img1.jpg","img2.jpg"]',
          specifications: '{"color":"红色"}',
          options: '["S","M","L"]',
          status: 'active',
          price: 99.9,
          cost_price: 50,
          stock_quantity: 100,
          available_quantity: 80,
          alert_threshold: 10,
          created_at: 1000,
          updated_at: 2000,
        })),
      });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new ProductRepository(db);

      const result = await repo.findById('prod-1');

      expect(result).not.toBeNull();
      expect(result.id).toBe('prod-1');
      expect(result.name).toBe('测试商品');
      expect(result.images).toEqual(['img1.jpg', 'img2.jpg']);
      expect(result.specifications).toEqual({ color: '红色' });
      expect(result.options).toEqual(['S', 'M', 'L']);
      expect(result.price).toBe(99.9);
    });

    it('商品不存在时返回 null', async () => {
      const stmt = createStatement({ first: vi.fn(async () => null) });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new ProductRepository(db);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });

    it('JSON 字段解析失败时返回安全默认值', async () => {
      const stmt = createStatement({
        first: vi.fn(async () => ({
          id: 'prod-1',
          name: '商品',
          images: 'invalid-json',
          specifications: 'invalid-json',
          options: 'invalid-json',
        })),
      });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new ProductRepository(db);

      const result = await repo.findById('prod-1');

      expect(result.images).toEqual([]);
      expect(result.specifications).toEqual({});
      expect(result.options).toEqual([]);
    });
  });

  // ==========================================
  // searchVariants
  // ==========================================
  describe('searchVariants', () => {
    it('返回分页的活跃变体列表', async () => {
      const countStmt = createStatement({ first: vi.fn(async () => ({ total: 2 })) });
      const listStmt = createStatement({
        all: vi.fn(async () => ({
          results: [
            {
              variant_id: 'v-1',
              product_id: 'p-1',
              product_name: '商品A',
              brand: 'KK',
              spu: 'SPU-1',
              product_images: '["img1.jpg"]',
              variant_sku: 'SKU-1',
              variant_code: 'VC-1',
              variant_options: '{"size":"M"}',
              cost_price: 50,
              stock_quantity: 100,
              available_quantity: 80,
              alert_threshold: 10,
              moq: 1,
              pack_size: 1,
              order_step: 1,
              variant_image_id: 'img-1',
            },
            {
              variant_id: 'v-2',
              product_id: 'p-2',
              product_name: '商品B',
              brand: 'Test',
              spu: 'SPU-2',
              product_images: '[]',
              variant_sku: 'SKU-2',
              variant_code: null,
              variant_options: '{}',
              cost_price: 30,
              stock_quantity: 0,
              available_quantity: 0,
              alert_threshold: 5,
              moq: null,
              pack_size: null,
              order_step: null,
              variant_image_id: null,
            },
          ],
        })),
      });
      const db = { prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt) };
      const repo = new ProductRepository(db);

      const result = await repo.searchVariants({ search: '商品', page: 1, limit: 50 });

      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].variant_id).toBe('v-1');
      expect(result.items[0].product_name).toBe('商品A');
      expect(result.items[0].sku).toBe('SKU-1');
      expect(result.items[0].variant_options).toEqual({ size: 'M' });
      expect(result.items[0].unit_cost).toBe(50);
      expect(result.items[0].image).toBe('img-1');
      expect(result.items[1].image).toBeNull();
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });

    it('搜索关键词为空时查询所有活跃变体', async () => {
      const countStmt = createStatement({ first: vi.fn(async () => ({ total: 0 })) });
      const listStmt = createStatement();
      const db = { prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt) };
      const repo = new ProductRepository(db);

      await repo.searchVariants({});

      const listSql = db.prepare.mock.calls[1][0];
      expect(listSql).toContain('WHERE pv.status = ?');
      expect(listSql).not.toContain('LIKE');
      expect(listStmt.params).toEqual(['active', 50, 0]);
    });

    it('有搜索关键词时使用 LIKE 过滤', async () => {
      const countStmt = createStatement({ first: vi.fn(async () => ({ total: 0 })) });
      const listStmt = createStatement();
      const db = { prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt) };
      const repo = new ProductRepository(db);

      await repo.searchVariants({ search: '测试' });

      const listSql = db.prepare.mock.calls[1][0];
      expect(listSql).toContain('LIKE');
      expect(countStmt.params[1]).toBe('%测试%');
    });
  });

  // ==========================================
  // listAvailableBrands
  // ==========================================
  describe('listAvailableBrands', () => {
    it('返回去重排序的品牌列表', async () => {
      // 无 search 过滤时 _hasFtsTable 不被调用，prepare 仅调用一次
      const brandStmt = createStatement({
        all: vi.fn(async () => ({
          results: [{ brand: 'KK' }, { brand: 'Test' }, { brand: 'Alpha' }],
        })),
      });
      const db = { prepare: vi.fn(() => brandStmt) };
      const repo = new ProductRepository(db);

      const result = await repo.listAvailableBrands();

      expect(result).toEqual(['KK', 'Test', 'Alpha']);
      const brandSql = db.prepare.mock.calls[0][0];
      expect(brandSql).toContain('SELECT DISTINCT p.brand');
      expect(brandSql).toContain('p.brand IS NOT NULL');
      expect(brandSql).toContain('ORDER BY p.brand COLLATE NOCASE');
    });

    it('无品牌时返回空数组', async () => {
      const brandStmt = createStatement({ all: vi.fn(async () => ({ results: [] })) });
      const db = { prepare: vi.fn(() => brandStmt) };
      const repo = new ProductRepository(db);

      const result = await repo.listAvailableBrands();

      expect(result).toEqual([]);
    });

    it('带过滤条件时传递参数', async () => {
      // status/category 过滤不触发 _hasFtsTable，prepare 调用一次
      const brandStmt = createStatement({ all: vi.fn(async () => ({ results: [] })) });
      const db = { prepare: vi.fn(() => brandStmt) };
      const repo = new ProductRepository(db);

      await repo.listAvailableBrands({ status: 'active', category: '家具' });

      const brandParams = brandStmt.params;
      expect(brandParams).toContain('家具');
      expect(db.prepare.mock.calls[0][0]).toContain('COALESCE(pp.active_variant_count, 0) > 0');
    });
  });

  describe('updateStatus', () => {
    it('更新变体状态后刷新商品投影', async () => {
      const db = {
        prepare: vi.fn((sql) => {
          const stmt = createStatement({
            run: vi.fn(async () => ({ success: true, meta: { changes: 2 } })),
          });
          stmt.sql = sql;
          return stmt;
        }),
        batch: vi.fn(async () => [{ success: true }, { success: true }]),
      };
      const repo = new ProductRepository(db);

      const result = await repo.updateStatus('prod-1', 'archived');

      expect(result.success).toBe(true);
      expect(
        db.prepare.mock.calls.some((call) => call[0].includes('UPDATE product_variants'))
      ).toBe(true);
      expect(
        db.prepare.mock.calls.some((call) => call[0].includes('DELETE FROM product_projection'))
      ).toBe(true);
      expect(
        db.prepare.mock.calls.some((call) => call[0].includes('INSERT INTO product_projection'))
      ).toBe(true);
      expect(db.batch).toHaveBeenCalledTimes(1);
    });
  });
});
