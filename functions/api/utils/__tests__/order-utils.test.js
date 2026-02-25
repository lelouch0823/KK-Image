import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  processOrderUpdate,
  createOrderNotification,
  updateOrderFiles
} from '../order-utils';
import { OrderRepository } from '../../../repositories/OrderRepository.js';

describe('Order Utils Full Coverage Final', () => {
  let db;
  let env;

  beforeEach(() => {
    vi.clearAllMocks();
    db = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      batch: vi.fn().mockResolvedValue([]),
      first: vi.fn().mockResolvedValue(null)
    };
    env = { DB: db };
  });

  describe('createOrderNotification', () => {
    it('should cover all branch paths', async () => {
      await createOrderNotification(db, { event: 'ORDER_CREATED', orderId: 'o1', orderNo: 'n1', receiver: 'admin' });
      await createOrderNotification(db, { event: 'ORDER_STATUS_CHANGED', orderId: 'o1', orderNo: 'n1', receiver: 'admin', extra: { status: 'shipped' } });
      expect(db.prepare).toHaveBeenCalled();
    });
  });

  describe('processOrderUpdate', () => {
    // ==== 现有基础测试 ====

    it('should handle admin with NO salespersonId', async () => {
      const options = {
        env, orderId: 'o1', orderNo: 'n1',
        currentData: { status: 'pending' }, updates: { status: 'completed' },
        allowedFields: ['status'],
        actor: { id: 'a1', type: 'admin' },
        salespersonId: null
      };
      const res = await processOrderUpdate(options);
      expect(res.hasChanges).toBe(true);
    });

    it('should handle non-admin actor', async () => {
      const options = {
        env, orderId: 'o1', orderNo: 'n1',
        currentData: { status: 'pending' }, updates: { status: 'shipped' },
        allowedFields: ['status'],
        actor: { id: 's1', type: 'salesperson', name: 'S1' }
      };
      const res = await processOrderUpdate(options);
      expect(res.hasChanges).toBe(true);
    });

    it('should return NO changes if updates identical', async () => {
      const options = {
        env,
        orderId: 'o1', orderNo: 'n1',
        currentData: { a: 1 },
        updates: { a: 1 },
        allowedFields: ['a'],
        actor: { id: 'a1', type: 'admin' },
        productId: undefined // 明确表示没有变更产品ID
      };
      const result = await processOrderUpdate(options);
      expect(result.hasChanges).toBe(false);
      // 确保没有触发数据库更新
      // (在内部 processOrderUpdate 调用的是通过 new 实例化的 OrderRepository)
    });

    // ==== 针对 productId 关联变更的新增测试 ====

    it('should return changes if ONLY productId is updated (Critical Bug Fix)', async () => {
      const options = {
        env,
        orderId: 'o1', orderNo: 'n1',
        currentData: { name: 'productA' },
        updates: {}, // 数据字段未变更
        fileIds: undefined, // 文件未变更
        allowedFields: ['name'],
        actor: { id: 'a1', type: 'admin' },
        productId: 'pid_123' // 只有 productId 发生了变更（前端传入新的绑定）
      };
      const result = await processOrderUpdate(options);
      expect(result.hasChanges).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should handle combined updates of data and productId', async () => {
      const options = {
        env,
        orderId: 'o1', orderNo: 'n1',
        currentData: { name: 'productA', quantity: 1 },
        updates: { quantity: 5 }, // 数量变更
        allowedFields: ['name', 'quantity'],
        actor: { id: 's1', type: 'salesperson', name: 'S1' },
        productId: 'pid_456' // 产品关联变更
      };
      const result = await processOrderUpdate(options);
      expect(result.hasChanges).toBe(true);
      expect(result.newData.quantity).toBe(5);
    });

    it('should treat variant-only update as change and forward variantId', async () => {
      const updateDataSpy = vi.spyOn(OrderRepository.prototype, 'updateData').mockResolvedValue({ success: true });
      const updateStatusSpy = vi.spyOn(OrderRepository.prototype, 'updateStatus').mockResolvedValue({ success: true });
      try {
        const options = {
          env,
          orderId: 'o1',
          orderNo: 'n1',
          currentData: { name: 'productA' },
          updates: {},
          fileIds: undefined,
          allowedFields: ['name'],
          actor: { id: 'a1', type: 'admin', name: 'Admin' },
          productId: undefined,
          variantId: 'variant_1',
          currentProductId: 'product_1'
        };

        const result = await processOrderUpdate(options);
        expect(result.hasChanges).toBe(true);
        expect(updateDataSpy).toHaveBeenCalledWith('o1', expect.any(Object), 'admin', undefined, 'variant_1');
      } finally {
        updateDataSpy.mockRestore();
        updateStatusSpy.mockRestore();
      }
    });
  });

  describe('updateOrderFiles', () => {
    it('should handle archiving when fileIds change', async () => {
      db.all.mockResolvedValueOnce({ results: [{ file_id: 'old' }] });
      const res = await updateOrderFiles(env, 'o1', 'n1', ['new'], { id: 'a1', type: 'admin' });
      expect(res).toBe(true);
    });
  });
});
