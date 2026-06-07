import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  batchImport: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  scheduleProductCacheInvalidation: vi.fn(async () => []),
  commandReserve: vi.fn(),
  commandBuildDeleteStatement: vi.fn(),
  commandDeleteRun: vi.fn(async () => ({ meta: { changes: 1 } })),
  commandBuildFinalizeStatement: vi.fn(),
  commandFinalizeRun: vi.fn(async () => ({ meta: { changes: 1 } })),
  randomUUID: vi.fn(),
}));

vi.mock('../../../../../../services/ProductCatalogService.js', () => ({
  ProductCatalogService: vi.fn(() => ({
    batchImport: mocks.batchImport,
  })),
  buildVariantMatchKey: vi.fn(),
  mergeIncomingWithExisting: vi.fn(),
}));

vi.mock('../../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

vi.mock('../cache-helpers.js', () => ({
  scheduleProductCacheInvalidation: mocks.scheduleProductCacheInvalidation,
}));

vi.mock('../../../../../../repositories/CommandIdempotencyRepository.js', () => ({
  CommandIdempotencyRepository: vi.fn(() => ({
    reserveCommand: mocks.commandReserve,
    buildDeleteStatement: mocks.commandBuildDeleteStatement,
    buildFinalizeStatement: mocks.commandBuildFinalizeStatement,
  })),
}));

import batchApp from '../batch.js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) =>
    c.json(
      { success: false, error: err?.message || 'Internal Error' },
      Number(err?.statusCode || 500)
    )
  );
  app.route('/api/manage/products/batch', batchApp);
  return app;
}

describe('manage products batch route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, 'randomUUID').mockImplementation(() => mocks.randomUUID());
    mocks.randomUUID.mockReturnValue('generated-product-batch-idempotency-key');
    mocks.batchImport.mockResolvedValue({
      success: true,
      count: 3,
      summary: {
        createdProducts: 2,
        updatedProducts: 1,
      },
    });
    mocks.commandReserve.mockResolvedValue({
      existing: false,
      ownsReservation: true,
      record: { command_id: 'cmd-product-batch-1' },
    });
    mocks.commandBuildDeleteStatement.mockReturnValue({
      run: mocks.commandDeleteRun,
    });
    mocks.commandBuildFinalizeStatement.mockReturnValue({
      run: mocks.commandFinalizeRun,
    });
  });

  it('audits product batch import summary', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/products/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [] }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'product.batch_import',
        result: 'success',
        metadata: expect.objectContaining({ imported: 3, created: 2, updated: 1 }),
      })
    );
  });

  it('records failed batch imports as audit failures with current summary fields', async () => {
    mocks.batchImport.mockResolvedValueOnce({
      success: false,
      count: 0,
      summary: {
        createdProducts: 0,
        updatedProducts: 0,
      },
      errors: ['Failed to process item SPU-1: invalid status'],
    });

    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/products/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [] }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'product.batch_import',
        result: 'failure',
        metadata: expect.objectContaining({ imported: 0, created: 0, updated: 0 }),
      })
    );
  });

  it('replays the original batch import response for the same Idempotency-Key', async () => {
    const storedResponses = new Map();
    mocks.commandBuildFinalizeStatement.mockImplementation((_commandId, responseJson) => ({
      run: vi.fn(async () => {
        storedResponses.set('product-batch-key-1', responseJson);
        return { meta: { changes: 1 } };
      }),
    }));
    mocks.commandReserve.mockImplementation(
      async (_commandType, scopeKey, idempotencyKey, requestFingerprint) => {
        if (idempotencyKey === 'product-batch-key-1' && storedResponses.has(idempotencyKey)) {
          return {
            existing: true,
            ownsReservation: false,
            record: {
              command_id: 'cmd-product-batch-1',
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
            command_id: 'cmd-product-batch-1',
            scope_key: scopeKey,
            idempotency_key: idempotencyKey,
            request_fingerprint: requestFingerprint,
          },
        };
      }
    );

    const app = createApp();
    const request = () =>
      app.request(
        'http://localhost/api/manage/products/batch',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': 'product-batch-key-1',
          },
          body: JSON.stringify({ items: [{ name: 'Batch Tee', variants: [{ sku: 'SKU-1' }] }] }),
        },
        { DB: {} },
        { waitUntil: vi.fn() }
      );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.clone().json());
    expect(mocks.batchImport).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(1);
  });

  it('rejects batch import retries that reuse the same Idempotency-Key with a different payload', async () => {
    mocks.commandReserve.mockResolvedValue({
      existing: true,
      ownsReservation: false,
      record: {
        command_id: 'cmd-product-batch-2',
        scope_key: 'product_batch_import:anonymous',
        idempotency_key: 'product-batch-key-2',
        request_fingerprint: JSON.stringify({
          items: [{ name: 'Batch Tee', variants: [{ sku: 'SKU-1' }] }],
        }),
        response_json: null,
        status: 'in_flight',
      },
    });

    const app = createApp();
    const res = await app.request(
      'http://localhost/api/manage/products/batch',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'product-batch-key-2',
        },
        body: JSON.stringify({ items: [{ name: 'Batch Pants', variants: [{ sku: 'SKU-2' }] }] }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual(
      expect.objectContaining({
        error: '同一个幂等键不能提交不同的批量导入请求',
      })
    );
    expect(mocks.batchImport).not.toHaveBeenCalled();
  });

  it('retries batch-import side effects without rerunning the batch after cache publish failures', async () => {
    const commandState = new Map();
    mocks.commandReserve.mockImplementation(
      async (_commandType, scopeKey, idempotencyKey, requestFingerprint) => {
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
            command_id: 'cmd-product-batch-retry-1',
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
          commandState.set('product-batch-key-retry-1', {
            commandId,
            requestFingerprint:
              commandState.get('product-batch-key-retry-1')?.requestFingerprint ||
              JSON.stringify({ items: [{ name: 'Batch Tee', variants: [{ sku: 'SKU-1' }] }] }),
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

    const app = createApp();
    const request = () =>
      app.request(
        'http://localhost/api/manage/products/batch',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': 'product-batch-key-retry-1',
          },
          body: JSON.stringify({ items: [{ name: 'Batch Tee', variants: [{ sku: 'SKU-1' }] }] }),
        },
        { DB: {} },
        { waitUntil: vi.fn() }
      );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(mocks.batchImport).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
  });

  it('retries batch-import finalize failures without generating duplicate cache events', async () => {
    const commandState = new Map();
    let committedFinalizeAttempts = 0;

    mocks.commandReserve.mockImplementation(
      async (_commandType, scopeKey, idempotencyKey, requestFingerprint) => {
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
            command_id: 'cmd-product-batch-finalize-1',
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
          commandState.set('product-batch-key-finalize-1', {
            commandId,
            requestFingerprint: JSON.stringify({
              items: [{ name: 'Batch Tee', variants: [{ sku: 'SKU-1' }] }],
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

    const app = createApp();
    const request = () =>
      app.request(
        'http://localhost/api/manage/products/batch',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': 'product-batch-key-finalize-1',
          },
          body: JSON.stringify({ items: [{ name: 'Batch Tee', variants: [{ sku: 'SKU-1' }] }] }),
        },
        { DB: {} },
        { waitUntil: vi.fn() }
      );

    const first = await request();
    const second = await request();

    expect(first.status).toBe(500);
    expect(second.status).toBe(200);
    expect(mocks.batchImport).toHaveBeenCalledTimes(1);
    expect(mocks.scheduleProductCacheInvalidation).toHaveBeenCalledTimes(2);
    expect(mocks.scheduleProductCacheInvalidation.mock.calls[0][2]).toEqual(
      expect.objectContaining({
        commandId: 'cmd-product-batch-finalize-1',
        correlationId: 'cmd-product-batch-finalize-1',
      })
    );
    expect(mocks.scheduleProductCacheInvalidation.mock.calls[1][2]).toEqual(
      expect.objectContaining({
        commandId: 'cmd-product-batch-finalize-1',
        correlationId: 'cmd-product-batch-finalize-1',
      })
    );
  });
});
