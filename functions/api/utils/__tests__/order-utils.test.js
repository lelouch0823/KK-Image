import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  processOrderUpdate, 
  createOrderNotification, 
  updateOrderFiles
} from '../order-utils';

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
          currentData: { a: 1 },
          updates: { a: 1 },
          allowedFields: ['a'],
          actor: { id: 'a1', type: 'admin' }
        };
        const result = await processOrderUpdate(options);
        expect(result.hasChanges).toBe(false);
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
