import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../../lib/hono/errors.js';
import { OrderProcurementReceiptReversalService } from '../OrderProcurementReceiptReversalService.js';

function createDbHarness({
  poRow = { id: 'po-1', status: 'ordered' },
  purchaseOrderAggregateRow = {
    ordered_qty: 5,
    received_qty: 5,
    cancelled_qty: 0,
    outstanding_qty: 0,
  },
  purchaseOrderItemRow = {
    id: 'poi-1',
    po_id: 'po-1',
    quantity: 10,
    received_qty: 5,
    cancelled_qty: 0,
  },
  orderLineAggregateRow = {
    ordered_qty: 5,
    procured_qty: 5,
    received_qty: 5,
    cancelled_qty: 0,
  },
  orderLineRow = {
    id: 'line-1',
    order_id: 'o-1',
    ordered_qty: 5,
    procured_qty: 5,
    received_qty: 5,
    reserved_qty: 0,
    shipped_qty: 0,
    cancelled_qty: 0,
  },
  inventoryBalanceRow = {
    variant_id: 'var-1',
    on_hand: 5,
    reserved: 0,
    available: 5,
  },
  originalReceipt = {
    receipt_id: 'receipt-1',
    purchase_order_id: 'po-1',
    purchase_order_item_id: 'poi-1',
    product_id: 'prod-1',
    variant_id: 'var-1',
    received_qty: 5,
    pre_order_id: 'o-1',
    order_line_id: 'line-1',
    inventory_event_id: 'ie-1',
  },
  batchError = null,
  batchErrorMatcher = null,
  batchResults = null,
} = {}) {
  const calls = {
    reversalPayloads: [],
    inventoryMutations: [],
    outboxEvents: [],
    batchedStatements: [],
    batchCalls: [],
    runStatements: [],
  };

  const db = {
    prepare: vi.fn((sql) => {
      const statement = {
        sql,
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
      if (sql.includes('SUM(quantity)') && sql.includes('FROM purchase_order_items')) {
        statement.first = vi.fn(async () => purchaseOrderAggregateRow);
      }
      if (sql.includes('FROM purchase_order_items') && sql.includes('WHERE id = ?')) {
        statement.first = vi.fn(async () => purchaseOrderItemRow);
      }
      if (sql.includes('SUM(ordered_qty)')) {
        statement.first = vi.fn(async () => orderLineAggregateRow);
      }
      if (sql.includes('FROM order_lines') && sql.includes('WHERE id = ?')) {
        statement.first = vi.fn(async () => orderLineRow);
      }
      if (sql.includes('FROM inventory_balances')) {
        statement.first = vi.fn(async () => inventoryBalanceRow);
      }

      return statement;
    }),
    batch: vi.fn(async (statements = []) => {
      calls.batchCalls.push(statements);
      calls.batchedStatements.push(...statements);
      if (
        batchError &&
        typeof batchErrorMatcher === 'function' &&
        statements.some((statement) => batchErrorMatcher(statement))
      ) {
        throw batchError;
      }
      return batchResults || statements.map(() => ({ meta: { changes: 1 } }));
    }),
  };

  const purchaseReceiptRepo = {
    findReceiptWithLineage: vi.fn(async () => originalReceipt),
    getReversalSummary: vi.fn(async () => ({
      reversed_qty: 0,
      reversal_count: 0,
    })),
    createReversalInsertStatement: vi.fn((payload) => {
      calls.reversalPayloads.push(payload);
      return db
        .prepare(
          `INSERT INTO purchase_receipt_reversals (
          id, original_receipt_id, purchase_order_id, purchase_order_item_id, reversal_qty, reason, command_id, correlation_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          payload.id,
          payload.original_receipt_id,
          payload.purchase_order_id,
          payload.purchase_order_item_id,
          payload.reversal_qty,
          payload.reason || null,
          payload.command_id,
          payload.correlation_id,
          payload.created_at
        );
    }),
  };

  const inventoryService = {
    buildMutationStatements: vi.fn((payload) => {
      calls.inventoryMutations.push(payload);
      return {
        inventoryEventId: 'ie-reversal-1',
        statements: [
          db
            .prepare(
              'UPDATE product_variants SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = ? WHERE id = ?'
            )
            .bind(payload.quantityDelta, 1710000000000, payload.variantId),
          db
            .prepare(
              'INSERT INTO inventory_events (id, variant_id, order_line_id, purchase_receipt_id, event_type, quantity_delta, source_type, source_id, metadata, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .bind(
              'ie-reversal-1',
              payload.variantId,
              payload.orderLineId || null,
              payload.purchaseReceiptId || null,
              payload.type,
              payload.quantityDelta,
              payload.referenceType,
              payload.referenceId,
              JSON.stringify(payload.metadata || {}),
              1710000000000,
              1710000000000
            ),
        ],
      };
    }),
  };

  const commandIdempotencyRepo = {
    buildInsertStatement: vi.fn((record) =>
      db
        .prepare(
          `INSERT INTO command_idempotency (
          id, command_type, scope_key, idempotency_key, command_id, request_fingerprint, response_json, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          record.id,
          record.command_type,
          record.scope_key,
          record.idempotency_key,
          record.command_id,
          record.request_fingerprint,
          record.response_json,
          record.status,
          record.created_at,
          record.updated_at
        )
    ),
    reserveReversalCommand: vi.fn(async (_scopeKey, _idempotencyKey, requestFingerprint) => ({
      existing: false,
      record: {
        id: 'cmd-row-1',
        command_id: 'cmd-reversal-1',
        request_fingerprint: requestFingerprint,
        status: 'in_flight',
      },
      insertStatement: db
        .prepare(
          `INSERT INTO command_idempotency (
          id, command_type, scope_key, idempotency_key, command_id, request_fingerprint, response_json, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          'cmd-row-1',
          'purchase_receipt_reversal',
          'po-1:receipt-1',
          'idem-1',
          'cmd-reversal-1',
          requestFingerprint,
          null,
          'in_flight',
          1710000000000,
          1710000000000
        ),
    })),
    buildFinalizeStatement: vi.fn((commandId, responseJson, status) =>
      db
        .prepare(
          'UPDATE command_idempotency SET response_json = ?, status = ?, updated_at = ? WHERE command_id = ?'
        )
        .bind(JSON.stringify(responseJson), status, 1710000000000, commandId)
    ),
    buildDeleteStatement: vi.fn((commandId) =>
      db.prepare('DELETE FROM command_idempotency WHERE command_id = ?').bind(commandId)
    ),
  };

  const domainOutboxRepo = {
    buildInsertStatements: vi.fn((events, resolveConsumers) => {
      calls.outboxEvents.push(...events);
      return events.flatMap((event, index) => {
        const consumers = resolveConsumers(event);
        return [
          db
            .prepare(
              'INSERT INTO domain_outbox (id, command_id, sequence_in_command, event_type, event_version, aggregate_type, aggregate_id, correlation_id, causation_id, idempotency_key, payload_json, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .bind(
              event.id,
              event.command_id,
              event.sequence_in_command,
              event.event_type,
              event.event_version,
              event.aggregate_type,
              event.aggregate_id,
              event.correlation_id,
              event.causation_id,
              event.idempotency_key,
              event.payload_json,
              event.occurred_at,
              1710000000000
            ),
          db
            .prepare(
              'INSERT INTO outbox_consumer_jobs (id, consumer_name, event_id, status, attempt_count, available_at, leased_by, leased_until, last_error, processed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .bind(
              `job-${index}`,
              consumers[0] || 'audit',
              event.id,
              'pending',
              0,
              1710000000000,
              null,
              null,
              null,
              null,
              1710000000000,
              1710000000000
            ),
        ];
      });
    }),
  };

  const variantDemandProjectionRefreshService = {
    refreshByVariantIds: vi.fn(async () => []),
  };

  return {
    db,
    calls,
    purchaseReceiptRepo,
    inventoryService,
    commandIdempotencyRepo,
    domainOutboxRepo,
    variantDemandProjectionRefreshService,
  };
}

describe('OrderProcurementReceiptReversalService', () => {
  let harness;
  let service;

  beforeEach(() => {
    vi.restoreAllMocks();
    harness = createDbHarness();
    service = new OrderProcurementReceiptReversalService(harness.db, {
      purchaseReceiptRepo: harness.purchaseReceiptRepo,
      inventoryService: harness.inventoryService,
      commandIdempotencyRepo: harness.commandIdempotencyRepo,
      domainOutboxRepo: harness.domainOutboxRepo,
      variantDemandProjectionRefreshService: harness.variantDemandProjectionRefreshService,
      now: () => 1710000000000,
    });
  });

  it('writes reversal receipt facts, inventory compensation, order projection correction, and outbox events in one transaction', async () => {
    const result = await service.reverseReceipt(
      'po-1',
      'receipt-1',
      {
        reason: 'rollback',
      },
      {
        idempotencyKey: 'idem-1',
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        purchase_order_id: 'po-1',
        receipt_id: 'receipt-1',
        reversal_qty: 5,
      })
    );
    expect(harness.calls.reversalPayloads[0]).toEqual(
      expect.objectContaining({
        original_receipt_id: 'receipt-1',
        purchase_order_id: 'po-1',
        reversal_qty: 5,
        command_id: 'cmd-reversal-1',
      })
    );
    expect(harness.inventoryService.buildMutationStatements).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'inventory_adjusted_reversal',
        quantityDelta: -5,
        purchaseReceiptId: 'receipt-1',
        referenceType: 'purchase_receipt_reversal',
      })
    );
    expect(harness.calls.outboxEvents.map((event) => event.event_type)).toEqual([
      'purchase_receipt_reversed',
      'inventory_receipt_reversed',
      'order_procurement_reversed',
    ]);
    expect(harness.db.batch).toHaveBeenCalledTimes(1);
    expect(harness.variantDemandProjectionRefreshService.refreshByVariantIds).toHaveBeenCalledWith([
      'var-1',
    ]);
  });

  it('applies guarded counter updates together with reversal facts in a single final batch', async () => {
    await service.reverseReceipt(
      'po-1',
      'receipt-1',
      {
        reason: 'rollback',
      },
      {
        idempotencyKey: 'idem-1',
      }
    );

    expect(harness.db.batch).toHaveBeenCalledTimes(1);
    const finalStatements = harness.calls.batchCalls[0];
    expect(
      finalStatements.some((statement) => statement.sql.includes('INSERT INTO command_idempotency'))
    ).toBe(true);
    expect(
      finalStatements.some(
        (statement) =>
          statement.sql.includes('UPDATE purchase_order_items') &&
          statement.sql.includes('AND received_qty = ?') &&
          statement.sql.includes('AND cancelled_qty = ?')
      )
    ).toBe(true);
    expect(
      finalStatements.some(
        (statement) =>
          statement.sql.includes('UPDATE order_lines') &&
          statement.sql.includes('AND received_qty = ?') &&
          statement.sql.includes('AND cancelled_qty = ?')
      )
    ).toBe(true);
    expect(
      finalStatements.some((statement) =>
        statement.sql.includes('INSERT INTO purchase_receipt_reversals')
      )
    ).toBe(true);
  });

  it('performs idempotency cleanup only when the final batch fails without running rollback projection batches', async () => {
    const failureHarness = createDbHarness({
      batchError: new Error('final batch failed'),
      batchErrorMatcher: (statement) =>
        statement.sql.includes('INSERT INTO purchase_receipt_reversals'),
    });
    const failureService = new OrderProcurementReceiptReversalService(failureHarness.db, {
      purchaseReceiptRepo: failureHarness.purchaseReceiptRepo,
      inventoryService: failureHarness.inventoryService,
      commandIdempotencyRepo: failureHarness.commandIdempotencyRepo,
      domainOutboxRepo: failureHarness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    await expect(
      failureService.reverseReceipt(
        'po-1',
        'receipt-1',
        { reason: 'rollback' },
        { idempotencyKey: 'idem-1' }
      )
    ).rejects.toThrow('final batch failed');
    expect(failureHarness.db.batch).toHaveBeenCalledTimes(1);
    expect(
      failureHarness.calls.runStatements.some((statement) =>
        statement.sql.includes('DELETE FROM command_idempotency')
      )
    ).toBe(true);
  });

  it('downgrades arrived purchase orders back to shipping when reversal reopens receivable quantity', async () => {
    const arrivedHarness = createDbHarness({
      poRow: { id: 'po-1', status: 'arrived' },
      purchaseOrderAggregateRow: {
        ordered_qty: 5,
        received_qty: 5,
        cancelled_qty: 0,
        outstanding_qty: 0,
      },
    });
    const arrivedService = new OrderProcurementReceiptReversalService(arrivedHarness.db, {
      purchaseReceiptRepo: arrivedHarness.purchaseReceiptRepo,
      inventoryService: arrivedHarness.inventoryService,
      commandIdempotencyRepo: arrivedHarness.commandIdempotencyRepo,
      domainOutboxRepo: arrivedHarness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    await arrivedService.reverseReceipt(
      'po-1',
      'receipt-1',
      {
        reason: 'reopen receiving',
      },
      {
        idempotencyKey: 'idem-arrived',
      }
    );

    const purchaseOrderUpdate = arrivedHarness.calls.batchedStatements.find(
      (statement) =>
        statement.sql.includes('UPDATE purchase_orders') &&
        statement.sql.includes('SET status = ?') &&
        statement.sql.includes('AND status = ?')
    );

    expect(purchaseOrderUpdate?.params).toEqual(['shipping', 1710000000000, 'po-1', 'arrived']);
  });

  it('rejects reversing receipts on completed purchase orders', async () => {
    const completedHarness = createDbHarness({
      poRow: { id: 'po-1', status: 'completed' },
    });
    const completedService = new OrderProcurementReceiptReversalService(completedHarness.db, {
      purchaseReceiptRepo: completedHarness.purchaseReceiptRepo,
      inventoryService: completedHarness.inventoryService,
      commandIdempotencyRepo: completedHarness.commandIdempotencyRepo,
      domainOutboxRepo: completedHarness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    await expect(
      completedService.reverseReceipt(
        'po-1',
        'receipt-1',
        {
          reason: 'completed guard',
        },
        {
          idempotencyKey: 'idem-completed',
        }
      )
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(completedHarness.db.batch).not.toHaveBeenCalled();
  });

  it('rejects reversal when downstream invariants would be broken', async () => {
    const invalidHarness = createDbHarness({
      inventoryBalanceRow: {
        variant_id: 'var-1',
        on_hand: 1,
        reserved: 0,
        available: 1,
      },
    });
    const invalidService = new OrderProcurementReceiptReversalService(invalidHarness.db, {
      purchaseReceiptRepo: invalidHarness.purchaseReceiptRepo,
      inventoryService: invalidHarness.inventoryService,
      commandIdempotencyRepo: invalidHarness.commandIdempotencyRepo,
      domainOutboxRepo: invalidHarness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    await expect(
      invalidService.reverseReceipt(
        'po-1',
        'receipt-1',
        {
          reason: 'rollback',
        },
        {
          idempotencyKey: 'idem-1',
        }
      )
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('replays the original reversal response for the same reversal idempotency key', async () => {
    harness.commandIdempotencyRepo.reserveReversalCommand.mockResolvedValueOnce({
      existing: true,
      record: {
        id: 'cmd-row-1',
        command_id: 'cmd-reversal-1',
        request_fingerprint: JSON.stringify({
          purchase_order_id: 'po-1',
          receipt_id: 'receipt-1',
          reason: 'rollback',
        }),
        status: 'committed',
        response_json: JSON.stringify({
          purchase_order_id: 'po-1',
          receipt_id: 'receipt-1',
          reversal_qty: 5,
        }),
      },
      insertStatement: null,
    });

    const result = await service.reverseReceipt(
      'po-1',
      'receipt-1',
      {
        reason: 'rollback',
      },
      {
        idempotencyKey: 'idem-1',
      }
    );

    expect(result).toEqual({
      purchase_order_id: 'po-1',
      receipt_id: 'receipt-1',
      reversal_qty: 5,
    });
    expect(harness.db.batch).not.toHaveBeenCalled();
  });

  it('rejects the same reversal idempotency key when the request fingerprint changes', async () => {
    harness.commandIdempotencyRepo.reserveReversalCommand.mockResolvedValueOnce({
      existing: true,
      record: {
        id: 'cmd-row-1',
        command_id: 'cmd-reversal-1',
        request_fingerprint: JSON.stringify({
          purchase_order_id: 'po-1',
          receipt_id: 'receipt-1',
          reason: 'old reason',
        }),
        status: 'committed',
        response_json: JSON.stringify({ ok: true }),
      },
      insertStatement: null,
    });

    await expect(
      service.reverseReceipt(
        'po-1',
        'receipt-1',
        {
          reason: 'new reason',
        },
        {
          idempotencyKey: 'idem-1',
        }
      )
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(harness.db.batch).not.toHaveBeenCalled();
  });

  it('rejects reversing the same receipt twice even with a different command idempotency key', async () => {
    harness.purchaseReceiptRepo.getReversalSummary.mockResolvedValueOnce({
      reversed_qty: 5,
      reversal_count: 1,
    });

    await expect(
      service.reverseReceipt(
        'po-1',
        'receipt-1',
        {
          reason: 'rollback',
        },
        {
          idempotencyKey: 'idem-2',
        }
      )
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(harness.db.batch).not.toHaveBeenCalled();
    expect(harness.inventoryService.buildMutationStatements).not.toHaveBeenCalled();
  });

  it('reduces order line received quantity from its current aggregate instead of replacing sibling receipts', async () => {
    const aggregateHarness = createDbHarness({
      purchaseOrderItemRow: {
        id: 'poi-1',
        po_id: 'po-1',
        quantity: 10,
        received_qty: 8,
        cancelled_qty: 0,
      },
      orderLineAggregateRow: {
        ordered_qty: 10,
        procured_qty: 10,
        received_qty: 8,
        cancelled_qty: 0,
      },
      orderLineRow: {
        id: 'line-1',
        order_id: 'o-1',
        ordered_qty: 10,
        procured_qty: 10,
        received_qty: 8,
        reserved_qty: 0,
        shipped_qty: 0,
        cancelled_qty: 0,
      },
      inventoryBalanceRow: {
        variant_id: 'var-1',
        on_hand: 8,
        reserved: 0,
        available: 8,
      },
      originalReceipt: {
        receipt_id: 'receipt-1',
        purchase_order_id: 'po-1',
        purchase_order_item_id: 'poi-1',
        product_id: 'prod-1',
        variant_id: 'var-1',
        received_qty: 3,
        pre_order_id: 'o-1',
        order_line_id: 'line-1',
        inventory_event_id: 'ie-1',
      },
    });
    const aggregateService = new OrderProcurementReceiptReversalService(aggregateHarness.db, {
      purchaseReceiptRepo: aggregateHarness.purchaseReceiptRepo,
      inventoryService: aggregateHarness.inventoryService,
      commandIdempotencyRepo: aggregateHarness.commandIdempotencyRepo,
      domainOutboxRepo: aggregateHarness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    await aggregateService.reverseReceipt(
      'po-1',
      'receipt-1',
      {
        reason: 'rollback',
      },
      {
        idempotencyKey: 'idem-1',
      }
    );

    const orderLineUpdate = aggregateHarness.calls.batchedStatements.find((statement) =>
      statement.sql.includes('UPDATE order_lines')
    );
    const poItemUpdate = aggregateHarness.calls.batchedStatements.find((statement) =>
      statement.sql.includes('UPDATE purchase_order_items')
    );

    expect(orderLineUpdate?.params).toEqual([
      5,
      'partially_received',
      1710000000000,
      'line-1',
      'o-1',
      8,
      0,
      10,
      10,
      0,
      0,
    ]);
    expect(poItemUpdate?.params.slice(0, 2)).toEqual([5, 'partially_received']);
  });

  it('does not fail the reversal after source facts commit when a linked-order projection reports zero guarded changes', async () => {
    const projectionHarness = createDbHarness({
      batchResults: [{ meta: { changes: 1 } }, { meta: { changes: 1 } }, { meta: { changes: 0 } }],
    });
    const projectionService = new OrderProcurementReceiptReversalService(projectionHarness.db, {
      purchaseReceiptRepo: projectionHarness.purchaseReceiptRepo,
      inventoryService: projectionHarness.inventoryService,
      commandIdempotencyRepo: projectionHarness.commandIdempotencyRepo,
      domainOutboxRepo: projectionHarness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    await expect(
      projectionService.reverseReceipt(
        'po-1',
        'receipt-1',
        {
          reason: 'rollback',
        },
        {
          idempotencyKey: 'idem-1',
        }
      )
    ).resolves.toEqual(
      expect.objectContaining({
        purchase_order_id: 'po-1',
        receipt_id: 'receipt-1',
        reversal_qty: 5,
      })
    );
  });

  it('still emits reversal outbox events when the original receipt has no variant inventory mutation', async () => {
    const nonInventoryHarness = createDbHarness({
      inventoryBalanceRow: null,
      originalReceipt: {
        receipt_id: 'receipt-1',
        purchase_order_id: 'po-1',
        purchase_order_item_id: 'poi-1',
        product_id: 'prod-1',
        variant_id: null,
        received_qty: 2,
        pre_order_id: 'o-1',
        order_line_id: 'line-1',
        inventory_event_id: null,
      },
    });
    const nonInventoryService = new OrderProcurementReceiptReversalService(nonInventoryHarness.db, {
      purchaseReceiptRepo: nonInventoryHarness.purchaseReceiptRepo,
      inventoryService: nonInventoryHarness.inventoryService,
      commandIdempotencyRepo: nonInventoryHarness.commandIdempotencyRepo,
      domainOutboxRepo: nonInventoryHarness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    await nonInventoryService.reverseReceipt(
      'po-1',
      'receipt-1',
      {
        reason: 'rollback',
      },
      {
        idempotencyKey: 'idem-1',
      }
    );

    expect(nonInventoryHarness.inventoryService.buildMutationStatements).not.toHaveBeenCalled();
    expect(nonInventoryHarness.calls.outboxEvents.map((event) => event.event_type)).toEqual([
      'purchase_receipt_reversed',
      'order_procurement_reversed',
    ]);
  });

  it('rejects concurrent duplicate reversal writes when the original receipt unique guard trips', async () => {
    const duplicateHarness = createDbHarness({
      batchError: new Error(
        'UNIQUE constraint failed: purchase_receipt_reversals.original_receipt_id'
      ),
      batchErrorMatcher: (statement) =>
        statement.sql.includes('INSERT INTO purchase_receipt_reversals'),
    });
    const duplicateService = new OrderProcurementReceiptReversalService(duplicateHarness.db, {
      purchaseReceiptRepo: duplicateHarness.purchaseReceiptRepo,
      inventoryService: duplicateHarness.inventoryService,
      commandIdempotencyRepo: duplicateHarness.commandIdempotencyRepo,
      domainOutboxRepo: duplicateHarness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    await expect(
      duplicateService.reverseReceipt(
        'po-1',
        'receipt-1',
        {
          reason: 'race',
        },
        {
          idempotencyKey: 'idem-1',
        }
      )
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(
      duplicateHarness.calls.runStatements.some((statement) =>
        statement.sql.includes('DELETE FROM command_idempotency')
      )
    ).toBe(true);
  });

  it('rejects a second concurrent reversal writer before downstream side effects run when the receipt lock is held', async () => {
    const lockedHarness = createDbHarness();
    lockedHarness.commandIdempotencyRepo.buildInsertStatement.mockImplementationOnce((record) =>
      lockedHarness.db
        .prepare(
          `INSERT INTO command_idempotency (
          id, command_type, scope_key, idempotency_key, command_id, request_fingerprint, response_json, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          record.id,
          record.command_type,
          record.scope_key,
          record.idempotency_key,
          record.command_id,
          record.request_fingerprint,
          record.response_json,
          record.status,
          record.created_at,
          record.updated_at
        )
    );
    const originalRun = lockedHarness.db.prepare.mock.results[0]?.value?.run;
    const lockedService = new OrderProcurementReceiptReversalService(lockedHarness.db, {
      purchaseReceiptRepo: lockedHarness.purchaseReceiptRepo,
      inventoryService: lockedHarness.inventoryService,
      commandIdempotencyRepo: {
        ...lockedHarness.commandIdempotencyRepo,
        buildInsertStatement: vi.fn((record) => {
          const statement = lockedHarness.db
            .prepare(
              `INSERT INTO command_idempotency (
              id, command_type, scope_key, idempotency_key, command_id, request_fingerprint, response_json, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              record.id,
              record.command_type,
              record.scope_key,
              record.idempotency_key,
              record.command_id,
              record.request_fingerprint,
              record.response_json,
              record.status,
              record.created_at,
              record.updated_at
            );
          statement.run = vi.fn(async () => ({ meta: { changes: 0 } }));
          return statement;
        }),
      },
      domainOutboxRepo: lockedHarness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    await expect(
      lockedService.reverseReceipt(
        'po-1',
        'receipt-1',
        {
          reason: 'race',
        },
        {
          idempotencyKey: 'idem-1',
        }
      )
    ).rejects.toBeInstanceOf(BadRequestError);

    expect(lockedHarness.purchaseReceiptRepo.createReversalInsertStatement).not.toHaveBeenCalled();
    expect(lockedHarness.inventoryService.buildMutationStatements).not.toHaveBeenCalled();
  });
});
