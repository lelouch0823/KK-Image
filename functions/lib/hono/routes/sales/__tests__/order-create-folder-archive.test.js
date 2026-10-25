import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  orderCreate: vi.fn(),
  orderListBySalesperson: vi.fn(),
  orderFindByIdAndSalesperson: vi.fn(),
  orderGetFiles: vi.fn(),
  orderMarkAsRead: vi.fn(),
  orderUpdateStatus: vi.fn(),
  orderSetUnread: vi.fn(),
  validateProductVariantBinding: vi.fn(),
  invalidateCache: vi.fn(async () => {}),
  ensureOrderFolder: vi.fn(),
  moveFilesToFolder: vi.fn(),
  scheduleAuditEvent: vi.fn(),
  publish: vi.fn(async () => []),
  runOutboxPoller: vi.fn(async () => ({ claimed: 0, published: 0, failed: 0 })),
}));

vi.mock('../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => await next(),
  invalidateCache: mocks.invalidateCache,
}));

vi.mock('../../../../../repositories/OrderRepository.js', () => ({
  OrderRepository: vi.fn(() => ({
    create: mocks.orderCreate,
    listBySalesperson: mocks.orderListBySalesperson,
    findByIdAndSalesperson: mocks.orderFindByIdAndSalesperson,
    getFiles: mocks.orderGetFiles,
    markAsRead: mocks.orderMarkAsRead,
    updateStatus: mocks.orderUpdateStatus,
    setUnread: mocks.orderSetUnread,
  })),
}));

vi.mock('../../../../../api/utils/validation.js', () => ({
  validateProductVariantBinding: mocks.validateProductVariantBinding,
}));

vi.mock('../../../../../api/utils/folder-utils.js', () => ({
  ensureOrderFolder: mocks.ensureOrderFolder,
  moveFilesToFolder: mocks.moveFilesToFolder,
}));

vi.mock('../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

vi.mock('../../../../../services/DomainOutboxPublisher.js', () => ({
  DomainOutboxPublisher: vi.fn(() => ({
    publish: mocks.publish,
  })),
}));

vi.mock('../../../../../api/cron/outbox.js', () => ({
  runOutboxPoller: mocks.runOutboxPoller,
}));

import ordersApp from '../orders.js';

function createApp() {
  const app = new Hono();
  app.use('/api/sales/:token/orders/*', async (c, next) => {
    c.set('salesperson', { id: 'sales-1', name: 'Alice' });
    await next();
  });
  app.route('/api/sales/:token/orders', ordersApp);
  return app;
}

describe('sales order create route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orderCreate.mockResolvedValue({ id: 'order-1' });
    mocks.validateProductVariantBinding.mockResolvedValue({ normalizedVariantId: null });
    mocks.ensureOrderFolder.mockResolvedValue('folder-order-1');
    mocks.moveFilesToFolder.mockResolvedValue(undefined);
  });

  it('archives uploaded files into order folder after creating order', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Sample Product',
          quantity: 1,
          fileIds: ['file-1', 'file-2'],
        }),
      },
      {
        DB: {
          prepare: () => ({
            bind: () => ({
              // C-R6：archiveFiles 分拣查询——两个文件都在暂存区（root），
              // 全部可搬移
              all: async () => ({
                results: [
                  { id: 'file-1', folder_id: 'root' },
                  { id: 'file-2', folder_id: null },
                ],
              }),
              first: async () => null,
              run: async () => ({ meta: { changes: 1 } }),
            }),
            all: async () => ({ results: [] }),
            first: async () => null,
            run: async () => ({ meta: { changes: 1 } }),
          }),
          batch: async () => [],
        },
      },
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
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'sales.order.create', domain: 'sales-orders' })
    );
  });

  it('keeps files with existing folder ownership in place (C-R6/C-F4)', async () => {
    const app = createApp();
    const res = await app.request(
      'http://localhost/api/sales/token-1/orders',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Sample Product',
          quantity: 1,
          fileIds: ['file-owned'],
        }),
      },
      {
        DB: {
          prepare: () => ({
            bind: () => ({
              // file-owned 属于商品目录（非暂存区）——不得被 MOVE 进订单目录
              all: async () => ({ results: [{ id: 'file-owned', folder_id: 'folder-product-1' }] }),
              first: async () => null,
              run: async () => ({ meta: { changes: 1 } }),
            }),
            all: async () => ({ results: [] }),
            first: async () => null,
            run: async () => ({ meta: { changes: 1 } }),
          }),
          batch: async () => [],
        },
      },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.moveFilesToFolder).not.toHaveBeenCalled();
  });
});
