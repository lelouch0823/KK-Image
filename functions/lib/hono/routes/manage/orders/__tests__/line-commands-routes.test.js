import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  reserveLine: vi.fn(),
  releaseLine: vi.fn(),
  shipLine: vi.fn(),
  unshipLine: vi.fn(),
  returnLine: vi.fn(),
  orderFindById: vi.fn(),
  addTimelineEntry: vi.fn(),
  publish: vi.fn(async () => []),
  scheduleAuditEvent: vi.fn(),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
}));

vi.mock('../../../../../../services/OrderLineFulfillmentService/index.js', () => ({
  OrderLineFulfillmentService: vi.fn(() => ({
    reserveLine: mocks.reserveLine,
    releaseLine: mocks.releaseLine,
    shipLine: mocks.shipLine,
    unshipLine: mocks.unshipLine,
    returnLine: mocks.returnLine,
  })),
}));

vi.mock('../../../../../../repositories/OrderTimelineRepository.js', () => ({
  OrderTimelineRepository: vi.fn(() => ({
    addTimelineEntry: mocks.addTimelineEntry,
  })),
}));

vi.mock('../../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    findById: mocks.orderFindById,
  })),
}));

vi.mock('../../../../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: mocks.publish,
  })),
}));

vi.mock('../../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

// 行级命令现走命令幂等协议（reserve -> execute -> finalize）
vi.mock('../../../../../../repositories/CommandIdempotencyRepository.js', () => ({
  CommandIdempotencyRepository: vi.fn(() => ({
    reserveCommand: vi.fn(async () => ({
      existing: false,
      ownsReservation: true,
      record: { command_id: 'cmd-line-test' },
    })),
    buildFinalizeStatement: vi.fn(() => ({
      run: vi.fn(async () => ({ meta: { changes: 1 } })),
    })),
    buildDeleteStatement: vi.fn(() => ({
      run: vi.fn(async () => ({ meta: { changes: 1 } })),
    })),
  })),
}));

vi.mock('../../../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
}));

import lineRoutesApp from '../lines.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.use('/api/manage/orders/*', async (c, next) => {
    c.set('user', { id: 'admin-1', name: 'Admin' });
    await next();
  });
  app.route('/api/manage/orders', lineRoutesApp);
  return app;
}

describe('manage order line command routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reserveLine.mockResolvedValue({
      order_id: 'order-1',
      order_line_id: 'line-1',
      action: 'reserve',
      quantity: 2,
    });
    mocks.releaseLine.mockResolvedValue({
      order_id: 'order-1',
      order_line_id: 'line-1',
      action: 'release',
      quantity: 1,
    });
    mocks.shipLine.mockResolvedValue({
      order_id: 'order-1',
      order_line_id: 'line-1',
      action: 'ship',
      quantity: 1,
    });
    mocks.unshipLine.mockResolvedValue({
      order_id: 'order-1',
      order_line_id: 'line-1',
      action: 'unship',
      quantity: 1,
    });
    mocks.returnLine.mockResolvedValue({
      order_id: 'order-1',
      order_line_id: 'line-1',
      action: 'return',
      quantity: 1,
    });
    mocks.orderFindById.mockResolvedValue({
      id: 'order-1',
      orderNo: 'SO-1',
      salespersonId: 'sales-1',
    });
  });

  it('routes reserve, release, ship, unship, and return commands through the fulfillment service and schedules outbox polling', async () => {
    const app = createApp();
    const waitUntil = vi.fn();

    const reserveRes = await app.request(
      'http://localhost/api/manage/orders/order-1/lines/line-1/reserve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 2 }),
      },
      { DB: {} },
      { waitUntil }
    );
    const releaseRes = await app.request(
      'http://localhost/api/manage/orders/order-1/lines/line-1/release',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1 }),
      },
      { DB: {} },
      { waitUntil }
    );
    const shipRes = await app.request(
      'http://localhost/api/manage/orders/order-1/lines/line-1/ship',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1 }),
      },
      { DB: {} },
      { waitUntil }
    );
    const unshipRes = await app.request(
      'http://localhost/api/manage/orders/order-1/lines/line-1/unship',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1 }),
      },
      { DB: {} },
      { waitUntil }
    );
    const returnRes = await app.request(
      'http://localhost/api/manage/orders/order-1/lines/line-1/return',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1, reason: 'damage', note: 'box crushed' }),
      },
      { DB: {} },
      { waitUntil }
    );

    expect(reserveRes.status).toBe(200);
    expect(releaseRes.status).toBe(200);
    expect(shipRes.status).toBe(200);
    expect(unshipRes.status).toBe(200);
    expect(returnRes.status).toBe(200);
    expect(mocks.reserveLine).toHaveBeenCalledWith(
      'order-1',
      'line-1',
      { quantity: 2 },
      expect.any(Object)
    );
    expect(mocks.releaseLine).toHaveBeenCalledWith(
      'order-1',
      'line-1',
      { quantity: 1 },
      expect.any(Object)
    );
    expect(mocks.shipLine).toHaveBeenCalledWith(
      'order-1',
      'line-1',
      { quantity: 1 },
      expect.any(Object)
    );
    expect(mocks.unshipLine).toHaveBeenCalledWith(
      'order-1',
      'line-1',
      { quantity: 1 },
      expect.any(Object)
    );
    expect(mocks.returnLine).toHaveBeenCalledWith(
      'order-1',
      'line-1',
      { quantity: 1, reason: 'damage', note: 'box crushed' },
      expect.any(Object)
    );
    expect(mocks.addTimelineEntry).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        actionType: 'comment',
        comment: '订单行 line-1 出货 1 件',
      })
    );
    expect(mocks.addTimelineEntry).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        actionType: 'comment',
        comment: '订单行 line-1 撤销出货 1 件',
      })
    );
    expect(mocks.addTimelineEntry).toHaveBeenCalledWith(
      'order-1',
      expect.objectContaining({
        actionType: 'comment',
        comment: '订单行 line-1 退回 1 件，原因：damage，备注：box crushed',
      })
    );
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'order_return_created',
        aggregate_type: 'order',
        aggregate_id: 'order-1',
        payload: expect.objectContaining({
          order_id: 'order-1',
          order_no: 'SO-1',
          order_line_id: 'line-1',
          salesperson_id: 'sales-1',
          quantity: 1,
          reason: 'damage',
        }),
      }),
      expect.objectContaining({
        event_type: 'order_return_restocked',
        aggregate_type: 'order',
        aggregate_id: 'order-1',
        payload: expect.objectContaining({
          order_id: 'order-1',
          order_no: 'SO-1',
          order_line_id: 'line-1',
          salesperson_id: 'sales-1',
          quantity: 1,
          reason: 'damage',
        }),
      }),
    ]);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(5);
    expect(waitUntil).toHaveBeenCalledTimes(5);
  });

  it('rejects missing positive quantity payloads for line commands', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/lines/line-1/reserve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 0 }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.reserveLine).not.toHaveBeenCalled();
  });

  it('returns typed 400 for malformed JSON line commands without side effects', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/lines/line-1/reserve',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{ bad',
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        error: expect.stringMatching(/invalid json/i),
      })
    );
    expect(mocks.orderFindById).not.toHaveBeenCalled();
    expect(mocks.reserveLine).not.toHaveBeenCalled();
    expect(mocks.addTimelineEntry).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('rejects line commands on archived orders before fulfillment side effects', async () => {
    mocks.orderFindById.mockResolvedValueOnce({
      id: 'order-1',
      orderNo: 'SO-1',
      salespersonId: 'sales-1',
      archivedAt: 1710000000000,
    });
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/orders/order-1/lines/line-1/ship',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1 }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.shipLine).not.toHaveBeenCalled();
    expect(mocks.addTimelineEntry).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('replays the stored ship response for a retried Idempotency-Key without re-executing the command', async () => {
    // 回归：此前行级命令无幂等保护，网络超时重发同一 ship 请求会二次扣减库存
    const storedResponse = {
      order_id: 'order-1',
      order_line_id: 'line-1',
      action: 'ship',
      quantity: 1,
    };
    let reserveCallCount = 0;
    const { CommandIdempotencyRepository } = await import(
      '../../../../../../repositories/CommandIdempotencyRepository.js'
    );
    CommandIdempotencyRepository.mockImplementation(() => ({
      reserveCommand: vi.fn(async (_commandType, _scopeKey, idempotencyKey, fingerprint) => {
        reserveCallCount += 1;
        if (reserveCallCount === 1) {
          return { existing: false, ownsReservation: true, record: { command_id: 'cmd-line-1' } };
        }
        // 第二次请求：同一幂等键的命令已提交，返回已存储的响应
        return {
          existing: true,
          ownsReservation: false,
          record: {
            command_id: 'cmd-line-1',
            idempotency_key: idempotencyKey,
            request_fingerprint: fingerprint,
            response_json: JSON.stringify(storedResponse),
            status: 'committed',
          },
        };
      }),
      buildFinalizeStatement: vi.fn(() => ({
        run: vi.fn(async () => ({ meta: { changes: 1 } })),
      })),
      buildDeleteStatement: vi.fn(() => ({
        run: vi.fn(async () => ({ meta: { changes: 1 } })),
      })),
    }));

    const app = createApp();
    const request = () =>
      app.request(
        'http://localhost/api/manage/orders/order-1/lines/line-1/ship',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'ship-key-1' },
          body: JSON.stringify({ quantity: 1 }),
        },
        { DB: {} },
        { waitUntil: vi.fn() }
      );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.clone().json());
    // 关键断言：发货命令只执行一次
    expect(mocks.shipLine).toHaveBeenCalledTimes(1);
  });
});
