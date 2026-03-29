import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../../lib/hono/errors.js';
import { OrderProcurementReceiptReversalService } from '../OrderProcurementReceiptReversalService.js';

function createDbHarness({
  poRow = { id: 'po-1', status: 'ordered' },
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
} = {}) {
  const calls = {
    reversalPayloads: [],
    inventoryMutations: [],
    outboxEvents: [],
    batchedStatements: [],
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
        run: vi.fn(async () => ({ meta: { changes: 1 } })),
      };

      if (sql.includes('FROM purchase_orders')) {
        statement.first = vi.fn(async () => poRow);
      }
      if (sql.includes('FROM purchase_order_items')) {
        statement.first = vi.fn(async () => purchaseOrderItemRow);
      }
      if (sql.includes('SUM(ordered_qty)')) {
        statement.first = vi.fn(async () => orderLineAggregateRow);
      }
      if (sql.includes('FROM inventory_balances')) {
        statement.first = vi.fn(async () => inventoryBalanceRow);
      }

      return statement;
    }),
    batch: vi.fn(async (statements = []) => {
      calls.batchedStatements = statements;
      return statements.map(() => ({ meta: { changes: 1 } }));
    }),
  };

  const purchaseReceiptRepo = {
    findReceiptWithLineage: vi.fn(async () => originalReceipt),
    createReversalInsertStatement: vi.fn((payload) => {
      calls.reversalPayloads.push(payload);
      return db.prepare(
        `INSERT INTO purchase_receipt_reversals (
          id, original_receipt_id, purchase_order_id, purchase_order_item_id, reversal_qty, reason, command_id, correlation_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
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
          db.prepare('UPDATE product_variants SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = ? WHERE id = ?')
            .bind(payload.quantityDelta, 1710000000000, payload.variantId),
          db.prepare('INSERT INTO inventory_events (id, variant_id, order_line_id, purchase_receipt_id, event_type, quantity_delta, source_type, source_id, metadata, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind('ie-reversal-1', payload.variantId, payload.orderLineId || null, payload.purchaseReceiptId || null, payload.type, payload.quantityDelta, payload.referenceType, payload.referenceId, JSON.stringify(payload.metadata || {}), 1710000000000, 1710000000000),
        ],
      };
    }),
  };

  const commandIdempotencyRepo = {
    reserveReversalCommand: vi.fn(async (_scopeKey, _idempotencyKey, requestFingerprint) => ({
      existing: false,
      record: {
        id: 'cmd-row-1',
        command_id: 'cmd-reversal-1',
        request_fingerprint: requestFingerprint,
        status: 'in_flight',
      },
      insertStatement: db.prepare(
        `INSERT INTO command_idempotency (
          id, command_type, scope_key, idempotency_key, command_id, request_fingerprint, response_json, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind('cmd-row-1', 'purchase_receipt_reversal', 'po-1:receipt-1', 'idem-1', 'cmd-reversal-1', requestFingerprint, null, 'in_flight', 1710000000000, 1710000000000),
    })),
    buildFinalizeStatement: vi.fn((commandId, responseJson, status) => (
      db.prepare('UPDATE command_idempotency SET response_json = ?, status = ?, updated_at = ? WHERE command_id = ?')
        .bind(JSON.stringify(responseJson), status, 1710000000000, commandId)
    )),
  };

  const domainOutboxRepo = {
    buildInsertStatements: vi.fn((events, resolveConsumers) => {
      calls.outboxEvents.push(...events);
      return events.flatMap((event, index) => {
        const consumers = resolveConsumers(event);
        return [
          db.prepare('INSERT INTO domain_outbox (id, command_id, sequence_in_command, event_type, event_version, aggregate_type, aggregate_id, correlation_id, causation_id, idempotency_key, payload_json, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(event.id, event.command_id, event.sequence_in_command, event.event_type, event.event_version, event.aggregate_type, event.aggregate_id, event.correlation_id, event.causation_id, event.idempotency_key, event.payload_json, event.occurred_at, 1710000000000),
          db.prepare('INSERT INTO outbox_consumer_jobs (id, consumer_name, event_id, status, attempt_count, available_at, leased_by, leased_until, last_error, processed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(`job-${index}`, consumers[0] || 'audit', event.id, 'pending', 0, 1710000000000, null, null, null, null, 1710000000000, 1710000000000),
        ];
      });
    }),
  };

  return { db, calls, purchaseReceiptRepo, inventoryService, commandIdempotencyRepo, domainOutboxRepo };
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
      now: () => 1710000000000,
    });
  });

  it('writes reversal receipt facts, inventory compensation, order projection correction, and outbox events in one transaction', async () => {
    const result = await service.reverseReceipt('po-1', 'receipt-1', {
      reason: 'rollback',
    }, {
      idempotencyKey: 'idem-1',
    });

    expect(result).toEqual(expect.objectContaining({
      purchase_order_id: 'po-1',
      receipt_id: 'receipt-1',
      reversal_qty: 5,
    }));
    expect(harness.calls.reversalPayloads[0]).toEqual(expect.objectContaining({
      original_receipt_id: 'receipt-1',
      purchase_order_id: 'po-1',
      reversal_qty: 5,
      command_id: 'cmd-reversal-1',
    }));
    expect(harness.inventoryService.buildMutationStatements).toHaveBeenCalledWith(expect.objectContaining({
      type: 'inventory_adjusted_reversal',
      quantityDelta: -5,
      purchaseReceiptId: 'receipt-1',
      referenceType: 'purchase_receipt_reversal',
    }));
    expect(harness.calls.outboxEvents.map((event) => event.event_type)).toEqual([
      'purchase_receipt_reversed',
      'inventory_receipt_reversed',
      'order_procurement_reversed',
    ]);
    expect(harness.db.batch).toHaveBeenCalledTimes(1);
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

    await expect(invalidService.reverseReceipt('po-1', 'receipt-1', {
      reason: 'rollback',
    }, {
      idempotencyKey: 'idem-1',
    })).rejects.toBeInstanceOf(BadRequestError);
  });

  it('replays the original reversal response for the same reversal idempotency key', async () => {
    harness.commandIdempotencyRepo.reserveReversalCommand.mockResolvedValueOnce({
      existing: true,
      record: {
        id: 'cmd-row-1',
        command_id: 'cmd-reversal-1',
        request_fingerprint: JSON.stringify({ purchase_order_id: 'po-1', receipt_id: 'receipt-1', reason: 'rollback' }),
        status: 'committed',
        response_json: JSON.stringify({
          purchase_order_id: 'po-1',
          receipt_id: 'receipt-1',
          reversal_qty: 5,
        }),
      },
      insertStatement: null,
    });

    const result = await service.reverseReceipt('po-1', 'receipt-1', {
      reason: 'rollback',
    }, {
      idempotencyKey: 'idem-1',
    });

    expect(result).toEqual({
      purchase_order_id: 'po-1',
      receipt_id: 'receipt-1',
      reversal_qty: 5,
    });
    expect(harness.db.batch).not.toHaveBeenCalled();
  });
});
