import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../../lib/hono/errors.js';
import { PurchaseOrderShortageClosureService } from '../PurchaseOrderShortageClosureService.js';

function createDbHarness({
  poRow = { id: 'po-1', status: 'shipping' },
  purchaseOrderItems = {},
  orderLineRows = {
    'order-1': [
      {
        id: 'ol-1',
        order_id: 'order-1',
        product_id: 'prod-1',
        variant_id: 'var-1',
        ordered_qty: 10,
        procured_qty: 10,
        received_qty: 7,
        reserved_qty: 0,
        shipped_qty: 0,
        cancelled_qty: 0,
      },
    ],
  },
  batchResultsQueue = null,
  batchError = null,
  batchErrorMatcher = null,
  batchErrorCallIndex = null,
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

      if (sql.includes('FROM order_lines') && sql.includes('SUM(')) {
        statement.first = vi.fn(async () => {
          const orderId = String(statement.params[0] || '');
          const rows = orderLineRows[orderId] || [];
          return rows.reduce((acc, row) => ({
            ordered_qty: (acc.ordered_qty || 0) + (row.ordered_qty || 0),
            procured_qty: (acc.procured_qty || 0) + (row.procured_qty || 0),
            received_qty: (acc.received_qty || 0) + (row.received_qty || 0),
            cancelled_qty: (acc.cancelled_qty || 0) + (row.cancelled_qty || 0),
          }), {
            ordered_qty: 0,
            procured_qty: 0,
            received_qty: 0,
            cancelled_qty: 0,
          });
        });
      }

      if (sql.includes('FROM order_lines') && sql.includes('WHERE order_id = ?')) {
        statement.all = vi.fn(async () => {
          const orderId = String(statement.params[0] || '');
          const variantId = statement.params[1];
          const productId = statement.params[2];
          let rows = [...(orderLineRows[orderId] || [])];
          if (variantId) {
            rows = rows.filter((row) => row.variant_id === variantId);
          }
          if (productId) {
            rows = rows.filter((row) => row.product_id === productId);
          }
          return { results: rows };
        });
      }

      return statement;
    }),
    batch: vi.fn(async (statements = []) => {
      calls.batchCalls.push(statements);
      const callIndex = calls.batchCalls.length;
      if (
        batchError &&
        typeof batchErrorMatcher === 'function' &&
        statements.some((statement) => batchErrorMatcher(statement)) &&
        (batchErrorCallIndex == null || batchErrorCallIndex === callIndex)
      ) {
        throw batchError;
      }
      if (Array.isArray(batchResultsQueue) && batchResultsQueue.length > 0) {
        return batchResultsQueue.shift();
      }
      return statements.map(() => ({ meta: { changes: 1 } }));
    }),
  };

  const commandIdempotencyRepo = {
    reserveShortageClosureCommand: vi.fn(async (_scopeKey, _idempotencyKey, requestFingerprint) => ({
      existing: false,
      record: {
        id: 'cmd-row-1',
        command_id: 'cmd-shortage-1',
        request_fingerprint: requestFingerprint,
        status: 'in_flight',
      },
      ownsReservation: true,
    })),
    buildDeleteStatement: vi.fn((commandId) =>
      db.prepare('DELETE FROM command_idempotency WHERE command_id = ?').bind(commandId)
    ),
    buildFinalizeStatement: vi.fn((commandId, responseJson, status) =>
      db
        .prepare(
          'UPDATE command_idempotency SET response_json = ?, status = ?, updated_at = ? WHERE command_id = ?'
        )
        .bind(JSON.stringify(responseJson), status, 1710000000000, commandId)
    ),
  };

  return {
    db,
    calls,
    commandIdempotencyRepo,
  };
}

describe('PurchaseOrderShortageClosureService', () => {
  let harness;
  let service;

  beforeEach(() => {
    harness = createDbHarness();
    service = new PurchaseOrderShortageClosureService(harness.db, {
      commandIdempotencyRepo: harness.commandIdempotencyRepo,
      now: () => 1710000000000,
    });
  });

  it('closes remaining receivable quantity and reprojects linked order procurement progress', async () => {
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
      changedOrderStatuses: [],
      changedOrderProgressions: [
        {
          orderId: 'order-1',
          orderLineId: 'ol-1',
          orderLineDisplayStatus: 'partially_received',
          procurementStatus: 'partially_arrived',
        },
      ],
    });

    expect(harness.db.batch).toHaveBeenCalledTimes(1);
    const flattenedStatements = harness.calls.batchCalls[0];
    expect(flattenedStatements.some((statement) => statement.sql.includes('UPDATE purchase_order_items'))).toBe(true);
    expect(flattenedStatements.some((statement) => statement.sql.includes('UPDATE order_lines'))).toBe(true);
    expect(flattenedStatements.some((statement) => statement.sql.includes('UPDATE orders'))).toBe(false);

    const itemUpdateParams = flattenedStatements
      .filter((statement) => statement.sql.includes('UPDATE purchase_order_items'))
      .map((statement) => statement.params);
    expect(itemUpdateParams).toEqual([
      [3, 'received', 'poi-1', 'po-1', 7, 0, 3],
      [4, 'cancelled', 'poi-2', 'po-1', 0, 0, 4],
    ]);

    const orderLineUpdateStatement = flattenedStatements.find((statement) =>
      statement.sql.includes('UPDATE order_lines')
    );
    expect(orderLineUpdateStatement.params).toEqual([
      10,
      7,
      7,
      0,
      0,
      0,
      'partially_received',
      1710000000000,
      'ol-1',
      'order-1',
      7,
      0,
      10,
      10,
      0,
      0,
    ]);
    expect(flattenedStatements.some((statement) => statement.sql.includes('UPDATE purchase_orders SET updated_at = ?'))).toBe(true);
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
      commandIdempotencyRepo: invalidHarness.commandIdempotencyRepo,
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

  it('replays the original shortage-closure response for the same idempotency key', async () => {
    harness.commandIdempotencyRepo.reserveShortageClosureCommand.mockResolvedValueOnce({
      existing: true,
      record: {
        id: 'cmd-row-1',
        command_id: 'cmd-shortage-1',
        request_fingerprint: JSON.stringify({
          purchase_order_id: 'po-1',
          items: [{ purchase_order_item_id: 'poi-1', close_qty: 3 }],
        }),
        status: 'committed',
        response_json: JSON.stringify({
          purchase_order_id: 'po-1',
          closed_count: 1,
          items: [{ purchase_order_item_id: 'poi-1', close_qty: 3 }],
        }),
      },
      ownsReservation: false,
    });

    const result = await service.closeShortages(
      'po-1',
      {
        items: [{ purchase_order_item_id: 'poi-1', close_qty: 3 }],
      },
      {
        idempotencyKey: 'shortage-key-1',
      }
    );

    expect(result).toEqual({
      purchase_order_id: 'po-1',
      closed_count: 1,
      items: [{ purchase_order_item_id: 'poi-1', close_qty: 3 }],
    });
    expect(harness.db.batch).not.toHaveBeenCalled();
  });

  it('does not issue revert batch when guarded item updates partially fail', async () => {
    const guardedHarness = createDbHarness({
      batchResultsQueue: [
        [
          { meta: { changes: 1 } },
          { meta: { changes: 0 } },
          { meta: { changes: 1 } },
          { meta: { changes: 1 } },
          { meta: { changes: 1 } },
        ],
      ],
    });
    const guardedService = new PurchaseOrderShortageClosureService(guardedHarness.db, {
      commandIdempotencyRepo: guardedHarness.commandIdempotencyRepo,
      now: () => 1710000000000,
    });

    await expect(
      guardedService.closeShortages(
        'po-1',
        {
          items: [
            { purchase_order_item_id: 'poi-1', close_qty: 3 },
            { purchase_order_item_id: 'poi-2', close_qty: 4 },
          ],
        },
        {
          idempotencyKey: 'shortage-key-2',
        }
      )
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(guardedHarness.db.batch).toHaveBeenCalledTimes(1);
    expect(
      guardedHarness.calls.runStatements.some((statement) =>
        statement.sql.includes('DELETE FROM command_idempotency')
      )
    ).toBe(true);
  });

  it('does not issue revert batch when finalize persistence fails', async () => {
    const finalizeFailureHarness = createDbHarness({
      batchError: new Error('finalize failed'),
      batchErrorMatcher: (statement) => statement.sql.includes('UPDATE purchase_orders SET updated_at = ?'),
      batchErrorCallIndex: 1,
    });
    const finalizeFailureService = new PurchaseOrderShortageClosureService(finalizeFailureHarness.db, {
      commandIdempotencyRepo: finalizeFailureHarness.commandIdempotencyRepo,
      now: () => 1710000000000,
    });

    await expect(
      finalizeFailureService.closeShortages('po-1', {
        items: [
          { purchase_order_item_id: 'poi-1', close_qty: 3 },
          { purchase_order_item_id: 'poi-2', close_qty: 4 },
        ],
      })
    ).rejects.toThrow('finalize failed');

    expect(finalizeFailureHarness.db.batch).toHaveBeenCalledTimes(1);
    expect(
      finalizeFailureHarness.calls.runStatements.some((statement) =>
        statement.sql.includes('DELETE FROM command_idempotency')
      )
    ).toBe(true);
  });

  it('does not issue revert batch when guarded order projection updates partially fail', async () => {
    const guardedOrderHarness = createDbHarness({
      purchaseOrderItems: {
        'poi-1': {
          id: 'poi-1',
          po_id: 'po-1',
          product_id: 'prod-1',
          variant_id: 'var-1',
          pre_order_id: 'order-1',
          quantity: 3,
          received_qty: 0,
          cancelled_qty: 0,
        },
      },
      orderLineRows: {
        'order-1': [
          {
            id: 'ol-1',
            order_id: 'order-1',
            product_id: 'prod-1',
            variant_id: 'var-1',
            ordered_qty: 3,
            procured_qty: 3,
            received_qty: 0,
            reserved_qty: 0,
            shipped_qty: 0,
            cancelled_qty: 0,
          },
        ],
      },
      batchResultsQueue: [
        [
          { meta: { changes: 1 } },
          { meta: { changes: 0 } },
          { meta: { changes: 1 } },
          { meta: { changes: 1 } },
          { meta: { changes: 1 } },
        ],
      ],
    });
    const guardedOrderService = new PurchaseOrderShortageClosureService(guardedOrderHarness.db, {
      commandIdempotencyRepo: guardedOrderHarness.commandIdempotencyRepo,
      now: () => 1710000000000,
    });

    await expect(
      guardedOrderService.closeShortages('po-1', {
        items: [{ purchase_order_item_id: 'poi-1', close_qty: 3 }],
      })
    ).rejects.toThrow('关联订单采购进度已变化，请刷新后重试');

    expect(guardedOrderHarness.db.batch).toHaveBeenCalledTimes(1);
    expect(
      guardedOrderHarness.calls.runStatements.some((statement) =>
        statement.sql.includes('DELETE FROM command_idempotency')
      )
    ).toBe(true);
  });
});
