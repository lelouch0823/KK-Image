import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  productFindById: vi.fn(),
  dimensionUpdateDimension: vi.fn(),
  patchProduct: vi.fn(),
  putProduct: vi.fn(),
  scheduleProductCacheInvalidation: vi.fn(async () => []),
  scheduleAuditEvent: vi.fn(),
  commandReserve: vi.fn(),
  commandBuildDeleteStatement: vi.fn(),
  commandDeleteRun: vi.fn(async () => ({ meta: { changes: 1 } })),
  commandBuildFinalizeStatement: vi.fn(),
  commandFinalizeRun: vi.fn(async () => ({ meta: { changes: 1 } })),
}));

vi.mock('../../../../../../repositories/ProductRepository.js', () => ({
  ProductRepository: class {
    findById(...args) {
      return mocks.productFindById(...args);
    }
  },
}));

vi.mock('../../../../../../repositories/ProductVariantRepository.js', () => ({
  ProductVariantRepository: class {
    findByProductId() {
      return [];
    }
  },
}));

vi.mock('../../../../../../repositories/ProductDimensionRepository.js', () => ({
  ProductDimensionRepository: class {
    updateDimension(...args) {
      return mocks.dimensionUpdateDimension(...args);
    }
  },
}));

vi.mock('../../../../../../repositories/VariantImageRepository.js', () => ({
  VariantImageRepository: class {},
}));

vi.mock('../../../../../../repositories/VariantAuditRepository.js', () => ({
  VariantAuditRepository: class {
    createBatch() {
      return [];
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

vi.mock('../../../../../../services/ProductCatalogService.js', () => ({
  ProductCatalogService: class {
    patchProduct(...args) {
      return mocks.patchProduct(...args);
    }
    putProduct(...args) {
      return mocks.putProduct(...args);
    }
  },
}));

vi.mock('../../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => next(),
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

import productByIdApp from '../[id]/index.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.use('/api/manage/products/*', async (c, next) => {
    c.set('user', { id: 'admin-1', role: 'admin', permissions: ['products:manage'] });
    await next();
  });
  app.route('/api/manage/products', productByIdApp);
  return app;
}

function normalizeFingerprintValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeFingerprintValue(item));
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const normalized = normalizeFingerprintValue(value[key]);
        if (normalized !== undefined) {
          acc[key] = normalized;
        }
        return acc;
      }, {});
  }
  return value;
}

function buildFingerprint(scope) {
  return JSON.stringify(normalizeFingerprintValue(scope));
}

describe('manage product update routes idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.productFindById.mockResolvedValue({ id: 'prod-1', name: 'Catalog Tee' });
    mocks.dimensionUpdateDimension.mockResolvedValue({
      id: 'dim-1',
      name: 'Colour',
      status: 'active',
    });
    mocks.patchProduct.mockResolvedValue({
      changes: 2,
      variantSync: { updated: 1 },
      variantsUpdated: true,
    });
    mocks.putProduct.mockResolvedValue({
      changes: 3,
      variantSync: { archived: 1 },
      variantsUpdated: true,
    });
    mocks.commandReserve.mockResolvedValue({
      existing: false,
      ownsReservation: true,
      record: { command_id: 'cmd-product-update-1' },
    });
    mocks.commandBuildDeleteStatement.mockReturnValue({ run: mocks.commandDeleteRun });
    mocks.commandBuildFinalizeStatement.mockReturnValue({ run: mocks.commandFinalizeRun });
  });

  it('replays the original dimension update response for the same Idempotency-Key', async () => {
    const app = createApp();
    const storedResponses = new Map();

    mocks.commandBuildFinalizeStatement.mockImplementation(
      (_commandId, responseJson, status = 'committed') => ({
        run: vi.fn(async () => {
          storedResponses.set('dimension-update-key-1', { responseJson, status });
          return { meta: { changes: 1 } };
        }),
      })
    );
    mocks.commandReserve.mockImplementation(
      async (_type, scopeKey, idempotencyKey, requestFingerprint) => {
        if (idempotencyKey === 'dimension-update-key-1' && storedResponses.has(idempotencyKey)) {
          const stored = storedResponses.get(idempotencyKey);
          return {
            existing: true,
            ownsReservation: false,
            record: {
              command_id: 'cmd-dimension-update-1',
              scope_key: scopeKey,
              idempotency_key: idempotencyKey,
              request_fingerprint: requestFingerprint,
              response_json: JSON.stringify(stored.responseJson),
              status: stored.status,
            },
          };
        }
        return {
          existing: false,
          ownsReservation: true,
          record: {
            command_id: 'cmd-dimension-update-1',
            scope_key: scopeKey,
            idempotency_key: idempotencyKey,
            request_fingerprint: requestFingerprint,
          },
        };
      }
    );

    const request = () =>
      app.request(
        'http://localhost/api/manage/products/prod-1/dimensions/dim-1',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': 'dimension-update-key-1',
          },
          body: JSON.stringify({ name: 'Colour' }),
        },
        { DB: {} },
        { waitUntil: vi.fn() }
      );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.clone().json());
    expect(mocks.dimensionUpdateDimension).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(1);
  });

  it('rejects dimension update retries that reuse the same Idempotency-Key with a different payload', async () => {
    const app = createApp();
    mocks.commandReserve.mockResolvedValue({
      existing: true,
      ownsReservation: false,
      record: {
        command_id: 'cmd-dimension-update-2',
        scope_key: 'product_dimension_update:admin-1',
        idempotency_key: 'dimension-update-key-2',
        request_fingerprint: buildFingerprint({
          productId: 'prod-1',
          dimensionId: 'dim-1',
          body: { name: 'Colour' },
        }),
        response_json: null,
        status: 'in_flight',
      },
    });

    const res = await app.request(
      'http://localhost/api/manage/products/prod-1/dimensions/dim-1',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'dimension-update-key-2',
        },
        body: JSON.stringify({ name: 'Material' }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        error: '同一个幂等键不能提交不同的商品规格维度更新请求',
      })
    );
    expect(mocks.dimensionUpdateDimension).not.toHaveBeenCalled();
  });

  it('retries product patch side effects without rerunning patch after a cache publish failure', async () => {
    const app = createApp();
    const commandState = new Map();

    mocks.commandReserve.mockImplementation(
      async (_type, scopeKey, idempotencyKey, requestFingerprint) => {
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
            command_id: 'cmd-product-patch-retry-1',
            scope_key: scopeKey,
            idempotency_key: idempotencyKey,
            request_fingerprint: requestFingerprint,
          },
        };
      }
    );
    mocks.commandBuildFinalizeStatement.mockImplementation(
      (commandId, responseJson, status = 'committed') => ({
        run: vi.fn(async () => {
          commandState.set('product-patch-key-retry-1', {
            commandId,
            requestFingerprint: buildFingerprint({
              productId: 'prod-1',
              body: { name: 'Updated Tee' },
              fullReplace: false,
            }),
            responseJson: responseJson == null ? null : JSON.stringify(responseJson),
            status,
          });
          return { meta: { changes: 1 } };
        }),
      })
    );
    mocks.scheduleProductCacheInvalidation
      .mockRejectedValueOnce(new Error('publish failed'))
      .mockResolvedValueOnce([]);

    const request = () =>
      app.request(
        'http://localhost/api/manage/products/prod-1',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': 'product-patch-key-retry-1',
          },
          body: JSON.stringify({ name: 'Updated Tee' }),
        },
        { DB: {} },
        { waitUntil: vi.fn() }
      );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(mocks.patchProduct).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'product.update', result: 'success' })
    );
    expect(mocks.patchProduct).toHaveBeenCalledWith(
      expect.anything(),
      'prod-1',
      { name: 'Updated Tee' },
      expect.objectContaining({ skipCacheInvalidation: true })
    );
  });

  it('publishes product cache invalidation for dimensions-only product patch results', async () => {
    mocks.patchProduct.mockResolvedValueOnce({
      changes: 0,
      variantSync: undefined,
      variantsUpdated: false,
      dimensionsUpdated: true,
    });
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/products/prod-1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensions: [{ name: 'Color', values: [{ value: 'Red' }] }],
        }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'product_updated',
        productIds: ['prod-1'],
      }),
      expect.anything()
    );
  });

  it('replays the original product put response for the same Idempotency-Key', async () => {
    const app = createApp();
    const storedResponses = new Map();

    mocks.commandBuildFinalizeStatement.mockImplementation(
      (_commandId, responseJson, status = 'committed') => ({
        run: vi.fn(async () => {
          storedResponses.set('product-put-key-1', { responseJson, status });
          return { meta: { changes: 1 } };
        }),
      })
    );
    mocks.commandReserve.mockImplementation(
      async (_type, scopeKey, idempotencyKey, requestFingerprint) => {
        if (idempotencyKey === 'product-put-key-1' && storedResponses.has(idempotencyKey)) {
          const stored = storedResponses.get(idempotencyKey);
          return {
            existing: true,
            ownsReservation: false,
            record: {
              command_id: 'cmd-product-put-1',
              scope_key: scopeKey,
              idempotency_key: idempotencyKey,
              request_fingerprint: requestFingerprint,
              response_json: JSON.stringify(stored.responseJson),
              status: stored.status,
            },
          };
        }
        return {
          existing: false,
          ownsReservation: true,
          record: {
            command_id: 'cmd-product-put-1',
            scope_key: scopeKey,
            idempotency_key: idempotencyKey,
            request_fingerprint: requestFingerprint,
          },
        };
      }
    );

    const request = () =>
      app.request(
        'http://localhost/api/manage/products/prod-1',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': 'product-put-key-1',
          },
          body: JSON.stringify({ name: 'Replacement Tee', variants: [] }),
        },
        { DB: {} },
        { waitUntil: vi.fn() }
      );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.clone().json());
    expect(mocks.putProduct).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(1);
  });

  it('retries product put finalize failures without generating duplicate cache events', async () => {
    const app = createApp();
    const commandState = new Map();
    let committedFinalizeAttempts = 0;

    mocks.commandReserve.mockImplementation(
      async (_type, scopeKey, idempotencyKey, requestFingerprint) => {
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
            command_id: 'cmd-product-put-finalize-1',
            scope_key: scopeKey,
            idempotency_key: idempotencyKey,
            request_fingerprint: requestFingerprint,
          },
        };
      }
    );
    mocks.commandBuildFinalizeStatement.mockImplementation(
      (commandId, responseJson, status = 'committed') => ({
        run: vi.fn(async () => {
          if (status === 'committed') {
            committedFinalizeAttempts += 1;
            if (committedFinalizeAttempts === 1) {
              throw new Error('finalize committed failed');
            }
          }
          commandState.set('product-put-key-finalize-1', {
            commandId,
            requestFingerprint: buildFingerprint({
              productId: 'prod-1',
              body: { name: 'Replacement Tee', variants: [] },
              fullReplace: true,
            }),
            responseJson: responseJson == null ? null : JSON.stringify(responseJson),
            status,
          });
          return { meta: { changes: 1 } };
        }),
      })
    );
    mocks.scheduleProductCacheInvalidation
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(
        new Error('D1_ERROR: UNIQUE constraint failed: domain_outbox.idempotency_key')
      );

    const request = () =>
      app.request(
        'http://localhost/api/manage/products/prod-1',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': 'product-put-key-finalize-1',
          },
          body: JSON.stringify({ name: 'Replacement Tee', variants: [] }),
        },
        { DB: {} },
        { waitUntil: vi.fn() }
      );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(mocks.putProduct).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleProductCacheInvalidation.mock.calls[0][2]).toEqual(
      expect.objectContaining({
        commandId: 'cmd-product-put-finalize-1',
        correlationId: 'cmd-product-put-finalize-1',
      })
    );
    expect(mocks.scheduleProductCacheInvalidation.mock.calls[1][2]).toEqual(
      expect.objectContaining({
        commandId: 'cmd-product-put-finalize-1',
        correlationId: 'cmd-product-put-finalize-1',
      })
    );
  });
});
