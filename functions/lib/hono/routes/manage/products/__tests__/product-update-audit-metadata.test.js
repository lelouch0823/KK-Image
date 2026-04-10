import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mockPatchProduct = vi.fn();
const mockPutProduct = vi.fn();
const mockScheduleAuditEvent = vi.fn();

vi.mock('../../../../../../services/ProductCatalogService.js', () => ({
  ProductCatalogService: class {
    patchProduct(...args) { return mockPatchProduct(...args); }
    putProduct(...args) { return mockPutProduct(...args); }
  },
}));

vi.mock('../../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: (...args) => mockScheduleAuditEvent(...args),
  };
});

import productByIdApp from '../[id].js';

function createApp() {
  const app = new Hono();
  app.onError((err, c) => c.json({ success: false, error: err.message }, err.statusCode || 500));
  app.use('/api/manage/products/*', async (c, next) => {
    c.set('user', { id: 'u-manager', type: 'user', role: 'manager', permissions: [] });
    await next();
  });
  app.route('/api/manage/products', productByIdApp);
  return app;
}

describe('product update audit metadata routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPatchProduct.mockResolvedValue({ changes: 2, variantSync: undefined });
    mockPutProduct.mockResolvedValue({ changes: 3, variantSync: undefined });
  });

  it('PATCH /:id writes numeric changeCount into audit metadata', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Tee' }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mockScheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'product.update',
        metadata: { changeCount: 2 },
      })
    );
  });

  it('PUT /:id writes numeric changeCount into audit metadata', async () => {
    const app = createApp();

    const res = await app.request(
      'http://localhost/api/manage/products/p1',
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Tee' }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(200);
    expect(mockScheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'product.replace',
        metadata: { changeCount: 3 },
      })
    );
  });
});
