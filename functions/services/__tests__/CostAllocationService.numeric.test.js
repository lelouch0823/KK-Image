import { describe, expect, it, vi } from 'vitest';
import { CostAllocationService } from '../CostAllocationService.js';

/**
 * 成本分摊数值回归测试（审查 B2）
 *
 * 锁定三个不变量：
 * 1. Σ(单件 allocated_freight × received_qty) === 运费总额（分粒度精确）；
 * 2. allocated_freight / allocated_tariff 是"单件"语义（migration 0035 列注释），
 *    MAC 按 (unit_cost + allocated_*) × qty 计入成本；
 * 3. by_value 按金额比例、by_quantity 按件数比例（不是明细条数）。
 *
 * 旧实现三处缺陷：by_value 把"元"当"分"用（少 100 倍）；两个分布都返回
 * 每明细绝对份额却写入单件列；by_quantity 按明细条数而非件数均摊。
 */

function buildHarness({ po, items }) {
  const updates = [];
  const db = {
    prepare: vi.fn((sql) => ({
      sql,
      bind: vi.fn(function bindStatement(...params) {
        return { sql, params };
      }),
    })),
    batch: vi.fn(async (statements) => {
      for (const statement of statements) {
        if (statement.sql.includes('UPDATE purchase_order_items')) {
          const [allocatedFreight, allocatedTariff, id] = statement.params;
          updates.push({ id, allocated_freight: allocatedFreight, allocated_tariff: allocatedTariff });
        }
      }
      return statements.map(() => ({ meta: { changes: 1 } }));
    }),
  };
  const repo = {
    findById: vi.fn(async () => po),
    getItemsForAllocation: vi.fn(async () => items),
  };
  const service = new CostAllocationService(db, { repo });
  return { service, updates };
}

function roundedSum(items, updates, field) {
  const byId = new Map(updates.map((row) => [row.id, row]));
  return (
    Math.round(
      items.reduce(
        (sum, item) => sum + (byId.get(item.id)?.[field] || 0) * getQty(item) * 100,
        0
      )
    ) / 100
  );
}

function getQty(item) {
  return Math.max(Number(item.received_qty) || 0, 0);
}

describe('CostAllocationService numeric invariants', () => {
  it('by_quantity allocates per-unit freight proportional to received quantity', async () => {
    // 1 条 qty=10 + 1 条 qty=1，运费 30 元：旧实现按条数均摊会写入 15 元/条
    //（总计入 165 元）；新实现按件数加权，Σ(单件×数量) === 30
    const items = [
      { id: 'item-1', variant_id: 'var-1', unit_cost: 20, received_qty: 10, allocated_freight: 0, allocated_tariff: 0 },
      { id: 'item-2', variant_id: 'var-2', unit_cost: 20, received_qty: 1, allocated_freight: 0, allocated_tariff: 0 },
    ];
    const { service, updates } = buildHarness({
      po: {
        status: 'completed',
        allocation_method: 'by_quantity',
        actual_shipping_cost: 30,
        actual_tariff_cost: 7,
      },
      items,
    });

    await service.allocateCosts('po-1');

    expect(updates).toHaveLength(2);
    expect(roundedSum(items, updates, 'allocated_freight')).toBe(30);
    expect(roundedSum(items, updates, 'allocated_tariff')).toBe(7);

    const byId = new Map(updates.map((row) => [row.id, row]));
    // 单件值：30 元按 10:1 分配 → [27.27, 2.73] 元/件（分粒度 2727:273）
    expect(byId.get('item-1').allocated_freight).toBeCloseTo(2.727, 3);
    expect(byId.get('item-2').allocated_freight).toBeCloseTo(2.73, 3);
  });

  it('by_value keeps total magnitude (no 1/100 shrink) and follows value weights', async () => {
    // 旧实现 totalCents = Math.round(total)（元当分）：100 元运费只分摊 1 元。
    // 新实现必须保持 Σ(单件×数量) === 100 元
    const items = [
      { id: 'item-1', variant_id: 'var-1', unit_cost: 100, received_qty: 2, allocated_freight: 0, allocated_tariff: 0 },
      { id: 'item-2', variant_id: 'var-2', unit_cost: 50, received_qty: 2, allocated_freight: 0, allocated_tariff: 0 },
    ];
    const { service, updates } = buildHarness({
      po: {
        status: 'completed',
        allocation_method: 'by_value',
        actual_shipping_cost: 100,
        actual_tariff_cost: 0,
      },
      items,
    });

    await service.allocateCosts('po-1');

    expect(roundedSum(items, updates, 'allocated_freight')).toBe(100);
    // 金额权重 200:100 = 2:1 → 66.67 / 33.33 元，单件 33.335 / 16.665
    const byId = new Map(updates.map((row) => [row.id, row]));
    expect(byId.get('item-1').allocated_freight).toBeCloseTo(33.335, 3);
    expect(byId.get('item-2').allocated_freight).toBeCloseTo(16.665, 3);
  });

  it('excludes items with zero received quantity from allocation', async () => {
    const items = [
      { id: 'item-1', variant_id: 'var-1', unit_cost: 10, received_qty: 5, allocated_freight: 0, allocated_tariff: 0 },
      { id: 'item-2', variant_id: 'var-2', unit_cost: 10, received_qty: 0, allocated_freight: 0, allocated_tariff: 0 },
    ];
    const { service, updates } = buildHarness({
      po: {
        status: 'completed',
        allocation_method: 'by_quantity',
        actual_shipping_cost: 10,
        actual_tariff_cost: 0,
      },
      items,
    });

    await service.allocateCosts('po-1');

    const byId = new Map(updates.map((row) => [row.id, row]));
    expect(byId.get('item-1').allocated_freight).toBeCloseTo(2, 6);
    expect(byId.get('item-2').allocated_freight).toBe(0);
    expect(roundedSum(items, updates, 'allocated_freight')).toBe(10);
  });

  it('re-allocation reverses previous per-unit allocations exactly (MAC input)', async () => {
    // 上一次分摊写入的单件值（2 元/件 × 5 件 = 10 元）在重算时必须被
    // 完整反解：新分摊 15 元 → 增量 5 元，而不是叠加旧值
    const items = [
      { id: 'item-1', variant_id: 'var-1', unit_cost: 10, received_qty: 5, allocated_freight: 2, allocated_tariff: 0 },
    ];
    const { service, updates } = buildHarness({
      po: {
        status: 'completed',
        allocation_method: 'by_quantity',
        actual_shipping_cost: 15,
        actual_tariff_cost: 0,
      },
      items,
    });

    await service.allocateCosts('po-1');

    expect(updates[0].allocated_freight).toBeCloseTo(3, 6);
    expect(roundedSum(items, updates, 'allocated_freight')).toBe(15);
  });
});
