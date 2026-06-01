import { describe, expect, it, vi, beforeEach } from 'vitest';
import { findById, listForAdmin, listBySalesperson, _resetFtsCache } from '../order/queries.js';

describe('order queries display model compatibility', () => {
  beforeEach(() => {
    _resetFtsCache();
  });

  it('loads order lines into detail payload and aggregates displayStatus across lines', async () => {
    const firstStmt = {
      bind: vi.fn(() => firstStmt),
      first: vi.fn(async () => ({
        id: 'o-1',
        order_no: 'SO-1',
        salesperson_id: 'sp-1',
        customer_id: 'c-1',
        product_id: 'p-1',
        variant_id: 'v-1',
        status: 'production',
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
        quantity: 5,
        delivered_at: 1710000000000,
        delivered_by: 'Admin',
        delivery_note: 'signed by receiver',
        created_at: 1,
        updated_at: 2,
        customer_name: null,
        customer_company: null,
        customer_phone: null,
      })),
    };
    const secondStmt = {
      bind: vi.fn(() => secondStmt),
      all: vi.fn(async () => ({
        results: [
          {
            id: 'line-1',
            order_id: 'o-1',
            product_id: 'p-1',
            variant_id: 'v-1',
            snapshot_name: 'Chair',
            snapshot_image: 'img-key',
            ordered_qty: 5,
            procured_qty: 0,
            received_qty: 0,
            reserved_qty: 0,
            shipped_qty: 0,
            cancelled_qty: 0,
            display_status: 'unprocured',
            created_at: 1,
            updated_at: 2,
          },
          {
            id: 'line-2',
            order_id: 'o-1',
            product_id: 'p-2',
            variant_id: 'v-2',
            snapshot_name: 'Lamp',
            snapshot_image: 'img-key-2',
            ordered_qty: 3,
            procured_qty: 3,
            received_qty: 2,
            reserved_qty: 0,
            shipped_qty: 0,
            returned_qty: 1,
            cancelled_qty: 0,
            display_status: 'partially_received',
            created_at: 2,
            updated_at: 3,
          },
        ],
      })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(firstStmt).mockReturnValueOnce(secondStmt),
    };

    const result = await findById(db, 'o-1');

    expect(db.prepare.mock.calls[0][0]).toContain('LEFT JOIN order_payloads op ON op.order_id = o.id');
    expect(db.prepare.mock.calls[1][0]).toContain('FROM order_lines');
    expect(result.displayStatus).toBe('partially_received');
    expect(result.fulfillmentStatus).toBe('unfulfilled');
    expect(result.deliveryStatus).toBe('not_shipped');
    expect(result.deliveryConfirmedAt).toBe(1710000000000);
    expect(result.deliveryConfirmedBy).toBe('Admin');
    expect(result.deliveryNote).toBe('signed by receiver');
    expect(result.lines).toEqual([
      expect.objectContaining({
        id: 'line-1',
        orderedQuantity: 5,
        procuredQuantity: 0,
        receivedQuantity: 0,
        displayStatus: 'unprocured',
      }),
      expect.objectContaining({
        id: 'line-2',
        orderedQuantity: 3,
        procuredQuantity: 3,
        receivedQuantity: 2,
        returnedQuantity: 1,
        displayStatus: 'partially_received',
      }),
    ]);
  });

  it('preserves partially_arrived procurementStatus in detail payloads', async () => {
    const firstStmt = {
      bind: vi.fn(() => firstStmt),
      first: vi.fn(async () => ({
        id: 'o-1',
        order_no: 'SO-1',
        salesperson_id: 'sp-1',
        customer_id: 'c-1',
        product_id: 'p-1',
        variant_id: 'v-1',
        status: 'production',
        procurement_status: 'partially_arrived',
        fulfillment_status: 'unfulfilled',
        delivery_status: 'not_shipped',
        unread_by_admin: 0,
        unread_by_sales: 0,
        original_data: '{}',
        current_data: '{}',
        main_image_key: null,
        main_image_blurhash: null,
        main_image_id: null,
        quantity: 5,
        created_at: 1,
        updated_at: 2,
        customer_name: null,
        customer_company: null,
        customer_phone: null,
      })),
    };
    const secondStmt = {
      bind: vi.fn(() => secondStmt),
      all: vi.fn(async () => ({ results: [] })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(firstStmt).mockReturnValueOnce(secondStmt),
    };

    const result = await findById(db, 'o-1');

    expect(result.procurementStatus).toBe('partially_arrived');
  });

  it('selects display_status for admin list items', async () => {
    const countStmt = {
      bind: vi.fn(() => countStmt),
      first: vi.fn(async () => ({ total: 1 })),
    };
    const listStmt = {
      bind: vi.fn(() => listStmt),
      all: vi.fn(async () => ({
        results: [{
          id: 'o-1',
          order_no: 'SO-1',
          salesperson_id: 'sp-1',
          summary_name: 'Chair',
          summary_brand: 'KK',
          summary_sku: 'SKU-1',
          status: 'production',
          procurement_status: 'ordered',
          fulfillment_status: 'partially_fulfilled',
          delivery_status: 'in_transit',
          display_status: 'partially_received',
          product_id: 'p-1',
          variant_id: 'v-1',
          quantity: 5,
          line_ordered_qty: 5,
          line_shipped_qty: 2,
          delivered_at: 1710000000000,
          delivered_by: 'Admin',
          delivery_note: 'receiver signed',
          line_returned_qty: 1,
          line_cancelled_qty: 0,
          is_unread: 0,
          main_image_id: null,
          created_at: 1,
          updated_at: 2,
          salesperson_name: 'A',
          salesperson_store: 'S',
          main_image_key: 'img-key',
          main_image_blurhash: null,
        }],
      })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt),
    };

    const result = await listForAdmin(db, { page: 1, limit: 20 });

    expect(db.prepare.mock.calls[1][0]).toContain('order_summary_projection');
    expect(db.prepare.mock.calls[1][0]).toContain('order_summary.display_status as display_status');
    expect(db.prepare.mock.calls[1][0]).toContain('o.summary_name');
    expect(db.prepare.mock.calls[1][0]).toContain('o.summary_brand');
    expect(db.prepare.mock.calls[1][0]).toContain('o.summary_sku');
    expect(db.prepare.mock.calls[1][0]).not.toContain('o.current_data');
    expect(db.prepare.mock.calls[1][0]).toContain('o.fulfillment_status');
    expect(db.prepare.mock.calls[1][0]).toContain('o.delivery_status');
    expect(db.prepare.mock.calls[1][0]).toContain('order_summary.ordered_qty as line_ordered_qty');
    expect(db.prepare.mock.calls[1][0]).toContain('order_summary.shipped_qty as line_shipped_qty');
    expect(db.prepare.mock.calls[1][0]).toContain('order_summary.returned_qty as line_returned_qty');
    expect(db.prepare.mock.calls[1][0]).toContain('order_summary.cancelled_qty as line_cancelled_qty');
    expect(db.prepare.mock.calls[1][0]).not.toContain('order_line_agg');
    expect(db.prepare.mock.calls[1][0]).not.toContain('order_line_snapshot');
    expect(db.prepare.mock.calls[1][0]).not.toContain('ORDER BY ol.created_at ASC');
    expect(result.items[0].displayStatus).toBe('partially_received');
    expect(result.items[0].fulfillmentStatus).toBe('partially_fulfilled');
    expect(result.items[0].deliveryStatus).toBe('partially_returned');
    expect(result.items[0].brand).toBe('KK');
    expect(result.items[0].sku).toBe('SKU-1');
    expect(result.items[0].mainImage).toBe('/file/img-key');
  });

  it('selects display_status for salesperson list items', async () => {
    const countStmt = {
      bind: vi.fn(() => countStmt),
      first: vi.fn(async () => ({ total: 1 })),
    };
    const listStmt = {
      bind: vi.fn(() => listStmt),
      all: vi.fn(async () => ({
        results: [{
          id: 'o-1',
          order_no: 'SO-1',
          summary_name: 'Chair',
          summary_brand: 'KK',
          summary_sku: 'SKU-1',
          status: 'production',
          procurement_status: 'ordered',
          fulfillment_status: 'partially_fulfilled',
          delivery_status: 'in_transit',
          display_status: 'partially_received',
          line_returned_qty: 0,
          is_unread: 0,
          main_image_id: null,
          created_at: 1,
          updated_at: 2,
          main_image_key: null,
          main_image_blurhash: null,
          product_id: 'p-1',
          variant_id: 'v-1',
          quantity: 5,
        }],
      })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt),
    };

    const result = await listBySalesperson(db, 'sp-1', { page: 1, limit: 20 });

    expect(db.prepare.mock.calls[1][0]).toContain('order_summary_projection');
    expect(db.prepare.mock.calls[1][0]).toContain('order_summary.display_status as display_status');
    expect(db.prepare.mock.calls[1][0]).toContain('o.summary_name');
    expect(db.prepare.mock.calls[1][0]).toContain('o.summary_brand');
    expect(db.prepare.mock.calls[1][0]).toContain('o.summary_sku');
    expect(db.prepare.mock.calls[1][0]).not.toContain('o.current_data');
    expect(db.prepare.mock.calls[1][0]).toContain('o.fulfillment_status');
    expect(db.prepare.mock.calls[1][0]).toContain('o.delivery_status');
    expect(db.prepare.mock.calls[1][0]).toContain('order_summary.ordered_qty as line_ordered_qty');
    expect(db.prepare.mock.calls[1][0]).toContain('order_summary.shipped_qty as line_shipped_qty');
    expect(db.prepare.mock.calls[1][0]).toContain('order_summary.cancelled_qty as line_cancelled_qty');
    expect(db.prepare.mock.calls[1][0]).not.toContain('order_line_agg');
    expect(db.prepare.mock.calls[1][0]).not.toContain('order_line_snapshot');
    expect(db.prepare.mock.calls[1][0]).not.toContain('ORDER BY ol.created_at ASC');
    expect(result.items[0].displayStatus).toBe('partially_received');
    expect(result.items[0].fulfillmentStatus).toBe('partially_fulfilled');
    expect(result.items[0].deliveryStatus).toBe('in_transit');
  });
  it('falls back to order-line snapshot names in admin list items when current_data name is missing', async () => {
    const countStmt = {
      bind: vi.fn(() => countStmt),
      first: vi.fn(async () => ({ total: 1 })),
    };
    const listStmt = {
      bind: vi.fn(() => listStmt),
      all: vi.fn(async () => ({
        results: [{
          id: 'o-1',
          order_no: 'SO-1',
          salesperson_id: 'sp-1',
          summary_name: '',
          summary_brand: '',
          summary_sku: '',
          status: 'production',
          procurement_status: 'ordered',
          display_status: 'partially_received',
          product_id: 'p-1',
          variant_id: 'v-1',
          quantity: 5,
          is_unread: 0,
          main_image_id: null,
          created_at: 1,
          updated_at: 2,
          salesperson_name: 'A',
          salesperson_store: 'S',
          main_image_key: null,
          main_image_blurhash: null,
          snapshot_name: 'Snapshot Chair',
        }],
      })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt),
    };

    const result = await listForAdmin(db, { page: 1, limit: 20 });

    expect(db.prepare.mock.calls[1][0]).toContain('snapshot_name');
    expect(result.items[0].productName).toBe('Snapshot Chair');
  });

  it('falls back to order-line snapshot names in salesperson list items when current_data name is missing', async () => {
    const countStmt = {
      bind: vi.fn(() => countStmt),
      first: vi.fn(async () => ({ total: 1 })),
    };
    const listStmt = {
      bind: vi.fn(() => listStmt),
      all: vi.fn(async () => ({
        results: [{
          id: 'o-1',
          order_no: 'SO-1',
          summary_name: '',
          summary_brand: '',
          summary_sku: '',
          status: 'production',
          procurement_status: 'ordered',
          display_status: 'partially_received',
          is_unread: 0,
          main_image_id: null,
          created_at: 1,
          updated_at: 2,
          main_image_key: null,
          main_image_blurhash: null,
          product_id: 'p-1',
          variant_id: 'v-1',
          quantity: 5,
          snapshot_name: 'Snapshot Chair',
        }],
      })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt),
    };

    const result = await listBySalesperson(db, 'sp-1', { page: 1, limit: 20 });

    expect(db.prepare.mock.calls[1][0]).toContain('snapshot_name');
    expect(result.items[0].productName).toBe('Snapshot Chair');
  });

  it('extends admin search filters to order-line snapshot names when current_data name is missing', async () => {
    const ftsCheckStmt = {
      bind: vi.fn(() => ftsCheckStmt),
      first: vi.fn(async () => null), // 无 FTS 表
    };
    const countStmt = {
      bind: vi.fn(() => countStmt),
      first: vi.fn(async () => ({ total: 0 })),
    };
    const listStmt = {
      bind: vi.fn(() => listStmt),
      all: vi.fn(async () => ({ results: [] })),
    };
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(ftsCheckStmt)
        .mockReturnValueOnce(countStmt)
        .mockReturnValueOnce(listStmt),
    };

    await listForAdmin(db, { search: 'Snapshot Chair', page: 1, limit: 20 });

    // calls[0] = FTS check, calls[1] = count, calls[2] = list
    expect(db.prepare.mock.calls[1][0]).toContain('o.summary_name LIKE ?');
    expect(db.prepare.mock.calls[1][0]).toContain('o.summary_brand LIKE ?');
    expect(db.prepare.mock.calls[1][0]).toContain('o.summary_sku LIKE ?');
    expect(db.prepare.mock.calls[1][0]).toContain('order_summary.snapshot_name LIKE ?');
    expect(db.prepare.mock.calls[2][0]).toContain('o.summary_name LIKE ?');
    expect(db.prepare.mock.calls[2][0]).toContain('o.summary_brand LIKE ?');
    expect(db.prepare.mock.calls[2][0]).toContain('o.summary_sku LIKE ?');
    expect(db.prepare.mock.calls[2][0]).toContain('order_summary.snapshot_name LIKE ?');
    expect(listStmt.bind).toHaveBeenCalledWith(
      '%Snapshot Chair%',
      '%Snapshot Chair%',
      '%Snapshot Chair%',
      '%Snapshot Chair%',
      '%Snapshot Chair%',
      20,
      0
    );
  });

  it('matches both canonical fulfilled and legacy delivered rows when filtering admin lists by fulfilled', async () => {
    const countStmt = {
      bind: vi.fn(() => countStmt),
      first: vi.fn(async () => ({ total: 0 })),
    };
    const listStmt = {
      bind: vi.fn(() => listStmt),
      all: vi.fn(async () => ({ results: [] })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt),
    };

    await listForAdmin(db, { status: 'fulfilled', page: 1, limit: 20 });

    expect(db.prepare.mock.calls[0][0]).toContain('o.status IN (?, ?)');
    expect(db.prepare.mock.calls[1][0]).toContain('o.status IN (?, ?)');
    expect(listStmt.bind).toHaveBeenCalledWith('fulfilled', 'delivered', 20, 0);
  });

  it('matches both canonical fulfilled and legacy delivered rows when filtering salesperson lists by delivered alias', async () => {
    const countStmt = {
      bind: vi.fn(() => countStmt),
      first: vi.fn(async () => ({ total: 0 })),
    };
    const listStmt = {
      bind: vi.fn(() => listStmt),
      all: vi.fn(async () => ({ results: [] })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt),
    };

    await listBySalesperson(db, 'sp-1', { status: 'delivered', page: 1, limit: 20 });

    expect(db.prepare.mock.calls[0][0]).toContain('status IN (?, ?)');
    expect(db.prepare.mock.calls[1][0]).toContain('status IN (?, ?)');
    expect(listStmt.bind).toHaveBeenCalledWith('sp-1', 'fulfilled', 'delivered', 20, 0);
  });

  it('keeps the admin count query lightweight when no line-derived filters are requested', async () => {
    const countStmt = {
      bind: vi.fn(() => countStmt),
      first: vi.fn(async () => ({ total: 0 })),
    };
    const listStmt = {
      bind: vi.fn(() => listStmt),
      all: vi.fn(async () => ({ results: [] })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt),
    };

    await listForAdmin(db, { page: 1, limit: 20 });

    expect(db.prepare.mock.calls[0][0]).toContain('order_summary_projection');
    expect(db.prepare.mock.calls[0][0]).not.toContain('order_line_agg');
    expect(db.prepare.mock.calls[0][0]).not.toContain('order_line_snapshot');
  });

  it('keeps the admin count query on order_summary_projection even when line-derived filters are requested', async () => {
    const ftsCheckStmt = {
      bind: vi.fn(() => ftsCheckStmt),
      first: vi.fn(async () => null), // 无 FTS 表
    };
    const countStmt = {
      bind: vi.fn(() => countStmt),
      first: vi.fn(async () => ({ total: 0 })),
    };
    const listStmt = {
      bind: vi.fn(() => listStmt),
      all: vi.fn(async () => ({ results: [] })),
    };
    const db = {
      prepare: vi.fn()
        .mockReturnValueOnce(ftsCheckStmt)
        .mockReturnValueOnce(countStmt)
        .mockReturnValueOnce(listStmt),
    };

    await listForAdmin(db, {
      search: 'Snapshot Chair',
      procurementStatus: 'ordered',
      page: 1,
      limit: 20,
    });

    // calls[0] = FTS check, calls[1] = count, calls[2] = list
    expect(db.prepare.mock.calls[1][0]).toContain('order_summary_projection');
    expect(db.prepare.mock.calls[1][0]).not.toContain('order_line_agg');
    expect(db.prepare.mock.calls[1][0]).not.toContain('order_line_snapshot');
  });

  it('keeps legacy procurement header filters available after switching list queries to projection', async () => {
    const countStmt = {
      bind: vi.fn(() => countStmt),
      first: vi.fn(async () => ({ total: 0 })),
    };
    const listStmt = {
      bind: vi.fn(() => listStmt),
      all: vi.fn(async () => ({ results: [] })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt),
    };

    await listForAdmin(db, {
      procurementStatus: 'ordered',
      page: 1,
      limit: 20,
    });

    expect(db.prepare.mock.calls[0][0]).toContain("COALESCE(o.procurement_status, 'none')");
    expect(db.prepare.mock.calls[1][0]).toContain("COALESCE(o.procurement_status, 'none')");
    expect(listStmt.bind).toHaveBeenCalledWith('ordered', 'ordered', 20, 0);
  });

});
