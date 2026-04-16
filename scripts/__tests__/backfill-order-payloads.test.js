import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts/migrations/backfill-order-payloads.mjs');

describe('backfill-order-payloads', () => {
  it('exists and exports payload backfill helpers', async () => {
    const exists = fs.existsSync(SCRIPT_PATH);

    expect(exists).toBe(true);
    if (!exists) return;

    const mod = await import(pathToFileURL(SCRIPT_PATH).href);
    expect(typeof mod.buildSelectOrderPayloadRowsSql).toBe('function');
    expect(typeof mod.mapOrderPayloadRow).toBe('function');
    expect(typeof mod.buildUpsertOrderPayloadSql).toBe('function');
  });

  it('selects payload and summary fields from orders for backfill', async () => {
    if (!fs.existsSync(SCRIPT_PATH)) {
      expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
      return;
    }

    const { buildSelectOrderPayloadRowsSql } = await import(pathToFileURL(SCRIPT_PATH).href);
    const sql = buildSelectOrderPayloadRowsSql({ limit: 25 });

    expect(sql).toContain('FROM orders o');
    expect(sql).toContain('o.original_data');
    expect(sql).toContain('o.current_data');
    expect(sql).toContain('json_extract');
    expect(sql).toContain('LIMIT 25');
  });

  it('maps payload rows into sidecar upsert shape', async () => {
    if (!fs.existsSync(SCRIPT_PATH)) {
      expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
      return;
    }

    const { mapOrderPayloadRow } = await import(pathToFileURL(SCRIPT_PATH).href);
    expect(mapOrderPayloadRow({
      order_id: 'ord_1',
      original_data: '{"name":"Chair"}',
      current_data: '{"name":"Chair","brand":"KK","sku":"SKU-1"}',
      summary_name: 'Chair',
      summary_brand: 'KK',
      summary_sku: 'SKU-1',
      updated_at: 1700000000000,
    })).toEqual({
      order_id: 'ord_1',
      original_data: '{"name":"Chair"}',
      current_data: '{"name":"Chair","brand":"KK","sku":"SKU-1"}',
      summary_name: 'Chair',
      summary_brand: 'KK',
      summary_sku: 'SKU-1',
      updated_at: 1700000000000,
    });
  });

  it('builds payload upserts for sidecar and summary columns', async () => {
    if (!fs.existsSync(SCRIPT_PATH)) {
      expect(fs.existsSync(SCRIPT_PATH)).toBe(true);
      return;
    }

    const { buildUpsertOrderPayloadSql } = await import(pathToFileURL(SCRIPT_PATH).href);
    const sql = buildUpsertOrderPayloadSql({
      order_id: 'ord_1',
      original_data: '{"name":"Chair"}',
      current_data: '{"name":"Chair","brand":"KK","sku":"SKU-1"}',
      summary_name: 'Chair',
      summary_brand: 'KK',
      summary_sku: 'SKU-1',
      updated_at: 1700000000000,
    });

    expect(sql).toContain('INSERT INTO order_payloads');
    expect(sql).toContain('ON CONFLICT(order_id) DO UPDATE');
    expect(sql).toContain('UPDATE orders');
    expect(sql).toContain('summary_name');
    expect(sql).toContain('summary_brand');
    expect(sql).toContain('summary_sku');
  });
});
