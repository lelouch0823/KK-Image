import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  batchImport: vi.fn(),
  scheduleAuditEvent: vi.fn(),
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

import batchApp from '../batch.js';

describe('manage products batch route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.batchImport.mockResolvedValue({ success: true, imported: 3, created: 2, updated: 1 });
  });

  it('audits product batch import summary', async () => {
    const app = new Hono();
    app.route('/api/manage/products/batch', batchApp);

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
        metadata: { imported: 3, created: 2, updated: 1 },
      })
    );
  });
});
