import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestError } from '../../lib/hono/errors.js';
import { InventoryService } from '../InventoryService.js';

describe('InventoryService', () => {
  let variantRepo;
  let service;

  beforeEach(() => {
    variantRepo = {
      adjustStock: vi.fn(async () => true),
    };
    service = new InventoryService({}, variantRepo);
  });

  it('increments stock for purchase arrivals', async () => {
    await service.applyMutation({
      type: 'purchase_arrival',
      variantId: 'variant-1',
      quantityDelta: 5,
    });

    expect(variantRepo.adjustStock).toHaveBeenCalledWith('variant-1', 5);
  });

  it('decrements stock for shipment-style mutations', async () => {
    await service.applyMutation({
      type: 'order_shipment',
      variantId: 'variant-1',
      quantityDelta: -3,
    });

    expect(variantRepo.adjustStock).toHaveBeenCalledWith('variant-1', -3);
  });

  it('rejects invalid mutation payloads', async () => {
    await expect(service.applyMutation({
      type: 'not_real',
      variantId: '',
      quantityDelta: 0,
    })).rejects.toBeInstanceOf(BadRequestError);

    expect(variantRepo.adjustStock).not.toHaveBeenCalled();
  });

  it('preserves the non-negative stock floor through repository-level atomic updates', async () => {
    await service.applyMutation({
      type: 'manual_adjustment',
      variantId: 'variant-1',
      quantityDelta: -999,
    });

    expect(variantRepo.adjustStock).toHaveBeenCalledWith('variant-1', -999);
  });

  it('applies batched mutations and returns aggregate counts', async () => {
    const result = await service.applyBatch([
      { type: 'purchase_arrival', variantId: 'variant-1', quantityDelta: 5 },
      { type: 'manual_adjustment', variantId: 'variant-2', quantityDelta: -2 },
    ]);

    expect(result).toEqual({
      productCount: 2,
      totalQty: 7,
    });
    expect(variantRepo.adjustStock).toHaveBeenNthCalledWith(1, 'variant-1', 5);
    expect(variantRepo.adjustStock).toHaveBeenNthCalledWith(2, 'variant-2', -2);
  });

  it('updates projection balances when a DB handle is available', async () => {
    const run = vi.fn(async () => ({ meta: { changes: 1 } }));
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare };
    service = new InventoryService(db, variantRepo);

    await service.applyMutation({
      type: 'order_shipment',
      variantId: 'variant-1',
      quantityDelta: -3,
    });

    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE product_variants'));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO inventory_balances'));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO inventory_ledger'));
  });
});
