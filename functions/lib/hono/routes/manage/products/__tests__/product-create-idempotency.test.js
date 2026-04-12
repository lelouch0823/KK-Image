import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  createManagedProduct: vi.fn(),
  commandReserve: vi.fn(),
  commandBuildDeleteStatement: vi.fn(),
  commandDeleteRun: vi.fn(async () => ({ meta: { changes: 1 } })),
  commandBuildFinalizeStatement: vi.fn(),
  commandFinalizeRun: vi.fn(async () => ({ meta: { changes: 1 } })),
  scheduleProductCacheInvalidation: vi.fn(async () => []),
  scheduleAuditEvent: vi.fn(),
  randomUUID: vi.fn(),
}));

vi.mock('../../../../../../repositories/ProductRepository.js', () => ({
  ProductRepository: class {
    search() {
      return Promise.resolve({ items: [], total: 0, page: 1, limit: 20, filters: { brands: [], categories: [] } });
    }
  },
}));

vi.mock('../../../../../../repositories/CommandIdempotencyRepository.js', () => ({
  CommandIdempotencyRepository: vi.fn(() => ({
    reserveCommand: mocks.commandReserve,
    buildDeleteStatement: mocks.commandBuildDeleteStatement,
    buildFinalizeStatement: mocks.commandBuildFinalizeStatement,
  })),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => next(),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => next(),
}));

vi.mock('../../../_shared/route-helpers.js', () => ({
  parsePagination: () => ({ page: 1, limit: 20, offset: 0 }),
}));

vi.mock('../create-product.js', () => ({
  createManagedProduct: mocks.createManagedProduct,
}));

vi.mock('../cache-helpers.js', () => ({
  scheduleProductCacheInvalidation: mocks.scheduleProductCacheInvalidation,
}));

vi.mock('../../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

vi.mock('../batch.js', () => ({ default: new Hono() }));
vi.mock('../export.js', () => ({ default: new Hono() }));

import productsApp from '../index.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.use('/api/manage/products/*', async (c, next) => {
    c.set('user', { id: 'admin-1', role: 'admin', permissions: ['products:manage'] });
    await next();
  });
  app.route('/api/manage/products', productsApp);
  return app;
}

function normalizeProductCreateValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeProductCreateValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const normalized = normalizeProductCreateValue(value[key]);
        if (normalized !== undefined) {
          acc[key] = normalized;
        }
        return acc;
      }, {});
  }

  return value;
}

function buildProductCreateFingerprintForTest(body = {}) {
  return JSON.stringify(normalizeProductCreateValue(body));
}

describe('manage product create route idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => mocks.randomUUID());
    mocks.randomUUID.mockReturnValue('generated-product-idempotency-key');
    mocks.createManagedProduct.mockResolvedValue({
      id: 'prod-1',
      name: 'Catalog Tee',
      brand: 'KK',
    });
    mocks.commandReserve.mockResolvedValue({
      existing: false,
      ownsReservation: true,
      record: { command_id: 'cmd-product-1' },
    });
    mocks.commandBuildDeleteStatement.mockReturnValue({
      run: mocks.commandDeleteRun,
    });
    mocks.commandBuildFinalizeStatement.mockReturnValue({
      run: mocks.commandFinalizeRun,
    });
  });

  it('replays the original product create response for the same Idempotency-Key', async () => {
    const app = createApp();
    const storedResponses = new Map();

    mocks.commandBuildFinalizeStatement.mockImplementation((_commandId, responseJson) => ({
      run: vi.fn(async () => {
        storedResponses.set('product-key-1', responseJson);
        return { meta: { changes: 1 } };
      }),
    }));
    mocks.commandReserve.mockImplementation(async (_commandType, scopeKey, idempotencyKey, requestFingerprint) => {
      if (idempotencyKey === 'product-key-1' && storedResponses.has(idempotencyKey)) {
        return {
          existing: true,
          ownsReservation: false,
          record: {
            command_id: 'cmd-product-1',
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
          command_id: 'cmd-product-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });

    const request = () => app.request(
      'http://localhost/api/manage/products',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'product-key-1',
        },
        body: JSON.stringify({
          name: 'Catalog Tee',
          currency: 'USD',
          variants: [{ sku: 'SKU-1', price: 100, cost_price: 60, stock_quantity: 5 }],
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
    expect(mocks.createManagedProduct).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(1);
  });

  it('rejects product create retries that reuse the same Idempotency-Key with a different payload', async () => {
    const app = createApp();
    mocks.commandReserve.mockResolvedValue({
      existing: true,
      ownsReservation: false,
      record: {
        command_id: 'cmd-product-2',
        scope_key: 'product_create:admin-1',
        idempotency_key: 'product-key-2',
        request_fingerprint: buildProductCreateFingerprintForTest({
          name: 'Catalog Tee',
          currency: 'USD',
          variants: [{ sku: 'SKU-1', price: 100, cost_price: 60, stock_quantity: 5 }],
        }),
        response_json: null,
        status: 'in_flight',
      },
    });

    const res = await app.request(
      'http://localhost/api/manage/products',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'product-key-2',
        },
        body: JSON.stringify({
          name: 'Catalog Tee',
          currency: 'CNY',
          variants: [{ sku: 'SKU-1', price: 100, cost_price: 60, stock_quantity: 5 }],
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(expect.objectContaining({
      error: '同一个幂等键不能提交不同的商品创建请求',
    }));
    expect(mocks.createManagedProduct).not.toHaveBeenCalled();
  });

  it('retries product-create side effects without duplicating the product after a cache publish failure', async () => {
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
          command_id: 'cmd-product-retry-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });
    mocks.commandBuildFinalizeStatement.mockImplementation((commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        commandState.set('product-key-retry-1', {
          commandId,
          requestFingerprint: commandState.get('product-key-retry-1')?.requestFingerprint
            || buildProductCreateFingerprintForTest({
              name: 'Catalog Tee',
              currency: 'USD',
              variants: [{ sku: 'SKU-1', price: 100, cost_price: 60, stock_quantity: 5 }],
            }),
          responseJson: responseJson == null ? null : JSON.stringify(responseJson),
          status,
        });
        return { meta: { changes: 1 } };
      }),
    }));
    mocks.scheduleProductCacheInvalidation
      .mockRejectedValueOnce(new Error('publish failed'))
      .mockResolvedValueOnce([]);

    const request = () => app.request(
      'http://localhost/api/manage/products',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'product-key-retry-1',
        },
        body: JSON.stringify({
          name: 'Catalog Tee',
          currency: 'USD',
          variants: [{ sku: 'SKU-1', price: 100, cost_price: 60, stock_quantity: 5 }],
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(201);
    expect(mocks.createManagedProduct).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'product.create', result: 'success' })
    );
    expect(mocks.commandBuildFinalizeStatement).toHaveBeenCalledWith(
      'cmd-product-retry-1',
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'prod-1' }),
      }),
      'failed'
    );
  });

  it('retries product-create finalize failures without generating duplicate create events', async () => {
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
          command_id: 'cmd-product-finalize-1',
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
        commandState.set('product-key-finalize-1', {
          commandId,
          requestFingerprint: buildProductCreateFingerprintForTest({
            name: 'Catalog Tee',
            currency: 'USD',
            variants: [{ sku: 'SKU-1', price: 100, cost_price: 60, stock_quantity: 5 }],
          }),
          responseJson: responseJson == null ? null : JSON.stringify(responseJson),
          status,
        });
        return { meta: { changes: 1 } };
      }),
    }));
    mocks.scheduleProductCacheInvalidation
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('D1_ERROR: UNIQUE constraint failed: domain_outbox.idempotency_key'));

    const request = () => app.request(
      'http://localhost/api/manage/products',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'product-key-finalize-1',
        },
        body: JSON.stringify({
          name: 'Catalog Tee',
          currency: 'USD',
          variants: [{ sku: 'SKU-1', price: 100, cost_price: 60, stock_quantity: 5 }],
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(201);
    expect(mocks.createManagedProduct).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleProductCacheInvalidation.mock.calls[0][2]).toEqual(expect.objectContaining({
      commandId: 'cmd-product-finalize-1',
      correlationId: 'cmd-product-finalize-1',
    }));
    expect(mocks.scheduleProductCacheInvalidation.mock.calls[1][2]).toEqual(expect.objectContaining({
      commandId: 'cmd-product-finalize-1',
      correlationId: 'cmd-product-finalize-1',
    }));
  });
});
