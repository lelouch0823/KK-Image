import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  createSubspace: vi.fn(),
  invalidateSpaceCaches: vi.fn(),
  scheduleAuditEvent: vi.fn(),
}));

vi.mock('../../../../../../repositories/SpaceRepository.js', () => ({
  SpaceRepository: vi.fn(() => ({
    findById: mocks.findById,
    findSubspaces: vi.fn(async () => []),
    createSubspace: mocks.createSubspace,
  })),
}));

vi.mock('../../../../middleware/auth.js', () => ({
  requirePermission: () => async (_c, next) => next(),
}));

vi.mock('../../../../middleware/cache.js', () => ({
  withCache: () => async (_c, next) => next(),
}));

vi.mock('../cache-helpers.js', () => ({
  invalidateSpaceCaches: mocks.invalidateSpaceCaches,
}));

vi.mock('../../../../_shared/utils.js', () => ({
  generateId: vi.fn(() => 'space-child-1'),
  generateShareToken: vi.fn(() => 'share-space'),
  getShareUrl: vi.fn(() => 'https://share/space'),
}));

vi.mock('../../../../_shared/audit-helpers.js', async () => {
  const actual = await vi.importActual('../../../../_shared/audit-helpers.js');
  return {
    ...actual,
    scheduleAuditEvent: mocks.scheduleAuditEvent,
  };
});

import subspacesApp from '../subspaces.js';

describe('manage subspaces routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findById.mockResolvedValue({ id: 'space-parent-1', product_id: 'product-1' });
    mocks.createSubspace.mockResolvedValue(undefined);
    mocks.invalidateSpaceCaches.mockImplementation(() => {});
  });

  it('audits subspace creation with parent metadata', async () => {
    const app = new Hono();
    app.route('/api/manage/spaces/:id/subspaces', subspacesApp);

    const res = await app.request(
      'http://localhost/api/manage/spaces/space-parent-1/subspaces',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ' Child Space ', description: ' desc ', templateData: {} }),
      },
      { DB: {} },
      { waitUntil: vi.fn() }
    );

    expect(res.status).toBe(201);
    expect(mocks.scheduleAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'space.subspace.create',
        targetId: 'space-child-1',
        target_label: 'Child Space',
        metadata: { parentId: 'space-parent-1' },
      })
    );
  });
});
