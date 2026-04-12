import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  productFindById: vi.fn(),
  dimensionArchiveDimension: vi.fn(),
  dimensionArchiveVariantsByDimension: vi.fn(),
  dimensionMergeKeepByDimensionRemoval: vi.fn(),
  dimensionArchiveValue: vi.fn(),
  dimensionArchiveVariantsByValue: vi.fn(),
  dimensionRestoreValue: vi.fn(),
  variantImageSortImages: vi.fn(),
  variantImageSetPrimary: vi.fn(),
  variantImageDeleteImage: vi.fn(),
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
    archiveDimension(...args) {
      return mocks.dimensionArchiveDimension(...args);
    }
    archiveVariantsByDimension(...args) {
      return mocks.dimensionArchiveVariantsByDimension(...args);
    }
    mergeKeepByDimensionRemoval(...args) {
      return mocks.dimensionMergeKeepByDimensionRemoval(...args);
    }
    archiveValue(...args) {
      return mocks.dimensionArchiveValue(...args);
    }
    archiveVariantsByValue(...args) {
      return mocks.dimensionArchiveVariantsByValue(...args);
    }
    restoreValue(...args) {
      return mocks.dimensionRestoreValue(...args);
    }
  },
}));

vi.mock('../../../../../../repositories/VariantImageRepository.js', () => ({
  VariantImageRepository: class {
    sortImages(...args) {
      return mocks.variantImageSortImages(...args);
    }
    setPrimary(...args) {
      return mocks.variantImageSetPrimary(...args);
    }
    deleteImage(...args) {
      return mocks.variantImageDeleteImage(...args);
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
      throw new Error('not implemented in detail mutation idempotency test');
    }

    putProduct() {
      throw new Error('not implemented in detail mutation idempotency test');
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

function buildMutationFingerprint(scope) {
  return JSON.stringify(normalizeFingerprintValue(scope));
}

describe('manage product detail mutation routes idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.productFindById.mockResolvedValue({ id: 'prod-1', name: 'Catalog Tee' });
    mocks.dimensionArchiveVariantsByDimension.mockResolvedValue(2);
    mocks.dimensionMergeKeepByDimensionRemoval.mockResolvedValue({ deduped: 1, updated: 2 });
    mocks.dimensionArchiveDimension.mockResolvedValue({ id: 'dim-1', status: 'archived' });
    mocks.dimensionArchiveVariantsByValue.mockResolvedValue({ changes: 1, dimensionId: 'dim-1', value: 'Red' });
    mocks.dimensionArchiveValue.mockResolvedValue({ id: 'val-1', status: 'archived' });
    mocks.dimensionRestoreValue.mockResolvedValue({ id: 'val-1', status: 'active' });
    mocks.variantImageSortImages.mockResolvedValue(undefined);
    mocks.variantImageSetPrimary.mockResolvedValue(undefined);
    mocks.variantImageDeleteImage.mockResolvedValue(true);
    mocks.commandReserve.mockResolvedValue({
      existing: false,
      ownsReservation: true,
      record: { command_id: 'cmd-detail-mutation-1' },
    });
    mocks.commandBuildDeleteStatement.mockReturnValue({
      run: mocks.commandDeleteRun,
    });
    mocks.commandBuildFinalizeStatement.mockReturnValue({
      run: mocks.commandFinalizeRun,
    });
  });

  it('replays the original dimension archive response for the same Idempotency-Key', async () => {
    const app = createApp();
    const storedResponses = new Map();

    mocks.commandBuildFinalizeStatement.mockImplementation((_commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        storedResponses.set('detail-dimension-archive-key-1', { responseJson, status });
        return { meta: { changes: 1 } };
      }),
    }));
    mocks.commandReserve.mockImplementation(async (_commandType, scopeKey, idempotencyKey, requestFingerprint) => {
      if (idempotencyKey === 'detail-dimension-archive-key-1' && storedResponses.has(idempotencyKey)) {
        const stored = storedResponses.get(idempotencyKey);
        return {
          existing: true,
          ownsReservation: false,
          record: {
            command_id: 'cmd-dimension-archive-1',
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
          command_id: 'cmd-dimension-archive-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });

    const request = () => app.request(
      'http://localhost/api/manage/products/prod-1/dimensions/dim-1/archive',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'detail-dimension-archive-key-1',
        },
        body: JSON.stringify({ mode: 'merge_keep' }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.clone().json());
    expect(mocks.dimensionMergeKeepByDimensionRemoval).toHaveBeenCalledTimes(1);
    expect(mocks.dimensionArchiveDimension).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(1);
  });

  it('rejects dimension archive retries that reuse the same Idempotency-Key with a different payload', async () => {
    const app = createApp();

    mocks.commandReserve.mockResolvedValue({
      existing: true,
      ownsReservation: false,
      record: {
        command_id: 'cmd-dimension-archive-2',
        scope_key: 'product_dimension_archive:admin-1',
        idempotency_key: 'detail-dimension-archive-key-2',
        request_fingerprint: buildMutationFingerprint({
          productId: 'prod-1',
          dimensionId: 'dim-1',
          mode: 'merge_keep',
        }),
        response_json: null,
        status: 'in_flight',
      },
    });

    const res = await app.request(
      'http://localhost/api/manage/products/prod-1/dimensions/dim-1/archive',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'detail-dimension-archive-key-2',
        },
        body: JSON.stringify({ mode: 'archive_variants' }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(expect.objectContaining({
      error: '同一个幂等键不能提交不同的商品规格维度归档请求',
    }));
    expect(mocks.dimensionArchiveDimension).not.toHaveBeenCalled();
  });

  it('retries dimension archive side effects without rerunning archive after a cache publish failure', async () => {
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
          command_id: 'cmd-dimension-archive-retry-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });
    mocks.commandBuildFinalizeStatement.mockImplementation((commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        commandState.set('detail-dimension-archive-key-retry-1', {
          commandId,
          requestFingerprint: buildMutationFingerprint({
            productId: 'prod-1',
            dimensionId: 'dim-1',
            mode: 'merge_keep',
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
      'http://localhost/api/manage/products/prod-1/dimensions/dim-1/archive',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'detail-dimension-archive-key-retry-1',
        },
        body: JSON.stringify({ mode: 'merge_keep' }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(mocks.dimensionMergeKeepByDimensionRemoval).toHaveBeenCalledTimes(1);
    expect(mocks.dimensionArchiveDimension).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
  });

  it('replays the original dimension value archive response for the same Idempotency-Key', async () => {
    const app = createApp();
    const storedResponses = new Map();

    mocks.commandBuildFinalizeStatement.mockImplementation((_commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        storedResponses.set('detail-value-archive-key-1', { responseJson, status });
        return { meta: { changes: 1 } };
      }),
    }));
    mocks.commandReserve.mockImplementation(async (_commandType, scopeKey, idempotencyKey, requestFingerprint) => {
      if (idempotencyKey === 'detail-value-archive-key-1' && storedResponses.has(idempotencyKey)) {
        const stored = storedResponses.get(idempotencyKey);
        return {
          existing: true,
          ownsReservation: false,
          record: {
            command_id: 'cmd-value-archive-1',
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
          command_id: 'cmd-value-archive-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });

    const request = () => app.request(
      'http://localhost/api/manage/products/prod-1/values/val-1/archive',
      {
        method: 'PATCH',
        headers: {
          'Idempotency-Key': 'detail-value-archive-key-1',
        },
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.clone().json());
    expect(mocks.dimensionArchiveVariantsByValue).toHaveBeenCalledTimes(1);
    expect(mocks.dimensionArchiveValue).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(1);
  });

  it('retries dimension value restore side effects without rerunning restore after a cache publish failure', async () => {
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
          command_id: 'cmd-value-restore-retry-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });
    mocks.commandBuildFinalizeStatement.mockImplementation((commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        commandState.set('detail-value-restore-key-retry-1', {
          commandId,
          requestFingerprint: buildMutationFingerprint({
            productId: 'prod-1',
            valueId: 'val-1',
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
      'http://localhost/api/manage/products/prod-1/values/val-1/restore',
      {
        method: 'PATCH',
        headers: {
          'Idempotency-Key': 'detail-value-restore-key-retry-1',
        },
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(mocks.dimensionRestoreValue).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
  });

  it('replays the original variant image sort response for the same Idempotency-Key', async () => {
    const app = createApp();
    const storedResponses = new Map();

    mocks.commandBuildFinalizeStatement.mockImplementation((_commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        storedResponses.set('detail-image-sort-key-1', { responseJson, status });
        return { meta: { changes: 1 } };
      }),
    }));
    mocks.commandReserve.mockImplementation(async (_commandType, scopeKey, idempotencyKey, requestFingerprint) => {
      if (idempotencyKey === 'detail-image-sort-key-1' && storedResponses.has(idempotencyKey)) {
        const stored = storedResponses.get(idempotencyKey);
        return {
          existing: true,
          ownsReservation: false,
          record: {
            command_id: 'cmd-image-sort-1',
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
          command_id: 'cmd-image-sort-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });

    const request = () => app.request(
      'http://localhost/api/manage/products/prod-1/variants/var-1/images/sort',
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'detail-image-sort-key-1',
        },
        body: JSON.stringify({ imageIds: ['file-2', 'file-1'] }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.clone().json());
    expect(mocks.variantImageSortImages).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(1);
  });

  it('rejects variant image primary retries that reuse the same Idempotency-Key with a different route target', async () => {
    const app = createApp();

    mocks.commandReserve.mockResolvedValue({
      existing: true,
      ownsReservation: false,
      record: {
        command_id: 'cmd-image-primary-2',
        scope_key: 'product_variant_image_primary:admin-1',
        idempotency_key: 'detail-image-primary-key-2',
        request_fingerprint: buildMutationFingerprint({
          productId: 'prod-1',
          variantId: 'var-1',
          imageId: 'file-1',
        }),
        response_json: null,
        status: 'in_flight',
      },
    });

    const res = await app.request(
      'http://localhost/api/manage/products/prod-1/variants/var-1/images/file-2/primary',
      {
        method: 'PATCH',
        headers: {
          'Idempotency-Key': 'detail-image-primary-key-2',
        },
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(expect.objectContaining({
      error: '同一个幂等键不能提交不同的商品变体主图设置请求',
    }));
    expect(mocks.variantImageSetPrimary).not.toHaveBeenCalled();
  });

  it('retries variant image delete side effects without rerunning delete after a cache publish failure', async () => {
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
          command_id: 'cmd-image-delete-retry-1',
          scope_key: scopeKey,
          idempotency_key: idempotencyKey,
          request_fingerprint: requestFingerprint,
        },
      };
    });
    mocks.commandBuildFinalizeStatement.mockImplementation((commandId, responseJson, status = 'committed') => ({
      run: vi.fn(async () => {
        commandState.set('detail-image-delete-key-retry-1', {
          commandId,
          requestFingerprint: buildMutationFingerprint({
            productId: 'prod-1',
            variantId: 'var-1',
            imageId: 'file-1',
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
      'http://localhost/api/manage/products/prod-1/variants/var-1/images/file-1',
      {
        method: 'DELETE',
        headers: {
          'Idempotency-Key': 'detail-image-delete-key-retry-1',
        },
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(mocks.variantImageDeleteImage).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
  });

  it('retries variant image delete finalize failures without generating duplicate cache events', async () => {
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
          command_id: 'cmd-image-delete-finalize-1',
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
        commandState.set('detail-image-delete-key-finalize-1', {
          commandId,
          requestFingerprint: buildMutationFingerprint({
            productId: 'prod-1',
            variantId: 'var-1',
            imageId: 'file-1',
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
      'http://localhost/api/manage/products/prod-1/variants/var-1/images/file-1',
      {
        method: 'DELETE',
        headers: {
          'Idempotency-Key': 'detail-image-delete-key-finalize-1',
        },
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(mocks.variantImageDeleteImage).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleProductCacheInvalidation.mock.calls[0][2]).toEqual(expect.objectContaining({
      commandId: 'cmd-image-delete-finalize-1',
      correlationId: 'cmd-image-delete-finalize-1',
    }));
    expect(mocks.scheduleProductCacheInvalidation.mock.calls[1][2]).toEqual(expect.objectContaining({
      commandId: 'cmd-image-delete-finalize-1',
      correlationId: 'cmd-image-delete-finalize-1',
    }));
  });
});
