import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../../lib/hono/errors.js';
import { OrderLineFulfillmentService } from '../OrderLineFulfillmentService.js';

function createDbHarness({
  orderLineRow = {
    order_id: 'order-1',
    order_no: 'SO-1',
    salesperson_id: 'sales-1',
    order_status: 'shipping',
    line_id: 'line-1',
    product_id: 'prod-1',
    variant_id: 'var-1',
    ordered_qty: 8,
    procured_qty: 8,
    received_qty: 8,
    reserved_qty: 1,
    shipped_qty: 2,
    cancelled_qty: 0,
    display_status: 'ready',
  },
  inventoryBalanceRow = {
    variant_id: 'var-1',
    on_hand: 10,
    reserved: 1,
    available: 9,
  },
  returnedQuantityRow = {
    returned_qty: 0,
  },
  orderReturnSummaryRow = {
    shipped_qty: 2,
    returned_qty: 0,
  },
  activeAllocations = [],
} = {}) {
  const calls = {
    batchedStatements: [],
    inventoryMutations: [],
    allocationCreates: [],
    allocationReleases: [],
    outboxEvents: [],
    outboxConsumerMatrix: [],
  };

  const db = {
    prepare: vi.fn((sql) => {
      const statement = {
        sql,
        params: [],
        bind: vi.fn(function bindStatement(...params) {
          statement.params = params;
          return statement;
        }),
        first: vi.fn(async () => null),
        all: vi.fn(async () => ({ results: [] })),
        run: vi.fn(async () => ({ meta: { changes: 1 } })),
      };

      if (sql.includes('FROM orders o') && sql.includes('JOIN order_lines ol')) {
        statement.first = vi.fn(async () => orderLineRow);
      }

      if (sql.includes('FROM inventory_balances')) {
        statement.first = vi.fn(async () => inventoryBalanceRow);
      }

      if (sql.includes('FROM order_returns') && sql.includes('WHERE order_line_id = ?')) {
        statement.first = vi.fn(async () => returnedQuantityRow);
      }

      if (sql.includes('FROM order_lines ol') && sql.includes('LEFT JOIN (') && sql.includes('order_returns')) {
        statement.first = vi.fn(async () => orderReturnSummaryRow);
      }

      return statement;
    }),
    batch: vi.fn(async (statements = []) => {
      calls.batchedStatements.push(...statements);
      return statements.map(() => ({ meta: { changes: 1 } }));
    }),
  };

  const allocationRepo = {
    createInsertStatement: vi.fn((payload) => {
      calls.allocationCreates.push(payload);
      return db
        .prepare(
          'INSERT INTO order_line_allocations (id, order_line_id, variant_id, inventory_event_id, allocated_qty, released_qty, status, allocated_at, released_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          payload.id || 'alloc-insert-1',
          payload.order_line_id,
          payload.variant_id,
          payload.inventory_event_id || null,
          payload.allocated_qty,
          payload.released_qty || 0,
          payload.status || 'active',
          payload.allocated_at,
          payload.released_at || null,
          payload.created_at,
          payload.updated_at
        );
    }),
    listActiveByOrderLine: vi.fn(async () => activeAllocations),
    buildReleaseStatement: vi.fn((allocation, quantity, options = {}) => {
      calls.allocationReleases.push({
        allocationId: allocation.id,
        quantity,
        options,
      });
      return db
        .prepare(
          'UPDATE order_line_allocations SET released_qty = ?, released_at = ?, status = ?, updated_at = ? WHERE id = ?'
        )
        .bind(
          (allocation.released_qty || 0) + quantity,
          options.released_at || null,
          options.status || 'released',
          options.updated_at || options.released_at || null,
          allocation.id
        );
    }),
  };

  const inventoryService = {
    buildMutationStatements: vi.fn(async (payload) => {
      calls.inventoryMutations.push(payload);
      return {
        inventoryEventId: 'ship-event-1',
        statements: [
          db
            .prepare(
              'UPDATE product_variants SET stock_quantity = MAX(0, stock_quantity + ?), updated_at = ? WHERE id = ?'
            )
            .bind(payload.quantityDelta, 1710000000000, payload.variantId),
          db
            .prepare(
              'INSERT INTO inventory_balances (variant_id, on_hand, reserved, available, updated_at) VALUES (?, ?, 0, ?, ?) ON CONFLICT(variant_id) DO UPDATE SET on_hand = MAX(0, inventory_balances.on_hand + ?), available = MAX(0, MAX(0, inventory_balances.on_hand + ?) - inventory_balances.reserved), updated_at = excluded.updated_at'
            )
            .bind(
              payload.variantId,
              0,
              0,
              1710000000000,
              payload.quantityDelta,
              payload.quantityDelta
            ),
          db
            .prepare(
              'INSERT INTO inventory_ledger (id, variant_id, event_type, quantity_delta, reference_type, reference_id, occurred_at, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .bind(
              'ledger-ship-1',
              payload.variantId,
              payload.type,
              payload.quantityDelta,
              payload.referenceType,
              payload.referenceId,
              1710000000000,
              JSON.stringify(payload.metadata || {}),
              1710000000000
            ),
          db
            .prepare(
              'INSERT INTO inventory_events (id, variant_id, order_line_id, purchase_receipt_id, event_type, quantity_delta, source_type, source_id, metadata, occurred_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .bind(
              'ship-event-1',
              payload.variantId,
              payload.orderLineId,
              null,
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

  const domainOutboxRepo = {
    buildInsertStatements: vi.fn((events, resolveConsumers) => {
      calls.outboxEvents.push(...events);

      return events.flatMap((event, index) => {
        const consumers = resolveConsumers(event);
        calls.outboxConsumerMatrix.push({
          eventType: event.event_type,
          consumers: [...consumers],
        });

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
              consumers[0] || 'cache',
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

  return { db, calls, allocationRepo, inventoryService, domainOutboxRepo };
}

describe('OrderLineFulfillmentService', () => {
  let harness;
  let service;

  beforeEach(() => {
    vi.restoreAllMocks();
    harness = createDbHarness();
    service = new OrderLineFulfillmentService(harness.db, {
      allocationRepo: harness.allocationRepo,
      inventoryService: harness.inventoryService,
      domainOutboxRepo: harness.domainOutboxRepo,
      now: () => 1710000000000,
      uuid: vi.fn(() => crypto.randomUUID()),
    });
  });

  it('reserves line quantity against on-hand stock and records active allocations', async () => {
    harness = createDbHarness({
      orderLineRow: {
        order_id: 'order-1',
        order_no: 'SO-1',
        salesperson_id: 'sales-1',
        order_status: 'shipping',
        line_id: 'line-1',
        product_id: 'prod-1',
        variant_id: 'var-1',
        ordered_qty: 8,
        procured_qty: 8,
        received_qty: 8,
        reserved_qty: 1,
        shipped_qty: 2,
        cancelled_qty: 0,
        display_status: 'ready',
      },
      inventoryBalanceRow: {
        variant_id: 'var-1',
        on_hand: 8,
        reserved: 8,
        available: 0,
      },
    });
    service = new OrderLineFulfillmentService(harness.db, {
      allocationRepo: harness.allocationRepo,
      inventoryService: harness.inventoryService,
      domainOutboxRepo: harness.domainOutboxRepo,
      now: () => 1710000000000,
      uuid: vi.fn(() => crypto.randomUUID()),
    });

    const result = await service.reserveLine(
      'order-1',
      'line-1',
      { quantity: 4 },
      { actorName: 'Admin' }
    );

    expect(result).toEqual(
      expect.objectContaining({
        order_id: 'order-1',
        order_line_id: 'line-1',
        action: 'reserve',
        quantity: 4,
      })
    );
    expect(harness.allocationRepo.createInsertStatement).toHaveBeenCalledWith(
      expect.objectContaining({
        order_line_id: 'line-1',
        variant_id: 'var-1',
        allocated_qty: 4,
      })
    );
    const sqlBatch = harness.calls.batchedStatements.map((statement) => statement.sql).join('\n');
    expect(sqlBatch).toContain('UPDATE order_lines');
    expect(sqlBatch).not.toContain('INSERT INTO inventory_balances');
    expect(sqlBatch).not.toContain('INSERT INTO inventory_ledger');
    expect(sqlBatch).not.toContain('INSERT INTO inventory_events');
    expect(sqlBatch).toContain('INSERT INTO order_line_allocations');
    expect(sqlBatch).toContain('INSERT INTO domain_outbox');
    expect(harness.calls.outboxConsumerMatrix).toEqual([
      {
        eventType: 'order_line_fulfillment_updated',
        consumers: ['cache'],
      },
    ]);
  });

  it('releases only the reserved portion and marks allocation rows released', async () => {
    harness = createDbHarness({
      orderLineRow: {
        order_id: 'order-1',
        order_no: 'SO-1',
        salesperson_id: 'sales-1',
        order_status: 'shipping',
        line_id: 'line-1',
        product_id: 'prod-1',
        variant_id: 'var-1',
        ordered_qty: 8,
        procured_qty: 8,
        received_qty: 8,
        reserved_qty: 5,
        shipped_qty: 1,
        cancelled_qty: 0,
        display_status: 'ready',
      },
      inventoryBalanceRow: {
        variant_id: 'var-1',
        on_hand: 10,
        reserved: 5,
        available: 5,
      },
      activeAllocations: [
        { id: 'alloc-1', allocated_qty: 3, released_qty: 0, status: 'active' },
        { id: 'alloc-2', allocated_qty: 4, released_qty: 2, status: 'active' },
      ],
    });
    service = new OrderLineFulfillmentService(harness.db, {
      allocationRepo: harness.allocationRepo,
      inventoryService: harness.inventoryService,
      domainOutboxRepo: harness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    const result = await service.releaseLine(
      'order-1',
      'line-1',
      { quantity: 4 },
      { actorName: 'Admin' }
    );

    expect(result).toEqual(
      expect.objectContaining({
        action: 'release',
        quantity: 4,
      })
    );
    expect(harness.allocationRepo.listActiveByOrderLine).toHaveBeenCalledWith('line-1');
    expect(harness.calls.allocationReleases).toEqual([
      expect.objectContaining({ allocationId: 'alloc-1', quantity: 3 }),
      expect.objectContaining({ allocationId: 'alloc-2', quantity: 1 }),
    ]);
    expect(harness.calls.inventoryMutations).toEqual([]);
  });

  it('ships a line quantity, deducts stock, and emits one cache invalidation event through outbox', async () => {
    harness = createDbHarness({
      orderLineRow: {
        order_id: 'order-1',
        order_no: 'SO-1',
        salesperson_id: 'sales-1',
        order_status: 'shipping',
        line_id: 'line-1',
        product_id: 'prod-1',
        variant_id: 'var-1',
        ordered_qty: 8,
        procured_qty: 8,
        received_qty: 8,
        reserved_qty: 2,
        shipped_qty: 1,
        cancelled_qty: 0,
        display_status: 'ready',
      },
      inventoryBalanceRow: {
        variant_id: 'var-1',
        on_hand: 8,
        reserved: 2,
        available: 6,
      },
      activeAllocations: [{ id: 'alloc-1', allocated_qty: 2, released_qty: 0, status: 'active' }],
    });
    service = new OrderLineFulfillmentService(harness.db, {
      allocationRepo: harness.allocationRepo,
      inventoryService: harness.inventoryService,
      domainOutboxRepo: harness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    const result = await service.shipLine(
      'order-1',
      'line-1',
      { quantity: 3 },
      { actorName: 'Admin' }
    );

    expect(result).toEqual(
      expect.objectContaining({
        action: 'ship',
        quantity: 3,
      })
    );
    expect(harness.inventoryService.buildMutationStatements).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'order_shipment',
        variantId: 'var-1',
        quantityDelta: -3,
        orderId: 'order-1',
        orderLineId: 'line-1',
      })
    );
    expect(harness.calls.batchedStatements.some((statement) =>
      statement.sql.includes('INSERT INTO order_shipments')
        && statement.params.includes('shipped')
        && statement.params.includes(3)
        && statement.params.includes('Admin')
    )).toBe(true);
    expect(harness.calls.outboxEvents).toHaveLength(1);
    expect(harness.calls.outboxEvents[0].event_type).toBe('order_line_fulfillment_updated');
    expect(harness.calls.outboxConsumerMatrix[0].consumers).toEqual(['cache']);
  });

  it('ships a line and releases demand-held inventory even without explicit line reservations', async () => {
    harness = createDbHarness({
      orderLineRow: {
        order_id: 'order-1',
        order_no: 'SO-1',
        salesperson_id: 'sales-1',
        order_status: 'shipping',
        line_id: 'line-1',
        product_id: 'prod-1',
        variant_id: 'var-1',
        ordered_qty: 5,
        procured_qty: 5,
        received_qty: 5,
        reserved_qty: 0,
        shipped_qty: 0,
        cancelled_qty: 0,
        display_status: 'ready',
      },
      inventoryBalanceRow: {
        variant_id: 'var-1',
        on_hand: 5,
        reserved: 5,
        available: 0,
      },
      activeAllocations: [],
    });
    service = new OrderLineFulfillmentService(harness.db, {
      allocationRepo: harness.allocationRepo,
      inventoryService: harness.inventoryService,
      domainOutboxRepo: harness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    const result = await service.shipLine(
      'order-1',
      'line-1',
      { quantity: 2 },
      { actorName: 'Admin' }
    );

    expect(result).toEqual(
      expect.objectContaining({
        action: 'ship',
        quantity: 2,
      })
    );
    const sqlBatch = harness.calls.batchedStatements.map((statement) => statement.sql).join('\n');
    expect(sqlBatch).toContain('INSERT INTO inventory_balances');
    expect(sqlBatch).toContain('INSERT INTO inventory_ledger');
    expect(sqlBatch).toContain('INSERT INTO inventory_events');
    expect(harness.calls.allocationReleases).toEqual([]);
    expect(harness.inventoryService.buildMutationStatements).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'order_shipment',
        quantityDelta: -2,
      })
    );
  });

  it('unships a previously shipped line quantity, restores stock, and recomputes line state', async () => {
    harness = createDbHarness({
      orderLineRow: {
        order_id: 'order-1',
        order_no: 'SO-1',
        salesperson_id: 'sales-1',
        order_status: 'shipping',
        line_id: 'line-1',
        product_id: 'prod-1',
        variant_id: 'var-1',
        ordered_qty: 8,
        procured_qty: 8,
        received_qty: 8,
        reserved_qty: 0,
        shipped_qty: 5,
        cancelled_qty: 0,
        display_status: 'partially_shipped',
      },
      inventoryBalanceRow: {
        variant_id: 'var-1',
        on_hand: 5,
        reserved: 0,
        available: 5,
      },
    });
    service = new OrderLineFulfillmentService(harness.db, {
      allocationRepo: harness.allocationRepo,
      inventoryService: harness.inventoryService,
      domainOutboxRepo: harness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    const result = await service.unshipLine(
      'order-1',
      'line-1',
      { quantity: 2 },
      { actorName: 'Admin' }
    );

    expect(result).toEqual(
      expect.objectContaining({
        action: 'unship',
        quantity: 2,
      })
    );
    expect(harness.inventoryService.buildMutationStatements).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'order_unshipment',
        variantId: 'var-1',
        quantityDelta: 2,
        orderId: 'order-1',
        orderLineId: 'line-1',
      })
    );
    expect(harness.calls.batchedStatements.some((statement) =>
      statement.sql.includes('INSERT INTO order_shipments')
        && statement.params.includes('unshipped')
        && statement.params.includes(2)
        && statement.params.includes('Admin')
    )).toBe(true);
    expect(harness.calls.outboxEvents).toHaveLength(1);
    expect(harness.calls.outboxEvents[0].event_type).toBe('order_line_fulfillment_updated');
  });

  it('rejects unshipping when the parent order is already delivered', async () => {
    harness = createDbHarness({
      orderLineRow: {
        order_id: 'order-1',
        order_no: 'SO-1',
        salesperson_id: 'sales-1',
        order_status: 'delivered',
        line_id: 'line-1',
        product_id: 'prod-1',
        variant_id: 'var-1',
        ordered_qty: 2,
        procured_qty: 2,
        received_qty: 2,
        reserved_qty: 0,
        shipped_qty: 2,
        cancelled_qty: 0,
        display_status: 'completed',
      },
    });
    service = new OrderLineFulfillmentService(harness.db, {
      allocationRepo: harness.allocationRepo,
      inventoryService: harness.inventoryService,
      domainOutboxRepo: harness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    await expect(
      service.unshipLine('order-1', 'line-1', { quantity: 1 }, { actorName: 'Admin' })
    ).rejects.toThrow(/delivered order/i);

    expect(harness.calls.inventoryMutations).toHaveLength(0);
    expect(harness.db.batch).not.toHaveBeenCalled();
  });

  it('also rejects unshipping when legacy delivered input was normalized to fulfilled in storage', async () => {
    harness = createDbHarness({
      orderLineRow: {
        order_id: 'order-1',
        order_no: 'SO-1',
        salesperson_id: 'sales-1',
        order_status: 'fulfilled',
        delivery_status: 'delivered',
        line_id: 'line-1',
        product_id: 'prod-1',
        variant_id: 'var-1',
        ordered_qty: 2,
        procured_qty: 2,
        received_qty: 2,
        reserved_qty: 0,
        shipped_qty: 2,
        cancelled_qty: 0,
        display_status: 'completed',
      },
    });
    service = new OrderLineFulfillmentService(harness.db, {
      allocationRepo: harness.allocationRepo,
      inventoryService: harness.inventoryService,
      domainOutboxRepo: harness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    await expect(
      service.unshipLine('order-1', 'line-1', { quantity: 1 }, { actorName: 'Admin' })
    ).rejects.toThrow(/delivered order/i);

    expect(harness.calls.inventoryMutations).toHaveLength(0);
    expect(harness.db.batch).not.toHaveBeenCalled();
  });

  it('returns delivered line quantity into stock, records structured reason metadata, and marks partially returned orders correctly', async () => {
    harness = createDbHarness({
      orderLineRow: {
        order_id: 'order-1',
        order_no: 'SO-1',
        salesperson_id: 'sales-1',
        order_status: 'fulfilled',
        delivery_status: 'delivered',
        line_id: 'line-1',
        product_id: 'prod-1',
        variant_id: 'var-1',
        ordered_qty: 2,
        procured_qty: 2,
        received_qty: 2,
        reserved_qty: 0,
        shipped_qty: 2,
        cancelled_qty: 0,
        display_status: 'completed',
      },
      inventoryBalanceRow: {
        variant_id: 'var-1',
        on_hand: 0,
        reserved: 0,
        available: 0,
      },
      returnedQuantityRow: {
        returned_qty: 0,
      },
      orderReturnSummaryRow: {
        shipped_qty: 2,
        returned_qty: 0,
      },
    });
    service = new OrderLineFulfillmentService(harness.db, {
      allocationRepo: harness.allocationRepo,
      inventoryService: harness.inventoryService,
      domainOutboxRepo: harness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    const result = await service.returnLine(
      'order-1',
      'line-1',
      { quantity: 1, reason: 'damage', note: 'box crushed on arrival' },
      { actorName: 'Admin' }
    );

    expect(result).toEqual(
      expect.objectContaining({
        action: 'return',
        quantity: 1,
      })
    );
    expect(harness.inventoryService.buildMutationStatements).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'order_return_restock',
        variantId: 'var-1',
        quantityDelta: 1,
        orderId: 'order-1',
        orderLineId: 'line-1',
      })
    );
    expect(harness.calls.batchedStatements.some((statement) =>
      statement.sql.includes('UPDATE orders SET delivery_status = ?')
        && statement.params[0] === 'partially_returned'
    )).toBe(true);
    expect(harness.calls.batchedStatements.some((statement) =>
      statement.sql.includes('INSERT INTO order_returns')
        && statement.params.includes('damage')
        && statement.params.includes('box crushed on arrival')
    )).toBe(true);
  });

  it('rejects returns before delivery is confirmed', async () => {
    await expect(
      service.returnLine(
        'order-1',
        'line-1',
        { quantity: 1, reason: 'damage' },
        { actorName: 'Admin' }
      )
    ).rejects.toThrow(/delivery-confirmed order/i);
  });

  it('marks fully returned orders as returned after the last shipped quantity is restocked', async () => {
    harness = createDbHarness({
      orderLineRow: {
        order_id: 'order-1',
        order_no: 'SO-1',
        salesperson_id: 'sales-1',
        order_status: 'fulfilled',
        delivery_status: 'partially_returned',
        line_id: 'line-1',
        product_id: 'prod-1',
        variant_id: 'var-1',
        ordered_qty: 2,
        procured_qty: 2,
        received_qty: 2,
        reserved_qty: 0,
        shipped_qty: 2,
        cancelled_qty: 0,
        display_status: 'completed',
      },
      returnedQuantityRow: {
        returned_qty: 1,
      },
      orderReturnSummaryRow: {
        shipped_qty: 2,
        returned_qty: 1,
      },
    });
    service = new OrderLineFulfillmentService(harness.db, {
      allocationRepo: harness.allocationRepo,
      inventoryService: harness.inventoryService,
      domainOutboxRepo: harness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    await service.returnLine(
      'order-1',
      'line-1',
      { quantity: 1, reason: 'wrong_item', note: 'second unit also returned' },
      { actorName: 'Admin' }
    );

    expect(harness.calls.batchedStatements.some((statement) =>
      statement.sql.includes('UPDATE orders SET delivery_status = ?')
        && statement.params[0] === 'returned'
    )).toBe(true);
  });

  it('rejects returns without a valid reason code', async () => {
    await expect(
      service.returnLine(
        'order-1',
        'line-1',
        { quantity: 1, reason: '' },
        { actorName: 'Admin' }
      )
    ).rejects.toThrow(/valid return reason/i);

    await expect(
      service.returnLine(
        'order-1',
        'line-1',
        { quantity: 1, reason: 'bad_code' },
        { actorName: 'Admin' }
      )
    ).rejects.toThrow(/valid return reason/i);
  });

  it('rejects line commands that exceed remaining, reserved, or available quantities', async () => {
    await expect(
      service.reserveLine('order-1', 'line-1', { quantity: 10 }, { actorName: 'Admin' })
    ).rejects.toBeInstanceOf(BadRequestError);

    harness = createDbHarness({
      orderLineRow: {
        order_id: 'order-1',
        order_no: 'SO-1',
        salesperson_id: 'sales-1',
        order_status: 'shipping',
        line_id: 'line-1',
        product_id: 'prod-1',
        variant_id: 'var-1',
        ordered_qty: 8,
        procured_qty: 8,
        received_qty: 8,
        reserved_qty: 2,
        shipped_qty: 1,
        cancelled_qty: 0,
        display_status: 'ready',
      },
      inventoryBalanceRow: {
        variant_id: 'var-1',
        on_hand: 8,
        reserved: 2,
        available: 6,
      },
      activeAllocations: [{ id: 'alloc-1', allocated_qty: 2, released_qty: 0, status: 'active' }],
    });
    service = new OrderLineFulfillmentService(harness.db, {
      allocationRepo: harness.allocationRepo,
      inventoryService: harness.inventoryService,
      domainOutboxRepo: harness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    await expect(
      service.releaseLine('order-1', 'line-1', { quantity: 3 }, { actorName: 'Admin' })
    ).rejects.toBeInstanceOf(BadRequestError);

    await expect(
      service.shipLine('order-1', 'line-1', { quantity: 8 }, { actorName: 'Admin' })
    ).rejects.toBeInstanceOf(BadRequestError);

    harness = createDbHarness();
    service = new OrderLineFulfillmentService(harness.db, {
      allocationRepo: harness.allocationRepo,
      inventoryService: harness.inventoryService,
      domainOutboxRepo: harness.domainOutboxRepo,
      now: () => 1710000000000,
    });

    await expect(
      service.unshipLine('order-1', 'line-1', { quantity: 3 }, { actorName: 'Admin' })
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});
