import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function loadInitSchema() {
  const file = path.resolve(process.cwd(), 'scripts/init-database.sql');
  return fs.readFileSync(file, 'utf8');
}

function extractCreateTableBlock(sql, tableName) {
  const escapedTableName = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `CREATE TABLE IF NOT EXISTS\\s+${escapedTableName}\\s*\\([\\s\\S]*?\\n\\);`,
    'i'
  );
  return sql.match(pattern)?.[0] || '';
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

  it('defines purchase_order_items receipt progress columns for partial receipt flows', () => {
    const sql = loadInitSchema();
    const tableSql = extractCreateTableBlock(sql, 'purchase_order_items');

    expect(tableSql).toMatch(/CREATE TABLE IF NOT EXISTS\s+purchase_order_items\s*\(/i);
    expect(tableSql).toMatch(/\breceived_qty\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0\b/i);
    expect(tableSql).toMatch(/\bcancelled_qty\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0\b/i);
    expect(tableSql).toMatch(/\bdisplay_status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'open'\s+CHECK\s*\(\s*display_status\s+IN\s*\(/i);
    expect(tableSql).toMatch(/'partially_received'/i);
    expect(tableSql).toMatch(/'received'/i);
    expect(tableSql).toMatch(/'cancelled'/i);
  });

  it('defines command idempotency and outbox tables for receipt delivery', () => {
    const sql = loadInitSchema();
    const commandSql = extractCreateTableBlock(sql, 'command_idempotency');
    const outboxSql = extractCreateTableBlock(sql, 'domain_outbox');
    const jobsSql = extractCreateTableBlock(sql, 'outbox_consumer_jobs');

    expect(commandSql).toMatch(/CREATE TABLE IF NOT EXISTS\s+command_idempotency\s*\(/i);
    expect(commandSql).toMatch(/\bcommand_type\s+TEXT\s+NOT\s+NULL\b/i);
    expect(commandSql).toMatch(/\bidempotency_key\s+TEXT\s+NOT\s+NULL\b/i);
    expect(commandSql).toMatch(/\brequest_fingerprint\s+TEXT\s+NOT\s+NULL\b/i);

    expect(outboxSql).toMatch(/CREATE TABLE IF NOT EXISTS\s+domain_outbox\s*\(/i);
    expect(outboxSql).toMatch(/\bevent_type\s+TEXT\s+NOT\s+NULL\b/i);
    expect(outboxSql).toMatch(/\bcommand_id\s+TEXT\s+NOT\s+NULL\b/i);
    expect(outboxSql).toMatch(/\bsequence_in_command\s+INTEGER\s+NOT\s+NULL\b/i);

    expect(jobsSql).toMatch(/CREATE TABLE IF NOT EXISTS\s+outbox_consumer_jobs\s*\(/i);
    expect(jobsSql).toMatch(/\bconsumer_name\s+TEXT\s+NOT\s+NULL\b/i);
    expect(jobsSql).toMatch(/\bevent_id\s+TEXT\s+NOT\s+NULL\b/i);
    expect(jobsSql).toMatch(/\bleased_until\s+INTEGER\b/i);
  });
});
