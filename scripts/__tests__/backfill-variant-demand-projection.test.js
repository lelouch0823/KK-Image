import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const SCRIPT_PATH = path.resolve(
  process.cwd(),
  'scripts/migrations/backfill-variant-demand-projection.mjs'
);

describe('backfill-variant-demand-projection', () => {
  it('exists and exports projection backfill helpers', async () => {
    const exists = fs.existsSync(SCRIPT_PATH);

    expect(exists).toBe(true);
    if (!exists) return;

    const mod = await import(pathToFileURL(SCRIPT_PATH).href);

    expect(typeof mod.buildSelectVariantDemandProjectionSql).toBe('function');
    expect(typeof mod.mapVariantDemandProjectionRow).toBe('function');
    expect(typeof mod.buildUpsertVariantDemandProjectionSql).toBe('function');
  });

  it('selects demand aggregates from order_lines + orders for projection backfill', async () => {
    if (!fs.existsSync(SCRIPT_PATH)) {
      expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
      return;
    }

    const { buildSelectVariantDemandProjectionSql } = await import(pathToFileURL(SCRIPT_PATH).href);
    const sql = buildSelectVariantDemandProjectionSql({ limit: 30 });

    expect(sql).toContain('FROM order_lines ol');
    expect(sql).toContain('JOIN orders o ON o.id = ol.order_id');
    expect(sql).toContain("o.status IN ('confirmed', 'production', 'shipping', 'arrived')");
    expect(sql).toContain('GROUP BY ol.variant_id');
    expect(sql).toContain(
      "GROUP_CONCAT(DISTINCT CASE WHEN o.status = 'confirmed' THEN o.id END) AS order_ids"
    );
    expect(sql).toContain('LIMIT 30');
  });

  it('maps aggregate rows to projection payload shape', async () => {
    if (!fs.existsSync(SCRIPT_PATH)) {
      expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
      return;
    }

    const { mapVariantDemandProjectionRow } = await import(pathToFileURL(SCRIPT_PATH).href);
    const row = mapVariantDemandProjectionRow({
      variant_id: 'variant-1',
      confirmed_qty: 5,
      production_qty: 3,
      shipping_qty: 1,
      arrived_qty: 0,
      total_demand: 9,
      order_count: 2,
      order_ids: 'o-1,o-2',
      projection_updated_at: 1700000000000,
    });

    expect(row).toEqual({
      variant_id: 'variant-1',
      confirmed_qty: 5,
      production_qty: 3,
      shipping_qty: 1,
      arrived_qty: 0,
      total_demand: 9,
      order_count: 2,
      order_ids: 'o-1,o-2',
      updated_at: 1700000000000,
    });
  });

  it('builds upsert SQL for variant_demand_projection', async () => {
    if (!fs.existsSync(SCRIPT_PATH)) {
      expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
      return;
    }

    const { buildUpsertVariantDemandProjectionSql } = await import(pathToFileURL(SCRIPT_PATH).href);
    const sql = buildUpsertVariantDemandProjectionSql({
      variant_id: 'variant-1',
      confirmed_qty: 5,
      production_qty: 3,
      shipping_qty: 1,
      arrived_qty: 0,
      total_demand: 9,
      order_count: 2,
      order_ids: 'o-1,o-2',
      updated_at: 1700000000000,
    });

    expect(sql).toContain('INSERT INTO variant_demand_projection');
    expect(sql).toContain("'variant-1'");
    expect(sql).toContain("'o-1,o-2'");
    expect(sql).toContain('ON CONFLICT(variant_id) DO UPDATE');
  });
});
