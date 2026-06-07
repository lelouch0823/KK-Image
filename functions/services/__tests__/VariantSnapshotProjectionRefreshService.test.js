import { describe, expect, it, vi } from 'vitest';

import { VariantSnapshotProjectionRefreshService } from '../VariantSnapshotProjectionRefreshService.js';

describe('VariantSnapshotProjectionRefreshService', () => {
  it('rebuilds the projection using delete then insert', async () => {
    const deleteRun = vi.fn(async () => ({ success: true }));
    const insertRun = vi.fn(async () => ({ success: true }));
    const db = {
      prepare: vi
        .fn()
        .mockReturnValueOnce({
          run: deleteRun,
        })
        .mockReturnValueOnce({
          bind: vi.fn(() => ({
            run: insertRun,
          })),
        }),
    };
    const service = new VariantSnapshotProjectionRefreshService(db, {
      now: () => 1710000001234,
    });

    await service.refreshAll();

    expect(db.prepare.mock.calls[0][0]).toContain('DELETE FROM variant_snapshot_projection');
    expect(db.prepare.mock.calls[1][0]).toContain('INSERT INTO variant_snapshot_projection');
    expect(insertRun).toHaveBeenCalledTimes(1);
  });

  it('refreshes only the targeted variant ids when asked for precise refresh', async () => {
    const deleteRun = vi.fn(async () => ({ success: true }));
    const insertRun = vi.fn(async () => ({ success: true }));
    const db = {
      prepare: vi
        .fn()
        .mockReturnValueOnce({
          bind: vi.fn(() => ({
            run: deleteRun,
          })),
        })
        .mockReturnValueOnce({
          bind: vi.fn(() => ({
            run: insertRun,
          })),
        }),
    };
    const service = new VariantSnapshotProjectionRefreshService(db, {
      now: () => 1710000001234,
    });

    await service.refreshByVariantIds(['var-1', 'var-2', 'var-1']);

    expect(db.prepare.mock.calls[0][0]).toContain('DELETE FROM variant_snapshot_projection');
    expect(db.prepare.mock.calls[1][0]).toContain('ol.variant_id IN (?,?)');
    expect(deleteRun).toHaveBeenCalledTimes(1);
    expect(insertRun).toHaveBeenCalledTimes(1);
  });

  it('derives affected variants from order_lines before running a targeted refresh', async () => {
    const orderVariantAll = vi.fn(async () => ({
      results: [{ variant_id: 'var-1' }, { variant_id: 'var-2' }],
    }));
    const deleteRun = vi.fn(async () => ({ success: true }));
    const insertRun = vi.fn(async () => ({ success: true }));
    const db = {
      prepare: vi
        .fn()
        .mockReturnValueOnce({
          bind: vi.fn(() => ({
            all: orderVariantAll,
          })),
        })
        .mockReturnValueOnce({
          bind: vi.fn(() => ({
            run: deleteRun,
          })),
        })
        .mockReturnValueOnce({
          bind: vi.fn(() => ({
            run: insertRun,
          })),
        }),
    };
    const service = new VariantSnapshotProjectionRefreshService(db, {
      now: () => 1710000001234,
    });

    await service.refreshByOrderId('order-1');

    expect(db.prepare.mock.calls[0][0]).toContain('SELECT DISTINCT variant_id');
    expect(orderVariantAll).toHaveBeenCalledTimes(1);
    expect(deleteRun).toHaveBeenCalledTimes(1);
    expect(insertRun).toHaveBeenCalledTimes(1);
  });
});
