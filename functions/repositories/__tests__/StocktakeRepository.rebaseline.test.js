import { describe, expect, it, vi } from 'vitest';
import { StocktakeRepository } from '../StocktakeRepository.js';

/**
 * 盘点调整重基线 + 并发守卫（审查发现 1 / 4 / 17）
 *
 * R1：过账差额以"过账时点的当前 on_hand"重基线，而非创建时快照——
 *     快照到实盘之间的销售/入库会让旧差额双算。每项语句组带基线 CAS
 *     守卫 + changes 断言，基线漂移整块回滚并提示重试。
 * R4：调整认领活跃期间 cancel/updateItems 被拒绝；已调整项拒绝修改。
 * R15.3：盘点单创建语句数超 D1 batch 上限时直接拒绝（避免跨块非原子）。
 */

function buildDb({
  pendingItems = [],
  baselines = {},
  status = 'counting',
  adjustingAt = null,
  guardHits = 1,
  failOnBatch = null,
  itemAdjustedIds = [],
} = {}) {
  const calls = { batches: [], runs: [] };
  const db = {
    prepare: vi.fn((sql) => {
      const statement = {
        sql,
        params: [],
        bind: vi.fn(function bindStatement(...params) {
          statement.params = params;
          return statement;
        }),
        async run() {
          calls.runs.push({ sql, params: statement.params });
          if (sql.includes('SET adjusting_at = ?')) {
            return { meta: { changes: 1 } };
          }
          if (sql.includes("SET status = 'adjusted'")) {
            return { meta: { changes: 1 } };
          }
          if (sql.includes("SET status = 'cancelled'")) {
            return {
              meta: { changes: sql.includes('adjusting_at IS NULL') && adjustingAt ? 0 : 1 },
            };
          }
          return { meta: { changes: 1 } };
        },
        async all() {
          if (sql.includes('FROM stocktake_items si')) {
            return { results: pendingItems };
          }
          if (sql.includes('FROM inventory_balances')) {
            const ids = statement.params || [];
            return {
              results: ids
                .map((variantId) => ({
                  variant_id: variantId,
                  on_hand: baselines[variantId] ?? 0,
                }))
                .filter((row) => baselines[row.variant_id] !== undefined),
            };
          }
          if (sql.includes('adjusted_at IS NOT NULL')) {
            const ids = (statement.params || []).slice(0, -1);
            return { results: ids.filter((id) => itemAdjustedIds.includes(id)).map((id) => ({ id })) };
          }
          return { results: [] };
        },
        async first() {
          if (sql.includes('SELECT status FROM stocktakes')) {
            return { status };
          }
          if (sql.includes('SELECT status, adjusting_at FROM stocktakes')) {
            return { status, adjusting_at: adjustingAt };
          }
          return null;
        },
      };
      return statement;
    }),
    batch: vi.fn(async (statements) => {
      if (failOnBatch && calls.batches.length === failOnBatch.index) {
        calls.batches.push(statements.map((s) => ({ sql: s.sql, params: s.params })));
        throw new Error(failOnBatch.error);
      }
      calls.batches.push(statements.map((s) => ({ sql: s.sql, params: s.params })));
      // 模拟 changes() 断言：SQL 中带 guard_ok 的断言语句按 guardHits 决定
      // 前一条是否命中（0 → 断言抛 malformed JSON，batch 回滚）
      return statements.map((s) => {
        if (s.sql.includes('guard_ok')) {
          if (guardHits === 0) {
            throw new Error('D1_ERROR: malformed json');
          }
          return { meta: { changes: 1 } };
        }
        return { meta: { changes: 1 } };
      });
    }),
  };
  return { db, calls };
}

function buildInventoryServiceStub() {
  return {
    buildMutationStatements: vi.fn(async (mutation) => ({
      statements: [
        {
          sql: 'UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?',
          params: [mutation.quantityDelta, mutation.variantId],
        },
        {
          sql: 'INSERT INTO inventory_ledger ...',
          params: [mutation.type, mutation.quantityDelta],
        },
      ],
    })),
    refreshProjections: vi.fn(async () => []),
  };
}

describe('StocktakeRepository.adjustInventory rebaselining (R1)', () => {
  it('computes delta from current on_hand, not the creation snapshot', async () => {
    // 快照 10、实盘 8：若销售使当前 on_hand=8，重基线差额 0 → 不再过账
    const pendingItems = [
      { item_id: 'si-1', variant_id: 'var-1', system_qty: 10, actual_qty: 8, difference: -2 },
    ];
    const { db, calls } = buildDb({ pendingItems, baselines: { 'var-1': 8 } });
    const inventoryService = buildInventoryServiceStub();
    const repo = new StocktakeRepository(db, { InventoryServiceFactory: () => inventoryService });

    const result = await repo.adjustInventory('st-1');

    expect(result).toEqual({ adjustedCount: 1, totalDelta: 0 });
    expect(inventoryService.buildMutationStatements).not.toHaveBeenCalled();
    // 仅标记语句，无库存写入
    expect(calls.batches[0]).toHaveLength(1);
    expect(calls.batches[0][0].sql).toContain('UPDATE stocktake_items SET adjusted_at');
  });

  it('posts rebased delta and records baseline in ledger metadata', async () => {
    // 快照 10、实盘 12、当前 on_hand=11 → 过账 +1（旧口径会过 +2）
    const pendingItems = [
      { item_id: 'si-1', variant_id: 'var-1', system_qty: 10, actual_qty: 12, difference: 2 },
    ];
    const { db } = buildDb({ pendingItems, baselines: { 'var-1': 11 } });
    const inventoryService = buildInventoryServiceStub();
    const repo = new StocktakeRepository(db, { InventoryServiceFactory: () => inventoryService });

    const result = await repo.adjustInventory('st-1');

    expect(result).toEqual({ adjustedCount: 1, totalDelta: 1 });
    const mutation = inventoryService.buildMutationStatements.mock.calls[0][0];
    expect(mutation.quantityDelta).toBe(1);
    expect(mutation.metadata).toEqual({
      source: 'stocktake',
      stocktakeId: 'st-1',
      baseline_on_hand: 11,
      snapshot_system_qty: 10,
    });
  });

  it('guards each item with a baseline CAS + changes assertion in the same batch', async () => {
    const pendingItems = [
      { item_id: 'si-1', variant_id: 'var-1', system_qty: 5, actual_qty: 3, difference: -2 },
    ];
    const { db, calls } = buildDb({ pendingItems, baselines: { 'var-1': 5 } });
    const inventoryService = buildInventoryServiceStub();
    const repo = new StocktakeRepository(db, { InventoryServiceFactory: () => inventoryService });

    await repo.adjustInventory('st-1');

    const group = calls.batches[0];
    // 语句组顺序：基线 CAS 守卫 → 断言 → 库存写入 → adjusted_at 标记
    expect(group[0].sql).toContain(
      'UPDATE inventory_balances SET updated_at = updated_at WHERE variant_id = ? AND on_hand = ?'
    );
    expect(group[0].params).toEqual(['var-1', 5]);
    expect(group[1].sql).toContain('guard_ok');
    expect(group[group.length - 1].sql).toContain('UPDATE stocktake_items SET adjusted_at');
    // 标记回写过账基线与重算差额
    const marker = group[group.length - 1];
    expect(marker.sql).toContain('system_qty = ?');
    expect(marker.params[1]).toBe(5);
    expect(marker.params[2]).toBe(-2);
  });

  it('skips the baseline guard when no balance row exists (upsert creates from zero)', async () => {
    const pendingItems = [
      { item_id: 'si-1', variant_id: 'var-1', system_qty: 0, actual_qty: 4, difference: 4 },
    ];
    const { db, calls } = buildDb({ pendingItems, baselines: {} });
    const inventoryService = buildInventoryServiceStub();
    const repo = new StocktakeRepository(db, { InventoryServiceFactory: () => inventoryService });

    const result = await repo.adjustInventory('st-1');

    expect(result).toEqual({ adjustedCount: 1, totalDelta: 4 });
    const group = calls.batches[0];
    expect(group[0].sql).not.toContain('inventory_balances');
    expect(group[0].sql).not.toContain('guard_ok');
    expect(group[0].sql).toContain('UPDATE product_variants');
  });

  it('rolls back the chunk and asks for retry when the baseline drifted mid-adjust', async () => {
    const pendingItems = [
      { item_id: 'si-1', variant_id: 'var-1', system_qty: 5, actual_qty: 3, difference: -2 },
    ];
    const { db } = buildDb({
      pendingItems,
      baselines: { 'var-1': 5 },
      guardHits: 0,
    });
    const inventoryService = buildInventoryServiceStub();
    const repo = new StocktakeRepository(db, { InventoryServiceFactory: () => inventoryService });

    await expect(repo.adjustInventory('st-1')).rejects.toThrow(/库存已变动，请重试/);
    // 释放认领，允许重试重基线
  });
});

describe('StocktakeRepository concurrency guards (R4)', () => {
  it('updateItems rejects while an adjust claim is active', async () => {
    const { db } = buildDb({
      status: 'counting',
      adjustingAt: Date.now() - 1000, // 活跃认领
    });
    const repo = new StocktakeRepository(db);

    await expect(
      repo.updateItems('st-1', [{ itemId: 'si-1', actualQty: 5 }])
    ).rejects.toThrow('盘点调整正在执行中，无法修改明细');
  });

  it('updateItems allows editing when the adjust claim is stale (crashed holder)', async () => {
    const { db } = buildDb({
      status: 'counting',
      adjustingAt: Date.now() - 11 * 60 * 1000, // 超时认领
      pendingItems: [],
    });
    const repo = new StocktakeRepository(db);

    await expect(
      repo.updateItems('st-1', [{ itemId: 'si-1', actualQty: 5 }])
    ).resolves.toBe(0);
  });

  it('updateItems rejects items already marked adjusted and lists them', async () => {
    const { db } = buildDb({
      status: 'counting',
      adjustingAt: null,
      itemAdjustedIds: ['si-2'],
    });
    const repo = new StocktakeRepository(db);

    await expect(
      repo.updateItems('st-1', [
        { itemId: 'si-1', actualQty: 5 },
        { itemId: 'si-2', actualQty: 6 },
      ])
    ).rejects.toThrow(/以下盘点明细已完成库存调整[\s\S]*si-2/);
  });

  it('cancel rejects while an adjust claim is active', async () => {
    const { db } = buildDb({
      status: 'counting',
      adjustingAt: Date.now() - 1000,
    });
    const repo = new StocktakeRepository(db);

    await expect(repo.cancel('st-1')).rejects.toThrow('盘点调整正在执行中，无法取消');
  });

  it('cancel CAS update skips active claims via the adjusting_at predicate', async () => {
    const { db, calls } = buildDb({ status: 'counting', adjustingAt: null });
    const repo = new StocktakeRepository(db);

    await repo.cancel('st-1');

    const cancelRun = calls.runs.find((s) => s.sql.includes("SET status = 'cancelled'"));
    expect(cancelRun).toBeTruthy();
    expect(cancelRun.sql).toContain("status NOT IN ('adjusted', 'cancelled')");
    expect(cancelRun.sql).toContain('adjusting_at IS NULL OR adjusting_at < ?');
  });
});

describe('StocktakeRepository.create budget guard (R15.3)', () => {
  it('rejects creation when the statement count exceeds the D1 batch limit', async () => {
    const variants = Array.from({ length: 100 }, (_, index) => ({
      variant_id: `var-${index}`,
    }));
    const { db } = buildDb({});
    // create() 先查询全部活跃变体
    db.prepare = vi.fn((sql) => {
      const statement = {
        sql,
        params: [],
        bind: vi.fn(function bindStatement(...params) {
          statement.params = params;
          return statement;
        }),
        async all() {
          if (sql.includes('FROM product_variants pv')) {
            return { results: variants };
          }
          return { results: [] };
        },
        async run() {
          return { meta: { changes: 1 } };
        },
        async first() {
          return null;
        },
      };
      return statement;
    });
    const repo = new StocktakeRepository(db);

    // 1（主表）+ 100（明细）> D1_MAX_BATCH_SIZE(100) → 拒绝而非跨块非原子
    await expect(repo.create({ notes: null })).rejects.toThrow(/变体数量过多/);
  });
});
