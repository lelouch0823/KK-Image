import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderRepository } from '../OrderRepository.js';
import { _resetFtsCache } from '../order/queries.js';

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

describe('OrderRepository', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    _resetFtsCache();
  });

  // ==========================================
  // findOrderNoById - 直接方法
  // ==========================================
  describe('findOrderNoById', () => {
    it('返回订单编号', async () => {
      const stmt = createStatement({ first: vi.fn(async () => ({ order_no: 'SO-001' })) });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new OrderRepository(db);

      const result = await repo.findOrderNoById('order-1');

      expect(result).toEqual({ order_no: 'SO-001' });
      expect(db.prepare).toHaveBeenCalledWith('SELECT order_no FROM orders WHERE id = ?');
      expect(stmt.bind).toHaveBeenCalledWith('order-1');
    });

    it('订单不存在时返回 null', async () => {
      const stmt = createStatement({ first: vi.fn(async () => null) });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new OrderRepository(db);

      const result = await repo.findOrderNoById('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ==========================================
  // findById - 委托到 queries.findById
  // ==========================================
  describe('findById', () => {
    it('返回订单详情（含行项）', async () => {
      const orderRow = {
        id: 'o-1',
        order_no: 'SO-1',
        salesperson_id: 'sp-1',
        customer_id: 'c-1',
        product_id: 'p-1',
        variant_id: 'v-1',
        status: 'confirmed',
        procurement_status: 'ordered',
        fulfillment_status: 'unfulfilled',
        delivery_status: 'not_shipped',
        unread_by_admin: 0,
        unread_by_sales: 0,
        original_data: '{}',
        current_data: '{}',
        main_image_key: null,
        main_image_blurhash: null,
        main_image_id: null,
        quantity: 3,
        created_at: 1000,
        updated_at: 2000,
        customer_name: '测试客户',
        customer_company: null,
        customer_phone: null,
      };

      const lineRow = {
        id: 'line-1',
        order_id: 'o-1',
        product_id: 'p-1',
        variant_id: 'v-1',
        snapshot_name: '商品A',
        snapshot_image: null,
        ordered_qty: 3,
        procured_qty: 0,
        received_qty: 0,
        reserved_qty: 0,
        shipped_qty: 0,
        cancelled_qty: 0,
        display_status: 'unprocured',
        created_at: 1000,
        updated_at: 2000,
      };

      const orderStmt = createStatement({ first: vi.fn(async () => orderRow) });
      const linesStmt = createStatement({ all: vi.fn(async () => ({ results: [lineRow] })) });
      const db = { prepare: vi.fn().mockReturnValueOnce(orderStmt).mockReturnValueOnce(linesStmt) };
      const repo = new OrderRepository(db);

      const result = await repo.findById('o-1');

      expect(result).not.toBeNull();
      expect(result.id).toBe('o-1');
      expect(result.orderNo).toBe('SO-1');
      expect(result.status).toBe('confirmed');
      expect(result.customer).toEqual({ name: '测试客户', company: null, phone: null });
      expect(result.lines).toHaveLength(1);
      expect(result.lines[0].orderedQuantity).toBe(3);
      expect(db.prepare).toHaveBeenCalledTimes(2);
    });

    it('订单不存在时返回 null', async () => {
      const orderStmt = createStatement({ first: vi.fn(async () => null) });
      const db = { prepare: vi.fn(() => orderStmt) };
      const repo = new OrderRepository(db);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
      // findById 返回 null 后不会查询行项
      expect(db.prepare).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================
  // findByIds - 委托到 queries.findByIds
  // ==========================================
  describe('findByIds', () => {
    it('批量查询订单核心字段', async () => {
      const stmt = createStatement({
        all: vi.fn(async () => ({
          results: [
            { id: 'o-1', order_no: 'SO-1', salesperson_id: 'sp-1', status: 'confirmed' },
            { id: 'o-2', order_no: 'SO-2', salesperson_id: 'sp-1', status: 'pending' },
          ],
        })),
      });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new OrderRepository(db);

      const result = await repo.findByIds(['o-1', 'o-2']);

      expect(result).toHaveLength(2);
      expect(result[0].order_no).toBe('SO-1');
      expect(result[1].status).toBe('pending');
      expect(db.prepare.mock.calls[0][0]).toContain('WHERE id IN (?,?)');
    });

    it('空 ID 列表返回空数组', async () => {
      const db = { prepare: vi.fn() };
      const repo = new OrderRepository(db);

      const result = await repo.findByIds([]);

      expect(result).toEqual([]);
      expect(db.prepare).not.toHaveBeenCalled();
    });

    it('null ID 列表返回空数组', async () => {
      const db = { prepare: vi.fn() };
      const repo = new OrderRepository(db);

      const result = await repo.findByIds(null);

      expect(result).toEqual([]);
      expect(db.prepare).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // getFileIds - 委托到 queries.getFileIds
  // ==========================================
  describe('getFileIds', () => {
    it('返回订单关联的文件 ID 列表', async () => {
      const stmt = createStatement({
        all: vi.fn(async () => ({
          results: [{ file_id: 'file-1' }, { file_id: 'file-2' }, { file_id: 'file-3' }],
        })),
      });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new OrderRepository(db);

      const result = await repo.getFileIds('order-1');

      expect(result).toEqual(['file-1', 'file-2', 'file-3']);
      expect(db.prepare.mock.calls[0][0]).toContain('order_files');
      expect(db.prepare.mock.calls[0][0]).toContain('ORDER BY sort_order');
      expect(stmt.bind).toHaveBeenCalledWith('order-1');
    });

    it('无关联文件时返回空数组', async () => {
      const stmt = createStatement({ all: vi.fn(async () => ({ results: [] })) });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new OrderRepository(db);

      const result = await repo.getFileIds('order-1');

      expect(result).toEqual([]);
    });
  });

  // ==========================================
  // listForAdmin - 委托到 queries.listForAdmin
  // ==========================================
  describe('listForAdmin', () => {
    it('返回管理员列表（带分页和总数）', async () => {
      const countStmt = createStatement({ first: vi.fn(async () => ({ total: 1 })) });
      const listStmt = createStatement({
        all: vi.fn(async () => ({
          results: [{
            id: 'o-1',
            order_no: 'SO-1',
            salesperson_id: 'sp-1',
            summary_name: '订单A',
            summary_brand: 'KK',
            summary_sku: 'SKU-1',
            status: 'confirmed',
            procurement_status: 'ordered',
            fulfillment_status: 'unfulfilled',
            delivery_status: 'not_shipped',
            display_status: 'ordered',
            product_id: 'p-1',
            variant_id: 'v-1',
            quantity: 5,
            line_ordered_qty: 5,
            line_shipped_qty: 0,
            line_returned_qty: 0,
            line_cancelled_qty: 0,
            is_unread: 0,
            main_image_id: null,
            created_at: 1000,
            updated_at: 2000,
            salesperson_name: '销售A',
            salesperson_store: '门店A',
            main_image_key: null,
            main_image_blurhash: null,
          }],
        })),
      });
      const db = { prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt) };
      const repo = new OrderRepository(db);

      const result = await repo.listForAdmin({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].salespersonName).toBe('销售A');
      expect(result.items[0].store).toBe('门店A');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('SQL 包含正确的列表字段', async () => {
      const countStmt = createStatement({ first: vi.fn(async () => ({ total: 0 })) });
      const listStmt = createStatement();
      const db = { prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt) };
      const repo = new OrderRepository(db);

      await repo.listForAdmin({ page: 1, limit: 20 });

      const listSql = db.prepare.mock.calls[1][0];
      expect(listSql).toContain('order_summary.display_status as display_status');
      expect(listSql).toContain('o.summary_name');
      expect(listSql).toContain('o.summary_brand');
      expect(listSql).toContain('salespersons s');
      expect(listSql).toContain('LIMIT ? OFFSET ?');
    });
  });

  // ==========================================
  // exportForAdmin - 委托到 queries.exportForAdmin
  // ==========================================
  describe('exportForAdmin', () => {
    it('返回导出数据列表', async () => {
      const stmt = createStatement({
        all: vi.fn(async () => ({
          results: [
            { id: 'o-1', order_no: 'SO-1', status: 'confirmed', salesperson_name: '销售A' },
            { id: 'o-2', order_no: 'SO-2', status: 'pending', salesperson_name: '销售B' },
          ],
        })),
      });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new OrderRepository(db);

      const result = await repo.exportForAdmin({ status: 'confirmed' });

      expect(result).toHaveLength(2);
      expect(result[0].order_no).toBe('SO-1');
    });

    it('按 ID 列表导出时 SQL 使用 IN 子句', async () => {
      const stmt = createStatement({ all: vi.fn(async () => ({ results: [] })) });
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new OrderRepository(db);

      await repo.exportForAdmin({ ids: ['o-1', 'o-2', 'o-3'] });

      const sql = db.prepare.mock.calls[0][0];
      expect(sql).toContain('1=1');
      expect(sql).toContain('o.id IN (?,');
      expect(stmt.params).toEqual(['o-1', 'o-2', 'o-3']);
    });
  });

  // ==========================================
  // markDelivered - 委托到 mutations.markDelivered
  // ==========================================
  describe('markDelivered', () => {
    it('构建标记交付的 UPDATE 语句', async () => {
      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new OrderRepository(db);

      const result = await repo.markDelivered('order-1', {
        timestamp: 1710000000000,
        deliveredBy: 'admin-1',
        note: '客户已签收',
      });

      expect(db.prepare.mock.calls[0][0]).toContain('UPDATE orders');
      expect(db.prepare.mock.calls[0][0]).toContain("delivery_status = 'delivered'");
      expect(result.params).toEqual([1710000000000, 'admin-1', '客户已签收', 1710000000000, 'order-1']);
    });

    it('省略可选参数时使用默认值', async () => {
      const stmt = createStatement();
      const db = { prepare: vi.fn(() => stmt) };
      const repo = new OrderRepository(db);

      await repo.markDelivered('order-1', { timestamp: 1710000000000 });

      expect(stmt.params).toEqual([1710000000000, null, '', 1710000000000, 'order-1']);
    });
  });
});
