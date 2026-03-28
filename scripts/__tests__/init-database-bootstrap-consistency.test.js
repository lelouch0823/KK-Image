import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function loadInitSchema() {
  const file = path.resolve(process.cwd(), 'scripts/init-database.sql');
  return fs.readFileSync(file, 'utf8');
}

describe('init-database bootstrap consistency', () => {
  it('defines prerequisite tables referenced by Task 1 foundation FKs', () => {
    const sql = loadInitSchema();

    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS\s+product_variants\s*\(/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS\s+purchase_orders\s*\(/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS\s+purchase_order_items\s*\(/i);
    expect(sql).toMatch(/\bpre_order_id\b/i);
    expect(sql).not.toMatch(/\bcustomer_order_id\b/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS\s+inventory_ledger\s*\(/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS\s+inventory_balances\s*\(/i);
  });
});
