import { describe, expect, it, vi } from 'vitest';
import { findById, listForAdmin, listBySalesperson } from '../order/queries.js';

describe('order queries display model compatibility', () => {
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

    expect(db.prepare.mock.calls[1][0]).toContain('FROM order_lines');
    expect(result.displayStatus).toBe('partially_received');
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
          current_data: JSON.stringify({ name: 'Chair' }),
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
        }],
      })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt),
    };

    const result = await listForAdmin(db, { page: 1, limit: 20 });

    expect(db.prepare.mock.calls[1][0]).toContain('display_status');
    expect(db.prepare.mock.calls[1][0]).not.toContain('ORDER BY ol.created_at ASC');
    expect(result.items[0].displayStatus).toBe('partially_received');
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
          current_data: JSON.stringify({ name: 'Chair' }),
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
        }],
      })),
    };
    const db = {
      prepare: vi.fn().mockReturnValueOnce(countStmt).mockReturnValueOnce(listStmt),
    };

    const result = await listBySalesperson(db, 'sp-1', { page: 1, limit: 20 });

    expect(db.prepare.mock.calls[1][0]).toContain('display_status');
    expect(db.prepare.mock.calls[1][0]).not.toContain('ORDER BY ol.created_at ASC');
    expect(result.items[0].displayStatus).toBe('partially_received');
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
          current_data: JSON.stringify({}),
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
          current_data: JSON.stringify({}),
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

    await listForAdmin(db, { search: 'Snapshot Chair', page: 1, limit: 20 });

    expect(db.prepare.mock.calls[0][0]).toContain('order_line_snapshot.snapshot_name LIKE ?');
    expect(db.prepare.mock.calls[1][0]).toContain('order_line_snapshot.snapshot_name LIKE ?');
    expect(listStmt.bind).toHaveBeenCalledWith('%Snapshot Chair%', '%Snapshot Chair%', '%Snapshot Chair%', 20, 0);
  });

});
