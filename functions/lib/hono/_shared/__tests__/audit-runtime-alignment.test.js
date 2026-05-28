// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { createAuditRuntimeHarness, expectDeclaredRouteToMatchRuntimeEvent } from './audit-runtime-test-utils.js';

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('audit runtime alignment', () => {
  it('matches manage backup create runtime event to its declaration', async () => {
    vi.doMock('../../middleware/auth.js', () => ({
      requirePermission: () => async (_c, next) => next(),
    }));
    vi.doMock('../../../../api/utils/backup-utils.js', () => ({
      performStreamingBackup: vi.fn(async () => ({ filename: 'backup-1.zip', key: 'backup-1.zip' })),
    }));

    const mod = await import('../../routes/manage/backups.js');
    const route = mod.default;
    const declaration = mod.auditRouteDeclarations.find((item) => item.method === 'POST' && item.path === '/');
    const harness = createAuditRuntimeHarness();
    const app = new Hono();
    app.route('/api/manage/backups', route);

    const res = await app.request(
      'http://localhost/api/manage/backups',
      { method: 'POST' },
      { ...harness.env, R2_BACKUP_BUCKET: {} },
      harness.executionCtx
    );

    expect(res.status).toBe(200);
    await harness.flush();
    expectDeclaredRouteToMatchRuntimeEvent(declaration, harness.getLastEvent(), { result: 'success' });
  });

  it('matches manage order create runtime event to its declaration', async () => {
    vi.doMock('../../routes/manage/orders/create-order.js', () => ({
      createManagedOrder: vi.fn(async () => ({ id: 'order-1', orderNo: 'SO-1' })),
      publishOrderCreatedByAdmin: vi.fn(async () => undefined),
    }));
    const mod = await import('../../routes/manage/orders/create.js');
    const declaration = mod.auditRouteDeclarations.find((item) => item.method === 'POST' && item.path === '/');
    const harness = createAuditRuntimeHarness();
    const app = new Hono();
    app.use('/api/manage/orders/*', async (c, next) => {
      c.set('user', { id: 'admin-1', name: 'Admin', role: 'admin', type: 'admin' });
      await next();
    });
    app.route('/api/manage/orders', mod.default);

    const res = await app.request(
      'http://localhost/api/manage/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salespersonId: 'sales-1', productName: 'Test Product' }),
      },
      harness.env,
      harness.executionCtx
    );

    expect(res.status).toBe(201);
    await harness.flush();
    expectDeclaredRouteToMatchRuntimeEvent(declaration, harness.getLastEvent(), { result: 'success' });
  });

  it('matches sales file upload runtime event to its declaration', async () => {
    vi.doMock('../../../../api/utils/file-utils.js', () => ({
      storeFile: vi.fn(async () => ({ id: 'file-1', name: 'proof.png', instantUpload: false })),
    }));
    vi.doMock('../../../../api/utils/folder-utils.js', () => ({
      ensureOrderFolder: vi.fn(async () => 'folder-order-1'),
    }));

    const mod = await import('../../routes/sales/files.js');
    const declaration = mod.auditRouteDeclarations[0];
    const harness = createAuditRuntimeHarness({
      prepare(sql) {
        if (sql.includes('SELECT order_no FROM orders')) {
          return {
            bind: () => ({
              first: async () => ({ order_no: 'SO-1' }),
            }),
          };
        }
        return harness.createStatement(sql);
      },
    });
    const app = new Hono();
    app.use('/api/sales/:token/*', async (c, next) => {
      c.set('salesperson', { id: 'sales-1', name: 'Alice' });
      await next();
    });
    app.route('/api/sales/:token/files', mod.default);

    const formData = new FormData();
    formData.append('file', new Blob(['img'], { type: 'image/png' }), 'proof.png');
    const res = await app.request(
      'http://localhost/api/sales/token-1/files/upload?orderId=order-1',
      { method: 'POST', body: formData },
      harness.env,
      harness.executionCtx
    );

    expect(res.status).toBe(200);
    await harness.flush();
    expectDeclaredRouteToMatchRuntimeEvent(declaration, harness.getLastEvent(), { result: 'success' });
  }, 15000);

  it('matches v1 webhook create runtime event to its declaration', async () => {
    vi.doMock('../../middleware/auth.js', () => ({
      requirePermission: () => async (c, next) => {
        c.set('user', { id: 'admin-1', name: 'Admin', type: 'admin', role: 'admin' });
        await next();
      },
    }));

    const mod = await import('../../routes/v1/webhooks.js');
    const declaration = mod.auditRouteDeclarations.find((item) => item.method === 'POST' && item.path === '/');
    const harness = createAuditRuntimeHarness({
      randomIds: ['wh_1'],
    });
    const app = new Hono();
    app.route('/api/v1/webhooks', mod.default);

    const res = await app.request(
      'http://localhost/api/v1/webhooks',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/hook' }),
      },
      harness.env,
      harness.executionCtx
    );

    expect(res.status).toBe(201);
    await harness.flush();
    expectDeclaredRouteToMatchRuntimeEvent(declaration, harness.getLastEvent(), { result: 'success' });
  });

  it('matches manage order batch update runtime event to its declaration', async () => {
    vi.doMock('../../routes/manage/orders/authz-helpers.js', () => ({
      assertForceStatusTransitionAllowed: vi.fn(async () => {}),
    }));
    vi.doMock('../../../../../repositories/OrderRepository.js', () => ({
      OrderRepository: vi.fn(() => ({
        batchUpdateStatus: vi.fn(async () => undefined),
      })),
    }));
    vi.doMock('../../../../../api/utils/order-state-machine.js', () => ({
      canTransitionOrderStatus: vi.fn(() => true),
    }));
    vi.doMock('../../routes/manage/orders/error-helpers.js', () => ({
      isInsufficientStockError: vi.fn(() => false),
      isInvalidStatusTransitionError: vi.fn(() => false),
    }));

    const mod = await import('../../routes/manage/orders/create.js');
    const declaration = mod.auditRouteDeclarations.find((item) => item.method === 'POST' && item.path === '/batch');
    const harness = createAuditRuntimeHarness({
      prepare(sql) {
        if (sql.includes('SELECT id, order_no')) {
          return {
            bind: () => ({
              all: async () => ({ results: [{ id: 'order-1', order_no: 'SO-1', salesperson_id: null, status: 'pending' }] }),
            }),
          };
        }
        return harness.createStatement(sql);
      },
    });
    const app = new Hono();
    app.use('/api/manage/orders/*', async (c, next) => {
      c.set('user', { id: 'admin-1', name: 'Admin', role: 'admin', type: 'admin' });
      await next();
    });
    app.route('/api/manage/orders', mod.default);

    const res = await app.request(
      'http://localhost/api/manage/orders/batch',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ['order-1'], action: 'status', value: 'confirmed' }),
      },
      harness.env,
      harness.executionCtx
    );

    expect(res.status).toBe(200);
    await harness.flush();
    expectDeclaredRouteToMatchRuntimeEvent(declaration, harness.getLastEvent(), { result: 'success' });
  });

  it('matches v1 webhook update runtime event to its declaration', async () => {
    vi.doMock('../../middleware/auth.js', () => ({
      requirePermission: () => async (c, next) => {
        c.set('user', { id: 'admin-1', name: 'Admin', type: 'admin', role: 'admin' });
        await next();
      },
    }));

    const mod = await import('../../routes/v1/webhooks.js');
    const declaration = mod.auditRouteDeclarations.find((item) => item.method === 'PUT' && item.path === '/:id');
    const harness = createAuditRuntimeHarness({
      prepare(sql) {
        if (sql.includes('SELECT id FROM webhooks WHERE id = ?')) {
          return {
            bind: () => ({
              first: async () => ({ id: 'wh_1' }),
            }),
          };
        }
        if (sql.includes('SELECT * FROM webhooks WHERE id = ?')) {
          return {
            bind: () => ({
              first: async () => ({
                id: 'wh_1',
                url: 'https://example.com/hook',
                events: JSON.stringify(['webhook.test']),
                secret: null,
                headers: JSON.stringify({}),
                enabled: 1,
                created_by: 'Admin',
                created_at: 1,
                updated_by: 'Admin',
                updated_at: 2,
              }),
            }),
          };
        }
        return harness.createStatement(sql);
      },
    });
    const app = new Hono();
    app.route('/api/v1/webhooks', mod.default);

    const res = await app.request(
      'http://localhost/api/v1/webhooks/wh_1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/hook', enabled: true }),
      },
      harness.env,
      harness.executionCtx
    );

    expect(res.status).toBe(200);
    await harness.flush();
    expectDeclaredRouteToMatchRuntimeEvent(declaration, harness.getLastEvent(), { result: 'success' });
  });

  it('matches audit replay dry-run runtime event to its declaration', async () => {
    vi.doMock('../../middleware/auth.js', () => ({
      requirePermission: () => async (c, next) => {
        c.set('user', { id: 'admin-1', name: 'Admin', type: 'admin', role: 'admin' });
        await next();
      },
    }));
    vi.doMock('../../../../services/OutboxReplayService.js', () => ({
      OutboxReplayService: vi.fn(() => ({
        dryRun: vi.fn(async () => ({ runId: 'replay-1', dryRun: true })),
        executeReplay: vi.fn(async () => ({ runId: 'replay-2', dryRun: false })),
      })),
    }));

    const mod = await import('../../routes/manage/audit-replay.js');
    const declaration = mod.auditRouteDeclarations.find((item) => item.method === 'POST' && item.path === '/dry-run');
    const harness = createAuditRuntimeHarness();
    const app = new Hono();
    app.use('/api/manage/audit-replay/*', async (c, next) => {
      c.set('user', { id: 'admin-1', name: 'Admin', type: 'admin', role: 'admin' });
      await next();
    });
    app.route('/api/manage/audit-replay', mod.default);

    const res = await app.request(
      'http://localhost/api/manage/audit-replay/dry-run',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopeType: 'event', scopeId: 'evt-1', consumerName: 'notification' }),
      },
      harness.env,
      harness.executionCtx
    );

    expect(res.status).toBe(200);
    await harness.flush();
    expectDeclaredRouteToMatchRuntimeEvent(declaration, harness.getLastEvent(), { result: 'success' });
  });

  it('matches purchase order receipt reversal runtime event to its declaration', async () => {
    vi.doMock('../../middleware/auth.js', () => ({
      requirePermission: () => async (c, next) => {
        c.set('user', { id: 'admin-1', name: 'Admin', type: 'admin', role: 'admin' });
        await next();
      },
    }));
    vi.doMock('../../../../services/OrderProcurementReceiptReversalService.js', () => ({
      OrderProcurementReceiptReversalService: vi.fn(() => ({
        reverseReceipt: vi.fn(async () => ({ purchase_order_id: 'po-1', receipt_id: 'receipt-1', reversal_qty: 2 })),
      })),
    }));
    vi.doMock('../../../../repositories/PurchaseOrderRepository.js', () => ({
      PurchaseOrderRepository: vi.fn(() => ({
        findById: vi.fn(async () => ({ id: 'po-1', status: 'ordered', items: [] })),
        addItems: vi.fn(),
        updateItem: vi.fn(),
        removeItem: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        list: vi.fn(async () => ({ items: [], total: 0 })),
        getStats: vi.fn(async () => ({})),
      })),
    }));
    vi.doMock('../../../../services/PurchaseOrderService.js', () => ({
      PurchaseOrderService: vi.fn(() => ({
        updateStatus: vi.fn(async () => ({ success: true })),
        getSuggestions: vi.fn(async () => []),
        createFromOrders: vi.fn(),
        allocateCosts: vi.fn(),
      })),
    }));
    vi.doMock('../../../../services/OrderProcurementDomainService.js', () => ({
      OrderProcurementDomainService: vi.fn(() => ({
        recordPurchaseOrderReceipts: vi.fn(async () => ({ purchase_order_id: 'po-1', receipt_count: 1 })),
      })),
    }));
    vi.doMock('../../middleware/cache.js', () => ({
      withCache: () => async (_c, next) => next(),
    }));
    vi.doMock('../../routes/manage/_shared/cache-urls.js', async () => {
      const actual = await vi.importActual('../../routes/manage/_shared/cache-urls.js');
      return {
        ...actual,
        getPurchaseOrderCacheUrls: vi.fn(() => []),
        getOrderAnalyticsCacheUrls: vi.fn(() => []),
      };
    });

    const mod = await import('../../routes/manage/purchase-orders.js');
    const declaration = mod.auditRouteDeclarations.find((item) => item.method === 'POST' && item.path === '/:id/receipts/:receiptId/reversal');
    const harness = createAuditRuntimeHarness();
    const app = new Hono();
    app.use('/api/manage/purchase-orders/*', async (c, next) => {
      c.set('user', { id: 'admin-1', name: 'Admin', type: 'admin', role: 'admin' });
      await next();
    });
    app.route('/api/manage/purchase-orders', mod.default);

    const res = await app.request(
      'http://localhost/api/manage/purchase-orders/po-1/receipts/receipt-1/reversal',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'rollback' }),
      },
      harness.env,
      harness.executionCtx
    );

    expect(res.status).toBe(201);
    await harness.flush();
    expectDeclaredRouteToMatchRuntimeEvent(declaration, harness.getLastEvent(), { result: 'success' });
  });

  it('matches v1 webhook delete runtime event to its declaration', async () => {
    vi.doMock('../../middleware/auth.js', () => ({
      requirePermission: () => async (c, next) => {
        c.set('user', { id: 'admin-1', name: 'Admin', type: 'admin', role: 'admin' });
        await next();
      },
    }));

    const mod = await import('../../routes/v1/webhooks.js');
    const declaration = mod.auditRouteDeclarations.find((item) => item.method === 'DELETE' && item.path === '/:id');
    const harness = createAuditRuntimeHarness({
      prepare(sql) {
        if (sql.includes('SELECT id FROM webhooks WHERE id = ?')) {
          return {
            bind: () => ({
              first: async () => ({ id: 'wh_1' }),
            }),
          };
        }
        return harness.createStatement(sql);
      },
    });
    const app = new Hono();
    app.route('/api/v1/webhooks', mod.default);

    const res = await app.request(
      'http://localhost/api/v1/webhooks/wh_1',
      { method: 'DELETE' },
      harness.env,
      harness.executionCtx
    );

    expect(res.status).toBe(200);
    await harness.flush();
    expectDeclaredRouteToMatchRuntimeEvent(declaration, harness.getLastEvent(), { result: 'success' });
  });

  it('records denied write attempts through requirePermission runtime path', async () => {
    vi.doUnmock('../../middleware/auth.js');
    const { requirePermission } = await import('../../middleware/auth.js');
    const harness = createAuditRuntimeHarness();
    const app = new Hono();
    app.post('/api/manage/secure', requirePermission('files:write'), (c) => c.json({ success: true }));

    const res = await app.request(
      'http://localhost/api/manage/secure',
      { method: 'POST' },
      harness.env,
      harness.executionCtx
    );

    expect(res.status).toBe(401);
    await harness.flush();
    const event = harness.getLastEvent();
    expect(event.result).toBe('denied');
    expect(event.action).toBe('secure.post.unauthorized');
  });

  it('records failed write attempts through the global error handler runtime path', async () => {
    const { errorHandler } = await import('../../middleware/errorHandler.js');
    const harness = createAuditRuntimeHarness();
    const app = new Hono();
    app.onError(errorHandler);
    app.post('/api/manage/failing', () => {
      throw new Error('boom');
    });

    const res = await app.request(
      'http://localhost/api/manage/failing',
      { method: 'POST' },
      harness.env,
      harness.executionCtx
    );

    expect(res.status).toBe(500);
    await harness.flush();
    const event = harness.getLastEvent();
    expect(event.result).toBe('failed');
    expect(event.action).toBe('failing.post.failed');
  });

  it('matches sales order create runtime event to its declaration', async () => {
    vi.doMock('../../../../../repositories/OrderRepository.js', () => ({
      OrderRepository: vi.fn(() => ({
        create: vi.fn(async () => undefined),
      })),
    }));
    vi.doMock('../../../../../api/utils/validation.js', () => ({
      validateProductVariantBinding: vi.fn(async () => ({ normalizedVariantId: null })),
    }));
    vi.doMock('../../../../../services/DemandService.js', () => ({
      DemandService: vi.fn(() => ({
        syncOrderTransition: vi.fn(async () => undefined),
      })),
    }));
    vi.doMock('../../../../../api/utils/folder-utils.js', () => ({
      ensureOrderFolder: vi.fn(async () => 'folder-order-1'),
      moveFilesToFolder: vi.fn(async () => undefined),
    }));
    vi.doMock('../../../../_shared/utils.js', async () => {
      const actual = await vi.importActual('../../../../_shared/utils.js');
      return {
        ...actual,
        generateId: vi.fn(() => 'order-1'),
        generateOrderNo: vi.fn(() => 'SO-1'),
      };
    });

    const mod = await import('../../routes/sales/orders.js');
    const declaration = mod.auditRouteDeclarations.find((item) => item.method === 'POST' && item.path === '/');
    const harness = createAuditRuntimeHarness();
    const app = new Hono();
    app.use('/api/sales/:token/orders/*', async (c, next) => {
      c.set('salesperson', { id: 'sales-1', name: 'Alice' });
      await next();
    });
    app.route('/api/sales/:token/orders', mod.default);

    const res = await app.request(
      'http://localhost/api/sales/token-1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Product', quantity: 1, fileIds: [], productId: null, variantId: null }),
      },
      harness.env,
      harness.executionCtx
    );

    expect(res.status).toBe(201);
    await harness.flush();
    expectDeclaredRouteToMatchRuntimeEvent(declaration, harness.getLastEvent(), { result: 'success' });
  });
});
