import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../../lib/hono/errors.js';
import { PurchaseOrderShortageClosureService } from '../PurchaseOrderShortageClosureService.js';

function createDbHarness({
  poRow = { id: 'po-1', status: 'shipping' },
  purchaseOrderItems = {},
} = {}) {
  const defaultItems = {
    'poi-1': {
      id: 'poi-1',
      po_id: 'po-1',
      product_id: 'prod-1',
      variant_id: 'var-1',
      pre_order_id: 'order-1',
      quantity: 10,
      received_qty: 7,
      cancelled_qty: 0,
    },
    'poi-2': {
      id: 'poi-2',
      po_id: 'po-1',
      product_id: 'prod-2',
      variant_id: 'var-2',
      pre_order_id: null,
      quantity: 4,
      received_qty: 0,
      cancelled_qty: 0,
    },
  };
  const itemRows = {
    ...defaultItems,
    ...purchaseOrderItems,
  };

  const calls = {
    batchCalls: [],
    runStatements: [],
  };

  const db = {
    prepare: vi.fn((sql) => {
      const statement = {
        sql,
        params: [],
        bind: vi.fn((...params) => {
          statement.params = params;
          return statement;
        }),
        first: vi.fn(async () => null),
        all: vi.fn(async () => ({ results: [] })),
        run: vi.fn(async () => {
          calls.runStatements.push(statement);
          return { meta: { changes: 1 } };
        }),
      };

      if (sql.includes('FROM purchase_orders')) {
        statement.first = vi.fn(async () => poRow);
      }

      if (sql.includes('FROM purchase_order_items')) {
        statement.first = vi.fn(async () => itemRows[String(statement.params[0] || '')] || null);
      }

      return statement;
    }),
    batch: vi.fn(async (statements = []) => {
      calls.batchCalls.push(statements);
      return statements.map(() => ({ meta: { changes: 1 } }));
    }),
  };

  return {
    db,
    calls,
  };
}

describe('PurchaseOrderShortageClosureService', () => {
  let harness;
  let service;

  beforeEach(() => {
    harness = createDbHarness();
    service = new PurchaseOrderShortageClosureService(harness.db, {
      now: () => 1710000000000,
    });
  });

  it('closes remaining receivable quantity on purchase-order items without touching order lines', async () => {
    const result = await service.closeShortages('po-1', {
      items: [
        { purchase_order_item_id: 'poi-1', close_qty: 3 },
        { purchase_order_item_id: 'poi-2', close_qty: 4 },
      ],
    });

    expect(result).toEqual({
      purchase_order_id: 'po-1',
      closed_count: 2,
      items: [
        expect.objectContaining({
          purchase_order_item_id: 'poi-1',
          close_qty: 3,
          cancelled_qty_after: 3,
          remaining_receivable_after: 0,
          display_status: 'received',
        }),
        expect.objectContaining({
          purchase_order_item_id: 'poi-2',
          close_qty: 4,
          cancelled_qty_after: 4,
          remaining_receivable_after: 0,
          display_status: 'cancelled',
        }),
      ],
    });

    const flattenedStatements = harness.calls.batchCalls.flat();
    expect(flattenedStatements.some((statement) => statement.sql.includes('UPDATE purchase_order_items'))).toBe(true);
    expect(flattenedStatements.some((statement) => statement.sql.includes('UPDATE order_lines'))).toBe(false);
    expect(flattenedStatements.some((statement) => statement.sql.includes('UPDATE orders'))).toBe(false);

    const itemUpdateParams = flattenedStatements
      .filter((statement) => statement.sql.includes('UPDATE purchase_order_items'))
      .map((statement) => statement.params);
    expect(itemUpdateParams).toEqual([
      [3, 'received', 'poi-1', 'po-1', 7, 0, 3],
      [4, 'cancelled', 'poi-2', 'po-1', 0, 0, 4],
    ]);

    expect(harness.calls.runStatements.some((statement) => statement.sql.includes('UPDATE purchase_orders SET updated_at = ?'))).toBe(true);
  });

  it('rejects closing more than the remaining receivable quantity', async () => {
    await expect(
      service.closeShortages('po-1', {
        items: [
          { purchase_order_item_id: 'poi-1', close_qty: 4 },
        ],
      })
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(harness.db.batch).not.toHaveBeenCalled();
    expect(harness.calls.runStatements).toHaveLength(0);
  });

  it('allows shortage closure only for ordered or shipping purchase orders', async () => {
    const invalidHarness = createDbHarness({
      poRow: { id: 'po-1', status: 'arrived' },
    });
    const invalidService = new PurchaseOrderShortageClosureService(invalidHarness.db, {
      now: () => 1710000000000,
    });

    await expect(
      invalidService.closeShortages('po-1', {
        items: [
          { purchase_order_item_id: 'poi-1', close_qty: 1 },
        ],
      })
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(invalidHarness.db.batch).not.toHaveBeenCalled();
  });
});
