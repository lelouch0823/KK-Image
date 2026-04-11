import { describe, it, expect, vi } from 'vitest';
import { PurchaseOrderService } from '../PurchaseOrderService.js';

function createDbForSuggestions(results) {
  const stmt = {
    bind: vi.fn(() => stmt),
    all: vi.fn(async () => ({ results })),
  };
  return {
    prepare: vi.fn(() => stmt),
  };
}

describe('PurchaseOrderService variant dimension', () => {
  it('getSuggestions should aggregate by variant and expose variant_id', async () => {
    const db = createDbForSuggestions([{
      variant_id: 'var-1',
      product_id: 'prod-1',
      product_code: 'P0001',
      variant_code: 'V0001',
      product_name: 'Tee',
      sku: 'TEE-YELLOW-S',
      brand: 'KK',
      cost_price: 12.5,
      stock_quantity: 3,
      total_demand: 8,
      shortage: 5,
      order_count: 2,
      order_ids: 'o-1,o-2',
      images: '[]',
    }]);
    const service = new PurchaseOrderService(db);

    const suggestions = await service.getSuggestions();
    const sqlCalls = db.prepare.mock.calls.map(call => call[0]);

    expect(sqlCalls.some(sql => sql.includes('FROM product_variants pv'))).toBe(true);
    expect(sqlCalls.some(sql => sql.includes('JOIN products p ON pv.product_id = p.id'))).toBe(true);
    expect(sqlCalls.some(sql => sql.includes('WHERE pv.id IN'))).toBe(true);
    expect(suggestions[0].variant_id).toBe('var-1');
    expect(suggestions[0].product_code).toBe('P0001');
    expect(suggestions[0].variant_code).toBe('V0001');
  });

  it('createFromOrders should carry variant_id into PO items', async () => {
    const mockAll = vi.fn(async () => ({
      results: [{
        id: 'o-1',
        order_no: 'SO-1',
        product_id: 'prod-1',
        variant_id: 'var-1',
        quantity: 2,
        name: 'Tee',
        sku: 'TEE-YELLOW-S',
        cost_price: 11,
      }],
    }));
    const stmt = {
      bind: vi.fn(() => stmt),
      all: mockAll,
    };
    const db = { prepare: vi.fn(() => stmt) };
    const service = new PurchaseOrderService(db);
    service.repo = {
      create: vi.fn(async () => ({ id: 'po-1' })),
      addItems: vi.fn(async () => []),
      findById: vi.fn(async () => ({ id: 'po-1', items: [] })),
    };

    await service.createFromOrders(['o-1']);

    expect(service.repo.addItems).toHaveBeenCalledWith('po-1', [
      expect.objectContaining({
        product_id: 'prod-1',
        variant_id: 'var-1',
      }),
    ]);
  });

  it('createFromOrders chunks order lookups beyond the D1 variable limit', async () => {
    const queryBinds = [];
    const db = {
      prepare: vi.fn((sql) => ({
        bind: (...args) => {
          if (sql.includes('FROM orders o')) {
            queryBinds.push(args);
          }
          return {
            all: vi.fn(async () => ({
              results: sql.includes('FROM orders o')
                ? args.map((orderId) => ({
                    id: orderId,
                    order_no: `SO-${orderId}`,
                    product_id: `prod-${orderId}`,
                    variant_id: `var-${orderId}`,
                    quantity: 2,
                    name: `Product ${orderId}`,
                    sku: `SKU-${orderId}`,
                    cost_price: 11,
                  }))
                : [],
            })),
          };
        },
      })),
    };
    const service = new PurchaseOrderService(db);
    service.repo = {
      create: vi.fn(async () => ({ id: 'po-1' })),
      addItems: vi.fn(async () => []),
      findById: vi.fn(async () => ({ id: 'po-1', items: [] })),
    };
    const orderIds = Array.from({ length: 105 }, (_, index) => `order-${index + 1}`);

    await service.createFromOrders(orderIds);

    expect(queryBinds.length).toBeGreaterThan(1);
    expect(Math.max(...queryBinds.map((args) => args.length))).toBeLessThanOrEqual(100);
    expect(service.repo.addItems).toHaveBeenCalledWith(
      'po-1',
      expect.arrayContaining([
        expect.objectContaining({ pre_order_id: 'order-1', variant_id: 'var-order-1' }),
        expect.objectContaining({ pre_order_id: 'order-105', variant_id: 'var-order-105' }),
      ])
    );
  });

  it('createFromOrders rejects orders already linked to another active purchase order', async () => {
    const stmt = {
      bind: vi.fn(() => stmt),
      all: vi.fn(async () => ({
        results: [{
          id: 'o-1',
          order_no: 'SO-1',
          product_id: 'prod-1',
          variant_id: 'var-1',
          quantity: 2,
          name: 'Tee',
          sku: 'TEE-YELLOW-S',
          cost_price: 11,
        }],
      })),
    };
    const db = { prepare: vi.fn(() => stmt) };
    const service = new PurchaseOrderService(db);
    service.repo = {
      create: vi.fn(async () => ({ id: 'po-1' })),
      addItems: vi.fn(async () => []),
      findById: vi.fn(async () => ({ id: 'po-1', items: [] })),
      findActiveBindingsByPreOrderIds: vi.fn(async () => [{
        pre_order_id: 'o-1',
        po_id: 'po-existing',
        po_no: 'PO-EXISTING',
        po_status: 'draft',
      }]),
    };

    await expect(service.createFromOrders(['o-1'])).rejects.toThrow('SO-1 已在采购单 PO-EXISTING 中');
    expect(service.repo.create).not.toHaveBeenCalled();
    expect(service.repo.addItems).not.toHaveBeenCalled();
  });

  it('createFromOrders cleans up the created draft when item insertion fails', async () => {
    const stmt = {
      bind: vi.fn(() => stmt),
      all: vi.fn(async () => ({
        results: [{
          id: 'o-1',
          order_no: 'SO-1',
          product_id: 'prod-1',
          variant_id: 'var-1',
          quantity: 2,
          name: 'Tee',
          sku: 'TEE-YELLOW-S',
          cost_price: 11,
        }],
      })),
    };
    const db = { prepare: vi.fn(() => stmt) };
    const service = new PurchaseOrderService(db);
    const insertionError = new Error('insert items failed');
    service.repo = {
      create: vi.fn(async () => ({ id: 'po-1' })),
      addItems: vi.fn(async () => {
        throw insertionError;
      }),
      findById: vi.fn(async () => ({ id: 'po-1', items: [] })),
      findActiveBindingsByPreOrderIds: vi.fn(async () => []),
      deleteIfEmptyDraft: vi.fn(async () => true),
    };

    await expect(service.createFromOrders(['o-1'])).rejects.toThrow('insert items failed');

    expect(service.repo.deleteIfEmptyDraft).toHaveBeenCalledWith('po-1');
    expect(service.repo.findById).not.toHaveBeenCalled();
  });

  it('createFromOrders deduplicates repeated order ids before building purchase-order items', async () => {
    const queryBinds = [];
    const db = {
      prepare: vi.fn((sql) => ({
        bind: (...args) => {
          if (sql.includes('FROM orders o')) {
            queryBinds.push(args);
          }
          return {
            all: vi.fn(async () => ({
              results: sql.includes('FROM orders o')
                ? [{ id: 'o-1', order_no: 'SO-1', product_id: 'prod-1', variant_id: 'var-1', quantity: 2, name: 'Tee', sku: 'TEE-1', cost_price: 11 }]
                : [],
            })),
          };
        },
      })),
    };
    const service = new PurchaseOrderService(db);
    service.repo = {
      create: vi.fn(async () => ({ id: 'po-1' })),
      addItems: vi.fn(async () => []),
      findById: vi.fn(async () => ({ id: 'po-1', items: [] })),
      findActiveBindingsByPreOrderIds: vi.fn(async () => []),
      deleteIfEmptyDraft: vi.fn(async () => true),
    };

    await service.createFromOrders(['o-1', 'o-1', 'o-1']);

    expect(queryBinds).toEqual([['o-1']]);
    expect(service.repo.addItems).toHaveBeenCalledWith('po-1', [
      expect.objectContaining({ pre_order_id: 'o-1', variant_id: 'var-1' }),
    ]);
  });

  it('createFromOrders rejects partial matches when some requested orders are no longer eligible', async () => {
    const stmt = {
      bind: vi.fn(() => stmt),
      all: vi.fn(async () => ({
        results: [{
          id: 'o-1',
          order_no: 'SO-1',
          product_id: 'prod-1',
          variant_id: 'var-1',
          quantity: 2,
          name: 'Tee',
          sku: 'TEE-YELLOW-S',
          cost_price: 11,
        }],
      })),
    };
    const db = { prepare: vi.fn(() => stmt) };
    const service = new PurchaseOrderService(db);
    service.repo = {
      create: vi.fn(async () => ({ id: 'po-1' })),
      addItems: vi.fn(async () => []),
      findById: vi.fn(async () => ({ id: 'po-1', items: [] })),
      findActiveBindingsByPreOrderIds: vi.fn(async () => []),
      deleteIfEmptyDraft: vi.fn(async () => true),
    };

    await expect(service.createFromOrders(['o-1', 'o-missing'])).rejects.toThrow(/o-missing|SO-1|订单/i);

    expect(service.repo.create).not.toHaveBeenCalled();
    expect(service.repo.addItems).not.toHaveBeenCalled();
  });

  it('_updateInventory should reject items without variant_id', async () => {
    const db = {
      prepare: vi.fn(() => ({ bind: vi.fn() })),
      batch: vi.fn(),
    };
    const service = new PurchaseOrderService(db);

    await expect(service._updateInventory([
      { product_id: 'prod-1', quantity: 3 },
    ], 'increment')).rejects.toThrow(/variant_id/i);
  });

  it('_updateInventory should pass purchase order source refs into inventory mutations', async () => {
    const db = {
      prepare: vi.fn(() => ({ bind: vi.fn() })),
      batch: vi.fn(),
    };
    const service = new PurchaseOrderService(db);
    service.inventoryService = {
      applyBatch: vi.fn(async () => ({ productCount: 1, totalQty: 3 })),
    };

    await service._updateInventory(
      [{ product_id: 'prod-1', variant_id: 'var-1', quantity: 3 }],
      'increment',
      { referenceType: 'purchase_order', referenceId: 'po-1' }
    );

    expect(service.inventoryService.applyBatch).toHaveBeenCalledWith([
      {
        type: 'purchase_arrival',
        variantId: 'var-1',
        quantityDelta: 3,
        referenceType: 'purchase_order',
        referenceId: 'po-1',
      },
    ]);
  });

  it('does not increment inventory when a purchase order transitions to arrived', async () => {
    const stmt = { bind: vi.fn(() => stmt) };
    const db = { prepare: vi.fn(() => stmt), batch: vi.fn() };
    const service = new PurchaseOrderService(db);
    service.repo = {
      findById: vi.fn(async () => ({
        id: 'po-1',
        status: 'shipping',
        ordered_qty: 4,
        received_qty: 4,
        cancelled_qty: 0,
        outstanding_qty: 0,
        items: [{ variant_id: 'v-1', quantity: 4 }],
      })),
      updateStatus: vi.fn(async () => true),
      updateStatusIfCurrent: vi.fn(async () => true),
      getLinkedOrderIds: vi.fn(async () => []),
    };
    service._updateInventory = vi.fn(async () => ({ productCount: 1, totalQty: 4 }));

    await service.updateStatus('po-1', 'arrived');

    expect(service._updateInventory).not.toHaveBeenCalled();
  });

  it('does not cascade procurement_status when arriving without direct inventory mutations', async () => {
    const stmt = { bind: vi.fn(() => stmt) };
    const sqlCalls = [];
    const db = {
      prepare: vi.fn((sql) => {
        sqlCalls.push(sql);
        return stmt;
      }),
      batch: vi.fn(async () => [{ meta: { changes: 1 } }]),
    };
    const service = new PurchaseOrderService(db);
    service.repo = {
      findById: vi.fn(async () => ({
        id: 'po-1',
        status: 'shipping',
        ordered_qty: 0,
        received_qty: 0,
        cancelled_qty: 0,
        outstanding_qty: 0,
        items: [],
      })),
      updateStatus: vi.fn(async () => true),
      updateStatusIfCurrent: vi.fn(async () => true),
      getLinkedOrderIds: vi.fn(async () => ['o-1']),
    };

    const result = await service.updateStatus('po-1', 'arrived');

    expect(result.cascadedOrders).toBe(0);
    expect(result.stockUpdated).toBe(0);
    expect(result.totalStockAdded).toBe(0);
    expect(sqlCalls.some(sql => sql.includes('procurement_status'))).toBe(false);
  });

  it('rejects cancelling an arrived purchase order without touching inventory', async () => {
    const db = {
      prepare: vi.fn(() => ({ bind: vi.fn(() => ({ run: vi.fn() })) })),
      batch: vi.fn(),
    };
    const service = new PurchaseOrderService(db);
    service.repo = {
      findById: vi.fn(async () => ({
        id: 'po-1',
        status: 'arrived',
        items: [{ variant_id: 'v-1', quantity: 5 }],
      })),
      updateStatus: vi.fn(async () => true),
      updateStatusIfCurrent: vi.fn(async () => true),
      getLinkedOrderIds: vi.fn(async () => []),
    };
    service._updateInventory = vi.fn();

    await expect(service.updateStatus('po-1', 'cancelled')).rejects.toThrow(/arrived/);
    expect(service._updateInventory).not.toHaveBeenCalled();
  });

  it('createManual rejects mismatched product and variant pairs before creating a draft', async () => {
    const db = {
      prepare: vi.fn((sql) => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({
            results: sql.includes('FROM product_variants')
              ? [{
                  id: 'var-1',
                  product_id: 'prod-1',
                  status: 'active',
                  moq: 1,
                  pack_size: 1,
                  order_step: 1,
                }]
              : [],
          })),
        })),
      })),
    };
    const service = new PurchaseOrderService(db);
    service.repo = {
      create: vi.fn(async () => ({ id: 'po-1' })),
      addItems: vi.fn(async () => []),
      findById: vi.fn(async () => ({ id: 'po-1', items: [] })),
      findActiveBindingsByPreOrderIds: vi.fn(async () => []),
    };

    await expect(service.createManual(
      { remark: 'ai manual' },
      [{ product_id: 'prod-x', variant_id: 'var-1', quantity: 2, unit_cost: 11 }]
    )).rejects.toThrow('variant_id 与 product_id 不匹配');

    expect(service.repo.create).not.toHaveBeenCalled();
    expect(service.repo.addItems).not.toHaveBeenCalled();
  });

  it('createManual rejects negative unit_cost before creating a draft', async () => {
    const db = {
      prepare: vi.fn((sql) => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({
            results: sql.includes('FROM product_variants')
              ? [{
                  id: 'var-1',
                  product_id: 'prod-1',
                  status: 'active',
                  moq: 1,
                  pack_size: 1,
                  order_step: 1,
                }]
              : [],
          })),
        })),
      })),
    };
    const service = new PurchaseOrderService(db);
    service.repo = {
      create: vi.fn(async () => ({ id: 'po-1' })),
      addItems: vi.fn(async () => []),
      findById: vi.fn(async () => ({ id: 'po-1', items: [] })),
      findActiveBindingsByPreOrderIds: vi.fn(async () => []),
    };

    await expect(service.createManual(
      { remark: 'ai manual' },
      [{ product_id: 'prod-1', variant_id: 'var-1', quantity: 2, unit_cost: -11 }]
    )).rejects.toThrow(/unit_cost|单价|成本/i);

    expect(service.repo.create).not.toHaveBeenCalled();
    expect(service.repo.addItems).not.toHaveBeenCalled();
  });

  it('createManual rejects pre_order bindings whose quantity no longer matches the linked order', async () => {
    const db = {
      prepare: vi.fn((sql) => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({
            results: sql.includes('FROM product_variants')
              ? [{
                  id: 'var-1',
                  product_id: 'prod-1',
                  status: 'active',
                  moq: 1,
                  pack_size: 1,
                  order_step: 1,
                }]
              : sql.includes('FROM orders')
                ? [{
                    id: 'o-1',
                    order_no: 'SO-1',
                    status: 'confirmed',
                    product_id: 'prod-1',
                    variant_id: 'var-1',
                    quantity: 1,
                  }]
                : [],
          })),
        })),
      })),
    };
    const service = new PurchaseOrderService(db);
    service.repo = {
      create: vi.fn(async () => ({ id: 'po-1' })),
      addItems: vi.fn(async () => []),
      findById: vi.fn(async () => ({ id: 'po-1', items: [] })),
      findActiveBindingsByPreOrderIds: vi.fn(async () => []),
    };

    await expect(service.createManual(
      { remark: 'ai manual' },
      [{ product_id: 'prod-1', variant_id: 'var-1', pre_order_id: 'o-1', quantity: 10, unit_cost: 11 }]
    )).rejects.toThrow(/数量|quantity/i);

    expect(service.repo.create).not.toHaveBeenCalled();
    expect(service.repo.addItems).not.toHaveBeenCalled();
  });

  it('createManual rejects duplicate pre_order bindings within the same request', async () => {
    const db = {
      prepare: vi.fn((sql) => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({
            results: sql.includes('FROM product_variants')
              ? [{
                  id: 'var-1',
                  product_id: 'prod-1',
                  status: 'active',
                  moq: 1,
                  pack_size: 1,
                  order_step: 1,
                }]
              : sql.includes('FROM orders')
                ? [{
                    id: 'o-1',
                    order_no: 'SO-1',
                    status: 'confirmed',
                    product_id: 'prod-1',
                    variant_id: 'var-1',
                    quantity: 1,
                  }]
                : [],
          })),
        })),
      })),
    };
    const service = new PurchaseOrderService(db);
    service.repo = {
      create: vi.fn(async () => ({ id: 'po-1' })),
      addItems: vi.fn(async () => []),
      findById: vi.fn(async () => ({ id: 'po-1', items: [] })),
      findActiveBindingsByPreOrderIds: vi.fn(async () => []),
    };

    await expect(service.createManual(
      { remark: 'duplicate pre-order' },
      [
        { product_id: 'prod-1', variant_id: 'var-1', pre_order_id: 'o-1', quantity: 1, unit_cost: 11 },
        { product_id: 'prod-1', variant_id: 'var-1', pre_order_id: 'o-1', quantity: 1, unit_cost: 11 },
      ]
    )).rejects.toThrow(/pre_order_id|重复|同一/);

    expect(service.repo.create).not.toHaveBeenCalled();
    expect(service.repo.addItems).not.toHaveBeenCalled();
  });
});
