import { describe, expect, it, vi } from 'vitest';
import { createActionSubmitters } from '../action-submitters.js';

describe('AI action submitters', () => {
  it('builds customer create payload from normalized slots', async () => {
    const customerRepo = {
      create: vi.fn(async (payload) => ({ id: 'cus-1', name: payload.name })),
    };
    const submitters = createActionSubmitters({ customerRepo });

    const result = await submitters.create_customer({ name: 'Alice', phone: '13800000000' });

    expect(customerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Alice', phone: '13800000000' })
    );
    expect(result).toEqual(expect.objectContaining({ id: 'cus-1', label: 'Alice' }));
  });

  it('builds product create payload with at least one variant', async () => {
    const productService = {
      create: vi.fn(async (payload) => ({ id: 'prod-1', name: payload.name })),
    };
    const submitters = createActionSubmitters({ productService });

    await expect(submitters.create_product({ name: 'Sneaker', currency: 'CNY', variants: [] }))
      .rejects
      .toThrow('At least one variant is required');

    const result = await submitters.create_product({
      name: 'Sneaker',
      currency: 'CNY',
      variants: [{ sku: 'SKU-1', price: 100, cost_price: 50, stock_quantity: 10, alert_threshold: 2, status: 'active' }],
    });

    expect(productService.create).toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ id: 'prod-1', label: 'Sneaker' }));
  });

  it('routes purchase-order from-orders mode to the correct submitter dependency', async () => {
    const purchaseOrderService = {
      createFromOrders: vi.fn(async (orderIds, payload) => ({ id: 'po-1', po_no: 'PO-1', orderIds, payload })),
    };
    const submitters = createActionSubmitters({ purchaseOrderService });

    const result = await submitters.create_purchase_order({
      mode: 'from_orders',
      order_ids: ['ord-1', 'ord-2'],
      remark: 'restock',
    });

    expect(purchaseOrderService.createFromOrders).toHaveBeenCalledWith(
      ['ord-1', 'ord-2'],
      expect.objectContaining({ remark: 'restock' })
    );
    expect(result).toEqual(expect.objectContaining({ id: 'po-1', label: 'PO-1' }));
  });

  it('creates manual purchase orders with items instead of leaving an empty draft', async () => {
    const purchaseOrderRepo = {
      create: vi.fn(async (payload) => ({ id: 'po-1', po_no: 'PO-1', ...payload })),
      addItems: vi.fn(async () => ['poi-1']),
      findById: vi.fn(async () => ({ id: 'po-1', po_no: 'PO-1', items: [{ id: 'poi-1' }] })),
    };
    const submitters = createActionSubmitters({ purchaseOrderRepo });

    const result = await submitters.create_purchase_order({
      mode: 'manual',
      remark: 'manual draft',
      items: [
        { product_id: 'prod-1', variant_id: 'var-1', quantity: 3, unit_cost: 12 },
      ],
    });

    expect(purchaseOrderRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ remark: 'manual draft' })
    );
    expect(purchaseOrderRepo.addItems).toHaveBeenCalledWith('po-1', [
      expect.objectContaining({
        product_id: 'prod-1',
        variant_id: 'var-1',
        quantity: 3,
        unit_cost: 12,
      }),
    ]);
    expect(result).toEqual(expect.objectContaining({ id: 'po-1', label: 'PO-1' }));
  });

  it('cleans up manual purchase-order drafts when AI item insertion fails', async () => {
    const purchaseOrderRepo = {
      create: vi.fn(async () => ({ id: 'po-1', po_no: 'PO-1' })),
      addItems: vi.fn(async () => {
        throw new Error('insert failed');
      }),
      deleteIfEmptyDraft: vi.fn(async () => true),
    };
    const submitters = createActionSubmitters({ purchaseOrderRepo });

    await expect(submitters.create_purchase_order({
      mode: 'manual',
      items: [{ product_id: 'prod-1', variant_id: 'var-1', quantity: 3, unit_cost: 12 }],
    })).rejects.toThrow('insert failed');

    expect(purchaseOrderRepo.addItems).toHaveBeenCalledTimes(1);
    expect(purchaseOrderRepo.deleteIfEmptyDraft).toHaveBeenCalledWith('po-1');
  });

  it('rejects manual purchase-order submission when items are missing', async () => {
    const purchaseOrderRepo = {
      create: vi.fn(async () => ({ id: 'po-1', po_no: 'PO-1' })),
    };
    const submitters = createActionSubmitters({ purchaseOrderRepo });

    await expect(submitters.create_purchase_order({
      mode: 'manual',
    })).rejects.toThrow('At least one purchase-order item is required');

    expect(purchaseOrderRepo.create).not.toHaveBeenCalled();
  });

  it('rejects from-orders submission when order ids are missing', async () => {
    const purchaseOrderService = {
      createFromOrders: vi.fn(async () => ({ id: 'po-1', po_no: 'PO-1' })),
    };
    const submitters = createActionSubmitters({ purchaseOrderService });

    await expect(submitters.create_purchase_order({
      mode: 'from_orders',
    })).rejects.toThrow('At least one order id is required');

    expect(purchaseOrderService.createFromOrders).not.toHaveBeenCalled();
  });
});
