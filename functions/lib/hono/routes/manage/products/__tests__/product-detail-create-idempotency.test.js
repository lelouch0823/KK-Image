import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  productFindById: vi.fn(),
  dimensionCreateDimension: vi.fn(),
  dimensionAddValue: vi.fn(),
  variantImageAddImage: vi.fn(),
  scheduleProductCacheInvalidation: vi.fn(async () => []),
  commandReserve: vi.fn(),
  commandBuildDeleteStatement: vi.fn(),
  commandDeleteRun: vi.fn(async () => ({ meta: { changes: 1 } })),
  commandBuildFinalizeStatement: vi.fn(),
  commandFinalizeRun: vi.fn(async () => ({ meta: { changes: 1 } })),
  scheduleAuditEvent: vi.fn(),
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
    createDimension(...args) {
      return mocks.dimensionCreateDimension(...args);
    }
    addValue(...args) {
      return mocks.dimensionAddValue(...args);
    }
  },
}));

vi.mock('../../../../../../repositories/VariantImageRepository.js', () => ({
  VariantImageRepository: class {
    addImage(...args) {
      return mocks.variantImageAddImage(...args);
    }
  },
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
    patchProduct() {
      throw new Error('not implemented in detail create idempotency test');
    }

    putProduct() {
      throw new Error('not implemented in detail create idempotency test');
    }
  },
}));

vi.mock('../../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => next(),
}));

vi.mock('../cache-helpers.js', () => ({
  scheduleProductCacheInvalidation: mocks.scheduleProductCacheInvalidation,
}));

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
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

function buildDetailCreateFingerprint(scope) {
  return JSON.stringify(normalizeFingerprintValue(scope));
}

describe('manage product detail create routes idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.productFindById.mockResolvedValue({ id: 'prod-1', name: 'Catalog Tee' });
    mocks.dimensionCreateDimension.mockResolvedValue({ id: 'dim-1', name: 'Size', status: 'active' });
    mocks.dimensionAddValue.mockResolvedValue({ id: 'val-1', value: 'Red', status: 'active' });
    mocks.variantImageAddImage.mockResolvedValue({ id: 'img-link-1', image_id: 'file-1', is_primary: 0 });
    mocks.commandReserve.mockResolvedValue({
      existing: false,
      ownsReservation: true,
      record: { command_id: 'cmd-detail-create-1' },
    });
    mocks.commandBuildDeleteStatement.mockReturnValue({
      run: mocks.commandDeleteRun,
    });
    mocks.commandBuildFinalizeStatement.mockReturnValue({
      run: mocks.commandFinalizeRun,
    });
  });

  it('replays the original dimension create response for the same Idempotency-Key', async () => {
    const app = createApp();
    const storedResponses = new Map();

    mocks.commandBuildFinalizeStatement.mockImplementation((_commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        storedResponses.set('detail-dimension-key-1', { responseJson, status });
        return { meta: { changes: 1 } };
      }),
    }));
    mocks.commandReserve.mockImplementation(async (_commandType, scopeKey, idempotencyKey, requestFingerprint) => {
      if (idempotencyKey === 'detail-dimension-key-1' && storedResponses.has(idempotencyKey)) {
        const stored = storedResponses.get(idempotencyKey);
        return {
          existing: true,
          ownsReservation: false,
          record: {
            command_id: 'cmd-dimension-create-1',
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
          command_id: 'cmd-dimension-create-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });

    const request = () => app.request(
      'http://localhost/api/manage/products/prod-1/dimensions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'detail-dimension-key-1',
        },
        body: JSON.stringify({ name: 'Size', sort_order: 2 }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await second.json()).toEqual(await first.clone().json());
    expect(mocks.dimensionCreateDimension).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(1);
  });

  it('rejects dimension create retries that reuse the same Idempotency-Key with a different payload', async () => {
    const app = createApp();

    mocks.commandReserve.mockResolvedValue({
      existing: true,
      ownsReservation: false,
      record: {
        command_id: 'cmd-dimension-create-2',
        scope_key: 'product_dimension_create:admin-1',
        idempotency_key: 'detail-dimension-key-2',
        request_fingerprint: buildDetailCreateFingerprint({
          productId: 'prod-1',
          body: { name: 'Size', sort_order: 1 },
        }),
        response_json: null,
        status: 'in_flight',
      },
    });

    const res = await app.request(
      'http://localhost/api/manage/products/prod-1/dimensions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'detail-dimension-key-2',
        },
        body: JSON.stringify({ name: 'Color', sort_order: 1 }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(expect.objectContaining({
      error: '同一个幂等键不能提交不同的商品规格维度创建请求',
    }));
    expect(mocks.dimensionCreateDimension).not.toHaveBeenCalled();
  });

  it('retries dimension create side effects without duplicating the dimension after a cache publish failure', async () => {
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
          command_id: 'cmd-dimension-create-retry-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });
    mocks.commandBuildFinalizeStatement.mockImplementation((commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        commandState.set('detail-dimension-key-retry-1', {
          commandId,
          requestFingerprint: buildDetailCreateFingerprint({
            productId: 'prod-1',
            body: { name: 'Size', sort_order: 2 },
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
      'http://localhost/api/manage/products/prod-1/dimensions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'detail-dimension-key-retry-1',
        },
        body: JSON.stringify({ name: 'Size', sort_order: 2 }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(201);
    expect(mocks.dimensionCreateDimension).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
    expect(mocks.commandBuildFinalizeStatement).toHaveBeenCalledWith(
      'cmd-dimension-create-retry-1',
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'dim-1' }),
      }),
      'failed'
    );
  });

  it('retries dimension create finalize failures without generating duplicate cache events', async () => {
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
          command_id: 'cmd-dimension-create-finalize-1',
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
        commandState.set('detail-dimension-key-finalize-1', {
          commandId,
          requestFingerprint: buildDetailCreateFingerprint({
            productId: 'prod-1',
            body: { name: 'Size', sort_order: 2 },
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
      'http://localhost/api/manage/products/prod-1/dimensions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'detail-dimension-key-finalize-1',
        },
        body: JSON.stringify({ name: 'Size', sort_order: 2 }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(201);
    expect(mocks.dimensionCreateDimension).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleProductCacheInvalidation.mock.calls[0][2]).toEqual(expect.objectContaining({
      commandId: 'cmd-dimension-create-finalize-1',
      correlationId: 'cmd-dimension-create-finalize-1',
    }));
    expect(mocks.scheduleProductCacheInvalidation.mock.calls[1][2]).toEqual(expect.objectContaining({
      commandId: 'cmd-dimension-create-finalize-1',
      correlationId: 'cmd-dimension-create-finalize-1',
    }));
  });

  it('replays the original dimension value create response for the same Idempotency-Key', async () => {
    const app = createApp();
    const storedResponses = new Map();

    mocks.commandBuildFinalizeStatement.mockImplementation((_commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        storedResponses.set('detail-dimension-value-key-1', { responseJson, status });
        return { meta: { changes: 1 } };
      }),
    }));
    mocks.commandReserve.mockImplementation(async (_commandType, scopeKey, idempotencyKey, requestFingerprint) => {
      if (idempotencyKey === 'detail-dimension-value-key-1' && storedResponses.has(idempotencyKey)) {
        const stored = storedResponses.get(idempotencyKey);
        return {
          existing: true,
          ownsReservation: false,
          record: {
            command_id: 'cmd-dimension-value-create-1',
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
          command_id: 'cmd-dimension-value-create-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });

    const request = () => app.request(
      'http://localhost/api/manage/products/prod-1/dimensions/dim-1/values',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'detail-dimension-value-key-1',
        },
        body: JSON.stringify({ value: 'Red', meta: { hex: '#ff0000' } }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await second.json()).toEqual(await first.clone().json());
    expect(mocks.dimensionAddValue).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(1);
  });

  it('rejects dimension value create retries that reuse the same Idempotency-Key with a different payload', async () => {
    const app = createApp();

    mocks.commandReserve.mockResolvedValue({
      existing: true,
      ownsReservation: false,
      record: {
        command_id: 'cmd-dimension-value-create-2',
        scope_key: 'product_dimension_value_create:admin-1',
        idempotency_key: 'detail-dimension-value-key-2',
        request_fingerprint: buildDetailCreateFingerprint({
          productId: 'prod-1',
          dimensionId: 'dim-1',
          body: { value: 'Red', meta: { hex: '#ff0000' } },
        }),
        response_json: null,
        status: 'in_flight',
      },
    });

    const res = await app.request(
      'http://localhost/api/manage/products/prod-1/dimensions/dim-1/values',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'detail-dimension-value-key-2',
        },
        body: JSON.stringify({ value: 'Blue', meta: { hex: '#0000ff' } }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(expect.objectContaining({
      error: '同一个幂等键不能提交不同的商品规格值创建请求',
    }));
    expect(mocks.dimensionAddValue).not.toHaveBeenCalled();
  });

  it('retries dimension value create side effects without duplicating the value after a cache publish failure', async () => {
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
          command_id: 'cmd-dimension-value-create-retry-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });
    mocks.commandBuildFinalizeStatement.mockImplementation((commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        commandState.set('detail-dimension-value-key-retry-1', {
          commandId,
          requestFingerprint: buildDetailCreateFingerprint({
            productId: 'prod-1',
            dimensionId: 'dim-1',
            body: { value: 'Red', meta: { hex: '#ff0000' } },
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
      'http://localhost/api/manage/products/prod-1/dimensions/dim-1/values',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'detail-dimension-value-key-retry-1',
        },
        body: JSON.stringify({ value: 'Red', meta: { hex: '#ff0000' } }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(201);
    expect(mocks.dimensionAddValue).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
    expect(mocks.commandBuildFinalizeStatement).toHaveBeenCalledWith(
      'cmd-dimension-value-create-retry-1',
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'val-1' }),
      }),
      'failed'
    );
  });

  it('retries dimension value create finalize failures without generating duplicate cache events', async () => {
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
          command_id: 'cmd-dimension-value-create-finalize-1',
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
        commandState.set('detail-dimension-value-key-finalize-1', {
          commandId,
          requestFingerprint: buildDetailCreateFingerprint({
            productId: 'prod-1',
            dimensionId: 'dim-1',
            body: { value: 'Red', meta: { hex: '#ff0000' } },
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
      'http://localhost/api/manage/products/prod-1/dimensions/dim-1/values',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'detail-dimension-value-key-finalize-1',
        },
        body: JSON.stringify({ value: 'Red', meta: { hex: '#ff0000' } }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(201);
    expect(mocks.dimensionAddValue).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleProductCacheInvalidation.mock.calls[0][2]).toEqual(expect.objectContaining({
      commandId: 'cmd-dimension-value-create-finalize-1',
      correlationId: 'cmd-dimension-value-create-finalize-1',
    }));
    expect(mocks.scheduleProductCacheInvalidation.mock.calls[1][2]).toEqual(expect.objectContaining({
      commandId: 'cmd-dimension-value-create-finalize-1',
      correlationId: 'cmd-dimension-value-create-finalize-1',
    }));
  });

  it('replays the original variant image create response for the same Idempotency-Key', async () => {
    const app = createApp();
    const storedResponses = new Map();

    mocks.commandBuildFinalizeStatement.mockImplementation((_commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        storedResponses.set('detail-variant-image-key-1', { responseJson, status });
        return { meta: { changes: 1 } };
      }),
    }));
    mocks.commandReserve.mockImplementation(async (_commandType, scopeKey, idempotencyKey, requestFingerprint) => {
      if (idempotencyKey === 'detail-variant-image-key-1' && storedResponses.has(idempotencyKey)) {
        const stored = storedResponses.get(idempotencyKey);
        return {
          existing: true,
          ownsReservation: false,
          record: {
            command_id: 'cmd-variant-image-create-1',
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
          command_id: 'cmd-variant-image-create-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });

    const request = () => app.request(
      'http://localhost/api/manage/products/prod-1/variants/var-1/images',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'detail-variant-image-key-1',
        },
        body: JSON.stringify({ imageId: 'file-1', isPrimary: true }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await second.json()).toEqual(await first.clone().json());
    expect(mocks.variantImageAddImage).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(1);
  });

  it('rejects variant image create retries that reuse the same Idempotency-Key with a different payload', async () => {
    const app = createApp();

    mocks.commandReserve.mockResolvedValue({
      existing: true,
      ownsReservation: false,
      record: {
        command_id: 'cmd-variant-image-create-2',
        scope_key: 'product_variant_image_create:admin-1',
        idempotency_key: 'detail-variant-image-key-2',
        request_fingerprint: buildDetailCreateFingerprint({
          productId: 'prod-1',
          variantId: 'var-1',
          body: { imageId: 'file-1', isPrimary: true },
        }),
        response_json: null,
        status: 'in_flight',
      },
    });

    const res = await app.request(
      'http://localhost/api/manage/products/prod-1/variants/var-1/images',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'detail-variant-image-key-2',
        },
        body: JSON.stringify({ imageId: 'file-2', isPrimary: true }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(expect.objectContaining({
      error: '同一个幂等键不能提交不同的商品变体图片创建请求',
    }));
    expect(mocks.variantImageAddImage).not.toHaveBeenCalled();
  });

  it('retries variant image create side effects without duplicating the image link after a cache publish failure', async () => {
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
          command_id: 'cmd-variant-image-create-retry-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });
    mocks.commandBuildFinalizeStatement.mockImplementation((commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        commandState.set('detail-variant-image-key-retry-1', {
          commandId,
          requestFingerprint: buildDetailCreateFingerprint({
            productId: 'prod-1',
            variantId: 'var-1',
            body: { imageId: 'file-1', isPrimary: true },
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
      'http://localhost/api/manage/products/prod-1/variants/var-1/images',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'detail-variant-image-key-retry-1',
        },
        body: JSON.stringify({ imageId: 'file-1', isPrimary: true }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(201);
    expect(mocks.variantImageAddImage).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
    expect(mocks.commandBuildFinalizeStatement).toHaveBeenCalledWith(
      'cmd-variant-image-create-retry-1',
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'img-link-1' }),
      }),
      'failed'
    );
  });

  it('retries variant image create finalize failures without generating duplicate cache events', async () => {
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
          command_id: 'cmd-variant-image-create-finalize-1',
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
        commandState.set('detail-variant-image-key-finalize-1', {
          commandId,
          requestFingerprint: buildDetailCreateFingerprint({
            productId: 'prod-1',
            variantId: 'var-1',
            body: { imageId: 'file-1', isPrimary: true },
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
      'http://localhost/api/manage/products/prod-1/variants/var-1/images',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'detail-variant-image-key-finalize-1',
        },
        body: JSON.stringify({ imageId: 'file-1', isPrimary: true }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(201);
    expect(mocks.variantImageAddImage).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleProductCacheInvalidation.mock.calls[0][2]).toEqual(expect.objectContaining({
      commandId: 'cmd-variant-image-create-finalize-1',
      correlationId: 'cmd-variant-image-create-finalize-1',
    }));
    expect(mocks.scheduleProductCacheInvalidation.mock.calls[1][2]).toEqual(expect.objectContaining({
      commandId: 'cmd-variant-image-create-finalize-1',
      correlationId: 'cmd-variant-image-create-finalize-1',
    }));
  });
});
