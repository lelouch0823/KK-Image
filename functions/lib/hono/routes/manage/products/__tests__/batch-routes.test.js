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
    mocks.batchImport.mockResolvedValue({
      success: true,
      count: 3,
      summary: {
        createdProducts: 2,
        updatedProducts: 1,
      },
    });
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
        result: 'failure',
        metadata: expect.objectContaining({ imported: 0, created: 0, updated: 0 }),
      })
    );
  });
});
