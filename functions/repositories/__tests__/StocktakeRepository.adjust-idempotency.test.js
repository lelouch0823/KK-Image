import { describe, expect, it, vi } from 'vitest';
import { StocktakeRepository } from '../StocktakeRepository.js';

/**
 * 盘点调整项级幂等（审查 B3）
 *
 * 旧实现：整单语句塞进 executeBatchChunks（按语句数盲目切块、每块独立
 * 事务），中途失败回滚状态后重试会把已提交块的项再调整一遍。
 * 新实现：每项库存写入 + adjusted_at 标记同 batch、按 item 边界切块；
 * 失败保持 counting 并释放认领，重试只处理 adjusted_at IS NULL 的项。
 */

function buildDb({ pendingItems, failOnBatch }) {
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
          return { meta: { changes: 1 } };
        },
        async all() {
          if (sql.includes('FROM stocktake_items si')) {
            return { results: pendingItems.filter((item) => !item.filtered) };
          }
          return { results: [] };
        },
        async first() {
          if (sql.includes('SELECT status FROM stocktakes')) {
            return { status: 'counting' };
          }
          return null;
        },
      };
      return statement;
    }),
    batch: vi.fn(async (statements) => {
      if (failOnBatch && calls.batches.length === failOnBatch.index) {
        throw new Error(failOnBatch.error);
      }
      calls.batches.push(statements.map((s) => ({ sql: s.sql, params: s.params })));
      return statements.map(() => ({ meta: { changes: 1 } }));
    }),
  };
  return { db, calls };
}

function buildInventoryServiceStub() {
  return {
    buildMutationStatements: vi.fn(async (mutation) => ({
      statements: [
        { sql: 'UPDATE product_variants ...', params: [mutation.quantityDelta, mutation.variantId] },
        { sql: 'INSERT INTO inventory_ledger ...', params: [mutation.type] },
      ],
    })),
    refreshProjections: vi.fn(async () => []),
  };
}

describe('StocktakeRepository.adjustInventory idempotency', () => {
  it('marks each item adjusted in the same batch as its inventory writes and finalizes status', async () => {
    const pendingItems = [
      { item_id: 'si-1', variant_id: 'var-1', system_qty: 5, actual_qty: 3, difference: -2 },
      { item_id: 'si-2', variant_id: 'var-2', system_qty: 1, actual_qty: 4, difference: 3 },
    ];
    const { db, calls } = buildDb({ pendingItems });
    const inventoryService = buildInventoryServiceStub();
    const repo = new StocktakeRepository(db, { InventoryServiceFactory: () => inventoryService });

    const result = await repo.adjustInventory('st-1');

    expect(result).toEqual({ adjustedCount: 2, totalDelta: 5 });
    // 每项的语句与其 adjusted_at 标记落在同一 batch（此处项数少 → 单块）
    expect(calls.batches).toHaveLength(1);
    const markerStatements = calls.batches[0].filter((s) =>
      s.sql.includes('UPDATE stocktake_items SET adjusted_at')
    );
    expect(markerStatements).toHaveLength(2);
    // 状态推进到 adjusted 只在全部块提交之后
    const finalize = calls.runs.find((s) => s.sql.includes("SET status = 'adjusted'"));
    expect(finalize).toBeTruthy();
    expect(inventoryService.refreshProjections).toHaveBeenCalledWith(['var-1', 'var-2']);
  });

  it('on mid-way failure keeps status counting and releases claim for resumable retry', async () => {
    const pendingItems = [
      { item_id: 'si-1', variant_id: 'var-1', system_qty: 5, actual_qty: 3, difference: -2 },
      { item_id: 'si-2', variant_id: 'var-2', system_qty: 1, actual_qty: 4, difference: 3 },
    ];

    // 第一次运行：首个 batch 即失败（项数少时全部打包为单块）
    const first = buildDb({ pendingItems, failOnBatch: { index: 0, error: 'CHECK constraint failed' } });
    const firstService = buildInventoryServiceStub();
    const repo = new StocktakeRepository(first.db, {
      InventoryServiceFactory: () => firstService,
    });

    await expect(repo.adjustInventory('st-1')).rejects.toThrow(/部分完成.*继续/);

    // 失败后：释放认领（adjusting_at = NULL），且不回滚 status 到 adjusted
    const clearClaim = first.calls.runs.find((s) =>
      s.sql.includes('SET adjusting_at = NULL')
    );
    expect(clearClaim).toBeTruthy();
    const finalize = first.calls.runs.find((s) => s.sql.includes("SET status = 'adjusted'"));
    expect(finalize).toBeUndefined();
  });

  it('retries only items not yet marked adjusted', async () => {
    // 模拟上次运行已把 si-1 调整完（adjusted_at 已置）：本次只剩 si-2
    const pendingItems = [
      { item_id: 'si-2', variant_id: 'var-2', system_qty: 1, actual_qty: 4, difference: 3 },
    ];
    const { db, calls } = buildDb({ pendingItems });
    const inventoryService = buildInventoryServiceStub();
    const repo = new StocktakeRepository(db, { InventoryServiceFactory: () => inventoryService });

    const result = await repo.adjustInventory('st-1');

    expect(result).toEqual({ adjustedCount: 1, totalDelta: 3 });
    const appliedVariantIds = inventoryService.buildMutationStatements.mock.calls.map(
      (call) => call[0].variantId
    );
    expect(appliedVariantIds).toEqual(['var-2']);
  });
});
