import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processOrderUpdate, updateOrderFiles } from '../order-utils';
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
      first: vi.fn().mockResolvedValue(null),
    };
    env = { DB: db };
  });

  describe('processOrderUpdate', () => {
    // ==== 现有基础测试 ====

    it('should handle admin with NO salespersonId', async () => {
      const options = {
        env,
        orderId: 'o1',
        orderNo: 'n1',
        currentData: { status: 'pending' },
        updates: { status: 'confirmed' },
        allowedFields: ['status'],
        actor: { id: 'a1', type: 'admin' },
        salespersonId: null,
        deferNotifications: true,
      };
      const res = await processOrderUpdate(options);
      expect(res.hasChanges).toBe(true);
    });

    it('should handle non-admin actor', async () => {
      const options = {
        env,
        orderId: 'o1',
        orderNo: 'n1',
        currentData: { status: 'pending' },
        updates: { status: 'confirmed' },
        allowedFields: ['status'],
        actor: { id: 's1', type: 'salesperson', name: 'S1' },
        deferNotifications: true,
      };
      const res = await processOrderUpdate(options);
      expect(res.hasChanges).toBe(true);
    });

    it('should return NO changes if updates identical', async () => {
      const options = {
        env,
        orderId: 'o1',
        orderNo: 'n1',
        currentData: { a: 1 },
        updates: { a: 1 },
        allowedFields: ['a'],
        actor: { id: 'a1', type: 'admin' },
        productId: undefined, // 明确表示没有变更产品ID
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
        orderId: 'o1',
        orderNo: 'n1',
        currentData: { name: 'productA' },
        updates: {}, // 数据字段未变更
        fileIds: undefined, // 文件未变更
        allowedFields: ['name'],
        actor: { id: 'a1', type: 'admin' },
        productId: 'pid_123', // 只有 productId 发生了变更（前端传入新的绑定）
        deferNotifications: true,
      };
      const result = await processOrderUpdate(options);
      expect(result.hasChanges).toBe(true);
      expect(result.success).toBe(true);
    });

    it('should handle combined updates of data and productId', async () => {
      const options = {
        env,
        orderId: 'o1',
        orderNo: 'n1',
        currentData: { name: 'productA', quantity: 1 },
        updates: { quantity: 5 }, // 数量变更
        allowedFields: ['name', 'quantity'],
        actor: { id: 's1', type: 'salesperson', name: 'S1' },
        productId: 'pid_456', // 产品关联变更
        deferNotifications: true,
      };
      const result = await processOrderUpdate(options);
      expect(result.hasChanges).toBe(true);
      expect(result.newData.quantity).toBe(5);
    });

    it('should treat variant-only update as change and forward variantId', async () => {
      const updateCompositeSpy = vi
        .spyOn(OrderRepository.prototype, 'updateComposite')
        .mockResolvedValue({ success: true });
      const updateDataSpy = vi
        .spyOn(OrderRepository.prototype, 'updateData')
        .mockResolvedValue({ success: true });
      const updateStatusSpy = vi
        .spyOn(OrderRepository.prototype, 'updateStatus')
        .mockResolvedValue({ success: true });
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
          currentProductId: 'product_1',
          deferNotifications: true,
        };

        const result = await processOrderUpdate(options);
        expect(result.hasChanges).toBe(true);
        expect(updateCompositeSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'o1',
            actorType: 'admin',
            variantId: 'variant_1',
          })
        );
        expect(updateDataSpy).not.toHaveBeenCalled();
        expect(updateStatusSpy).not.toHaveBeenCalled();
      } finally {
        updateCompositeSpy.mockRestore();
        updateDataSpy.mockRestore();
        updateStatusSpy.mockRestore();
      }
    });

    it('should use composite write path for core order updates', async () => {
      expect(typeof OrderRepository.prototype.updateComposite).toBe('function');
      const updateCompositeSpy = vi
        .spyOn(OrderRepository.prototype, 'updateComposite')
        .mockResolvedValue({ success: true });
      const updateDataSpy = vi
        .spyOn(OrderRepository.prototype, 'updateData')
        .mockResolvedValue({ success: true });
      const updateStatusSpy = vi
        .spyOn(OrderRepository.prototype, 'updateStatus')
        .mockResolvedValue({ success: true });
      try {
        const options = {
          env,
          orderId: 'o1',
          orderNo: 'n1',
          currentData: { status: 'pending', name: 'A' },
          updates: { status: 'confirmed', name: 'B' },
          allowedFields: ['status', 'name'],
          actor: { id: 'a1', type: 'admin', name: 'Admin' },
          salespersonId: 'sp-1',
          deferNotifications: true,
        };
        const result = await processOrderUpdate(options);
        expect(result.hasChanges).toBe(true);
        expect(updateCompositeSpy).toHaveBeenCalledTimes(1);
        expect(updateDataSpy).not.toHaveBeenCalled();
        expect(updateStatusSpy).not.toHaveBeenCalled();
      } finally {
        updateCompositeSpy.mockRestore();
        updateDataSpy.mockRestore();
        updateStatusSpy.mockRestore();
      }
    });

    it('should not treat persisted currentData.lines as an explicit line rewrite during ordinary quantity edits', async () => {
      const updateCompositeSpy = vi
        .spyOn(OrderRepository.prototype, 'updateComposite')
        .mockResolvedValue({ success: true });
      try {
        const options = {
          env,
          orderId: 'o-lines',
          orderNo: 'n-lines',
          currentData: {
            status: 'pending',
            quantity: 1,
            lines: [
              {
                name: 'Line A',
                quantity: 1,
                productId: 'p-1',
                variantId: 'v-1',
              },
            ],
          },
          updates: { quantity: 2, remark: 'updated' },
          allowedFields: ['status', 'quantity', 'remark', 'lines'],
          actor: { id: 'a1', type: 'admin', name: 'Admin' },
          deferNotifications: true,
        };

        const result = await processOrderUpdate(options);
        expect(result.hasChanges).toBe(true);
        expect(updateCompositeSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'o-lines',
            explicitLineMutation: false,
            newData: expect.objectContaining({
              quantity: 2,
              lines: [
                expect.objectContaining({
                  quantity: 1,
                  variantId: 'v-1',
                }),
              ],
            }),
          })
        );
      } finally {
        updateCompositeSpy.mockRestore();
      }
    });

    it('should not create notification when composite write fails', async () => {
      expect(typeof OrderRepository.prototype.updateComposite).toBe('function');
      const updateCompositeSpy = vi
        .spyOn(OrderRepository.prototype, 'updateComposite')
        .mockRejectedValue(new Error('db failed'));
      try {
        const options = {
          env,
          orderId: 'o1',
          orderNo: 'n1',
          currentData: { status: 'pending', name: 'A' },
          updates: { status: 'confirmed', name: 'B' },
          allowedFields: ['status', 'name'],
          actor: { id: 'a1', type: 'admin', name: 'Admin' },
          salespersonId: 'sp-1',
          deferNotifications: true,
        };
        await expect(processOrderUpdate(options)).rejects.toThrow('db failed');
      } finally {
        updateCompositeSpy.mockRestore();
      }
    });

    it('should defer notifications into outbox event descriptors when requested', async () => {
      expect(typeof OrderRepository.prototype.updateComposite).toBe('function');
      const updateCompositeSpy = vi
        .spyOn(OrderRepository.prototype, 'updateComposite')
        .mockResolvedValue({ success: true });
      try {
        const options = {
          env,
          orderId: 'o1',
          orderNo: 'n1',
          currentData: { status: 'pending', name: 'A' },
          updates: { status: 'confirmed', name: 'B' },
          allowedFields: ['status', 'name'],
          actor: { id: 'a1', type: 'admin', name: 'Admin' },
          salespersonId: 'sp-1',
          deferNotifications: true,
        };

        const result = await processOrderUpdate(options);
        expect(result.hasChanges).toBe(true);
        expect(result.outboxEvents).toEqual([
          expect.objectContaining({
            event_type: 'order_updated_by_admin',
            payload: expect.objectContaining({
              order_id: 'o1',
              order_no: 'n1',
              salesperson_id: 'sp-1',
              actor_name: 'Admin',
            }),
          }),
        ]);
      } finally {
        updateCompositeSpy.mockRestore();
      }
    });

    it('should reject changed updates unless notification handling is explicitly deferred to outbox', async () => {
      expect(typeof OrderRepository.prototype.updateComposite).toBe('function');
      const updateCompositeSpy = vi
        .spyOn(OrderRepository.prototype, 'updateComposite')
        .mockResolvedValue({ success: true });
      try {
        await expect(
          processOrderUpdate({
            env,
            orderId: 'o1',
            orderNo: 'n1',
            currentData: { status: 'pending', name: 'A' },
            updates: { status: 'confirmed', name: 'B' },
            allowedFields: ['status', 'name'],
            actor: { id: 'a1', type: 'admin', name: 'Admin' },
            salespersonId: 'sp-1',
          })
        ).rejects.toThrow(/deferNotifications: true/i);
      } finally {
        updateCompositeSpy.mockRestore();
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
