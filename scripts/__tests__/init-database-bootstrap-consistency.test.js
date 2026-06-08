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
  it('defines fulfillment, delivery, and returns persistence for order redesign', () => {
    const sql = loadInitSchema();
    const ordersSql = extractCreateTableBlock(sql, 'orders');
    const returnsSql = extractCreateTableBlock(sql, 'order_returns');
    const inventoryEventsSql = extractCreateTableBlock(sql, 'inventory_events');

    expect(ordersSql).toMatch(
      /\bfulfillment_status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'unfulfilled'/i
    );
    expect(ordersSql).toMatch(/\bdelivery_status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'not_shipped'/i);
    expect(returnsSql).toMatch(/CREATE TABLE IF NOT EXISTS\s+order_returns\s*\(/i);
    expect(returnsSql).toMatch(/\border_id\s+TEXT\s+NOT\s+NULL\b/i);
    expect(returnsSql).toMatch(/\border_line_id\s+TEXT\s+NOT\s+NULL\b/i);
    expect(returnsSql).toMatch(/\bvariant_id\s+TEXT\b/i);
    expect(returnsSql).toMatch(/\bquantity\s+INTEGER\s+NOT\s+NULL\b/i);
    expect(returnsSql).toMatch(/\bstatus\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'requested'/i);
    expect(inventoryEventsSql).toMatch(/'order_return_restock'/i);
  });

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
    expect(tableSql).toMatch(
      /\bdisplay_status\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'open'\s+CHECK\s*\(\s*display_status\s+IN\s*\(/i
    );
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
    expect(commandSql).toMatch(/'failed'/i);

    expect(outboxSql).toMatch(/CREATE TABLE IF NOT EXISTS\s+domain_outbox\s*\(/i);
    expect(outboxSql).toMatch(/\bevent_type\s+TEXT\s+NOT\s+NULL\b/i);
    expect(outboxSql).toMatch(/\bcommand_id\s+TEXT\s+NOT\s+NULL\b/i);
    expect(outboxSql).toMatch(/\bsequence_in_command\s+INTEGER\s+NOT\s+NULL\b/i);

    expect(jobsSql).toMatch(/CREATE TABLE IF NOT EXISTS\s+outbox_consumer_jobs\s*\(/i);
    expect(jobsSql).toMatch(/\bconsumer_name\s+TEXT\s+NOT\s+NULL\b/i);
    expect(jobsSql).toMatch(/\bevent_id\s+TEXT\s+NOT\s+NULL\b/i);
    expect(jobsSql).toMatch(/\bleased_until\s+INTEGER\b/i);
  });

  it('defines first-batch performance indexes for hot read paths', () => {
    const sql = loadInitSchema();

    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_spaces_share_mode ON spaces(share_mode)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_notifications_receiver_read_created');
    expect(sql).toContain('ON notifications(receiver, is_read, created_at DESC)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_space_files_space_section_sort');
    expect(sql).toContain('ON space_files(space_id, section, sort_order)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_space_access_logs_space_time');
    expect(sql).toContain('ON space_access_logs(space_id, accessed_at DESC)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_orders_salesperson_created');
    expect(sql).toContain('ON orders(salesperson_id, created_at DESC)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_orders_salesperson_status_created');
    expect(sql).toContain('ON orders(salesperson_id, status, created_at DESC)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_order_lines_order_created');
    expect(sql).toContain('ON order_lines(order_id, created_at ASC)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_order_lines_variant_status_created');
    expect(sql).toContain('ON order_lines(variant_id, display_status, created_at ASC)');
  });

  it('defines recycle-bin columns and hot-path indexes for files and folders', () => {
    const sql = loadInitSchema();
    const foldersSql = extractCreateTableBlock(sql, 'folders');
    const filesSql = extractCreateTableBlock(sql, 'files');

    expect(foldersSql).toMatch(/\bis_deleted\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0\b/i);
    expect(foldersSql).toMatch(/\bdeleted_at\s+INTEGER\b/i);
    expect(filesSql).toMatch(/\bis_deleted\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0\b/i);
    expect(filesSql).toMatch(/\bdeleted_at\s+INTEGER\b/i);

    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_files_folder_deleted_created');
    expect(sql).toContain('ON files(folder_id, is_deleted, created_at DESC)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_files_original_hash_deleted');
    expect(sql).toContain('ON files(original_hash, is_deleted)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_folders_parent_deleted_created');
    expect(sql).toContain('ON folders(parent_id, is_deleted, created_at DESC)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_folders_deleted_name');
    expect(sql).toContain('ON folders(is_deleted, name)');
  });

  it('defines order_summary_projection bootstrap table, indexes, and refresh triggers', () => {
    const sql = loadInitSchema();
    const projectionSql = extractCreateTableBlock(sql, 'order_summary_projection');

    expect(projectionSql).toMatch(/CREATE TABLE IF NOT EXISTS\s+order_summary_projection\s*\(/i);
    expect(projectionSql).toMatch(/\border_id\s+TEXT\s+PRIMARY\s+KEY\b/i);
    expect(projectionSql).toMatch(/\bdisplay_status\s+TEXT\b/i);
    expect(projectionSql).toMatch(/\bsnapshot_name\s+TEXT\b/i);
    expect(projectionSql).toMatch(/\bordered_qty\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0\b/i);
    expect(projectionSql).toMatch(/\bshipped_qty\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0\b/i);
    expect(projectionSql).toMatch(/\breturned_qty\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0\b/i);
    expect(projectionSql).toMatch(/\bcancelled_qty\s+INTEGER\s+NOT\s+NULL\s+DEFAULT\s+0\b/i);
    expect(projectionSql).toMatch(/\beffective_delivery_status\s+TEXT\s+NOT\s+NULL\b/i);
    expect(projectionSql).toMatch(/\bupdated_at\s+INTEGER\s+NOT\s+NULL\b/i);
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_order_summary_projection_display_status');
    expect(sql).toContain(
      'CREATE INDEX IF NOT EXISTS idx_order_summary_projection_effective_delivery_status'
    );
    expect(sql).toContain('CREATE TRIGGER IF NOT EXISTS trg_order_summary_projection_orders_ai');
    expect(sql).toContain('CREATE TRIGGER IF NOT EXISTS trg_order_summary_projection_orders_au');
    expect(sql).toContain(
      'CREATE TRIGGER IF NOT EXISTS trg_order_summary_projection_order_lines_ai'
    );
    expect(sql).toContain(
      'CREATE TRIGGER IF NOT EXISTS trg_order_summary_projection_order_lines_au'
    );
    expect(sql).toContain(
      'CREATE TRIGGER IF NOT EXISTS trg_order_summary_projection_order_lines_ad'
    );
    expect(sql).toContain(
      'CREATE TRIGGER IF NOT EXISTS trg_order_summary_projection_order_returns_ai'
    );
    expect(sql).toContain(
      'CREATE TRIGGER IF NOT EXISTS trg_order_summary_projection_order_returns_au'
    );
    expect(sql).toContain(
      'CREATE TRIGGER IF NOT EXISTS trg_order_summary_projection_order_returns_ad'
    );
    expect(sql).toMatch(
      /CREATE TRIGGER IF NOT EXISTS\s+trg_order_summary_projection_order_lines_au[\s\S]*OLD\.order_id/i
    );
    expect(sql).toMatch(
      /CREATE TRIGGER IF NOT EXISTS\s+trg_order_summary_projection_order_returns_au[\s\S]*OLD\.order_id/i
    );
  });

  it('defines order_payloads sidecar and lightweight order summary columns', () => {
    const sql = loadInitSchema();
    const ordersSql = extractCreateTableBlock(sql, 'orders');
    const payloadsSql = extractCreateTableBlock(sql, 'order_payloads');

    expect(ordersSql).toMatch(/\bsummary_name\s+TEXT\b/i);
    expect(ordersSql).toMatch(/\bsummary_brand\s+TEXT\b/i);
    expect(ordersSql).toMatch(/\bsummary_sku\s+TEXT\b/i);
    expect(payloadsSql).toMatch(/CREATE TABLE IF NOT EXISTS\s+order_payloads\s*\(/i);
    expect(payloadsSql).toMatch(/\border_id\s+TEXT\s+PRIMARY\s+KEY\b/i);
    expect(payloadsSql).toMatch(/\boriginal_data\s+TEXT\s+NOT\s+NULL\b/i);
    expect(payloadsSql).toMatch(/\bcurrent_data\s+TEXT\s+NOT\s+NULL\b/i);
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_order_payloads_updated_at');
  });

  it('rejects duplicated unique and plain indexes for exact-match columns', () => {
    const sql = loadInitSchema();

    expect(sql).not.toContain('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
    expect(sql).not.toContain(
      'CREATE INDEX IF NOT EXISTS idx_api_keys_value ON api_keys(key_value)'
    );
    expect(sql).not.toContain('CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)');
    expect(sql).not.toContain('CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug)');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug)');
    expect(sql).not.toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug_unique');
    expect(sql).not.toContain(
      'CREATE INDEX IF NOT EXISTS idx_variants_sku ON product_variants(sku)'
    );
    expect(sql).not.toContain(
      'CREATE INDEX IF NOT EXISTS idx_salespersons_token ON salespersons(access_token)'
    );
    expect(sql).not.toContain(
      'CREATE INDEX IF NOT EXISTS idx_salespersons_wechat_openid ON salespersons(wechat_openid)'
    );
    expect(sql).not.toContain('CREATE INDEX IF NOT EXISTS idx_orders_no ON orders(order_no)');
    expect(sql).not.toContain(
      'CREATE INDEX IF NOT EXISTS idx_purchase_orders_no ON purchase_orders(po_no)'
    );
    expect(sql).not.toContain(
      'CREATE INDEX IF NOT EXISTS idx_folders_share_token ON folders(share_token)'
    );
    expect(sql).not.toContain(
      'CREATE INDEX IF NOT EXISTS idx_albums_share_token ON albums(share_token)'
    );
    expect(sql).not.toContain(
      'CREATE INDEX IF NOT EXISTS idx_spaces_share_token ON spaces(share_token)'
    );
    expect(sql).not.toContain(
      'CREATE INDEX IF NOT EXISTS idx_purchase_receipt_reversals_original_receipt'
    );
    expect(sql).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_receipt_reversals_original_receipt_unique'
    );
  });
});
