import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertNoDuplicatePrefixes,
  extractPrefix,
  findDuplicatePrefixes,
  normalizeAllowlist,
} from '../check-migration-prefixes.mjs';

describe('check-migration-prefixes', () => {
  it('extracts numeric prefix from migration name', () => {
    expect(extractPrefix('0001_init.sql')).toBe('0001');
    expect(extractPrefix('not-a-migration.sql')).toBe(null);
  });

  it('finds duplicate prefixes with file lists', () => {
    const duplicates = findDuplicatePrefixes([
      '0001_init.sql',
      '0002_a.sql',
      '0002_b.sql',
      '0010_x.sql',
    ]);

    expect(duplicates).toEqual([
      { prefix: '0002', files: ['0002_a.sql', '0002_b.sql'] },
    ]);
  });

  it('throws when duplicate prefixes exist', () => {
    expect(() =>
      assertNoDuplicatePrefixes(['0001_init.sql', '0001_extra.sql', '0002_ok.sql'])
    ).toThrow(/duplicate migration prefixes/i);
  });

  it('does not throw when prefixes are unique', () => {
    expect(() => assertNoDuplicatePrefixes(['0001_init.sql', '0002_next.sql'])).not.toThrow();
  });

  it('accepts historical duplicate prefixes when allowlisted with exact file set', () => {
    const allowlist = normalizeAllowlist({
      '0002': ['0002_spaces.sql', '0002_add_share_expiration.sql'],
    });

    expect(() =>
      assertNoDuplicatePrefixes(
        ['0001_init.sql', '0002_add_share_expiration.sql', '0002_spaces.sql'],
        allowlist
      )
    ).not.toThrow();
  });

  it('throws when duplicate prefix differs from allowlisted file set', () => {
    const allowlist = normalizeAllowlist({
      '0002': ['0002_spaces.sql', '0002_add_share_expiration.sql'],
    });

    expect(() =>
      assertNoDuplicatePrefixes(
        ['0001_init.sql', '0002_add_share_expiration.sql', '0002_spaces.sql', '0002_new.sql'],
        allowlist
      )
    ).toThrow(/allowlist mismatch/i);
  });

  it('accepts the order procurement domain redesign migration name', async () => {
    const files = ['0053_order_procurement_domain_redesign.sql'];
    expect(files.every((file) => /^\d+_.+\.sql$/.test(file))).toBe(true);
  });

  it('accepts the purchase order item progress fields migration name', async () => {
    const fileName = '0054_purchase_order_item_progress_fields.sql';
    const file = path.resolve(process.cwd(), 'migrations', fileName);
    const sql = fs.readFileSync(file, 'utf8');

    expect(fileName).toMatch(/^\d+_.+\.sql$/);
    expect(fs.existsSync(file)).toBe(true);
    expect(sql).toContain('ALTER TABLE purchase_order_items');
    expect(sql).toContain('SELECT COALESCE(SUM(pr.received_qty), 0)');
    expect(sql).toContain("WHEN COALESCE(received_qty, 0) > 0 THEN 'partially_received'");
  });

  it('accepts the command idempotency and outbox migration name', async () => {
    const fileName = '0055_command_idempotency_and_outbox.sql';
    const file = path.resolve(process.cwd(), 'migrations', fileName);

    expect(fileName).toMatch(/^\d+_.+\.sql$/);
    expect(fs.existsSync(file)).toBe(true);

    const sql = fs.readFileSync(file, 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS command_idempotency');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS domain_outbox');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS outbox_consumer_jobs');
  });

  it('accepts the backend performance indexes migration name', async () => {
    const fileName = '0071_backend_performance_indexes.sql';
    const file = path.resolve(process.cwd(), 'migrations', fileName);

    expect(fileName).toMatch(/^\d+_.+\.sql$/);
    expect(fs.existsSync(file)).toBe(true);

    const sql = fs.readFileSync(file, 'utf8');
    expect(sql).toContain('idx_spaces_share_mode');
    expect(sql).toContain('idx_notifications_receiver_read_created');
    expect(sql).toContain('idx_space_files_space_section_sort');
    expect(sql).toContain('idx_space_access_logs_space_time');
    expect(sql).toContain('idx_orders_salesperson_created');
    expect(sql).toContain('idx_orders_salesperson_status_created');
    expect(sql).toContain('idx_order_lines_order_created');
    expect(sql).toContain('idx_order_lines_variant_status_created');
    expect(sql).toContain('idx_files_folder_deleted_created');
    expect(sql).toContain('idx_files_original_hash_deleted');
    expect(sql).toContain('idx_folders_parent_deleted_created');
    expect(sql).toContain('idx_folders_deleted_name');
  });
});
