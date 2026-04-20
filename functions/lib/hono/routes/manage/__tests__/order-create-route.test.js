import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  orderCreate: vi.fn(),
  commandReserve: vi.fn(),
  commandBuildDeleteStatement: vi.fn(),
  commandDeleteRun: vi.fn(async () => ({ meta: { changes: 1 } })),
  commandBuildFinalizeStatement: vi.fn(),
  commandFinalizeRun: vi.fn(async () => ({ meta: { changes: 1 } })),
  validateProductVariantBinding: vi.fn(),
  getSalespersonAccessTokens: vi.fn(),
  invalidateCache: vi.fn(async () => {}),
  ensureOrderFolder: vi.fn(),
  moveFilesToFolder: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
  randomUUID: vi.fn(),
}));

vi.mock('../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    create: mocks.orderCreate,
  })),
}));

vi.mock('../../../../../repositories/CommandIdempotencyRepository.js', () => ({
  CommandIdempotencyRepository: vi.fn(() => ({
    reserveCommand: mocks.commandReserve,
    buildDeleteStatement: mocks.commandBuildDeleteStatement,
    buildFinalizeStatement: mocks.commandBuildFinalizeStatement,
  })),
}));

vi.mock('../../../../../api/utils/validation.js', () => ({
  validateProductVariantBinding: mocks.validateProductVariantBinding,
}));

vi.mock('../../../_shared/route-helpers.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getSalespersonAccessTokens: mocks.getSalespersonAccessTokens,
  };
});

vi.mock('../../../middleware/cache.js', () => ({
  invalidateCache: mocks.invalidateCache,
}));

vi.mock('../../_shared/cache-urls.js', () => ({
  getOrderAndSalespersonCacheUrls: vi.fn(() => []),
  getOrderNotificationCacheUrls: vi.fn(() => []),
}));

vi.mock('../../../../../api/utils/folder-utils.js', () => ({
  ensureOrderFolder: mocks.ensureOrderFolder,
  moveFilesToFolder: mocks.moveFilesToFolder,
}));

vi.mock('../../../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: mocks.publish,
  })),
}));

vi.mock('../../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
}));

import createAppRoutes from '../orders/create.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.use('/api/manage/orders/*', async (c, next) => {
    c.set('user', { id: 'admin-1', name: 'Admin' });
    await next();
  });
  app.route('/api/manage/orders', createAppRoutes);
  return app;
}

describe('manage order create route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => mocks.randomUUID());
    mocks.randomUUID.mockReturnValue('generated-order-idempotency-key');
    mocks.orderCreate.mockResolvedValue({ id: 'order-1', orderNo: 'SO-1001' });
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
    mocks.validateProductVariantBinding.mockResolvedValue({ normalizedVariantId: null });
    mocks.getSalespersonAccessTokens.mockResolvedValue([]);
    mocks.ensureOrderFolder.mockResolvedValue('folder-order-1');
    mocks.moveFilesToFolder.mockResolvedValue(undefined);
  });

  it('archives uploaded files into order folder after creating order', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: 'Sample Product',
          salespersonId: 'sales-1',
          quantity: 1,
          fileIds: ['file-1', 'file-2'],
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.ensureOrderFolder).toHaveBeenCalledTimes(1);
    expect(mocks.ensureOrderFolder).toHaveBeenCalledWith(expect.anything(), expect.any(String));
    expect(mocks.moveFilesToFolder).toHaveBeenCalledWith(
      expect.anything(),
      ['file-1', 'file-2'],
      'folder-order-1'
    );
  });

  it('normalizes multi-line admin create payloads before calling repository create', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salespersonId: 'sales-1',
          fileIds: ['file-1'],
          lines: [
            { productName: 'Line A', quantity: 2, sku: 'SKU-A' },
            { productName: 'Line B', quantity: 3, sku: 'SKU-B' },
          ],
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 5,
        data: expect.objectContaining({
          name: 'Line A',
          sku: 'SKU-A',
        }),
        lines: [
          expect.objectContaining({ name: 'Line A', sku: 'SKU-A', quantity: 2 }),
          expect.objectContaining({ name: 'Line B', sku: 'SKU-B', quantity: 3 }),
        ],
      })
    );
  });

  it('forwards variant binding for ordinary single-line create payloads without explicit lines', async () => {
    mocks.validateProductVariantBinding.mockResolvedValueOnce({
      normalizedVariantId: 'v-1',
      product: {
        id: 'p-1',
        name: 'Bound Product',
        brand: 'KK',
        category: 'Workflow',
        series: 'S1',
      },
      variant: {
        id: 'v-1',
        sku: 'SKU-V1',
        size: 'L',
        color: 'Black',
        material: 'Cotton',
      },
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: 'Bound Product',
          salespersonId: 'sales-1',
          productId: 'p-1',
          variantId: 'v-1',
          quantity: 2,
          fileIds: [],
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.orderCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'p-1',
        variantId: 'v-1',
        quantity: 2,
      })
    );
  });

  it('validates every bound line in a multi-line create payload before persisting order lines', async () => {
    mocks.validateProductVariantBinding
      .mockResolvedValueOnce({
        normalizedVariantId: 'v-1',
        product: { id: 'p-1', name: 'Line A', brand: 'KK', category: 'Workflow', series: 'S1' },
        variant: { id: 'v-1', sku: 'SKU-A', size: 'L', color: 'Black', material: 'Cotton' },
      })
      .mockRejectedValueOnce(Object.assign(new Error('variant must be active'), { statusCode: 400 }));

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salespersonId: 'sales-1',
          fileIds: [],
          lines: [
            { productName: 'Line A', quantity: 1, productId: 'p-1', variantId: 'v-1' },
            { productName: 'Line B', quantity: 1, productId: 'p-2', variantId: 'v-2' },
          ],
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.validateProductVariantBinding).toHaveBeenCalledTimes(2);
    expect(mocks.validateProductVariantBinding).toHaveBeenNthCalledWith(
      1,
      {},
      'p-1',
      'v-1',
      { checkActive: true }
    );
    expect(mocks.validateProductVariantBinding).toHaveBeenNthCalledWith(
      2,
      {},
      'p-2',
      'v-2',
      { checkActive: true }
    );
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it('enqueues order-created side effects through outbox instead of inline notifications', async () => {
    const waitUntil = vi.fn();
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: 'Sample Product',
          salespersonId: 'sales-1',
          quantity: 1,
        }),
      },
      { DB: {} },
      { waitUntil }
    );

    expect(res.status).toBe(201);
    expect(mocks.publish).toHaveBeenCalledWith([
      expect.objectContaining({
        event_type: 'order_created_by_admin',
        aggregate_type: 'order',
        aggregate_id: 'order-1',
        payload: expect.objectContaining({
          order_id: 'order-1',
          order_no: 'SO-1001',
          salesperson_id: 'sales-1',
        }),
      }),
    ], expect.objectContaining({
      commandId: 'cmd-order-1',
      correlationId: 'cmd-order-1',
    }));
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
  });

  it('returns 400 when required order fields are missing', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salespersonId: 'sales-1',
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it('returns 400 when order status is invalid', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: 'Sample Product',
          salespersonId: 'sales-1',
          status: 'invalid-status',
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.orderCreate).not.toHaveBeenCalled();
  });

  it('rejects create order when bound product is archived', async () => {
    const error = new Error('product must be active');
    error.statusCode = 400;
    mocks.validateProductVariantBinding.mockRejectedValueOnce(error);

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: 'Sample Product',
          salespersonId: 'sales-1',
          productId: 'p-1',
          variantId: 'v-1',
          quantity: 1,
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.orderCreate).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('rejects create order when bound variant is archived', async () => {
    const error = new Error('variant must be active');
    error.statusCode = 400;
    mocks.validateProductVariantBinding.mockRejectedValueOnce(error);

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: 'Sample Product',
          salespersonId: 'sales-1',
          productId: 'p-1',
          variantId: 'v-1',
          quantity: 1,
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(mocks.orderCreate).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('continues order creation when file archiving fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.ensureOrderFolder.mockRejectedValueOnce(new Error('folder unavailable'));

    try {
      const app = createApp();
      const res = await app.request(
        'http://localhost/api/manage/orders',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productName: 'Sample Product',
            salespersonId: 'sales-1',
            quantity: 1,
            fileIds: ['file-1'],
          }),
        },
        { DB: {} },
        { waitUntil: vi.fn() }
      );

      expect(res.status).toBe(201);
      expect(mocks.orderCreate).toHaveBeenCalledTimes(1);
      expect(mocks.publish).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('swallows duplicate outbox idempotency errors during create-side effect publish', async () => {
    mocks.publish.mockRejectedValueOnce(
      new Error('UNIQUE CONSTRAINT FAILED: domain_outbox.idempotency_key')
    );

    const app = createApp();
    const waitUntil = vi.fn();
    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: 'Sample Product',
          salespersonId: 'sales-1',
          quantity: 1,
        }),
      },
      { DB: {} },
      { waitUntil }
    );

    expect(res.status).toBe(201);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.runOutboxPoller).toHaveBeenCalledTimes(1);
    expect(waitUntil).toHaveBeenCalled();
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
    mocks.publish
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
    expect(mocks.orderCreate).toHaveBeenCalledTimes(1);
    expect(mocks.publish).toHaveBeenCalledTimes(2);
  });

  it('retries finalize failures without generating duplicate order-created events', async () => {
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
    mocks.publish
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('D1_ERROR: UNIQUE constraint failed: domain_outbox.idempotency_key'));

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
    expect(mocks.orderCreate).toHaveBeenCalledTimes(1);
    expect(mocks.publish).toHaveBeenCalledTimes(2);
    expect(mocks.publish.mock.calls[0][1]).toEqual(expect.objectContaining({
      commandId: 'cmd-order-finalize-1',
      correlationId: 'cmd-order-finalize-1',
    }));
    expect(mocks.publish.mock.calls[1][1]).toEqual(expect.objectContaining({
      commandId: 'cmd-order-finalize-1',
      correlationId: 'cmd-order-finalize-1',
    }));
  });
});
