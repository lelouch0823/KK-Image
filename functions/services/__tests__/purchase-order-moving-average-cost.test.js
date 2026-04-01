import { describe, it, expect, vi } from 'vitest';
import { ProductVariantRepository } from '../../repositories/ProductVariantRepository.js';
import { PurchaseOrderService } from '../PurchaseOrderService.js';

function createDbForVariantRow(variantRow) {
  const updateStmt = {
    bind: vi.fn(() => updateStmt),
    run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
  };

  const selectStmt = {
    bind: vi.fn(() => selectStmt),
    first: vi.fn(async () => variantRow),
  };

  const db = {
    prepare: vi.fn((sql) => {
      if (sql.includes('SELECT stock_quantity, cost_price FROM product_variants')) {
        return selectStmt;
      }
      if (sql.includes('UPDATE product_variants SET cost_price = ?, updated_at = ? WHERE id = ?')) {
        return updateStmt;
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }),
    __selectStmt: selectStmt,
    __updateStmt: updateStmt,
  };

  return db;
}

function createDbForAllocateCosts(poRecord) {
  const poStmt = {
    bind: vi.fn(() => poStmt),
    first: vi.fn(async () => poRecord),
  };

  return {
    prepare: vi.fn((sql) => {
      if (sql.includes('SELECT * FROM purchase_orders WHERE id = ?')) {
        return poStmt;
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }),
  };
}

describe('moving average cost workflow', () => {
  it('updates variant cost by pre-arrival stock weighted formula', async () => {
    const db = createDbForVariantRow({ stock_quantity: 15, cost_price: 20 });
    const repo = new ProductVariantRepository(db);

    await repo.updateMovingAverageCost('v-1', 10, 300);

    expect(db.__updateStmt.bind).toHaveBeenCalledTimes(1);
    const [nextCost, updatedAt, variantId] = db.__updateStmt.bind.mock.calls[0];
    expect(nextCost).toBeCloseTo(26.6666667, 6);
    expect(typeof updatedAt).toBe('number');
    expect(variantId).toBe('v-1');
  });

  it('allocates landed cost and calls MAC update per actually received quantity', async () => {
    const db = createDbForAllocateCosts({
      id: 'po-1',
      allocation_method: 'by_quantity',
      actual_shipping_cost: 20,
      actual_tariff_cost: 10,
      estimated_shipping_cost: 0,
      estimated_tariff_cost: 0,
    });

    const service = new PurchaseOrderService(db);
    service.repo = {
      getItemsForAllocation: vi.fn(async () => [
        {
          id: 'i-1',
          variant_id: 'v-1',
          quantity: 5,
          received_qty: 2,
          unit_cost: 5,
        },
      ]),
      updateAllocations: vi.fn(async () => undefined),
    };
    service.variantRepo = {
      updateMovingAverageCost: vi.fn(async () => true),
    };

    await service.allocateCosts('po-1');

    expect(service.repo.updateAllocations).toHaveBeenCalledWith([
      { id: 'i-1', allocated_freight: 10, allocated_tariff: 5 },
    ]);
    expect(service.variantRepo.updateMovingAverageCost).toHaveBeenCalledWith('v-1', 2, 40);
  });

  it('bases by-value allocation ratios on received quantity instead of ordered quantity', async () => {
    const db = createDbForAllocateCosts({
      id: 'po-1',
      allocation_method: 'by_value',
      actual_shipping_cost: 70,
      actual_tariff_cost: 0,
      estimated_shipping_cost: 0,
      estimated_tariff_cost: 0,
    });

    const service = new PurchaseOrderService(db);
    service.repo = {
      getItemsForAllocation: vi.fn(async () => [
        {
          id: 'i-1',
          variant_id: 'v-1',
          quantity: 10,
          received_qty: 1,
          unit_cost: 10,
        },
        {
          id: 'i-2',
          variant_id: 'v-2',
          quantity: 10,
          received_qty: 3,
          unit_cost: 20,
        },
      ]),
      updateAllocations: vi.fn(async () => undefined),
    };
    service.variantRepo = {
      updateMovingAverageCost: vi.fn(async () => true),
    };

    await service.allocateCosts('po-1');

    expect(service.repo.updateAllocations).toHaveBeenCalledWith([
      { id: 'i-1', allocated_freight: 10, allocated_tariff: 0 },
      { id: 'i-2', allocated_freight: 20, allocated_tariff: 0 },
    ]);
    expect(service.variantRepo.updateMovingAverageCost).toHaveBeenNthCalledWith(1, 'v-1', 1, 20);
    expect(service.variantRepo.updateMovingAverageCost).toHaveBeenNthCalledWith(2, 'v-2', 3, 120);
  });

  it('skips MAC updates for items that have not been received yet', async () => {
    const db = createDbForAllocateCosts({
      id: 'po-1',
      allocation_method: 'by_quantity',
      actual_shipping_cost: 12,
      actual_tariff_cost: 8,
      estimated_shipping_cost: 0,
      estimated_tariff_cost: 0,
    });

    const service = new PurchaseOrderService(db);
    service.repo = {
      getItemsForAllocation: vi.fn(async () => [
        {
          id: 'i-1',
          variant_id: 'v-1',
          quantity: 5,
          received_qty: 0,
          unit_cost: 5,
        },
        {
          id: 'i-2',
          variant_id: 'v-2',
          quantity: 4,
          received_qty: 2,
          unit_cost: 6,
        },
      ]),
      updateAllocations: vi.fn(async () => undefined),
    };
    service.variantRepo = {
      updateMovingAverageCost: vi.fn(async () => true),
    };

    await service.allocateCosts('po-1');

    expect(service.repo.updateAllocations).toHaveBeenCalledWith([
      { id: 'i-1', allocated_freight: 0, allocated_tariff: 0 },
      { id: 'i-2', allocated_freight: 6, allocated_tariff: 4 },
    ]);
    expect(service.variantRepo.updateMovingAverageCost).toHaveBeenCalledTimes(1);
    expect(service.variantRepo.updateMovingAverageCost).toHaveBeenCalledWith('v-2', 2, 32);
  });
});
