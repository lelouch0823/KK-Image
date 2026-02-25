import { describe, it, expect, vi } from 'vitest';
import { PurchaseOrderRepository } from '../PurchaseOrderRepository.js';

describe('PurchaseOrderRepository variant required', () => {
  it('addItems should throw when variant_id is missing', async () => {
    const db = {
      prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn() })) })),
      batch: vi.fn(),
    };
    const repo = new PurchaseOrderRepository(db);

    await expect(repo.addItems('po-1', [{
      product_id: 'prod-1',
      quantity: 1,
      unit_cost: 2,
    }])).rejects.toThrow(/variant_id/i);
  });
});

