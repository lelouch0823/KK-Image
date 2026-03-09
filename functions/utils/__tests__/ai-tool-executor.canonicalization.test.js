import { describe, expect, it, vi } from 'vitest';
import { executeAITool } from '../ai-tool-executor.js';

describe('executeAITool canonical api-first extensions', () => {
  it('returns customer orders through the order repository', async () => {
    const orderRepo = {
      listForAdmin: vi.fn().mockResolvedValue({
        items: [{ id: 'ord-1' }, { id: 'ord-2' }],
        total: 2,
      }),
    };

    const result = await executeAITool('getCustomerOrders', { customerId: 'cus-1', limit: 5 }, { orderRepo });

    expect(orderRepo.listForAdmin).toHaveBeenCalledWith({
      customerId: 'cus-1',
      limit: 5,
      page: 1,
    });
    expect(result.total).toBe(2);
  });

  it('returns purchase suggestions through the purchase-order service boundary', async () => {
    const purchaseOrderService = {
      getSuggestions: vi.fn().mockResolvedValue([{ variant_id: 'var-1', shortage: 8 }]),
    };

    const result = await executeAITool('getPurchaseSuggestions', {}, { purchaseOrderService });

    expect(purchaseOrderService.getSuggestions).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        items: [{ variant_id: 'var-1', shortage: 8 }],
        total: 1,
      })
    );
  });
});
