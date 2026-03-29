import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../../lib/hono/errors.js';
import { projectOrderLineStatus } from '../OrderStatusProjectionService.js';

import { OrderProcurementDomainService } from '../OrderProcurementDomainService.js';

function createDbHarness({
  poRow = { id: 'po-1', status: 'ordered' },
  purchaseOrderItemRow = {
    id: 'poi-1',
    po_id: 'po-1',
    product_id: 'prod-1',
    variant_id: 'var-1',
    pre_order_id: 'o-1',
    quantity: 10,
    received_qty: 2,
    cancelled_qty: 0,
  },
  orderLineProgressRow = {
    id: 'line-1',
    order_id: 'o-1',
    product_id: 'prod-1',
    variant_id: 'var-1',
    ordered_qty: 5,
    procured_qty: 0,
    received_qty: 1,
    reserved_qty: 0,
    shipped_qty: 0,
    cancelled_qty: 0,
  },
  matchingOrderLines = [{
    id: 'line-1',
    order_id: 'o-1',
    product_id: 'prod-1',
    variant_id: 'var-1',
    ordered_qty: 5,
    procured_qty: 0,
    received_qty: 1,
    reserved_qty: 0,
    shipped_qty: 0,
    cancelled_qty: 0,
  }],
  orderLineAggregateRow = {
    ordered_qty: 5,
    procured_qty: 0,
    received_qty: 1,
    cancelled_qty: 0,
  },
  purchaseOrderItemUpdateResult = { meta: { changes: 1 } },
  purchaseOrderItemUpdateError = null,
  inventoryBalanceRow = {
    variant_id: 'var-1',
    on_hand: 4,
    reserved: 0,
    available: 4,
  },
} = {}) {
  const calls = {
    receiptInsertPayloads: [],
    inventoryMutations: [],
    outboxEvents: [],
    outboxConsumers: [],
    outboxConsumerMatrix: [],
    batchedStatements: [],
  };

  const db = {
    prepare: vi.fn((sql) => {
      const statement = {
        sql,
        bind: vi.fn((...params) => {
          statement._params = params;
          statement.params = params;
          return statement;
        }),
        first: vi.fn(async () => null),
        all: vi.fn(async () => ({ results: [] })),
        run: vi.fn(async () => ({ meta: { changes: 1 } })),
      };

      if (sql.includes('FROM purchase_order_items')) {
        statement.first = vi.fn(async () => purchaseOrderItemRow);
      }

      if (sql.includes('FROM purchase_orders')) {
        statement.first = vi.fn(async () => poRow);
      }

      if (sql.includes('FROM order_lines') && sql.includes('ORDER BY created_at ASC')) {
        statement.first = vi.fn(async () => orderLineProgressRow);
      }

      if (sql.includes('FROM order_lines') && sql.includes('LIMIT 2')) {
        statement.all = vi.fn(async () => ({ results: matchingOrderLines }));
      }

      if (sql.includes('FROM order_lines') && sql.includes('SUM(ordered_qty)')) {
        statement.first = vi.fn(async () => orderLineAggregateRow);
      }

      if (sql.includes('FROM inventory_balances')) {
        statement.first = vi.fn(async () => inventoryBalanceRow);
      }

      return statement;
    }),
    batch: vi.fn(async (statements = []) => {
      calls.batchedStatements = statements;
      return statements.map((statement) => {
        if (statement.sql?.includes('UPDATE purchase_order_items')) {
          if (purchaseOrderItemUpdateError) throw purchaseOrderItemUpdateError;
          return purchaseOrderItemUpdateResult;
        }
        return { meta: { changes: 1 } };
      });
    }),
  };

  const purchaseReceiptRepo = {
    createInsertStatement: vi.fn((payload) => {
      calls.receiptInsertPayloads.push(payload);
      return db.prepare(
        `INSERT INTO purchase_receipts (
          id, purchase_order_id, purchase_order_item_id, product_id, variant_id, receipt_no,
          received_qty, note, received_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        payload.id,
        payload.purchase_order_id,
        payload.purchase_order_item_id,
        payload.product_id,
        payload.variant_id,
        payload.receipt_no || null,
        payload.received_qty,
        payload.note || null,
        payload.received_at,
        payload.created_at,
        payload.updated_at
      );
    }),
  };

  const inventoryService = {
    buildMutationStatements: vi.fn((payload) => {
      calls.inventoryMutations.push(payload);
      return {
        inventoryEventId: 'ie-1',
        ledgerId: 'il-1',
        statements: [
          db.prepare('UPDATE product_variants SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = ? WHERE id = ?')
            .bind(payload.quantityDelta, 1710000000000, payload.variantId),
          db.prepare('INSERT INTO inventory_balances (variant_id, on_hand, reserved, available, updated_at) VALUES (?, ?, 0, ?, ?)')
            .bind(payload.variantId, payload.quantityDelta, payload.quantityDelta, 1710000000000),
          db.prepare('INSERT INTO inventory_ledger (id, variant_id, event_type, quantity_delta, reference_type, reference_id, occurred_at, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind('il-1', payload.variantId, payload.type, payload.quantityDelta, payload.referenceType, payload.referenceId, 1710000000000, JSON.stringify(payload.metadata || {}), 1710000000000),
          db.prepare('INSERT INTO inventory_events (id, variant_id, order_line_id, purchase_receipt_id, event_type, quantity_delta, source_type, source_id, metadata, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind('ie-1', payload.variantId, payload.orderLineId || null, payload.purchaseReceiptId || null, payload.type, payload.quantityDelta, payload.referenceType, payload.referenceId, JSON.stringify(payload.metadata || {}), 1710000000000, 1710000000000),
        ],
      };
    }),
  };

  const commandIdempotencyRepo = {
    reserveReceiptCommand: vi.fn(async (_scopeKey, _idempotencyKey, requestFingerprint) => ({
      existing: false,
      record: {
        id: 'cmd-row-1',
        command_id: 'cmd-1',
        request_fingerprint: requestFingerprint,
        status: 'in_flight',
      },
      insertStatement: db.prepare(
        `INSERT INTO command_idempotency (
          id, command_type, scope_key, idempotency_key, command_id, request_fingerprint, response_json, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind('cmd-row-1', 'purchase_receipt_record', 'po-1', 'idem-1', 'cmd-1', requestFingerprint, null, 'in_flight', 1710000000000, 1710000000000),
    })),
    buildFinalizeStatement: vi.fn((commandId, responseJson, status) => (
      db.prepare('UPDATE command_idempotency SET response_json = ?, status = ?, updated_at = ? WHERE command_id = ?')
        .bind(JSON.stringify(responseJson), status, 1710000000000, commandId)
    )),
  };

  const domainOutboxRepo = {
    buildInsertStatements: vi.fn((events, resolveConsumers) => {
      calls.outboxEvents.push(...events);
      const resolve = typeof resolveConsumers === 'function'
        ? resolveConsumers
        : () => resolveConsumers || [];

      return events.flatMap((event, index) => {
        const consumerNames = resolve(event);
        calls.outboxConsumerMatrix.push({
          eventType: event.event_type,
          consumers: [...consumerNames],
        });
        calls.outboxConsumers.push(...consumerNames);

        return [
        db.prepare(
          `INSERT INTO domain_outbox (
            id, command_id, sequence_in_command, event_type, event_version, aggregate_type,
            aggregate_id, correlation_id, causation_id, idempotency_key, payload_json, occurred_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
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
        db.prepare(
          `INSERT INTO outbox_consumer_jobs (
            id, consumer_name, event_id, status, attempt_count, available_at,
            leased_by, leased_until, last_error, processed_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(`job-${index}`, consumerNames[0] || 'audit', event.id, 'pending', 0, 1710000000000, null, null, null, null, 1710000000000, 1710000000000),
      ];
      });
    }),
  };

  return { db, calls, purchaseReceiptRepo, inventoryService, commandIdempotencyRepo, domainOutboxRepo };
}

describe('OrderProcurementDomainService', () => {
  let harness;
  let service;

  beforeEach(() => {
    vi.restoreAllMocks();
    harness = createDbHarness();
    service = new OrderProcurementDomainService(harness.db, {
      purchaseReceiptRepo: harness.purchaseReceiptRepo,
      inventoryService: harness.inventoryService,
      commandIdempotencyRepo: harness.commandIdempotencyRepo,
      domainOutboxRepo: harness.domainOutboxRepo,
      now: () => 1710000000000,
    });
  });

  it('commits purchase item, receipt, inventory, order progress, and outbox in one transaction batch', async () => {
    const result = await service.recordPurchaseOrderReceipts('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 3, note: 'ok' }],
    }, {
      idempotencyKey: 'idem-1',
    });

    expect(result).toEqual(expect.objectContaining({
      purchase_order_id: 'po-1',
      receipt_count: 1,
    }));

    expect(harness.db.batch).toHaveBeenCalledTimes(1);
    const sqlBatch = harness.calls.batchedStatements.map((statement) => statement.sql).join('\n');
    expect(sqlBatch).toContain('INSERT INTO command_idempotency');
    expect(sqlBatch).toContain('UPDATE purchase_order_items');
    expect(sqlBatch).toContain('INSERT INTO purchase_receipts');
    expect(sqlBatch).toContain('INSERT INTO inventory_ledger');
    expect(sqlBatch).toContain('INSERT INTO inventory_events');
    expect(sqlBatch).toContain('UPDATE order_lines');
    expect(sqlBatch).toContain('UPDATE orders');
    expect(sqlBatch).toContain('INSERT INTO domain_outbox');
    expect(sqlBatch).toContain('INSERT INTO outbox_consumer_jobs');
    expect(sqlBatch).toContain('UPDATE command_idempotency');
    expect(harness.calls.outboxEvents.map((event) => event.event_type)).toEqual([
      'purchase_receipt_recorded',
      'inventory_received',
      'order_procurement_progressed',
    ]);
  });

  it('keeps audit/cache on existing receipt events and adds notification only where declared', async () => {
    await service.recordPurchaseOrderReceipts('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 3, note: 'ok' }],
    }, {
      idempotencyKey: 'idem-1',
    });

    const [, resolveConsumers] = harness.domainOutboxRepo.buildInsertStatements.mock.calls[0];
    expect(typeof resolveConsumers).toBe('function');
    expect(harness.calls.outboxConsumerMatrix).toEqual([
      {
        eventType: 'purchase_receipt_recorded',
        consumers: ['audit', 'cache', 'notification', 'webhook'],
      },
      {
        eventType: 'inventory_received',
        consumers: ['audit', 'cache'],
      },
      {
        eventType: 'order_procurement_progressed',
        consumers: ['audit', 'cache', 'notification', 'webhook'],
      },
    ]);
  });

  it('stores purchase_order_id in order procurement outbox payloads for downstream cache replay', async () => {
    await service.recordPurchaseOrderReceipts('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 3, note: 'ok' }],
    }, {
      idempotencyKey: 'idem-1',
    });

    const orderProgressEvent = harness.calls.outboxEvents.find((event) => event.event_type === 'order_procurement_progressed');
    expect(orderProgressEvent).toBeTruthy();
    expect(JSON.parse(orderProgressEvent.payload_json)).toEqual(expect.objectContaining({
      purchase_order_id: 'po-1',
      order_line_id: 'line-1',
      order_procurement_status_after: 'partially_arrived',
    }));
  });

  it('stores and replays the original response for the same purchase_order_id + idempotency_key', async () => {
    harness.commandIdempotencyRepo.reserveReceiptCommand.mockResolvedValueOnce({
      existing: true,
      record: {
        id: 'cmd-row-1',
        command_id: 'cmd-1',
        request_fingerprint: JSON.stringify({
          purchase_order_id: 'po-1',
          items: [{ purchase_order_item_id: 'poi-1', received_qty: 3, note: 'ok' }],
        }),
        status: 'committed',
        response_json: JSON.stringify({
          purchase_order_id: 'po-1',
          receipt_count: 1,
          receipts: [{ id: 'pr-1', purchase_order_item_id: 'poi-1', received_qty: 3 }],
        }),
      },
      insertStatement: null,
    });

    const result = await service.recordPurchaseOrderReceipts('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 3, note: 'ok' }],
    }, {
      idempotencyKey: 'idem-1',
    });

    expect(result).toEqual({
      purchase_order_id: 'po-1',
      receipt_count: 1,
      receipts: [{ id: 'pr-1', purchase_order_item_id: 'poi-1', received_qty: 3 }],
    });
    expect(harness.db.batch).not.toHaveBeenCalled();
  });

  it('rejects the same idempotency key when the request fingerprint changes', async () => {
    harness.commandIdempotencyRepo.reserveReceiptCommand.mockResolvedValueOnce({
      existing: true,
      record: {
        id: 'cmd-row-1',
        command_id: 'cmd-1',
        request_fingerprint: JSON.stringify({
          purchase_order_id: 'po-1',
          items: [{ purchase_order_item_id: 'poi-1', received_qty: 2, note: 'old' }],
        }),
        status: 'committed',
        response_json: JSON.stringify({ ok: true }),
      },
      insertStatement: null,
    });

    await expect(service.recordPurchaseOrderReceipts('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 3, note: 'ok' }],
    }, {
      idempotencyKey: 'idem-1',
    })).rejects.toBeInstanceOf(BadRequestError);

    expect(harness.db.batch).not.toHaveBeenCalled();
  });

  it('records receipt rows, updates purchase_order_items progress, updates linked order_lines progress, and writes inventory with receipt refs', async () => {
    const result = await service.recordPurchaseOrderReceipts('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 3, note: 'ok' }],
    }, {
      idempotencyKey: 'idem-1',
    });

    expect(result).toEqual(
      expect.objectContaining({
        purchase_order_id: 'po-1',
        receipt_count: 1,
      })
    );

    expect(harness.purchaseReceiptRepo.createInsertStatement).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        purchase_order_id: 'po-1',
        purchase_order_item_id: 'poi-1',
        product_id: 'prod-1',
        variant_id: 'var-1',
        received_qty: 3,
        note: 'ok',
      })
    );

    const poiUpdateStatement = harness.calls.batchedStatements.find((statement) => statement.sql.includes('UPDATE purchase_order_items'));
    const poiUpdateParams = poiUpdateStatement.params;
    expect(poiUpdateParams[0]).toBe(5); // 2 prior + 3 new
    expect(poiUpdateParams[1]).toBe('partially_received');

    const lineUpdateStatement = harness.calls.batchedStatements.find((statement) => statement.sql.includes('UPDATE order_lines'));
    const lineUpdateParams = lineUpdateStatement.params;
    expect(lineUpdateParams[0]).toBe(5);
    expect(lineUpdateParams[1]).toBe(5);
    expect(lineUpdateParams[2]).toBe(4);
    expect(lineUpdateParams[6]).toBe(projectOrderLineStatus({
      ordered_qty: 5,
      procured_qty: 5,
      received_qty: 4,
      reserved_qty: 0,
      shipped_qty: 0,
      cancelled_qty: 0,
    }));

    expect(harness.inventoryService.buildMutationStatements).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'purchase_received',
        variantId: 'var-1',
        quantityDelta: 3,
        purchaseReceiptId: expect.any(String),
        referenceType: 'purchase_receipt',
        referenceId: expect.any(String),
      })
    );
  });

  it('rejects receipts that target items outside the purchase order', async () => {
    harness.db.prepare.mockImplementationOnce(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => ({ id: 'poi-foreign', po_id: 'po-foreign' })),
      })),
    }));

    await expect(service.recordPurchaseOrderReceipts('po-1', {
      items: [{ purchase_order_item_id: 'poi-foreign', received_qty: 1 }],
    }, {
      idempotencyKey: 'idem-1',
    })).rejects.toBeInstanceOf(BadRequestError);
  });

  it('rejects receipts when purchase order status is not ordered or shipping', async () => {
    const invalidHarness = createDbHarness({ poRow: { id: 'po-1', status: 'draft' } });
    const invalidService = new OrderProcurementDomainService(invalidHarness.db, {
      purchaseReceiptRepo: invalidHarness.purchaseReceiptRepo,
      inventoryService: invalidHarness.inventoryService,
      now: () => 1710000000000,
    });

    await expect(invalidService.recordPurchaseOrderReceipts('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 1 }],
    }, {
      idempotencyKey: 'idem-1',
    })).rejects.toBeInstanceOf(BadRequestError);
  });

  it('rejects receipt quantities greater than remaining receivable quantity', async () => {
    const constrainedItem = {
      id: 'poi-1',
      po_id: 'po-1',
      product_id: 'prod-1',
      variant_id: 'var-1',
      pre_order_id: 'o-1',
      quantity: 5,
      received_qty: 3,
      cancelled_qty: 1,
    };
    const customHarness = createDbHarness({
      poRow: { id: 'po-1', status: 'shipping' },
      purchaseOrderItemRow: constrainedItem,
    });
    const customService = new OrderProcurementDomainService(customHarness.db, {
      purchaseReceiptRepo: customHarness.purchaseReceiptRepo,
      inventoryService: customHarness.inventoryService,
      now: () => 1710000000000,
    });

    await expect(customService.recordPurchaseOrderReceipts('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 2 }],
    }, {
      idempotencyKey: 'idem-1',
    })).rejects.toBeInstanceOf(BadRequestError);
  });

  it('projects compatibility procurement_status as partially_arrived after partial receipts', async () => {
    await service.recordPurchaseOrderReceipts('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 3 }],
    }, {
      idempotencyKey: 'idem-1',
    });

    const orderUpdateStatement = harness.calls.batchedStatements.find((statement) => statement.sql.includes('UPDATE orders'));
    expect(orderUpdateStatement.params[0]).toBe('partially_arrived');
    expect(orderUpdateStatement.params[2]).toBe('o-1');
  });

  it('projects compatibility procurement_status as arrived after full receipts', async () => {
    const completeHarness = createDbHarness({
      orderLineAggregateRow: {
        ordered_qty: 5,
        procured_qty: 5,
        received_qty: 5,
        cancelled_qty: 0,
      },
    });
    const completeService = new OrderProcurementDomainService(completeHarness.db, {
      purchaseReceiptRepo: completeHarness.purchaseReceiptRepo,
      inventoryService: completeHarness.inventoryService,
      now: () => 1710000000000,
    });

    await completeService.recordPurchaseOrderReceipts('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 3 }],
    }, {
      idempotencyKey: 'idem-1',
    });

    const orderUpdateStatement = completeHarness.calls.batchedStatements.find((statement) => statement.sql.includes('UPDATE orders'));
    expect(orderUpdateStatement.params[0]).toBe('arrived');
    expect(orderUpdateStatement.params[2]).toBe('o-1');
  });

  it('updates only the resolved compatibility order line during receipt projection', async () => {
    await service.recordPurchaseOrderReceipts('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 3 }],
    }, {
      idempotencyKey: 'idem-1',
    });

    const orderLineUpdateStatement = harness.calls.batchedStatements.find((statement) => statement.sql.includes('UPDATE order_lines'));
    expect(orderLineUpdateStatement.sql).toContain('WHERE id = ? AND order_id = ?');
  });

  it('does not over-apply concurrent receipt increments', async () => {
    const concurrentHarness = createDbHarness({
      purchaseOrderItemUpdateResult: { meta: { changes: 0 } },
    });
    const concurrentService = new OrderProcurementDomainService(concurrentHarness.db, {
      purchaseReceiptRepo: concurrentHarness.purchaseReceiptRepo,
      inventoryService: concurrentHarness.inventoryService,
      now: () => 1710000000000,
    });

    await expect(concurrentService.recordPurchaseOrderReceipts('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 3 }],
    }, {
      idempotencyKey: 'idem-1',
    })).rejects.toBeInstanceOf(BadRequestError);

    expect(concurrentHarness.purchaseReceiptRepo.createInsertStatement).toHaveBeenCalled();
    expect(concurrentHarness.inventoryService.buildMutationStatements).toHaveBeenCalled();
  });

  it('fails without partial persistence when downstream write errors', async () => {
    const writeFailureHarness = createDbHarness({
      purchaseOrderItemUpdateError: new Error('write failed'),
    });
    const writeFailureService = new OrderProcurementDomainService(writeFailureHarness.db, {
      purchaseReceiptRepo: writeFailureHarness.purchaseReceiptRepo,
      inventoryService: writeFailureHarness.inventoryService,
      now: () => 1710000000000,
    });

    await expect(writeFailureService.recordPurchaseOrderReceipts('po-1', {
      items: [{ purchase_order_item_id: 'poi-1', received_qty: 3 }],
    }, {
      idempotencyKey: 'idem-1',
    })).rejects.toThrow('write failed');

    expect(writeFailureHarness.purchaseReceiptRepo.createInsertStatement).toHaveBeenCalled();
    expect(writeFailureHarness.inventoryService.buildMutationStatements).toHaveBeenCalled();
  });
});
