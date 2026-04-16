import { describe, expect, it, vi } from 'vitest';
import {
  acquireProcurementResourceLocks,
  releaseProcurementResourceLocks,
} from '../order-procurement-resource-locks.js';

function createCommandIdempotencyRepo({
  insertResults = [],
} = {}) {
  const calls = {
    insertRecords: [],
    deletedCommandIds: [],
  };

  const repo = {
    buildInsertStatement: vi.fn((record) => {
      calls.insertRecords.push(record);
      return {
        run: vi.fn(async () => insertResults.shift() || { meta: { changes: 1 } }),
      };
    }),
    buildDeleteStatement: vi.fn((commandId) => ({
      run: vi.fn(async () => {
        calls.deletedCommandIds.push(commandId);
        return { meta: { changes: 1 } };
      }),
    })),
  };

  return { repo, calls };
}

describe('order procurement resource locks', () => {
  it('acquires purchase order item resource locks with a stable lock shape', async () => {
    const harness = createCommandIdempotencyRepo();

    const lockRecords = await acquireProcurementResourceLocks({
      commandIdempotencyRepo: harness.repo,
      resourceType: 'purchase_order_item',
      resourceIds: ['poi-2', 'poi-1', 'poi-2'],
      timestamp: 1710000000000,
      commandId: 'cmd-1',
      uuid: () => 'lock-row-1',
    });

    expect(lockRecords).toHaveLength(2);
    expect(harness.calls.insertRecords).toEqual([
      expect.objectContaining({
        id: 'lock-row-1',
        command_type: 'purchase_receipt_item_lock',
        scope_key: 'poi-1',
        idempotency_key: '__resource_lock__',
        command_id: 'cmd-1:purchase_order_item-lock:1',
      }),
      expect.objectContaining({
        id: 'lock-row-1',
        command_type: 'purchase_receipt_item_lock',
        scope_key: 'poi-2',
        idempotency_key: '__resource_lock__',
        command_id: 'cmd-1:purchase_order_item-lock:2',
      }),
    ]);
  });

  it('acquires receipt resource locks and releases them explicitly', async () => {
    const harness = createCommandIdempotencyRepo();

    const lockRecords = await acquireProcurementResourceLocks({
      commandIdempotencyRepo: harness.repo,
      resourceType: 'receipt',
      resourceIds: ['receipt-1'],
      timestamp: 1710000000000,
      commandId: 'cmd-2',
      uuid: () => 'lock-row-2',
    });

    await releaseProcurementResourceLocks({
      commandIdempotencyRepo: harness.repo,
      lockRecords,
    });

    expect(harness.calls.insertRecords).toEqual([
      expect.objectContaining({
        command_type: 'purchase_receipt_reversal_lock',
        scope_key: 'receipt-1',
        command_id: 'cmd-2:receipt-lock:1',
      }),
    ]);
    expect(harness.calls.deletedCommandIds).toEqual(['cmd-2:receipt-lock:1']);
  });

  it('releases already acquired locks when a later resource lock collides', async () => {
    const harness = createCommandIdempotencyRepo({
      insertResults: [{ meta: { changes: 1 } }, { meta: { changes: 0 } }],
    });

    await expect(
      acquireProcurementResourceLocks({
        commandIdempotencyRepo: harness.repo,
        resourceType: 'purchase_order_item',
        resourceIds: ['poi-1', 'poi-2'],
        timestamp: 1710000000000,
        commandId: 'cmd-3',
        uuid: () => 'lock-row-3',
      })
    ).rejects.toThrow(/刷新后重试/);

    expect(harness.calls.deletedCommandIds).toEqual(['cmd-3:purchase_order_item-lock:1']);
  });
});
