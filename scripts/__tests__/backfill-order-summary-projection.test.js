import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts/migrations/backfill-order-summary-projection.mjs');
const HELPER_PATH = path.resolve(process.cwd(), 'functions/repositories/order/summary-projection.js');

describe('backfill-order-summary-projection', () => {
  it('exists and exports projection backfill helpers', async () => {
    const exists = fs.existsSync(SCRIPT_PATH);

    expect(exists).toBe(true);
    if (!exists) return;

    const mod = await import(pathToFileURL(SCRIPT_PATH).href);

    expect(typeof mod.buildSelectOrdersNeedingProjectionSql).toBe('function');
    expect(typeof mod.mapOrderSummaryProjectionRow).toBe('function');
    expect(typeof mod.buildUpsertOrderSummaryProjectionSql).toBe('function');
  });

  it('selects orders with rolled-up line and return aggregates for projection backfill', async () => {
    if (!fs.existsSync(SCRIPT_PATH)) {
      expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
      return;
    }

    const { buildSelectOrdersNeedingProjectionSql } = await import(pathToFileURL(SCRIPT_PATH).href);
    const sql = buildSelectOrdersNeedingProjectionSql({ limit: 50 });

    expect(sql).toContain('FROM orders o');
    expect(sql).toContain('LEFT JOIN order_summary_projection existing_projection');
    expect(sql).toContain('FROM order_lines');
    expect(sql).toContain('FROM order_returns');
    expect(sql).toContain(') line_agg ON line_agg.order_id = o.id');
    expect(sql).toContain(') return_agg ON return_agg.order_id = o.id');
    expect(sql).toContain('existing_projection.order_id IS NULL');
    expect(sql).toContain('existing_projection.updated_at < COALESCE(o.updated_at, o.created_at)');
    expect(sql).toContain('LIMIT 50');
    expect(sql).toContain('COALESCE(line_agg.ordered_qty, 0) AS ordered_qty');
    expect(sql).toContain('COALESCE(return_agg.returned_qty, 0) AS returned_qty');
    expect(sql).toContain('effective_delivery_status');
  });

  it('maps aggregate rows into stable projection payloads', async () => {
    if (!fs.existsSync(SCRIPT_PATH)) {
      expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
      return;
    }

    const { mapOrderSummaryProjectionRow } = await import(pathToFileURL(SCRIPT_PATH).href);
    const row = mapOrderSummaryProjectionRow({
      order_id: 'ord_1',
      snapshot_name: 'Chair',
      display_status: 'partially_received',
      ordered_qty: 5,
      procured_qty: 5,
      received_qty: 2,
      shipped_qty: 1,
      returned_qty: 1,
      cancelled_qty: 0,
      effective_delivery_status: 'partially_returned',
      projection_updated_at: 1700000000000,
    });

    expect(row).toEqual({
      order_id: 'ord_1',
      snapshot_name: 'Chair',
      display_status: 'partially_received',
      ordered_qty: 5,
      procured_qty: 5,
      received_qty: 2,
      shipped_qty: 1,
      returned_qty: 1,
      cancelled_qty: 0,
      effective_delivery_status: 'partially_returned',
      updated_at: 1700000000000,
    });
  });

  it('builds projection upserts with order_summary_projection columns', async () => {
    if (!fs.existsSync(SCRIPT_PATH)) {
      expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
      return;
    }

    const { buildUpsertOrderSummaryProjectionSql } = await import(pathToFileURL(SCRIPT_PATH).href);
    const sql = buildUpsertOrderSummaryProjectionSql({
      order_id: 'ord_1',
      snapshot_name: 'Chair',
      display_status: 'partially_received',
      ordered_qty: 5,
      procured_qty: 5,
      received_qty: 2,
      shipped_qty: 1,
      returned_qty: 1,
      cancelled_qty: 0,
      effective_delivery_status: 'partially_returned',
      updated_at: 1700000000000,
    });

    expect(sql).toContain('INSERT INTO order_summary_projection');
    expect(sql).toContain('effective_delivery_status');
    expect(sql).toContain("'partially_returned'");
    expect(sql).toContain('ON CONFLICT(order_id) DO UPDATE');
  });

  it('builds batched projection upserts to avoid one CLI roundtrip per row', async () => {
    if (!fs.existsSync(SCRIPT_PATH)) {
      expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
      return;
    }

    const { buildUpsertOrderSummaryProjectionBatchSql } = await import(pathToFileURL(SCRIPT_PATH).href);
    const sql = buildUpsertOrderSummaryProjectionBatchSql([
      {
        order_id: 'ord_1',
        snapshot_name: 'Chair',
        display_status: 'partially_received',
        ordered_qty: 5,
        procured_qty: 5,
        received_qty: 2,
        shipped_qty: 1,
        returned_qty: 1,
        cancelled_qty: 0,
        effective_delivery_status: 'partially_returned',
        updated_at: 1700000000000,
      },
      {
        order_id: 'ord_2',
        snapshot_name: 'Lamp',
        display_status: 'unprocured',
        ordered_qty: 3,
        procured_qty: 0,
        received_qty: 0,
        shipped_qty: 0,
        returned_qty: 0,
        cancelled_qty: 0,
        effective_delivery_status: 'not_shipped',
        updated_at: 1700000000001,
      },
    ]);

    expect(sql.match(/INSERT INTO order_summary_projection/g)?.length || 0).toBe(2);
    expect(sql).toContain("'ord_1'");
    expect(sql).toContain("'ord_2'");
  });
});

describe('order summary projection repository helper', () => {
  it('exports join and projection SQL fragments for list-query adoption', async () => {
    const exists = fs.existsSync(HELPER_PATH);

    expect(exists).toBe(true);
    if (!exists) return;

    const mod = await import(pathToFileURL(HELPER_PATH).href);

    expect(mod.ORDER_SUMMARY_PROJECTION_JOIN).toContain('LEFT JOIN order_summary_projection order_summary');
    expect(mod.ORDER_SUMMARY_PROGRESS_STATUS_SQL).toContain('order_summary.display_status');
    expect(mod.ORDER_SUMMARY_EFFECTIVE_DELIVERY_STATUS_SQL).toContain('order_summary.effective_delivery_status');
    expect(mod.ORDER_SUMMARY_PRODUCT_SEARCH_SQL).toContain('order_summary.snapshot_name LIKE ?');
  });
});
