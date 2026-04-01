import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../../lib/hono/errors.js';
import { PurchaseOrderShortageClosureService } from '../PurchaseOrderShortageClosureService.js';

function createDbHarness({
  poRow = { id: 'po-1', status: 'shipping' },
  purchaseOrderItems = {},
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

  it('guards rollback so it only restores rows still matching the service-applied counters', async () => {
    const guardedHarness = createDbHarness({
      batchResultsQueue: [
        [{ meta: { changes: 1 } }, { meta: { changes: 0 } }],
        [{ meta: { changes: 1 } }],
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

    const revertStatements = guardedHarness.calls.batchCalls[1];
    expect(revertStatements).toHaveLength(1);
    expect(revertStatements[0].sql).toContain('AND received_qty = ?');
    expect(revertStatements[0].sql).toContain('AND cancelled_qty = ?');
    expect(revertStatements[0].sql).toContain('AND display_status = ?');
    expect(revertStatements[0].params).toEqual([0, 'partially_received', 'poi-1', 'po-1', 7, 3, 'received']);
  });

  it('reverts shortage closures when finalize persistence fails after the guarded item updates', async () => {
    const finalizeFailureHarness = createDbHarness({
      batchError: new Error('finalize failed'),
      batchErrorMatcher: (statement) => statement.sql.includes('UPDATE purchase_orders SET updated_at = ?'),
      batchErrorCallIndex: 2,
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

    expect(finalizeFailureHarness.db.batch).toHaveBeenCalledTimes(3);
    const revertStatements = finalizeFailureHarness.calls.batchCalls[2];
    expect(revertStatements).toHaveLength(2);
    expect(
      finalizeFailureHarness.calls.runStatements.some((statement) =>
        statement.sql.includes('DELETE FROM command_idempotency')
      )
    ).toBe(true);
    expect(
      revertStatements.every((statement) => statement.sql.includes('UPDATE purchase_order_items'))
    ).toBe(true);
  });
});
