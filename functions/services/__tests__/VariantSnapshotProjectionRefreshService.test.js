import { describe, expect, it, vi } from 'vitest';

import { VariantSnapshotProjectionRefreshService } from '../VariantSnapshotProjectionRefreshService.js';

/**
 * 构建可执行语句：bind(...) 返回带 run/all 的语句对象，
 * batch 收集语句供断言（模拟 D1 batch 原子执行一组语句）
 */
function createStatement(sql, { runSpy, allSpy } = {}) {
  const statement = {
    sql,
    params: [],
    bind: vi.fn((...params) => {
      statement.params = params;
      return statement;
    }),
    run: runSpy || vi.fn(async () => ({ success: true })),
    all: allSpy || vi.fn(async () => ({ results: [] })),
  };
  return statement;
}

function createBatchDb() {
  const db = {
    prepare: vi.fn((sql) => createStatement(sql)),
    batch: vi.fn(async (statements = []) => statements.map(() => ({ meta: { changes: 1 } })),
    ),
  };
  return db;
}

describe('VariantSnapshotProjectionRefreshService', () => {
  it('rebuilds the projection with delete and insert in one atomic batch', async () => {
    const db = createBatchDb();
    const service = new VariantSnapshotProjectionRefreshService(db, {
      now: () => 1710000001234,
    });

    await service.refreshAll();

    // DELETE 与 INSERT 必须在同一 batch 内：分开执行会让并发读者看到空投影
    expect(db.batch).toHaveBeenCalledTimes(1);
    const statements = db.batch.mock.calls[0][0];
    expect(statements).toHaveLength(2);
    expect(statements[0].sql).toContain('DELETE FROM variant_snapshot_projection');
    expect(statements[1].sql).toContain('INSERT INTO variant_snapshot_projection');
    expect(statements[1].params).toEqual([1710000001234]);
  });

  it('refreshes only the targeted variant ids when asked for precise refresh', async () => {
    const db = createBatchDb();
    const service = new VariantSnapshotProjectionRefreshService(db, {
      now: () => 1710000001234,
    });

    await service.refreshByVariantIds(['var-1', 'var-2', 'var-1']);

    expect(db.batch).toHaveBeenCalledTimes(1);
    const statements = db.batch.mock.calls[0][0];
    expect(statements).toHaveLength(2);
    expect(statements[0].sql).toContain('DELETE FROM variant_snapshot_projection');
    expect(statements[0].params).toEqual(['var-1', 'var-2']);
    expect(statements[1].sql).toContain('ol.variant_id IN (?,?)');
    expect(statements[1].params).toEqual([1710000001234, 'var-1', 'var-2']);
  });

  it('derives affected variants from order_lines before running a targeted refresh', async () => {
    const orderVariantAll = vi.fn(async () => ({
      results: [{ variant_id: 'var-1' }, { variant_id: 'var-2' }],
    }));
    const db = createBatchDb();
    db.prepare.mockImplementation((sql) => {
      const statement = createStatement(sql);
      if (sql.includes('SELECT DISTINCT variant_id')) {
        statement.all = orderVariantAll;
      }
      return statement;
    });
    const service = new VariantSnapshotProjectionRefreshService(db, {
      now: () => 1710000001234,
    });

    await service.refreshByOrderId('order-1');

    expect(db.prepare.mock.calls[0][0]).toContain('SELECT DISTINCT variant_id');
    expect(orderVariantAll).toHaveBeenCalledTimes(1);
    expect(db.batch).toHaveBeenCalledTimes(1);
    const statements = db.batch.mock.calls[0][0];
    expect(statements).toHaveLength(2);
    expect(statements[0].sql).toContain('DELETE FROM variant_snapshot_projection');
    expect(statements[0].params).toEqual(['var-1', 'var-2']);
    expect(statements[1].sql).toContain('INSERT INTO variant_snapshot_projection');
  });
});
