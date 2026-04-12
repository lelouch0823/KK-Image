import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  createManagedOrder: vi.fn(),
  publishOrderCreatedByAdmin: vi.fn(),
  repoBatchUpdateStatus: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
  commandReserve: vi.fn(),
  commandBuildDeleteStatement: vi.fn(),
  commandDeleteRun: vi.fn(async () => ({ meta: { changes: 1 } })),
  commandBuildFinalizeStatement: vi.fn(),
  commandFinalizeRun: vi.fn(async () => ({ meta: { changes: 1 } })),
  randomUUID: vi.fn(),
}));

vi.mock('../create-order.js', () => ({
  createManagedOrder: mocks.createManagedOrder,
  publishOrderCreatedByAdmin: mocks.publishOrderCreatedByAdmin,
}));

vi.mock('../../../../../../repositories/CommandIdempotencyRepository.js', () => ({
  CommandIdempotencyRepository: vi.fn(() => ({
    reserveCommand: mocks.commandReserve,
    buildDeleteStatement: mocks.commandBuildDeleteStatement,
    buildFinalizeStatement: mocks.commandBuildFinalizeStatement,
  })),
}));

vi.mock('../../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    batchUpdateStatus: mocks.repoBatchUpdateStatus,
  })),
}));

vi.mock('../authz-helpers.js', () => ({
  assertForceStatusTransitionAllowed: vi.fn(async () => {}),
}));

vi.mock('../../../../../../api/utils/order-state-machine.js', () => ({
  canTransitionOrderStatus: vi.fn(() => true),
}));

vi.mock('../error-helpers.js', () => ({
  isInsufficientStockError: vi.fn(() => false),
  isInvalidStatusTransitionError: vi.fn(() => false),
}));

vi.mock('../../../../_shared/utils.js', () => ({
  MSG: {
    COMMON: { INVALID_PARAMS: 'INVALID_PARAMS' },
    ORDER: {
      INVALID_STATUS: 'INVALID_STATUS',
      BATCH_RESULT: 'batch {valid}',
      ACTIONS: {
        confirmed: '确认',
        BATCH_PREFIX: '批量',
      },
    },
  },
  ORDER_STATUSES: ['pending', 'confirmed', 'rejected', 'void'],
}));

vi.mock('../../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

vi.mock('../../../../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: mocks.publish,
  })),
}));

vi.mock('../../../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
}));

import createRoutesApp from '../create.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.use('/api/manage/orders/*', async (c, next) => {
    c.set('user', { id: 'admin-1', name: 'Admin' });
    await next();
  });
  app.route('/api/manage/orders', createRoutesApp);
  return app;
}

describe('manage order create routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => mocks.randomUUID());
    mocks.randomUUID.mockReturnValue('generated-order-idempotency-key');
    mocks.createManagedOrder.mockResolvedValue({ id: 'order-1', orderNo: 'SO-1' });
    mocks.publishOrderCreatedByAdmin.mockResolvedValue([]);
    mocks.repoBatchUpdateStatus.mockResolvedValue(undefined);
    mocks.commandReserve.mockResolvedValue({
      existing: false,
      ownsReservation: true,
      record: { command_id: 'cmd-order-1' },
    });
    mocks.commandBuildDeleteStatement.mockReturnValue({
      run: mocks.commandDeleteRun,
    });
    mocks.commandBuildFinalizeStatement.mockReturnValue({
      run: mocks.commandFinalizeRun,
    });
  });

  it('audits managed order creation', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: 'A' }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'order.create',
        targetId: 'order-1',
        target_label: 'SO-1',
      })
    );
  });

  it('replays the original order create response for the same Idempotency-Key', async () => {
    const app = createApp();
    const storedResponses = new Map();

    mocks.commandBuildFinalizeStatement.mockImplementation((_commandId, responseJson) => ({
      run: vi.fn(async () => {
        storedResponses.set('order-key-1', responseJson);
        return { meta: { changes: 1 } };
      }),
    }));
    mocks.commandReserve.mockImplementation(async (_commandType, scopeKey, idempotencyKey, requestFingerprint) => {
      if (idempotencyKey === 'order-key-1' && storedResponses.has(idempotencyKey)) {
        return {
          existing: true,
          ownsReservation: false,
          record: {
            command_id: 'cmd-order-1',
            scope_key: scopeKey,
            idempotency_key: idempotencyKey,
            request_fingerprint: requestFingerprint,
            response_json: JSON.stringify(storedResponses.get(idempotencyKey)),
            status: 'committed',
          },
        };
      }

      return {
        existing: false,
        ownsReservation: true,
        record: {
          command_id: 'cmd-order-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });

    const request = () => app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'order-key-1',
        },
        body: JSON.stringify({
          productName: 'Sample Product',
          salespersonId: 'sales-1',
          quantity: 1,
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await second.json()).toEqual(await first.clone().json());
    expect(mocks.createManagedOrder).toHaveBeenCalledTimes(1);
    expect(mocks.publishOrderCreatedByAdmin).toHaveBeenCalledTimes(1);
  });

  it('rejects order create retries that reuse the same Idempotency-Key with a different payload', async () => {
    const app = createApp();
    mocks.commandReserve.mockResolvedValue({
      existing: true,
      ownsReservation: false,
      record: {
        command_id: 'cmd-order-2',
        scope_key: 'order_create:admin-1',
        idempotency_key: 'order-key-2',
        request_fingerprint: JSON.stringify({
          productName: 'Sample Product',
          quantity: 1,
          salespersonId: 'sales-1',
        }),
        response_json: null,
        status: 'in_flight',
      },
    });

    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'order-key-2',
        },
        body: JSON.stringify({
          productName: 'Sample Product',
          salespersonId: 'sales-1',
          quantity: 2,
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(expect.objectContaining({
      error: '同一个幂等键不能提交不同的订单创建请求',
    }));
    expect(mocks.createManagedOrder).not.toHaveBeenCalled();
  });

  it('retries order-create side effects without duplicating the order after an outbox failure', async () => {
    const app = createApp();
    const commandState = new Map();

    mocks.commandReserve.mockImplementation(async (_commandType, scopeKey, idempotencyKey, requestFingerprint) => {
      const existing = commandState.get(idempotencyKey);
      if (existing) {
        return {
          existing: true,
          ownsReservation: false,
          record: {
            command_id: existing.commandId,
            scope_key: scopeKey,
            idempotency_key: idempotencyKey,
            request_fingerprint: existing.requestFingerprint,
            response_json: existing.responseJson,
            status: existing.status,
          },
        };
      }

      return {
        existing: false,
        ownsReservation: true,
        record: {
          command_id: 'cmd-order-retry-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });
    mocks.commandBuildFinalizeStatement.mockImplementation((commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        commandState.set('order-key-retry-1', {
          commandId,
          requestFingerprint: commandState.get('order-key-retry-1')?.requestFingerprint || JSON.stringify({
            productName: 'Sample Product',
            quantity: 1,
            salespersonId: 'sales-1',
          }),
          responseJson: responseJson == null ? null : JSON.stringify(responseJson),
          status,
        });
        return { meta: { changes: 1 } };
      }),
    }));
    mocks.publishOrderCreatedByAdmin
      .mockRejectedValueOnce(new Error('publish failed'))
      .mockResolvedValueOnce([]);

    const request = () => app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'order-key-retry-1',
        },
        body: JSON.stringify({
          productName: 'Sample Product',
          salespersonId: 'sales-1',
          quantity: 1,
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(201);
    expect(mocks.createManagedOrder).toHaveBeenCalledTimes(1);
    expect(mocks.publishOrderCreatedByAdmin).toHaveBeenCalledTimes(2);
    expect(mocks.commandBuildFinalizeStatement).toHaveBeenCalledWith(
      'cmd-order-retry-1',
      expect.objectContaining({ id: 'order-1' }),
      'failed'
    );
  });

  it('retries order-create finalize failures without generating duplicate create events', async () => {
    const app = createApp();
    const commandState = new Map();
    let committedFinalizeAttempts = 0;

    mocks.commandReserve.mockImplementation(async (_commandType, scopeKey, idempotencyKey, requestFingerprint) => {
      const existing = commandState.get(idempotencyKey);
      if (existing) {
        return {
          existing: true,
          ownsReservation: false,
          record: {
            command_id: existing.commandId,
            scope_key: scopeKey,
            idempotency_key: idempotencyKey,
            request_fingerprint: existing.requestFingerprint,
            response_json: existing.responseJson,
            status: existing.status,
          },
        };
      }

      return {
        existing: false,
        ownsReservation: true,
        record: {
          command_id: 'cmd-order-finalize-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });
    mocks.commandBuildFinalizeStatement.mockImplementation((commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        if (status === 'committed') {
          committedFinalizeAttempts += 1;
          if (committedFinalizeAttempts === 1) {
            throw new Error('finalize committed failed');
          }
        }
        commandState.set('order-key-finalize-1', {
          commandId,
          requestFingerprint: JSON.stringify({
            productName: 'Sample Product',
            quantity: 1,
            salespersonId: 'sales-1',
          }),
          responseJson: responseJson == null ? null : JSON.stringify(responseJson),
          status,
        });
        return { meta: { changes: 1 } };
      }),
    }));
    mocks.publishOrderCreatedByAdmin
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const request = () => app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'order-key-finalize-1',
        },
        body: JSON.stringify({
          productName: 'Sample Product',
          salespersonId: 'sales-1',
          quantity: 1,
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(201);
    expect(mocks.createManagedOrder).toHaveBeenCalledTimes(1);
    expect(mocks.publishOrderCreatedByAdmin).toHaveBeenCalledTimes(2);
    expect(mocks.publishOrderCreatedByAdmin.mock.calls[0][1]).toEqual(expect.objectContaining({
      commandId: 'cmd-order-finalize-1',
      correlationId: 'cmd-order-finalize-1',
    }));
    expect(mocks.publishOrderCreatedByAdmin.mock.calls[1][1]).toEqual(expect.objectContaining({
      commandId: 'cmd-order-finalize-1',
      correlationId: 'cmd-order-finalize-1',
    }));
  });

  it('audits batch order status updates', async () => {
    const waitUntil = vi.fn();
    const app = createApp();
    const db = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({ results: [{ id: 'order-1', order_no: 'SO-1', salesperson_id: null, status: 'pending' }] })),
        })),
      })),
    };

    const res = await app.request(
      'http://localhost/api/manage/orders/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['order-1'], action: 'status', value: 'confirmed' }),
      },
      { DB: db },
      { waitUntil }
    );

    expect(res.status).toBe(200);
    expect(mocks.repoBatchUpdateStatus).toHaveBeenCalledWith(
      ['order-1'],
      'confirmed',
      expect.anything(),
      { forceStatusTransition: false }
    );
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'order_status_changed_by_admin',
        aggregate_id: 'order-1',
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'order.batch_update',
        metadata: expect.objectContaining({ count: 1, status: 'confirmed' }),
      })
    );
  });
});
