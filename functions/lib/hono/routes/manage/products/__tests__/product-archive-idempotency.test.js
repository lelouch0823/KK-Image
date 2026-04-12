import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  productFindById: vi.fn(),
  variantFindByProductId: vi.fn(),
  auditCreateBatch: vi.fn(),
  scheduleProductCacheInvalidation: vi.fn(async () => []),
  scheduleAuditEvent: vi.fn(),
  commandReserve: vi.fn(),
  commandBuildDeleteStatement: vi.fn(),
  commandDeleteRun: vi.fn(async () => ({ meta: { changes: 1 } })),
  commandBuildFinalizeStatement: vi.fn(),
  commandFinalizeRun: vi.fn(async () => ({ meta: { changes: 1 } })),
  dbPrepare: vi.fn(),
  dbBind: vi.fn(),
  dbRun: vi.fn(async () => ({ meta: { changes: 1 } })),
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
    findByProductId(...args) {
      return mocks.variantFindByProductId(...args);
    }
  },
}));

vi.mock('../../../../../../repositories/ProductDimensionRepository.js', () => ({
  ProductDimensionRepository: class {},
}));

vi.mock('../../../../../../repositories/VariantImageRepository.js', () => ({
  VariantImageRepository: class {},
}));

vi.mock('../../../../../../repositories/VariantAuditRepository.js', () => ({
  VariantAuditRepository: class {
    createBatch(...args) {
      return mocks.auditCreateBatch(...args);
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
    patchProduct() {
      throw new Error('not implemented in archive idempotency test');
    }

    putProduct() {
      throw new Error('not implemented in archive idempotency test');
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

import productByIdApp from '../[id].js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json({ success: false, error: err?.message || 'Internal Error' }, Number(err?.statusCode || 500))
  );
  app.use('/api/manage/products/*', async (c, next) => {
    c.set('user', { id: 'admin-1', role: 'admin', permissions: ['products:manage'] });
    await next();
  });
  app.route('/api/manage/products', productByIdApp);
  return app;
}

function createEnvDb() {
  mocks.dbBind.mockImplementation(() => ({
    run: mocks.dbRun,
  }));
  mocks.dbPrepare.mockImplementation(() => ({
    bind: mocks.dbBind,
  }));

  return {
    prepare: mocks.dbPrepare,
  };
}

function buildArchiveFingerprint(productId) {
  return JSON.stringify({ productId });
}

describe('manage product archive route idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.productFindById.mockResolvedValue({ id: 'prod-1', name: 'Catalog Tee' });
    mocks.variantFindByProductId.mockResolvedValue([
      { id: 'var-1', product_id: 'prod-1', status: 'active' },
    ]);
    mocks.auditCreateBatch.mockResolvedValue([]);
    mocks.scheduleProductCacheInvalidation.mockResolvedValue([]);
    mocks.commandReserve.mockResolvedValue({
      existing: false,
      ownsReservation: true,
      record: { command_id: 'cmd-product-archive-1' },
    });
    mocks.commandBuildDeleteStatement.mockReturnValue({
      run: mocks.commandDeleteRun,
    });
    mocks.commandBuildFinalizeStatement.mockReturnValue({
      run: mocks.commandFinalizeRun,
    });
    createEnvDb();
  });

  it('replays the original product archive response for the same Idempotency-Key', async () => {
    const app = createApp();
    const storedResponses = new Map();

    mocks.commandBuildFinalizeStatement.mockImplementation((_commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        storedResponses.set('archive-key-1', {
          responseJson,
          status,
        });
        return { meta: { changes: 1 } };
      }),
    }));
    mocks.commandReserve.mockImplementation(async (_commandType, scopeKey, idempotencyKey, requestFingerprint) => {
      if (idempotencyKey === 'archive-key-1' && storedResponses.has(idempotencyKey)) {
        const stored = storedResponses.get(idempotencyKey);
        return {
          existing: true,
          ownsReservation: false,
          record: {
            command_id: 'cmd-product-archive-1',
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
          command_id: 'cmd-product-archive-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });

    const request = (productId = 'prod-1') => app.request(
      `http://localhost/api/manage/products/${productId}`,
      {
        method: 'DELETE',
        headers: {
          'Idempotency-Key': 'archive-key-1',
        },
      },
      { DB: createEnvDb() },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const dbRunsAfterFirst = mocks.dbRun.mock.calls.length;
    const auditCallsAfterFirst = mocks.auditCreateBatch.mock.calls.length;
    const cacheCallsAfterFirst = mocks.scheduleProductCacheInvalidation.mock.calls.length;
    const second = await request();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.clone().json());
    expect(dbRunsAfterFirst).toBeGreaterThan(0);
    expect(auditCallsAfterFirst).toBe(1);
    expect(cacheCallsAfterFirst).toBe(1);
    expect(mocks.dbRun).toHaveBeenCalledTimes(dbRunsAfterFirst);
    expect(mocks.auditCreateBatch).toHaveBeenCalledTimes(auditCallsAfterFirst);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(cacheCallsAfterFirst);
  });

  it('rejects product archive retries that reuse the same Idempotency-Key for a different product', async () => {
    const app = createApp();
    mocks.productFindById.mockImplementation(async (productId) => ({ id: productId, name: `Product ${productId}` }));
    mocks.commandReserve.mockResolvedValue({
      existing: true,
      ownsReservation: false,
      record: {
        command_id: 'cmd-product-archive-2',
        scope_key: 'product_archive:admin-1',
        idempotency_key: 'archive-key-2',
        request_fingerprint: buildArchiveFingerprint('prod-1'),
        response_json: null,
        status: 'in_flight',
      },
    });

    const res = await app.request(
      'http://localhost/api/manage/products/prod-2',
      {
        method: 'DELETE',
        headers: {
          'Idempotency-Key': 'archive-key-2',
        },
      },
      { DB: createEnvDb() },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(expect.objectContaining({
      error: '同一个幂等键不能提交不同的商品归档请求',
    }));
    expect(mocks.dbRun).not.toHaveBeenCalled();
    expect(mocks.scheduleProductCacheInvalidation).not.toHaveBeenCalled();
  });

  it('retries product archive side effects without rerunning the archive after cache publish failures', async () => {
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
          command_id: 'cmd-product-archive-retry-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });
    mocks.commandBuildFinalizeStatement.mockImplementation((commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        commandState.set('archive-key-retry-1', {
          commandId,
          requestFingerprint: buildArchiveFingerprint('prod-1'),
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
      'http://localhost/api/manage/products/prod-1',
      {
        method: 'DELETE',
        headers: {
          'Idempotency-Key': 'archive-key-retry-1',
        },
      },
      { DB: createEnvDb() },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(mocks.dbRun).toHaveBeenCalledTimes(1);
    expect(mocks.auditCreateBatch).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'product.archive', result: 'success' })
    );
  });

  it('retries product archive finalize failures without generating duplicate cache events', async () => {
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
          command_id: 'cmd-product-archive-finalize-1',
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
        commandState.set('archive-key-finalize-1', {
          commandId,
          requestFingerprint: buildArchiveFingerprint('prod-1'),
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
      'http://localhost/api/manage/products/prod-1',
      {
        method: 'DELETE',
        headers: {
          'Idempotency-Key': 'archive-key-finalize-1',
        },
      },
      { DB: createEnvDb() },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(mocks.dbRun).toHaveBeenCalledTimes(1);
    expect(mocks.auditCreateBatch).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleProductCacheInvalidation.mock.calls[0][2]).toEqual(expect.objectContaining({
      commandId: 'cmd-product-archive-finalize-1',
      correlationId: 'cmd-product-archive-finalize-1',
    }));
    expect(mocks.scheduleProductCacheInvalidation.mock.calls[1][2]).toEqual(expect.objectContaining({
      commandId: 'cmd-product-archive-finalize-1',
      correlationId: 'cmd-product-archive-finalize-1',
    }));
  });
});
